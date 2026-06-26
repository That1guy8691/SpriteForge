import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  BookOpen,
  Check,
  ClipboardCopy,
  Download,
  FileJson,
  FolderOpen,
  Grid3X3,
  ImagePlus,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  SkipBack,
  SkipForward,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  animationOptions,
  assetGuideFieldLabels,
  assetGuideFramePurposeOptions,
  assetGuidePromptChoices,
  assetGuides,
  createPromptConfig,
  defaultPromptChoices,
  guideOptions,
  presetPromptChoices,
  presetStyleDetailChoices,
  stylePresets,
} from './data/promptData';
import {
  clamp,
  isKeyOrTransparentPixel as isKeyOrTransparentPixelData,
  normalizeHexColor,
  rgbToHex,
} from './lib/color.js';
import {
  analyzeBackgroundFromImageData,
  analyzeImportImageData,
  chooseDetectedFrameSize,
  choosePackedColumns,
  findVisibleComponentsInImageData,
} from './lib/importAnalysis.js';
import {
  clampAnimationRanges,
  getBestSliceableSuggestion,
  getPackedSuggestion,
  inferAnimationsForLayout as buildAnimationsForLayout,
  isPackedLayoutSuggestion,
  singleFrameAnimation,
} from './lib/layout.js';
import { removeColorFromCanvas as clearColorFromCanvas } from './lib/exporters.js';
import {
  createProjectBundle,
  loadStoredProjects,
  parseProjectBundleText,
  saveStoredProjects,
} from './lib/projectStorage.js';
import { scoreSilhouetteFrames } from './lib/rotationAnalysis.js';

const DEFAULT_FRAME = 32;
const MAX_FRAME_SIZE = 2048;
const COMMON_FRAME_SIZES = [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];

const initialAnimations = [
  { id: 'idle', name: 'idle', start: 0, end: 3, fps: 6, loop: true },
  { id: 'walk', name: 'walk', start: 4, end: 11, fps: 10, loop: true },
  { id: 'attack', name: 'attack', start: 12, end: 17, fps: 12, loop: false },
  { id: 'hurt', name: 'hurt', start: 18, end: 19, fps: 8, loop: false },
];

