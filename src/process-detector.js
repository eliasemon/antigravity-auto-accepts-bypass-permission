import { execSync, spawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

/**
 * Process detector and launcher helper for Google Antigravity desktop & IDE
 */
export class ProcessDetector {
  /**
   * Scans common user data directories for DevToolsActivePort file
   * written by Chromium/Electron when remote debugging is active.
   */
  static findActiveDevToolsPort() {
    const platform = os.platform();
    const candidateDirs = [];

    if (platform === 'darwin') {
      const appSupport = path.join(os.homedir(), 'Library', 'Application Support');
      candidateDirs.push(
        path.join(appSupport, 'Antigravity'),
        path.join(appSupport, 'Antigravity IDE'),
        path.join(appSupport, 'Google Antigravity'),
        path.join(appSupport, 'Code')
      );
    } else if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      candidateDirs.push(
        path.join(appData, 'Antigravity'),
        path.join(appData, 'Antigravity IDE'),
        path.join(appData, 'Google Antigravity'),
        path.join(appData, 'Code')
      );
    } else {
      // Linux
      const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      candidateDirs.push(
        path.join(configDir, 'Antigravity'),
        path.join(configDir, 'Antigravity IDE'),
        path.join(configDir, 'antigravity'),
        path.join(configDir, 'google-antigravity'),
        path.join(configDir, 'Code')
      );
    }

    for (const dir of candidateDirs) {
      const portFile = path.join(dir, 'DevToolsActivePort');
      if (fs.existsSync(portFile)) {
        try {
          const content = fs.readFileSync(portFile, 'utf8').trim().split('\n');
          const port = parseInt(content[0], 10);
          if (port > 0 && port < 65536) {
            return {
              port,
              path: portFile,
              browserWsPath: content[1] || '',
            };
          }
        } catch (e) {}
      }
    }

    return null;
  }

  /**
   * Scans running processes across platforms to find Antigravity.
   */
  static detect() {
    const platform = os.platform();
    const result = {
      running: false,
      pids: [],
      hasDebugPort: false,
      debugPort: null,
      discoveredPortFile: null,
      commandLines: [],
      platform,
    };

    // First check DevToolsActivePort file
    const activePortInfo = this.findActiveDevToolsPort();
    if (activePortInfo) {
      result.discoveredPortFile = activePortInfo.path;
      result.debugPort = activePortInfo.port;
      result.hasDebugPort = true;
    }

    try {
      if (platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'Antigravity' -or $_.CommandLine -match 'Antigravity' } | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;
        const output = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
        if (output) {
          const parsed = JSON.parse(output);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const p of list) {
            result.running = true;
            result.pids.push(p.ProcessId);
            const line = p.CommandLine || '';
            result.commandLines.push(line);
            const portMatch = line.match(/--remote-debugging-port=(\d+)/i);
            if (portMatch) {
              result.hasDebugPort = true;
              const cliPort = parseInt(portMatch[1], 10);
              if (cliPort > 0) result.debugPort = cliPort;
            }
          }
        }
      } else {
        // macOS & Linux
        const cmd = `ps -eo pid,args | grep -iE "(antigravity|Google Antigravity)" | grep -v grep || true`;
        const output = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
        if (output) {
          const lines = output.split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[0], 10);
            const command = parts.slice(1).join(' ');
            if (pid && command && !command.includes('antigravity-auto-accept')) {
              result.running = true;
              result.pids.push(pid);
              result.commandLines.push(command);
              const portMatch = command.match(/--remote-debugging-port=(\d+)/i);
              if (portMatch) {
                result.hasDebugPort = true;
                const cliPort = parseInt(portMatch[1], 10);
                if (cliPort > 0) result.debugPort = cliPort;
              }
            }
          }
        }
      }
    } catch (err) {
      // Process scan failed or empty
    }

    return result;
  }

  /**
   * Returns OS-specific setup guidance string
   */
  static getSetupInstructions(port = 9333) {
    const platform = os.platform();
    if (platform === 'darwin') {
      return `
[macOS Setup Instructions]
To expose the remote debugging port in Antigravity:
1. Terminal launch (Desktop App):
   open -a "Google Antigravity" --args --remote-debugging-port=${port}
   or direct binary:
   "/Applications/Google Antigravity.app/Contents/MacOS/Electron" --remote-debugging-port=${port}

2. Terminal launch (VS Code IDE):
   antigravity --remote-debugging-port=${port}

3. Permanent shell alias:
   echo 'alias antigravity-debug="open -a \\"Google Antigravity\\" --args --remote-debugging-port=${port}"' >> ~/.zshrc
   source ~/.zshrc
`;
    }

    if (platform === 'win32') {
      return `
[Windows Setup Instructions]
To expose the remote debugging port in Antigravity:
1. Modify your Desktop / Start Menu shortcut:
   Right-click Shortcut -> Properties -> Target:
   Append: --remote-debugging-port=${port}
   Example:
   "C:\\Program Files\\Google Antigravity\\Antigravity.exe" --remote-debugging-port=${port}

2. Command Prompt / PowerShell:
   Start-Process "Antigravity.exe" -ArgumentList "--remote-debugging-port=${port}"
`;
    }

    // Linux
    return `
[Linux Setup Instructions]
To expose the remote debugging port in Antigravity:
1. Command Line:
   antigravity --remote-debugging-port=${port} &

2. Update .desktop Launcher:
   Edit ~/.local/share/applications/antigravity.desktop:
   Exec=/usr/bin/antigravity --remote-debugging-port=${port} %F
`;
  }

  /**
   * Attempts to launch Antigravity with the debug port flag.
   */
  static launch(port = 9333) {
    const platform = os.platform();
    let cmd = '';
    let args = [];

    if (platform === 'darwin') {
      cmd = 'open';
      args = ['-a', 'Google Antigravity', '--args', `--remote-debugging-port=${port}`];
    } else if (platform === 'win32') {
      cmd = 'powershell';
      args = [
        '-NoProfile',
        '-Command',
        `Start-Process "Antigravity.exe" -ArgumentList "--remote-debugging-port=${port}"`,
      ];
    } else {
      cmd = 'antigravity';
      args = [`--remote-debugging-port=${port}`];
    }

    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      child.unref();
      return { success: true, message: `Launched Antigravity with --remote-debugging-port=${port}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
