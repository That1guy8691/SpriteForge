import { createFramePlan, resolveBatchIndex } from './framePlanner.js';

function formatCellCount(count) {
  return `${count} cell${count === 1 ? '' : 's'}`;
}

export function normalizeHexColor(value, fallback = '#ff00ff') {
  const raw = String(value ?? '').trim();
  const short = raw.match(/^#?([0-9a-f]{3})$/i);
  if (short) return `#${short[1].split('').map((part) => part + part).join('')}`.toLowerCase();
  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  return full ? `#${full[1].toLowerCase()}` : fallback;
}

export function calculatePromptMetrics(config, framePurpose) {
  const framePixels = Math.max(1, Number(config.frameSize) || 64);
  const columnCount = Math.max(1, Number(config.columns) || 1);
  const rowCount = Math.max(1, Number(config.rows) || 1);
  const totalFrames = columnCount * rowCount;
  const canvasWidth = framePixels * columnCount;
  const canvasHeight = framePixels * rowCount;
  const selectedFramePurposes = framePurpose.options.filter((option) => config.animations?.[option]);
  return { framePixels, columnCount, rowCount, totalFrames, canvasWidth, canvasHeight, selectedFramePurposes };
}

export function buildProductionContract({ guide, framePurpose, config, metrics, guideOptions, plan }) {
  const activePlan = plan ?? createFramePlan({ guideId: guide.id, framePurpose, config, metrics });
  const keyColor = normalizeHexColor(config.keyColor);
  const background = config.backgroundMode === 'transparent'
    ? {
      label: 'true alpha transparency',
      prompt: 'Use true alpha transparency if the tool supports it. Do not draw a checkerboard background.',
      short: 'True alpha transparency. No checkerboard.',
    }
    : {
      label: `flat key color ${keyColor}`,
      prompt: `Use one flat solid key-color background: ${keyColor}. Use exactly that color for every background pixel. Do not use ${keyColor} inside the asset, outline, shadow, VFX, UI pieces, tiles, props, equipment, or materials. Do not add a checkerboard, gradient, texture, shadow, or anti-aliasing to the background.`,
      short: `Flat key color ${keyColor}. Do not use it inside the asset.`,
    };
  const selectedRules = guideOptions.filter((option) => config.options?.[option.id]).map((option) => option.label);
  const styleDetails = [config.artStyle, config.proportions, config.outlineStyle, config.shadingStyle, config.detailLevel, config.lighting].filter(Boolean);
  return {
    guide,
    framePurpose,
    config,
    metrics,
    plan: activePlan,
    keyColor,
    background,
    selectedRules,
    purposes: activePlan.purposes,
    styleDetails,
    assetBrief: [
      `Asset type: ${guide.name}`,
      `Subject: ${config.characterType || '[asset subject]'}`,
      `Game: ${config.gameGenre || '[game genre]'}`,
      `Role: ${config.moodRole || '[gameplay role]'}`,
      `Colors/materials: ${config.colors || '[colors and materials]'}`,
      `Camera/view: ${config.cameraAngle || '[camera angle]'}`,
      `Style details: ${styleDetails.join('; ') || '[style details]'}`,
      `Background: ${background.short}`,
    ].join('\n'),
  };
}

function finalSheetFormat(contract) {
  const { metrics, plan, background } = contract;
  return `Sheet format:
- One complete PNG image sheet.
- Cell / frame size: ${metrics.framePixels}x${metrics.framePixels} pixels.
- Grid: ${metrics.columnCount} columns x ${metrics.rowCount} rows.
- Final canvas size: exactly ${metrics.canvasWidth}x${metrics.canvasHeight} pixels.
- Grid capacity: ${metrics.totalFrames} cells; planned content: ${plan.requiredCells} cells.
- Read order: left to right, top to bottom.
- Do not upscale the final sheet. Do not return a larger preview canvas.
- Background: ${background.prompt}`;
}

export function buildGuidePrompt({ guide, framePurpose, config, metrics, guideOptions, plan }) {
  const contract = buildProductionContract({ guide, framePurpose, config, metrics, guideOptions, plan });
  const { generationMode } = contract.plan;
  if (generationMode === 'reference') {
    return `Create one approved master reference for a game-ready 2D asset. This is not a final sheet yet.

${contract.assetBrief}

Reference rules:
- Make the silhouette, proportions, materials, and palette clear at game size.
- Lock the same view, lighting, outline, and anchor point for every later pose or state.
- ${contract.background.prompt}
- No labels, mockup screen, background scene, or unrelated variants.

Next production plan:
- Needed groups: ${contract.purposes.join(', ')}.
- ${contract.plan.recommendation}
- After approval, generate small batches of no more than ${contract.plan.batchLimit} cells from this reference.

Final output: one centered reference PNG only.`;
  }
  if (generationMode === 'batch') {
    const batchIndex = resolveBatchIndex(contract.plan, config.batchIndex);
    const batch = contract.plan.batches[batchIndex];
    return `Use the approved master reference image and locked style specification.

Create only Batch ${batchIndex + 1} of ${contract.plan.batches.length}:
- ${batch.groups.map((group) => `${group.label} (${formatCellCount(group.cells)})`).join(', ')}.
- Total cells in this batch: ${batch.cells}.
- Cell / frame size: ${contract.metrics.framePixels}x${contract.metrics.framePixels} pixels.
- ${contract.background.prompt}

${contract.assetBrief}

Consistency rules:
- Same design, scale, outline, palette, lighting, and anchor point as the approved reference.
- Keep every frame centered and padded.
- Do not redesign the asset between cells.
- No labels, mockups, background scene, or extra unrelated assets.

Final output: this batch PNG only.`;
  }
  return `Create a game-ready 2D asset sheet that can be sliced cleanly.

Asset:
- Asset type: ${guide.name}
- Subject / set: ${config.characterType || '[asset subject or set]'}
- Game / use: ${config.gameGenre || '[game genre or use]'}
- Role / purpose: ${config.moodRole || '[role or purpose]'}
- Main colors / materials: ${config.colors || '[main colors or materials]'}
- View / layout: ${config.cameraAngle || '[view or layout]'}
- Art style: ${config.artStyle || '[art style]'}
- Proportions / spacing: ${config.proportions || '[proportions or spacing]'}
- Outline: ${config.outlineStyle || '[outline style]'}
- Shading: ${config.shadingStyle || '[shading style]'}
- Detail level: ${config.detailLevel || '[detail level]'}
- Lighting: ${config.lighting || '[lighting]'}

${finalSheetFormat(contract)}

Frame / variant needs:
- Include these ${framePurpose.promptLabel}: ${contract.purposes.join(', ')}.
- ${framePurpose.rowHint}
- ${framePurpose.timingHint}
- Experimental warning: ${contract.plan.recommendation}

Asset-specific requirements:
- ${guide.prompt}
- Avoid: ${guide.avoid}.

Rules:
${contract.selectedRules.map((rule) => `- ${rule}.`).join('\n')}
- Do not create separate images. Do not make a mockup. Do not add a background scene.
- Keep all frames or pieces aligned so the asset does not jitter, drift, or shift when used.

Final output: one PNG image sheet only.`;
}

export function buildAssetGuidePrompt({ guide, framePurpose, config, metrics, guideOptions = [], plan }) {
  const contract = buildProductionContract({ guide, framePurpose, config, metrics, guideOptions, plan });
  return `Create game-ready 2D art for this asset type.

Asset type: ${guide.name}
Best for: ${guide.bestFor}
Target output: ${guide.target}
Format: ${guide.format}
Generation approach: ${contract.plan.generationMode === 'reference' ? 'reference-first, then small pose batches' : contract.plan.generationMode === 'batch' ? 'small approved-reference batch' : 'experimental one-shot sheet'}

Art direction:
- Game genre: ${config.gameGenre || '[game genre]'}
- Style: ${config.artStyle || '[art style]'}
- Main colors: ${config.colors || '[main colors]'}
- Outline: ${config.outlineStyle || '[outline style]'}
- Shading: ${config.shadingStyle || '[shading style]'}
- Lighting: ${config.lighting || '[lighting]'}

Frame / variant plan:
- Include these ${framePurpose.promptLabel}: ${contract.purposes.join(', ')}.
- Planned content: ${contract.plan.requiredCells} cells across ${contract.plan.batches.length} small batch${contract.plan.batches.length === 1 ? '' : 'es'}.
- ${framePurpose.rowHint}
- ${framePurpose.timingHint}

Production rules:
- ${contract.background.prompt}
- Keep all pieces separated with enough padding for slicing.
- Keep scale, perspective, palette, and lighting consistent across the set.
- No labels, captions, watermark, UI explanation text, or background scene. For UI kits, use empty text areas instead of baked text.
- Avoid: ${guide.avoid}.

Specific instructions:
${guide.prompt}

Checklist:
${guide.rules.map((rule) => `- ${rule}`).join('\n')}

Final output: ${contract.plan.generationMode === 'reference' ? 'one approved reference PNG only.' : 'one production PNG only.'}`;
}

export function buildPromptChain({ guide, framePurpose, config, metrics, guideOptions = [], plan }) {
  const contract = buildProductionContract({ guide, framePurpose, config, metrics, guideOptions, plan });
  const batchSteps = contract.plan.batches.map((batch, index) => ({
    id: `batch-${index + 1}`,
    title: `Batch ${index + 1}`,
    summary: batch.groups.map((group) => group.label).join(', '),
    action: 'Generate this small approved-reference batch',
    prompt: `Use the approved master reference image and locked style specification.\n\n${contract.assetBrief}\n\nCreate only this batch:\n${batch.groups.map((group) => `- ${group.label}: ${group.cells} cells`).join('\n')}\n- Total batch cells: ${batch.cells}.\n- Cell / frame size: ${contract.metrics.framePixels}x${contract.metrics.framePixels} pixels.\n- ${contract.background.prompt}\n\nConsistency rules:\n- Same design, scale, pivot or anchor point, palette, outline, and lighting.\n- Do not redesign the asset between frames.\n- Keep every frame centered and padded.\n- No labels, mockup screens, background scenes, or unrelated assets.\n\nFinal output: this batch PNG only.`,
  }));
  return [
    { id: 'design-lock', title: 'Design Lock', action: 'Create the reference', summary: 'Approve one master design before asking for frames.', prompt: buildGuidePrompt({ guide, framePurpose, config: { ...config, generationMode: 'reference' }, metrics, guideOptions, plan: { ...contract.plan, generationMode: 'reference' } }) },
    { id: 'style-spec', title: 'Style Spec', action: 'Lock the rules', summary: 'Turn the approved reference into a consistency checklist.', prompt: `Analyze the approved reference image and write a concise asset production spec.\n\nLock silhouette, proportions, colors, materials, outline, shading, lighting, camera angle, anchor point, and every detail that must stay fixed.\n\nTarget format:\n- ${guide.name}\n- ${metrics.framePixels}x${metrics.framePixels}px cells\n- Final grid: ${metrics.columnCount}x${metrics.rowCount}\n- Planned content: ${contract.plan.requiredCells} cells\n- Needed groups: ${contract.purposes.join(', ')}\n\nKeep the spec short enough to paste into every follow-up image prompt.` },
    { id: 'batch-plan', title: 'Batch Plan', action: 'Confirm the batches', summary: 'Use small batches to prevent design drift.', prompt: `Plan the production batches from the approved reference.\n\nFinal target:\n- ${guide.name}\n- ${contract.plan.requiredCells} planned cells\n- ${metrics.framePixels}x${metrics.framePixels}px cells\n- Final grid: ${metrics.columnCount}x${metrics.rowCount}\n\nBatches:\n${contract.plan.batches.map((batch, index) => `${index + 1}. ${batch.groups.map((group) => group.label).join(', ')} (${batch.cells} cells)`).join('\n')}\n\nDo not generate a full final sheet until every batch is accepted.` },
    ...batchSteps,
    { id: 'assemble', title: 'Final Assembly', action: 'Clean and assemble', summary: 'Normalize every accepted batch into one final sheet.', prompt: `Final assembly checklist:\n\n1. Import each accepted batch into your sprite editor.\n2. Detect or set the batch grid.\n3. Remove ${contract.keyColor} only if a flat key color was used.\n4. Normalize every cell to ${metrics.framePixels}x${metrics.framePixels}px.\n5. Keep the same pivot or anchor point across every batch.\n6. Assemble the final ${metrics.columnCount}x${metrics.rowCount} sheet.\n7. Export the PNG and engine metadata.\n\nReject any batch where proportions, scale, view angle, color identity, or anchor point drift.` },
  ];
}

const REPAIR_INSTRUCTIONS = {
  'wrong-grid': 'The grid, cell count, or read order is wrong.',
  'design-drift': 'The asset changes identity, costume, proportions, or silhouette between frames.',
  'bad-background': 'The background is not the requested transparency or flat key color.',
  'cropped-art': 'Artwork, weapons, VFX, or UI pieces are clipped by cell edges.',
  'anchor-drift': 'The asset shifts scale, pivot, or anchor point between frames.',
  'wrong-view': 'The camera angle or rotation view is inconsistent.',
};

export function buildCorrectionPrompt({ issue, guide, framePurpose, config, metrics, guideOptions = [], plan }) {
  const contract = buildProductionContract({ guide, framePurpose, config, metrics, guideOptions, plan });
  return `Repair the generated game asset. Do not redesign it.

Failure to correct:
- ${REPAIR_INSTRUCTIONS[issue] ?? REPAIR_INSTRUCTIONS['design-drift']}

Locked production contract:
${contract.assetBrief}
- Cell / frame size: ${metrics.framePixels}x${metrics.framePixels} pixels.
- Final grid: ${metrics.columnCount} columns x ${metrics.rowCount} rows.
- ${contract.background.prompt}
- Needed groups: ${contract.purposes.join(', ')}.

Repair rules:
- Preserve the approved design, colors, silhouette, lighting, and outline exactly.
- Correct only the failed requirement.
- Keep all cells centered with the same anchor point and safe padding.
- Return one corrected PNG only; no labels, mockups, or background scene.`;
}
