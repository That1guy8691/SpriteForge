import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreLibraryItem, saveProjectAsset } from '../src/lib/projectAssets.js';

test('save replaces an existing asset; a copy with a new id adds one', () => {
  const project = { id: 'p', assets: [{ id: 'a', name: 'original' }] };
  const saved = { id: 'a', name: 'updated', savedAt: 'today' };
  let projects = saveProjectAsset([project], project, saved);
  assert.deepEqual(projects[0].assets, [saved]);
  projects = saveProjectAsset(projects, project, { ...saved, id: 'copy' });
  assert.equal(projects[0].assets.length, 2);
  assert.equal(project.assets[0].name, 'original');
});

test('undo asset deletion keeps later edits and can recover its missing project', () => {
  const asset = { id: 'a', name: 'deleted' };
  const project = { id: 'p', name: 'Before', assets: [asset] };
  const deletion = { project, asset, index: 0 };
  const current = [{ ...project, name: 'Renamed afterward', assets: [{ id: 'new' }] }];
  const restored = restoreLibraryItem(current, deletion);
  assert.equal(restored[0].name, 'Renamed afterward');
  assert.deepEqual(restored[0].assets, [asset, { id: 'new' }]);
  assert.deepEqual(restoreLibraryItem([], deletion)[0].assets, [asset]);
  assert.equal(restoreLibraryItem(restored, deletion), restored);
});

test('undo project deletion does not overwrite another project', () => {
  const project = { id: 'deleted', assets: [{ id: 'a' }] };
  const later = { id: 'later', assets: [{ id: 'b' }] };
  const restored = restoreLibraryItem([later], { project, index: 0 });
  assert.deepEqual(restored, [project, later]);
});
import {
  compareProjectAssets,
  deleteProjectAsset,
  duplicateProjectAsset,
  renameProjectAsset,
} from '../src/lib/projectAssets.js';

function sampleProjects() {
  return [{
    id: 'project_1',
    name: 'Project',
    assets: [
      {
        id: 'asset_1',
        name: 'idle.png',
        savedAt: '2026-01-01T00:00:00.000Z',
        source: { width: 128, height: 64 },
        sheet: { columns: 4, rows: 2, frameWidth: 32, frameHeight: 32 },
        animations: [{ name: 'idle' }],
      },
      {
        id: 'asset_2',
        name: 'attack.png',
        savedAt: '2026-01-02T00:00:00.000Z',
        source: { width: 256, height: 64 },
        sheet: { columns: 8, rows: 2, frameWidth: 32, frameHeight: 32 },
        animations: [{ name: 'attack' }, { name: 'hurt' }],
      },
    ],
  }];
}

test('renames an asset without touching blank names', () => {
  const renamed = renameProjectAsset(sampleProjects(), 'project_1', 'asset_1', 'hero idle');
  assert.equal(renamed[0].assets[0].name, 'hero idle');

  const unchanged = renameProjectAsset(sampleProjects(), 'project_1', 'asset_1', '   ');
  assert.equal(unchanged[0].assets[0].name, 'idle.png');
});

test('duplicates an asset next to its source', () => {
  const { projects, asset } = duplicateProjectAsset(sampleProjects(), 'project_1', 'asset_1', {
    makeId: () => 'asset_copy',
    now: () => '2026-01-03T00:00:00.000Z',
  });

  assert.equal(asset.id, 'asset_copy');
  assert.equal(asset.duplicatedFrom, 'asset_1');
  assert.deepEqual(projects[0].assets.map((item) => item.id), ['asset_1', 'asset_copy', 'asset_2']);
});

test('deletes an asset by id', () => {
  const projects = deleteProjectAsset(sampleProjects(), 'project_1', 'asset_1');
  assert.deepEqual(projects[0].assets.map((asset) => asset.id), ['asset_2']);
});

test('compares project asset dimensions and animation counts', () => {
  const [assetA, assetB] = sampleProjects()[0].assets;
  const comparison = compareProjectAssets(assetA, assetB);

  assert.deepEqual(comparison.frameSize, ['32x32', '32x32']);
  assert.deepEqual(comparison.grid, ['4x2', '8x2']);
  assert.deepEqual(comparison.animations, [1, 2]);
  assert.deepEqual(comparison.sourceSize, ['128x64', '256x64']);
});
