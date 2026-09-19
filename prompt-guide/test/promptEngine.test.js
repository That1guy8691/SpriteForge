import test from 'node:test';
import assert from 'node:assert/strict';
import { assetGuideFramePurposeOptions, assetGuides, createPromptConfig, guideOptions } from '../src/data/promptData.js';
import { getQuickStarts } from '../src/data/quickStarts.js';
import { createFramePlan } from '../src/lib/framePlanner.js';
import { buildAssetGuidePrompt, buildCorrectionPrompt, buildGuidePrompt, calculatePromptMetrics, normalizeHexColor } from '../src/lib/promptEngine.js';
import { createWorkspace, hydrateImportedKit, loadWorkspace, saveKitCopy } from '../src/lib/workspaceStorage.js';

function guide(id) {
  return assetGuides.find((item) => item.id === id);
}

test('normalizes short and full hex colors', () => {
  assert.equal(normalizeHexColor('#f0a'), '#ff00aa');
  assert.equal(normalizeHexColor('12ABef'), '#12abef');
  assert.equal(normalizeHexColor('bad-value'), '#ff00ff');
});

test('vehicle planner counts direction frames instead of treating each state as one cell', () => {
  const config = { ...createPromptConfig(), generationMode: 'sheet', columns: '4', rows: '4', animations: { idle: true, '8-direction rotation': true, thrust: true, damaged: true } };
  const framePurpose = assetGuideFramePurposeOptions.vehicles;
  const metrics = calculatePromptMetrics(config, framePurpose);
  const plan = createFramePlan({ guideId: 'vehicles', framePurpose, config, metrics });
  assert.equal(plan.requiredCells, 13);
  assert.equal(plan.capacity, 16);
  assert.equal(plan.fullSheetSafe, false);
  assert.equal(plan.risk, 'risky');
  assert.ok(plan.batches.length > 1);
});

test('planner exposes an overflow and a suggested grid', () => {
  const config = { ...createPromptConfig(), generationMode: 'sheet', columns: '4', rows: '2', animations: { idle: true, '8-direction rotation': true, thrust: true, damaged: true } };
  const framePurpose = assetGuideFramePurposeOptions.vehicles;
  const metrics = calculatePromptMetrics(config, framePurpose);
  const plan = createFramePlan({ guideId: 'vehicles', framePurpose, config, metrics });
  assert.equal(plan.overflow, 5);
  assert.equal(plan.fitsFinalGrid, false);
  assert.deepEqual(plan.suggestedGrid, { columns: 4, rows: 4 });
});

test('small batch mode generates the explicitly selected batch', () => {
  const config = { ...createPromptConfig(), generationMode: 'batch', batchIndex: 2, columns: '4', rows: '4', animations: { idle: true, '8-direction rotation': true, thrust: true, damaged: true } };
  const framePurpose = assetGuideFramePurposeOptions.vehicles;
  const metrics = calculatePromptMetrics(config, framePurpose);
  const plan = createFramePlan({ guideId: 'vehicles', framePurpose, config, metrics });
  const prompt = buildGuidePrompt({ guide: guide('vehicles'), framePurpose, config, metrics, guideOptions, plan });
  assert.match(prompt, /Batch 3 of 4/);
  assert.match(prompt, /8-direction rotation frames 5–8 \(4 cells\)/);
  assert.doesNotMatch(prompt, /idle \(1 cells\)/);

  const firstBatchPrompt = buildGuidePrompt({ guide: guide('vehicles'), framePurpose, config: { ...config, batchIndex: 0 }, metrics, guideOptions, plan });
  assert.match(firstBatchPrompt, /idle \(1 cell\)/);
});

