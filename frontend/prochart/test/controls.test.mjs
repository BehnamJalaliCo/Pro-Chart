import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { dispatchOpenSearch, OPEN_SEARCH_EVENT } from '../src/app/appEvents.js';

const watchlistSource = await readFile(new URL('../src/app/screens/WatchlistScreen.jsx', import.meta.url), 'utf8');
const userPanelSource = await readFile(new URL('../src/UserPanel.jsx', import.meta.url), 'utf8');
const overlaysSource = await readFile(new URL('../src/bazaarnama/overlays/ChartOverlays.jsx', import.meta.url), 'utf8');

test('one watchlist search activation dispatches one bn:openSearch event', () => {
  const events = [];
  class TestCustomEvent {
    constructor(type) { this.type = type; }
  }
  const target = { dispatchEvent: (event) => { events.push(event); return true; } };

  assert.equal(dispatchOpenSearch({ target, EventCtor: TestCustomEvent }), true);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, OPEN_SEARCH_EVENT);

  const searchButton = watchlistSource.match(
    /<button type="button" aria-label=\{t\('common\.search'\)\}[\s\S]*?<\/button>/,
  )?.[0];
  assert.ok(searchButton, 'watchlist search button must retain its accessible label and native button type');
  assert.match(searchButton, /onClick=\{\(\) => dispatchOpenSearch\(\)\}/);
});

test('open-search dispatch fails closed when the browser event API is unavailable or throws', () => {
  assert.equal(dispatchOpenSearch({ target: null, EventCtor: class {} }), false);
  assert.equal(dispatchOpenSearch({ target: {}, EventCtor: class {} }), false);
  assert.equal(dispatchOpenSearch({ target: { dispatchEvent() { throw new Error('blocked'); } }, EventCtor: class {} }), false);
});

test('coming-soon password inputs and their eye toggles have native disabled semantics', () => {
  const pwInput = userPanelSource.match(/function PwInput[\s\S]*?\n}\n\n\/\/ کارت/)?.[0];
  assert.ok(pwInput, 'PwInput source must be present');
  assert.match(pwInput, /disabled = false/);
  assert.match(pwInput, /<input[\s\S]*?disabled=\{disabled\}[\s\S]*?aria-disabled=\{disabled \|\| undefined\}/);
  assert.match(pwInput, /<button type="button"[\s\S]*?disabled=\{disabled\}[\s\S]*?aria-disabled=\{disabled \|\| undefined\}/);
  assert.match(pwInput, /if \(!disabled\) setShow/);
  assert.doesNotMatch(pwInput, /tabIndex=\{-1\}/, 'enabled eye toggles must retain native keyboard access');

  const securityTab = userPanelSource.match(/function SecurityTab[\s\S]*?\/\/ ─+ تب: معرفی/)?.[0];
  assert.ok(securityTab, 'SecurityTab source must be present');
  const passwordControls = securityTab.match(/<PwInput\b[^>]*\/>/g) || [];
  assert.equal(passwordControls.length, 3);
  for (const control of passwordControls) assert.match(control, /\bdisabled\b/);
  assert.doesNotMatch(securityTab, /onChange=\{\(\) => \{\}\}/);
  assert.doesNotMatch(securityTab, /pointer-events-none/);
  assert.match(securityTab, /فرم‌های غیرفعال/);
});

test('compact LegendRow returns before the normal-mode More control', () => {
  const legendRow = overlaysSource.match(/function LegendRow[\s\S]*?\n}\n\n\/\/ items:/)?.[0];
  assert.ok(legendRow, 'LegendRow source must be present');
  const compactBranch = legendRow.match(/if \(viewMode === 'compact'\) \{([\s\S]*?)\n  }\n  return \(/)?.[1];
  assert.ok(compactBranch, 'compact LegendRow early-return branch must be present');
  assert.doesNotMatch(compactBranch, /onMore|MoreHorizontal|بیشتر/);
  assert.match(legendRow.slice(legendRow.indexOf(compactBranch) + compactBranch.length), /onMore|MoreHorizontal|بیشتر/);
});
