function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function frameStabilizationPoint(frame) {
  return {
    x: finiteNumber(frame.weightedCenterX) ?? finiteNumber(frame.centerX) ?? 0,
    y: finiteNumber(frame.weightedCenterY) ?? finiteNumber(frame.centerY) ?? 0,
  };
}

export function frameSignatureDifference(frameA, frameB) {
  const signatureA = Array.isArray(frameA?.signature) ? frameA.signature : null;
  const signatureB = Array.isArray(frameB?.signature) ? frameB.signature : null;
  if (!signatureA || !signatureB || signatureA.length !== signatureB.length || !signatureA.length) return null;

  let total = 0;
  for (let index = 0; index < signatureA.length; index += 1) {
    total += Math.abs((signatureA[index] ?? 0) - (signatureB[index] ?? 0));
  }
  return total / signatureA.length;
}

export function analyzeFrameContinuity(frames) {
  const valid = frames.filter((frame) => frame.pixels > 0);
  if (valid.length < 2) {
    return {
      transitions: [],
      issues: [],
      typicalDifference: 0,
      minDifference: 0,
      maxDifference: 0,
      stutterCount: 0,
      jumpCount: 0,
    };
  }

  const shouldWrap = valid.length > 2;
  const transitionCount = shouldWrap ? valid.length : valid.length - 1;
  const transitions = [];
  for (let index = 0; index < transitionCount; index += 1) {
    const from = valid[index];
    const to = valid[(index + 1) % valid.length];
    const difference = frameSignatureDifference(from, to);
    if (!Number.isFinite(difference)) continue;
    transitions.push({
      from: from.frame,
      to: to.frame,
      difference,
      wrap: index === valid.length - 1,
    });
  }

  const differences = transitions.map((transition) => transition.difference);
  const typicalDifference = median(differences);
  const minDifference = differences.length ? Math.min(...differences) : 0;
  const maxDifference = differences.length ? Math.max(...differences) : 0;
  const issues = [];

  if (typicalDifference > 0) {
    const stutterThreshold = Math.max(typicalDifference * 0.42, 0.0025);
    const jumpThreshold = Math.max(typicalDifference * 1.9, 0.01);

    transitions.forEach((transition) => {
      const ratio = transition.difference / typicalDifference;
      if (transition.difference <= stutterThreshold) {
        issues.push({
          id: `stutter-${transition.from}-${transition.to}`,
          type: 'stutter',
          severity: transition.difference <= typicalDifference * 0.2 ? 'high' : 'medium',
          from: transition.from,
          to: transition.to,
          focusFrame: transition.to,
          difference: transition.difference,
          ratio,
          wrap: transition.wrap,
          label: 'Too similar',
          detail: `Only ${Math.round(ratio * 100)}% of the normal frame change`,
        });
      } else if (transition.difference >= jumpThreshold) {
        issues.push({
          id: `jump-${transition.from}-${transition.to}`,
          type: 'jump',
          severity: transition.difference >= typicalDifference * 2.6 ? 'high' : 'medium',
          from: transition.from,
          to: transition.to,
          focusFrame: transition.to,
          difference: transition.difference,
          ratio,
          wrap: transition.wrap,
          label: 'Large jump',
          detail: `${Math.round(ratio * 100)}% of the normal frame change`,
        });
      }
    });
  }

  return {
    transitions,
    issues,
    typicalDifference,
    minDifference,
    maxDifference,
    stutterCount: issues.filter((issue) => issue.type === 'stutter').length,
    jumpCount: issues.filter((issue) => issue.type === 'jump').length,
  };
}

export function scoreSilhouetteFrames(frames) {
  const valid = frames.filter((frame) => frame.pixels > 0);
  if (!valid.length) {
    return {
      frames,
      validCount: 0,
      avgX: 0,
      avgY: 0,
      avgRadius: 0,
      maxWobble: 0,
      maxScaleDelta: 0,
      worstFrame: null,
      continuity: analyzeFrameContinuity(frames),
    };
  }

  const avgX = valid.reduce((sum, frame) => sum + frameStabilizationPoint(frame).x, 0) / valid.length;
  const avgY = valid.reduce((sum, frame) => sum + frameStabilizationPoint(frame).y, 0) / valid.length;
  const avgRadius = valid.reduce((sum, frame) => sum + frame.radius, 0) / valid.length;
  const scoredFrames = frames.map((frame) => {
    const point = frameStabilizationPoint(frame);
    const wobble = frame.pixels ? Math.hypot(point.x - avgX, point.y - avgY) : 0;
    const scaleDelta = frame.pixels ? Math.abs(frame.radius - avgRadius) : 0;
    return { ...frame, wobble, scaleDelta, score: wobble + scaleDelta * 0.5 };
  });
  const worstFrame = scoredFrames.reduce((worst, frame) => (frame.score > worst.score ? frame : worst), scoredFrames[0]);
  return {
    frames: scoredFrames,
    validCount: valid.length,
    avgX,
    avgY,
    avgRadius,
    maxWobble: Math.max(...scoredFrames.map((frame) => frame.wobble)),
    maxScaleDelta: Math.max(...scoredFrames.map((frame) => frame.scaleDelta)),
    worstFrame,
    continuity: analyzeFrameContinuity(scoredFrames),
  };
}

export function buildPivotStabilizationOffsets(frames, { targetX, targetY } = {}) {
  const valid = frames.filter((frame) => frame.pixels > 0);
  if (!valid.length) {
    return { offsets: {}, validCount: 0, maxShift: 0, averageShift: 0, targetX: targetX ?? 0, targetY: targetY ?? 0 };
  }

  const fallbackX = valid.reduce((sum, frame) => sum + frameStabilizationPoint(frame).x, 0) / valid.length;
  const fallbackY = valid.reduce((sum, frame) => sum + frameStabilizationPoint(frame).y, 0) / valid.length;
  const anchorX = Number.isFinite(targetX) ? targetX : fallbackX;
  const anchorY = Number.isFinite(targetY) ? targetY : fallbackY;
  const offsets = {};
  let totalShift = 0;
  let maxShift = 0;

  valid.forEach((frame) => {
    const point = frameStabilizationPoint(frame);
    const x = Math.round(anchorX - point.x);
    const y = Math.round(anchorY - point.y);
    const magnitude = Math.hypot(x, y);
    offsets[frame.frame] = { x, y };
    totalShift += magnitude;
    maxShift = Math.max(maxShift, magnitude);
  });

  return {
    offsets,
    validCount: valid.length,
    maxShift,
    averageShift: totalShift / valid.length,
    targetX: anchorX,
    targetY: anchorY,
  };
}
