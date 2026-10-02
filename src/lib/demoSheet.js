import { BOOT, DEMO_PALETTE, GLOVE, HOOD, TUNIC } from '../data/demoCharacter.js';

const ART_SIZE = 48;
export const DEMO_ANIMATIONS = [
  { id: 'idle', name: 'idle', start: 0, end: 3, fps: 5, loop: true },
  { id: 'walk', name: 'walk', start: 4, end: 11, fps: 10, loop: true },
  { id: 'attack', name: 'attack', start: 12, end: 17, fps: 10, loop: false },
  { id: 'hurt', name: 'hurt', start: 18, end: 19, fps: 6, loop: false },
  { id: 'cast', name: 'cast', start: 20, end: 23, fps: 8, loop: true },
];

function pixel(ctx, color, x, y, width = 1, height = 1) {
  ctx.fillStyle = DEMO_PALETTE[color];
  ctx.fillRect(x, y, width, height);
}

function stamp(ctx, art, x, y) {
  art.forEach((row, rowIndex) => {
    [...row].forEach((color, column) => {
      if (color !== ' ') pixel(ctx, color, x + column, y + rowIndex);
    });
  });
}

function line(ctx, color, x0, y0, x1, y1, width = 1) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    pixel(ctx, color, x0 - Math.floor(width / 2), y0 - Math.floor(width / 2), width, width);
    if (x0 === x1 && y0 === y1) break;
    const doubleError = error * 2;
    if (doubleError >= dy) { error += dy; x0 += sx; }
    if (doubleError <= dx) { error += dx; y0 += sy; }
  }
}

function sword(ctx, hand, tip) {
  line(ctx, 'O', hand.x, hand.y, tip.x, tip.y, 4);
  line(ctx, 'I', hand.x, hand.y, tip.x, tip.y, 2);
  line(ctx, 'i', hand.x, hand.y - 1, tip.x, tip.y - 1);
  pixel(ctx, 'O', hand.x - 3, hand.y - 1, 7, 3);
  pixel(ctx, 'G', hand.x - 2, hand.y, 5, 1);
  stamp(ctx, GLOVE, hand.x - 2, hand.y);
}

