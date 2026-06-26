const DATA_URL_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/;

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampFrameRange(animation, totalFrames) {
  const start = Math.max(0, Math.min(totalFrames - 1, numberOr(animation.start, 0)));
  const end = Math.max(start, Math.min(totalFrames - 1, numberOr(animation.end, start)));
  return { start, end };
}

function estimateDataUrlBytes(url) {
  const match = DATA_URL_PATTERN.exec(url ?? '');
  if (!match) return null;
  const [, , base64Flag, data] = match;
  if (!base64Flag) return decodeURIComponent(data).length;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

export function formatCompactNumber(value) {
  const number = Math.round(numberOr(value));
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}K`;
  return String(number);
}

export function formatBytes(value) {
  if (value == null) return '-';
  const bytes = numberOr(value);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

export function analyzeProjectAsset(asset) {
  const sheet = asset.sheet ?? {};
  const columns = Math.max(1, numberOr(sheet.columns, 1));
  const rows = Math.max(1, numberOr(sheet.rows, 1));
  const totalFrames = columns * rows;
  const frameWidth = Math.max(1, numberOr(sheet.frameWidth, asset.source?.layout?.frameWidth ?? 32));
  const frameHeight = Math.max(1, numberOr(sheet.frameHeight, asset.source?.layout?.frameHeight ?? 32));
  const sourceWidth = Math.max(0, numberOr(asset.source?.width, columns * frameWidth));
  const sourceHeight = Math.max(0, numberOr(asset.source?.height, rows * frameHeight));
  const sourcePixels = sourceWidth * sourceHeight;
  const gridPixels = totalFrames * frameWidth * frameHeight;
  const sourceWastePixels = Math.max(0, sourcePixels - gridPixels);
  const sourceCoverage = sourcePixels ? Math.min(1, gridPixels / sourcePixels) : 1;
  const exportFrameWidth = sheet.normalizeExport ? numberOr(sheet.exportFrameWidth, frameWidth) : frameWidth;
  const exportFrameHeight = sheet.normalizeExport ? numberOr(sheet.exportFrameHeight, frameHeight) : frameHeight;
  const padding = Math.max(0, numberOr(sheet.padding, 0));
  const exportPixels = totalFrames * (exportFrameWidth + padding * 2) * (exportFrameHeight + padding * 2);
  const animatedFrames = new Set();

  for (const animation of asset.animations ?? []) {
    const range = clampFrameRange(animation, totalFrames);
    for (let frame = range.start; frame <= range.end; frame += 1) {
      animatedFrames.add(frame);
    }
  }

  const unanimatedFrames = Math.max(0, totalFrames - animatedFrames.size);
  const sourceBytes = estimateDataUrlBytes(asset.source?.url);
  const opportunities = [];

  if (!(asset.animations ?? []).length) {
    opportunities.push('Add animation ranges');
  } else if (unanimatedFrames > 0) {
    opportunities.push(`${unanimatedFrames} unassigned frame${unanimatedFrames === 1 ? '' : 's'}`);
  }
  if (sourceWastePixels > gridPixels * 0.1) {
    opportunities.push(`${Math.round((1 - sourceCoverage) * 100)}% source canvas outside grid`);
  }
  if (sheet.normalizeExport && (exportFrameWidth !== frameWidth || exportFrameHeight !== frameHeight)) {
    opportunities.push(`Exports resize to ${exportFrameWidth}x${exportFrameHeight}`);
  }
  if (padding > 0) {
    opportunities.push(`${padding}px export padding`);
  }
  if (sourceBytes != null && sourceBytes > 512 * 1024) {
    opportunities.push(`${formatBytes(sourceBytes)} embedded source`);
  }
  if (sheet.removeKeyBackground) {
    opportunities.push('Key cleanup enabled');
  }

  return {
    id: asset.id,
    name: asset.name ?? 'untitled asset',
    frameSize: `${frameWidth}x${frameHeight}`,
    gridSize: `${columns}x${rows}`,
    totalFrames,
    animatedFrames: animatedFrames.size,
    unanimatedFrames,
    sourceSize: sourceWidth && sourceHeight ? `${sourceWidth}x${sourceHeight}` : '-',
    sourcePixels,
    gridPixels,
    sourceWastePixels,
    sourceCoverage,
    exportPixels,
    sourceBytes,
    opportunities,
  };
}

export function analyzeProject(project) {
  const assets = (project?.assets ?? []).map(analyzeProjectAsset);
  const totals = assets.reduce((summary, asset) => ({
    frames: summary.frames + asset.totalFrames,
    sourcePixels: summary.sourcePixels + asset.sourcePixels,
    exportPixels: summary.exportPixels + asset.exportPixels,
    unanimatedFrames: summary.unanimatedFrames + asset.unanimatedFrames,
    sourceBytes: summary.sourceBytes + (asset.sourceBytes ?? 0),
  }), {
    frames: 0,
    sourcePixels: 0,
    exportPixels: 0,
    unanimatedFrames: 0,
    sourceBytes: 0,
  });
  const opportunities = assets
    .flatMap((asset) => asset.opportunities.map((label) => ({ asset: asset.name, label })));

  return {
    assetCount: assets.length,
    assets,
    totals,
    opportunities,
  };
}
