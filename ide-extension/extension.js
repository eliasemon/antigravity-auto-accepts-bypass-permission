const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

let statusBarItem;
let isEnabled = true;
let acceptedCount = 0;

function getStateFilePath() {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'antigravity-auto-accept');
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
    } catch (e) {}
  }
  return path.join(configDir, 'state.json');
}

function readState() {
  try {
    const p = getStateFilePath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (typeof data.enabled === 'boolean') isEnabled = data.enabled;
      if (typeof data.acceptedCount === 'number') acceptedCount = data.acceptedCount;
    }
  } catch (e) {}
}

function writeState() {
  try {
    const p = getStateFilePath();
    fs.writeFileSync(p, JSON.stringify({
      enabled: isEnabled,
      acceptedCount,
      updatedAt: Date.now()
    }, null, 2), 'utf8');
  } catch (e) {}
}

function updateStatusBar() {
  if (!statusBarItem) return;
  if (isEnabled) {
    statusBarItem.text = `$(zap) Auto-Accept: ON${acceptedCount > 0 ? ` (${acceptedCount})` : ''}`;
    statusBarItem.tooltip = 'Antigravity Auto-Accept: Active (Click to Pause)';
    statusBarItem.color = '#4ade80';
  } else {
    statusBarItem.text = `$(circle-slash) Auto-Accept: OFF`;
    statusBarItem.tooltip = 'Antigravity Auto-Accept: Paused (Click to Resume)';
    statusBarItem.color = '#f87171';
  }
  statusBarItem.show();
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // 1. Initial State from storage or file
  readState();
  const storedEnabled = context.globalState.get('antigravity_auto_accept_enabled');
  if (typeof storedEnabled === 'boolean') {
    isEnabled = storedEnabled;
  }
  const storedCount = context.globalState.get('antigravity_accepted_count');
  if (typeof storedCount === 'number' && storedCount > acceptedCount) {
    acceptedCount = storedCount;
  }

  // 2. Create bottom right status bar item with high priority
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10000);
  statusBarItem.command = 'antigravity-auto-accept.toggle';
  updateStatusBar();
  context.subscriptions.push(statusBarItem);

  // 3. Sync with file-based state periodically (e.g., from Desktop App or CLI)
  const syncTimer = setInterval(() => {
    const prevEnabled = isEnabled;
    const prevCount = acceptedCount;
    readState();
    if (prevEnabled !== isEnabled || prevCount !== acceptedCount) {
      context.globalState.update('antigravity_auto_accept_enabled', isEnabled);
      context.globalState.update('antigravity_accepted_count', acceptedCount);
      updateStatusBar();
    }
  }, 1000);

  context.subscriptions.push({
    dispose: () => clearInterval(syncTimer)
  });

  // 4. Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravity-auto-accept.toggle', () => {
      isEnabled = !isEnabled;
      context.globalState.update('antigravity_auto_accept_enabled', isEnabled);
      writeState();
      updateStatusBar();
      if (isEnabled) {
        vscode.window.showInformationMessage('⚡ Antigravity Auto-Accept is now ACTIVE');
      } else {
        vscode.window.showWarningMessage('⏸️ Antigravity Auto-Accept is now PAUSED');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('antigravity-auto-accept.enable', () => {
      isEnabled = true;
      context.globalState.update('antigravity_auto_accept_enabled', true);
      writeState();
      updateStatusBar();
      vscode.window.showInformationMessage('⚡ Antigravity Auto-Accept is now ACTIVE');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('antigravity-auto-accept.disable', () => {
      isEnabled = false;
      context.globalState.update('antigravity_auto_accept_enabled', false);
      writeState();
      updateStatusBar();
      vscode.window.showWarningMessage('⏸️ Antigravity Auto-Accept is now PAUSED');
    })
  );

  console.log('[Antigravity Auto-Accept Extension] Activated in Antigravity IDE bottom status bar.');
}

function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};
