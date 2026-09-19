export function swapFrameOffsets(offsets = {}, frameA, frameB) {
  if (frameA === frameB) return offsets;

  const next = { ...offsets };
  const offsetA = offsets[frameA];
  const offsetB = offsets[frameB];

  if (offsetB) {
    next[frameA] = offsetB;
  } else {
    delete next[frameA];
  }

  if (offsetA) {
    next[frameB] = offsetA;
  } else {
    delete next[frameB];
  }

  return next;
}
