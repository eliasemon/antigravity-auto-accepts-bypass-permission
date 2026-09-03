import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../bin/antigravity-auto-accept.js');

describe('CLI Subcommands', () => {
  it('should display help message', () => {
    const out = execSync(`node "${cliPath}" --help`, { encoding: 'utf8' });
    assert.ok(out.includes('Antigravity Auto-Accept CLI'));
    assert.ok(out.includes('run'));
    assert.ok(out.includes('start'));
    assert.ok(out.includes('stop'));
    assert.ok(out.includes('status'));
    assert.ok(out.includes('toggle'));
  });

  it('should display version', () => {
    const out = execSync(`node "${cliPath}" --version`, { encoding: 'utf8' });
    assert.ok(out.includes('1.0.0'));
  });

  it('should return config path', () => {
    const out = execSync(`node "${cliPath}" config path`, { encoding: 'utf8' }).trim();
    assert.ok(out.endsWith('config.json'));
  });

  it('should display active configuration JSON', () => {
    const out = execSync(`node "${cliPath}" config show`, { encoding: 'utf8' });
    assert.ok(out.includes('"port": 9333') || out.includes('"port":'));
    assert.ok(out.includes('"acceptLabels"'));
    assert.ok(out.includes('"blacklist"'));
  });

  it('should report stopped daemon status gracefully', () => {
    const out = execSync(`node "${cliPath}" status`, { encoding: 'utf8' });
    assert.ok(out.includes('STOPPED') || out.includes('RUNNING'));
  });

  it('should run doctor diagnostic report', () => {
    const out = execSync(`node "${cliPath}" doctor`, { encoding: 'utf8' });
    assert.ok(out.includes('Antigravity Environment Doctor'));
    assert.ok(out.includes('Target CDP Port'));
    assert.ok(out.includes('Setup Instructions'));
  });
});
