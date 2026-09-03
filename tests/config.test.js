import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  getConfigPath,
  getDefaultConfigDir,
} from '../src/config.js';

describe('Config Module', () => {
  it('should provide complete default configuration', () => {
    assert.strictEqual(DEFAULT_CONFIG.cdp.port, 9333);
    assert.strictEqual(DEFAULT_CONFIG.cdp.host, '127.0.0.1');
    assert.strictEqual(DEFAULT_CONFIG.safety.enabled, true);
    assert.strictEqual(DEFAULT_CONFIG.cooldown.elementCooldownMs, 5000);
    assert.ok(Array.isArray(DEFAULT_CONFIG.buttons.acceptLabels));
    assert.ok(DEFAULT_CONFIG.buttons.acceptLabels.includes('Accept'));
    assert.ok(DEFAULT_CONFIG.buttons.acceptLabels.includes('Run'));
  });

  it('should resolve OS-specific config directories', () => {
    const dir = getDefaultConfigDir();
    assert.ok(typeof dir === 'string' && dir.length > 0);
    assert.ok(dir.includes('antigravity-auto-accept'));
  });

  it('should save and load custom configuration cleanly', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-config-test-'));
    const tempConfigPath = path.join(tempDir, 'config.json');

    try {
      const customConfig = {
        cdp: { port: 9555 },
        cooldown: { elementCooldownMs: 3000 },
      };

      saveConfig(customConfig, tempConfigPath);
      assert.ok(fs.existsSync(tempConfigPath));

      const loaded = loadConfig(tempConfigPath);
      assert.strictEqual(loaded.cdp.port, 9555);
      assert.strictEqual(loaded.cdp.host, '127.0.0.1'); // Merged from defaults
      assert.strictEqual(loaded.cooldown.elementCooldownMs, 3000);
      assert.strictEqual(loaded.safety.enabled, true); // Merged from defaults
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
