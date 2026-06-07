import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

// ── Design tokens ──────────────────────────────────────────────────────────
const TILE   = 52;
const GAP    = 7;
const PAD    = 32;
const RADIUS = 10;

const C = {
  bg:      '#0D0D1F',
  correct: '#16A34A',
  present: '#B45309',
  absent:  '#252540',
  border:  '#2D2D50',
  white:   '#FFFFFF',
  muted:   '#6B7280',
  tag:     '#1A1A35',
};

// ── Font preload (call once at app boot) ───────────────────────────────────
let _fontsReady = false;
export async function preloadShareFonts() {
  if (!_fontsReady) { await document.fonts.ready; _fontsReady = true; }
}

// ── Canvas renderer ────────────────────────────────────────────────────────
export async function renderShareImage(puzzle, history) {
  await preloadShareFonts();

  const cols   = puzzle.tileCount;
  const rows   = puzzle.maxGuesses;
  const won    = history.length > 0 && history[history.length - 1].isCorrect;
  const score  = won ? `${history.length}/${rows}` : `X/${rows}`;
  const isHi   = puzzle.lang === 'hi';
  const lang   = isHi ? 'HI' : 'EN';

  const gridW  = cols * TILE + (cols - 1) * GAP;
  const W      = PAD * 2 + gridW;
  const HDR    = 100;
  const GRID_H = rows * TILE + (rows - 1) * GAP;
  const FTR    = 52;
  const H      = HDR + PAD + GRID_H + PAD + FTR;

  const DPR    = 3;
  const canvas = document.createElement('canvas');
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, -20, 0, W / 2, -20, W);
  glow.addColorStop(0, 'rgba(124,58,237,0.28)');
  glow.addColorStop(0.6, 'rgba(124,58,237,0.06)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Title
  const tg = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  tg.addColorStop(0, '#A78BFA');
  tg.addColorStop(0.5, '#7C3AED');
  tg.addColorStop(1, '#F5A623');
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font         = 'bold 38px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle    = tg;
  ctx.fillText('Shabd', W / 2, 44);

  ctx.font      = '500 12px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#8B5CF6';
  ctx.fillText('Daily Word · रोज़ पहेली', W / 2, 63);

  // Score pill
  const pillText = `${lang} #${puzzle.puzzleIndex}  ·  ${score}`;
  ctx.font = '600 13px "Space Grotesk", system-ui, sans-serif';
  const pillW = ctx.measureText(pillText).width + 28;
  const pillX = (W - pillW) / 2;
  const pillY = 72, pillH = 24;
  ctx.fillStyle = C.tag;
  rRect(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.fill();
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  rRect(ctx, pillX, pillY, pillW, pillH, pillH / 2); ctx.stroke();
  ctx.fillStyle    = won ? '#86EFAC' : '#F87171';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, W / 2, pillY + pillH / 2);

  // Tiles
  for (let r = 0; r < rows; r++) {
    const guess = history[r];
    const gy    = HDR + PAD + r * (TILE + GAP);

    for (let c = 0; c < cols; c++) {
      const gx    = PAD + c * (TILE + GAP);
      const state = guess?.perTileState[c];

      if (state) {
        const tc = state === 'correct' ? C.correct : state === 'present' ? C.present : C.absent;
        if (state !== 'absent') { ctx.shadowColor = tc; ctx.shadowBlur = 10; }
        ctx.fillStyle = tc;
        rRect(ctx, gx, gy, TILE, TILE, RADIUS); ctx.fill();
        ctx.shadowBlur = 0;

        const shine = ctx.createLinearGradient(gx, gy, gx, gy + TILE * 0.5);
        shine.addColorStop(0, 'rgba(255,255,255,0.12)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        rRect(ctx, gx, gy, TILE, TILE, RADIUS); ctx.fill();
        // Letters intentionally omitted — sharing colour pattern only, not the word
      } else {
        ctx.strokeStyle = C.border; ctx.lineWidth = 1.5;
        rRect(ctx, gx, gy, TILE, TILE, RADIUS); ctx.stroke();
      }
    }
  }

  // Footer
  const footY = HDR + PAD + GRID_H + PAD;
  const dg = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  dg.addColorStop(0, 'transparent'); dg.addColorStop(0.25, C.border);
  dg.addColorStop(0.75, C.border); dg.addColorStop(1, 'transparent');
  ctx.strokeStyle = dg; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, footY); ctx.lineTo(W - PAD, footY); ctx.stroke();

  ctx.font         = '600 13px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle    = C.muted;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("Can you beat this? 👉 Get 'Shabd' on Google Play", W / 2, footY + FTR / 2);

  return canvas;
}

