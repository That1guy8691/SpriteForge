import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreSilhouetteFrames } from '../src/lib/rotationAnalysis.js';

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
