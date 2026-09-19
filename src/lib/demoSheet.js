export function createDemoSheet({ frameSize = 32, columns = 8, rows = 3 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = columns * frameSize;
  canvas.height = rows * frameSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const palette = ['#18202a', '#2b3f55', '#126c72', '#43a6a5', '#70422b', '#a76b43', '#e6b77e', '#f6d8a9', '#d9edf0', '#f0a83b'];

  for (let i = 0; i < columns * rows; i += 1) {
    const ox = (i % columns) * frameSize;
    const oy = Math.floor(i / columns) * frameSize;
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
    name: `demo_knight_${frameSize}.png`,
    url: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}
