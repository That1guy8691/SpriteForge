import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeFrameContinuity,
  frameSignatureDifference,
  scoreSilhouetteFrames,
} from '../src/lib/rotationAnalysis.js';

test('scores silhouette wobble and scale variance', () => {
  const stats = scoreSilhouetteFrames([
    { frame: 0, pixels: 10, centerX: 10, centerY: 10, radius: 8 },
    { frame: 1, pixels: 10, centerX: 14, centerY: 10, radius: 8 },
    { frame: 2, pixels: 10, centerX: 12, centerY: 14, radius: 12 },
  ]);

  assert.equal(stats.validCount, 3);
  assert.equal(stats.avgX, 12);
  assert.equal(stats.maxScaleDelta > 0, true);
  assert.equal(stats.worstFrame.frame, 2);
});

test('returns empty stats for sheets with no visible frames', () => {
  const stats = scoreSilhouetteFrames([
    { frame: 0, pixels: 0, centerX: 0, centerY: 0, radius: 0 },
  ]);

  assert.equal(stats.validCount, 0);
  assert.equal(stats.worstFrame, null);
});

test('compares compact frame signatures with normalized difference', () => {
  assert.equal(
    frameSignatureDifference(
      { signature: [0, 0.25, 0.5, 1] },
      { signature: [0.5, 0.25, 0.25, 0] }
    ),
    0.4375
  );
  assert.equal(frameSignatureDifference({ signature: [0] }, { signature: [0, 1] }), null);
});

test('flags too-similar rotation transitions as stutters', () => {
  const continuity = analyzeFrameContinuity([
    { frame: 0, pixels: 10, signature: [0, 0, 0, 0] },
    { frame: 1, pixels: 10, signature: [0.2, 0.2, 0.2, 0.2] },
    { frame: 2, pixels: 10, signature: [0.21, 0.21, 0.21, 0.21] },
    { frame: 3, pixels: 10, signature: [0.5, 0.5, 0.5, 0.5] },
  ]);

  assert.equal(continuity.stutterCount, 1);
  assert.equal(continuity.issues.find((issue) => issue.type === 'stutter').from, 1);
  assert.equal(continuity.issues.find((issue) => issue.type === 'stutter').to, 2);
});

test('does not flag evenly spaced circular signatures', () => {
  const continuity = analyzeFrameContinuity([
    { frame: 0, pixels: 10, signature: [0, 0] },
    { frame: 1, pixels: 10, signature: [1, 0] },
    { frame: 2, pixels: 10, signature: [1, 1] },
    { frame: 3, pixels: 10, signature: [0, 1] },
  ]);

  assert.equal(continuity.issues.length, 0);
  assert.equal(continuity.typicalDifference, 0.5);
});
