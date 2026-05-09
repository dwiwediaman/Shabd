import { get } from './game/gameState.js';

// ── Audio context (lazy init on first user gesture) ───────────────────────
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone({ frequency = 440, type = 'sine', duration = 0.08, gain = 0.25, delay = 0 } = {}) {
  if (!get().settings.sound) return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const vol = ac.createGain();
    osc.connect(vol);
    vol.connect(ac.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    vol.gain.setValueAtTime(gain, ac.currentTime + delay);
    vol.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.01);
  } catch (_) {}
}

// ── Haptics (Capacitor) ───────────────────────────────────────────────────
async function vibrate(style = 'LIGHT') {
  if (!get().settings.haptics) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (style === 'SUCCESS') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (style === 'ERROR') {
      await Haptics.notification({ type: NotificationType.Error });
    } else if (style === 'MEDIUM') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (style === 'HEAVY') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch (_) {}
}

// ── Public API ────────────────────────────────────────────────────────────

/** Key tap on keyboard */
export function feedbackKeyPress() {
  playTone({ frequency: 300, type: 'triangle', duration: 0.05, gain: 0.15 });
  vibrate('LIGHT');
}

/** Backspace */
export function feedbackBackspace() {
  playTone({ frequency: 220, type: 'triangle', duration: 0.04, gain: 0.1 });
  vibrate('LIGHT');
}

/** Invalid word — shake */
export function feedbackInvalid() {
  playTone({ frequency: 180, type: 'sawtooth', duration: 0.12, gain: 0.2 });
  playTone({ frequency: 140, type: 'sawtooth', duration: 0.1, gain: 0.15, delay: 0.1 });
  vibrate('ERROR');
}

/** Single tile reveal flip */
export function feedbackTileReveal(index = 0) {
  playTone({ frequency: 350 + index * 30, type: 'sine', duration: 0.07, gain: 0.12, delay: index * 0.12 });
}

/** Win celebration */
export function feedbackWin() {
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    playTone({ frequency: freq, type: 'sine', duration: 0.18, gain: 0.2, delay: i * 0.15 });
  });
  vibrate('SUCCESS');
}

/** Loss */
export function feedbackLoss() {
  playTone({ frequency: 300, type: 'sawtooth', duration: 0.2, gain: 0.2 });
  playTone({ frequency: 220, type: 'sawtooth', duration: 0.3, gain: 0.15, delay: 0.2 });
  vibrate('HEAVY');
}

/** Hint reveal */
export function feedbackHint() {
  playTone({ frequency: 660, type: 'sine', duration: 0.1, gain: 0.18 });
  playTone({ frequency: 880, type: 'sine', duration: 0.1, gain: 0.15, delay: 0.1 });
  vibrate('MEDIUM');
}
