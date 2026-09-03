import http from 'http';
import EventEmitter from 'events';
import WebSocket from 'ws';
import { ProcessDetector } from './process-detector.js';

/**
 * CDP Client for communicating with Chrome DevTools Protocol exposed by Antigravity
 */
export class CDPClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9333;
    this.autoDiscoverPort = options.autoDiscoverPort !== false;
    this.ws = null;
    this.messageId = 1;
    this.pendingCallbacks = new Map();
    this.currentTarget = null;
    this.connected = false;
    this.connectingPromise = null;
  }

  /**
   * Fetches target list from /json/list or /json.
   * Auto-falls back to discovered DevToolsActivePort if default port is unreachable.
   */
  async fetchTargets() {
    const portsToTry = [this.port];

    if (this.autoDiscoverPort) {
      const activeInfo = ProcessDetector.findActiveDevToolsPort();
      if (activeInfo && activeInfo.port && !portsToTry.includes(activeInfo.port)) {
        portsToTry.push(activeInfo.port);
      }
    }

    const endpoints = ['/json/list', '/json'];

    for (const port of portsToTry) {
      for (const endpoint of endpoints) {
        try {
          const data = await this.httpGet(this.host, port, endpoint);
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            if (this.port !== port) {
              console.log(`[cdp] Discovered active Antigravity debugging port: ${port}`);
              this.port = port;
            }
            return parsed;
          }
        } catch (err) {
          // Try next endpoint or port
        }
      }
    }

    throw new Error(
      `Unable to connect to Antigravity CDP at http://${this.host}:${this.port}. Is Antigravity running with --remote-debugging-port=${this.port}?`
    );
  }

  httpGet(host, port, path) {
    return new Promise((resolve, reject) => {
      const req = http.get(
        {
          host,
          port,
          path,
          timeout: 2000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(body);
            } else {
              reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('CDP request timed out'));
      });
    });
  }

  /**
   * Identifies candidate targets for Antigravity's agent panel.
   * Prioritizes webviews, panels with 'Antigravity' or 'Agent' in title/url, or active pages.
   */
  findCandidateTargets(targets) {
    if (!Array.isArray(targets) || targets.length === 0) return [];

    // Filter out internal background workers/service workers that aren't visible UI
    const uiTargets = targets.filter((t) => {
      const type = (t.type || '').toLowerCase();
      return type === 'webview' || type === 'page' || type === 'other' || type === 'iframe';
    });

    // Score targets to prioritize agent panel / webviews
    const scored = uiTargets.map((t) => {
      let score = 0;
      const title = (t.title || '').toLowerCase();
      const url = (t.url || '').toLowerCase();
      const type = (t.type || '').toLowerCase();

      if (type === 'webview') score += 50;
      if (url.includes('vscode-webview')) score += 40;
      if (title.includes('agent') || url.includes('agent')) score += 35;
      if (title.includes('antigravity') || url.includes('antigravity')) score += 30;
      if (url.includes('/c/')) score += 25;
      if (type === 'page') score += 10;

      return { target: t, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.target);
  }

  /**
   * Connects WebSocket to a specific target's webSocketDebuggerUrl
   */
  async connectToTarget(target) {
    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error('Invalid target or missing webSocketDebuggerUrl');
    }

    if (this.connected && this.currentTarget?.id === target.id) {
      return target;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.disconnect();

    this.connectingPromise = new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        this.ws = ws;
        this.currentTarget = target;

        const timer = setTimeout(() => {
          this.connectingPromise = null;
          reject(new Error(`WebSocket connection timeout to ${target.webSocketDebuggerUrl}`));
          try {
            ws.terminate();
          } catch (e) {}
        }, 5000);

        ws.on('open', async () => {
          clearTimeout(timer);
          this.connected = true;
          this.connectingPromise = null;
          this.emit('connected', target);

          // Enable Runtime domain
          try {
            await this.send('Runtime.enable');
            resolve(target);
          } catch (err) {
            reject(err);
          }
        });

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id && this.pendingCallbacks.has(msg.id)) {
              const { resolve: res, reject: rej } = this.pendingCallbacks.get(msg.id);
              this.pendingCallbacks.delete(msg.id);
              if (msg.error) {
                rej(new Error(msg.error.message || 'CDP call failed'));
              } else {
                res(msg.result);
              }
            } else if (msg.method) {
              this.emit('event', msg);
            }
          } catch (err) {
            // Non-JSON message or parse error
          }
        });

        ws.on('close', () => {
          this.connected = false;
          this.connectingPromise = null;
          this.emit('disconnected');
          this.cleanupPending();
        });

        ws.on('error', (err) => {
          clearTimeout(timer);
          this.connectingPromise = null;
          this.emit('error', err);
          this.cleanupPending();
        });
      } catch (err) {
        this.connectingPromise = null;
        reject(err);
      }
    });

    return this.connectingPromise;
  }

  /**
   * Sends a CDP method call and awaits response.
   */
  send(method, params = {}) {
    if (!this.connected || !this.ws) {
      return Promise.reject(new Error('CDP WebSocket is not connected'));
    }

    const id = this.messageId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(payload, (err) => {
        if (err) {
          this.pendingCallbacks.delete(id);
          reject(err);
        }
      });
    });
  }

  /**
   * Evaluates JavaScript expression in the connected target context.
   */
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (res && res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Runtime.evaluate exception');
    }

    if (res && res.result && 'value' in res.result) {
      return res.result.value;
    }
    return res ? res.value : undefined;
  }

  /**
   * Dispatches synthetic native mouse click at coordinates (x, y) via Chromium compositor.
   */
  async dispatchClick(x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);

    // 1. Move to trigger hover state
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: rx,
      y: ry,
    });

    // 2. Mouse press
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: rx,
      y: ry,
      button: 'left',
      clickCount: 1,
    });

    // 3. Realistic hardware delay (40ms)
    await new Promise((resolve) => setTimeout(resolve, 40));

    // 4. Mouse release
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: rx,
      y: ry,
      button: 'left',
      clickCount: 1,
    });
  }

  cleanupPending() {
    for (const [, { reject }] of this.pendingCallbacks) {
      reject(new Error('CDP session closed'));
    }
    this.pendingCallbacks.clear();
  }

  disconnect() {
    this.connected = false;
    this.connectingPromise = null;
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        } else {
          this.ws.terminate();
        }
      } catch (e) {}
      this.ws = null;
    }
    this.cleanupPending();
    this.currentTarget = null;
  }
}
