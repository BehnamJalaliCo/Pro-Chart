export const OPEN_SEARCH_EVENT = 'bn:openSearch';

// Keep application-level event dispatch safe for browser and non-browser renders.
// The injectable target/constructor also lets the activation contract be unit-tested
// without replacing browser globals.
export function dispatchOpenSearch({
  target = globalThis.window,
  EventCtor = globalThis.CustomEvent,
} = {}) {
  if (!target || typeof target.dispatchEvent !== 'function' || typeof EventCtor !== 'function') return false;
  try {
    target.dispatchEvent(new EventCtor(OPEN_SEARCH_EVENT));
    return true;
  } catch (e) {
    return false;
  }
}
