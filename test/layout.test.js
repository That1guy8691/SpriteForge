import assert from 'node:assert/strict';
import test from 'node:test';
import {
  animationIdFromName,
  clampAnimationRanges,
  getBestSliceableSuggestion,
  getPackedSuggestion,
  inferAnimationsForLayout,
  isPackedLayoutSuggestion,
  singleFrameAnimation,
} from '../src/lib/layout.js';
import { PACKED_SPRITE_SUGGESTION } from '../src/lib/importAnalysis.js';

test('clamps animation ranges to available frames', () => {
  const original = [
    { id: 'walk', start: -3, end: 10, fps: 8 },
    { id: 'hurt', start: 4, end: 2, fps: 8 },
  ];

  assert.deepEqual(clampAnimationRanges(original, 5), [
    { id: 'walk', start: 0, end: 4, fps: 8 },
    { id: 'hurt', start: 4, end: 4, fps: 8 },
  ]);
});

test('builds stable animation ids and single-frame animations', () => {
  assert.equal(animationIdFromName('Row 1 / Attack!', 0), 'row_1_attack_1');
  assert.deepEqual(singleFrameAnimation('full sheet'), [{
    id: 'full_sheet_1',
    name: 'full sheet',
    start: 0,
    end: 0,
    fps: 8,
    loop: true,
  }]);
});

test('classifies packed and sliceable layout suggestions', () => {
  const suggestions = [
    { kind: PACKED_SPRITE_SUGGESTION, columns: 4, rows: 2 },
    { kind: 'detected rows', columns: 4, rows: 2 },
  ];

  assert.equal(isPackedLayoutSuggestion(suggestions[0]), true);
  assert.equal(getPackedSuggestion(suggestions), suggestions[0]);
  assert.equal(getBestSliceableSuggestion(suggestions), suggestions[1]);
});

test('infers row animations for detected row grids', () => {
  const animations = inferAnimationsForLayout({ kind: 'detected rows', columns: 4, rows: 3 }, 10, []);

  assert.deepEqual(animations.map(({ name, start, end }) => ({ name, start, end })), [
    { name: 'row 1', start: 0, end: 3 },
    { name: 'row 2', start: 4, end: 7 },
    { name: 'row 3', start: 8, end: 9 },
  ]);
});

test('uses fallback animations without a suggestion', () => {
  const fallback = [{ id: 'idle', start: 0, end: 1 }];
  assert.equal(inferAnimationsForLayout(null, 0, fallback), fallback);
});
