export function recommendedInitialZoom(width, height) {
  const maxSide = Math.max(Number(width) || 0, Number(height) || 0);
  if (maxSide <= 320) return 4;
  if (maxSide <= 512) return 3;
  if (maxSide <= 768) return 2;
  if (maxSide <= 1100) return 1;
  return 0.75;
}
