import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProjectBundle,
  normalizeProjectList,
  parseProjectBundleText,
  readLegacyProjects,
  writeLegacyProjects,
  saveStoredProjects,
} from '../src/lib/projectStorage.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test('normalizes project lists defensively', () => {
  const project = { id: 'project_1', assets: [] };
  assert.deepEqual(normalizeProjectList([project, null, 'bad']), [project]);
  assert.deepEqual(normalizeProjectList({}), []);
});

test('reads and writes legacy localStorage project arrays', () => {
  const storage = createMemoryStorage();
  const projects = [{ id: 'project_1', name: 'Test', assets: [] }];

  assert.equal(writeLegacyProjects(projects, storage), true);
  assert.deepEqual(readLegacyProjects(storage), projects);
});

test('creates and parses project bundles', () => {
  const project = { id: 'project_1', name: 'Test', assets: [] };
  const bundle = createProjectBundle(project);

  assert.equal(bundle.app, 'SpriteForge Project Bundle');
  assert.equal(bundle.version, 1);
  assert.deepEqual(parseProjectBundleText(JSON.stringify(bundle)), project);
  assert.deepEqual(parseProjectBundleText(JSON.stringify(project)), project);
});

test('rejects invalid project bundle JSON', () => {
  assert.throws(
    () => parseProjectBundleText(JSON.stringify({ id: 'project_1' })),
    /Invalid SpriteForge project file/
  );
});

test('storage reports success only after the IndexedDB transaction commits', async () => {
  const previousWindow = globalThis.window;
  let shouldAbort = false;
  let closed = 0;
  const storage = createMemoryStorage();
  const database = {
    close() { closed += 1; },
    transaction() {
      const transaction = { objectStore: () => ({
        put() {
          const request = {};
          queueMicrotask(() => {
            request.onsuccess?.();
            queueMicrotask(() => shouldAbort ? transaction.onabort?.() : transaction.oncomplete?.());
          });
          return request;
        },
      }) };
      return transaction;
    },
  };
  globalThis.window = { localStorage: storage, indexedDB: { open() {
    const request = { result: database };
    queueMicrotask(() => request.onsuccess());
    return request;
  } } };
  try {
    assert.equal(await saveStoredProjects([{ id: 'p', assets: [] }]), true);
    shouldAbort = true;
    assert.equal(await saveStoredProjects([{ id: 'p', assets: [{ id: 'a' }] }]), false);
    assert.deepEqual(readLegacyProjects(storage), [], 'must not hide a failed transaction behind a stale fallback');
    assert.equal(closed, 2);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
