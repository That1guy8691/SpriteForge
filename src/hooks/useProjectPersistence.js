import { useEffect, useRef, useState } from 'react';
import { saveStoredProjects } from '../lib/projectStorage.js';

export function useProjectPersistence(projects, enabled) {
  const queue = useRef(Promise.resolve());
  const [result, setResult] = useState({ projects: null, error: false });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Serialize writes so an older library cannot finish after a newer save.
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        if (!await saveStoredProjects(projects)) throw new Error('Storage unavailable');
        if (!cancelled) setResult({ projects, error: false });
      } catch {
        if (!cancelled) setResult({ projects, error: true });
      }
    });
    return () => { cancelled = true; };
  }, [projects, enabled]);

  if (!enabled) return 'loading';
  if (result.projects !== projects) return 'saving';
  return result.error ? 'error' : 'saved';
}
