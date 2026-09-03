import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createCandidateHash,
  getInPageDetectorScript,
  getInPageClickScript,
} from '../src/detector.js';

describe('Detector Module', () => {
  it('should generate consistent SHA-256 hashes for candidates', () => {
    const hash1 = createCandidateHash('Run', 'npm test');
    const hash2 = createCandidateHash('run', 'npm test');
    const hash3 = createCandidateHash('Run', 'npm run build');

    assert.strictEqual(hash1, hash2, 'Hash should be case-insensitive');
    assert.notStrictEqual(hash1, hash3, 'Different context should produce different hash');
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 16);
  });

  it('should generate valid in-page detector JavaScript with multiline & sidebar support', () => {
    const script = getInPageDetectorScript(['Accept', 'Run', 'Allow'], ['Reject', 'Cancel']);
    assert.ok(script.includes('collectButtons'));
    assert.ok(script.includes('isInsideSidebar'));
    assert.ok(script.includes('extractContext'));
    assert.ok(script.includes('firstLine'));
    assert.ok(script.includes('candidates'));
  });

  it('should generate valid in-page click JavaScript with pointer and mouse events', () => {
    const clickScript = getInPageClickScript(2, 1725400000);
    assert.ok(clickScript.includes('buttons[2]'));
    assert.ok(clickScript.includes('1725400000'));
    assert.ok(clickScript.includes('PointerEvent'));
    assert.ok(clickScript.includes('MouseEvent'));
    assert.ok(clickScript.includes('btn.click'));
  });
});
