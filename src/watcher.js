import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getAntigravityAppPaths, patchDesktopApp, patchIdeApp } from './core-patcher.js';

export class UpdateWatcher {
  /**
   * @param {object} options
   * @param {number} [options.checkIntervalMs=15000]
   */
  constructor(options = {}) {
    this.checkIntervalMs = options.checkIntervalMs || 15000;
    this.timer = null;
    this.isPatching = false;
  }

  /**
   * Checks whether app.asar or IDE files were overwritten by an update and re-patches if needed.
   */
  async checkAndPatch() {
    if (this.isPatching) return;
    this.isPatching = true;

    try {
      const paths = getAntigravityAppPaths();
      let repatchedAny = false;

      // 1. Check Antigravity Desktop app.asar
      if (paths.desktopAppAsar && fs.existsSync(paths.desktopAppAsar)) {
        try {
          const buf = fs.readFileSync(paths.desktopAppAsar);
          if (!buf.includes('antigravity-core-auto-accept-injected')) {
            console.log('[watcher] 🔄 Detected unpatched Antigravity Desktop app.asar (after app update). Re-patching now...');
            await patchDesktopApp(paths.desktopAppAsar);
            console.log('[watcher] ✅ Antigravity Desktop re-patched successfully!');
            repatchedAny = true;
          }
        } catch (e) {
          console.warn(`[watcher] Error inspecting desktopAppAsar: ${e.message}`);
        }
      }

      // 2. Check Antigravity IDE workbench.js & jetskiAgent.js
      if (paths.ideWorkbenchJs && fs.existsSync(paths.ideWorkbenchJs)) {
        try {
          const content = fs.readFileSync(paths.ideWorkbenchJs, 'utf8');
          if (!content.includes('ANTIGRAVITY PRECISE AUTO-ACCEPT')) {
            console.log('[watcher] 🔄 Detected unpatched Antigravity IDE workbench.js (after IDE update). Re-patching now...');
            await patchIdeApp();
            console.log('[watcher] ✅ Antigravity IDE re-patched successfully!');
            repatchedAny = true;
          }
        } catch (e) {
          console.warn(`[watcher] Error inspecting ideWorkbenchJs: ${e.message}`);
        }
      }

      return repatchedAny;
    } finally {
      this.isPatching = false;
    }
  }

  start() {
    console.log('[watcher] 👁️  Antigravity Update Watcher active. Monitoring for application updates...');
    this.checkAndPatch();
    this.timer = setInterval(() => this.checkAndPatch(), this.checkIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[watcher] 🛑 Antigravity Update Watcher stopped.');
    }
  }
}

/**
 * Creates/installs OS-level persistence service (launchd on macOS, systemd on Linux, startup on Windows)
 */
export function installPersistenceService() {
  const platform = process.platform;
  const nodeBin = process.execPath;
  const cliScript = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/antigravity-auto-accept.js');

  if (platform === 'darwin') {
    const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    if (!fs.existsSync(launchAgentsDir)) {
      fs.mkdirSync(launchAgentsDir, { recursive: true });
    }
    const plistPath = path.join(launchAgentsDir, 'com.antigravity.auto-accept.plist');
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.antigravity.auto-accept</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${cliScript}</string>
    <string>watch</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(os.homedir(), '.config', 'antigravity-auto-accept', 'watcher.log')}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(os.homedir(), '.config', 'antigravity-auto-accept', 'watcher.log')}</string>
</dict>
</plist>`;
    fs.writeFileSync(plistPath, plistContent, 'utf8');
    console.log(`[watcher] ✅ Installed macOS LaunchAgent at: ${plistPath}`);
    return { success: true, path: plistPath };
  } else if (platform === 'linux') {
    const systemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    if (!fs.existsSync(systemdDir)) {
      fs.mkdirSync(systemdDir, { recursive: true });
    }
    const servicePath = path.join(systemdDir, 'antigravity-auto-accept.service');
    const serviceContent = `[Unit]
Description=Antigravity Auto-Accept Update Watcher
After=network.target

[Service]
ExecStart=${nodeBin} ${cliScript} watch
Restart=always
RestartSec=10

[Install]
WantedBy=default.target`;
    fs.writeFileSync(servicePath, serviceContent, 'utf8');
    console.log(`[watcher] ✅ Installed systemd user service at: ${servicePath}`);
    return { success: true, path: servicePath };
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const vbsPath = path.join(startupDir, 'antigravity-auto-accept.vbs');
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """${nodeBin}"" ""${cliScript}"" watch", 0, False`;
    fs.writeFileSync(vbsPath, vbsContent, 'utf8');
    console.log(`[watcher] ✅ Installed Windows startup script at: ${vbsPath}`);
    return { success: true, path: vbsPath };
  }

  return { success: false, error: 'Unsupported platform' };
}
