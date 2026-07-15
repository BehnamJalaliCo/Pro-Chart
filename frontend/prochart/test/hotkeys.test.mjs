import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// attachHotkeys عمداً در SSR بدون window no-op است؛ برای unit test فقط root
// رویداد ساختگی لازم داریم و هیچ DOM API واقعی استفاده نمی‌شود.
globalThis.window = {};
const { attachHotkeys, SHORTCUTS, SHORTCUT_GROUPS } = await import('../src/bazaarnama/hotkeys.js');

const bazaarNamaSource = fs.readFileSync(
  new URL('../src/pages/BazaarNama.jsx', import.meta.url),
  'utf8',
);
const drawingsSource = fs.readFileSync(
  new URL('../src/bazaarnama/drawings.js', import.meta.url),
  'utf8',
);

function authoritativeHandlerBlock(source) {
  const startMarker = 'const detach = attachHotkeys({';
  const endMarker = '}, { target: window });';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, 'BazaarNama must install the authoritative hotkey dispatcher');
  assert.notEqual(end, -1, 'BazaarNama hotkey dispatcher must have an auditable boundary');
  return source.slice(start, end);
}

test('every advertised shortcut is wired through the authoritative dispatcher', () => {
  const block = authoritativeHandlerBlock(bazaarNamaSource);
  const missing = SHORTCUTS
    .map(({ id }) => id)
    .filter((id) => !new RegExp(`\\b${id}\\s*:`).test(block));

  assert.deepEqual(missing, []);
});

test('drawing commands owned by the registry have no second window dispatcher', () => {
  const start = drawingsSource.indexOf('const key = (e) => {');
  const end = drawingsSource.indexOf('// پایان‌دادنِ خطِ چندتکه', start);
  assert.notEqual(start, -1, 'DrawingLayer key listener must remain auditable');
  assert.notEqual(end, -1, 'DrawingLayer key listener must have an auditable boundary');
  const localKeyListener = drawingsSource.slice(start, end);
  const duplicateCommands = [
    ['deleteSel', /e\.key === 'Delete'|e\.key === 'Backspace'/],
    ['cloneSel', /e\.key\.toLowerCase\(\) === 'd'/],
    ['undo', /e\.key\.toLowerCase\(\) === 'z'/],
    ['redo', /e\.key\.toLowerCase\(\) === 'y'/],
    ['cursor', /e\.key === 'Escape'/],
    ['arrowNavigation', /e\.key === 'Arrow(?:Up|Down|Left|Right)'/],
  ];
  const duplicated = duplicateCommands
    .filter(([, pattern]) => pattern.test(localKeyListener))
    .map(([id]) => id);

  assert.deepEqual(duplicated, []);
});

function fakeEventTarget(nativeControl) {
  return {
    tagName: nativeControl ? 'SPAN' : 'DIV',
    isContentEditable: false,
    closest(selector) {
      return nativeControl && selector.includes('button') ? { tagName: 'BUTTON' } : null;
    },
  };
}

function spaceEvent(nativeControl) {
  return {
    key: ' ',
    code: 'Space',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: fakeEventTarget(nativeControl),
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
  };
}

function keyEvent({ key, code = '', ctrl = false, meta = false, alt = false, shift = false, tagName = 'DIV' }) {
  return {
    key,
    code,
    ctrlKey: ctrl,
    metaKey: meta,
    altKey: alt,
    shiftKey: shift,
    target: {
      tagName,
      isContentEditable: false,
      closest() { return null; },
    },
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
  };
}

function fakeRoot() {
  let listener;
  return {
    addEventListener(type, callback) {
      assert.equal(type, 'keydown');
      listener = callback;
    },
    removeEventListener(type, callback) {
      assert.equal(type, 'keydown');
      assert.equal(callback, listener);
      listener = undefined;
    },
    dispatch(event) {
      assert.ok(listener);
      listener(event);
    },
  };
}

