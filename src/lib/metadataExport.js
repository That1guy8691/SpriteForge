export const EXPORT_PRESETS = [
  { id: 'spriteforge', label: 'SpriteForge JSON', filenameSuffix: 'spriteforge' },
  { id: 'godot', label: 'Godot SpriteFrames', filenameSuffix: 'godot' },
  { id: 'unity', label: 'Unity Multiple Sprites', filenameSuffix: 'unity' },
  { id: 'aseprite', label: 'Aseprite JSON', filenameSuffix: 'aseprite' },
];

function sanitizeName(value, fallback = 'spriteforge') {
  return String(value || fallback)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || fallback;
}

function animationFrames(animation) {
  const start = Math.max(0, Number(animation.start) || 0);
  const end = Math.max(start, Number(animation.end) || start);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function frameRegion(frame, context) {
  const width = context.frame.width;
  const height = context.frame.height;
  return {
    x: (frame % context.grid.columns) * width,
    y: Math.floor(frame / context.grid.columns) * height,
    width,
    height,
  };
}

function spriteName(context, frame) {
  return `${sanitizeName(context.source.name)}_${String(frame).padStart(3, '0')}`;
}

function normalizeAnimations(animations) {
  return animations.map((animation) => ({
    name: animation.name,
    start: animation.start,
    end: animation.end,
    frames: animationFrames(animation),
    fps: animation.fps,
    loop: Boolean(animation.loop),
  }));
}

function buildBasePayload(context) {
  return {
    app: 'SpriteForge Studio',
    source: context.source.name ?? 'unknown',
    frame: {
      width: context.frame.width,
      height: context.frame.height,
      padding: context.frame.padding,
    },
    exportFrame: {
      normalized: context.exportFrame.normalized,
      width: context.exportFrame.width,
      height: context.exportFrame.height,
    },
    backgroundRemoval: context.backgroundRemoval,
    grid: context.grid,
    pivot: context.pivot,
    offsets: context.offsets,
    animations: normalizeAnimations(context.animations),
    engineHints: {
      godot: 'Use frame width/height for SpriteFrames or AnimatedSprite2D. Pivot maps to centered offset during import.',
      unity: 'Use Sprite Mode Multiple, Pixels Per Unit matching frame size, then slice by grid cell size.',
    },
  };
}

function buildGodotPayload(context) {
  return {
    app: 'SpriteForge Studio',
    preset: 'godot-spriteframes',
    source: context.source.name ?? 'unknown',
    texture: context.source.name ?? 'sprite_sheet.png',
    import: {
      resourceType: 'SpriteFrames',
      nodeType: 'AnimatedSprite2D',
      frameSize: { width: context.frame.width, height: context.frame.height },
      grid: context.grid,
      centered: true,
      pivotPixels: context.pivot,
    },
    animations: normalizeAnimations(context.animations).map((animation) => ({
      name: animation.name,
      speedFps: animation.fps,
      loop: animation.loop,
      frames: animation.frames.map((frame) => ({
        index: frame,
        region: frameRegion(frame, context),
        offset: context.offsets?.[frame] ?? { x: 0, y: 0 },
      })),
    })),
  };
}

function buildUnityPayload(context) {
  const allFrames = Array.from({ length: context.grid.totalFrames }, (_, frame) => frame);
  return {
    app: 'SpriteForge Studio',
    preset: 'unity-multiple-sprites',
    source: context.source.name ?? 'unknown',
    texture: context.source.name ?? 'sprite_sheet.png',
    importSettings: {
      spriteMode: 'Multiple',
      pixelsPerUnit: context.frame.width,
      filterMode: 'Point',
      compression: 'None',
      meshType: 'Full Rect',
    },
    slicing: {
      type: 'grid',
      cellSize: { width: context.frame.width, height: context.frame.height },
      columns: context.grid.columns,
      rows: context.grid.rows,
      pivotPixels: context.pivot,
      pivotNormalized: {
        x: Number((context.pivot.x / Math.max(1, context.frame.width)).toFixed(4)),
        y: Number((context.pivot.y / Math.max(1, context.frame.height)).toFixed(4)),
      },
    },
    sprites: allFrames.map((frame) => ({
      name: spriteName(context, frame),
      frame,
      rect: frameRegion(frame, context),
      pivotPixels: context.pivot,
      offset: context.offsets?.[frame] ?? { x: 0, y: 0 },
    })),
    animationClips: normalizeAnimations(context.animations).map((animation) => ({
      name: animation.name,
      frameRate: animation.fps,
      loopTime: animation.loop,
      sprites: animation.frames.map((frame) => spriteName(context, frame)),
    })),
  };
}

function durationForFrame(frame, animations) {
  const match = animations.find((animation) => animationFrames(animation).includes(frame));
  return Math.round(1000 / Math.max(1, match?.fps ?? 8));
}

function buildAsepritePayload(context) {
  const allFrames = Array.from({ length: context.grid.totalFrames }, (_, frame) => frame);
  const frames = Object.fromEntries(allFrames.map((frame) => {
    const name = `${spriteName(context, frame)}.png`;
    const region = frameRegion(frame, context);
    return [name, {
      frame: { x: region.x, y: region.y, w: region.width, h: region.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: region.width, h: region.height },
      sourceSize: { w: region.width, h: region.height },
      duration: durationForFrame(frame, context.animations),
    }];
  }));

  return {
    frames,
    meta: {
      app: 'SpriteForge Studio',
      version: '1',
      image: context.source.name ?? 'sprite_sheet.png',
      format: 'RGBA8888',
      size: {
        w: context.grid.columns * context.frame.width,
        h: context.grid.rows * context.frame.height,
      },
      scale: '1',
      frameTags: normalizeAnimations(context.animations).map((animation) => ({
        name: animation.name,
        from: animation.start,
        to: animation.end,
        direction: 'forward',
      })),
      slices: [{
        name: 'pivot',
        color: '#0e8992',
        keys: [{
          frame: 0,
          bounds: { x: context.pivot.x, y: context.pivot.y, w: 1, h: 1 },
        }],
      }],
    },
  };
}

export function createMetadataContext({
  source,
  frameWidth,
  frameHeight,
  padding,
  normalizeExport,
  exportFrameWidth,
  exportFrameHeight,
  removeKeyBackground,
  keyColor,
  keyTolerance,
  columns,
  rows,
  totalFrames,
  pivot,
  offsets,
  animations,
}) {
  return {
    source: { name: source?.name ?? 'unknown' },
    frame: { width: frameWidth, height: frameHeight, padding },
    exportFrame: {
      normalized: normalizeExport,
      width: normalizeExport ? exportFrameWidth : frameWidth,
      height: normalizeExport ? exportFrameHeight : frameHeight,
    },
    backgroundRemoval: {
      enabled: removeKeyBackground,
      keyColor,
      tolerance: keyTolerance,
    },
    grid: { columns, rows, totalFrames },
    pivot,
    offsets,
    animations,
  };
}

export function buildMetadataExport(context, presetId = 'spriteforge') {
  const preset = EXPORT_PRESETS.find((item) => item.id === presetId) ?? EXPORT_PRESETS[0];
  const payloadByPreset = {
    spriteforge: buildBasePayload,
    godot: buildGodotPayload,
    unity: buildUnityPayload,
    aseprite: buildAsepritePayload,
  };
  const buildPayload = payloadByPreset[preset.id] ?? buildBasePayload;
  const baseName = sanitizeName(context.source?.name);
  return {
    preset,
    filename: `${baseName}_${preset.filenameSuffix}.json`,
    payload: buildPayload(context),
  };
}
