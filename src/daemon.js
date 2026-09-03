import { CDPClient } from './cdp.js';
import { SafetyEngine } from './safety.js';
import { sendNotification } from './notifier.js';
import { createIPCServer, writeDaemonState, clearDaemonState } from './ipc.js';
import {
  createCandidateHash,
  getInPageDetectorScript,
  getInPageClickScript,
} from './detector.js';

export class AntigravityAutoAcceptDaemon {
  constructor(config = {}) {
    this.config = config;
    this.safety = new SafetyEngine(config.safety);
    this.cdp = new CDPClient(config.cdp);
    this.paused = false;
    this.running = false;
    this.cycling = false;
    this.pollTimer = null;
    this.cooldownCache = new Map(); // hash -> timestamp
    this.ipcServer = null;
    this.ipcPort = 0;
    this.stats = {
      startedAt: Date.now(),
      acceptedCount: 0,
      blockedCount: 0,
      lastAction: null,
    };
  }

  /**
   * Cleans old cooldown entries exceeding elementCooldownMs
   */
  pruneCooldownCache() {
    const now = Date.now();
    const cooldownMs = this.config.cooldown?.elementCooldownMs || 5000;
    for (const [hash, ts] of this.cooldownCache.entries()) {
      if (now - ts > cooldownMs * 2) {
        this.cooldownCache.delete(hash);
      }
    }
  }

  /**
   * Executes a single inspection and auto-accept cycle
   */
  async cycle() {
    if (!this.running || this.paused) return;
    if (this.cycling) return;
    this.cycling = true;

    try {
      this.pruneCooldownCache();

      // 1. Ensure CDP is connected to an active target
      let targets = [];
      try {
        targets = await this.cdp.fetchTargets();
      } catch (err) {
        return;
      }

      const candidateTargets = this.cdp.findCandidateTargets(targets);
      if (candidateTargets.length === 0) {
        return;
      }

      // If not connected or current target is no longer in targets list, connect
      if (!this.cdp.connected || !targets.some((t) => t.id === this.cdp.currentTarget?.id)) {
        try {
          await this.cdp.connectToTarget(candidateTargets[0]);
          console.log(`[cdp] Connected to target: "${candidateTargets[0].title}" (${candidateTargets[0].url})`);
        } catch (err) {
          return;
        }
      }

      // 2. Query DOM for prompt action buttons
      const acceptLabels = this.config.buttons?.acceptLabels || [];
      const rejectLabels = this.config.buttons?.rejectLabels || [];
      const detectorScript = getInPageDetectorScript(acceptLabels, rejectLabels);

      let result;
      try {
        result = await this.cdp.evaluate(detectorScript);
      } catch (err) {
        this.cdp.disconnect();
        return;
      }

      // If no candidates on current target and multiple targets exist, try next candidate target
      if ((!result || !result.candidates || result.candidates.length === 0) && candidateTargets.length > 1) {
        const nextTarget = candidateTargets.find((t) => t.id !== this.cdp.currentTarget?.id);
        if (nextTarget) {
          try {
            await this.cdp.connectToTarget(nextTarget);
            result = await this.cdp.evaluate(detectorScript);
          } catch (e) {}
        }
      }

      if (!result || !Array.isArray(result.candidates) || result.candidates.length === 0) {
        return;
      }

      const now = Date.now();
      const cooldownMs = this.config.cooldown?.elementCooldownMs || 5000;

      for (const candidate of result.candidates) {
        const hash = createCandidateHash(candidate.buttonText, candidate.contextText);

        // Check in-memory and DOM cooldowns
        if (this.cooldownCache.has(hash)) {
          const lastClicked = this.cooldownCache.get(hash);
          if (now - lastClicked < cooldownMs) {
            continue; // In cooldown, skip
          }
        }

        if (candidate.hasAcceptedTag && now - candidate.acceptedAt < cooldownMs) {
          continue;
        }

        // Check Safety Engine across surrounding context, button command payload, and button text
        const textToEvaluate = [
          candidate.contextText,
          candidate.commandText,
          candidate.buttonText,
        ].filter(Boolean).join('\n');

        const safetyResult = this.safety.evaluate(textToEvaluate);

        if (!safetyResult.safe) {
          // Unsafe / destructive command detected!
          this.cooldownCache.set(hash, now); // Cooldown to prevent notification spam
          this.stats.blockedCount++;
          this.stats.lastAction = {
            type: 'blocked',
            time: new Date().toISOString(),
            button: candidate.buttonText,
            reason: safetyResult.reason,
            snippet: safetyResult.matchSnippet,
          };

          console.warn(`\n[SAFETY ALERT] ⚠️  Blocked potentially dangerous action!`);
          console.warn(`Reason: ${safetyResult.reason}`);
          console.warn(`Context Snippet: "${safetyResult.matchSnippet}"`);
          console.warn(`Action "${candidate.buttonText.split('\n')[0]}" requires manual user review.`);

          if (this.config.safety?.notifyOnBlock) {
            sendNotification({
              title: 'Antigravity Safety Guard',
              message: `Blocked: ${safetyResult.reason}\nManual review required.`,
              urgency: 'critical',
            });
          }
          continue;
        }

        // Safe to auto-accept!
        try {
          // 1. In-page pointer and mouse events
          const clickScript = getInPageClickScript(candidate.index, now);
          await this.cdp.evaluate(clickScript);

          // 2. Hardware native click via Chromium compositor
          if (candidate.rect && candidate.rect.x > 0 && candidate.rect.y > 0) {
            await this.cdp.dispatchClick(candidate.rect.x, candidate.rect.y);
          }

          this.cooldownCache.set(hash, now);
          this.stats.acceptedCount++;

          const preview = (candidate.commandText || candidate.contextText || 'No context')
            .slice(0, 80)
            .replace(/\n/g, ' ');

          this.stats.lastAction = {
            type: 'accepted',
            time: new Date().toISOString(),
            button: candidate.buttonText.split('\n')[0],
            preview,
          };

          console.log(`[AUTO-ACCEPT] ✅ Accepted: "${candidate.buttonText.split('\n')[0]}" | Command: ${preview}`);
        } catch (err) {
          console.error(`[click] Error dispatching click: ${err.message}`);
        }
      }
    } finally {
      this.cycling = false;
    }
  }