test('shortcut ids are unique and every registry row is present in visible Help groups', () => {
  const registryIds = SHORTCUTS.map(({ id }) => id);
  const helpRows = SHORTCUT_GROUPS.flatMap(({ group, items }) => items.map((item) => ({ group, ...item })));

  assert.equal(new Set(registryIds).size, registryIds.length, 'shortcut ids must be unique');
  assert.deepEqual(helpRows.map(({ id }) => id), registryIds);
  for (const row of helpRows) {
    assert.ok(row.group.trim(), `${row.id} must have a Help group`);
    assert.ok(row.label.trim(), `${row.id} must have a visible Help label`);
    assert.ok(row.combo.trim(), `${row.id} must have a visible key chord`);
  }
});

test('P0 shortcut chords each have one registry owner and dispatch exactly once', () => {
  const cases = [
    ['cloneSel', { key: 'd', code: 'KeyD', ctrl: true }],
    ['symbolSearch', { key: 'k', code: 'KeyK', ctrl: true }],
    ['saveScript', { key: 's', code: 'KeyS', ctrl: true, shift: true }],
    ['undo', { key: 'z', code: 'KeyZ', ctrl: true }],
    ['redo', { key: 'y', code: 'KeyY', ctrl: true }],
    ['deleteSel', { key: 'Delete', code: 'Delete' }],
    ['scrollLeft', { key: 'ArrowLeft', code: 'ArrowLeft' }],
    ['zoomIn', { key: 'ArrowUp', code: 'ArrowUp' }],
    ['replayStepBack', { key: 'ArrowLeft', code: 'ArrowLeft', shift: true }],
    ['nudgeUpFast', { key: 'ArrowUp', code: 'ArrowUp', shift: true }],
  ];

  for (const [expectedId, init] of cases) {
    const event = keyEvent(init);
    const owners = SHORTCUTS.filter(({ match }) => match(event)).map(({ id }) => id);
    assert.deepEqual(owners, [expectedId], `${expectedId} chord must have exactly one registry owner`);

    const root = fakeRoot();
    const calls = [];
    const handlers = Object.fromEntries(SHORTCUTS.map(({ id }) => [id, () => calls.push(id)]));
    const detach = attachHotkeys(handlers, { target: root });
    root.dispatch(event);
    detach();

    assert.deepEqual(calls, [expectedId], `${expectedId} must dispatch exactly once`);
    assert.equal(event.defaultPrevented, true, `${expectedId} must prevent the browser chord`);
    assert.equal(event.propagationStopped, true, `${expectedId} must stop bubbling after ownership`);
  }
});

test('script save remains active in the editor while drawing clone is suppressed', () => {
  const root = fakeRoot();
  const calls = [];
  const detach = attachHotkeys({
    saveScript: () => calls.push('saveScript'),
    cloneSel: () => calls.push('cloneSel'),
  }, { target: root });

  root.dispatch(keyEvent({ key: 's', code: 'KeyS', ctrl: true, shift: true, tagName: 'TEXTAREA' }));
  root.dispatch(keyEvent({ key: 'd', code: 'KeyD', ctrl: true, tagName: 'TEXTAREA' }));

  assert.deepEqual(calls, ['saveScript']);
  detach();
});

test('Space remains native when focus is inside a button', () => {
  const root = fakeRoot();
  let replayCalls = 0;
  const detach = attachHotkeys({ replayPlay: () => { replayCalls += 1; } }, { target: root });
  const event = spaceEvent(true);

  root.dispatch(event);

  assert.equal(replayCalls, 0);
  assert.equal(event.defaultPrevented, false);
  assert.equal(event.propagationStopped, false);
  detach();
});

test('Space still activates replay away from native controls', () => {
  const root = fakeRoot();
  let replayCalls = 0;
  const detach = attachHotkeys({ replayPlay: () => { replayCalls += 1; } }, { target: root });
  const event = spaceEvent(false);

  root.dispatch(event);

  assert.equal(replayCalls, 1);
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.propagationStopped, true);
  detach();
});
