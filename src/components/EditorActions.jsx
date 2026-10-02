import React from 'react';
import { Download, FolderOpen, Redo2, Save, SlidersHorizontal, Undo2 } from 'lucide-react';

export function EditorActions({ canUndo, canRedo, onUndo, onRedo, onSave, onOpenLibrary, onToggleSettings, settingsOpen, onExport, onBackup, saveLabel, saveProblem, storageProblem, ready, canSave }) {
  return (
    <div className="editor-actions" aria-label="Document actions">
      <span className={`document-save-state${saveProblem ? ' needs-attention' : ''}`} role="status">{saveLabel}</span>
      <div className="history-actions">
        <button className="icon-button" title="Undo (Ctrl+Z)" aria-label="Undo edit" disabled={!canUndo} onClick={onUndo}><Undo2 size={17} /></button>
        <button className="icon-button" title="Redo (Ctrl+Shift+Z or Ctrl+Y)" aria-label="Redo edit" disabled={!canRedo} onClick={onRedo}><Redo2 size={17} /></button>
      </div>
      {storageProblem && <button className="document-action" onClick={onBackup} disabled={!ready}>Download backup</button>}
      <button className="document-action save-project-action" onClick={onSave} disabled={!canSave} title="Save the current asset and its settings to this browser's project library (Ctrl+S)"><Save size={16} />Save Project</button>
      <button className="document-action" onClick={onOpenLibrary} title="Open sheets saved in this browser"><FolderOpen size={16} />Library</button>
      {onToggleSettings && <button className="document-action studio-settings-toggle" onClick={onToggleSettings} aria-expanded={settingsOpen} aria-controls="studio-settings"><SlidersHorizontal size={16} />{settingsOpen ? 'Hide settings' : 'Sheet settings'}</button>}
      <button className="document-action" onClick={onExport} disabled={!ready} title="Download the selected animation; this does not save the project"><Download size={16} />Export PNG</button>
    </div>
  );
}
