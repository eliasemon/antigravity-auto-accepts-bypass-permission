import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UpdateWatcher, installPersistenceService } from '../src/watcher.js';

describe('Update Watcher & Persistence Module', () => {
  it('should instantiate UpdateWatcher with default configuration', () => {
    const watcher = new UpdateWatcher({ checkIntervalMs: 1000 });
    assert.ok(watcher);
    assert.strictEqual(watcher.checkIntervalMs, 1000);
    assert.strictEqual(watcher.timer, null);
    assert.strictEqual(watcher.isPatching, false);
  });

  it('should start and stop timer cleanly', () => {
    const watcher = new UpdateWatcher({ checkIntervalMs: 100000 });
    watcher.start();
    assert.ok(watcher.timer !== null);
    watcher.stop();
    assert.strictEqual(watcher.timer, null);
  });

  it('should install persistence service for current operating system', () => {
    const res = installPersistenceService();
    assert.strictEqual(res.success, true);
    assert.ok(fs.existsSync(res.path));
  });
});
