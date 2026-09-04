import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAntigravityAppPaths } from '../src/core-patcher.js';

describe('Core Patcher Module', () => {
  it('should discover application paths on current OS', () => {
    const paths = getAntigravityAppPaths();
    assert.ok(typeof paths === 'object');
    assert.ok('desktopAppAsar' in paths);
    assert.ok('ideAgentJs' in paths);
    assert.ok('ideWorkbenchJs' in paths);

    if (process.platform === 'darwin') {
      assert.ok(paths.desktopAppAsar, 'Desktop app.asar should be discovered on macOS');
      assert.ok(paths.ideAgentJs, 'IDE jetskiAgent.js should be discovered on macOS');
      assert.ok(paths.ideWorkbenchJs, 'IDE workbench.js should be discovered on macOS');
    }
  });
});
