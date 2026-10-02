import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnimationExportPlan, drawAnimationExport } from '../src/lib/spriteSheetExport.js';
import { buildMetadataExport } from '../src/lib/metadataExport.js';

function samplePlan(overrides = {}) {
  return createAnimationExportPlan({
    frameWidth: 32, frameHeight: 32, columns: 8,
    frameIndices: [4, 5, 6, 7, 8, 9, 10, 11],
    animation: { name: 'walk', start: 4, end: 11, fps: 10, loop: true },
    padding: 0, normalizeExport: false, exportFrameWidth: 64, exportFrameHeight: 48,
    pivot: { x: 16, y: 28 }, offsets: { 4: { x: 2, y: -1 } },
    removeKeyBackground: true, keyColor: '#ff00ff', keyTolerance: 12,
    ...overrides,
  });
}

test('selected animation PNG and metadata share dimensions, image name and rebased frames', () => {
  const plan = samplePlan();
  const { payload } = buildMetadataExport(plan.metadataContext, 'aseprite');
  assert.equal(plan.filename, 'spriteforge_walk.png');
  assert.deepEqual({ width: plan.width, height: plan.height }, { width: 256, height: 32 });
  assert.equal(payload.meta.image, plan.filename);
  assert.deepEqual(payload.meta.size, { w: plan.width, h: plan.height });
  assert.equal(Object.keys(payload.frames).length, 8);
  assert.deepEqual(payload.meta.frameTags, [{ name: 'walk', from: 0, to: 7, direction: 'forward' }]);
  assert.deepEqual(plan.frames[0].source, { x: 128, y: 0, width: 32, height: 32 });
});

test('padding, normalization, pivot and offsets use the same exported cell coordinates', () => {
  const plan = samplePlan({ normalizeExport: true, padding: 3 });
  assert.deepEqual({ width: plan.width, height: plan.height }, { width: 560, height: 54 });
  assert.deepEqual(plan.frames[0].cell, { x: 0, y: 0, width: 70, height: 54 });
  assert.deepEqual(plan.frames[0].draw, { x: 7, y: 2, width: 64, height: 48 });
  assert.deepEqual(plan.metadataContext.pivot, { x: 35, y: 45 });
  assert.deepEqual(plan.metadataContext.offsets, {}); // Offsets are already baked into the PNG.
  for (const preset of ['spriteforge', 'godot', 'unity', 'aseprite']) {
    const { payload } = buildMetadataExport(plan.metadataContext, preset);
    if (preset === 'aseprite') {
      assert.deepEqual(payload.frames['spriteforge_walk_001.png'].frame, { x: 70, y: 0, w: 70, h: 54 });
    } else if (preset === 'godot') {
      assert.deepEqual(payload.animations[0].frames[1].region, { x: 70, y: 0, width: 70, height: 54 });
      assert.deepEqual(payload.animations[0].frames[0].offset, { x: 0, y: 0 });
    } else if (preset === 'unity') {
      assert.deepEqual(payload.sprites[1].rect, { x: 70, y: 0, width: 70, height: 54 });
    } else {
      assert.equal(payload.frame.width, 70);
      assert.equal(payload.grid.totalFrames, 8);
    }
  }
});

test('only real exported frames are included when the final row is incomplete', () => {
  const plan = samplePlan({ frameIndices: Array.from({ length: 10 }, (_, i) => i + 2) });
  assert.deepEqual({ columns: plan.columns, rows: plan.rows }, { columns: 8, rows: 2 });
  const { payload } = buildMetadataExport(plan.metadataContext, 'aseprite');
  assert.equal(Object.keys(payload.frames).length, 10);
  assert.deepEqual(payload.frames['spriteforge_walk_009.png'].frame, { x: 32, y: 32, w: 32, h: 32 });
});

test('rejects an empty export and sanitizes animation filenames', () => {
  assert.throws(() => samplePlan({ frameIndices: [] }), /at least one frame/);
  assert.equal(samplePlan({ animation: { name: '../Attack / Right', fps: 12 } }).filename, 'spriteforge_attack_right.png');
});

test('clips every frame to its own output cell before drawing offsets', () => {
  const events = [];
  const ctx = Object.fromEntries(['clearRect', 'save', 'beginPath', 'rect', 'clip', 'drawImage', 'restore']
    .map((method) => [method, (...args) => events.push([method, ...args])]));
  const plan = samplePlan({ frameIndices: [4, 5], offsets: { 4: { x: 20, y: 0 } } });
  drawAnimationExport(ctx, 'image', plan);
  assert.equal(ctx.imageSmoothingEnabled, false);
  assert.deepEqual(events.slice(1, 7).map(([method]) => method), ['save', 'beginPath', 'rect', 'clip', 'drawImage', 'restore']);
  assert.deepEqual(events[3], ['rect', 0, 0, 32, 32]);
  assert.deepEqual(events[5], ['drawImage', 'image', 128, 0, 32, 32, 20, 0, 32, 32]);
  assert.deepEqual(events[9], ['rect', 32, 0, 32, 32]);
});
