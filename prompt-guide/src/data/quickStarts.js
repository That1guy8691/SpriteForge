import { assetGuideFramePurposeOptions, assetGuidePromptChoices } from './promptData.js';

const QUICK_START_NAMES = {
  'sprite-sheet': ['Classic RPG Hero', 'Tiny Roguelite Enemy', 'Chibi JRPG Character'],
  'gui-kit': ['Dark Adventure HUD', 'Cozy Inventory Kit', 'Sci-Fi Command UI'],
  icons: ['Adventure Inventory Icons', 'Spellbook Ability Atlas', 'Sci-Fi Status Icons'],
  vehicles: ['Space Fighter Turnaround', 'Rally Hover Car', 'Heavy Mining Mech'],
  tilesets: ['Forest Dungeon Terrain', 'Coastal Village Tiles', 'Sci-Fi Station Set'],
  'props-items': ['Fantasy Pickup Set', 'Cozy Workshop Props', 'Sci-Fi Salvage Items'],
  vfx: ['Fireball Impact', 'Arcane Burst', 'Engine Thruster Loop'],
  portraits: ['RPG Expression Set', 'Cozy NPC Portraits', 'Tactical Commander Faces'],
  'enemy-boss': ['Dark Fantasy Boss', 'Crystal Horror', 'Sci-Fi Sentinel'],
};

const LAYOUTS = {
  'sprite-sheet': [64, 6, 3], 'gui-kit': [64, 4, 3], icons: [64, 4, 3], vehicles: [96, 4, 4],
  tilesets: [64, 6, 3], 'props-items': [64, 4, 3], vfx: [96, 4, 3], portraits: [128, 3, 3], 'enemy-boss': [64, 6, 5],
};

const STYLE_FIELDS = ['characterType', 'gameGenre', 'moodRole', 'colors', 'cameraAngle', 'artStyle', 'proportions', 'outlineStyle', 'shadingStyle', 'detailLevel', 'lighting'];

function pick(choices, field, index) {
  const values = choices[field] ?? [];
  return values[index % values.length] ?? values[0] ?? '';
}

export function getQuickStarts(guideId) {
  const choices = assetGuidePromptChoices[guideId] ?? assetGuidePromptChoices['sprite-sheet'];
  const framePurpose = assetGuideFramePurposeOptions[guideId] ?? assetGuideFramePurposeOptions['sprite-sheet'];
  const names = QUICK_START_NAMES[guideId] ?? QUICK_START_NAMES['sprite-sheet'];
  const [frameSize, columns, rows] = LAYOUTS[guideId] ?? LAYOUTS['sprite-sheet'];
  return names.map((name, index) => ({
    id: `${guideId}-quick-${index + 1}`,
    name,
    summary: `${frameSize}px · ${columns}×${rows}`,
    config: {
      presetId: `${guideId}-quick-${index + 1}`,
      ...Object.fromEntries(STYLE_FIELDS.map((field) => [field, pick(choices, field, index)])),
      frameSize: String(frameSize),
      columns: String(columns),
      rows: String(rows),
      generationMode: ['sprite-sheet', 'vehicles', 'vfx', 'enemy-boss'].includes(guideId) ? 'reference' : 'sheet',
      animations: Object.fromEntries(framePurpose.options.map((option) => [option, framePurpose.defaultSelected.includes(option)])),
    },
  }));
}
