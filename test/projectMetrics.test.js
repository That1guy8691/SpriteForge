import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeProject,
  analyzeProjectAsset,
  formatBytes,
  formatCompactNumber,
} from '../src/lib/projectMetrics.js';

function sampleAsset(overrides = {}) {
  return {
    id: 'asset_1',
    name: 'hero.png',
    source: {
      width: 96,
      height: 64,
      url: 'data:image/png;base64,AAAA',
    },
    sheet: {
      columns: 2,
      rows: 2,
      frameWidth: 32,
      frameHeight: 32,
      normalizeExport: true,
      exportFrameWidth: 64,
      exportFrameHeight: 64,
      padding: 2,
      removeKeyBackground: true,
    },
    animations: [{ name: 'idle', start: 0, end: 1 }],
    ...overrides,
  };
}

test('formats compact numbers and byte estimates', () => {
  assert.equal(formatCompactNumber(1536), '1.5K');
  assert.equal(formatCompactNumber(2_400_000), '2.4M');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(null), '-');
});

test('analyzes saved asset optimization metrics', () => {
  const metrics = analyzeProjectAsset(sampleAsset());

  assert.equal(metrics.totalFrames, 4);
  assert.equal(metrics.animatedFrames, 2);
  assert.equal(metrics.unanimatedFrames, 2);
  assert.equal(metrics.sourcePixels, 6144);
  assert.equal(metrics.gridPixels, 4096);
  assert.equal(metrics.exportPixels, 18496);
  assert.ok(metrics.opportunities.includes('2 unassigned frames'));
  assert.ok(metrics.opportunities.includes('Exports resize to 64x64'));
  assert.ok(metrics.opportunities.includes('2px export padding'));
  assert.ok(metrics.opportunities.includes('Key cleanup enabled'));
});

test('summarizes project-level metrics', () => {
  const project = {
    id: 'project_1',
    name: 'Project',
    assets: [
      sampleAsset(),
      sampleAsset({
        id: 'asset_2',
        name: 'no animations.png',
        animations: [],
      }),
    ],
  };
  const report = analyzeProject(project);

  assert.equal(report.assetCount, 2);
  assert.equal(report.totals.frames, 8);
  assert.equal(report.totals.unanimatedFrames, 6);
  assert.equal(report.assets[1].opportunities[0], 'Add animation ranges');
  assert.ok(report.opportunities.some((item) => item.asset === 'no animations.png'));
});
