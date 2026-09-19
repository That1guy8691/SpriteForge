import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  Layers3,
  RefreshCcw,
  Route,
  Sparkles,
  Undo2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import {
  assetGuideFieldLabels,
  assetGuideFramePurposeOptions,
  assetGuidePromptChoices,
  assetGuides,
  createPromptConfig,
  defaultPromptChoices,
  guideOptions,
  presetPromptChoices,
  presetStyleDetailChoices,
} from './data/promptData.js';
import { getQuickStarts } from './data/quickStarts.js';
import { createFramePlan, generationModes, resolveBatchIndex } from './lib/framePlanner.js';
import {
  buildAssetGuidePrompt,
  buildCorrectionPrompt,
  buildGuidePrompt,
  buildPromptChain,
  calculatePromptMetrics,
  normalizeHexColor,
} from './lib/promptEngine.js';
import { createKit, hydrateImportedKit, loadWorkspace, saveKitCopy, saveWorkspace } from './lib/workspaceStorage.js';

const OUTPUT_TABS = [
  { id: 'prompt', label: 'Prompt', icon: WandSparkles },
  { id: 'guide', label: 'Guide', icon: FileText },
  { id: 'workflow', label: 'Workflow', icon: Route },
  { id: 'repair', label: 'Repair', icon: AlertTriangle },
];

const REPAIR_ISSUES = [
  ['wrong-grid', 'Wrong grid or frame count'],
  ['design-drift', 'Design drift between frames'],
  ['bad-background', 'Background or transparency failed'],
  ['cropped-art', 'Artwork is cropped'],
  ['anchor-drift', 'Scale or anchor drift'],
  ['wrong-view', 'Wrong angle or rotation view'],
];

function formatCellCount(count) {
  return `${count} cell${count === 1 ? '' : 's'}`;
}

function defaultWorkspace() {
  const base = createPromptConfig();
  const starter = getQuickStarts('sprite-sheet')[0].config;
  const config = { ...base, ...starter, options: base.options, backgroundMode: base.backgroundMode, keyColor: base.keyColor, generationMode: 'reference' };
  return { guideId: assetGuides[0].id, config };
}

