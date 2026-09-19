export const WORKSPACE_KEY = 'sprite-prompt-guide:v2';
export const LEGACY_WORKSPACE_KEY = 'sprite-prompt-guide:v1';

function makeId() {
  return `kit-${Math.random().toString(36).slice(2, 9)}`;
}

export function createKit({ guideId, config, name = 'Untitled prompt kit', workflowProgress = {}, workflowNotes = {} } = {}) {
  const now = new Date().toISOString();
  return { id: makeId(), name, guideId, config, workflowProgress, workflowNotes, createdAt: now, updatedAt: now };
}

export function createWorkspace({ guideId, config }) {
  return { version: 2, currentKit: createKit({ guideId, config }), savedKits: [], undoKit: null };
}

export function normalizeWorkspace(saved, fallback) {
  if (saved?.version === 2 && saved.currentKit?.config && saved.currentKit?.guideId) {
    return { ...saved, savedKits: Array.isArray(saved.savedKits) ? saved.savedKits.slice(0, 10) : [], undoKit: saved.undoKit ?? null };
  }
  if (saved?.config && saved?.guideId) {
    const migrated = createWorkspace(fallback);
    migrated.currentKit = createKit({ guideId: saved.guideId, config: saved.config, name: 'Recovered prompt kit' });
    return migrated;
  }
  return createWorkspace(fallback);
}

export function loadWorkspace(storage, fallback) {
  try {
    const current = JSON.parse(storage.getItem(WORKSPACE_KEY));
    if (current) return normalizeWorkspace(current, fallback);
    const legacy = JSON.parse(storage.getItem(LEGACY_WORKSPACE_KEY));
    return normalizeWorkspace(legacy, fallback);
  } catch {
    return createWorkspace(fallback);
  }
}

export function saveWorkspace(storage, workspace) {
  storage.setItem(WORKSPACE_KEY, JSON.stringify({ ...workspace, version: 2 }));
}

export function saveKitCopy(workspace, kit) {
  const saved = { ...kit, id: makeId(), name: `${kit.name || 'Untitled prompt kit'} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return { ...workspace, savedKits: [saved, ...workspace.savedKits].slice(0, 10) };
}

export function hydrateImportedKit(payload) {
  const source = payload?.kit ?? payload;
  if (!source?.guideId || !source?.config) return null;
  return createKit({
    guideId: source.guideId,
    config: source.config,
    name: source.name || 'Imported prompt kit',
    workflowProgress: source.workflowProgress ?? {},
    workflowNotes: source.workflowNotes ?? {},
  });
}
