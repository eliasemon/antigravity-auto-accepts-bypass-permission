import fs from 'fs';
import path from 'path';
import os from 'os';

export const DEFAULT_CONFIG = {
  cdp: {
    host: '127.0.0.1',
    port: 9333,
    pollIntervalMs: 500,
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
    blacklist: [
      {
        id: 'destructive-rm',
        description: 'Recursive or forced file deletion (rm -rf / rmdir / del)',
        pattern: '\\b(?:rm\\s+-[a-zA-Z0-9]*[rf][a-zA-Z0-9]*|rmdir\\s+/[sq]|del\\s+/[fqs])\\b',
        flags: 'i',
      },
      {
        id: 'privilege-escalation',
        description: 'Superuser / privilege escalation commands (sudo, doas, runas, pkexec)',
        pattern: '\\b(?:sudo|doas|runas|pkexec|su\\s+-?)\\b|Set-ExecutionPolicy\\s+(?:Unrestricted|Bypass)',
        flags: 'i',
      },
      {
        id: 'pipe-to-shell',
        description: 'Downloading and piping untrusted code directly to a shell',
        pattern: '(?:curl|wget|fetch|invoke-webrequest|iwr)\\b.*\\|\\s*(?:bash|sh|zsh|python[23]?|perl|pwsh|powershell)',
        flags: 'i',
      },
      {
        id: 'git-force-push-reset',
        description: 'Destructive git operations (git push --force, reset --hard, clean -f)',
        pattern: '\\bgit\\s+(?:push\\s+[^;\\n]*(?:--force|-f\\b)|reset\\s+--hard|clean\\s+-[a-zA-Z0-9]*f|branch\\s+-(?:D|D\\b))',
        flags: 'i',
      },
      {
        id: 'sql-drop-truncate',
        description: 'Destructive SQL database/table manipulation (DROP, TRUNCATE)',
        pattern: '\\b(?:DROP\\s+(?:DATABASE|SCHEMA|TABLE|VIEW|PROCEDURE)|TRUNCATE\\s+(?:TABLE\\s+)?)\\b',
        flags: 'i',
      },
      {
        id: 'sensitive-credentials-and-keys',
        description: 'Access or modification of sensitive environment files, SSH keys, or cloud credentials',
        pattern: '(?:\\.env(?:\\.[a-zA-Z0-9_-]+)?|\\bid_rsa|\\bid_ed25519|\\bauthorized_keys|\\.pem|\\.key|\\.pfx|aws_access_key_id|AWS_SECRET_ACCESS_KEY|credentials\\.json|service[_-]account.*\\.json)',
        flags: 'i',
      },
      {
        id: 'disk-and-firmware-destruction',
        description: 'Direct raw disk manipulation, format, or fork bombs',
        pattern: '(?:\\bdd\\s+if=|\\bmkfs(?:\\.\\w+)?\\b|format\\s+[a-z]:|>\\s*/dev/sd[a-z]|>\\s*/dev/nvme|:\\(\\)\\s*\\{\\s*:\\|:&\\s*\\};:)',
        flags: 'i',
      },
      {
        id: 'system-root-alteration',
        description: 'Modifying sensitive operating system directories or user shell profiles',
        pattern: '(?:/etc/|/boot/|/sys/|/proc/|C:\\\\Windows\\\\|~/(?:\\.bashrc|\\.zshrc|\\.profile|\\.bash_profile))',
        flags: 'i',
      },
    ],
  },
};

/**
 * Returns default config directory per OS.
 */
export function getDefaultConfigDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'antigravity-auto-accept');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'antigravity-auto-accept');
}

/**
 * Returns full path to config.json.
 */
export function getConfigPath(customPath = null) {
  if (customPath) return path.resolve(customPath);
  if (process.env.ANTIGRAVITY_AUTO_ACCEPT_CONFIG) {
    return path.resolve(process.env.ANTIGRAVITY_AUTO_ACCEPT_CONFIG);
  }
  return path.join(getDefaultConfigDir(), 'config.json');
}

/**
 * Deep merge utility for config objects.
 */
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

/**
 * Loads config, merging existing file with defaults.
 */
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

/**
 * Saves configuration to file.
 */
export function saveConfig(config, customPath = null) {
  const configPath = getConfigPath(customPath);
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return configPath;
}