// ── Pre-render cache (call when game ends, before user taps Share) ─────────
let _cache = null; // { canvas, blob, puzzle, history }

export async function preRenderShare(puzzle, history) {
  try {
    const canvas = await renderShareImage(puzzle, history);
    const blob   = await canvasToBlob(canvas);
    _cache = { canvas, blob };
  } catch (e) {
    _cache = null;
  }
}

// ── Main share entry point ─────────────────────────────────────────────────
// Call this directly inside the user-gesture handler (tap).
//
// On native (Capacitor Android/iOS): writes PNG to cache dir, calls Capacitor
// Share plugin which fires Android's Intent.ACTION_SEND — the real native
// sharesheet with the image attached. WhatsApp / Instagram / Telegram all
// receive it as a proper image, not text.
//
// On web: tries Web Share API with files, falls back to custom sheet.
export async function shareImage(puzzle, history, fallbackText) {
  // Use pre-rendered cache, or render now if somehow not ready
  let canvas, blob;
  if (_cache) {
    ({ canvas, blob } = _cache);
    _cache = null;
  } else {
    canvas = await renderShareImage(puzzle, history);
    blob   = await canvasToBlob(canvas);
  }

  // ── Native (Capacitor): write to filesystem + use Share plugin ───────────
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await blobToBase64(blob);
      const fileName = `shabd-result-${Date.now()}.png`;
      const writeResult = await Filesystem.writeFile({
        path:      fileName,
        data:      base64,
        directory: Directory.Cache,
      });
      // writeResult.uri is a file:// URI Android attaches to Intent.ACTION_SEND.
      // IMPORTANT: do NOT pass `text` here alongside the image url.
      // Android Direct Share targets (the recent-chat chips at the top of the
      // share sheet) are registered for a single MIME type (image/png).  When
      // the Intent carries both EXTRA_STREAM *and* EXTRA_TEXT, the Direct Share
      // target receives it but silently drops the text, causing WhatsApp to
      // treat the share as malformed and swallow it.  Passing only the image
      // URL fixes Direct Share while the full-app-icon path still works fine.
      await Share.share({
        title:       'Shabd',
        url:         writeResult.uri,
        dialogTitle: 'Share your Shabd result',
      });
      return 'shared';
    } catch (e) {
      // If user cancels, Capacitor throws — treat as cancelled, not error
      if (String(e?.message || '').toLowerCase().includes('cancel')) return 'cancelled';
      console.warn('Native share failed, falling back:', e);
      // Fall through to custom sheet
    }
  }

  // ── Web: Web Share API with files (Chrome desktop / iOS Safari) ──────────
  if (typeof File !== 'undefined') {
    const file = new File([blob], 'shabd-result.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: fallbackText, title: 'Shabd' });
        return 'shared';
      } catch (e) {
        if (e?.name === 'AbortError') return 'cancelled';
      }
    }
  }

  // ── Custom sheet (desktop browsers without Web Share) ────────────────────
  showShareSheet(canvas, blob, fallbackText);
  return 'sheet';
}

