import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { MockCDPServer } from './mock-cdp-server.js';
import { AntigravityAutoAcceptDaemon } from '../src/daemon.js';
import { sendIPCRequest } from '../src/ipc.js';

describe('Daemon & CDP Integration', () => {
  let mockServer;
  let daemon;
  let mockPort;

  before(async () => {
    mockServer = new MockCDPServer();
    mockPort = await mockServer.start();

    const config = {
      cdp: {
        host: '127.0.0.1',
        port: mockPort,
        pollIntervalMs: 200,
        autoDiscoverPort: false,
      },
      cooldown: {
        elementCooldownMs: 2000,
      },
      buttons: {
        acceptLabels: ['Accept', 'Run', 'Allow'],
        rejectLabels: ['Reject', 'Cancel'],
      },
      safety: {
        enabled: true,
        notifyOnBlock: false,
        blacklist: [
          {
            id: 'destructive-rm',
            pattern: '\\brm\\s+[^\n;|&]*(?:-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*[fF]|-[a-zA-Z0-9]*[fF][a-zA-Z0-9]*[rR])',
            flags: 'i',
          },
        ],
      },
    };

    daemon = new AntigravityAutoAcceptDaemon(config);
    await daemon.start({ poll: false });
  });

  after(async () => {
    if (daemon) await daemon.stop();
    if (mockServer) await mockServer.stop();
  });

  it('should auto-accept a safe multiline button (Run\\nnpm test)', async () => {
    mockServer.receivedClicks = [];
    mockServer.setMockCandidates([
      {
        index: 0,
        buttonText: 'Run\nnpm test --watch',
        commandText: 'npm test --watch',
        contextText: 'npm test --watch',
        rect: { x: 150, y: 300, width: 80, height: 32 },
        hasAcceptedTag: false,
      },
    ]);

    await daemon.cycle();

    assert.strictEqual(daemon.stats.acceptedCount, 1, 'Safe multiline prompt should be accepted');
    assert.ok(mockServer.receivedClicks.length >= 1, 'Mock server should receive click dispatch');
  });

  it('should respect per-element cooldown and not double-click', async () => {
    const clicksBefore = mockServer.receivedClicks.length;

    // Run cycle again immediately with same prompt
    await daemon.cycle();

    assert.strictEqual(
      mockServer.receivedClicks.length,
      clicksBefore,
      'Click count should not change due to cooldown'
    );
    assert.strictEqual(daemon.stats.acceptedCount, 1);
  });

  it('should block a dangerous prompt with safety guardrail (Run\\nrm -rf /)', async () => {
    mockServer.setMockCandidates([
      {
        index: 1,
        buttonText: 'Run\nrm -rf /',
        commandText: 'rm -rf /',
        contextText: 'rm -rf /',
        rect: { x: 200, y: 400, width: 80, height: 32 },
        hasAcceptedTag: false,
      },
    ]);

    const clicksBefore = mockServer.receivedClicks.length;
    await daemon.cycle();

    assert.strictEqual(daemon.stats.blockedCount, 1, 'Dangerous prompt must be blocked');
    assert.strictEqual(
      mockServer.receivedClicks.length,
      clicksBefore,
      'No click must be dispatched for dangerous command'
    );
  });

  it('should handle pause and resume states', async () => {
    mockServer.receivedClicks = [];
    mockServer.setMockCandidates([
      {
        index: 2,
        buttonText: 'Accept',
        commandText: 'cat config.json',
        contextText: 'cat config.json',
        rect: { x: 100, y: 100, width: 60, height: 25 },
        hasAcceptedTag: false,
      },
    ]);

    // Pause daemon
    daemon.paused = true;
    await daemon.cycle();
    assert.strictEqual(mockServer.receivedClicks.length, 0, 'Should not click when paused');

    // Resume daemon
    daemon.paused = false;
    await daemon.cycle();
    assert.ok(mockServer.receivedClicks.length >= 1, 'Should click when resumed');
  });

  it('should respond to IPC commands', async () => {
    assert.ok(daemon.ipcPort > 0, 'IPC server must be listening');

    // Test /status
    const statusRes = await sendIPCRequest(daemon.ipcPort, 'GET', '/status');
    assert.strictEqual(statusRes.statusCode, 200);
    assert.strictEqual(statusRes.body.running, true);
    assert.strictEqual(statusRes.body.cdpConnected, true);

    // Test /toggle
    const toggleRes = await sendIPCRequest(daemon.ipcPort, 'POST', '/toggle');
    assert.strictEqual(toggleRes.statusCode, 200);
    assert.strictEqual(toggleRes.body.paused, true);
    assert.strictEqual(daemon.paused, true);

    // Toggle back
    const toggleBack = await sendIPCRequest(daemon.ipcPort, 'POST', '/toggle');
    assert.strictEqual(toggleBack.body.paused, false);
    assert.strictEqual(daemon.paused, false);
  });
});
