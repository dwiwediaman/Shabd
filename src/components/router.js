// Simple screen router — swaps innerHTML of #app
const _screens = {};
let _current = null;

export function register(name, renderFn) {
  _screens[name] = renderFn;
}

export async function navigate(name, params = {}) {
  _current?.onLeave?.();
  const screen = _screens[name];
  if (!screen) { console.error('Unknown screen:', name); return; }
  const root = document.getElementById('app');
  root.innerHTML = '';
  _current = await screen(root, params);
  _current?.onEnter?.();
}
