import path from 'path';
import os from 'os';

/**
 * Safety Guardrail Engine
 * Analyzes command lines, prompt details, diff text, and target paths to detect
 * destructive or risky operations before auto-accepting.
 */
export class SafetyEngine {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.workspacePath = config.workspacePath
      ? path.resolve(config.workspacePath)
      : process.cwd();
    this.blacklist = [];
    this.initRules(config.blacklist || []);
  }

  initRules(rules) {
    this.blacklist = rules.map((rule) => {
      try {
        const regex = new RegExp(rule.pattern, rule.flags || 'i');
        return {
          id: rule.id,
          description: rule.description,
          regex,
          rawPattern: rule.pattern,
        };
      } catch (err) {
        console.error(`[safety] Invalid regex in rule ${rule.id}: ${err.message}`);
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Evaluates text context (command line, diff, file path, prompt description).
   * @param {string} contextText - Raw text found inside or adjacent to the prompt
   * @returns {{ safe: boolean, reason?: string, ruleId?: string, matchSnippet?: string }}
   */
  evaluate(contextText) {
    if (!this.enabled) {
      return { safe: true, reason: 'Safety engine disabled by configuration' };
    }

    if (!contextText || typeof contextText !== 'string' || !contextText.trim()) {
      return { safe: true };
    }

    const normalized = contextText.replace(/\r\n/g, '\n').trim();

    for (const rule of this.blacklist) {
      const match = normalized.match(rule.regex);
      if (match) {
        const matchSnippet = match[0].length > 100 ? `${match[0].slice(0, 97)}...` : match[0];
        return {
          safe: false,
          ruleId: rule.id,
          reason: `Blocked by safety rule [${rule.id}]: ${rule.description}`,
          matchSnippet,
        };
      }
    }

    // Additional path escaping check: checks workspace boundaries, directory traversal, and sensitive root access
    const outOfWorkspaceCheck = this.checkPathEscapes(normalized);
    if (!outOfWorkspaceCheck.safe) {
      return outOfWorkspaceCheck;
    }

    return { safe: true };
  }

  /**
   * Comprehensive check for out-of-workspace modifications and dangerous OS paths
   */
  checkPathEscapes(text) {
    // 1. Sensitive system paths (strictly excluding safe devices like /dev/null, /dev/zero, /dev/stdout)
    const dangerousRootPaths = [
      /(?:^|[\s"'>=])\/etc\/(?!resolv\.conf)/i,
      /(?:^|[\s"'>=])\/var\/(?:log|run|spool|mail|root)/i,
      /(?:^|[\s"'>=])\/boot\//i,
      /(?:^|[\s"'>=])\/(?:sys|proc|root|System)\//i,
      /(?:^|[\s"'>=])\/dev\/(?:sd[a-z]|nvme\d|mem|kmem|port)/i,
      /[a-zA-Z]:\\Windows\\(?:System32|SysWOW64)/i,
      /[a-zA-Z]:\\Program Files(?: \(x86\))?/i,
      /~(?:\/|\\)\.(?:ssh|gnupg|aws|gcp|config(?:\/|\\)gcloud|bashrc|zshrc|profile|bash_profile)/i,
    ];

    for (const rootPath of dangerousRootPaths) {
      const match = text.match(rootPath);
      if (match) {
        return {
          safe: false,
          ruleId: 'system-sensitive-path',
          reason: 'Access or modification of sensitive operating system / credential path detected',
          matchSnippet: match[0].trim(),
        };
      }
    }

    // 2. Directory traversal escaping workspace root (e.g. ../../outside)
    if (/(?:\.\.[/\\])+/.test(text)) {
      const traversalMatches = text.match(/(?:[a-zA-Z0-9_.-]+[/\\])?(?:\.\.[/\\])+[a-zA-Z0-9_.-/\\]*/g) || [];
      for (const token of traversalMatches) {
        try {
          const resolved = path.resolve(this.workspacePath, token);
          const relative = path.relative(this.workspacePath, resolved);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return {
              safe: false,
              ruleId: 'out-of-workspace-traversal',
              reason: `Directory traversal escapes workspace root: ${token}`,
              matchSnippet: token,
            };
          }
        } catch (e) {}
      }
    }

    // 3. Operations writing or modifying absolute paths outside workspace
    // Must be preceded by command / redirection and whitespace, targeting an absolute path starting with / or ~
    const outOfWorkspaceWrite = /(?:>{1,2}\s*|(?:\b(?:rm|cp|mv|touch|mkdir|chmod|chown|tee|truncate|ln)\s+.*?\s+))([/~][a-zA-Z0-9_.-]+[a-zA-Z0-9_./\\]*|[a-zA-Z]:\\[a-zA-Z0-9_./\\]+)/g;
    let match;
    while ((match = outOfWorkspaceWrite.exec(text)) !== null) {
      const targetPath = match[1];
      if (!targetPath) continue;

      // Whitelist safe standard devices and system shells
      if (
        /^\/dev\/(?:null|stdout|stderr|stdin|zero)$/i.test(targetPath) ||
        /^\/(?:usr\/)?bin\/(?:env|sh|bash|node|python[23]?)$/i.test(targetPath)
      ) {
        continue;
      }

      try {
        const expandedPath = targetPath.startsWith('~')
          ? path.join(os.homedir(), targetPath.slice(1))
          : path.resolve(targetPath);
        const relative = path.relative(this.workspacePath, expandedPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          return {
            safe: false,
            ruleId: 'out-of-workspace-modification',
            reason: `Operation targets path outside workspace: ${targetPath}`,
            matchSnippet: match[0].trim(),
          };
        }
      } catch (e) {}
    }

    return { safe: true };
  }
}
