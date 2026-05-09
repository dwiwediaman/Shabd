import { splitTiles } from './wordleMechanic.js';

const TILE_SIZE = 54;
const TILE_GAP  = 6;
const TILE_R    = 8;
const PAD       = 28;

const COLOR = {
  correct: '#16A34A',
  present: '#B45309',
  absent:  '#374151',
  empty:   '#1F2937',
  bg:      '#0F0F1A',
  border:  '#374151',
};

export async function renderShareImage(puzzle, history) {
  const cols   = puzzle.tileCount;
  const rows   = puzzle.maxGuesses;
  const won    = history.length > 0 && history[history.length - 1].isCorrect;
  const score  = won ? `${history.length}/${rows}` : `X/${rows}`;
  const label  = `${puzzle.lang === 'hi' ? 'HI' : 'EN'} #${puzzle.puzzleIndex}`;

  const gridW = cols * TILE_SIZE + (cols - 1) * TILE_GAP;
  const gridH = rows * TILE_SIZE + (rows - 1) * TILE_GAP;
  const W = PAD * 2 + gridW;
  const HEADER_H = 76;
  const FOOTER_H = 44;
  const H = HEADER_H + PAD + gridH + PAD + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width  = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, H);

  // ── Header ────────────────────────────────────────────────────────────────
  const titleGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  titleGrad.addColorStop(0, '#7C3AED');
  titleGrad.addColorStop(1, '#F5A623');

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font         = 'bold 30px "Space Grotesk", sans-serif';
  ctx.fillStyle    = titleGrad;
  ctx.fillText('Shabd', W / 2, 36);

  ctx.font      = '500 14px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#C4B5FD';
  ctx.fillText(`${label}  ·  ${score}`, W / 2, 58);

  // Divider
  ctx.strokeStyle = '#2D2D4E';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 68);
  ctx.lineTo(W - PAD, 68);
  ctx.stroke();

  // ── Tile grid ─────────────────────────────────────────────────────────────
  const tileFont = puzzle.lang === 'hi'
    ? 'bold 18px "Noto Sans Devanagari", sans-serif'
    : 'bold 20px "Space Grotesk", sans-serif';

  for (let r = 0; r < rows; r++) {
    const guess = history[r];
    const tiles = guess ? splitTiles(guess.input, puzzle.lang) : [];
    const y     = HEADER_H + PAD + r * (TILE_SIZE + TILE_GAP);

    for (let c = 0; c < cols; c++) {
      const x     = PAD + c * (TILE_SIZE + TILE_GAP);
      const state = guess?.perTileState[c];

      if (state) {
        ctx.fillStyle = COLOR[state] ?? COLOR.absent;
        rRect(ctx, x, y, TILE_SIZE, TILE_SIZE, TILE_R);
        ctx.fill();
      } else {
        ctx.strokeStyle = COLOR.border;
        ctx.lineWidth   = 1.5;
        rRect(ctx, x, y, TILE_SIZE, TILE_SIZE, TILE_R);
        ctx.stroke();
      }

      const letter = tiles[c];
      if (letter) {
        ctx.fillStyle    = '#FFFFFF';
        ctx.font         = tileFont;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter.toUpperCase(), x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
      }
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = HEADER_H + PAD + gridH + PAD;

  ctx.strokeStyle = '#2D2D4E';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, footY);
  ctx.lineTo(W - PAD, footY);
  ctx.stroke();

  ctx.font         = '500 13px "Space Grotesk", sans-serif';
  ctx.fillStyle    = '#6B7280';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('shabd.in', W / 2, footY + FOOTER_H / 2);

  return canvas;
}

export async function shareImage(puzzle, history, fallbackText) {
  try {
    const canvas = await renderShareImage(puzzle, history);
    const blob   = await canvasToBlob(canvas);
    const file   = new File([blob], 'shabd-result.png', { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'shared';
    }

    // Fallback: download image
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'shabd-result.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    // Final fallback: text
    if (navigator.share) {
      navigator.share({ text: fallbackText }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(fallbackText);
    }
    return 'text';
  }
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function rRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