// Convert Blob → base64 string (without data: prefix) — required by Filesystem.writeFile
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result; // "data:image/png;base64,XXXX"
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Custom share sheet ─────────────────────────────────────────────────────
function showShareSheet(canvas, blob, text) {
  // Remove existing
  document.getElementById('customShareSheet')?.remove();
  document.getElementById('customShareBg')?.remove();

  const imgDataUrl = canvas.toDataURL('image/png');
  const waText     = encodeURIComponent(text);

  const bg = document.createElement('div');
  bg.id = 'customShareBg';
  bg.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100000;
    display:flex;align-items:flex-end;justify-content:center;
    animation:fadeIn .2s ease;
  `;

  const sheet = document.createElement('div');
  sheet.id = 'customShareSheet';
  sheet.style.cssText = `
    background:#161628;border-radius:24px 24px 0 0;padding:20px 20px 36px;
    width:100%;max-width:480px;box-sizing:border-box;
    animation:slideUp .3s cubic-bezier(.34,1.56,.64,1);
  `;

  sheet.innerHTML = `
    <div style="width:40px;height:4px;background:#2D2D50;border-radius:2px;margin:0 auto 20px;"></div>
    <div style="font:700 16px 'Space Grotesk',sans-serif;color:#fff;text-align:center;margin-bottom:16px;">Share Result</div>

    <img src="${imgDataUrl}" style="width:100%;max-width:220px;display:block;margin:0 auto 20px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);"/>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">

      <button id="ss-whatsapp" style="${btnStyle('#25D366')}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.053 23.447a.5.5 0 0 0 .607.606l5.688-1.488A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.802 9.802 0 0 1-5.045-1.396l-.361-.214-3.737.979.997-3.645-.235-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
        <span style="font:600 11px sans-serif;color:#fff;margin-top:4px;display:block">WhatsApp</span>
      </button>

      <button id="ss-native" style="${btnStyle('#7C3AED')}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        <span style="font:600 11px sans-serif;color:#fff;margin-top:4px;display:block">Share</span>
      </button>

      <button id="ss-copy" style="${btnStyle('#374151')}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span style="font:600 11px sans-serif;color:#fff;margin-top:4px;display:block">Copy Text</span>
      </button>

      <button id="ss-download" style="${btnStyle('#374151')}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span style="font:600 11px sans-serif;color:#fff;margin-top:4px;display:block">Save Image</span>
      </button>
    </div>

    <button id="ss-cancel" style="width:100%;padding:14px;border:none;background:#1E1E3A;border-radius:14px;color:#9CA3AF;font:600 15px 'Space Grotesk',sans-serif;cursor:pointer;">Cancel</button>
  `;

  // Add keyframe styles once
  if (!document.getElementById('shareSheetStyles')) {
    const style = document.createElement('style');
    style.id = 'shareSheetStyles';
    style.textContent = `
      @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    `;
    document.head.appendChild(style);
  }

  bg.appendChild(sheet);
  document.body.appendChild(bg);

  function close() { bg.remove(); }

  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  sheet.querySelector('#ss-cancel').addEventListener('click', close);

  // Helper: try Capacitor native share (with image), fall back to Web Share
  async function tryNativeShareWithImage() {
    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = await blobToBase64(blob);
        const writeResult = await Filesystem.writeFile({
          path:      `shabd-result-${Date.now()}.png`,
          data:      base64,
          directory: Directory.Cache,
        });
        // text omitted — see note in shareImage() above about Direct Share MIME type conflict
        await Share.share({ title: 'Shabd', url: writeResult.uri, dialogTitle: 'Share your Shabd result' });
        return true;
      } catch (e) { /* fall through */ }
    }
    const file = new File([blob], 'shabd-result.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: 'Shabd' }); return true; }
      catch (e) { if (e?.name === 'AbortError') return true; }
    }
    return false;
  }

  // WhatsApp — native share with image (works on Android + iOS Capacitor)
  sheet.querySelector('#ss-whatsapp').addEventListener('click', async () => {
    const ok = await tryNativeShareWithImage();
    if (!ok) window.open(`https://wa.me/?text=${waText}`, '_blank'); // last-resort web fallback
    close();
  });

  // Native share (any app)
  sheet.querySelector('#ss-native').addEventListener('click', async () => {
    await tryNativeShareWithImage();
    close();
  });

  // Copy text
  sheet.querySelector('#ss-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
    const btn = sheet.querySelector('#ss-copy span');
    btn.textContent = 'Copied!';
    setTimeout(close, 900);
  });

  // Download image
  sheet.querySelector('#ss-download').addEventListener('click', () => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = 'shabd-result.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    close();
  });
}

function btnStyle(bg) {
  return `background:${bg};border:none;border-radius:14px;padding:12px 8px;
    display:flex;flex-direction:column;align-items:center;cursor:pointer;
    transition:opacity .15s;width:100%;`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function rRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
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
