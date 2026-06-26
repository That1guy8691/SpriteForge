import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMetadataExport,
  createMetadataContext,
  EXPORT_PRESETS,
} from '../src/lib/metadataExport.js';

function sampleContext() {
  return createMetadataContext({
    source: { name: 'hero sheet.png' },
    frameWidth: 32,
    frameHeight: 32,
    padding: 0,
    normalizeExport: false,
    exportFrameWidth: 32,
    exportFrameHeight: 32,
    removeKeyBackground: true,
    keyColor: '#ff00ff',
    keyTolerance: 12,
    columns: 4,
    rows: 2,
    totalFrames: 8,
    pivot: { x: 16, y: 28 },
    offsets: { 1: { x: 2, y: -1 } },
    animations: [
      { name: 'idle', start: 0, end: 3, fps: 6, loop: true },
      { name: 'attack', start: 4, end: 7, fps: 12, loop: false },
    ],
  });
}

test('declares available export presets', () => {
  assert.deepEqual(EXPORT_PRESETS.map((preset) => preset.id), ['spriteforge', 'godot', 'unity', 'aseprite']);
});

test('builds SpriteForge metadata with frame and animation ranges', () => {
  const result = buildMetadataExport(sampleContext(), 'spriteforge');

  assert.equal(result.filename, 'hero_sheet_spriteforge.json');
  assert.equal(result.payload.grid.totalFrames, 8);
  assert.deepEqual(result.payload.animations[0].frames, [0, 1, 2, 3]);
  assert.equal(result.payload.backgroundRemoval.keyColor, '#ff00ff');
});

test('builds Godot SpriteFrames metadata', () => {
  const result = buildMetadataExport(sampleContext(), 'godot');

  assert.equal(result.filename, 'hero_sheet_godot.json');
  assert.equal(result.payload.preset, 'godot-spriteframes');
  assert.equal(result.payload.import.nodeType, 'AnimatedSprite2D');
  assert.deepEqual(result.payload.animations[0].frames[1].region, { x: 32, y: 0, width: 32, height: 32 });
  assert.deepEqual(result.payload.animations[0].frames[1].offset, { x: 2, y: -1 });
});

test('builds Unity slicing and clip metadata', () => {
  const result = buildMetadataExport(sampleContext(), 'unity');

  assert.equal(result.payload.preset, 'unity-multiple-sprites');
  assert.equal(result.payload.sprites.length, 8);
  assert.deepEqual(result.payload.slicing.pivotNormalized, { x: 0.5, y: 0.875 });
  assert.deepEqual(result.payload.animationClips[1].sprites, [
    'hero_sheet_004',
    'hero_sheet_005',
    'hero_sheet_006',
    'hero_sheet_007',
  ]);
});

test('builds Aseprite-compatible frames and tags', () => {
  const result = buildMetadataExport(sampleContext(), 'aseprite');

  assert.equal(result.filename, 'hero_sheet_aseprite.json');
  assert.equal(Object.keys(result.payload.frames).length, 8);
  assert.deepEqual(result.payload.frames['hero_sheet_004.png'].frame, { x: 0, y: 32, w: 32, h: 32 });
  assert.deepEqual(result.payload.meta.frameTags, [
    { name: 'idle', from: 0, to: 3, direction: 'forward' },
    { name: 'attack', from: 4, to: 7, direction: 'forward' },
  ]);
});
