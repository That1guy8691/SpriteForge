import React from 'react';
import { Copy, Download, Redo2, Save, Undo2 } from 'lucide-react';

export function EditorActions({ canUndo, canRedo, onUndo, onRedo, onSave, onSaveCopy, onExport, onBackup, saveLabel, saveProblem, storageProblem, ready, canSave }) {
  return (
    <div className="editor-actions" aria-label="Document actions">
      <span className={`document-save-state${saveProblem ? ' needs-attention' : ''}`} role="status">{saveLabel}</span>
      <div className="history-actions">
        <button className="icon-button" title="Undo (Ctrl+Z)" aria-label="Undo edit" disabled={!canUndo} onClick={onUndo}><Undo2 size={17} /></button>
        <button className="icon-button" title="Redo (Ctrl+Shift+Z or Ctrl+Y)" aria-label="Redo edit" disabled={!canRedo} onClick={onRedo}><Redo2 size={17} /></button>
      </div>
      {storageProblem && <button className="document-action" onClick={onBackup} disabled={!ready}>Download backup</button>}
      <button className="document-action save-project-action" onClick={onSave} disabled={!canSave} title="Save the current asset and its settings to this browser's project library (Ctrl+S)"><Save size={16} />Save Project</button>
      <button className="document-action" onClick={onSaveCopy} disabled={!canSave} title="Create a separate saved asset"><Copy size={16} />Save a Copy</button>
      <button className="document-action" onClick={onExport} disabled={!ready} title="Download the selected animation; this does not save the project"><Download size={16} />Export PNG</button>
    </div>
  );
}
