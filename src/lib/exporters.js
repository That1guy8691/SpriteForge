import { removeColorFromImageData } from './color.js';

export function removeColorFromCanvas(ctx, width, height, targetColor, tolerance = 0) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const removed = removeColorFromImageData(imageData, targetColor, tolerance);
  if (removed) ctx.putImageData(imageData, 0, 0);
  return removed;
}
