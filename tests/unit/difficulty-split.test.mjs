// Run with `npm test` (Node's built-in runner strips TypeScript types natively).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateDifficultyTargets, fitSplitToAvailability, hasShortfall } from '../../src/lib/difficulty-split.ts';

test('allocation always sums to the requested count', () => {
  for (const count of [1, 7, 25, 75, 180]) {
    for (const split of [[30, 50, 20], [0, 0, 100], [33, 33, 34], [100, 0, 0]]) {
      const targets = allocateDifficultyTargets(count, split);
      assert.equal(targets.reduce((a, b) => a + b, 0), count, `${count} ${split}`);
    }
  }
});

test('0% levels get zero questions (100% tough stays tough)', () => {
  assert.deepEqual(allocateDifficultyTargets(25, [0, 0, 100]), [0, 0, 25]);
});

test('fitted split never asks a level for more than it has', () => {
  // Reproduces TestlyPro "Oscillations": no Moderate questions at all.
  const fitted = fitSplitToAvailability(25, [30, 50, 20], [25, 0, 25]);
  assert.ok(fitted);
  assert.equal(fitted.reduce((a, b) => a + b, 0), 100);
  const targets = allocateDifficultyTargets(25, fitted);
  assert.equal(targets[1], 0);
  assert.ok(targets[0] <= 25 && targets[2] <= 25);
});

test('fitted split keeps the original when it already fits', () => {
  assert.deepEqual(fitSplitToAvailability(25, [30, 50, 20], [25, 25, 25]), [30, 50, 20]);
});

test('fitted split respects tight per-level caps exactly', () => {
  const fitted = fitSplitToAvailability(20, [30, 50, 20], [10, 3, 7]);
  assert.ok(fitted);
  const [easy, medium, hard] = allocateDifficultyTargets(20, fitted);
  assert.ok(easy <= 10 && medium <= 3 && hard <= 7);
  assert.equal(easy + medium + hard, 20);
});

test('returns null when the scope cannot fill the paper at all', () => {
  assert.equal(fitSplitToAvailability(25, [30, 50, 20], [5, 5, 5]), null);
});

test('hasShortfall flags only levels that are short', () => {
  const ok = { requested: 10, levels: { easy: { needed: 3, available: 10 }, medium: { needed: 5, available: 5 }, hard: { needed: 2, available: 10 } } };
  const short = { ...ok, levels: { ...ok.levels, medium: { needed: 5, available: 4 } } };
  assert.equal(hasShortfall(ok), false);
  assert.equal(hasShortfall(short), true);
});
