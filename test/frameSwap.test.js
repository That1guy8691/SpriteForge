import assert from 'node:assert/strict';
import test from 'node:test';
import { swapFrameOffsets } from '../src/lib/frameSwap.js';

test('swaps per-frame offsets so edits travel with moved artwork', () => {
  const offsets = {
    3: { x: 2, y: -1 },
    9: { x: -4, y: 5 },
  };

  assert.deepEqual(swapFrameOffsets(offsets, 3, 9), {
    3: { x: -4, y: 5 },
    9: { x: 2, y: -1 },
  });
});

test('removes empty offset slots when swapping with an unedited frame', () => {
  const offsets = {
    4: { x: 6, y: 1 },
  };

  assert.deepEqual(swapFrameOffsets(offsets, 4, 5), {
    5: { x: 6, y: 1 },
  });
});

test('returns the same offset object when the frame does not move', () => {
  const offsets = {
    1: { x: 3, y: 3 },
  };

  assert.equal(swapFrameOffsets(offsets, 1, 1), offsets);
});
