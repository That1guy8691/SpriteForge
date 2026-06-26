export function scoreSilhouetteFrames(frames) {
  const valid = frames.filter((frame) => frame.pixels > 0);
  if (!valid.length) {
    return { frames, validCount: 0, avgX: 0, avgY: 0, avgRadius: 0, maxWobble: 0, maxScaleDelta: 0, worstFrame: null };
  }

  const avgX = valid.reduce((sum, frame) => sum + frame.centerX, 0) / valid.length;
  const avgY = valid.reduce((sum, frame) => sum + frame.centerY, 0) / valid.length;
  const avgRadius = valid.reduce((sum, frame) => sum + frame.radius, 0) / valid.length;
  const scoredFrames = frames.map((frame) => {
    const wobble = frame.pixels ? Math.hypot(frame.centerX - avgX, frame.centerY - avgY) : 0;
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
  };
}
