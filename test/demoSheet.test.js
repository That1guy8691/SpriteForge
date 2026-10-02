import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_ANIMATIONS, drawDemoFrame } from '../src/lib/demoSheet.js';
import { DEMO_PALETTE } from '../src/data/demoCharacter.js';

function renderPixels(frame) {
  const pixels = new Map();
  const ctx = { fillStyle: '', fillRect(x, y, width, height) {
    assert.ok([x, y, width, height].every(Number.isInteger), `Frame ${frame}: integer pixel geometry`);
    assert.ok(x >= 0 && y >= 0 && x + width <= 48 && y + height <= 48, `Frame ${frame}: art stays in its cell`);
    assert.ok(Object.values(DEMO_PALETTE).includes(this.fillStyle));
    for (let py = y; py < y + height; py += 1) {
      for (let px = x; px < x + width; px += 1) pixels.set(py * 48 + px, this.fillStyle);
    }
  } };
  drawDemoFrame(ctx, frame);
  return [...pixels].sort(([a], [b]) => a - b);
}

test('all demo frames stay pixel-exact and within fixed 48px cells', () => {
  for (let frame = 0; frame < 24; frame += 1) assert.ok(renderPixels(frame).length > 300);
});

test('demo clips cover all 24 frames and have visibly different poses', () => {
  const frames = DEMO_ANIMATIONS.flatMap(({ start, end }) => Array.from({ length: end - start + 1 }, (_, i) => start + i));
  assert.deepEqual(frames, Array.from({ length: 24 }, (_, i) => i));
  for (const clip of DEMO_ANIMATIONS) {
    const poses = new Set(frames.filter((frame) => frame >= clip.start && frame <= clip.end)
      .map((frame) => JSON.stringify(renderPixels(frame))));
    assert.equal(poses.size, clip.end - clip.start + 1, `${clip.name}: unique poses`);
  }
});

test('grounded demo clips keep at least one boot on the same baseline', () => {
  for (let frame = 0; frame < 24; frame += 1) {
    const pixels = renderPixels(frame);
    assert.equal(Math.max(...pixels.map(([index]) => Math.floor(index / 48))), 43);
  }
});
