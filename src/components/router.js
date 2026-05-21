// Simple screen router — swaps innerHTML of #app
import { App } from '@capacitor/app';

const _screens = {};
let _current = null;
const _stack = []; // [{name, params}]

export function register(name, renderFn) {
  _screens[name] = renderFn;
}

export async function navigate(name, params = {}) {
  _current?.onLeave?.();

  if (name === 'menu') {
    _stack.length = 0; // reset stack at home
  }
  _stack.push({ name, params });

  const screen = _screens[name];
  if (!screen) { console.error('Unknown screen:', name); return; }
  const root = document.getElementById('app');
  root.innerHTML = '';
  // Defensive: purge any body-level overlays from the previous screen.
  // Without this, a modal-bg or result-backdrop left behind (e.g. user
  // Android-backs out of a squad-invite modal, or the screen's onLeave
  // didn't run) stays at z-index 100–200 with pointer-events:auto and
  // silently blocks every tap on the new screen — including the puzzle
  // keyboard, back button, and hint. See vc81 squad-invite bug for the
  // original trigger.
  document.querySelectorAll('body > .modal-bg, body > .result-backdrop, body > .result-sheet')
    .forEach(el => el.remove());
  _current = await screen(root, params);
  _current?.onEnter?.();
}

export async function goBack() {
  _stack.pop(); // remove current screen
  if (_stack.length === 0) {
    // Nothing to go back to — minimize instead of exit
    try { await App.minimizeApp(); } catch (_) {}
    return;
  }
  const prev = _stack.pop(); // will be re-pushed by navigate
  navigate(prev.name, prev.params);
}

// Intercept Android hardware back button
try {
  App.addListener('backButton', () => {
    if (_stack.length > 1) {
      goBack();
    } else {
      App.minimizeApp().catch(() => {});
    }
  });
} catch (_) {}