function App() {
  const [workspace, setWorkspace] = useState(() => loadWorkspace(localStorage, defaultWorkspace()));
  const [outputTab, setOutputTab] = useState('prompt');
  const [activeStepId, setActiveStepId] = useState('design-lock');
  const [repairIssue, setRepairIssue] = useState('design-drift');
  const [status, setStatus] = useState('Draft saved locally');
  const [mobileOutputOpen, setMobileOutputOpen] = useState(false);
  const importInputRef = useRef(null);

  const kit = workspace.currentKit;
  const guideId = kit.guideId;
  const guide = useMemo(() => assetGuides.find((item) => item.id === guideId) ?? assetGuides[0], [guideId]);
  const framePurpose = assetGuideFramePurposeOptions[guideId] ?? assetGuideFramePurposeOptions['sprite-sheet'];
  const labels = assetGuideFieldLabels[guideId] ?? assetGuideFieldLabels['sprite-sheet'];
  const config = useMemo(() => ({
    ...kit.config,
    generationMode: kit.config.generationMode ?? (['sprite-sheet', 'vehicles', 'vfx', 'enemy-boss'].includes(guideId) ? 'reference' : 'sheet'),
  }), [kit.config, guideId]);
  const choices = useMemo(() => ({
    ...defaultPromptChoices,
    ...(presetStyleDetailChoices[config.presetId] ?? {}),
    ...(presetPromptChoices[config.presetId] ?? {}),
    ...(assetGuidePromptChoices[guideId] ?? {}),
  }), [config.presetId, guideId]);
  const quickStarts = useMemo(() => getQuickStarts(guideId), [guideId]);
  const metrics = useMemo(() => calculatePromptMetrics(config, framePurpose), [config, framePurpose]);
  const plan = useMemo(() => createFramePlan({ guideId, framePurpose, config, metrics }), [guideId, framePurpose, config, metrics]);
  const selectedBatchIndex = resolveBatchIndex(plan, config.batchIndex);
  const prompt = useMemo(() => buildGuidePrompt({ guide, framePurpose, config, metrics, guideOptions, plan }), [guide, framePurpose, config, metrics, plan]);
  const assetGuidePrompt = useMemo(() => buildAssetGuidePrompt({ guide, framePurpose, config, metrics, guideOptions, plan }), [guide, framePurpose, config, metrics, plan]);
  const workflow = useMemo(() => buildPromptChain({ guide, framePurpose, config, metrics, guideOptions, plan }), [guide, framePurpose, config, metrics, plan]);
  const repairPrompt = useMemo(() => buildCorrectionPrompt({ issue: repairIssue, guide, framePurpose, config, metrics, guideOptions, plan }), [repairIssue, guide, framePurpose, config, metrics, plan]);
  const activeStep = workflow.find((step) => step.id === activeStepId) ?? workflow[0];
  const workflowProgress = kit.workflowProgress ?? {};
  const workflowNotes = kit.workflowNotes ?? {};

  useEffect(() => {
    saveWorkspace(localStorage, workspace);
  }, [workspace]);

  useEffect(() => {
    if (!workflow.some((step) => step.id === activeStepId)) setActiveStepId(workflow[0]?.id ?? 'design-lock');
  }, [workflow, activeStepId]);

  function updateCurrentKit(updater) {
    setWorkspace((current) => ({
      ...current,
      currentKit: {
        ...current.currentKit,
        ...updater(current.currentKit),
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function update(field, value) {
    updateCurrentKit((current) => ({ config: { ...current.config, [field]: value } }));
  }

  function selectGuide(nextId) {
    const defaultProfile = getQuickStarts(nextId)[0];
    updateCurrentKit((current) => ({
      guideId: nextId,
      config: {
        ...current.config,
        ...defaultProfile.config,
        batchIndex: 0,
        options: current.config.options,
        backgroundMode: current.config.backgroundMode,
        keyColor: current.config.keyColor,
      },
    }));
    setStatus(`Loaded ${assetGuides.find((item) => item.id === nextId)?.name ?? 'asset'} guide`);
  }

  function selectQuickStart(profile) {
    updateCurrentKit((current) => ({
      config: { ...current.config, ...profile.config, batchIndex: 0, options: current.config.options, backgroundMode: current.config.backgroundMode, keyColor: current.config.keyColor },
    }));
    setStatus(`Loaded ${profile.name}`);
  }

  function toggleMap(group, key) {
    updateCurrentKit((current) => ({
      config: { ...current.config, [group]: { ...current.config[group], [key]: !current.config[group]?.[key] } },
    }));
  }

  function applySuggestedGrid() {
    updateCurrentKit((current) => ({
      config: { ...current.config, columns: String(plan.suggestedGrid.columns), rows: String(plan.suggestedGrid.rows) },
    }));
    setStatus(`Set grid to ${plan.suggestedGrid.columns}×${plan.suggestedGrid.rows}`);
  }

  function updateWorkflow(stepId, patch) {
    updateCurrentKit((current) => ({
      workflowProgress: { ...(current.workflowProgress ?? {}), [stepId]: { ...(current.workflowProgress?.[stepId] ?? {}), ...patch, updatedAt: new Date().toISOString() } },
    }));
  }

  function updateWorkflowNote(stepId, note) {
    updateCurrentKit((current) => ({ workflowNotes: { ...(current.workflowNotes ?? {}), [stepId]: note } }));
  }

  function resetDraft() {
    const fallback = defaultWorkspace();
    setWorkspace((current) => ({
      ...current,
      undoKit: current.currentKit,
      currentKit: createKit({ guideId: fallback.guideId, config: fallback.config }),
    }));
    setOutputTab('prompt');
    setStatus('Started a fresh kit — Undo is available');
  }

  function undoReset() {
    if (!workspace.undoKit) return;
    setWorkspace((current) => ({ ...current, currentKit: current.undoKit, undoKit: null }));
    setStatus('Restored the previous kit');
  }

  function saveCopy() {
    setWorkspace((current) => saveKitCopy(current, current.currentKit));
    setStatus('Saved a copy of this prompt kit');
  }

  function loadKit(savedKit) {
    setWorkspace((current) => ({ ...current, currentKit: { ...savedKit, id: current.currentKit.id, updatedAt: new Date().toISOString() } }));
    setOutputTab('prompt');
    setStatus(`Loaded ${savedKit.name}`);
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(message);
      return true;
    } catch {
      setStatus('Clipboard unavailable. Select the prompt and press Ctrl+C.');
      return false;
    }
  }

  async function copyActiveStep() {
    if (await copyText(activeStep.prompt, `Copied ${activeStep.title}`)) updateWorkflow(activeStep.id, { state: 'copied' });
  }

  function downloadKit() {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      kit: { ...kit, config },
      outputs: { prompt, assetGuide: assetGuidePrompt, workflow, repairPrompt },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${guide.id}-${kit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prompt-kit'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Downloaded reloadable prompt kit');
  }

  async function importKit(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = hydrateImportedKit(JSON.parse(await file.text()));
      if (!imported) throw new Error('Invalid kit');
      setWorkspace((current) => ({ ...current, undoKit: current.currentKit, currentKit: imported }));
      setOutputTab('prompt');
      setStatus(`Imported ${imported.name}`);
    } catch {
      setStatus('That file is not a valid Sprite Prompt Guide kit.');
    }
  }

  function selectOutputTab(nextTab) {
    setOutputTab(nextTab);
    setMobileOutputOpen(true);
  }

  function handleOutputTabKeyDown(event, index) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? OUTPUT_TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + OUTPUT_TABS.length) % OUTPUT_TABS.length;
    document.getElementById(`output-tab-${OUTPUT_TABS[targetIndex].id}`)?.focus();
    setOutputTab(OUTPUT_TABS[targetIndex].id);
  }

  const currentOutput = outputTab === 'guide' ? assetGuidePrompt : outputTab === 'workflow' ? activeStep.prompt : outputTab === 'repair' ? repairPrompt : prompt;
  const copyMessage = outputTab === 'guide' ? 'Copied asset guide' : outputTab === 'workflow' ? `Copied ${activeStep.title}` : outputTab === 'repair' ? 'Copied correction prompt' : 'Copied generation prompt';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <div><strong>Sprite Prompt Guide</strong><span>Plan reliable AI-assisted 2D asset production</span></div>
        </div>
        <div className="header-actions">
          {workspace.undoKit ? <button className="button ghost" onClick={undoReset}><Undo2 size={16} />Undo new</button> : null}
          <button className="button ghost desktop-action" onClick={resetDraft}><RefreshCcw size={16} />New kit</button>
          <button className="button ghost desktop-action" onClick={() => importInputRef.current?.click()}><Upload size={16} />Import kit</button>
          <button className="button ghost desktop-action" onClick={downloadKit}><Download size={16} />Export kit</button>
          <button className="button primary" onClick={() => copyText(currentOutput, copyMessage)}><Clipboard size={16} />Copy current</button>
          <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importKit} aria-hidden="true" tabIndex={-1} />
        </div>
      </header>

      <main className="workspace">
        <aside className="asset-rail" aria-label="Asset guides">
          <div className="rail-heading"><span>Choose an asset</span><strong>{assetGuides.length} production guides</strong></div>
          <div className="asset-list">
            {assetGuides.map((item) => <button key={item.id} className={item.id === guideId ? 'asset-button active' : 'asset-button'} onClick={() => selectGuide(item.id)}><span>{item.name}</span><small>{item.target}</small></button>)}
          </div>
        </aside>

        <section className="builder-column">
          <div className="builder-intro">
            <div>
              <span className="section-label">Active guide</span>
              <h1>{guide.name}</h1>
              <p>{guide.bestFor}</p>
            </div>
            <div className={`reliability ${plan.risk}`}><strong>{plan.risk === 'good' ? 'Low-complexity request' : plan.risk === 'moderate' ? 'Plan batches first' : 'One-shot sheet is risky'}</strong><span>{plan.requiredCells} planned / {metrics.totalFrames} grid cells</span></div>
          </div>

          <section className="kit-toolbar" aria-label="Prompt kit controls">
            <label><span>Prompt kit</span><input value={kit.name} onChange={(event) => updateCurrentKit(() => ({ name: event.target.value }))} /></label>
            <button className="button ghost" onClick={saveCopy}><BookmarkPlus size={15} />Save copy</button>
            {workspace.savedKits.length ? <label className="saved-kit-select"><span>Recent</span><select defaultValue="" onChange={(event) => { const selected = workspace.savedKits.find((item) => item.id === event.target.value); if (selected) loadKit(selected); event.target.value = ''; }}><option value="">Load a saved kit</option>{workspace.savedKits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          </section>

          <BuilderSection className="quick-start-section" title="Quick starts" description="These are specific to the selected asset type, not generic character presets.">
            <div className="preset-row">{quickStarts.map((profile) => <button key={profile.id} className={config.presetId === profile.id ? 'preset active' : 'preset'} onClick={() => selectQuickStart(profile)}><strong>{profile.name}</strong><span>{profile.summary}</span></button>)}</div>
          </BuilderSection>

          <BuilderSection className="asset-brief-section" title="Asset brief" description="Describe what the model should design and how the asset will be used.">
            <div className="field-grid">
              <PromptField label={labels.characterType} value={config.characterType} choices={choices.characterType} onChange={(value) => update('characterType', value)} />
              <PromptField label={labels.gameGenre} value={config.gameGenre} choices={choices.gameGenre} onChange={(value) => update('gameGenre', value)} />
              <PromptField label={labels.moodRole} value={config.moodRole} choices={choices.moodRole} onChange={(value) => update('moodRole', value)} />
              <PromptField label={labels.colors} value={config.colors} choices={choices.colors} onChange={(value) => update('colors', value)} />
              <PromptField label={labels.cameraAngle} value={config.cameraAngle} choices={choices.cameraAngle} onChange={(value) => update('cameraAngle', value)} />
              <PromptField label={labels.artStyle} value={config.artStyle} choices={choices.artStyle} onChange={(value) => update('artStyle', value)} />
            </div>
          </BuilderSection>

          <BuilderSection className="style-lock-section" title="Style lock" description="These details keep later frames and batches from drifting.">
            <div className="field-grid">
              <PromptField label={labels.proportions} value={config.proportions} choices={choices.proportions} onChange={(value) => update('proportions', value)} />
              <PromptField label={labels.outlineStyle} value={config.outlineStyle} choices={choices.outlineStyle} onChange={(value) => update('outlineStyle', value)} />
              <PromptField label={labels.shadingStyle} value={config.shadingStyle} choices={choices.shadingStyle} onChange={(value) => update('shadingStyle', value)} />
              <PromptField label={labels.detailLevel} value={config.detailLevel} choices={choices.detailLevel} onChange={(value) => update('detailLevel', value)} />
              <PromptField label={labels.lighting} value={config.lighting} choices={choices.lighting} onChange={(value) => update('lighting', value)} />
            </div>
          </BuilderSection>

          <BuilderSection className="generation-section" title="Generation approach" description="Use reference-first production for animation and rotation work; keep full sheets as an explicit experiment.">
            <div className="generation-mode-grid">{generationModes.map((mode) => <button key={mode.id} type="button" className={config.generationMode === mode.id ? 'generation-mode active' : 'generation-mode'} onClick={() => update('generationMode', mode.id)}><strong>{mode.name}</strong><span>{mode.description}</span>{mode.safe ? <em>Recommended</em> : <em>Experimental</em>}</button>)}</div>
            {config.generationMode === 'batch' && plan.batches.length > 1 ? (
              <label className="batch-picker">
                <span>Batch to generate</span>
                <select aria-label="Batch to generate" value={selectedBatchIndex} onChange={(event) => update('batchIndex', Number(event.target.value))}>
                  {plan.batches.map((batch, index) => (
                    <option key={`${index}-${batch.cells}`} value={index}>
                      Batch {index + 1} · {batch.groups.map((group) => group.label).join(', ')} ({formatCellCount(batch.cells)})
                    </option>
                  ))}
                </select>
                <small>The direct prompt generates only the selected batch. Workflow keeps the complete sequence.</small>
              </label>
            ) : null}
          </BuilderSection>

          <BuilderSection className="sheet-plan-section" title="Sheet plan" description="Set the final assembly contract. The planner checks whether selected content really fits it.">
            <div className="format-row">
              <NumberField label="Cell size" suffix="px" value={config.frameSize} onChange={(value) => update('frameSize', value)} />
              <NumberField label="Columns" value={config.columns} onChange={(value) => update('columns', value)} />
              <NumberField label="Rows" value={config.rows} onChange={(value) => update('rows', value)} />
              <div className="format-result"><span>Final canvas</span><strong>{metrics.canvasWidth} × {metrics.canvasHeight}</strong></div>
            </div>
            <div className="background-row">
              <button className={config.backgroundMode === 'key' ? 'mode-button active' : 'mode-button'} onClick={() => update('backgroundMode', 'key')}>Flat key color</button>
              <button className={config.backgroundMode === 'transparent' ? 'mode-button active' : 'mode-button'} onClick={() => update('backgroundMode', 'transparent')}>True transparency</button>
              {config.backgroundMode === 'key' ? <label className="color-input"><input type="color" value={normalizeHexColor(config.keyColor)} onChange={(event) => update('keyColor', event.target.value)} /><span>{normalizeHexColor(config.keyColor)}</span></label> : null}
            </div>
          </BuilderSection>

          <BuilderSection className="frame-purpose-section" title={framePurpose.title} description={`${framePurpose.rowHint} ${framePurpose.timingHint}`}>
            <div className="check-grid">{framePurpose.options.map((option) => <CheckButton key={option} checked={Boolean(config.animations?.[option])} label={option} onClick={() => toggleMap('animations', option)} />)}</div>
          </BuilderSection>

          <FramePlanCard className="frame-plan-section" plan={plan} metrics={metrics} onApplyGrid={applySuggestedGrid} />

          <BuilderSection className="production-rules-section" title="Production rules" description="Control which cleanup and slicing constraints are written into every output.">
            <div className="check-grid rules">{guideOptions.map((option) => <CheckButton key={option.id} checked={Boolean(config.options?.[option.id])} label={option.label} onClick={() => toggleMap('options', option.id)} />)}</div>
          </BuilderSection>

          <BuilderSection className="repair-section" title="If a generation fails" description="Create a focused correction prompt instead of starting over.">
            <div className="repair-row"><select value={repairIssue} onChange={(event) => setRepairIssue(event.target.value)}>{REPAIR_ISSUES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button className="button ghost" onClick={() => selectOutputTab('repair')}><AlertTriangle size={16} />Open repair prompt</button></div>
          </BuilderSection>
        </section>

        <aside className={mobileOutputOpen ? 'output-column mobile-open' : 'output-column'} aria-label="Prompt output">
          <div className="output-panel">
            <div className="output-tabs" role="tablist" aria-label="Prompt output">
              {OUTPUT_TABS.map(({ id, label, icon: Icon }, index) => <button key={id} id={`output-tab-${id}`} role="tab" aria-selected={outputTab === id} aria-controls={`output-panel-${id}`} tabIndex={outputTab === id ? 0 : -1} className={outputTab === id ? 'active' : ''} onKeyDown={(event) => handleOutputTabKeyDown(event, index)} onClick={() => selectOutputTab(id)}><Icon size={15} />{label}</button>)}
            </div>

            {outputTab === 'workflow' ? <div className="workflow-steps">{workflow.map((step, index) => { const progress = workflowProgress[step.id]?.state ?? 'ready'; return <button key={step.id} className={activeStep.id === step.id ? 'workflow-step active' : 'workflow-step'} onClick={() => setActiveStepId(step.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><small>{step.summary}</small></div><em className={`step-status ${progress}`}>{progress}</em></button>; })}</div> : null}

            <div className="output-heading">
              <div><span>{outputTab === 'workflow' ? activeStep.action : outputTab === 'guide' ? 'Reusable production contract' : outputTab === 'repair' ? 'Keep the approved design; repair one failure' : config.generationMode === 'reference' ? 'Start with the master reference' : 'Ready for your image model'}</span><strong>{outputTab === 'workflow' ? activeStep.title : outputTab === 'guide' ? `${guide.name} guide` : outputTab === 'repair' ? 'Correction prompt' : 'Generation prompt'}</strong></div>
              <button className="icon-copy" title="Copy output" onClick={() => copyText(currentOutput, copyMessage)}><Clipboard size={17} /></button>
            </div>
            <div className="output-summary"><span>{plan.requiredCells} planned cells</span><span>{plan.batches.length} batch{plan.batches.length === 1 ? '' : 'es'}</span><span>{config.backgroundMode === 'key' ? normalizeHexColor(config.keyColor) : 'alpha'}</span></div>
            <textarea id={`output-panel-${outputTab}`} className="prompt-output" readOnly value={currentOutput} aria-label="Generated prompt output" />
            {outputTab === 'workflow' ? <div className="workflow-note"><label><span>Step note</span><textarea value={workflowNotes[activeStep.id] ?? ''} onChange={(event) => updateWorkflowNote(activeStep.id, event.target.value)} placeholder="Paste a short approval note or describe what needs fixing." /></label><div><button className="button ghost" onClick={copyActiveStep}><Clipboard size={16} />Copy this step</button><button className="button primary" onClick={() => { updateWorkflow(activeStep.id, { state: 'approved' }); setStatus(`${activeStep.title} approved`); }}><Check size={16} />Approve step</button></div></div> : null}
            <div className="output-actions">{outputTab === 'workflow' ? <button className="button ghost wide" onClick={() => copyText(workflow.map((step) => `${step.title}\n${step.prompt}`).join('\n\n---\n\n'), 'Copied full workflow')}><Layers3 size={16} />Copy workflow</button> : null}<button className="button primary wide" onClick={() => outputTab === 'workflow' ? copyActiveStep() : copyText(currentOutput, copyMessage)}><Clipboard size={16} />Copy {outputTab === 'workflow' ? 'step' : outputTab}</button></div>
          </div>
        </aside>
      </main>

      <button className="mobile-output-trigger" onClick={() => setMobileOutputOpen((value) => !value)}><WandSparkles size={16} />{mobileOutputOpen ? 'Close output' : 'Preview output'}<ChevronRight size={16} /></button>
      <footer className="status-bar"><Check size={14} /><span>{status}</span><em>Changes save automatically in this browser</em></footer>
    </div>
  );
}

function BuilderSection({ title, description, children, className = '' }) {
  return <section className={`builder-section ${className}`}><div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}

function FramePlanCard({ plan, metrics, onApplyGrid, className = '' }) {
  return <section className={`frame-plan ${plan.risk} ${className}`}><div className="frame-plan-heading"><div><span>Production plan</span><h2>{plan.requiredCells} required cells · {metrics.totalFrames} available</h2><p>{plan.recommendation}</p></div><AlertTriangle size={20} /></div><ul>{plan.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><div className="batch-list">{plan.batches.map((batch, index) => <div key={`${index}-${batch.cells}`}><strong>Batch {index + 1}</strong><span>{batch.groups.map((group) => group.label).join(', ')}</span><em>{formatCellCount(batch.cells)}</em></div>)}</div>{!plan.fitsFinalGrid ? <button className="button ghost" onClick={onApplyGrid}>Use suggested {plan.suggestedGrid.columns}×{plan.suggestedGrid.rows} grid</button> : null}</section>;
}

function PromptField({ label, value, choices = [], onChange }) {
  const listId = `choices-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <label className="prompt-field"><span>{label}</span><input value={value} list={listId} onChange={(event) => onChange(event.target.value)} /><datalist id={listId}>{choices.map((choice) => <option key={choice} value={choice} />)}</datalist></label>;
}

function NumberField({ label, value, suffix, onChange }) {
  return <label className="number-field"><span>{label}</span><div><input type="number" min="1" max="1024" value={value} onChange={(event) => onChange(event.target.value)} />{suffix ? <em>{suffix}</em> : null}</div></label>;
}

function CheckButton({ checked, label, onClick }) {
  return <button type="button" className={checked ? 'check-button active' : 'check-button'} aria-pressed={checked} onClick={onClick}><span className="check-box">{checked ? <Check size={13} /> : null}</span>{label}</button>;
}

export default App;
