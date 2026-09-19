import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendedInitialZoom } from '../src/lib/viewport.js';

test('chooses readable starting zoom for compact sheets', () => {
  assert.equal(recommendedInitialZoom(256, 96), 4);
  assert.equal(recommendedInitialZoom(512, 256), 3);
  assert.equal(recommendedInitialZoom(768, 512), 2);
});

test('reduces starting zoom for large sheets', () => {
  assert.equal(recommendedInitialZoom(1100, 512), 1);
  assert.equal(recommendedInitialZoom(2048, 1024), 0.75);
});
