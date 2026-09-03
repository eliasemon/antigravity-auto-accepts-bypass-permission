import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { loadConfig, saveConfig, getConfigPath, getDefaultConfigDir, DEFAULT_CONFIG } from './config.js';
import { AntigravityAutoAcceptDaemon } from './daemon.js';
import { readDaemonState, sendIPCRequest, clearDaemonState } from './ipc.js';
import { ProcessDetector } from './process-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runCLI(args) {
  const command = args[0] || 'help';

  // Helper flags
  const getFlag = (name, fallback = null) => {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
    return fallback;
  };

  const hasFlag = (name) => args.includes(name);

  const configPath = getFlag('--config');
  const portOverride = getFlag('--port');

  switch (command) {
    case 'run':
    case 'foreground': {
      const config = loadConfig(configPath);
      if (portOverride) {
        config.cdp.port = parseInt(portOverride, 10);
      }

      console.log('====================================================');
      console.log('🚀 Antigravity Auto-Accept (Foreground Mode)');
      console.log(`📡 CDP Target: http://${config.cdp.host}:${config.cdp.port}`);
      console.log(`🛡️  Safety Guardrails: ${config.safety.enabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(`⏱️  Element Cooldown: ${config.cooldown.elementCooldownMs}ms`);
      console.log('====================================================');

      // Check running process status
      const procInfo = ProcessDetector.detect();
      if (!procInfo.running) {
        console.warn('⚠️  Antigravity process not detected yet. Waiting for launch...');
      } else if (!procInfo.hasDebugPort) {
        console.warn(`⚠️  Antigravity is running, but --remote-debugging-port=${config.cdp.port} was not detected!`);
        console.warn('Run "antigravity-auto-accept doctor" for setup instructions.\n');
      }

      const daemon = new AntigravityAutoAcceptDaemon(config);

      const cleanup = async () => {
        console.log('\nStopping auto-accept...');
        await daemon.stop();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      await daemon.start({ interactive: true });
      break;
    }

    case 'start': {
      const state = readDaemonState();
      if (state && state.pid) {
        try {
          process.kill(state.pid, 0); // Check if process still alive
          console.log(`⚠️  Antigravity Auto-Accept daemon is already running (PID: ${state.pid}).`);
          console.log('Use "antigravity-auto-accept status" or "antigravity-auto-accept toggle".');
          return;
        } catch (e) {
          // Stale state file
          clearDaemonState();
        }
      }

      const logDir = getDefaultConfigDir();
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logFile = path.join(logDir, 'daemon.log');
      const out = fs.openSync(logFile, 'a');
      const err = fs.openSync(logFile, 'a');

      const cliPath = path.resolve(__dirname, '../bin/antigravity-auto-accept.js');
      const childArgs = [cliPath, 'run'];
      if (configPath) childArgs.push('--config', configPath);
      if (portOverride) childArgs.push('--port', portOverride);

      const child = spawn(process.execPath, childArgs, {
        detached: true,
        stdio: ['ignore', out, err],
        env: { ...process.env },
      });

      child.unref();

      console.log(`✅ Started Antigravity Auto-Accept daemon (PID: ${child.pid}).`);
      console.log(`📄 Log file: ${logFile}`);
      console.log('Run "antigravity-auto-accept status" to check status or "stop" to terminate.');
      break;
    }

    case 'stop': {
      const state = readDaemonState();
      if (!state || !state.pid) {
        console.log('ℹ️  No running daemon detected.');
        return;
      }

      let stopped = false;
      if (state.ipcPort) {
        try {
          await sendIPCRequest(state.ipcPort, 'POST', '/stop');
          stopped = true;
        } catch (e) {}
      }

      if (!stopped) {
        try {
          process.kill(state.pid, 'SIGTERM');
        } catch (e) {}
      }

      clearDaemonState();
      console.log(`🛑 Antigravity Auto-Accept daemon (PID: ${state.pid}) stopped.`);
      break;
    }

    case 'toggle': {
      const state = readDaemonState();
      if (!state || !state.ipcPort) {
        console.error('❌ Daemon is not running or IPC port is unavailable.');
        return;
      }
      try {
        const res = await sendIPCRequest(state.ipcPort, 'POST', '/toggle');
        const isPaused = res.body?.paused;
        console.log(`🔄 Auto-Accept is now ${isPaused ? 'PAUSED ⏸️' : 'ACTIVE ▶️'}`);
      } catch (err) {
        console.error(`❌ Failed to communicate with daemon: ${err.message}`);
      }
      break;
    }

    case 'pause': {
      const state = readDaemonState();
      if (!state || !state.ipcPort) {
        console.error('❌ Daemon is not running.');
        return;
      }
      try {
        await sendIPCRequest(state.ipcPort, 'POST', '/pause');
        console.log('⏸️  Auto-Accept PAUSED.');
      } catch (err) {
        console.error(`❌ Failed to send pause: ${err.message}`);
      }
      break;
    }

    case 'resume': {
      const state = readDaemonState();
      if (!state || !state.ipcPort) {
        console.error('❌ Daemon is not running.');
        return;
      }
      try {
        await sendIPCRequest(state.ipcPort, 'POST', '/resume');
        console.log('▶️  Auto-Accept RESUMED.');
      } catch (err) {
        console.error(`❌ Failed to send resume: ${err.message}`);
      }
      break;
    }

    case 'status': {
      const state = readDaemonState();
      if (!state || !state.pid) {
        console.log('Status: 🔴 STOPPED (Daemon is not running)');
        console.log('Start it with: antigravity-auto-accept start (or "run" for foreground)');
        return;
      }

      let ipcAlive = false;
      let daemonInfo = null;

      if (state.ipcPort) {
        try {
          const res = await sendIPCRequest(state.ipcPort, 'GET', '/status');
          ipcAlive = true;
          daemonInfo = res.body;
        } catch (e) {}
      }

      console.log('====================================================');
      console.log('Antigravity Auto-Accept Status');
      console.log('====================================================');
      console.log(`Daemon Process:    🟢 RUNNING (PID: ${state.pid})`);
      console.log(`IPC Port:          ${state.ipcPort || 'N/A'}`);

      if (daemonInfo) {
        console.log(`State:             ${daemonInfo.paused ? '⏸️  PAUSED' : '▶️  ACTIVE'}`);
        console.log(`CDP Connected:     ${daemonInfo.cdpConnected ? '✅ Yes' : '❌ No (searching for target)'}`);
        if (daemonInfo.currentTarget) {
          console.log(`Current Target:    "${daemonInfo.currentTarget.title}" (${daemonInfo.currentTarget.url})`);
        }
        console.log(`Accepted Prompts:  ${daemonInfo.stats?.acceptedCount || 0}`);
        console.log(`Blocked Prompts:   ${daemonInfo.stats?.blockedCount || 0}`);
        if (daemonInfo.stats?.lastAction) {
          console.log(`Last Action:       ${JSON.stringify(daemonInfo.stats.lastAction)}`);
        }
      } else {
        console.log('State:             ⚠️  Process alive but IPC unresponsive');
      }
      console.log('====================================================');
      break;
    }

    case 'doctor': {
      console.log('====================================================');
      console.log('🔍 Antigravity Environment Doctor');
      console.log('====================================================');
      const config = loadConfig(configPath);
      const port = portOverride ? parseInt(portOverride, 10) : config.cdp.port;
      const procInfo = ProcessDetector.detect();

      console.log(`OS Platform:       ${process.platform} (${process.arch})`);
      console.log(`Target CDP Port:   ${port}`);
      console.log(`Process Detected:  ${procInfo.running ? '✅ Yes' : '❌ No'}`);

      if (procInfo.running) {
        console.log(`PIDs:              ${procInfo.pids.join(', ')}`);
        console.log(`Debug Port Flag:   ${procInfo.hasDebugPort ? `✅ Found (--remote-debugging-port=${procInfo.debugPort})` : '❌ Missing'}`);
      }

      console.log('\n--- Setup Instructions ---');
      console.log(ProcessDetector.getSetupInstructions(port));
      break;
    }

    case 'launch': {
      const config = loadConfig(configPath);
      const port = portOverride ? parseInt(portOverride, 10) : config.cdp.port;
      console.log(`Attempting to launch Antigravity with --remote-debugging-port=${port}...`);
      const res = ProcessDetector.launch(port);
      if (res.success) {
        console.log(`✅ ${res.message}`);
      } else {
        console.error(`❌ Launch failed: ${res.error}`);
        console.log(ProcessDetector.getSetupInstructions(port));
      }
      break;
    }

    case 'config': {
      const sub = args[1] || 'show';
      if (sub === 'path') {
        console.log(getConfigPath(configPath));
      } else if (sub === 'init') {
        const dest = saveConfig(DEFAULT_CONFIG, configPath);
        console.log(`✅ Initialized default config at: ${dest}`);
      } else if (sub === 'show') {
        const loaded = loadConfig(configPath);
        console.log(`Config file: ${getConfigPath(configPath)}`);
        console.log(JSON.stringify(loaded, null, 2));
      } else {
        console.log('Usage: antigravity-auto-accept config [show|init|path]');
      }
      break;
    }

    case '--version':
    case '-v':
    case 'version': {
      console.log('antigravity-auto-accept v1.0.0');
      break;
    }

    case 'patch-core': {
      console.log('====================================================');
      console.log('⚡ Antigravity Native Core Patcher');
      console.log('====================================================');
      const { patchDesktopApp, patchIdeApp, getAntigravityAppPaths } = await import('./core-patcher.js');
      const paths = getAntigravityAppPaths();

      let patchedAny = false;

      if (paths.desktopAppAsar) {
        try {
          await patchDesktopApp(paths.desktopAppAsar);
          patchedAny = true;
        } catch (err) {
          console.error(`❌ Failed patching Desktop App: ${err.message}`);
        }
      } else {
        console.log('ℹ️  Antigravity Desktop app.asar not found on this system.');
      }

      if (paths.ideAgentJs) {
        try {
          await patchIdeApp(paths.ideAgentJs);
          patchedAny = true;
        } catch (err) {
          console.error(`❌ Failed patching IDE App: ${err.message}`);
        }
      } else {
        console.log('ℹ️  Antigravity IDE jetskiAgent.js not found on this system.');
      }

      if (patchedAny) {
        console.log('\n🎉 Patch complete! Restart Antigravity to activate native core auto-accept.');
      } else {
        console.warn('\n⚠️  No Antigravity installations found to patch.');
      }
      break;
    }

    case 'unpatch-core': {
      console.log('====================================================');
      console.log('🔄 Reverting Antigravity Core Patches');
      console.log('====================================================');
      const { unpatchCore } = await import('./core-patcher.js');
      try {
        await unpatchCore();
        console.log('🎉 Core unpatched! Restart Antigravity to return to stock.');
      } catch (err) {
        console.error(`❌ Unpatch failed: ${err.message}`);
      }
      break;
    }

    case '--help':
    case '-h':
    case 'help':
    default: {
      console.log(`
Antigravity Auto-Accept CLI

Usage:
  antigravity-auto-accept <command> [options]

Commands:
  run             Run auto-accept in foreground (interactive logs & keys)
  start           Start auto-accept as a background daemon
  stop            Stop the running background daemon
  status          Show live status, target connection, and stats
  toggle          Instantly toggle pause / resume on running daemon
  pause           Pause auto-accepting
  resume          Resume auto-accepting
  patch-core      Inject native auto-accept directly into Antigravity core runtime
  unpatch-core    Revert core runtime back to original factory state
  doctor          Diagnose Antigravity process & remote-debugging-port
  launch          Launch Antigravity with remote debugging port exposed
  config show     Display active configuration
  config init     Initialize default config file
  config path     Print location of the config file

Options:
  --port <port>   Override CDP debugging port (default: 9333)
  --config <path> Use custom configuration file
  -h, --help      Display help information
  -v, --version   Display version
`);
      break;
    }
  }
}
