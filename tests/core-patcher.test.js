import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getAntigravityAppPaths, updateProductChecksums, installIdeExtension } from '../src/core-patcher.js';

describe('Core Patcher Module', () => {
  it('should discover application paths on current OS', () => {
    const paths = getAntigravityAppPaths();
    assert.ok(typeof paths === 'object');
    assert.ok('desktopAppAsar' in paths);
    assert.ok('ideAgentJs' in paths);
    assert.ok('ideWorkbenchJs' in paths);
    assert.ok('ideProductJson' in paths);

    if (process.platform === 'darwin') {
      assert.ok(paths.desktopAppAsar, 'Desktop app.asar should be discovered on macOS');
      assert.ok(paths.ideAgentJs, 'IDE jetskiAgent.js should be discovered on macOS');
      assert.ok(paths.ideWorkbenchJs, 'IDE workbench.js should be discovered on macOS');
      assert.ok(paths.ideProductJson, 'IDE product.json should be discovered on macOS');
    }
  });

  it('should recalculate and update product.json checksums for modified files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-test-prod-'));
    try {
      const outDir = path.join(tmpDir, 'out');
      fs.mkdirSync(outDir, { recursive: true });

      const testFileRel = 'test/file.js';
      const testFileFull = path.join(outDir, testFileRel);
      fs.mkdirSync(path.dirname(testFileFull), { recursive: true });
      fs.writeFileSync(testFileFull, 'console.log("patched code");', 'utf8');

      const expectedChecksum = crypto.createHash('sha256').update(fs.readFileSync(testFileFull)).digest('base64').replace(/=+$/, '');

      const prodPath = path.join(tmpDir, 'product.json');
      fs.writeFileSync(prodPath, JSON.stringify({
        checksums: {
          [testFileRel]: 'OLD_OUTDATED_CHECKSUM'
        }
      }, null, 2), 'utf8');

      const success = updateProductChecksums(prodPath);
      assert.strictEqual(success, true);

      const updated = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
      assert.strictEqual(updated.checksums[testFileRel], expectedChecksum);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should install native IDE extension into extensions directory', () => {
    const res = installIdeExtension();
    assert.strictEqual(res, true);

    const extDir = path.join(os.homedir(), '.antigravity-ide', 'extensions', 'antigravity-auto-accept');
    assert.ok(fs.existsSync(path.join(extDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(extDir, 'extension.js')));
  });
});

