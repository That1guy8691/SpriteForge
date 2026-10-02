import React, { useEffect, useRef, useState } from 'react';
import { Copy, GitCompare, X } from 'lucide-react';
import { formatBytes, formatCompactNumber } from '../lib/projectMetrics.js';

export function ProjectLibraryPanel({
  projects,
  activeProject,
  activeProjectId,
  projectNameDraft,
  projectFileInputRef,
  onSelectProject,
  onRenameProject,
  onCreateProject,
  onDeleteProject,
  onSaveAsset,
  onSaveCopy,
  canSave,
  deletedCount,
  onUndoDeletion,
  onBackup,
  onLoadAsset,
  onDeleteAsset,
  onRenameAsset,
  onDuplicateAsset,
  onToggleCompareAsset,
  compareAssetIds,
  assetComparison,
  projectMetrics,
  onExportProject,
  onExportProjectZip,
  onImportProject,
}) {
  const assets = activeProject?.assets ?? [];
  const [visibleCount, setVisibleCount] = useState(8);
  useEffect(() => setVisibleCount(8), [activeProjectId]);

  return (
    <section className="project-library-card">
      <div className="project-library-head">
        <strong>Project Library</strong>
        <span>{assets.length} assets</span>
      </div>
      <select
        value={activeProjectId ?? ''}
        onChange={(event) => onSelectProject(event.target.value || null)}
        aria-label="Active project"
      >
        <option value="">No project selected</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
      <input
        value={projectNameDraft}
        onChange={(event) => onRenameProject(event.target.value)}
        placeholder="Project name"
        aria-label="Project name"
      />
      <div className="project-actions">
        <button type="button" onClick={onCreateProject}>New</button>
        <button type="button" onClick={onSaveAsset} disabled={!canSave}>Save Project</button>
        <button type="button" onClick={onSaveCopy} disabled={!canSave}>Save a Copy</button>
        <button type="button" onClick={onExportProject} disabled={!activeProject} title="Download saved library assets as an editable project">Project JSON</button>
        <button type="button" onClick={onExportProjectZip} disabled={!activeProject} title="Download saved library assets and their source images">Project ZIP</button>
        <button type="button" onClick={onBackup} title="Download an editable project including current unsaved changes">Backup</button>
        <button type="button" onClick={() => projectFileInputRef.current?.click()}>Import</button>
        <button type="button" onClick={onDeleteProject} disabled={!activeProject}>Delete</button>
        <input
          ref={projectFileInputRef}
          type="file"
          accept="application/json,application/zip,.json,.zip"
          onChange={(event) => {
            onImportProject(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <p className="library-storage-note">Saved only in this browser. Download a backup to keep a portable copy.</p>
      {deletedCount > 0 && (
        <div className="library-recovery" role="status">
          <button type="button" onClick={onUndoDeletion}>Undo deletion ({deletedCount})</button>
          <span>Recovery is available until this tab closes.</span>
        </div>
      )}
      <div className="project-asset-list">
        {assets.length ? (
          assets.slice(0, visibleCount).map((asset) => (
            <div key={asset.id} className="project-asset-row">
              <button type="button" className="project-asset-load" onClick={() => onLoadAsset(asset)}>
                <span className="project-asset-thumb" style={{ backgroundImage: asset.source?.url ? `url(${asset.source.url})` : 'none' }} />
                <span>
                  <strong>{asset.name}</strong>
                  <em>{asset.sheet?.columns ?? 1}x{asset.sheet?.rows ?? 1} - {asset.sheet?.frameWidth ?? '-'}px</em>
                </span>
              </button>
              <ProjectAssetNameField asset={asset} onRenameAsset={onRenameAsset} />
              <div className="project-asset-tools">
                <label className="project-asset-compare" title={`Compare ${asset.name}`}>
                  <input
                    type="checkbox"
                    checked={compareAssetIds.includes(asset.id)}
                    onChange={() => onToggleCompareAsset(asset.id)}
                  />
                  <GitCompare size={13} />
                </label>
                <button type="button" title={`Duplicate ${asset.name}`} onClick={() => onDuplicateAsset(asset.id)}><Copy size={13} /></button>
                <button type="button" className="project-asset-delete" title={`Delete ${asset.name}`} onClick={() => onDeleteAsset(asset.id)}><X size={13} /></button>
              </div>
            </div>
          ))
        ) : (
          <p>Optional: save sheets and their settings here to return to them later.</p>
        )}
      </div>
      {assets.length > visibleCount && (
        <button type="button" className="secondary-action" onClick={() => setVisibleCount((count) => count + 8)}>
          Show more assets ({assets.length - visibleCount} remaining)
        </button>
      )}
      {assetComparison && (
        <div className="project-compare-card">
          <strong>Compare Saved Assets</strong>
          <div>
            <span>Name</span><em>{assetComparison.names[0]}</em><em>{assetComparison.names[1]}</em>
            <span>Grid</span><em>{assetComparison.grid[0]}</em><em>{assetComparison.grid[1]}</em>
            <span>Frame</span><em>{assetComparison.frameSize[0]}</em><em>{assetComparison.frameSize[1]}</em>
            <span>Animations</span><em>{assetComparison.animations[0]}</em><em>{assetComparison.animations[1]}</em>
            <span>Source</span><em>{assetComparison.sourceSize[0]}</em><em>{assetComparison.sourceSize[1]}</em>
          </div>
        </div>
      )}
      {assets.length > 0 && (
        <details className="library-report">
          <summary>Storage &amp; export summary</summary>
          <ProjectOptimizationReport metrics={projectMetrics} />
        </details>
      )}
    </section>
  );
}

function ProjectOptimizationReport({ metrics }) {
  const topAssets = metrics.assets.slice(0, 3);
  const visibleOpportunities = metrics.opportunities.slice(0, 5);

  return (
    <div className="project-optimization-card">
      <strong>Project Summary</strong>
      <div className="project-metric-grid">
        <span>Assets</span><em>{metrics.assetCount}</em>
        <span>Frames</span><em>{formatCompactNumber(metrics.totals.frames)}</em>
        <span>Source px</span><em>{formatCompactNumber(metrics.totals.sourcePixels)}</em>
        <span>Export px</span><em>{formatCompactNumber(metrics.totals.exportPixels)}</em>
        <span>Embedded</span><em>{formatBytes(metrics.totals.sourceBytes)}</em>
        <span>Unassigned</span><em>{metrics.totals.unanimatedFrames}</em>
      </div>
      {visibleOpportunities.length > 0 && (
        <ul className="project-opportunity-list">
          {visibleOpportunities.map((item) => (
            <li key={`${item.asset}-${item.label}`}>
              <span>{item.asset}</span>
              <em>{item.label}</em>
            </li>
          ))}
        </ul>
      )}
      <div className="project-metric-assets">
        {topAssets.map((asset) => (
          <div key={asset.id}>
            <span>{asset.name}</span>
            <em>{asset.gridSize} - {asset.frameSize} - {formatCompactNumber(asset.exportPixels)} export px</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectAssetNameField({ asset, onRenameAsset }) {
  const [draftName, setDraftName] = useState(asset.name ?? '');
  const skipNextBlurCommitRef = useRef(false);

  useEffect(() => {
    setDraftName(asset.name ?? '');
  }, [asset.name]);

  function commitName(nextName = draftName) {
    const cleanName = nextName.trim();
    if (cleanName && cleanName !== asset.name) {
      onRenameAsset(asset.id, cleanName);
      setDraftName(cleanName);
    } else {
      setDraftName(asset.name ?? '');
    }
  }

  return (
    <input
      className="project-asset-name"
      value={draftName}
      aria-label={`Rename ${asset.name}`}
      onChange={(event) => setDraftName(event.target.value)}
      onBlur={(event) => {
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          return;
        }
        commitName(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          skipNextBlurCommitRef.current = true;
          commitName(event.currentTarget.value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