function inferAnimationsForLayout(suggestion, detectedSprites) {
  return buildAnimationsForLayout(suggestion, detectedSprites, initialAnimations);
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function createDemoSheet() {
  const frame = DEFAULT_FRAME;
  const cols = 8;
  const rows = 3;
  const canvas = document.createElement('canvas');
  canvas.width = cols * frame;
  canvas.height = rows * frame;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const palette = ['#18202a', '#2b3f55', '#126c72', '#43a6a5', '#70422b', '#a76b43', '#e6b77e', '#f6d8a9', '#d9edf0', '#f0a83b'];

  for (let i = 0; i < cols * rows; i += 1) {
    const ox = (i % cols) * frame;
    const oy = Math.floor(i / cols) * frame;
    const stride = i % 4;
    const attack = i >= 12 && i <= 17;
    const hurt = i >= 18 && i <= 19;
    const bob = stride === 1 || stride === 3 ? -1 : 0;
    const arm = attack ? Math.min(5, i - 11) : stride - 1;
    const legA = stride === 1 ? -2 : stride === 3 ? 2 : 0;
    const legB = -legA;
    const faceX = hurt ? -1 : attack ? 1 : 0;

    ctx.fillStyle = palette[0];
    ctx.fillRect(ox + 13, oy + 7 + bob, 8, 8);
    ctx.fillRect(ox + 11, oy + 15 + bob, 12, 10);
    ctx.fillRect(ox + 9 + legA, oy + 25, 6, 4);
    ctx.fillRect(ox + 18 + legB, oy + 25, 6, 4);

    ctx.fillStyle = palette[7];
    ctx.fillRect(ox + 14, oy + 8 + bob, 6, 6);
    ctx.fillRect(ox + 13, oy + 13 + bob, 8, 2);

    ctx.fillStyle = palette[4];
    ctx.fillRect(ox + 12, oy + 5 + bob, 10, 5);
    ctx.fillRect(ox + 11, oy + 8 + bob, 3, 5);
    ctx.fillRect(ox + 20, oy + 8 + bob, 2, 4);

    ctx.fillStyle = palette[2];
    ctx.fillRect(ox + 12, oy + 16 + bob, 10, 7);
    ctx.fillRect(ox + 10, oy + 18 + bob, 3, 5);
    ctx.fillRect(ox + 21, oy + 18 + bob, 3, 5);

    ctx.fillStyle = palette[8];
    ctx.fillRect(ox + 16 + faceX, oy + 11 + bob, 1, 1);
    ctx.fillRect(ox + 20, oy + 16 + bob, 3, 4);

    ctx.fillStyle = palette[9];
    ctx.fillRect(ox + 10 + legA, oy + 25, 4, 2);
    ctx.fillRect(ox + 19 + legB, oy + 25, 4, 2);

    ctx.fillStyle = palette[1];
    ctx.fillRect(ox + 23 + arm, oy + 18 + bob, 4, 2);
    ctx.fillRect(ox + 25 + arm, oy + 17 + bob, 2, 1);

    if (attack) {
      ctx.fillStyle = '#d9fbff';
      ctx.fillRect(ox + 26 + arm, oy + 15 + bob, 4, 1);
      ctx.fillRect(ox + 29 + arm, oy + 14 + bob, 1, 3);
      ctx.fillStyle = '#6ed4df';
      ctx.fillRect(ox + 25, oy + 22, 5, 1);
      ctx.fillRect(ox + 27, oy + 23, 3, 1);
    }
  }

  return {
    name: 'demo_knight_32.png',
    url: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve({ name: file.name, url: reader.result, width: image.width, height: image.height });
      image.onerror = () => reject(new Error('Could not load image.'));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createProject(name = 'SpriteForge Project') {
  const now = new Date().toISOString();
  return {
    id: makeId('project'),
    name,
    createdAt: now,
    updatedAt: now,
    assets: [],
  };
}

function buildBatchLabels(assetGuideId, selectedPurposes) {
  if (assetGuideId === 'vehicles') {
    const wants16 = selectedPurposes.some((item) => item.includes('16'));
    const wants8 = selectedPurposes.some((item) => item.includes('8'));
    const labels = wants16
      ? ['rotation directions 0-7', 'rotation directions 8-15']
      : wants8
        ? ['8-direction rotation frames']
        : ['core direction frames'];
    const stateLabels = selectedPurposes
      .filter((item) => !item.includes('direction rotation'))
      .map((item) => `${item} vehicle state frames`);
    return [...labels, ...stateLabels];
  }

  if (assetGuideId === 'tilesets') {
    return [
      'base fill tiles and simple variations',
      'edge, outer corner, and inner corner tiles',
      'transition tiles and special terrain edges',
      'doors, decorations, and optional animated tiles',
    ];
  }

  if (assetGuideId === 'gui-kit') {
    return [
      'panel, border, corner, and divider pieces',
      'button states: normal, hover, pressed, disabled, selected',
      'slots, tabs, toggles, bars, and inventory UI pieces',
      'HUD strips, dialogue boxes, and reusable control accents',
    ];
  }

  if (assetGuideId === 'icons') {
    return [
      'base inventory icon atlas',
      'equipped, highlighted, disabled, and cooldown variants',
      'rarity and status-effect icon variants',
    ];
  }

  if (assetGuideId === 'vfx') {
    return [
      'anticipation and spawn frames',
      'charge, impact, and burst frames',
      'trail, dissipate, smoke, and fade frames',
    ];
  }

  if (assetGuideId === 'portraits') {
    return selectedPurposes.map((purpose) => `${purpose} portrait expression`);
  }

  if (assetGuideId === 'props-items') {
    return [
      'small prop and pickup objects',
      'medium interactable prop states',
      'large objects, broken states, and resource variants',
    ];
  }

  return selectedPurposes.map((purpose) => `${purpose} animation row only`);
}

function App() {
  const [source, setSource] = useState(null);
  const [frameWidth, setFrameWidth] = useState(DEFAULT_FRAME);
  const [frameHeight, setFrameHeight] = useState(DEFAULT_FRAME);
  const [columns, setColumns] = useState(8);
  const [rows, setRows] = useState(3);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [selectedAnimationId, setSelectedAnimationId] = useState('walk');
  const [animations, setAnimations] = useState(initialAnimations);
  const [isPlaying, setIsPlaying] = useState(true);
  const [zoom, setZoom] = useState(2);
  const [padding, setPadding] = useState(0);
  const [normalizeExport, setNormalizeExport] = useState(false);
  const [exportFrameWidth, setExportFrameWidth] = useState(DEFAULT_FRAME);
  const [exportFrameHeight, setExportFrameHeight] = useState(DEFAULT_FRAME);
  const [removeKeyBackground, setRemoveKeyBackground] = useState(true);
  const [keyColor, setKeyColor] = useState('#ff00ff');
  const [keyTolerance, setKeyTolerance] = useState(12);
  const [pivot, setPivot] = useState({ x: 16, y: 28 });
  const [offsets, setOffsets] = useState({});
  const [status, setStatus] = useState('Ready');
  const [guideOpen, setGuideOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [promptConfig, setPromptConfig] = useState(() => createPromptConfig());
  const [formatManualOpen, setFormatManualOpen] = useState(false);
  const [activeAssetGuideId, setActiveAssetGuideId] = useState(assetGuides[0].id);
  const [activeTool, setActiveTool] = useState('studio');
  const [rotationStats, setRotationStats] = useState(null);
  const [filledSheet, setFilledSheet] = useState(null);
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [showDetectionOverlay, setShowDetectionOverlay] = useState(true);
  const [projects, setProjects] = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectNameDraft, setProjectNameDraft] = useState('SpriteForge Project');
  const [activeChainStepId, setActiveChainStepId] = useState('design-lock');
  const imageRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const sourceUrlRef = useRef(null);

  const activePromptChoices = useMemo(() => ({
    ...defaultPromptChoices,
    ...(presetStyleDetailChoices[promptConfig.presetId] ?? {}),
    ...(presetPromptChoices[promptConfig.presetId] ?? {}),
    ...(assetGuidePromptChoices[activeAssetGuideId] ?? {}),
  }), [promptConfig.presetId, activeAssetGuideId]);

  const activeAssetGuide = useMemo(
    () => assetGuides.find((guide) => guide.id === activeAssetGuideId) ?? assetGuides[0],
    [activeAssetGuideId]
  );

  const activeBuilderLabels = assetGuideFieldLabels[activeAssetGuideId] ?? assetGuideFieldLabels['sprite-sheet'];
  const showSpriteStylePresets = ['sprite-sheet', 'enemy-boss', 'portraits'].includes(activeAssetGuideId);
  const activeFramePurpose = assetGuideFramePurposeOptions[activeAssetGuideId] ?? assetGuideFramePurposeOptions['sprite-sheet'];
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const promptMetrics = useMemo(() => {
    const framePixels = Math.max(1, Number(promptConfig.frameSize) || 64);
    const columnCount = Math.max(1, Number(promptConfig.columns) || 1);
    const rowCount = Math.max(1, Number(promptConfig.rows) || 1);
    const totalFrames = columnCount * rowCount;
    const canvasWidth = framePixels * columnCount;
    const canvasHeight = framePixels * rowCount;
    const selectedFramePurposes = activeFramePurpose.options.filter((option) => promptConfig.animations[option]);
    const risk = totalFrames > 24 || canvasWidth > 512 || canvasHeight > 512 ? 'risky' : totalFrames > 16 ? 'moderate' : 'good';
    return {
      framePixels,
      columnCount,
      rowCount,
      totalFrames,
      canvasWidth,
      canvasHeight,
      selectedFramePurposes,
      risk,
    };
  }, [promptConfig, activeFramePurpose]);

  const guidePrompt = useMemo(() => {
    const selectedRules = guideOptions.filter((option) => promptConfig.options[option.id]).map((option) => option.label);
    const frameSize = promptConfig.frameSize || '64';
    const columns = String(promptMetrics.columnCount);
    const rows = String(promptMetrics.rowCount);
    const normalizedKeyColor = normalizeHexColor(promptConfig.keyColor);
    const backgroundInstructions = promptConfig.backgroundMode === 'transparent'
      ? `- Background: true alpha transparency if the tool supports it.
- Do not draw a checkerboard background. Transparent means actual alpha transparency.`
      : `- Background: single flat solid key color ${normalizedKeyColor}.
- Use exactly ${normalizedKeyColor} for every background pixel.
- Do not use ${normalizedKeyColor} anywhere inside the asset, outline, shadow, VFX, UI pieces, tiles, props, equipment, or materials.
- Do not draw a checkerboard background.
- Do not add gradients, texture, shadows, or anti-aliasing to the background.`;

    return `Create a game-ready 2D asset sheet that SpriteForge can slice cleanly.

Asset:
- Asset type: ${activeAssetGuide.name}
- Subject / set: ${promptConfig.characterType || '[asset subject or set]'}
- Game / use: ${promptConfig.gameGenre || '[game genre or use]'}
- Role / purpose: ${promptConfig.moodRole || '[role or purpose]'}
- Main colors / materials: ${promptConfig.colors || '[main colors or materials]'}
- View / layout: ${promptConfig.cameraAngle || '[view or layout]'}
- Art style: ${promptConfig.artStyle || '[art style]'}
- Proportions / spacing: ${promptConfig.proportions || '[proportions or spacing]'}
- Outline: ${promptConfig.outlineStyle || '[outline style]'}
- Shading: ${promptConfig.shadingStyle || '[shading style]'}
- Detail level: ${promptConfig.detailLevel || '[detail level]'}
- Lighting: ${promptConfig.lighting || '[lighting]'}

Sheet format:
- Target output: ${activeAssetGuide.target}.
- One complete PNG image sheet.
- Cell / frame size: ${frameSize}x${frameSize} pixels.
- Grid: ${columns} columns x ${rows} rows.
- Final canvas size: exactly ${promptMetrics.canvasWidth}x${promptMetrics.canvasHeight} pixels.
- Total cells / frames: ${promptMetrics.totalFrames}.
- Read order: left to right, top to bottom.
- Do not upscale the final sheet. Do not return a larger preview canvas.
${backgroundInstructions}

Frame / variant needs:
- Include these ${activeFramePurpose.promptLabel}: ${promptMetrics.selectedFramePurposes.length ? promptMetrics.selectedFramePurposes.join(', ') : activeFramePurpose.defaultSelected.join(', ')}.
- ${activeFramePurpose.rowHint}
- ${activeFramePurpose.timingHint}

Asset-specific requirements:
- ${activeAssetGuide.prompt}
- Avoid: ${activeAssetGuide.avoid}.

Rules:
${selectedRules.map((rule) => `- ${rule}.`).join('\n')}
- Do not create separate images. Do not make a mockup. Do not add a background scene.
- Keep all frames or pieces aligned so the asset does not jitter, drift, or shift when used.

Final output: one PNG image sheet only.`;
  }, [activeAssetGuide, promptConfig, promptMetrics, activeFramePurpose]);

  const assetGuidePrompt = useMemo(() => {
    const normalizedKeyColor = normalizeHexColor(promptConfig.keyColor);
    return `Create game-ready 2D art for this asset type.

Asset type: ${activeAssetGuide.name}
Best for: ${activeAssetGuide.bestFor}
Target output: ${activeAssetGuide.target}
Format: ${activeAssetGuide.format}

Art direction:
- Game genre: ${promptConfig.gameGenre || '[game genre]'}
- Style: ${promptConfig.artStyle || '[art style]'}
- Main colors: ${promptConfig.colors || '[main colors]'}
- Outline: ${promptConfig.outlineStyle || '[outline style]'}
- Shading: ${promptConfig.shadingStyle || '[shading style]'}
- Lighting: ${promptConfig.lighting || '[lighting]'}

Frame / variant plan:
- Include these ${activeFramePurpose.promptLabel}: ${promptMetrics.selectedFramePurposes.length ? promptMetrics.selectedFramePurposes.join(', ') : activeFramePurpose.defaultSelected.join(', ')}.
- ${activeFramePurpose.rowHint}
- ${activeFramePurpose.timingHint}

Production rules:
- Create one usable asset sheet, not a mockup or concept page.
- Use a transparent background if supported.
- If transparency fails, use one flat key color background: ${normalizedKeyColor}.
- Keep all pieces separated with enough padding for slicing.
- Keep scale, perspective, palette, and lighting consistent across the set.
- No labels, captions, watermark, UI explanation text, or background scene. For UI kits, use empty text areas instead of baked text.
- Avoid: ${activeAssetGuide.avoid}.

Specific instructions:
${activeAssetGuide.prompt}

Checklist:
${activeAssetGuide.rules.map((rule) => `- ${rule}`).join('\n')}

Final output: one PNG image sheet only.`;
  }, [activeAssetGuide, activeFramePurpose, promptConfig, promptMetrics.selectedFramePurposes]);

  const promptChainSteps = useMemo(() => {
    const normalizedKeyColor = normalizeHexColor(promptConfig.keyColor);
    const selectedPurposes = promptMetrics.selectedFramePurposes.length
      ? promptMetrics.selectedFramePurposes
      : activeFramePurpose.defaultSelected;
    const styleDetails = [
      promptConfig.artStyle,
      promptConfig.proportions,
      promptConfig.outlineStyle,
      promptConfig.shadingStyle,
      promptConfig.detailLevel,
      promptConfig.lighting,
    ].filter(Boolean).join('; ');
    const backgroundRule = promptConfig.backgroundMode === 'key'
      ? `Use one flat key-color background: ${normalizedKeyColor}. Do not use that color inside the asset.`
      : 'Use true alpha transparency. Do not draw a checkerboard background.';
    const assetBrief = [
      `Asset type: ${activeAssetGuide.name}`,
      `Subject: ${promptConfig.characterType || '[asset subject]'}`,
      `Game: ${promptConfig.gameGenre || '[game genre]'}`,
      `Role: ${promptConfig.moodRole || '[gameplay role]'}`,
      `Colors/materials: ${promptConfig.colors || '[colors and materials]'}`,
      `Camera/view: ${promptConfig.cameraAngle || '[camera angle]'}`,
      `Style details: ${styleDetails || '[style details]'}`,
    ].join('\n');

    const batchLabels = buildBatchLabels(activeAssetGuide.id, selectedPurposes);
    const batchColumns = Math.min(4, Math.max(1, promptMetrics.columnCount));
    const batchRows = activeAssetGuide.id === 'vehicles' ? 2 : 1;
    const batchFrameCount = batchColumns * batchRows;
    const batchSteps = batchLabels.slice(0, 6).map((label, index) => ({
      id: `batch-${index + 1}`,
      title: `Batch ${index + 1}`,
      summary: label,
      action: 'Generate this smaller sheet',
      prompt: `Use the approved locked reference image and style spec from the previous steps.

Create only this batch: ${label}.

${assetBrief}

Batch format:
- One PNG sheet only.
- Cell / frame size: ${promptConfig.frameSize}x${promptConfig.frameSize} pixels.
- Grid: ${batchColumns} columns x ${batchRows} rows.
- Total cells / frames in this batch: ${batchFrameCount}.
- Read order: left to right, top to bottom.
- ${backgroundRule}

Consistency rules:
- Same design, same scale, same pivot or anchor point, same palette, same outline, same lighting.
- Do not redesign the asset between frames.
- Keep every frame centered and padded.
- No labels, mockup screens, background scenes, or extra unrelated assets.

Final output: this batch sheet only.`,
    }));

    return [
      {
        id: 'design-lock',
        title: '1. Design Lock',
        summary: 'Make one approved reference before asking for sheets.',
        action: 'Create the reference',
        prompt: `Create one clean reference image for a game asset that will later become an asset sheet.

${assetBrief}

Output rules:
- Create one centered reference asset or representative style sample, not a full sheet yet.
- Use the final materials, colors, proportions, and style exactly.
- Make the silhouette, component shape, or tile/readability target clear at game size.
- ${backgroundRule}
- No labels, mockup screen, background scene, or multiple unrelated variants.

Final output: one reference PNG only.`,
      },
      {
        id: 'style-spec',
        title: '2. Style Spec',
        summary: 'Turn the approved reference into a consistency checklist.',
        action: 'Lock the rules',
        prompt: `Analyze the approved reference image and write a concise asset production spec.

The spec must lock:
- silhouette and proportions
- exact color/material language
- outline style
- shading style
- lighting direction
- camera/view angle
- pivot, anchor, or center point
- details that must never change between cells, states, frames, or pieces

Target SpriteForge format:
- Asset type: ${activeAssetGuide.name}
- Final cell/frame size: ${promptConfig.frameSize}x${promptConfig.frameSize} pixels
- Intended final grid: ${promptMetrics.columnCount} columns x ${promptMetrics.rowCount} rows
- Intended final canvas: ${promptMetrics.canvasWidth}x${promptMetrics.canvasHeight} pixels
- Needed groups: ${selectedPurposes.join(', ')}

Keep the spec short enough to paste into every follow-up image prompt.`,
      },
      {
        id: 'batch-plan',
        title: '3. Batch Plan',
        summary: 'Generate smaller sheets instead of one huge page.',
        action: 'Plan the batches',
        prompt: `Use this batch plan to avoid model drift from oversized sprite sheets.

Final target:
- ${activeAssetGuide.name}
- ${promptMetrics.totalFrames} total final frames
- ${promptConfig.frameSize}x${promptConfig.frameSize}px frames
- ${promptMetrics.columnCount}x${promptMetrics.rowCount} final grid

Generate these smaller batches:
${batchLabels.map((label, index) => `${index + 1}. ${label}`).join('\n')}

After each batch, import it into SpriteForge, remove key color if needed, auto-detect layout, center or anchor-check the cells, then save the cleaned batch into the project library.`,
      },
      ...batchSteps,
      {
        id: 'assemble',
        title: 'Final Assembly',
        summary: 'Clean each batch, then assemble the final sheet in SpriteForge.',
        action: 'Finish in SpriteForge',
        prompt: `SpriteForge assembly checklist:

1. Import each generated batch.
2. Use Import Analysis to detect the batch grid.
3. Remove the flat key color ${normalizedKeyColor} if used.
4. Normalize every cell or frame to ${promptConfig.frameSize}x${promptConfig.frameSize}px.
5. Keep the same pivot or anchor point across every imported batch.
6. Save each cleaned batch into the active project.
7. Assemble/export the final ${promptMetrics.columnCount}x${promptMetrics.rowCount} sheet.
8. Export JSON metadata for engine import.

Reject and regenerate any batch where the asset changes proportions, scale, view angle, color identity, or pivot/anchor point.`,
      },
    ];
  }, [activeAssetGuide, activeFramePurpose, promptConfig, promptMetrics]);

  const activeChainStep = useMemo(
    () => promptChainSteps.find((step) => step.id === activeChainStepId) ?? promptChainSteps[0],
    [promptChainSteps, activeChainStepId]
  );

  useEffect(() => {
    setSource(createDemoSheet());
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadStoredProjects()
      .then((storedProjects) => {
        if (cancelled) return;
        setProjects(storedProjects);
        setProjectsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProjects([]);
        setProjectsLoaded(true);
        setStatus('Project library storage could not be loaded');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectsLoaded) return;
    saveStoredProjects(projects).catch(() => {
      setStatus('Project library storage could not be saved');
    });
  }, [projects, projectsLoaded]);

  useEffect(() => {
    if (activeProjectId) return;
    if (projects[0]) {
      setActiveProjectId(projects[0].id);
      setProjectNameDraft(projects[0].name);
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (!activeProject) return;
    setProjectNameDraft(activeProject.name);
  }, [activeProject]);

  useEffect(() => {
    if (promptChainSteps.some((step) => step.id === activeChainStepId)) return;
    setActiveChainStepId(promptChainSteps[0]?.id ?? 'design-lock');
  }, [promptChainSteps, activeChainStepId]);

  useEffect(() => {
    const choices = assetGuidePromptChoices[activeAssetGuideId];
    if (!choices) return;
    setPromptConfig((current) => ({
      ...current,
      characterType: choices.characterType?.[0] ?? current.characterType,
      gameGenre: choices.gameGenre?.[0] ?? current.gameGenre,
      moodRole: choices.moodRole?.[0] ?? current.moodRole,
      colors: choices.colors?.[0] ?? current.colors,
      cameraAngle: choices.cameraAngle?.[0] ?? current.cameraAngle,
      artStyle: choices.artStyle?.[0] ?? current.artStyle,
      proportions: choices.proportions?.[0] ?? current.proportions,
      outlineStyle: choices.outlineStyle?.[0] ?? current.outlineStyle,
      shadingStyle: choices.shadingStyle?.[0] ?? current.shadingStyle,
      detailLevel: choices.detailLevel?.[0] ?? current.detailLevel,
      lighting: choices.lighting?.[0] ?? current.lighting,
      animations: Object.fromEntries(
        (assetGuideFramePurposeOptions[activeAssetGuideId] ?? assetGuideFramePurposeOptions['sprite-sheet']).options.map((option) => [
          option,
          (assetGuideFramePurposeOptions[activeAssetGuideId] ?? assetGuideFramePurposeOptions['sprite-sheet']).defaultSelected.includes(option),
        ])
      ),
    }));
  }, [activeAssetGuideId]);

  useEffect(() => {
    if (!source?.url) return;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const isNewSource = sourceUrlRef.current !== source.url;
      sourceUrlRef.current = source.url;
      if (isNewSource) {
        const analysis = analyzeImportImage(image);
        setImportAnalysis(analysis);
        setSelectedFrame(0);
        setOffsets({});
        setFilledSheet(null);
        const bestSuggestion = analysis?.suggestions?.[0] ?? null;
        const bestGridSuggestion = getBestSliceableSuggestion(analysis?.suggestions);
        const packedSuggestion = getPackedSuggestion(analysis?.suggestions);
        const canAutoApplyImport = !source.layout && source.name !== 'demo_knight_32.png';
        const shouldAutoApply = canAutoApplyImport && bestGridSuggestion && bestSuggestion === bestGridSuggestion && analysis.detectedSprites > 1 && bestGridSuggestion.confidence >= 80;
        if (source.layout) {
          setFrameWidth(source.layout.frameWidth);
          setFrameHeight(source.layout.frameHeight);
          setColumns(source.layout.columns);
          setRows(source.layout.rows);
          setPivot(source.layout.pivot ?? { x: Math.round(source.layout.frameWidth / 2), y: Math.round(source.layout.frameHeight / 2) });
        } else if (source.name === 'demo_knight_32.png') {
          setFrameWidth(DEFAULT_FRAME);
          setFrameHeight(DEFAULT_FRAME);
          setColumns(8);
          setRows(3);
          setPivot({ x: 16, y: 28 });
        } else if (shouldAutoApply) {
          const nextAnimations = inferAnimationsForLayout(bestGridSuggestion, analysis.detectedSprites);
          setFrameWidth(bestGridSuggestion.frameWidth);
          setFrameHeight(bestGridSuggestion.frameHeight);
          setColumns(bestGridSuggestion.columns);
          setRows(bestGridSuggestion.rows);
          setSelectedAnimationId(nextAnimations[0]?.id ?? 'detected_frames_1');
          setAnimations(nextAnimations);
          setPivot({ x: Math.round(bestGridSuggestion.frameWidth / 2), y: Math.round(bestGridSuggestion.frameHeight / 2) });
        } else {
          const nextAnimations = singleFrameAnimation();
          setFrameWidth(image.width);
          setFrameHeight(image.height);
          setColumns(1);
          setRows(1);
          setSelectedAnimationId(nextAnimations[0].id);
          setAnimations(nextAnimations);
          setPivot({ x: Math.round(image.width / 2), y: Math.round(image.height / 2) });
        }
        if (analysis?.keyColor) {
          setKeyColor(analysis.keyColor);
          setPromptConfig((current) => ({ ...current, backgroundMode: 'key', keyColor: analysis.keyColor }));
          setRemoveKeyBackground(true);
        }
        setZoom(Math.max(image.width, image.height) > 900 ? 0.75 : 1);
        setStatus(
          shouldAutoApply
            ? `${source.name} auto-applied ${bestGridSuggestion.columns}x${bestGridSuggestion.rows} grid and ${inferAnimationsForLayout(bestGridSuggestion, analysis.detectedSprites).length} detected range(s).`
            : analysis?.detectedSprites
              ? packedSuggestion && bestSuggestion === packedSuggestion
                ? `${source.name} analyzed: ${analysis.detectedSprites} loose sprites detected. Use Fill to build a clean centered sheet.`
                : `${source.name} analyzed: ${analysis.detectedSprites} sprites detected. Pick a grid to apply or use Fill.`
              : `${source.name} loaded as one unsliced sheet`
        );
      }
      requestAnimationFrame(drawPreview);
    };
    image.src = source.url;
  }, [source]);

  const totalFrames = Math.max(1, columns * rows);
  const selectedAnimation = animations.find((item) => item.id === selectedAnimationId) ?? animations[0];
  const activeFrames = useMemo(() => {
    const start = clamp(selectedAnimation.start, 0, totalFrames - 1);
    const end = clamp(selectedAnimation.end, start, totalFrames - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [selectedAnimation, totalFrames]);

  useEffect(() => {
    setSelectedFrame((current) => clamp(current, 0, totalFrames - 1));
    setAnimations((current) => clampAnimationRanges(current, totalFrames));
  }, [totalFrames]);

  useEffect(() => {
    if (!isPlaying || !activeFrames.length) return undefined;
    const delay = 1000 / Math.max(1, selectedAnimation.fps);
    const timer = window.setInterval(() => {
      setSelectedFrame((current) => {
        const index = activeFrames.indexOf(current);
        if (index === -1 || index === activeFrames.length - 1) {
          return selectedAnimation.loop ? activeFrames[0] : current;
        }
        return activeFrames[index + 1];
      });
    }, delay);
    return () => window.clearInterval(timer);
  }, [activeFrames, isPlaying, selectedAnimation.fps, selectedAnimation.loop]);

  useEffect(() => {
    drawPreview();
  }, [selectedFrame, frameWidth, frameHeight, columns, rows, offsets, pivot, source]);

  useEffect(() => {
    setRotationStats(null);
    setFilledSheet(null);
  }, [source, frameWidth, frameHeight, columns, rows]);

  function currentOffset(frame = selectedFrame) {
    return offsets[frame] ?? { x: 0, y: 0 };
  }

  function updateOffset(axis, value) {
    setOffsets((current) => ({
      ...current,
      [selectedFrame]: {
        ...currentOffset(),
        [axis]: Number(value),
      },
    }));
  }

  function selectFrame(frame) {
    setIsPlaying(false);
    setSelectedFrame(clamp(frame, 0, totalFrames - 1));
  }

  function stepFrame(delta) {
    setIsPlaying(false);
    setSelectedFrame((value) => clamp(value + delta, 0, totalFrames - 1));
  }

  function frameRect(frame) {
    return {
      sx: (frame % columns) * frameWidth,
      sy: Math.floor(frame / columns) * frameHeight,
      sw: frameWidth,
      sh: frameHeight,
    };
  }

  function drawFrame(ctx, frame, dx, dy, scale = 1, drawPivot = false) {
    const image = imageRef.current;
    if (!image) return;
    const rect = frameRect(frame);
    const offset = currentOffset(frame);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, dx + offset.x * scale, dy + offset.y * scale, rect.sw * scale, rect.sh * scale);
    if (drawPivot) {
      ctx.fillStyle = '#1097a2';
      ctx.fillRect(dx + pivot.x * scale - 3, dy + pivot.y * scale - 3, 6, 6);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(dx + pivot.x * scale - 3.5, dy + pivot.y * scale - 3.5, 7, 7);
    }
  }

  function drawPreview() {
    const canvas = previewCanvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const scale = 1;
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFrame(ctx, selectedFrame, 0, 0, scale, true);
  }

  async function handleFile(file) {
    if (!file) return;
    try {
      const nextSource = await readImageFile(file);
      setSource(nextSource);
      setSelectedFrame(0);
      setOffsets({});
    } catch (error) {
      setStatus(error.message);
    }
  }

  function updateAnimation(id, patch) {
    setAnimations((current) =>
      current.map((animation) => {
        if (animation.id !== id) return animation;
        const next = { ...animation, ...patch };
        next.start = clamp(Number(next.start), 0, totalFrames - 1);
        next.end = clamp(Number(next.end), next.start, totalFrames - 1);
        next.fps = clamp(Number(next.fps), 1, 60);
        return next;
      })
    );
  }

  function alignFeet() {
    const baseline = pivot.y;
    const nextOffsets = {};
    for (let frame = 0; frame < totalFrames; frame += 1) {
      nextOffsets[frame] = { ...(offsets[frame] ?? { x: 0, y: 0 }), y: Math.round(frameHeight - baseline - 4) };
    }
    setOffsets(nextOffsets);
    setStatus('Applied baseline alignment offsets to all frames');
  }

  function resetOffsets() {
    setOffsets({});
    setStatus('Frame offsets reset');
  }

  function isKeyOrTransparentPixel(data, index, targetColor = keyColor) {
    return isKeyOrTransparentPixelData(data, index, targetColor, Number(keyTolerance) || 0);
  }

  function analyzeBackgroundFromImage(image) {
    if (!image) return null;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return analyzeBackgroundFromImageData(data, canvas.width, canvas.height);
  }

  function detectKeyColorFromImage(image) {
    return analyzeBackgroundFromImage(image)?.keyColor ?? null;
  }

  function detectKeyColorFromSource() {
    return detectKeyColorFromImage(imageRef.current);
  }

  function findVisibleComponents(image, targetColor) {
    if (!image) return [];
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return findVisibleComponentsInImageData(data, canvas.width, canvas.height, targetColor, Number(keyTolerance) || 0);
  }

  function analyzeImportImage(image) {
    if (!image) return null;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return analyzeImportImageData(data, canvas.width, canvas.height, {
      keyColor,
      keyTolerance,
      preferredColumns: columns,
    });
  }

  function autoDetectKeyColor() {
    const background = analyzeBackgroundFromImage(imageRef.current);
    const detected = background?.keyColor;
    if (!detected) {
      setStatus(background?.kind === 'transparent' ? 'Detected true transparency. No key color needed.' : 'Could not detect a dominant background color');
      return null;
    }
    setKeyColor(detected);
    setPromptConfig((current) => ({ ...current, backgroundMode: 'key', keyColor: detected }));
    setRemoveKeyBackground(true);
    setStatus(background?.kind === 'checker'
      ? `Detected fake checker background. Using ${background.ignoredColors.join(' and ')} for analysis.`
      : `Auto-detected key color ${detected}`
    );
    return detected;
  }

  function collectFrameSilhouettes(targetColor = keyColor) {
    const image = imageRef.current;
    if (!image) return null;
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const frames = [];

    for (let frame = 0; frame < totalFrames; frame += 1) {
      const rect = frameRect(frame);
      ctx.clearRect(0, 0, frameWidth, frameHeight);
      ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, frameWidth, frameHeight);
      const { data } = ctx.getImageData(0, 0, frameWidth, frameHeight);
      let minX = frameWidth;
      let minY = frameHeight;
      let maxX = -1;
      let maxY = -1;
      let pixels = 0;

      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const index = (y * frameWidth + x) * 4;
          if (isKeyOrTransparentPixel(data, index, targetColor)) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          pixels += 1;
        }
      }

      const width = pixels ? maxX - minX + 1 : 0;
      const height = pixels ? maxY - minY + 1 : 0;
      frames.push({
        frame,
        minX,
        minY,
        maxX,
        maxY,
        width,
        height,
        pixels,
        centerX: pixels ? (minX + maxX) / 2 : frameWidth / 2,
        centerY: pixels ? (minY + maxY) / 2 : frameHeight / 2,
        radius: pixels ? Math.max(width, height) / 2 : 0,
      });
    }

    return frames;
  }

  function analyzeRotationFrames() {
    const background = analyzeBackgroundFromImage(imageRef.current);
    const detectedKeyColor = background?.kind === 'transparent' ? null : background?.keyColor;
    const ignoredColors = background?.kind === 'transparent'
      ? []
      : background?.ignoredColors?.length
        ? background.ignoredColors
        : [detectedKeyColor ?? keyColor];
    const analysisKeyColor = ignoredColors;
    if (detectedKeyColor && normalizeHexColor(detectedKeyColor) !== normalizeHexColor(keyColor)) {
      setKeyColor(detectedKeyColor);
      setPromptConfig((current) => ({ ...current, backgroundMode: 'key', keyColor: detectedKeyColor }));
      setRemoveKeyBackground(true);
    }
    const frames = collectFrameSilhouettes(analysisKeyColor);
    if (!frames) {
      setStatus('Import a sheet before analyzing rotations');
      return null;
    }
    const nextStats = { ...scoreSilhouetteFrames(frames), keyColor: detectedKeyColor ?? keyColor, ignoredColors, background };
    setRotationStats(nextStats);
    if (!nextStats.validCount) {
      setStatus('No visible sprite pixels found. Check the key color/tolerance.');
      return nextStats;
    }
    const ignoredLabel = ignoredColors.length ? ignoredColors.join(', ') : 'alpha transparency';
    setStatus(`Analyzed ${nextStats.validCount} detected frames using ${ignoredLabel}. Worst wobble: frame ${nextStats.worstFrame.frame}.`);
    return nextStats;
  }

  function autoCenterRotationFrames() {
    const stats = rotationStats;
    if (!stats?.frames?.length || !stats.validCount) {
      analyzeRotationFrames();
      setStatus('Analyze the sheet first, then run auto-center.');
      return;
    }
    setOffsets((current) => {
      const next = { ...current };
      stats.frames.forEach((frame) => {
        if (!frame.pixels) return;
        const currentOffsetValue = current[frame.frame] ?? { x: 0, y: 0 };
        next[frame.frame] = {
          x: currentOffsetValue.x + Math.round(stats.avgX - frame.centerX),
          y: currentOffsetValue.y + Math.round(stats.avgY - frame.centerY),
        };
      });
      return next;
    });
    setStatus(`Auto-centered ${stats.validCount} rotation frames using silhouette centers`);
  }

  function createDetectedComponentSheet(image, analysis) {
    const components = (analysis?.components ?? []).filter((component) => component.pixels > 0);
    if (!image || components.length < 2) return null;
    if (analysis.sourceWidth !== image.width || analysis.sourceHeight !== image.height) return null;

    const autoFrameSize = chooseDetectedFrameSize(components, {
      commonFrameSizes: COMMON_FRAME_SIZES,
      defaultFrame: DEFAULT_FRAME,
      maxFrameSize: MAX_FRAME_SIZE,
    });
    const outputFrameWidth = normalizeExport
      ? exportFrameWidth
      : totalFrames > 1 && frameWidth < image.width
        ? frameWidth
        : autoFrameSize;
    const outputFrameHeight = normalizeExport
      ? exportFrameHeight
      : totalFrames > 1 && frameHeight < image.height
        ? frameHeight
        : autoFrameSize;
    const outputColumns = choosePackedColumns(components.length, columns);
    const outputRows = Math.ceil(components.length / outputColumns);
    const canvas = document.createElement('canvas');
    canvas.width = outputColumns * outputFrameWidth;
    canvas.height = outputRows * outputFrameHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const internalPadding = clamp(Math.round(Math.min(outputFrameWidth, outputFrameHeight) * 0.08), 2, 14);
    const sourcePadding = 2;

    components.forEach((component, index) => {
      const sourceX = Math.max(0, component.minX - sourcePadding);
      const sourceY = Math.max(0, component.minY - sourcePadding);
      const sourceMaxX = Math.min(image.width - 1, component.maxX + sourcePadding);
      const sourceMaxY = Math.min(image.height - 1, component.maxY + sourcePadding);
      const sourceW = sourceMaxX - sourceX + 1;
      const sourceH = sourceMaxY - sourceY + 1;
      const scale = Math.min(
        1,
        (outputFrameWidth - internalPadding * 2) / Math.max(1, sourceW),
        (outputFrameHeight - internalPadding * 2) / Math.max(1, sourceH)
      );
      const drawW = Math.max(1, Math.round(sourceW * scale));
      const drawH = Math.max(1, Math.round(sourceH * scale));
      const targetX = (index % outputColumns) * outputFrameWidth + Math.round((outputFrameWidth - drawW) / 2);
      const targetY = Math.floor(index / outputColumns) * outputFrameHeight + Math.round((outputFrameHeight - drawH) / 2);
      ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, targetX, targetY, drawW, drawH);
    });

    const ignoredColors = analysis.ignoredColors?.length
      ? analysis.ignoredColors
      : analysis.background?.kind === 'transparent'
        ? []
        : [analysis.keyColor ?? keyColor];
    const removedPixels = removeColorFromCanvas(ctx, canvas.width, canvas.height, ignoredColors);
    const nextSheet = {
      url: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      columns: outputColumns,
      rows: outputRows,
      frameWidth: outputFrameWidth,
      frameHeight: outputFrameHeight,
      sourceFrames: components.map((component, index) => index),
      removedPixels,
      count: components.length,
      mode: 'detected boxes',
    };
    setFilledSheet(nextSheet);
    setStatus(`Filled ${components.length} detected sprites into ${outputColumns}x${outputRows} clean grid`);
    return nextSheet;
  }

  function createFilledSheet() {
    const image = imageRef.current;
    if (!image) {
      setStatus('Import a sheet before filling a cleaned sheet');
      return null;
    }

    const detectedSheet = createDetectedComponentSheet(image, importAnalysis);
    if (detectedSheet) return detectedSheet;

    const stats = rotationStats?.frames?.length ? rotationStats : analyzeRotationFrames();
    const validFrames = (stats?.frames ?? []).filter((frame) => frame.pixels > 0);
    if (!validFrames.length) {
      setStatus('No detected frames to fill. Check the key color/tolerance.');
      return null;
    }

    const outputColumns = choosePackedColumns(validFrames.length, columns);
    const outputRows = Math.ceil(validFrames.length / outputColumns);
    const canvas = document.createElement('canvas');
    canvas.width = outputColumns * frameWidth;
    canvas.height = outputRows * frameHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    validFrames.forEach((frame, index) => {
      const sourceRect = frameRect(frame.frame);
      const targetX = (index % outputColumns) * frameWidth;
      const targetY = Math.floor(index / outputColumns) * frameHeight;
      const shiftX = Math.round(frameWidth / 2 - frame.centerX);
      const shiftY = Math.round(frameHeight / 2 - frame.centerY);

      ctx.save();
      ctx.beginPath();
      ctx.rect(targetX, targetY, frameWidth, frameHeight);
      ctx.clip();
      ctx.drawImage(
        image,
        sourceRect.sx,
        sourceRect.sy,
        sourceRect.sw,
        sourceRect.sh,
        targetX + shiftX,
        targetY + shiftY,
        frameWidth,
        frameHeight
      );
      ctx.restore();
    });

    const statsRemovalColors = stats.ignoredColors?.length
      ? stats.ignoredColors
      : stats.background?.kind === 'transparent'
        ? []
        : stats.keyColor ?? keyColor;
    const removedPixels = removeColorFromCanvas(ctx, canvas.width, canvas.height, statsRemovalColors);
    const nextSheet = {
      url: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      columns: outputColumns,
      rows: outputRows,
      frameWidth,
      frameHeight,
      sourceFrames: validFrames.map((frame) => frame.frame),
      removedPixels,
      count: validFrames.length,
    };
    setFilledSheet(nextSheet);
    setStatus(`Filled clean sheet with ${validFrames.length} detected frames into ${outputColumns}x${outputRows}`);
    return nextSheet;
  }

  function applyFilledSheet() {
    const sheet = filledSheet ?? createFilledSheet();
    if (!sheet) return;
    const nextAnimations = inferAnimationsForLayout(
      { columns: sheet.columns, rows: sheet.rows, kind: sheet.mode === 'detected boxes' ? 'packed detected sprites' : 'detected rows' },
      sheet.count
    );
    setSource({
      name: `${source?.name?.replace(/\.[^.]+$/, '') || 'spriteforge'}_filled.png`,
      url: sheet.url,
      width: sheet.width,
      height: sheet.height,
      layout: {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
        columns: sheet.columns,
        rows: sheet.rows,
        pivot: { x: Math.round(sheet.frameWidth / 2), y: Math.round(sheet.frameHeight / 2) },
      },
    });
    setFrameWidth(sheet.frameWidth);
    setFrameHeight(sheet.frameHeight);
    setColumns(sheet.columns);
    setRows(sheet.rows);
    setSelectedFrame(0);
    setSelectedAnimationId(nextAnimations[0]?.id ?? 'detected_frames_1');
    setAnimations(nextAnimations);
    setOffsets({});
    setPivot({ x: Math.round(sheet.frameWidth / 2), y: Math.round(sheet.frameHeight / 2) });
    setRemoveKeyBackground(false);
    setStatus(`Applied filled ${sheet.columns}x${sheet.rows} sheet to Sprite Studio`);
  }

  function exportFilledSheet() {
    const sheet = filledSheet ?? createFilledSheet();
    if (!sheet) return;
    fetch(sheet.url)
      .then((response) => response.blob())
      .then((blob) => {
        downloadBlob(blob, `${source?.name?.replace(/\.[^.]+$/, '') || 'spriteforge'}_filled.png`);
        setStatus(`Exported filled sheet with ${sheet.count} detected frames`);
      })
      .catch(() => setStatus('Could not export filled sheet'));
  }

  function removeColorFromCanvas(ctx, width, height, targetColor = keyColor) {
    return clearColorFromCanvas(ctx, width, height, targetColor, Number(keyTolerance) || 0);
  }

  function pickSelectedFrameCornerColor() {
    const image = imageRef.current;
    if (!image) return;
    const rect = frameRect(selectedFrame);
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, rect.sx, rect.sy, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const nextColor = rgbToHex(r, g, b);
    setKeyColor(nextColor);
    setPromptConfig((current) => ({ ...current, backgroundMode: 'key', keyColor: nextColor }));
    setRemoveKeyBackground(true);
    setStatus(`Picked key color ${nextColor} from selected frame`);
  }

  function applySheetLayout(layoutColumns, layoutRows) {
    if (!source) return;
    const nextWidth = Math.max(1, Math.floor(source.width / layoutColumns));
    const nextHeight = Math.max(1, Math.floor(source.height / layoutRows));
    setFrameWidth(nextWidth);
    setFrameHeight(nextHeight);
    setColumns(layoutColumns);
    setRows(layoutRows);
    setSelectedFrame(0);
    setSelectedAnimationId(animations[0]?.id ?? 'idle');
    setPivot({ x: Math.round(nextWidth / 2), y: Math.max(0, nextHeight - 4) });
    setOffsets({});
    setZoom(source.width > 900 || source.height > 900 ? 0.5 : 1);
    setAnimations((current) =>
      current.map((animation, index) => {
        const maxFrame = layoutColumns * layoutRows - 1;
        if (index === 0) return { ...animation, start: 0, end: Math.min(3, maxFrame) };
        const start = clamp(animation.start, 0, maxFrame);
        return { ...animation, start, end: clamp(animation.end, start, maxFrame) };
      })
    );
    setStatus(`Applied ${layoutColumns}x${layoutRows} sheet layout (${nextWidth}x${nextHeight} frames)`);
  }

  function applyImportLayout(suggestion) {
    if (!suggestion) return;
    if (isPackedLayoutSuggestion(suggestion)) {
      const sheet = createFilledSheet();
      if (sheet) {
        setStatus(`Built a clean ${sheet.columns}x${sheet.rows} filled sheet preview. Click Apply to use it in Sprite Studio.`);
      }
      return;
    }
    const nextAnimations = inferAnimationsForLayout(suggestion, importAnalysis?.detectedSprites);
    setFrameWidth(suggestion.frameWidth);
    setFrameHeight(suggestion.frameHeight);
    setColumns(suggestion.columns);
    setRows(suggestion.rows);
    setSelectedFrame(0);
    setSelectedAnimationId(nextAnimations[0]?.id ?? 'detected_frames_1');
    setPivot({ x: Math.round(suggestion.frameWidth / 2), y: Math.round(suggestion.frameHeight / 2) });
    setOffsets({});
    setAnimations(nextAnimations);
    setZoom(Math.max(source?.width ?? 0, source?.height ?? 0) > 900 ? 0.75 : 1);
    setStatus(`Applied ${suggestion.columns}x${suggestion.rows} layout with ${nextAnimations.length} detected range(s)`);
  }

  function reanalyzeImport() {
    const image = imageRef.current;
    if (!image) return;
    const analysis = analyzeImportImage(image);
    setImportAnalysis(analysis);
    if (analysis?.keyColor) {
      setKeyColor(analysis.keyColor);
      setPromptConfig((current) => ({ ...current, backgroundMode: 'key', keyColor: analysis.keyColor }));
      setRemoveKeyBackground(true);
    }
    setStatus(
      analysis?.detectedSprites
        ? `Import analysis refreshed: ${analysis.detectedSprites} sprites detected`
        : 'Import analysis found no separate sprites'
    );
  }

  function exportSpriteSheet() {
    const image = imageRef.current;
    if (!image) return;
    const frames = activeFrames;
    const outputColumns = Math.min(frames.length, 8);
    const outputRows = Math.ceil(frames.length / outputColumns);
    const outputFrameWidth = normalizeExport ? exportFrameWidth : frameWidth;
    const outputFrameHeight = normalizeExport ? exportFrameHeight : frameHeight;
    const offsetScaleX = outputFrameWidth / frameWidth;
    const offsetScaleY = outputFrameHeight / frameHeight;
    const canvas = document.createElement('canvas');
    canvas.width = outputColumns * (outputFrameWidth + padding * 2);
    canvas.height = outputRows * (outputFrameHeight + padding * 2);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frames.forEach((frame, index) => {
      const rect = frameRect(frame);
      const offset = currentOffset(frame);
      const dx = (index % outputColumns) * (outputFrameWidth + padding * 2) + padding + Math.round(offset.x * offsetScaleX);
      const dy = Math.floor(index / outputColumns) * (outputFrameHeight + padding * 2) + padding + Math.round(offset.y * offsetScaleY);
      ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, outputFrameWidth, outputFrameHeight);
    });
    const removedPixels = removeKeyBackground ? removeColorFromCanvas(ctx, canvas.width, canvas.height) : 0;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `spriteforge_${selectedAnimation.name}.png`);
    }, 'image/png');
    setStatus(`Exported ${selectedAnimation.name} animation PNG${normalizeExport ? ` at ${outputFrameWidth}x${outputFrameHeight}` : ''}${removeKeyBackground ? `, removed ${removedPixels} key pixels` : ''}`);
  }

  function exportMetadata() {
    const payload = {
      app: 'SpriteForge Studio',
      source: source?.name ?? 'unknown',
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
      animations: animations.map((animation) => ({
        name: animation.name,
        start: animation.start,
        end: animation.end,
        frames: Array.from({ length: animation.end - animation.start + 1 }, (_, index) => animation.start + index),
        fps: animation.fps,
        loop: animation.loop,
      })),
      engineHints: {
        godot: 'Use frame width/height for SpriteFrames or AnimatedSprite2D. Pivot maps to centered offset during import.',
        unity: 'Use Sprite Mode Multiple, Pixels Per Unit matching frame size, then slice by grid cell size.',
      },
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'spriteforge_metadata.json');
    setStatus('Exported JSON metadata');
  }

  async function copyPromptGuide() {
    try {
      await navigator.clipboard.writeText(guidePrompt);
      setStatus('Copied SpriteForge image prompt');
    } catch {
      const textarea = document.querySelector('.guide-section textarea');
      textarea?.focus();
      textarea?.select();
      const copied = document.execCommand('copy');
      setStatus(copied ? 'Copied SpriteForge image prompt' : 'Prompt selected. Press Ctrl+C to copy.');
    }
  }

  async function copyAssetGuide() {
    try {
      await navigator.clipboard.writeText(assetGuidePrompt);
      setStatus(`Copied ${activeAssetGuide.name} asset guide`);
    } catch {
      const textarea = document.querySelector('.asset-guide-output');
      textarea?.focus();
      textarea?.select();
      const copied = document.execCommand('copy');
      setStatus(copied ? `Copied ${activeAssetGuide.name} asset guide` : 'Asset guide selected. Press Ctrl+C to copy.');
    }
  }

  async function copyPromptChainStep(step = activeChainStep) {
    if (!step) return;
    try {
      await navigator.clipboard.writeText(step.prompt);
      setStatus(`Copied ${step.title} prompt`);
    } catch {
      const textarea = document.querySelector('.chain-output');
      textarea?.focus();
      textarea?.select();
      const copied = document.execCommand('copy');
      setStatus(copied ? `Copied ${step.title} prompt` : 'Prompt selected. Press Ctrl+C to copy.');
    }
  }

  async function copyPromptChain() {
    const fullChain = promptChainSteps.map((step) => `${step.title}\n${step.prompt}`).join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(fullChain);
      setStatus('Copied full prompt chain');
    } catch {
      const textarea = document.querySelector('.chain-output');
      textarea?.focus();
      textarea?.select();
      const copied = document.execCommand('copy');
      setStatus(copied ? 'Copied current chain prompt' : 'Prompt selected. Press Ctrl+C to copy.');
    }
  }

  function selectStylePreset(preset) {
    setPromptConfig(createPromptConfig(preset));
    setExportFrameWidth(preset.frameSize);
    setExportFrameHeight(preset.frameSize);
    setKeyColor('#ff00ff');
    setRemoveKeyBackground(true);
    setFormatManualOpen(false);
    setStatus(`Loaded ${preset.name} prompt preset`);
  }

  function updatePromptField(field, value) {
    setPromptConfig((current) => ({ ...current, [field]: value }));
    if (field === 'frameSize') {
      const nextSize = Number(value);
      if (Number.isFinite(nextSize) && nextSize >= 8 && nextSize <= MAX_FRAME_SIZE) {
        setExportFrameWidth(nextSize);
        setExportFrameHeight(nextSize);
      }
    }
    if (field === 'keyColor') {
      setKeyColor(normalizeHexColor(value));
      setRemoveKeyBackground(true);
    }
  }

  function updateBackgroundMode(mode) {
    setPromptConfig((current) => ({ ...current, backgroundMode: mode }));
    setRemoveKeyBackground(mode === 'key');
  }

  function applyPromptFormat(columnsValue, rowsValue) {
    setPromptConfig((current) => ({
      ...current,
      columns: String(columnsValue),
      rows: String(rowsValue),
    }));
    setFormatManualOpen(false);
    setStatus(`Set prompt format to ${columnsValue}x${rowsValue}`);
  }

  function togglePromptOption(group, key) {
    setPromptConfig((current) => ({
      ...current,
      [group]: {
        ...(current[group] ?? {}),
        [key]: !current[group]?.[key],
      },
    }));
  }

  function createNewProject() {
    const project = createProject(projectNameDraft || 'SpriteForge Project');
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
    setProjectNameDraft(project.name);
    setStatus(`Created project ${project.name}`);
  }

  function renameActiveProject(name) {
    setProjectNameDraft(name);
    if (!activeProjectId) return;
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId
          ? { ...project, name: name || 'Untitled Project', updatedAt: new Date().toISOString() }
          : project
      )
    );
  }

  function deleteActiveProject() {
    if (!activeProjectId) {
      setStatus('No project selected');
      return;
    }
    const nextProjects = projects.filter((project) => project.id !== activeProjectId);
    const nextActiveProject = nextProjects[0] ?? null;
    setProjects(nextProjects);
    setActiveProjectId(nextActiveProject?.id ?? null);
    setProjectNameDraft(nextActiveProject?.name ?? 'SpriteForge Project');
    setStatus('Deleted project');
  }

  function deleteProjectAsset(assetId) {
    if (!activeProjectId) return;
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              updatedAt: new Date().toISOString(),
              assets: (project.assets ?? []).filter((asset) => asset.id !== assetId),
            }
          : project
      )
    );
    setStatus('Deleted saved asset');
  }

  function saveCurrentAssetToProject() {
    if (!source) {
      setStatus('Import an asset before saving it to a project');
      return;
    }

    const now = new Date().toISOString();
    const asset = {
      id: makeId('asset'),
      name: source.name ?? 'untitled_asset.png',
      savedAt: now,
      source,
      activeAssetGuideId,
      promptConfig,
      sheet: {
        frameWidth,
        frameHeight,
        columns,
        rows,
        selectedFrame,
        pivot,
        offsets,
        keyColor,
        keyTolerance,
        removeKeyBackground,
        normalizeExport,
        exportFrameWidth,
        exportFrameHeight,
        padding,
      },
      animations,
    };

    const fallbackProject = activeProject ?? createProject(projectNameDraft || 'SpriteForge Project');
    setActiveProjectId(fallbackProject.id);
    setProjects((current) => {
      const existingProject = current.find((project) => project.id === fallbackProject.id);
      const project = existingProject ?? fallbackProject;
      const nextProject = {
        ...project,
        name: projectNameDraft || project.name,
        updatedAt: now,
        assets: [asset, ...(project.assets ?? [])],
      };
      const nextProjects = existingProject
        ? current.map((item) => (item.id === project.id ? nextProject : item))
        : [nextProject, ...current];
      return nextProjects;
    });
    setStatus(`Saved ${asset.name} to project`);
  }

  function loadProjectAsset(asset) {
    if (!asset?.source) return;
    const loadedColumns = asset.sheet?.columns ?? 1;
    const loadedRows = asset.sheet?.rows ?? 1;
    const loadedFrameCount = Math.max(1, loadedColumns * loadedRows);
    const loadedAnimations = clampAnimationRanges(asset.animations ?? initialAnimations, loadedFrameCount);
    setSource(asset.source);
    setFrameWidth(asset.sheet?.frameWidth ?? DEFAULT_FRAME);
    setFrameHeight(asset.sheet?.frameHeight ?? DEFAULT_FRAME);
    setColumns(loadedColumns);
    setRows(loadedRows);
    setSelectedFrame(clamp(asset.sheet?.selectedFrame ?? 0, 0, loadedFrameCount - 1));
    setPivot(asset.sheet?.pivot ?? { x: 16, y: 28 });
    setOffsets(asset.sheet?.offsets ?? {});
    setKeyColor(asset.sheet?.keyColor ?? '#ff00ff');
    setKeyTolerance(asset.sheet?.keyTolerance ?? 12);
    setRemoveKeyBackground(asset.sheet?.removeKeyBackground ?? true);
    setNormalizeExport(asset.sheet?.normalizeExport ?? false);
    setExportFrameWidth(asset.sheet?.exportFrameWidth ?? asset.sheet?.frameWidth ?? DEFAULT_FRAME);
    setExportFrameHeight(asset.sheet?.exportFrameHeight ?? asset.sheet?.frameHeight ?? DEFAULT_FRAME);
    setPadding(asset.sheet?.padding ?? 0);
    setAnimations(loadedAnimations);
    setSelectedAnimationId(loadedAnimations[0]?.id ?? 'idle');
    setPromptConfig(asset.promptConfig ?? createPromptConfig());
    setActiveAssetGuideId(asset.activeAssetGuideId ?? 'sprite-sheet');
    setStatus(`Loaded ${asset.name} from project`);
  }

  function exportActiveProject() {
    const project = activeProject;
    if (!project) {
      setStatus('Create or select a project before exporting');
      return;
    }
    const payload = createProjectBundle(project);
    const filename = `${project.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'spriteforge_project'}.json`;
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename);
    setStatus(`Exported project ${project.name}`);
  }

  async function importProjectBundle(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const project = parseProjectBundleText(text);
      const importedProject = {
        ...project,
        id: makeId('project'),
        name: `${project.name ?? 'Imported Project'} import`,
        updatedAt: new Date().toISOString(),
      };
      setProjects((current) => [importedProject, ...current]);
      setActiveProjectId(importedProject.id);
      setProjectNameDraft(importedProject.name);
      setStatus(`Imported project ${importedProject.name}`);
    } catch (error) {
      setStatus(error.message || 'Could not import project JSON');
    }
  }

  function paletteSwatches() {
    return ['#111827', '#2f241c', '#70422b', '#a76b43', '#f6d8a9', '#e8edf0', '#cbd5df', '#17445c', '#126c72', '#43a6a5', '#58a869', '#593451', '#e64c3f', '#f0a83b'];
  }

  const displayScale = clamp(zoom, 0.25, 4);
  const sheetWidth = columns * frameWidth * displayScale;
  const sheetHeight = rows * frameHeight * displayScale;

  return (
    <main className={darkMode ? 'app-shell theme-dark' : 'app-shell'}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={22} /></div>
          <span>SpriteForge</span>
        </div>
        <div className="project-title">
          <strong>{source?.name ?? 'untitled_spritesheet.png'}</strong>
          <span>Autosaved local session</span>
        </div>
        <nav className="feature-tabs" aria-label="SpriteForge tools">
          <button className={activeTool === 'studio' ? 'active' : ''} onClick={() => setActiveTool('studio')}>Sprite Studio</button>
          <button className={activeTool === 'rotation' ? 'active' : ''} onClick={() => setActiveTool('rotation')}>Rotation Cleanup</button>
        </nav>
        <div className="top-actions">
          <button className="icon-button" title="New demo sheet" onClick={() => setSource(createDemoSheet())}><Scissors size={18} /></button>
          <button className="icon-button" title="Open PNG" onClick={() => fileInputRef.current?.click()}><FolderOpen size={18} /></button>
          <button className="icon-button" title="Export selected animation PNG" onClick={exportSpriteSheet}><Save size={18} /></button>
          <button className="icon-button" title="Prompt builder" onClick={() => setGuideOpen(true)}><BookOpen size={18} /></button>
          <button
            className="icon-button"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDarkMode((value) => !value)}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {activeTool === 'studio' ? (
      <section className="workspace">
        <aside className="left-panel">
          <PanelTitle label="Source" />
          <label className="drop-zone" onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }} onDragOver={(event) => event.preventDefault()}>
            <ImagePlus size={28} />
            <strong>Import Source</strong>
            <span>PNG, JPG, WEBP or drag and drop</span>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>

          <div className="source-card">
            <div className="tiny-sprite" style={{ backgroundImage: `url(${source?.url})` }} />
            <div>
              <strong>{source?.name ?? 'No image'}</strong>
              <span>{source ? `${source.width}x${source.height}` : 'Waiting for import'}</span>
            </div>
          </div>

          <ProjectLibraryPanel
            projects={projects}
            activeProject={activeProject}
            activeProjectId={activeProjectId}
            projectNameDraft={projectNameDraft}
            projectFileInputRef={projectFileInputRef}
            onSelectProject={(projectId) => setActiveProjectId(projectId)}
            onRenameProject={renameActiveProject}
            onCreateProject={createNewProject}
            onDeleteProject={deleteActiveProject}
            onSaveAsset={saveCurrentAssetToProject}
            onLoadAsset={loadProjectAsset}
            onDeleteAsset={deleteProjectAsset}
            onExportProject={exportActiveProject}
            onImportProject={importProjectBundle}
          />

          <ImportAnalysisPanel
            analysis={importAnalysis}
            onAnalyze={reanalyzeImport}
            onApplyLayout={applyImportLayout}
            onFill={createFilledSheet}
          />

          <PanelTitle label="Frame Size" />
          <div className="two-inputs">
            <NumberField label="W" value={frameWidth} min={8} max={MAX_FRAME_SIZE} onChange={setFrameWidth} suffix="px" />
            <NumberField label="H" value={frameHeight} min={8} max={MAX_FRAME_SIZE} onChange={setFrameHeight} suffix="px" />
          </div>
          <div className="preset-grid">
            <button onClick={() => { setFrameWidth(16); setFrameHeight(16); }}>16</button>
            <button onClick={() => { setFrameWidth(32); setFrameHeight(32); }}>32</button>
            <button onClick={() => { setFrameWidth(64); setFrameHeight(64); }}>64</button>
            <button onClick={() => { setFrameWidth(128); setFrameHeight(128); }}>128</button>
          </div>

          <PanelTitle label="Sheet Layout" />
          <div className="preset-grid">
            <button onClick={() => applySheetLayout(1, 1)}>1x1</button>
            <button onClick={() => applySheetLayout(2, 2)}>2x2</button>
            <button onClick={() => applySheetLayout(3, 4)}>3x4</button>
            <button onClick={() => applySheetLayout(4, 4)}>4x4</button>
          </div>

          <PanelTitle label="Grid" />
          <Stepper label="Columns" value={columns} min={1} max={32} onChange={setColumns} />
          <Stepper label="Rows" value={rows} min={1} max={32} onChange={setRows} />
          <div className="muted-row">Total Frames: <strong>{totalFrames}</strong></div>

          <div className="panel-title with-action">
            <span>Animations</span>
            <button title="Add animation" onClick={() => {
              const id = `anim_${animations.length + 1}`;
              setAnimations([...animations, { id, name: `anim ${animations.length + 1}`, start: 0, end: Math.min(3, totalFrames - 1), fps: 8, loop: true }]);
              setSelectedAnimationId(id);
            }}><Plus size={16} /></button>
          </div>
          <div className="animation-list">
            {animations.map((animation) => (
              <button
                key={animation.id}
                className={animation.id === selectedAnimationId ? 'animation-row active' : 'animation-row'}
                onClick={() => {
                  setSelectedAnimationId(animation.id);
                  setSelectedFrame(animation.start);
                }}
              >
                <span>{animation.name}</span>
                <small>{animation.start} - {animation.end} ({animation.end - animation.start + 1})</small>
                <Play size={14} />
              </button>
            ))}
          </div>
        </aside>

        <section className="center-stage">
          <div className="tool-strip">
            <button className="tool active" title="Select"><Check size={18} /></button>
            <button className="tool" title="Grid"><Grid3X3 size={18} /></button>
            <button className="tool" title="Align feet" onClick={alignFeet}><AlignCenter size={18} /></button>
            <button className="tool" title="Reset offsets" onClick={resetOffsets}><RotateCcw size={18} /></button>
            <span className="strip-divider" />
            <button className="quick-action" aria-label="Auto-detect key color" title="Auto-detect the solid background key color" onClick={autoDetectKeyColor}><Sparkles size={16} />Key</button>
            <button className={showDetectionOverlay ? 'quick-action active' : 'quick-action'} aria-label="Toggle detected sprite boxes" title="Show or hide detected sprite boxes" onClick={() => setShowDetectionOverlay((value) => !value)} disabled={!importAnalysis?.components?.length}><Grid3X3 size={16} />Boxes</button>
            <button className="quick-action" aria-label="Fill sheet preview" title="Detect visible frames and build a centered filled sheet" onClick={createFilledSheet}><Grid3X3 size={16} />Fill</button>
            <button className="quick-action" aria-label="Apply filled sheet" title="Apply the filled sheet to Sprite Studio" onClick={applyFilledSheet} disabled={!filledSheet}><Check size={16} />Apply</button>
            <button className="quick-action" aria-label="Export filled sheet" title="Export the filled sheet PNG" onClick={exportFilledSheet} disabled={!filledSheet}><Download size={16} />Export</button>
            <span className="strip-divider" />
            <button className="tool" title="Zoom out" onClick={() => setZoom((value) => clamp(value - 0.25, 0.25, 4))}><Minus size={18} /></button>
            <button className="tool" title="Zoom in" onClick={() => setZoom((value) => clamp(value + 0.25, 0.25, 4))}><Plus size={18} /></button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="canvas-wrap">
            <div className="sheet-canvas" style={{ width: sheetWidth, height: sheetHeight }}>
              {source && (
                <img
                  src={source.url}
                  alt=""
                  style={{ width: sheetWidth, height: sheetHeight }}
                  draggable="false"
                />
              )}
              {source && showDetectionOverlay && importAnalysis?.components?.length > 0 && importAnalysis.sourceWidth === source.width && importAnalysis.sourceHeight === source.height && (
                <div className="detection-overlay" aria-hidden="true">
                  {importAnalysis.components.slice(0, 240).map((component, index) => {
                    const scaleX = sheetWidth / source.width;
                    const scaleY = sheetHeight / source.height;
                    return (
                      <span
                        key={`${component.minX}-${component.minY}-${index}`}
                        className="detect-box"
                        style={{
                          left: component.minX * scaleX,
                          top: component.minY * scaleY,
                          width: component.width * scaleX,
                          height: component.height * scaleY,
                        }}
                      >
                        {index}
                      </span>
                    );
                  })}
                </div>
              )}
              {Array.from({ length: totalFrames }, (_, frame) => {
                const rect = frameRect(frame);
                return (
                  <button
                    key={frame}
                    className={`${frame === selectedFrame ? 'frame-cell selected' : activeFrames.includes(frame) ? 'frame-cell in-animation' : 'frame-cell'} ${totalFrames > 300 ? 'dense' : ''}`}
                    style={{
                      left: rect.sx * displayScale,
                      top: rect.sy * displayScale,
                      width: frameWidth * displayScale,
                      height: frameHeight * displayScale,
                    }}
                    onClick={() => selectFrame(frame)}
                  >
                    <span>{frame}</span>
                    {frame === selectedFrame && <i style={{ left: pivot.x * displayScale, top: pivot.y * displayScale }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="stage-status">
            <span>Canvas: {source?.width ?? 0}x{source?.height ?? 0}</span>
            <span>Frame: {frameWidth}x{frameHeight}</span>
            <span>Selected: {selectedFrame}</span>
            <span>Zoom: {Math.round(zoom * 100)}%</span>
          </div>

          <div className="timeline">
            <div className="timeline-head">
              <strong>Timeline</strong>
              <span>{selectedAnimation.name} ({selectedAnimation.start} - {selectedAnimation.end})</span>
              <button className="play-button" onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? <Pause size={18} /> : <Play size={18} />}</button>
              <button className="icon-button" title="Previous frame" onClick={() => stepFrame(-1)}><SkipBack size={17} /></button>
              <button className="icon-button" title="Next frame" onClick={() => stepFrame(1)}><SkipForward size={17} /></button>
            </div>
            <div className="timeline-editor">
              <label className="timeline-name-field">
                <span>Name</span>
                <input value={selectedAnimation.name} onChange={(event) => updateAnimation(selectedAnimation.id, { name: event.target.value })} />
              </label>
              <NumberField label="Start" value={selectedAnimation.start} min={0} max={totalFrames - 1} onChange={(value) => updateAnimation(selectedAnimation.id, { start: value })} />
              <NumberField label="End" value={selectedAnimation.end} min={0} max={totalFrames - 1} onChange={(value) => updateAnimation(selectedAnimation.id, { end: value })} />
              <NumberField label="FPS" value={selectedAnimation.fps} min={1} max={60} onChange={(value) => updateAnimation(selectedAnimation.id, { fps: value })} />
              <label className="timeline-loop">
                <span>Loop</span>
                <input type="checkbox" checked={selectedAnimation.loop} onChange={(event) => updateAnimation(selectedAnimation.id, { loop: event.target.checked })} />
              </label>
              <button className="timeline-set-button" onClick={() => updateAnimation(selectedAnimation.id, { start: selectedFrame })}>Set Start</button>
              <button className="timeline-set-button" onClick={() => updateAnimation(selectedAnimation.id, { end: selectedFrame })}>Set End</button>
            </div>
            <div className="thumb-strip">
              {activeFrames.map((frame) => {
                const rect = frameRect(frame);
                const thumbScale = Math.min(64 / frameWidth, 64 / frameHeight);
                return (
                  <button key={frame} className={frame === selectedFrame ? 'thumb active' : 'thumb'} onClick={() => selectFrame(frame)}>
                    <span>{frame}</span>
                    {source && (
                      <div
                        style={{
                          backgroundImage: `url(${source.url})`,
                          backgroundSize: `${source.width * thumbScale}px ${source.height * thumbScale}px`,
                          backgroundPosition: `-${rect.sx * thumbScale}px -${rect.sy * thumbScale}px`,
                        }}
                      />
                    )}
                    <small>{frameWidth}x{frameHeight}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="right-panel">
          <PanelTitle label="Frame" />
          <NumberField label="Index" value={selectedFrame} min={0} max={totalFrames - 1} onChange={selectFrame} />
          <div className="two-inputs">
            <NumberField label="Grid X" value={selectedFrame % columns} min={0} max={columns - 1} onChange={(value) => selectFrame(Math.floor(selectedFrame / columns) * columns + value)} />
            <NumberField label="Grid Y" value={Math.floor(selectedFrame / columns)} min={0} max={rows - 1} onChange={(value) => selectFrame(value * columns + (selectedFrame % columns))} />
          </div>

          <PanelTitle label="Offsets (px)" />
          <div className="two-inputs">
            <NumberField label="Offset X" value={currentOffset().x} min={-64} max={64} onChange={(value) => updateOffset('x', value)} />
            <NumberField label="Offset Y" value={currentOffset().y} min={-64} max={64} onChange={(value) => updateOffset('y', value)} />
          </div>

          <PanelTitle label="Pivot (px)" />
          <div className="two-inputs">
            <NumberField label="Pivot X" value={pivot.x} min={0} max={frameWidth} onChange={(value) => setPivot((current) => ({ ...current, x: Number(value) }))} />
            <NumberField label="Pivot Y" value={pivot.y} min={0} max={frameHeight} onChange={(value) => setPivot((current) => ({ ...current, y: Number(value) }))} />
          </div>
          <div className="preview-box">
            <canvas ref={previewCanvasRef} />
          </div>

          <PanelTitle label="Playback" />
          <div className="two-inputs">
            <NumberField label="FPS" value={selectedAnimation.fps} min={1} max={60} onChange={(value) => updateAnimation(selectedAnimation.id, { fps: value })} />
            <label className="toggle-row">
              <span>Loop</span>
              <input type="checkbox" checked={selectedAnimation.loop} onChange={(event) => updateAnimation(selectedAnimation.id, { loop: event.target.checked })} />
            </label>
          </div>

          <PanelTitle label="Animation Range" />
          <div className="two-inputs">
            <NumberField label="Start" value={selectedAnimation.start} min={0} max={totalFrames - 1} onChange={(value) => updateAnimation(selectedAnimation.id, { start: value })} />
            <NumberField label="End" value={selectedAnimation.end} min={0} max={totalFrames - 1} onChange={(value) => updateAnimation(selectedAnimation.id, { end: value })} />
          </div>

          <PanelTitle label="Sample Palette" />
          <div className="swatches">
            {paletteSwatches().map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
          </div>

          <PanelTitle label="Export" />
          <NumberField label="Padding" value={padding} min={0} max={16} onChange={setPadding} suffix="px" />
          <label className="toggle-row export-toggle">
            <span>Normalize frame size</span>
            <input type="checkbox" checked={normalizeExport} onChange={(event) => setNormalizeExport(event.target.checked)} />
          </label>
          <div className="two-inputs">
            <NumberField label="Export W" value={exportFrameWidth} min={8} max={MAX_FRAME_SIZE} onChange={setExportFrameWidth} suffix="px" />
            <NumberField label="Export H" value={exportFrameHeight} min={8} max={MAX_FRAME_SIZE} onChange={setExportFrameHeight} suffix="px" />
          </div>
          <label className="toggle-row export-toggle">
            <span>Remove key background</span>
            <input type="checkbox" checked={removeKeyBackground} onChange={(event) => setRemoveKeyBackground(event.target.checked)} />
          </label>
          <div className="key-cleanup-grid">
            <label className="color-field compact">
              <span>Key</span>
              <input type="color" value={normalizeHexColor(keyColor)} onChange={(event) => setKeyColor(event.target.value)} />
              <input value={normalizeHexColor(keyColor)} onChange={(event) => setKeyColor(normalizeHexColor(event.target.value))} />
            </label>
            <NumberField label="Tolerance" value={keyTolerance} min={0} max={80} onChange={setKeyTolerance} />
          </div>
          <button className="secondary-action" onClick={pickSelectedFrameCornerColor}>Pick Selected Corner Color</button>
          <button className="primary-action" onClick={exportSpriteSheet}><Download size={18} />Export Selected Animation</button>
          <button className="secondary-action" onClick={exportMetadata}><FileJson size={18} />Export JSON Metadata</button>
          <button className="secondary-action danger" onClick={() => {
            const remainingAnimations = animations.filter((animation) => animation.id !== selectedAnimation.id);
            setAnimations(remainingAnimations);
            setSelectedAnimationId(remainingAnimations[0]?.id ?? 'idle');
          }} disabled={animations.length < 2}><Trash2 size={18} />Remove Animation</button>
        </aside>
      </section>
      ) : (
        <RotationCleanup
          source={source}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          columns={columns}
          rows={rows}
          totalFrames={totalFrames}
          selectedFrame={selectedFrame}
          setSelectedFrame={setSelectedFrame}
          keyColor={keyColor}
          keyTolerance={keyTolerance}
          rotationStats={rotationStats}
          filledSheet={filledSheet}
          analyzeRotationFrames={analyzeRotationFrames}
          autoCenterRotationFrames={autoCenterRotationFrames}
          autoDetectKeyColor={autoDetectKeyColor}
          createFilledSheet={createFilledSheet}
          applyFilledSheet={applyFilledSheet}
          exportFilledSheet={exportFilledSheet}
        />
      )}

      {guideOpen && (
        <div className="guide-layer" role="dialog" aria-modal="true" aria-label="Prompt builder">
          <button className="guide-scrim" aria-label="Close prompt guide" onClick={() => setGuideOpen(false)} />
          <aside className="guide-drawer">
            <header className="guide-header">
              <div>
                <strong>Prompt Builder</strong>
                <span>SpriteForge-ready image prompts</span>
              </div>
              <button className="icon-button" title="Close guide" onClick={() => setGuideOpen(false)}><X size={18} /></button>
            </header>

            <section className="guide-section compact">
              <h2>Asset Type</h2>
              <div className="asset-guide-tabs">
                {assetGuides.map((guide) => (
                  <button
                    key={guide.id}
                    type="button"
                    className={activeAssetGuide.id === guide.id ? 'active' : ''}
                    onClick={() => setActiveAssetGuideId(guide.id)}
                  >
                    {guide.name}
                  </button>
                ))}
              </div>
              <div className="guide-brief">
                <strong>{activeAssetGuide.name}</strong>
                <span>{activeAssetGuide.target}</span>
              </div>
            </section>

            <section className="guide-section compact">
              <h2>Describe It</h2>
              <div className="builder-grid">
                <PromptField label={activeBuilderLabels.characterType} value={promptConfig.characterType} choices={activePromptChoices.characterType} onChange={(value) => updatePromptField('characterType', value)} />
                <PromptField label={activeBuilderLabels.gameGenre} value={promptConfig.gameGenre} choices={activePromptChoices.gameGenre} onChange={(value) => updatePromptField('gameGenre', value)} />
                <PromptField label={activeBuilderLabels.moodRole} value={promptConfig.moodRole} choices={activePromptChoices.moodRole} onChange={(value) => updatePromptField('moodRole', value)} />
                <PromptField label={activeBuilderLabels.colors} value={promptConfig.colors} choices={activePromptChoices.colors} onChange={(value) => updatePromptField('colors', value)} />
                <PromptField label={activeBuilderLabels.cameraAngle} value={promptConfig.cameraAngle} choices={activePromptChoices.cameraAngle} onChange={(value) => updatePromptField('cameraAngle', value)} />
                <PromptField label={activeBuilderLabels.artStyle} value={promptConfig.artStyle} choices={activePromptChoices.artStyle} onChange={(value) => updatePromptField('artStyle', value)} />
              </div>
              <div className="mini-grid">
                <div className="format-summary">
                  <span>Frame</span>
                  <strong>{promptConfig.frameSize}x{promptConfig.frameSize}</strong>
                </div>
                <div className="format-summary">
                  <span>Grid</span>
                  <strong>{promptConfig.columns}x{promptConfig.rows}</strong>
                </div>
                <div className="format-summary">
                  <span>Canvas</span>
                  <strong>{Number(promptConfig.frameSize || 0) * Number(promptConfig.columns || 0)}x{Number(promptConfig.frameSize || 0) * Number(promptConfig.rows || 0)}</strong>
                </div>
              </div>
              <div className="background-builder">
                <div className="background-mode-buttons">
                  <button
                    type="button"
                    className={promptConfig.backgroundMode === 'key' ? 'active' : ''}
                    onClick={() => updateBackgroundMode('key')}
                  >
                    Key color recommended
                  </button>
                  <button
                    type="button"
                    className={promptConfig.backgroundMode === 'transparent' ? 'active' : ''}
                    onClick={() => updateBackgroundMode('transparent')}
                  >
                    True transparent
                  </button>
                </div>
                {promptConfig.backgroundMode === 'key' && (
                  <label className="color-field">
                    <span>Key Color</span>
                    <input
                      type="color"
                      value={normalizeHexColor(promptConfig.keyColor)}
                      onChange={(event) => updatePromptField('keyColor', event.target.value)}
                    />
                    <input
                      value={normalizeHexColor(promptConfig.keyColor)}
                      onChange={(event) => updatePromptField('keyColor', event.target.value)}
                    />
                  </label>
                )}
              </div>
            </section>

            <section className="guide-section">
              <h2>Generated Prompt</h2>
              <textarea className="final-prompt-output" readOnly value={guidePrompt} />
              <button className="primary-action" onClick={copyPromptGuide}><ClipboardCopy size={18} />Copy Prompt</button>
            </section>

            <details className="guide-section guide-advanced">
              <summary>More options</summary>
              <div className="advanced-stack">
                {showSpriteStylePresets && (
                  <section className="guide-section compact nested">
                    <h2>Style Presets</h2>
                    <div className="preset-cards">
                      {stylePresets.map((preset) => (
                        <button
                          key={preset.id}
                          className={promptConfig.presetId === preset.id ? 'preset-card active' : 'preset-card'}
                          onClick={() => selectStylePreset(preset)}
                        >
                          <strong>{preset.name}</strong>
                          <span>{preset.gameGenre} - {preset.frameSize}px - {preset.columns}x{preset.rows}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="guide-section compact nested">
                  <h2>Style Details</h2>
                  <div className="builder-grid">
                    <PromptField multi label={activeBuilderLabels.proportions} value={promptConfig.proportions} choices={activePromptChoices.proportions} onChange={(value) => updatePromptField('proportions', value)} />
                    <PromptField multi label={activeBuilderLabels.outlineStyle} value={promptConfig.outlineStyle} choices={activePromptChoices.outlineStyle} onChange={(value) => updatePromptField('outlineStyle', value)} />
                    <PromptField multi label={activeBuilderLabels.shadingStyle} value={promptConfig.shadingStyle} choices={activePromptChoices.shadingStyle} onChange={(value) => updatePromptField('shadingStyle', value)} />
                    <PromptField multi label={activeBuilderLabels.detailLevel} value={promptConfig.detailLevel} choices={activePromptChoices.detailLevel} onChange={(value) => updatePromptField('detailLevel', value)} />
                    <PromptField multi label={activeBuilderLabels.lighting} value={promptConfig.lighting} choices={activePromptChoices.lighting} onChange={(value) => updatePromptField('lighting', value)} />
                  </div>
                </section>

                <section className="guide-section compact nested">
                  <h2>Format</h2>
                  <button className="format-toggle" type="button" onClick={() => setFormatManualOpen((value) => !value)}>
                    {formatManualOpen ? 'Hide manual format' : 'Manual format override'}
                  </button>
                  {formatManualOpen && (
                    <div className="mini-grid">
                      <PromptField label="Frame px" value={promptConfig.frameSize} onChange={(value) => updatePromptField('frameSize', value)} />
                      <PromptField label="Columns" value={promptConfig.columns} onChange={(value) => updatePromptField('columns', value)} />
                      <PromptField label="Rows" value={promptConfig.rows} onChange={(value) => updatePromptField('rows', value)} />
                    </div>
                  )}
                  <div className={`reliability-card ${promptMetrics.risk}`}>
                    <div>
                      <strong>{promptMetrics.risk === 'risky' ? 'Risky for AI image models' : promptMetrics.risk === 'moderate' ? 'Moderate reliability' : 'Good reliability'}</strong>
                      <span>{promptMetrics.totalFrames} frames, {promptMetrics.canvasWidth}x{promptMetrics.canvasHeight} canvas.</span>
                    </div>
                    <div className="reliability-actions">
                      <button type="button" onClick={() => applyPromptFormat(4, 4)}>Use 4x4</button>
                      <button type="button" onClick={() => applyPromptFormat(4, 3)}>Use 4x3</button>
                    </div>
                  </div>
                </section>

                <section className="guide-section compact nested">
                  <h2>{activeFramePurpose.title}</h2>
                  <div className="checkbox-grid">
                    {activeFramePurpose.options.map((option) => (
                      <label key={option} className="check-tile">
                        <input
                          type="checkbox"
                          checked={Boolean(promptConfig.animations[option])}
                          onChange={() => togglePromptOption('animations', option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="guide-section compact nested">
                  <h2>Output Rules</h2>
                  <div className="checkbox-grid">
                    {guideOptions.map((option) => (
                      <label key={option.id} className="check-tile">
                        <input
                          type="checkbox"
                          checked={promptConfig.options[option.id]}
                          onChange={() => togglePromptOption('options', option.id)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="guide-section compact nested">
                  <div className="asset-guide-head">
                    <div>
                      <h2>Asset Notes</h2>
                      <span>{activeAssetGuide.bestFor}</span>
                    </div>
                    <button className="secondary-action compact-action" onClick={copyAssetGuide}><ClipboardCopy size={16} />Copy Guide</button>
                  </div>
                  <div className="asset-guide-meta">
                    <div><span>Target</span><strong>{activeAssetGuide.target}</strong></div>
                    <div><span>Format</span><strong>{activeAssetGuide.format}</strong></div>
                    <div><span>Avoid</span><strong>{activeAssetGuide.avoid}</strong></div>
                  </div>
                  <ul>
                    {activeAssetGuide.rules.map((rule) => <li key={rule}>{rule}</li>)}
                  </ul>
                  <textarea className="asset-guide-output" readOnly value={assetGuidePrompt} />
                </section>

                <section className="guide-section compact nested">
                  <div className="chain-header">
                    <div>
                      <h2>Step-by-Step Prompts</h2>
                      <span>Use this when one big prompt causes drift, wobble, or ignored grid rules.</span>
                    </div>
                    <button className="secondary-action compact-action" onClick={copyPromptChain}><ClipboardCopy size={16} />Copy All Steps</button>
                  </div>
                  <div className="chain-help">
                    <div>
                      <strong>Use for</strong>
                      <span>Hard sheets, rotations, big grids, or assets that keep changing between frames.</span>
                    </div>
                    <div>
                      <strong>Run order</strong>
                      <span>Copy one step at a time: reference, style spec, batch plan, batches, then assembly.</span>
                    </div>
                    <div>
                      <strong>Copy All</strong>
                      <span>Copies the whole workflow for planning. Use Copy This Step for image generation.</span>
                    </div>
                  </div>
                  <div className="chain-steps">
                    {promptChainSteps.map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        className={activeChainStep?.id === step.id ? 'active' : ''}
                        onClick={() => setActiveChainStepId(step.id)}
                      >
                        <strong>{step.title}</strong>
                        <em>{step.action}</em>
                        <span>{step.summary}</span>
                      </button>
                    ))}
                  </div>
                  {activeChainStep && (
                    <div className="chain-card">
                      <div className="chain-card-head">
                        <div>
                          <strong>{activeChainStep.title}</strong>
                          <span>{activeChainStep.summary}</span>
                        </div>
                        <button className="secondary-action compact-action" onClick={() => copyPromptChainStep(activeChainStep)}><ClipboardCopy size={16} />Copy This Step</button>
                      </div>
                      <div className="chain-card-note">
                        <strong>{activeChainStep.action}</strong>
                        <span>Paste this selected step into the AI, then come back for the next step after you approve the result.</span>
                      </div>
                      <textarea className="chain-output" readOnly value={activeChainStep.prompt} />
                    </div>
                  )}
                </section>
              </div>
            </details>
          </aside>
        </div>
      )}

      <footer className="statusbar">
        <span>SpriteForge 0.1.0</span>
        <span className="status-dot" />
        <span>{status}</span>
        <span className="push-right">{totalFrames} frames</span>
        <span>{source?.name?.split('.').pop()?.toUpperCase() ?? 'PNG'}</span>
      </footer>
    </main>
  );
}

function ProjectLibraryPanel({
  projects,
  activeProject,
  activeProjectId,
  projectNameDraft,
  projectFileInputRef,
  onSelectProject,
  onRenameProject,
  onCreateProject,
  onDeleteProject,
  onSaveAsset,
  onLoadAsset,
  onDeleteAsset,
  onExportProject,
  onImportProject,
}) {
  const assets = activeProject?.assets ?? [];

  return (
    <section className="project-library-card">
      <div className="project-library-head">
        <strong>Project Library</strong>
        <span>{assets.length} assets</span>
      </div>
      <select
        value={activeProjectId ?? ''}
        onChange={(event) => onSelectProject(event.target.value || null)}
        aria-label="Active project"
      >
        <option value="">No project selected</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
      <input
        value={projectNameDraft}
        onChange={(event) => onRenameProject(event.target.value)}
        placeholder="Project name"
      />
      <div className="project-actions">
        <button type="button" onClick={onCreateProject}>New</button>
        <button type="button" onClick={onSaveAsset}>Save Asset</button>
        <button type="button" onClick={onExportProject}>Export</button>
        <button type="button" onClick={() => projectFileInputRef.current?.click()}>Import</button>
        <button type="button" onClick={onDeleteProject}>Delete</button>
        <input
          ref={projectFileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            onImportProject(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <div className="project-asset-list">
        {assets.length ? (
          assets.slice(0, 8).map((asset) => (
            <div key={asset.id} className="project-asset-row">
              <button type="button" className="project-asset-load" onClick={() => onLoadAsset(asset)}>
                <span className="project-asset-thumb" style={{ backgroundImage: `url(${asset.source?.url})` }} />
                <span>
                  <strong>{asset.name}</strong>
                  <em>{asset.sheet?.columns ?? 1}x{asset.sheet?.rows ?? 1} - {asset.sheet?.frameWidth ?? '-'}px</em>
                </span>
              </button>
              <button type="button" className="project-asset-delete" title={`Delete ${asset.name}`} onClick={() => onDeleteAsset(asset.id)}>x</button>
            </div>
          ))
        ) : (
          <p>Save cleaned batches and source generations here while building a final sheet.</p>
        )}
      </div>
    </section>
  );
}

function ImportAnalysisPanel({ analysis, onAnalyze, onApplyLayout, onFill }) {
  if (!analysis) {
    return (
      <section className="import-analysis-card">
        <div className="import-analysis-head">
          <strong>Import Analysis</strong>
          <button type="button" onClick={onAnalyze}>Analyze</button>
        </div>
        <p>No analysis yet. Import a sheet or run analysis to get layout suggestions.</p>
      </section>
    );
  }

  const topSuggestion = analysis.suggestions[0] ?? null;
  const bestGridSuggestion = getBestSliceableSuggestion(analysis.suggestions);
  const packedSuggestion = getPackedSuggestion(analysis.suggestions);
  const bestAnimations = bestGridSuggestion ? inferAnimationsForLayout(bestGridSuggestion, analysis.detectedSprites) : [];
  const topSuggestionIsPacked = isPackedLayoutSuggestion(topSuggestion);

  return (
    <section className="import-analysis-card">
      <div className="import-analysis-head">
        <strong>Import Analysis</strong>
        <div>
          <button type="button" onClick={onAnalyze}>Refresh</button>
          <button type="button" onClick={() => onApplyLayout(bestGridSuggestion)} disabled={!bestGridSuggestion}>Apply Grid</button>
          <button type="button" onClick={onFill} disabled={!packedSuggestion}>Fill Clean</button>
        </div>
      </div>
      <div className="analysis-stats">
        <div>
          <span>Key</span>
          <strong>{analysis.keyColor ? <i style={{ backgroundColor: analysis.keyColor }} /> : null}{analysis.keyColor ?? 'alpha'}</strong>
        </div>
        <div>
          <span>Background</span>
          <strong>{analysis.background?.kind ?? 'unknown'}</strong>
        </div>
        <div>
          <span>Sprites</span>
          <strong>{analysis.detectedSprites}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>{Math.round(analysis.confidence)}%</strong>
        </div>
      </div>
      {analysis.background?.note && (
        <p className={`analysis-note ${analysis.background.kind}`}>
          {analysis.background.note}
        </p>
      )}
      {analysis.ignoredColors?.length > 0 && (
        <div className="ignored-colors">
          <span>Ignored colors</span>
          <div>
            {analysis.ignoredColors.map((color) => (
              <strong key={color}><i style={{ backgroundColor: color }} />{color}</strong>
            ))}
          </div>
        </div>
      )}
      {topSuggestionIsPacked && (
        <p className="analysis-note cleanup">
          Best match is loose sprite boxes, not a source grid. Use Fill Clean to create a centered sheet, then Apply it.
        </p>
      )}
      {bestGridSuggestion && (
        <p className="analysis-note">
          Apply Grid sets the source to {bestGridSuggestion.columns}x{bestGridSuggestion.rows} and creates {bestAnimations.length} range{bestAnimations.length === 1 ? '' : 's'}: {bestAnimations.map((animation) => `${animation.name} ${animation.start}-${animation.end}`).join(', ')}.
        </p>
      )}
      <div className="layout-suggestions">
        {analysis.suggestions.length ? (
          analysis.suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className={isPackedLayoutSuggestion(suggestion) ? 'cleanup-suggestion' : undefined}
              onClick={() => (isPackedLayoutSuggestion(suggestion) ? onFill() : onApplyLayout(suggestion))}
            >
              <span>{suggestion.columns}x{suggestion.rows}</span>
              <strong>{suggestion.frameWidth}x{suggestion.frameHeight}px</strong>
              <em>{Math.round(suggestion.confidence)}% · {isPackedLayoutSuggestion(suggestion) ? 'fill clean sheet' : suggestion.kind}</em>
            </button>
          ))
        ) : (
          <p>No reliable grid found. Try the cleanup tab to pack detected sprites instead.</p>
        )}
      </div>
    </section>
  );
}

function RotationCleanup({
  source,
  frameWidth,
  frameHeight,
  columns,
  rows,
  totalFrames,
  selectedFrame,
  setSelectedFrame,
  keyColor,
  keyTolerance,
  rotationStats,
  filledSheet,
  analyzeRotationFrames,
  autoCenterRotationFrames,
  autoDetectKeyColor,
  createFilledSheet,
  applyFilledSheet,
  exportFilledSheet,
}) {
  const statsFrames = rotationStats?.frames ?? [];
  const worstFrame = rotationStats?.worstFrame;
  const selectedStats = statsFrames.find((frame) => frame.frame === selectedFrame);
  const maxScore = Math.max(1, ...statsFrames.map((frame) => frame.score ?? 0));

  function frameBackground(frame, size = 96) {
    if (!source) return {};
    const scale = Math.min(size / frameWidth, size / frameHeight);
    const sx = (frame % columns) * frameWidth;
    const sy = Math.floor(frame / columns) * frameHeight;
    return {
      backgroundImage: `url(${source.url})`,
      backgroundSize: `${source.width * scale}px ${source.height * scale}px`,
      backgroundPosition: `-${sx * scale}px -${sy * scale}px`,
      width: frameWidth * scale,
      height: frameHeight * scale,
    };
  }

  return (
    <section className="rotation-workspace">
      <aside className="rotation-panel">
        <PanelTitle label="Rotation Cleanup" />
        <p className="rotation-copy">
          Use this for AI rotation sheets where every frame is the same cell size but the ship, character, or object drifts around inside the cells.
        </p>
        <div className="rotation-source">
          <div className="tiny-sprite" style={{ backgroundImage: `url(${source?.url})` }} />
          <div>
            <strong>{source?.name ?? 'No image loaded'}</strong>
            <span>{columns}x{rows} grid, {frameWidth}x{frameHeight}px frames</span>
          </div>
        </div>

        <div className="rotation-actions">
          <button className="secondary-action" onClick={autoDetectKeyColor}>Auto-detect Key Color</button>
          <button className="primary-action" onClick={analyzeRotationFrames}>Analyze Rotation Sheet</button>
          <button className="secondary-action" onClick={autoCenterRotationFrames}>Auto-center Frames</button>
          <button className="secondary-action" onClick={createFilledSheet}>Fill Sheet Preview</button>
          <button className="secondary-action" onClick={applyFilledSheet} disabled={!filledSheet}>Apply Filled Sheet</button>
          <button className="secondary-action" onClick={exportFilledSheet} disabled={!filledSheet}>Export Filled Sheet</button>
        </div>

        <div className="rotation-note">
          <strong>Best input</strong>
          <span>Ask the AI for a flat key color background, then set that color in Export. The analyzer ignores transparent pixels and the current key color.</span>
        </div>

        <div className="guide-grid rotation-settings">
          <span>Ignored color</span><strong>{normalizeHexColor(keyColor)}</strong>
          <span>Tolerance</span><strong>{keyTolerance} RGB levels</strong>
          <span>Total frames</span><strong>{totalFrames}</strong>
          <span>Detected frames</span><strong>{rotationStats?.validCount ?? '-'}</strong>
        </div>
      </aside>

      <section className="rotation-main">
        <header className="rotation-header">
          <div>
            <h1>Rotation Stabilizer</h1>
            <span>Detects silhouette center drift and writes per-frame offsets back into Sprite Studio.</span>
          </div>
          {rotationStats && <strong>{rotationStats.validCount} frames analyzed</strong>}
        </header>

        <div className="metric-grid">
          <div className="metric-card">
            <span>Max wobble</span>
            <strong>{rotationStats ? rotationStats.maxWobble.toFixed(1) : '-'} px</strong>
          </div>
          <div className="metric-card">
            <span>Scale variance</span>
            <strong>{rotationStats ? rotationStats.maxScaleDelta.toFixed(1) : '-'} px</strong>
          </div>
          <div className="metric-card">
            <span>Worst frame</span>
            <strong>{worstFrame ? worstFrame.frame : '-'}</strong>
          </div>
          <div className="metric-card">
            <span>Average center</span>
            <strong>{rotationStats ? `${rotationStats.avgX.toFixed(1)}, ${rotationStats.avgY.toFixed(1)}` : '-'}</strong>
          </div>
          <div className="metric-card">
            <span>Filled sheet</span>
            <strong>{filledSheet ? `${filledSheet.columns}x${filledSheet.rows}` : '-'}</strong>
          </div>
        </div>

        {filledSheet && (
          <div className="filled-sheet-card">
            <div>
              <strong>Filled centered sheet ready</strong>
              <span>
                Packed {filledSheet.count} detected frames from {columns}x{rows} into {filledSheet.columns}x{filledSheet.rows}.
                Removed {filledSheet.removedPixels.toLocaleString()} key-color pixels.
              </span>
            </div>
            <div className="filled-sheet-preview">
              <img src={filledSheet.url} alt="Filled centered sprite sheet preview" />
            </div>
          </div>
        )}

        {rotationStats ? (
          <div className="rotation-frame-grid">
            {statsFrames.map((frame) => (
              <button
                key={frame.frame}
                className={frame.frame === selectedFrame ? 'rotation-frame-row active' : 'rotation-frame-row'}
                onClick={() => selectFrame(frame.frame)}
              >
                <span>{frame.frame}</span>
                <div className="rotation-mini-preview">
                  <i style={frameBackground(frame.frame, 42)} />
                </div>
                <div className="rotation-row-data">
                  <strong>{frame.pixels ? `${frame.wobble.toFixed(1)}px drift` : 'empty frame'}</strong>
                  <small>{frame.width}x{frame.height} bounds, scale delta {frame.scaleDelta?.toFixed(1) ?? '0.0'}px</small>
                  <em><b style={{ width: `${Math.min(100, ((frame.score ?? 0) / maxScore) * 100)}%` }} /></em>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rotation-empty">
            <strong>No rotation analysis yet</strong>
            <span>Click Analyze Rotation Sheet to measure center drift, bounding boxes, and scale changes per frame.</span>
          </div>
        )}
      </section>

      <aside className="rotation-inspector">
        <PanelTitle label="Selected Frame" />
        <div className="rotation-preview">
          <div style={frameBackground(selectedFrame, 220)} />
          <i />
        </div>
        <div className="guide-grid rotation-settings">
          <span>Frame</span><strong>{selectedFrame}</strong>
          <span>Pixels</span><strong>{selectedStats?.pixels ?? '-'}</strong>
          <span>Bounds</span><strong>{selectedStats ? `${selectedStats.width}x${selectedStats.height}` : '-'}</strong>
          <span>Center</span><strong>{selectedStats ? `${selectedStats.centerX.toFixed(1)}, ${selectedStats.centerY.toFixed(1)}` : '-'}</strong>
          <span>Drift</span><strong>{selectedStats ? `${selectedStats.wobble.toFixed(1)}px` : '-'}</strong>
        </div>
        <div className="rotation-note">
          <strong>What this fixes</strong>
          <span>Position wobble from inconsistent internal placement. It cannot fully fix rotated drawings that have changed proportions, but it makes clean sheets much easier to use.</span>
        </div>
      </aside>
    </section>
  );
}

function PanelTitle({ label }) {
  return <div className="panel-title"><span>{label}</span></div>;
}

function NumberField({ label, value, min, max, onChange, suffix }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
      {suffix && <em>{suffix}</em>}
    </label>
  );
}

function PromptField({ label, value, onChange, choices = [], multi = false }) {
  const selectedChoices = multi
    ? String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
    : [value];
  const visibleChoices = choices.slice(0, multi ? 4 : 3);

  function toggleChoice(choice) {
    if (!multi) {
      onChange(choice);
      return;
    }
    const hasChoice = selectedChoices.includes(choice);
    const nextChoices = hasChoice
      ? selectedChoices.filter((item) => item !== choice)
      : [...selectedChoices, choice];
    onChange(nextChoices.join(', '));
  }

  return (
    <label className="prompt-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {visibleChoices.length > 0 && (
        <div className="choice-strip" aria-label={`${label} choices`}>
          {visibleChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              className={selectedChoices.includes(choice) ? 'choice-chip active' : 'choice-chip'}
              onClick={(event) => {
                event.preventDefault();
                toggleChoice(choice);
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div>
        <button onClick={() => onChange(clamp(value - 1, min, max))}><Minus size={14} /></button>
        <strong>{value}</strong>
        <button onClick={() => onChange(clamp(value + 1, min, max))}><Plus size={14} /></button>
      </div>
    </div>
  );
}

export default App;
