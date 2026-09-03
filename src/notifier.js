import { spawn } from 'child_process';
import os from 'os';

/**
 * Cross-platform desktop notification dispatcher without heavy native dependencies.
 */
export function sendNotification({ title = 'Antigravity Auto-Accept', message, urgency = 'normal' }) {
  const platform = os.platform();
  const cleanTitle = title.replace(/"/g, '\\"');
  const cleanMsg = message.replace(/"/g, '\\"').replace(/\n/g, ' ');

  try {
    if (platform === 'darwin') {
      // macOS AppleScript notification
      const script = `display notification "${cleanMsg}" with title "${cleanTitle}"`;
      spawn('osascript', ['-e', script], { stdio: 'ignore', detached: true }).unref();
    } else if (platform === 'linux') {
      // Linux notify-send
      const urgencyFlag = urgency === 'critical' ? 'critical' : 'normal';
      spawn('notify-send', ['-u', urgencyFlag, cleanTitle, cleanMsg], {
        stdio: 'ignore',
        detached: true,
      }).unref();
    } else if (platform === 'win32') {
      // Windows PowerShell balloon tooltip / notification
      const psCommand = `
        [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');
        $objNotifyIcon = New-Object System.Windows.Forms.NotifyIcon;
        $objNotifyIcon.Icon = [System.Drawing.SystemIcons]::Warning;
        $objNotifyIcon.BalloonTipIcon = 'Warning';
        $objNotifyIcon.BalloonTipTitle = '${cleanTitle.replace(/'/g, "''")}';
        $objNotifyIcon.BalloonTipText = '${cleanMsg.replace(/'/g, "''")}';
        $objNotifyIcon.Visible = $True;
        $objNotifyIcon.ShowBalloonTip(5000);
      `;
      spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand], {
        stdio: 'ignore',
        detached: true,
      }).unref();
    }
  } catch (err) {
    // If notification fails, fallback to stdout alert
    console.warn(`[notifier] Unable to show native notification: ${err.message}`);
  }
}
