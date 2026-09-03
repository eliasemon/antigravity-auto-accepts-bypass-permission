import fs from 'fs';
import path from 'path';
import os from 'os';

export const DEFAULT_CONFIG = {
  cdp: {
    host: '127.0.0.1',
    port: 9333,
    pollIntervalMs: 200,
    reconnectDelayMs: 2000,
    targetTimeoutMs: 10000,
  },
  cooldown: {
    elementCooldownMs: 5000,
    maxCacheEntries: 1000,
  },
  buttons: {
    acceptLabels: [
      'Accept',
      'Always Allow',
      'Allow',
      'Run',
      'Run Command',
      'Approve',
      'Execute',
      'Proceed',
      'Confirm',
      'Yes',
      'Keep',
      'Apply',
    ],
    rejectLabels: [
      'Reject',
      'Cancel',
      'Deny',
      'Skip',
      'Dismiss',
      'No',
      'Don\'t Allow',
    ],
  },
  safety: {
    enabled: true,
    notifyOnBlock: true,
    workspacePath: process.cwd(),
    // Strict manual review rules per user request:
    // Only leave for manual review if command contains: sudo, rm, -rf, drop
    blacklist: [
      {
        id: 'sudo',
        description: 'Superuser privilege escalation (sudo)',
        pattern: '\\bsudo\\b',
        flags: 'i',
      },
      {
        id: 'rm',
        description: 'File deletion command (rm, rmdir, del, Remove-Item)',
        pattern: '\\b(?:rm|rmdir|del|Remove-Item)\\b',
        flags: 'i',
      },
      {
        id: 'rf-flag',
        description: 'Recursive force flag (-rf, -fr, -r -f)',
        pattern: '(?:-[a-zA-Z0-9]*r[a-zA-Z0-9]*f\\b|-[a-zA-Z0-9]*f[a-zA-Z0-9]*r\\b|-rf|-fr)',
        flags: 'i',
      },
      {
        id: 'drop',
        description: 'Database drop command (DROP TABLE, DROP DATABASE, drop)',
        pattern: '\\bdrop\\b',
        flags: 'i',
      },
    ],
  },
};

export function getDefaultConfigDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'antigravity-auto-accept');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'antigravity-auto-accept');
}

export function getConfigPath(customPath = null) {
  if (customPath) return path.resolve(customPath);
  if (process.env.ANTIGRAVITY_AUTO_ACCEPT_CONFIG) {
    return path.resolve(process.env.ANTIGRAVITY_AUTO_ACCEPT_CONFIG);
  }
  return path.join(getDefaultConfigDir(), 'config.json');
}

function deepMerge(target, source) {
  const output = { ...target };
  if (!source || typeof source !== 'object') return output;

  for (const key of Object.keys(source)) {
    if (
      source[key] instanceof Object &&
      !Array.isArray(source[key]) &&
      key in target &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

export function loadConfig(customPath = null) {
  const configPath = getConfigPath(customPath);
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return deepMerge(DEFAULT_CONFIG, parsed);
    } catch (err) {
      console.error(`[config] Warning: Failed to parse ${configPath}: ${err.message}. Using default config.`);
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config, customPath = null) {
  const configPath = getConfigPath(customPath);
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return configPath;
}
