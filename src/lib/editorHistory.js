import { clampAnimationRanges } from './layout.js';

export const HISTORY_LIMIT = 60;

function equalValue(left, right) {
  return left === right || (typeof left === 'object' && typeof right === 'object'
    && JSON.stringify(left) === JSON.stringify(right));
}

export function documentsEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => equalValue(left[key], right[key]));
}

export function createEditorHistory(document) {
  return { present: document, past: [], future: [], checkpoint: document, group: null };
}

export function editorHistoryReducer(state, action) {
  switch (action.type) {
    case 'set': {
      const value = typeof action.value === 'function' ? action.value(state.present[action.key]) : action.value;
      if (equalValue(value, state.present[action.key])) return state;
      let present = { ...state.present, [action.key]: value };
      if (action.key === 'columns' || action.key === 'rows') {
        present = { ...present, animations: clampAnimationRanges(present.animations, Math.max(1, present.columns * present.rows)) };
      }
      const grouped = action.group != null && state.group === action.group;
      return {
        ...state, present,
        past: action.amend || grouped ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: action.amend ? state.future : [],
        group: action.amend ? state.group : action.group,
      };
    }
    case 'undo':
      if (!state.past.length) return state;
      return { ...state, present: state.past.at(-1), past: state.past.slice(0, -1), future: [state.present, ...state.future], group: null };
    case 'redo':
      if (!state.future.length) return state;
      return { ...state, present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1), group: null };
    case 'reset':
      return { ...createEditorHistory(action.document), checkpoint: action.saved ? action.document : null };
    case 'initialize':
      return { ...createEditorHistory(state.present), checkpoint: action.saved ? state.present : null };
    case 'saved':
      return { ...state, checkpoint: action.document, group: null };
    default:
      return state;
  }
}

export function documentFromAsset(asset, defaults) {
  const sheet = asset.sheet ?? {};
  const columns = sheet.columns ?? 1;
  const rows = sheet.rows ?? 1;
  return {
    ...defaults,
    ...Object.fromEntries(Object.keys(defaults).filter((key) => key in sheet).map((key) => [key, sheet[key]])),
    source: asset.source,
    columns,
    rows,
    exportFrameWidth: sheet.exportFrameWidth ?? sheet.frameWidth ?? defaults.exportFrameWidth,
    exportFrameHeight: sheet.exportFrameHeight ?? sheet.frameHeight ?? defaults.exportFrameHeight,
    animations: clampAnimationRanges(asset.animations?.length ? asset.animations : defaults.animations, Math.max(1, columns * rows)),
    promptConfig: asset.promptConfig ?? defaults.promptConfig,
    activeAssetGuideId: asset.activeAssetGuideId ?? defaults.activeAssetGuideId,
  };
}

export function assetFromDocument(document, { id, name, selectedFrame, now = new Date().toISOString() }) {
  const { source, animations, promptConfig, activeAssetGuideId, ...sheet } = document;
  return { id, name, savedAt: now, source, animations, promptConfig, activeAssetGuideId, sheet: { ...sheet, selectedFrame } };
}
