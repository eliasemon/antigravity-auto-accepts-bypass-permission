import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SafetyEngine } from '../src/safety.js';

describe('Safety Guardrail Engine (Strict User Rules)', () => {
  const engine = new SafetyEngine();

  describe('Terminal Commands that MUST BE AUTO-ACCEPTED', () => {
    const safeCommands = [
      'git status',
      'npm test',
      'npm run build',
      'node src/index.js',
      'cat package.json',
      'ls -la',
      'echo "hello world"',
      'python -m unittest',
      'pytest tests/',
      'cargo test',
      'cargo build',
      'docker ps',
      'docker run -d nginx',
      'git checkout -b feature/login',
      'git commit -m "feat: add button"',
      'git push origin main',
      'mkdir src/components',
      'touch README.md',
      'curl https://api.github.com',
      'wget https://example.com/file.tar.gz',
      'npm install express',
      'python script.py',
    ];

    for (const cmd of safeCommands) {
      it(`should auto-accept safe terminal command: "${cmd}"`, () => {
        const result = engine.evaluate(cmd);
        assert.strictEqual(result.safe, true, `Expected "${cmd}" to be safe, got: ${result.reason}`);
      });
    }
  });

  describe('Commands that MUST BE LEFT FOR MANUAL REVIEW (sudo, rm, -rf, drop)', () => {
    const manualReviewCommands = [
      // 1. sudo
      'sudo apt-get update',
      'sudo systemctl restart nginx',
      'sudo -u root whoami',

      // 2. rm
      'rm file.txt',
      'rm test.log',
      'rmdir old_dir',
      'del test.txt',
      'Remove-Item ./temp',

      // 3. -rf
      'rm -rf /',
      'rm -rf ./dist',
      'rm -fr node_modules',
      'clean -rf',

      // 4. drop
      'DROP TABLE users',
      'DROP DATABASE production',
      'drop table logs',
      'drop schema public',
    ];

    for (const cmd of manualReviewCommands) {
      it(`should leave dangerous command for manual review: "${cmd}"`, () => {
        const result = engine.evaluate(cmd);
        assert.strictEqual(result.safe, false, `Expected "${cmd}" to be blocked for manual review!`);
        assert.ok(
          result.ruleId === 'sudo' ||
          result.ruleId === 'rm' ||
          result.ruleId === 'rf-flag' ||
          result.ruleId === 'drop',
          `Expected sudo, rm, rf-flag, or drop, got ${result.ruleId}`
        );
      });
    }
  });
});
