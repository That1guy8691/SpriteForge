import { buildMetadataExport, createMetadataContext, EXPORT_PRESETS } from './metadataExport.js';
import { createProjectBundle, parseProjectBundleText } from './projectStorage.js';
import { createZipBlob, readStoredZipEntries } from './zipArchive.js';

const DATA_URL_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/;

export function sanitizeExportName(value, fallback = 'spriteforge') {
  return String(value || fallback)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || fallback;
}

function sanitizeFileName(value, fallback) {
  const name = String(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return name || fallback;
}

function dataUrlToBytes(url) {
  const match = DATA_URL_PATTERN.exec(url);
  if (!match) return null;
  const [, , base64Flag, data] = match;
  if (base64Flag) {
    const binary = atob(data);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(data));
}

async function fetchBytes(url) {
  const dataUrlBytes = dataUrlToBytes(url);
  if (dataUrlBytes) return dataUrlBytes;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

function metadataContextForAsset(asset) {
  const sheet = asset.sheet ?? {};
  const columns = sheet.columns ?? 1;
  const rows = sheet.rows ?? 1;
  const frameWidth = sheet.frameWidth ?? asset.source?.layout?.frameWidth ?? 32;
  const frameHeight = sheet.frameHeight ?? asset.source?.layout?.frameHeight ?? 32;
  return createMetadataContext({
    source: asset.source ?? { name: asset.name },
    frameWidth,
    frameHeight,
    padding: sheet.padding ?? 0,
    normalizeExport: sheet.normalizeExport ?? false,
    exportFrameWidth: sheet.exportFrameWidth ?? frameWidth,
    exportFrameHeight: sheet.exportFrameHeight ?? frameHeight,
    removeKeyBackground: sheet.removeKeyBackground ?? false,
    keyColor: sheet.keyColor ?? '#ff00ff',
    keyTolerance: sheet.keyTolerance ?? 0,
    columns,
    rows,
    totalFrames: columns * rows,
    pivot: sheet.pivot ?? { x: Math.round(frameWidth / 2), y: Math.round(frameHeight / 2) },
    offsets: sheet.offsets ?? {},
    animations: asset.animations ?? [],
  });
}

export function buildAssetMetadataEntries(asset, assetFolder) {
  const context = metadataContextForAsset(asset);
  return EXPORT_PRESETS.map((preset) => {
    const { payload } = buildMetadataExport(context, preset.id);
    return {
      name: `${assetFolder}/metadata/${preset.filenameSuffix}.json`,
      content: JSON.stringify(payload, null, 2),
    };
  });
}

export async function buildProjectExportEntries(project) {
  const projectName = sanitizeExportName(project?.name, 'spriteforge_project');
  const entries = [
    {
      name: 'project.json',
      content: JSON.stringify(createProjectBundle(project), null, 2),
    },
    {
      name: 'manifest.json',
      content: JSON.stringify({
        app: 'SpriteForge Export Bundle',
        version: 1,
        project: project?.name ?? 'Untitled Project',
        exportedAt: new Date().toISOString(),
        assets: (project?.assets ?? []).map((asset) => ({
          id: asset.id,
          name: asset.name,
          source: asset.source?.name,
          frame: {
            width: asset.sheet?.frameWidth,
            height: asset.sheet?.frameHeight,
          },
          grid: {
            columns: asset.sheet?.columns,
            rows: asset.sheet?.rows,
          },
        })),
      }, null, 2),
    },
  ];

  for (const asset of project?.assets ?? []) {
    if (!asset?.source?.url) continue;
    const assetFolder = `assets/${sanitizeExportName(asset.name, asset.id ?? 'asset')}`;
    const sourceFileName = sanitizeFileName(asset.source.name ?? asset.name, 'sprite_sheet.png');
    entries.push({
      name: `${assetFolder}/${sourceFileName}`,
      content: await fetchBytes(asset.source.url),
    });
    entries.push(...buildAssetMetadataEntries(asset, assetFolder));
  }

  entries.unshift({
    name: 'README.txt',
    content: [
      `${project?.name ?? projectName} - SpriteForge export bundle`,
      '',
      'project.json keeps the editable SpriteForge project data.',
      'assets/* contains saved source PNGs and metadata presets for each asset.',
      'metadata/spriteforge.json is the most complete interchange format.',
      'metadata/godot.json, unity.json, and aseprite.json are engine-specific helper exports.',
    ].join('\n'),
  });

  return entries;
}

export async function createProjectExportZip(project) {
  const entries = await buildProjectExportEntries(project);
  return createZipBlob(entries);
}

export async function parseProjectExportZipBlob(blob) {
  const entries = readStoredZipEntries(await blob.arrayBuffer());
  const projectEntry = entries.find((entry) => entry.name === 'project.json');
  if (!projectEntry) {
    throw new Error('ZIP bundle is missing project.json.');
  }
  return parseProjectBundleText(new TextDecoder().decode(projectEntry.content));
}