  /**
   * Starts daemon loop and IPC control server
   */
  async start({ port = 0, interactive = false, poll = true } = {}) {
    if (this.running) return;
    this.running = true;

    // Start IPC Server
    this.ipcServer = createIPCServer({
      onStatus: async () => ({
        running: this.running,
        paused: this.paused,
        pid: process.pid,
        stats: this.stats,
        cdpConnected: this.cdp.connected,
        currentTarget: this.cdp.currentTarget
          ? { title: this.cdp.currentTarget.title, url: this.cdp.currentTarget.url }
          : null,
      }),
      onToggle: async () => {
        this.paused = !this.paused;
        console.log(`[ipc] Auto-accept ${this.paused ? 'PAUSED ⏸️' : 'RESUMED ▶️'}`);
        return { paused: this.paused };
      },
      onPause: async () => {
        this.paused = true;
        return { paused: true };
      },
      onResume: async () => {
        this.paused = false;
        return { paused: false };
      },
      onStop: async () => {
        console.log('[ipc] Stop command received. Shutting down...');
        await this.stop();
        process.exit(0);
      },
    });

    await new Promise((resolve) => {
      this.ipcServer.listen(port || 0, '127.0.0.1', () => {
        this.ipcPort = this.ipcServer.address().port;
        writeDaemonState({
          pid: process.pid,
          ipcPort: this.ipcPort,
          startedAt: Date.now(),
          config: {
            cdpHost: this.config.cdp?.host,
            cdpPort: this.config.cdp?.port,
          },
        });
        resolve();
      });
    });

    const pollInterval = this.config.cdp?.pollIntervalMs || 500;

    if (poll) {
      const runLoop = async () => {
        if (!this.running) return;
        try {
          await this.cycle();
        } catch (e) {
          // Handled inside cycle
        }
        if (this.running) {
          this.pollTimer = setTimeout(runLoop, pollInterval);
        }
      };

      runLoop();
    }

    if (interactive && process.stdin.isTTY) {
      this.setupInteractiveKeys();
    }
  }

  /**
   * Sets up terminal key listener for instant toggle in interactive foreground mode
   */
  setupInteractiveKeys() {
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', async (key) => {
        if (key === '\u0003' || key === 'q') {
          console.log('\nExiting antigravity-auto-accept...');
          await this.stop();
          process.exit(0);
        } else if (key === 't' || key === 'p' || key === ' ') {
          this.paused = !this.paused;
          console.log(`\n[KEYPRESS] Auto-accept ${this.paused ? 'PAUSED ⏸️' : 'RESUMED ▶️'}`);
        }
      });

      console.log('\n[Interactive Controls] Press "t", "p", or Space to toggle Pause/Resume | "q" or Ctrl+C to quit\n');
    } catch (e) {}
  }

  /**
   * Graceful stop
   */
  async stop() {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.cdp) {
      this.cdp.disconnect();
    }
    if (this.ipcServer) {
      await new Promise((resolve) => this.ipcServer.close(resolve));
      this.ipcServer = null;
    }
    clearDaemonState();
  }
}
