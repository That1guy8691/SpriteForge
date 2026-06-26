export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeHexColor(value) {
  if (!value) return '#ff00ff';
  const cleaned = value.trim().replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toLowerCase()}`;
  return '#ff00ff';
}

export function hexToRgb(value) {
  const hex = normalizeHexColor(value).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

export function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

export function colorSaturation(color) {
  return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}

export function normalizeColorList(value) {
  const colors = Array.isArray(value) ? value : [value];
  return colors.filter(Boolean).map(hexToRgb);
}

export function pixelMatchesTargets(data, index, targetColor, tolerance = 0) {
  const targets = normalizeColorList(targetColor);
  if (!targets.length) return false;
  return targets.some((target) =>
    Math.abs(data[index] - target.r) <= tolerance &&
    Math.abs(data[index + 1] - target.g) <= tolerance &&
    Math.abs(data[index + 2] - target.b) <= tolerance
  );
}

export function isKeyOrTransparentPixel(data, index, targetColor, tolerance = 0) {
  if (data[index + 3] < 20) return true;
  return pixelMatchesTargets(data, index, targetColor, tolerance);
}

export function removeColorFromImageData(imageData, targetColor, tolerance = 0) {
  const targets = normalizeColorList(targetColor);
  if (!targets.length) return 0;

  const { data } = imageData;
  let removed = 0;
  for (let index = 0; index < data.length; index += 4) {
    const matches = targets.some((target) =>
      Math.abs(data[index] - target.r) <= tolerance &&
      Math.abs(data[index + 1] - target.g) <= tolerance &&
      Math.abs(data[index + 2] - target.b) <= tolerance
    );
    if (matches) {
      data[index + 3] = 0;
      removed += 1;
    }
  }
  return removed;
}
