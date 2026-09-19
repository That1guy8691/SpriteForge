const PURPOSE_COSTS = {
  'sprite-sheet': { idle: 4, walk: 6, run: 6, jump: 2, attack: 6, cast: 6, interact: 4, hurt: 2, death: 6 },
  'gui-kit': { 'button normal': 1, 'button hover': 1, 'button pressed': 1, disabled: 1, selected: 1, 'active tab': 1, 'empty slot': 1, 'filled slot': 1, 'health bar fill': 1, 'dialogue panel': 1 },
  icons: { normal: 1, highlighted: 1, disabled: 1, equipped: 1, 'cooldown overlay': 1, 'rarity common': 1, 'rarity rare': 1, 'rarity epic': 1, buff: 1, debuff: 1 },
  vehicles: { idle: 1, '8-direction rotation': 8, '16-direction rotation': 16, 'turn left': 3, 'turn right': 3, thrust: 3, boost: 3, brake: 2, damaged: 1, destroyed: 3 },
  tilesets: { 'floor fill': 1, wall: 1, edge: 4, 'outer corner': 4, 'inner corner': 4, transition: 4, door: 2, 'water edge': 4, decoration: 2, 'animated water': 4 },
  'props-items': { idle: 1, pickup: 1, open: 1, closed: 1, used: 1, broken: 1, lit: 1, unlit: 1, 'resource full': 1, 'resource depleted': 1 },
  vfx: { anticipation: 2, spawn: 2, charge: 3, loop: 4, impact: 2, burst: 3, 'hit spark': 2, trail: 3, dissipate: 3, 'smoke fade': 3 },
  portraits: { neutral: 1, happy: 1, sad: 1, angry: 1, surprised: 1, worried: 1, thinking: 1, talking: 3, hurt: 1, determined: 1 },
  'enemy-boss': { idle: 4, move: 6, spawn: 4, telegraph: 3, 'attack windup': 3, 'attack impact': 2, 'attack recovery': 3, cast: 5, hurt: 2, death: 6, enrage: 3, 'phase change': 4 },
};

const MOTION_GUIDES = new Set(['sprite-sheet', 'vehicles', 'vfx', 'enemy-boss']);

export const generationModes = [
  { id: 'reference', name: 'Reference + key poses', description: 'Recommended. Lock one master design, then generate small pose batches.', safe: true },
  { id: 'batch', name: 'Small frame batch', description: 'Generate 2–4 related frames from the approved reference.', safe: true },
  { id: 'sheet', name: 'Full sheet', description: 'Experimental. Ask for a complete sheet in one request.', safe: false },
];

export function getPurposeCost(guideId, purpose) {
  return PURPOSE_COSTS[guideId]?.[purpose] ?? 1;
}

export function resolveBatchIndex(plan, value) {
  const lastIndex = Math.max(0, (plan?.batches?.length ?? 1) - 1);
  const parsed = Math.trunc(Number(value));
  return Math.min(lastIndex, Math.max(0, Number.isFinite(parsed) ? parsed : 0));
}

function splitGroup(group, batchLimit) {
  if (group.cells <= batchLimit) return [group];
  const slices = [];
  let remaining = group.cells;
  let start = 1;
  while (remaining > 0) {
    const cells = Math.min(batchLimit, remaining);
    const end = start + cells - 1;
    slices.push({ ...group, cells, label: `${group.label} frames ${start}–${end}` });
    remaining -= cells;
    start = end + 1;
  }
  return slices;
}

function groupBatches(groups, batchLimit) {
  const source = groups.flatMap((group) => splitGroup(group, batchLimit));
  const batches = [];
  let current = [];
  let used = 0;
  for (const group of source) {
    if (current.length && used + group.cells > batchLimit) {
      batches.push({ groups: current, cells: used });
      current = [];
      used = 0;
    }
    current.push(group);
    used += group.cells;
  }
  if (current.length) batches.push({ groups: current, cells: used });
  return batches;
}

export function createFramePlan({ guideId, framePurpose, config, metrics }) {
  const purposes = framePurpose.options.filter((option) => config.animations?.[option]);
  const selectedPurposes = purposes.length ? purposes : framePurpose.defaultSelected;
  const groups = selectedPurposes.map((label) => ({ label, cells: getPurposeCost(guideId, label) }));
  const requiredCells = groups.reduce((sum, group) => sum + group.cells, 0);
  const capacity = metrics.totalFrames;
  const isMotion = MOTION_GUIDES.has(guideId) || groups.some((group) => group.cells > 1);
  const batchLimit = isMotion ? 4 : 8;
  const batches = groupBatches(groups, batchLimit);
  const suggestedColumns = Math.max(1, Math.min(4, metrics.columnCount));
  const suggestedRows = Math.max(1, Math.ceil(requiredCells / suggestedColumns));
  const fitsFinalGrid = requiredCells <= capacity;
  const fullSheetSafe = !isMotion
    ? requiredCells <= 16 && metrics.canvasWidth <= 512 && metrics.canvasHeight <= 512
    : requiredCells <= 4 && metrics.canvasWidth <= 256 && metrics.canvasHeight <= 256;
  const generationMode = config.generationMode ?? (isMotion ? 'reference' : 'sheet');
  const overflow = Math.max(0, requiredCells - capacity);
  const risk = generationMode === 'sheet' && !fullSheetSafe
    ? 'risky'
    : !fitsFinalGrid
      ? 'moderate'
      : batches.length > 1
        ? 'moderate'
        : 'good';
  const reasons = [];
  if (!fitsFinalGrid) reasons.push(`Needs ${requiredCells} cells; the selected grid only has ${capacity}.`);
  if (generationMode === 'sheet' && isMotion && !fullSheetSafe) reasons.push('One-shot animation sheets commonly drift between poses.');
  if (batches.length > 1) reasons.push(`${batches.length} small batches protect identity and anchor consistency.`);
  if (!reasons.length) reasons.push('The selected content fits a small, low-complexity request.');
  const recommendation = generationMode === 'reference'
    ? `Create one approved reference, then make ${batches.length} small pose batch${batches.length === 1 ? '' : 'es'}.`
    : !fitsFinalGrid
      ? `Increase to at least ${suggestedColumns}×${suggestedRows} or keep the final grid and assemble ${batches.length} batches.`
      : generationMode === 'sheet' && !fullSheetSafe
        ? 'Use the workflow mode instead of asking one model response to solve the entire animation.'
        : 'This request can be attempted as a compact sheet.';
  return {
    purposes: selectedPurposes,
    groups,
    requiredCells,
    capacity,
    overflow,
    fitsFinalGrid,
    isMotion,
    batchLimit,
    batches,
    suggestedGrid: { columns: suggestedColumns, rows: suggestedRows },
    fullSheetSafe,
    generationMode,
    risk,
    reasons,
    recommendation,
  };
}
