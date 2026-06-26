import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeBackgroundFromImageData,
  analyzeImportImageData,
  chooseDetectedFrameSize,
  choosePackedColumns,
  findVisibleComponentsInImageData,
  PACKED_SPRITE_SUGGESTION,
} from '../src/lib/importAnalysis.js';

function makePixels(width, height, fill = [255, 0, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];
  }
  return data;
}

function fillRect(data, width, x, y, rectWidth, rectHeight, color) {
  for (let py = y; py < y + rectHeight; py += 1) {
    for (let px = x; px < x + rectWidth; px += 1) {
      const index = (py * width + px) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = color[3];
    }
  }
}

test('detects a solid edge key color', () => {
  const width = 32;
  const height = 32;
  const data = makePixels(width, height, [255, 0, 255, 255]);
  fillRect(data, width, 10, 10, 8, 8, [20, 30, 40, 255]);

  const background = analyzeBackgroundFromImageData(data, width, height);

  assert.equal(background.kind, 'solid');
  assert.equal(background.keyColor, '#ff00ff');
});

test('detects true transparency around sheet edges', () => {
  const width = 32;
  const height = 32;
  const data = makePixels(width, height, [0, 0, 0, 0]);
  fillRect(data, width, 10, 10, 8, 8, [20, 30, 40, 255]);

  const background = analyzeBackgroundFromImageData(data, width, height);

  assert.equal(background.kind, 'transparent');
  assert.equal(background.keyColor, null);
});

test('detects fake checkerboard transparency colors', () => {
  const width = 32;
  const height = 32;
  const data = makePixels(width, height, [0, 0, 0, 255]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0
        ? [190, 190, 190, 255]
        : [230, 230, 230, 255];
      fillRect(data, width, x, y, 1, 1, color);
    }
  }
  fillRect(data, width, 10, 10, 8, 8, [20, 30, 40, 255]);

  const background = analyzeBackgroundFromImageData(data, width, height);

  assert.equal(background.kind, 'checker');
  assert.deepEqual(new Set(background.ignoredColors), new Set(['#bebebe', '#e6e6e6']));
});

test('finds separated visible sprite boxes and suggests a packed sheet', () => {
  const width = 96;
  const height = 96;
  const data = makePixels(width, height, [255, 0, 255, 255]);
  fillRect(data, width, 8, 8, 8, 8, [20, 30, 40, 255]);
  fillRect(data, width, 52, 8, 8, 8, [60, 70, 80, 255]);
  fillRect(data, width, 8, 40, 8, 8, [90, 100, 110, 255]);
  fillRect(data, width, 52, 40, 8, 8, [120, 130, 140, 255]);
  fillRect(data, width, 8, 72, 8, 8, [150, 160, 170, 255]);

  const components = findVisibleComponentsInImageData(data, width, height, '#ff00ff', 0);
  const analysis = analyzeImportImageData(data, width, height, {
    keyColor: '#ff00ff',
    keyTolerance: 0,
    preferredColumns: 5,
  });

  assert.equal(components.length, 5);
  assert.deepEqual(
    components.map((component) => [component.minX, component.minY, component.width, component.height]),
    [[8, 8, 8, 8], [52, 8, 8, 8], [8, 40, 8, 8], [52, 40, 8, 8], [8, 72, 8, 8]]
  );
  assert.equal(analysis.detectedSprites, 5);
  assert.ok(analysis.suggestions.some((suggestion) => suggestion.kind === PACKED_SPRITE_SUGGESTION));
});

test('chooses stable packed columns and detected frame sizes', () => {
  assert.equal(choosePackedColumns(8, 8), 4);
  assert.equal(chooseDetectedFrameSize([{ width: 20, height: 28 }]), 48);
});
