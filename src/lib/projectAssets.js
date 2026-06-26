function updateProject(projects, projectId, updater) {
  return projects.map((project) => (project.id === projectId ? updater(project) : project));
}

export function renameProjectAsset(projects, projectId, assetId, nextName) {
  const cleanName = String(nextName || '').trim();
  if (!cleanName) return projects;

  return updateProject(projects, projectId, (project) => ({
    ...project,
    updatedAt: new Date().toISOString(),
    assets: (project.assets ?? []).map((asset) =>
      asset.id === assetId ? { ...asset, name: cleanName } : asset
    ),
  }));
}

export function deleteProjectAsset(projects, projectId, assetId) {
  return updateProject(projects, projectId, (project) => ({
    ...project,
    updatedAt: new Date().toISOString(),
    assets: (project.assets ?? []).filter((asset) => asset.id !== assetId),
  }));
}

export function duplicateProjectAsset(projects, projectId, assetId, { makeId, now = () => new Date().toISOString() }) {
  let duplicatedAsset = null;
  const nextProjects = updateProject(projects, projectId, (project) => {
    const sourceAsset = (project.assets ?? []).find((asset) => asset.id === assetId);
    if (!sourceAsset) return project;

    duplicatedAsset = {
      ...sourceAsset,
      id: makeId('asset'),
      name: `${sourceAsset.name ?? 'asset'} copy`,
      savedAt: now(),
      duplicatedFrom: sourceAsset.id,
    };

    const sourceIndex = (project.assets ?? []).findIndex((asset) => asset.id === assetId);
    const nextAssets = [...(project.assets ?? [])];
    nextAssets.splice(sourceIndex + 1, 0, duplicatedAsset);

    return {
      ...project,
      updatedAt: duplicatedAsset.savedAt,
      assets: nextAssets,
    };
  });

  return { projects: nextProjects, asset: duplicatedAsset };
}

export function compareProjectAssets(assetA, assetB) {
  if (!assetA || !assetB) return null;

  const frameA = assetA.sheet?.frameWidth && assetA.sheet?.frameHeight
    ? `${assetA.sheet.frameWidth}x${assetA.sheet.frameHeight}`
    : '-';
  const frameB = assetB.sheet?.frameWidth && assetB.sheet?.frameHeight
    ? `${assetB.sheet.frameWidth}x${assetB.sheet.frameHeight}`
    : '-';

  return {
    names: [assetA.name, assetB.name],
    frameSize: [frameA, frameB],
    grid: [
      `${assetA.sheet?.columns ?? 1}x${assetA.sheet?.rows ?? 1}`,
      `${assetB.sheet?.columns ?? 1}x${assetB.sheet?.rows ?? 1}`,
    ],
    animations: [
      assetA.animations?.length ?? 0,
      assetB.animations?.length ?? 0,
    ],
    sourceSize: [
      assetA.source?.width && assetA.source?.height ? `${assetA.source.width}x${assetA.source.height}` : '-',
      assetB.source?.width && assetB.source?.height ? `${assetB.source.width}x${assetB.source.height}` : '-',
    ],
    savedAt: [assetA.savedAt ?? '-', assetB.savedAt ?? '-'],
  };
}
