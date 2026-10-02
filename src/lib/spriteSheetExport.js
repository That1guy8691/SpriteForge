import { createMetadataContext } from './metadataExport.js';
import { sanitizeExportName } from './projectExport.js';

// Both PNG rendering and metadata consume these output coordinates.
export function createAnimationExportPlan({
  frameWidth, frameHeight, columns, frameIndices, animation,
  padding = 0, normalizeExport = false, exportFrameWidth, exportFrameHeight,
  pivot, offsets = {}, removeKeyBackground, keyColor, keyTolerance,
}) {
  if (!frameIndices?.length) throw new Error('Export requires at least one frame.');
  const outputWidth = normalizeExport ? exportFrameWidth : frameWidth;
  const outputHeight = normalizeExport ? exportFrameHeight : frameHeight;
  const cellWidth = outputWidth + padding * 2;
  const cellHeight = outputHeight + padding * 2;
  const outputColumns = Math.min(frameIndices.length, 8);
  const outputRows = Math.ceil(frameIndices.length / outputColumns);
  const scaleX = outputWidth / frameWidth;
  const scaleY = outputHeight / frameHeight;
  const animationName = String(animation.name ?? '').replace(/[.\\/]/g, '_');
  const filename = `spriteforge_${sanitizeExportName(animationName, 'animation').replace(/_+/g, '_')}.png`;
  const frames = frameIndices.map((sourceIndex, index) => {
    const cell = {
      x: (index % outputColumns) * cellWidth,
      y: Math.floor(index / outputColumns) * cellHeight,
      width: cellWidth,
      height: cellHeight,
    };
    const offset = offsets[sourceIndex] ?? { x: 0, y: 0 };
    return {
      sourceIndex,
      source: {
        x: (sourceIndex % columns) * frameWidth,
        y: Math.floor(sourceIndex / columns) * frameHeight,
        width: frameWidth,
        height: frameHeight,
      },
      cell,
      draw: {
        x: cell.x + padding + Math.round(offset.x * scaleX),
        y: cell.y + padding + Math.round(offset.y * scaleY),
        width: outputWidth,
        height: outputHeight,
      },
    };
  });
  const metadataContext = createMetadataContext({
    source: { name: filename },
    frameWidth: cellWidth, frameHeight: cellHeight,
    padding: 0, // Padding and offsets are baked into the exported pixels.
    normalizeExport,
    exportFrameWidth: cellWidth, exportFrameHeight: cellHeight,
    removeKeyBackground, keyColor, keyTolerance,
    columns: outputColumns, rows: outputRows, totalFrames: frames.length,
    pivot: {
      x: padding + Math.round(pivot.x * scaleX),
      y: padding + Math.round(pivot.y * scaleY),
    },
    offsets: {},
    animations: [{ ...animation, start: 0, end: frames.length - 1 }],
  });
  return {
    filename, frames, columns: outputColumns, rows: outputRows,
    width: outputColumns * cellWidth, height: outputRows * cellHeight,
    frameWidth: outputWidth, frameHeight: outputHeight, metadataContext,
  };
}

export function drawAnimationExport(ctx, image, plan) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, plan.width, plan.height);
  for (const { source, cell, draw } of plan.frames) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, cell.width, cell.height);
    ctx.clip();
    ctx.drawImage(image, source.x, source.y, source.width, source.height,
      draw.x, draw.y, draw.width, draw.height);
    ctx.restore();
  }
}
