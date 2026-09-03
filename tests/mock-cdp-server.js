import http from 'http';
import { WebSocketServer } from 'ws';

export class MockCDPServer {
  constructor(port = 0) {
    this.port = port;
    this.httpServer = null;
    this.wss = null;
    this.activeSockets = new Set();
    this.mockCandidates = [];
    this.receivedClicks = [];
    this.receivedCommands = [];
  }

  setMockCandidates(candidates) {
    this.mockCandidates = candidates;
  }

  async start() {
    return new Promise((resolve) => {
      this.httpServer = http.createServer((req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${this.port}`);

        if (url.pathname === '/json/list' || url.pathname === '/json') {
          res.setHeader('Content-Type', 'application/json');
          const target = {
            id: 'mock-agent-target-id',
            title: 'Antigravity Agent Panel',
            type: 'webview',
            url: 'vscode-webview://antigravity-panel',
            webSocketDebuggerUrl: `ws://127.0.0.1:${this.port}/devtools/page/mock-agent-target-id`,
          };
          return res.end(JSON.stringify([target]));
        }

        res.writeHead(404);
        res.end();
      });

      this.wss = new WebSocketServer({ noServer: true });

      this.httpServer.on('upgrade', (request, socket, head) => {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      });

      this.wss.on('connection', (ws) => {
        this.activeSockets.add(ws);

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            this.receivedCommands.push(msg);

            if (msg.method === 'Runtime.enable') {
              ws.send(JSON.stringify({ id: msg.id, result: {} }));
            } else if (msg.method === 'Runtime.evaluate') {
              const expr = msg.params?.expression || '';

              if (expr.includes('collectButtons') && expr.includes('candidates')) {
                // Return configured mock candidates
                ws.send(
                  JSON.stringify({
                    id: msg.id,
                    result: {
                      result: {
                        type: 'object',
                        value: { candidates: this.mockCandidates },
                      },
                    },
                  })
                );
              } else if (expr.includes('data-antigravity-auto-accepted')) {
                // Click script
                this.receivedClicks.push({ type: 'in-page-script', expression: expr });
                ws.send(
                  JSON.stringify({
                    id: msg.id,
                    result: {
                      result: {
                        type: 'object',
                        value: { success: true },
                      },
                    },
                  })
                );
              } else {
                ws.send(
                  JSON.stringify({
                    id: msg.id,
                    result: {
                      result: {
                        type: 'boolean',
                        value: true,
                      },
                    },
                  })
                );
              }
            } else if (msg.method === 'Input.dispatchMouseEvent') {
              this.receivedClicks.push({ type: 'cdp-mouse', params: msg.params });
              ws.send(JSON.stringify({ id: msg.id, result: {} }));
            } else {
              ws.send(JSON.stringify({ id: msg.id, result: {} }));
            }
          } catch (e) {}
        });

        ws.on('close', () => {
          this.activeSockets.delete(ws);
        });
      });

      this.httpServer.listen(this.port, '127.0.0.1', () => {
        this.port = this.httpServer.address().port;
        resolve(this.port);
      });
    });
  }

  async stop() {
    for (const ws of this.activeSockets) {
      try {
        ws.close();
      } catch (e) {}
    }
    this.activeSockets.clear();

    if (this.wss) {
      await new Promise((res) => this.wss.close(res));
    }
    if (this.httpServer) {
      await new Promise((res) => this.httpServer.close(res));
    }
  }
}
