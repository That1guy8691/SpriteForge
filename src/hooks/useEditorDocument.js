import { useMemo, useReducer, useRef } from 'react';
import { createEditorHistory, documentsEqual, editorHistoryReducer } from '../lib/editorHistory.js';

export function useEditorDocument(initialDocument) {
  const [history, dispatch] = useReducer(editorHistoryReducer, initialDocument, (create) => createEditorHistory(create()));
  const groupRef = useRef(null);
  const setters = useMemo(() => Object.fromEntries(Object.keys(initialDocument()).map((key) => [
    `set${key[0].toUpperCase()}${key.slice(1)}`,
    (value) => {
      // All changes from one event are one undo step, including multi-field presets.
      if (!groupRef.current) {
        groupRef.current = {};
        queueMicrotask(() => { groupRef.current = null; });
      }
      dispatch({ type: 'set', key, value, group: groupRef.current });
    },
  ])), [initialDocument]);

  return {
    document: history.present,
    setters,
    isDirty: !documentsEqual(history.present, history.checkpoint),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoTarget: history.past.at(-1),
    redoTarget: history.future[0],
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    reset: (document, saved = true) => dispatch({ type: 'reset', document, saved }),
    initialize: (saved) => dispatch({ type: 'initialize', saved }),
    markSaved: (document) => dispatch({ type: 'saved', document }),
    amend: (key, value) => dispatch({ type: 'set', key, value, amend: true }),
  };
}
