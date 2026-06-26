import {
  clamp,
  colorDistance,
  colorSaturation,
  isKeyOrTransparentPixel,
  rgbToHex,
} from './color.js';

export const DEFAULT_FRAME_SIZE = 32;
export const MAX_FRAME_SIZE = 2048;
export const COMMON_FRAME_SIZES = [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];
export const PACKED_SPRITE_SUGGESTION = 'packed detected sprites';

export function analyzeBackgroundFromImageData(data, width, height) {
  if (!data || !width || !height) return null;

  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 70000)));
  const edgeBand = clamp(Math.round(Math.min(width, height) * 0.055), 3, 28);
  const cornerBand = clamp(Math.round(Math.min(width, height) * 0.12), 8, 48);
  const buckets = new Map();
  let totalSamples = 0;
  let opaqueSamples = 0;
  let transparentSamples = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const onEdge = x < edgeBand || y < edgeBand || x >= width - edgeBand || y >= height - edgeBand;
      const inCorner =
        (x < cornerBand && y < cornerBand) ||
        (x >= width - cornerBand && y < cornerBand) ||
        (x < cornerBand && y >= height - cornerBand) ||
        (x >= width - cornerBand && y >= height - cornerBand);
      if (!onEdge && !inCorner) continue;

      const index = (y * width + x) * 4;
      totalSamples += 1;
      if (data[index + 3] < 40) {
        transparentSamples += 1;
        continue;
      }

      opaqueSamples += 1;
      const key = `${data[index] >> 4},${data[index + 1] >> 4},${data[index + 2] >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, weighted: 0, r: 0, g: 0, b: 0 };
      const weight = inCorner ? 3 : 1;
      bucket.count += 1;
      bucket.weighted += weight;
      bucket.r += data[index];
      bucket.g += data[index + 1];
      bucket.b += data[index + 2];
      buckets.set(key, bucket);
    }
  }

  if (!totalSamples) return null;
  if (!opaqueSamples || transparentSamples / totalSamples > 0.82) {
    return {
      kind: 'transparent',
      keyColor: null,
      ignoredColors: [],
      confidence: Math.round((transparentSamples / Math.max(1, totalSamples)) * 100),
      note: 'True transparency detected around the sheet edges.',
    };
  }

  const weightedTotal = [...buckets.values()].reduce((sum, current) => sum + current.weighted, 0);
  const candidates = [...buckets.values()]
    .map((bucket) => {
      const color = {
        r: Math.round(bucket.r / bucket.count),
        g: Math.round(bucket.g / bucket.count),
        b: Math.round(bucket.b / bucket.count),
      };
      return {
        ...bucket,
        color,
        hex: rgbToHex(color.r, color.g, color.b),
        ratio: bucket.count / Math.max(1, opaqueSamples),
        weightedRatio: bucket.weighted / Math.max(1, weightedTotal),
      };
    })
    .sort((a, b) => b.weightedRatio - a.weightedRatio);

  const best = candidates[0];
  if (!best || best.ratio < 0.08) return null;

  const second = candidates[1];
  const checkerLike = Boolean(
    second &&
    best.ratio + second.ratio > 0.52 &&
    colorSaturation(best.color) < 34 &&
    colorSaturation(second.color) < 34 &&
    Math.max(best.color.r, best.color.g, best.color.b, second.color.r, second.color.g, second.color.b) > 145 &&
    colorDistance(best.color, second.color) >= 12 &&
    colorDistance(best.color, second.color) <= 92
  );

  if (checkerLike) {
    return {
      kind: 'checker',
      keyColor: best.hex,
      ignoredColors: [best.hex, second.hex],
      confidence: Math.round(clamp((best.ratio + second.ratio) * 100, 0, 100)),
      note: 'Looks like a fake transparency checkerboard. Both checker colors will be ignored for detection.',
      candidates: candidates.slice(0, 4).map(({ hex, ratio }) => ({ hex, ratio })),
    };
  }

  return {
    kind: 'solid',
    keyColor: best.hex,
    ignoredColors: [best.hex],
    confidence: Math.round(clamp(best.ratio * 100, 0, 100)),
    note: 'Dominant edge/corner background color detected.',
    candidates: candidates.slice(0, 4).map(({ hex, ratio }) => ({ hex, ratio })),
  };
}

export function findVisibleComponentsInImageData(data, width, height, targetColor, tolerance = 0) {
  if (!data || !width || !height) return [];

  const totalPixels = width * height;
  const visible = new Uint8Array(totalPixels);
  const componentMask = new Uint8Array(totalPixels);
  const visited = new Uint8Array(totalPixels);
  const minPixels = Math.max(24, Math.floor(totalPixels * 0.00004));
  let visibleCount = 0;

  for (let index = 0; index < totalPixels; index += 1) {
    if (!isKeyOrTransparentPixel(data, index * 4, targetColor, tolerance)) {
      visible[index] = 1;
      visibleCount += 1;
    }
  }

  if (!visibleCount) return [];

  if (visibleCount / totalPixels > 0.65) {
    componentMask.set(visible);
  } else {
    const mergeRadius = clamp(Math.round(Math.max(width, height) / 160), 2, 8);
    for (let index = 0; index < totalPixels; index += 1) {
      if (!visible[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      const minY = Math.max(0, y - mergeRadius);
      const maxY = Math.min(height - 1, y + mergeRadius);
      const minX = Math.max(0, x - mergeRadius);
      const maxX = Math.min(width - 1, x + mergeRadius);
      for (let maskY = minY; maskY <= maxY; maskY += 1) {
        const rowStart = maskY * width;
        for (let maskX = minX; maskX <= maxX; maskX += 1) {
          componentMask[rowStart + maskX] = 1;
        }
      }
    }
  }

  const components = [];
  const stack = [];
  for (let index = 0; index < totalPixels; index += 1) {
    if (!componentMask[index] || visited[index]) continue;
    visited[index] = 1;
    stack.length = 0;
    stack.push(index);
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (stack.length) {
      const current = stack.pop();
      const x = current % width;
      const y = Math.floor(current / width);
      if (visible[current]) {
        pixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1,
      ];

      neighbors.forEach((neighbor) => {
        if (neighbor < 0 || visited[neighbor] || !componentMask[neighbor]) return;
        visited[neighbor] = 1;
        stack.push(neighbor);
      });
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    if (pixels >= minPixels && componentWidth >= 4 && componentHeight >= 4) {
      components.push({
        minX,
        minY,
        maxX,
        maxY,
        width: componentWidth,
        height: componentHeight,
        pixels,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      });
    }
  }

  return components.sort((a, b) => (a.centerY === b.centerY ? a.centerX - b.centerX : a.centerY - b.centerY));
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function clusterByAxis(items, axis, tolerance) {
  const clusters = [];
  [...items].sort((a, b) => a[axis] - b[axis]).forEach((item) => {
    const match = clusters.find((cluster) => Math.abs(cluster.mean - item[axis]) <= tolerance);
    if (match) {
      match.items.push(item);
      match.mean = match.items.reduce((sum, current) => sum + current[axis], 0) / match.items.length;
    } else {
      clusters.push({ mean: item[axis], items: [item] });
    }
  });
  return clusters;
}

export function choosePackedColumns(frameCount, preferredColumns = 1) {
  if (frameCount <= 1) return 1;
  const target = Math.sqrt(frameCount * 1.8);
  let best = Math.min(frameCount, Math.max(1, preferredColumns));
  let bestScore = Number.POSITIVE_INFINITY;
  for (let candidate = 1; candidate <= Math.min(frameCount, 16); candidate += 1) {
    const rowsNeeded = Math.ceil(frameCount / candidate);
    const emptyCells = candidate * rowsNeeded - frameCount;
    const factorPenalty = frameCount % candidate === 0 ? 0 : 1.5;
    const score = Math.abs(candidate - target) + emptyCells * 0.2 + factorPenalty;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function chooseDetectedFrameSize(
  components,
  {
    commonFrameSizes = COMMON_FRAME_SIZES,
    defaultFrame = DEFAULT_FRAME_SIZE,
    maxFrameSize = MAX_FRAME_SIZE,
  } = {}
) {
  if (!components.length) return defaultFrame;
  const maxDimension = Math.max(...components.map((component) => Math.max(component.width, component.height)));
  const padded = Math.ceil(maxDimension + Math.max(8, maxDimension * 0.18));
  return commonFrameSizes.find((size) => size >= padded) ?? Math.min(maxFrameSize, padded);
}

export function buildImportLayoutSuggestions(image, components, preferredColumns = 1) {
  if (!image || !components.length) return [];
  const medianWidth = median(components.map((component) => component.width));
  const medianHeight = median(components.map((component) => component.height));
  const rowsByCenter = clusterByAxis(components, 'centerY', Math.max(12, medianHeight * 0.75));
  const colsByCenter = clusterByAxis(components, 'centerX', Math.max(12, medianWidth * 0.75));
  const rowCount = Math.max(1, rowsByCenter.length);
  const colCount = Math.max(1, Math.max(...rowsByCenter.map((row) => row.items.length), colsByCenter.length));
  const suggestions = [];

  const addSuggestion = (kind, columnsValue, rowsValue, confidenceAdjust = 0) => {
    const frameW = Math.max(1, Math.round(image.width / columnsValue));
    const frameH = Math.max(1, Math.round(image.height / rowsValue));
    const cells = columnsValue * rowsValue;
    const occupancy = components.length / cells;
    const coverageScore = clamp(occupancy, 0, 1);
    const fitScore = clamp(1 - Math.abs(cells - components.length) / Math.max(cells, components.length, 1), 0, 1);
    const confidence = clamp(Math.round((coverageScore * 55 + fitScore * 35 + confidenceAdjust) * 100) / 100, 0, 100);
    suggestions.push({
      id: `${columnsValue}x${rowsValue}-${kind}`,
      kind,
      columns: columnsValue,
      rows: rowsValue,
      frameWidth: frameW,
      frameHeight: frameH,
      cells,
      confidence,
    });
  };

  addSuggestion('detected rows', colCount, rowCount, 10);

  const packedColumns = choosePackedColumns(components.length, preferredColumns);
  addSuggestion(PACKED_SPRITE_SUGGESTION, packedColumns, Math.ceil(components.length / packedColumns), 4);

  [2, 3, 4, 5, 6, 8].forEach((candidateColumns) => {
    if (candidateColumns > components.length) return;
    const candidateRows = Math.ceil(components.length / candidateColumns);
    if (candidateRows > 12) return;
    addSuggestion('common grid', candidateColumns, candidateRows, 0);
  });

  const unique = new Map();
  suggestions.forEach((suggestion) => {
    const key = `${suggestion.columns}x${suggestion.rows}`;
    const current = unique.get(key);
    if (!current || suggestion.confidence > current.confidence) unique.set(key, suggestion);
  });

  return [...unique.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}

export function analyzeImportImageData(data, width, height, { keyColor, keyTolerance = 0, preferredColumns = 1 } = {}) {
  if (!data || !width || !height) return null;
  const background = analyzeBackgroundFromImageData(data, width, height);
  const detectedKeyColor = background?.kind === 'transparent' ? null : background?.keyColor ?? keyColor;
  const ignoredColors = background?.kind === 'transparent'
    ? []
    : background?.ignoredColors?.length
      ? background.ignoredColors
      : [detectedKeyColor ?? keyColor];
  const components = findVisibleComponentsInImageData(data, width, height, ignoredColors, keyTolerance);
  const image = { width, height };
  const suggestions = buildImportLayoutSuggestions(image, components, preferredColumns);
  return {
    keyColor: detectedKeyColor,
    ignoredColors,
    background,
    detectedSprites: components.length,
    components,
    sourceWidth: width,
    sourceHeight: height,
    suggestions,
    confidence: suggestions[0]?.confidence ?? 0,
  };
}
