/**
 * Safety Guardrail Engine
 * Analyzes command lines, prompt details, diff text, and target paths to detect
 * destructive or risky operations before auto-accepting.
 */

export class SafetyEngine {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
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
      // Empty or trivial context without destructive markers is considered safe
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

    // Additional path escaping check: check for traversal or absolute root access in commands
    const outOfWorkspaceCheck = this.checkPathEscapes(normalized);
    if (!outOfWorkspaceCheck.safe) {
      return outOfWorkspaceCheck;
    }

    return { safe: true };
  }

  /**
   * Additional check for dangerous absolute paths or directory traversal outside workspace
   */
  checkPathEscapes(text) {
    // Check for dangerous linux/unix root paths
    const dangerousRootPaths = [
      /\/etc\/(?!resolv\.conf)/i,
      /\/var\/(?:log|run|spool|mail)/i,
      /\/usr\/(?:bin|sbin|lib)/i,
      /\/boot\//i,
      /\/dev\/(?:sd|nvme|zero|null|urandom|mem)/i,
      /C:\\Windows\\(?:System32|SysWOW64)/i,
      /C:\\Program Files(?: \(x86\))?/i,
      /~(?:\/|\\)\.(?:ssh|gnupg|aws|gcp|config(?:\/|\\)gcloud)/i,
    ];

    for (const rootPath of dangerousRootPaths) {
      if (rootPath.test(text)) {
        return {
          safe: false,
          ruleId: 'system-sensitive-path',
          reason: 'Access or modification of sensitive operating system / credential path detected',
          matchSnippet: text.match(rootPath)?.[0] || 'sensitive path',
        };
      }
    }

    return { safe: true };
  }
}
