const DB_NAME = 'spriteforge.projects';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const PROJECTS_KEY = 'projects';
const LEGACY_PROJECT_STORAGE_KEY = 'spriteforge.projects.v1';

function hasBrowserStorage() {
  return typeof window !== 'undefined';
}

export function normalizeProjectList(value) {
  return Array.isArray(value) ? value.filter((project) => project && typeof project === 'object') : [];
}

export function readLegacyProjects(storage = hasBrowserStorage() ? window.localStorage : null) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(LEGACY_PROJECT_STORAGE_KEY) ?? '[]');
    return normalizeProjectList(parsed);
  } catch {
    return [];
  }
}

export function writeLegacyProjects(projects, storage = hasBrowserStorage() ? window.localStorage : null) {
  if (!storage) return false;
  try {
    storage.setItem(LEGACY_PROJECT_STORAGE_KEY, JSON.stringify(normalizeProjectList(projects)));
    return true;
  } catch {
    return false;
  }
}

export function createProjectBundle(project) {
  return {
    app: 'SpriteForge Project Bundle',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
  };
}

export function parseProjectBundleText(text) {
  const parsed = JSON.parse(text);
  const project = parsed.project ?? parsed;
  if (!project?.id || !Array.isArray(project.assets)) {
    throw new Error('Invalid SpriteForge project file.');
  }
  return project;
}

function openDatabase() {
  if (!hasBrowserStorage() || !window.indexedDB) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open project storage.'));
  });
}

function readSetting(database, key) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not read project storage.'));
  });
}

function writeSetting(database, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error ?? new Error('Could not write project storage.'));
  });
}

export async function loadStoredProjects() {
  const legacyProjects = readLegacyProjects();
  const database = await openDatabase();
  if (!database) return legacyProjects;

  try {
    const storedValue = await readSetting(database, PROJECTS_KEY);
    if (Array.isArray(storedValue)) return normalizeProjectList(storedValue);
    if (legacyProjects.length) {
      await writeSetting(database, PROJECTS_KEY, legacyProjects);
      return legacyProjects;
    }
    return [];
  } finally {
    database.close();
  }
}

export async function saveStoredProjects(projects) {
  const normalizedProjects = normalizeProjectList(projects);
  const database = await openDatabase();
  if (!database) return writeLegacyProjects(normalizedProjects);

  try {
    await writeSetting(database, PROJECTS_KEY, normalizedProjects);
    return true;
  } catch {
    return writeLegacyProjects(normalizedProjects);
  } finally {
    database.close();
  }
}
