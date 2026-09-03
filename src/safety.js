/**
 * Safety Guardrail Engine
 * Strictly leaves for manual review if the command contains:
 * sudo, rm, -rf, drop.
 * All other terminal commands and prompts are auto-accepted.
 */
export class SafetyEngine {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.blacklist = [
      {
        id: 'sudo',
        description: 'Superuser command (sudo)',
        regex: /\bsudo\b/i,
      },
      {
        id: 'rm',
        description: 'File deletion command (rm, rmdir, del, Remove-Item)',
        regex: /\b(?:rm|rmdir|del|Remove-Item)\b/i,
      },
      {
        id: 'rf-flag',
        description: 'Recursive force flag (-rf, -fr)',
        regex: /(?:-[a-zA-Z0-9]*r[a-zA-Z0-9]*f\b|-[a-zA-Z0-9]*f[a-zA-Z0-9]*r\b|-rf|-fr)/i,
      },
      {
        id: 'drop',
        description: 'Database drop command (DROP TABLE, drop)',
        regex: /\bdrop\b/i,
      },
    ];

    // If custom blacklist is provided, use it
    if (Array.isArray(config.blacklist) && config.blacklist.length > 0) {
      this.blacklist = config.blacklist.map((rule) => {
        try {
          return {
            id: rule.id,
            description: rule.description,
            regex: new RegExp(rule.pattern, rule.flags || 'i'),
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    }
  }

  evaluate(contextText) {
    if (!this.enabled) {
      return { safe: true, reason: 'Safety engine disabled' };
    }

    if (!contextText || typeof contextText !== 'string' || !contextText.trim()) {
      return { safe: true };
    }

    const normalized = contextText.replace(/\r\n/g, '\n').trim();

    for (const rule of this.blacklist) {
      const match = normalized.match(rule.regex);
      if (match) {
        return {
          safe: false,
          ruleId: rule.id,
          reason: `Requires manual review [${rule.id}]: ${rule.description}`,
          matchSnippet: match[0],
        };
      }
    }

    return { safe: true };
  }
}
