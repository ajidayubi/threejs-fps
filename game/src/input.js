// Keyboard + mouse + pointer lock. One owner of the listeners; the sim reads
// the state object, never the DOM, so replays stay deterministic.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseDX: 0, mouseDY: 0,
    firing: false,
    locked: false,
    onKey: null,      // (code) => void, for menu keys the sim handles
    onLockChange: null,
  };
  const down = (e) => {
    if (e.code === 'Tab') e.preventDefault();
    input.keys.add(e.code);
    if (input.onKey) input.onKey(e.code);
  };
  const up = (e) => input.keys.delete(e.code);
  const move = (e) => {
    if (!input.locked) return;
    input.mouseDX += e.movementX || 0;
    input.mouseDY += e.movementY || 0;
  };
  const mdown = (e) => { if (e.button === 0) input.firing = true; };
  const mup = (e) => { if (e.button === 0) input.firing = false; };
  const lock = () => {
    input.locked = document.pointerLockElement === canvas;
    if (input.onLockChange) input.onLockChange(input.locked);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('mousemove', move);
  window.addEventListener('mousedown', mdown);
  window.addEventListener('mouseup', mup);
  document.addEventListener('pointerlockchange', lock);
  input.requestLock = () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  };
  input.releaseLock = () => { if (document.pointerLockElement) document.exitPointerLock(); };
  input.consumeMouse = () => {
    const dx = input.mouseDX, dy = input.mouseDY;
    input.mouseDX = 0; input.mouseDY = 0;
    return { dx, dy };
  };
  return input;
}
