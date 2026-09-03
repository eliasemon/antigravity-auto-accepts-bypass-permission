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
    workspacePath: process.cwd(),
    blacklist: [
      {
        id: 'destructive-rm',
        description: 'Recursive or forced file deletion (rm -rf, rm -r -f, rm -fr, rmdir /s, del /f /s)',
        pattern: '\\b(?:rm\\s+[^\n;|&]*(?:-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*[fF]|-[a-zA-Z0-9]*[fF][a-zA-Z0-9]*[rR]|(?:--recursive\\s+[^\n;|&]*--force|--force\\s+[^\n;|&]*--recursive)|(?:-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)\\s+[^\n;|&]*-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*))|(?:-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*)\\s+[^\n;|&]*-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)))|rmdir\\s+.*[\\/\\\\][sq]|del\\s+.*[\\/\\\\][fqs]|Remove-Item\\s+.*(?:-Recurse\\s+.*-Force|-Force\\s+.*-Recurse))\\b',
        flags: 'i',
      },
      {
        id: 'privilege-escalation',
        description: 'Superuser / privilege escalation commands (sudo, doas, runas, pkexec, su -)',
        pattern: '\\b(?:sudo|doas|runas|pkexec)\\b|(?:^|[;&|]\\s*)su(?:\\s+-[a-zA-Z0-9]*|\\s+[a-zA-Z0-9_]+)?\\b|Set-ExecutionPolicy\\s+(?:Unrestricted|Bypass)',
        flags: 'i',
      },
      {
        id: 'pipe-to-shell',
        description: 'Downloading and piping untrusted code directly to a shell (curl | sh, curl | bash, wget)',
        pattern: '\\b(?:curl|wget|fetch|invoke-webrequest|iwr)\\b[^\n|;&]*\\|[^\n|;&]*(?:sudo\\s+)?(?:/(?:usr/)?(?:bin|local/bin)/)?(?:ba|z)?sh\\b|\\b(?:curl|wget|fetch|invoke-webrequest|iwr)\\b[^\n|;&]*\\|[^\n|;&]*(?:sudo\\s+)?(?:python[23]?|perl|pwsh|powershell)\\b',
        flags: 'i',
      },
      {
        id: 'git-force-push-reset',
        description: 'Destructive git operations (git push --force, git push -f, reset --hard, clean -f)',
        pattern: '\\bgit\\s+(?:push\\s+[^\n;&]*(?:--force(?:-with-lease|-if-includes)?\\b|-[a-zA-Z0-9]*f[a-zA-Z0-9]*\\b|\\+[a-zA-Z0-9_/.-]+)|reset\\s+--hard|clean\\s+-[a-zA-Z0-9]*f|branch\\s+-[dD]\\b)',
        flags: 'i',
      },
      {
        id: 'sql-drop-truncate',
        description: 'Destructive SQL database/table manipulation (DROP TABLE, TRUNCATE TABLE, DROP DATABASE)',
        pattern: '\\b(?:DROP\\s+(?:DATABASE|SCHEMA|TABLE|VIEW|PROCEDURE)|TRUNCATE\\s+(?:TABLE\\s+)?)\\b',
        flags: 'i',
      },
      {
        id: 'sensitive-credentials-and-keys',
        description: 'Access or modification of sensitive environment files, SSH keys, or cloud credentials',
        pattern: '(?:\\.env(?!\\.(?:example|sample|template|dist)\\b)(?:\\.[a-zA-Z0-9_-]+)?\\b|\\bid_rsa\\b|\\bid_ed25519\\b|\\bid_ecdsa\\b|\\bid_dsa\\b|\\bauthorized_keys\\b|\\.pem\\b|\\.pfx\\b|\\.pkcs12\\b|aws_access_key_id|AWS_SECRET_ACCESS_KEY|credentials\\.json|service[_-]account.*\\.json|\\b(?:private|server|client|id_rsa)[._-]key\\b|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)',
        flags: 'i',
      },
      {
        id: 'disk-and-firmware-destruction',
        description: 'Direct raw disk manipulation, format, or fork bombs',
        pattern: '(?:\\bdd\\s+if=|\\bmkfs(?:\\.\\w+)?\\b|(?:^|[;&|]\\s*)format\\s+[a-z]:|>\\s*/dev/sd[a-z]|>\\s*/dev/nvme|:\\(\\)\\s*\\{\\s*:\\|:&\\s*\\};:)',
        flags: 'i',
      },
      {
        id: 'system-root-alteration',
        description: 'Modifying sensitive operating system directories or user shell profiles',
        pattern: '(?:(?:^|[\\s"\'`>=])/(?:etc|boot|sys|proc|root|System)/|[a-zA-Z]:\\\\Windows\\\\|~/(?:\\.bashrc|\\.zshrc|\\.profile|\\.bash_profile))',
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
