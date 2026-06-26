import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectExportEntries,
  createProjectExportZip,
  parseProjectExportZipBlob,
  sanitizeExportName,
} from '../src/lib/projectExport.js';
import { readStoredZipEntries } from '../src/lib/zipArchive.js';

const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lh6O5wAAAABJRU5ErkJggg==';

function sampleProject() {
  return {
    id: 'project_1',
    name: 'Knight Sheet',
    assets: [{
      id: 'asset_1',
      name: 'Hero Idle.png',
      savedAt: '2026-01-01T00:00:00.000Z',
      source: {
        name: 'hero_idle.png',
        url: tinyPngDataUrl,
        width: 64,
        height: 32,
      },
      sheet: {
        columns: 2,
        rows: 1,
        frameWidth: 32,
        frameHeight: 32,
        selectedFrame: 0,
        pivot: { x: 16, y: 28 },
        offsets: {},
        keyColor: '#ff00ff',
        keyTolerance: 12,
        removeKeyBackground: true,
        normalizeExport: false,
        exportFrameWidth: 32,
        exportFrameHeight: 32,
        padding: 0,
      },
      animations: [{ id: 'idle', name: 'idle', start: 0, end: 1, fps: 8, loop: true }],
    }],
  };
}

test('sanitizes export names for stable filenames', () => {
  assert.equal(sanitizeExportName('Knight Sheet!.png'), 'knight_sheet');
  assert.equal(sanitizeExportName('   '), 'spriteforge');
});

test('builds project export entries with source and metadata presets', async () => {
  const entries = await buildProjectExportEntries(sampleProject());
  const names = entries.map((entry) => entry.name);

  assert.ok(names.includes('project.json'));
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('assets/hero_idle/hero_idle.png'));
  assert.ok(names.includes('assets/hero_idle/metadata/spriteforge.json'));
  assert.ok(names.includes('assets/hero_idle/metadata/godot.json'));
  assert.ok(names.includes('assets/hero_idle/metadata/unity.json'));
  assert.ok(names.includes('assets/hero_idle/metadata/aseprite.json'));
});

test('creates a readable zip archive for project exports', async () => {
  const zip = await createProjectExportZip(sampleProject());
  assert.equal(zip.type, 'application/zip');

  const names = readStoredZipEntries(await zip.arrayBuffer()).map((entry) => entry.name);
  assert.ok(names.includes('README.txt'));
  assert.ok(names.includes('project.json'));
  assert.ok(names.includes('assets/hero_idle/hero_idle.png'));
  assert.ok(names.includes('assets/hero_idle/metadata/unity.json'));
});

test('parses a SpriteForge project back from an exported zip bundle', async () => {
  const project = sampleProject();
  const zip = await createProjectExportZip(project);
  const importedProject = await parseProjectExportZipBlob(zip);

  assert.equal(importedProject.id, project.id);
  assert.equal(importedProject.name, project.name);
  assert.equal(importedProject.assets.length, 1);
  assert.equal(importedProject.assets[0].name, 'Hero Idle.png');
  assert.equal(importedProject.assets[0].source.url, tinyPngDataUrl);
});
