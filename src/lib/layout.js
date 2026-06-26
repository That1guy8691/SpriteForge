import { clamp } from './color.js';
import { PACKED_SPRITE_SUGGESTION } from './importAnalysis.js';

export function clampAnimationRanges(animationList, frameCount) {
  const maxFrame = Math.max(0, frameCount - 1);
  let changed = false;
  const nextAnimations = animationList.map((animation) => {
    const start = clamp(Number(animation.start) || 0, 0, maxFrame);
    const end = clamp(Number(animation.end) || start, start, maxFrame);
    if (start === animation.start && end === animation.end) return animation;
    changed = true;
    return { ...animation, start, end };
  });
  return changed ? nextAnimations : animationList;
}

export function animationIdFromName(name, index) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'range'}_${index + 1}`;
}

export function isPackedLayoutSuggestion(suggestion) {
  return suggestion?.kind === PACKED_SPRITE_SUGGESTION;
}

export function isSliceableLayoutSuggestion(suggestion) {
  return Boolean(suggestion) && !isPackedLayoutSuggestion(suggestion);
}

export function getBestSliceableSuggestion(suggestions = []) {
  return suggestions.find(isSliceableLayoutSuggestion) ?? null;
}

export function getPackedSuggestion(suggestions = []) {
  return suggestions.find(isPackedLayoutSuggestion) ?? null;
}

export function singleFrameAnimation(name = 'unsliced sheet') {
  return [{
    id: animationIdFromName(name, 0),
    name,
    start: 0,
    end: 0,
    fps: 8,
    loop: true,
  }];
}

export function inferAnimationsForLayout(suggestion, detectedSprites, fallbackAnimations) {
  if (!suggestion) return fallbackAnimations;
  const cellCount = Math.max(1, suggestion.columns * suggestion.rows);
  const frameCount = clamp(Number(detectedSprites) || cellCount, 1, cellCount);
  const maxFrame = frameCount - 1;

  if (suggestion.kind === 'detected rows' && suggestion.rows > 1 && suggestion.columns > 1) {
    return Array.from({ length: suggestion.rows }, (_, rowIndex) => {
      const start = rowIndex * suggestion.columns;
      const end = Math.min(start + suggestion.columns - 1, maxFrame);
      if (start > maxFrame) return null;
      const name = `row ${rowIndex + 1}`;
      return {
        id: animationIdFromName(name, rowIndex),
        name,
        start,
        end,
        fps: 8,
        loop: true,
      };
    }).filter(Boolean);
  }

  return [{
    id: 'detected_frames_1',
    name: 'detected frames',
    start: 0,
    end: maxFrame,
    fps: 8,
    loop: true,
  }];
}
