import assert from 'node:assert/strict';
import test from 'node:test';
import { assetFromDocument, createEditorHistory, documentFromAsset, documentsEqual, editorHistoryReducer as reduce, HISTORY_LIMIT } from '../src/lib/editorHistory.js';

const original = {
  source: { url: 'data:original', name: 'hero.png' }, columns: 8, rows: 3,
  frameWidth: 32, frameHeight: 32, exportFrameWidth: 32, exportFrameHeight: 32,
  animations: [{ id: 'walk', name: 'walk', start: 4, end: 11, fps: 10, loop: true }],
  offsets: {}, pivot: { x: 16, y: 28 }, metadataPresetId: 'generic',
  promptConfig: { subject: 'hero' }, activeAssetGuideId: 'sprite-sheet',
};
const change = (state, key, value, group = {}) => reduce(state, { type: 'set', key, value, group });

test('multi-field edits undo and redo atomically', () => {
  const group = {};
  let state = change(createEditorHistory(original), 'frameWidth', 64, group);
  state = change(state, 'frameHeight', 64, group);
  assert.equal(state.past.length, 1);
  const edited = state.present;
  state = reduce(state, { type: 'undo' });
  assert.deepEqual(state.present, original);
  assert.equal(documentsEqual(state.present, state.checkpoint), true);
  state = reduce(state, { type: 'redo' });
  assert.deepEqual(state.present, edited);
});

test('undo restores artwork and offsets together', () => {
  const group = {};
  let state = change(createEditorHistory(original), 'source', { ...original.source, url: 'data:swapped' }, group);
  state = change(state, 'offsets', { 2: { x: 5, y: -2 } }, group);
  assert.deepEqual(reduce(state, { type: 'undo' }).present, original);
});

test('grid changes clamp ranges within the same undo step', () => {
  let state = change(createEditorHistory(original), 'columns', 1);
  assert.equal(state.present.animations[0].end, 2);
  assert.deepEqual(reduce(state, { type: 'undo' }).present.animations, original.animations);
});

test('new edits discard redo, equal updates do not create steps, history is bounded', () => {
  let state = createEditorHistory(original);
  assert.equal(change(state, 'offsets', {}), state);
  state = change(state, 'frameWidth', 64);
  state = reduce(state, { type: 'undo' });
  state = change(state, 'frameWidth', 48);
  assert.equal(state.future.length, 0);
  for (let i = 0; i < 100; i++) state = change(state, 'frameWidth', i + 100);
  assert.equal(state.past.length, HISTORY_LIMIT);
});

test('saving a snapshot does not mark later edits clean; undo can return to saved state', () => {
  let state = change(createEditorHistory(original), 'frameWidth', 64);
  const saved = state.present;
  state = change(state, 'frameHeight', 64);
  state = reduce(state, { type: 'saved', document: saved });
  assert.equal(documentsEqual(state.present, state.checkpoint), false);
  state = reduce(state, { type: 'undo' });
  assert.equal(documentsEqual(state.present, state.checkpoint), true);
});

test('loading clears document history, while a new import is unsaved', () => {
  let state = change(createEditorHistory(original), 'frameWidth', 64);
  state = reduce(state, { type: 'reset', document: original, saved: true });
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 0);
  assert.equal(documentsEqual(state.present, state.checkpoint), true);
  state = reduce(state, { type: 'initialize', saved: false });
  assert.equal(documentsEqual(state.present, state.checkpoint), false);
});

test('asset round-trip preserves sheet settings and excludes playback selection from edits', () => {
  const doc = { ...original, offsets: { 3: { x: 7, y: -1 } }, pivot: { x: 8, y: 12 }, frameWidth: 64 };
  const asset = assetFromDocument(doc, { id: 'hero', name: 'Hero', selectedFrame: 3, now: 'today' });
  assert.equal(asset.sheet.selectedFrame, 3);
  assert.deepEqual(documentFromAsset(asset, original), doc);
  assert.equal('selectedFrame' in documentFromAsset(asset, original), false);
});