export function drawDemoFrame(ctx, frame) {
  const index = frame % 24;
  const walking = index >= 4 && index <= 11;
  const attacking = index >= 12 && index <= 17;
  const hurt = index >= 18 && index <= 19;
  const casting = index >= 20;
  const step = walking ? index - 4 : 0;
  const phase = attacking ? index - 12 : casting ? index - 20 : index;
  const stride = walking ? [0, 1, 2, 1, 0, -1, -2, -1][step] : 0;
  const lean = attacking ? [0, -1, 1, 2, 1, 0][phase] : hurt ? -2 + (index - 18) : 0;
  const bob = walking ? [0, -1, -2, -1, 0, -1, -2, -1][step]
    : hurt ? 1 : attacking ? [0, -1, 0, 1, 0, 0][phase] : index === 2 ? -1 : 0;
  const sway = walking ? stride : [0, 1, 0, -1][index % 4];

  // Cloak silhouette and scarf tails sit behind the body.
  for (let row = 0; row < 22; row += 1) {
    const left = 15 + lean - Math.floor(row / 4) + (row > 10 ? sway : 0);
    const width = 10 + Math.floor(row / 5);
    pixel(ctx, 'O', left, 17 + row + bob, width);
    pixel(ctx, row > 15 ? 'D' : 'T', left + 1, 17 + row + bob, width - 2);
    if (row < 15) pixel(ctx, 'L', left + 2, 17 + row + bob);
  }
  line(ctx, 's', 21 + lean, 20 + bob, 11 + sway + lean, 24 + bob, 3);
  line(ctx, 'S', 21 + lean, 19 + bob, 11 + sway + lean, 22 + bob, 2);
  pixel(ctx, 'S', 10 + sway + lean, 23 + bob, 3, 2);

  const frontLift = walking ? [0, 2, 3, 1, 0, 0, 0, 0][step] : 0;
  const backLift = walking ? [0, 0, 0, 0, 0, 2, 3, 1][step] : 0;
  pixel(ctx, 'O', 21 - stride + lean, 31 + bob, 4, 9 - bob - backLift);
  pixel(ctx, 'N', 22 - stride + lean, 32 + bob, 2, 7 - bob - backLift);
  stamp(ctx, BOOT, 19 - stride + lean, 37 - backLift);
  pixel(ctx, 'O', 29 + stride + lean, 31 + bob, 4, 9 - bob - frontLift);
  pixel(ctx, 'n', 30 + stride + lean, 32 + bob, 2, 7 - bob - frontLift);
  stamp(ctx, BOOT, 27 + stride + lean, 37 - frontLift);
  stamp(ctx, TUNIC, 17 + lean, 20 + bob);
  stamp(ctx, HOOD, 17 + lean, 5 + bob);
  pixel(ctx, 's', 22 + lean, 19 + bob, 13, 3);
  pixel(ctx, 'S', 23 + lean, 19 + bob, 11, 1);
  pixel(ctx, 'G', 31 + lean, 20 + bob, 2, 1);

  const hand = casting ? { x: 35, y: 25 } : attacking
    ? [{ x: 31, y: 23 }, { x: 31, y: 21 }, { x: 34, y: 24 }, { x: 35, y: 28 }, { x: 33, y: 29 }, { x: 32, y: 28 }][phase]
    : { x: 32 + lean + stride, y: 28 + bob + (walking && step >= 4 ? 1 : 0) };
  line(ctx, 'O', 28 + lean, 24 + bob, hand.x, hand.y, 5);
  line(ctx, 'n', 28 + lean, 24 + bob, hand.x, hand.y, 3);
  if (casting) {
    stamp(ctx, GLOVE, hand.x - 2, hand.y);
    const radius = [2, 3, 4, 3][phase];
    for (let y = -radius; y <= radius; y += 1) {
      const halfWidth = radius - Math.floor(Math.abs(y) / 2);
      pixel(ctx, 'T', 40 - halfWidth, 13 + y, halfWidth * 2 + 1);
    }
    pixel(ctx, 'C', 39, 12, 3, 3);
    pixel(ctx, 'W', 40, 12);
    pixel(ctx, 'C', 36 - phase, 10 + phase, 1, 2);
    pixel(ctx, 'G', 44, 19 - phase, 1, 2);
  } else {
    const tip = attacking
      ? [{ x: 24, y: 9 }, { x: 32, y: 6 }, { x: 43, y: 14 }, { x: 44, y: 28 }, { x: 41, y: 36 }, { x: 41, y: 33 }][phase]
      : { x: 41 + lean, y: 33 + bob };
    sword(ctx, hand, tip);
    if (attacking && (phase === 2 || phase === 3)) {
      line(ctx, 'C', 40, 9 + phase, 45, 16 + phase);
      line(ctx, 'i', 45, 16 + phase, 46, 24 + phase);
    }
  }
  if (hurt) {
    pixel(ctx, 'S', 38, 8 + (index - 18), 1, 5);
    pixel(ctx, 'G', 36, 10 + (index - 18), 5, 1);
    pixel(ctx, 'S', 42, 16, 2, 2);
  } else if (index === 3) {
    pixel(ctx, 'F', 26, 14, 2, 2);
    pixel(ctx, 'O', 26, 15, 2, 1);
  }
}

export function createDemoSheet({ frameSize = ART_SIZE, columns = 8, rows = 3 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = columns * frameSize;
  canvas.height = rows * frameSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const frame = document.createElement('canvas');
  frame.width = ART_SIZE;
  frame.height = ART_SIZE;
  const frameCtx = frame.getContext('2d');
  for (let index = 0; index < columns * rows; index += 1) {
    frameCtx.clearRect(0, 0, ART_SIZE, ART_SIZE);
    drawDemoFrame(frameCtx, index);
    ctx.drawImage(frame, (index % columns) * frameSize, Math.floor(index / columns) * frameSize, frameSize, frameSize);
  }
  return {
    name: `demo_ranger_${frameSize}.png`, url: canvas.toDataURL('image/png'),
    width: canvas.width, height: canvas.height,
    layout: { frameWidth: frameSize, frameHeight: frameSize, columns, rows,
      pivot: { x: Math.round(frameSize / 2), y: Math.round(frameSize * 44 / ART_SIZE) } },
  };
}
