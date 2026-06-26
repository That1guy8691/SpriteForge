import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isKeyOrTransparentPixel,
  normalizeHexColor,
  removeColorFromImageData,
  rgbToHex,
} from '../src/lib/color.js';

test('normalizes hex colors and clamps RGB output', () => {
  assert.equal(normalizeHexColor('FF00AA'), '#ff00aa');
  assert.equal(normalizeHexColor('bad'), '#ff00ff');
  assert.equal(rgbToHex(300, -4, 16), '#ff0010');
});

test('matches key color within tolerance and treats alpha as transparent', () => {
  const data = new Uint8ClampedArray([
    255, 0, 255, 255,
    250, 3, 250, 255,
    20, 20, 20, 0,
    20, 20, 20, 255,
  ]);

  assert.equal(isKeyOrTransparentPixel(data, 0, '#ff00ff', 0), true);
  assert.equal(isKeyOrTransparentPixel(data, 4, '#ff00ff', 6), true);
  assert.equal(isKeyOrTransparentPixel(data, 8, '#ff00ff', 0), true);
  assert.equal(isKeyOrTransparentPixel(data, 12, '#ff00ff', 0), false);
});

test('removes only matching color pixels from image data', () => {
  const imageData = {
    data: new Uint8ClampedArray([
      255, 0, 255, 255,
      255, 0, 250, 255,
      20, 20, 20, 255,
    ]),
  };

  const removed = removeColorFromImageData(imageData, '#ff00ff', 5);

  assert.equal(removed, 2);
  assert.equal(imageData.data[3], 0);
  assert.equal(imageData.data[7], 0);
  assert.equal(imageData.data[11], 255);
});
