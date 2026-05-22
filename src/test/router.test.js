// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// @capacitor/app is unused in unit tests (the back-button binding silently
// fails outside Capacitor); stub so the import resolves.
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(), minimizeApp: vi.fn(() => Promise.resolve()) },
}));

// Build a minimal DOM so router.navigate can find #app and the orphan-sweep
// query selector can find/remove .modal-bg etc.
function freshDom() {
  document.body.innerHTML = '<div id="app"></div>';
}

const { register, navigate, goBack } = await import('../components/router.js');

beforeEach(() => {
  freshDom();
});

describe('router.navigate — stack semantics', () => {
  it('renders the requested screen and stores its onLeave', async () => {
    const onLeave = vi.fn();
    register('A', () => ({ onLeave }));
    register('B', () => ({}));

    await navigate('A');
    await navigate('B'); // should fire A.onLeave on the way out
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("navigate('menu') resets the stack so goBack from menu minimizes", async () => {
    register('menu',    () => ({}));
    register('squads',  () => ({}));

    await navigate('menu');
    await navigate('squads');
    await navigate('menu'); // stack reset to just [menu]
    // From here, goBack would pop menu and find the stack empty.
    // We can't easily assert minimizeApp directly but we can assert the
    // stack is in fact reset by checking that goBack does NOT re-render
    // squads.
    const squadsRender = vi.fn(() => ({}));
    register('squads', squadsRender);
    await goBack();
    expect(squadsRender).not.toHaveBeenCalled();
  });
});

// ── Regression: vc87 puzzle back button hardcoded navigate('menu') ─────────
describe('router.goBack — vc87 returns to caller, not menu', () => {
  it('menu → archive → puzzle, goBack lands on archive (not menu)', async () => {
    const menuRender    = vi.fn(() => ({}));
    const archiveRender = vi.fn(() => ({}));
    const puzzleRender  = vi.fn(() => ({}));
    register('menu',    menuRender);
    register('archive', archiveRender);
    register('puzzle',  puzzleRender);

    await navigate('menu');
    await navigate('archive');
    await navigate('puzzle', { mode: 'archive', date: '2026-04-12' });

    menuRender.mockClear();
    archiveRender.mockClear();
    puzzleRender.mockClear();
    await goBack();

    expect(archiveRender).toHaveBeenCalledTimes(1);
    expect(menuRender).not.toHaveBeenCalled();
    expect(puzzleRender).not.toHaveBeenCalled();
  });

  it('preserves params when re-navigating to the previous screen', async () => {
    register('menu',    () => ({}));
    register('squads',  () => ({}));
    const detail = vi.fn(() => ({}));
    register('squadDetail', detail);

    await navigate('menu');
    await navigate('squads');
    await navigate('squadDetail', { squadId: 'abc123' });
    await navigate('squads'); // forward nav to squads (no params)
    detail.mockClear();
    await goBack(); // should re-render squadDetail with original params

    expect(detail).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      { squadId: 'abc123' }
    );
  });
});

// ── Regression: vc81 router purges orphan modal-bg / result-backdrop ──────
// A stuck modal from a previous screen used to block all taps on the next
// screen. navigate() must remove orphan overlays before rendering.
describe('router.navigate — vc81 orphan overlay sweep', () => {
  it('removes a leftover modal-bg before the new screen mounts', async () => {
    register('menu',   () => ({}));
    register('puzzle', () => ({}));
    await navigate('menu');

    // Simulate a screen that left a modal-bg attached to body.
    const orphan = document.createElement('div');
    orphan.className = 'modal-bg';
    document.body.appendChild(orphan);
    expect(document.querySelector('body > .modal-bg')).toBe(orphan);

    await navigate('puzzle');
    expect(document.querySelector('body > .modal-bg')).toBeNull();
  });

  it('removes leftover result-backdrop and result-sheet too', async () => {
    register('menu',   () => ({}));
    register('puzzle', () => ({}));
    await navigate('menu');

    document.body.appendChild(Object.assign(document.createElement('div'),
      { className: 'result-backdrop' }));
    document.body.appendChild(Object.assign(document.createElement('div'),
      { className: 'result-sheet' }));

    await navigate('puzzle');
    expect(document.querySelector('body > .result-backdrop')).toBeNull();
    expect(document.querySelector('body > .result-sheet')).toBeNull();
  });

  it('does not touch overlays inside #app (only body-level orphans)', async () => {
    register('screen', (root) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-bg';
      root.appendChild(overlay);
      return {};
    });
    register('other', () => ({}));

    await navigate('screen');
    // The screen's own modal-bg is inside #app — should survive its own
    // mount (and naturally die when the screen swaps).
    expect(document.querySelector('#app .modal-bg')).not.toBeNull();
    expect(document.querySelector('body > .modal-bg')).toBeNull();

    await navigate('other');
    // After swap, the in-#app overlay is gone via root.innerHTML = ''.
    expect(document.querySelector('#app .modal-bg')).toBeNull();
  });
});
