import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DEFAULT_NAV_COMMANDS,
  LEGACY_PANEL_REDIRECTS,
  PANEL_ROUTES,
  PROTECTED_PANEL_ROUTES,
  PUBLIC_PANEL_ROUTES,
  getEnabledNavCommands,
} from './navigation.js';

const declaredPaths = new Set(
  [...PUBLIC_PANEL_ROUTES, ...PROTECTED_PANEL_ROUTES].map(({ path }) => path)
);

test('every enabled default palette target is an explicit non-wildcard route', () => {
  const enabledCommands = getEnabledNavCommands();

  assert.ok(enabledCommands.length > 0);
  for (const command of enabledCommands) {
    assert.equal(command.enabled, true, `${command.id} must be explicitly enabled`);
    assert.match(command.path, /^\/[a-z0-9/-]+$/i, `${command.id} must have an absolute path`);
    assert.notEqual(command.path, '*', `${command.id} must not target the wildcard`);
    assert.ok(
      declaredPaths.has(command.path),
      `${command.id} targets undeclared Panel route ${command.path}`
    );
  }
});

test('the two safe replacements use canonical route-registry paths', () => {
  const byId = Object.fromEntries(DEFAULT_NAV_COMMANDS.map((command) => [command.id, command]));

  assert.deepEqual(
    { previousPath: byId.signals.previousPath, path: byId.signals.path },
    { previousPath: '/signals', path: PANEL_ROUTES['ai-signals'] }
  );
  assert.deepEqual(
    { previousPath: byId.visitors.previousPath, path: byId.visitors.path },
    { previousPath: '/visitors', path: PANEL_ROUTES.analytics }
  );

  assert.deepEqual(
    LEGACY_PANEL_REDIRECTS.map(({ from, to }) => ({ from, to })),
    [
      { from: '/signals', to: PANEL_ROUTES['ai-signals'] },
      { from: '/visitors', to: PANEL_ROUTES.analytics },
    ]
  );
});

test('unsupported former destinations stay auditable and cannot render or receive keyboard selection', () => {
  const expectedUnavailable = {
    backtest: '/backtest',
    risk: '/risk',
    performance: '/performance',
    reports: '/reports',
    'ml-models': '/ml-models',
    monitoring: '/monitoring',
    articles: '/articles',
  };
  const unavailable = DEFAULT_NAV_COMMANDS.filter((command) => command.enabled === false);
  const enabledIds = new Set(getEnabledNavCommands().map(({ id }) => id));

  assert.deepEqual(
    Object.fromEntries(unavailable.map(({ id, previousPath }) => [id, previousPath])),
    expectedUnavailable
  );
  for (const command of unavailable) {
    assert.ok(command.unavailableReason, `${command.id} must retain a decision reason`);
    assert.equal(command.path, undefined, `${command.id} must not retain an actionable path`);
    assert.equal(enabledIds.has(command.id), false, `${command.id} leaked into enabled commands`);
  }
});

test('App declares protected pages from the canonical route registry', async () => {
  const appSource = await readFile(new URL('./App.jsx', import.meta.url), 'utf8');

  assert.match(appSource, /PROTECTED_PANEL_ROUTES\.map\(/);
  assert.match(appSource, /<Route key=\{id\} path=\{path\}/);
  assert.match(appSource, /LEGACY_PANEL_REDIRECTS\.map\(/);
  assert.match(appSource, /path=\{from\} element=\{<Navigate to=\{to\} replace \/>\}/);
  assert.match(appSource, /<Route path="\*"/);
});

test('palette keyboard and dialog accessibility behavior remains present', async () => {
  const paletteSource = await readFile(
    new URL('./components/common/CommandPalette.jsx', import.meta.url),
    'utf8'
  );

  for (const invariant of [
    /e\.metaKey \|\| e\.ctrlKey/,
    /e\.key === 'k'/,
    /e\.key === 'Escape'/,
    /e\.key === 'ArrowDown'/,
    /e\.key === 'ArrowUp'/,
    /e\.key === 'Enter'/,
    /getEnabledNavCommands\(commands\)/,
    /return enabledCommands/,
    /enabledCommands\.filter/,
    /role="dialog"/,
    /aria-label="Command palette"/,
    /aria-label="جستجو"/,
    /aria-label="بستن"/,
  ]) {
    assert.match(paletteSource, invariant);
  }
});