test('reference-first prompt asks for a master design rather than a finished sheet', () => {
  const config = { ...createPromptConfig(), generationMode: 'reference' };
  const framePurpose = assetGuideFramePurposeOptions['sprite-sheet'];
  const metrics = calculatePromptMetrics(config, framePurpose);
  const plan = createFramePlan({ guideId: 'sprite-sheet', framePurpose, config, metrics });
  const prompt = buildGuidePrompt({ guide: guide('sprite-sheet'), framePurpose, config, metrics, guideOptions, plan });
  assert.match(prompt, /approved master reference/);
  assert.match(prompt, /not a final sheet yet/);
  assert.match(prompt, /flat solid key-color background: #ff00ff/);
});

test('asset guide preserves selected key-color contract instead of requesting transparency', () => {
  const config = { ...createPromptConfig(), generationMode: 'reference', backgroundMode: 'key', keyColor: '#00aaee' };
  const framePurpose = assetGuideFramePurposeOptions['sprite-sheet'];
  const metrics = calculatePromptMetrics(config, framePurpose);
  const plan = createFramePlan({ guideId: 'sprite-sheet', framePurpose, config, metrics });
  const prompt = buildAssetGuidePrompt({ guide: guide('sprite-sheet'), framePurpose, config, metrics, guideOptions, plan });
  assert.match(prompt, /flat solid key-color background: #00aaee/);
  assert.doesNotMatch(prompt, /Use a transparent background if supported/);
});

test('correction prompt preserves the locked production contract', () => {
  const config = { ...createPromptConfig(), generationMode: 'reference' };
  const framePurpose = assetGuideFramePurposeOptions['sprite-sheet'];
  const metrics = calculatePromptMetrics(config, framePurpose);
  const plan = createFramePlan({ guideId: 'sprite-sheet', framePurpose, config, metrics });
  const prompt = buildCorrectionPrompt({ issue: 'anchor-drift', guide: guide('sprite-sheet'), framePurpose, config, metrics, guideOptions, plan });
  assert.match(prompt, /shifts scale, pivot, or anchor point/);
  assert.match(prompt, /same anchor point/);
});

test('quick starts are contextual to vehicles and default to reference-first', () => {
  const starts = getQuickStarts('vehicles');
  assert.equal(starts.length, 3);
  assert.match(starts[0].name, /Space Fighter/);
  assert.equal(starts[0].config.generationMode, 'reference');
  assert.equal(starts[0].config.characterType, 'black space fighter rotation sheet');
});

test('every guide starts with a final grid large enough for its default content plan', () => {
  for (const item of assetGuides) {
    const profile = getQuickStarts(item.id)[0];
    const config = { ...createPromptConfig(), ...profile.config };
    const framePurpose = assetGuideFramePurposeOptions[item.id];
    const metrics = calculatePromptMetrics(config, framePurpose);
    const plan = createFramePlan({ guideId: item.id, framePurpose, config, metrics });
    assert.ok(plan.fitsFinalGrid, `${item.id} starter needs ${plan.requiredCells} cells but only has ${plan.capacity}`);
  }
});

test('legacy workspace drafts migrate without losing their active kit', () => {
  const store = new Map();
  store.set('sprite-prompt-guide:v1', JSON.stringify({ guideId: 'vehicles', config: { ...createPromptConfig(), generationMode: 'reference' } }));
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  const workspace = loadWorkspace(storage, { guideId: 'sprite-sheet', config: createPromptConfig() });
  assert.equal(workspace.version, 2);
  assert.equal(workspace.currentKit.guideId, 'vehicles');
  assert.match(workspace.currentKit.name, /Recovered/);
});

test('saving a kit copy retains a bounded history', () => {
  const workspace = createWorkspace({ guideId: 'sprite-sheet', config: createPromptConfig() });
  const next = saveKitCopy(workspace, workspace.currentKit);
  assert.equal(next.savedKits.length, 1);
  assert.notEqual(next.savedKits[0].id, workspace.currentKit.id);
});

test('reloadable exported kit payload restores a fresh current kit', () => {
  const config = { ...createPromptConfig(), generationMode: 'reference' };
  const kit = hydrateImportedKit({ kit: { guideId: 'vehicles', config, name: 'Imported fighter', workflowProgress: { 'design-lock': { state: 'approved' } } } });
  assert.equal(kit.guideId, 'vehicles');
  assert.equal(kit.name, 'Imported fighter');
  assert.equal(kit.workflowProgress['design-lock'].state, 'approved');
  assert.notEqual(kit.id, undefined);
});
