import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, '..', 'fixtures', 'visual-reference.json');
const fixtureSource = await fs.readFile(fixturePath, 'utf8');

export const fixture = JSON.parse(fixtureSource);
export const fixtureSha256 = crypto.createHash('sha256').update(fixtureSource).digest('hex');
export const fixedAt = new Date(fixture.fixedAt);

if (Number.isNaN(fixedAt.getTime())) {
  throw new Error('synthetic ProChart fixture has an invalid fixedAt value');
}

export function safeSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 160) || 'unknown';
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function round(value, digits) {
  return Number(Number(value).toFixed(digits));
}

function buildSyntheticCandles(symbol, tf) {
  const spec = fixture.symbols[symbol];
  if (!spec) return null;

  const daily = tf === 'D1';
  if (!daily && tf !== 'H1') return null;

  const interval = daily ? 86_400 : 3_600;
  const count = daily ? 365 : 240;
  const fixedSec = Math.floor(fixedAt.getTime() / 1000);
  const lastTime = Math.floor(fixedSec / interval) * interval;
  const values = [];
  let previousClose = spec.mid - spec.step * (daily ? 24 : 18);

  for (let index = 0; index < count; index += 1) {
    const wave = (((index * 17) % 19) - 9) * spec.step;
    const drift = ((index % 7) - 3) * spec.step * 0.28;
    const open = previousClose;
    const close = open + wave * 0.22 + drift;
    const wick = spec.step * (1.8 + (index % 4) * 0.35);
    values.push({
      t: lastTime - (count - 1 - index) * interval,
      o: round(open, spec.digits),
      h: round(Math.max(open, close) + wick, spec.digits),
      l: round(Math.min(open, close) - wick, spec.digits),
      c: round(close, spec.digits),
      v: spec.volumeBase + ((index * 97) % 1300),
    });
    previousClose = close;
  }

  const shift = spec.mid - values.at(-1).c;
  return values.map((candle) => ({
    ...candle,
    o: round(candle.o + shift, spec.digits),
    h: round(candle.h + shift, spec.digits),
    l: round(candle.l + shift, spec.digits),
    c: round(candle.c + shift, spec.digits),
  }));
}

const candleCache = new Map();
function candlesFor(symbol, tf, limit, before) {
  if (before) return [];
  const key = `${symbol}:${tf}`;
  if (!candleCache.has(key)) candleCache.set(key, buildSyntheticCandles(symbol, tf));
  const values = candleCache.get(key);
  if (!values) return null;
  const n = Number(limit);
  return Number.isFinite(n) && n > 0 ? values.slice(-Math.floor(n)) : values;
}

export function requestSummary(request) {
  const url = new URL(request.url());
  return {
    method: request.method(),
    pathname: url.pathname,
    queryKeys: [...url.searchParams.keys()].sort(),
    resourceType: request.resourceType(),
  };
}

export function safeError(error) {
  return String(error?.stack || error?.message || error || '')
    .replace(/(authorization|api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/[A-Za-z0-9+/_=-]{32,}/g, '[REDACTED]')
    .slice(0, 4000);
}

export function createFixtureState() {
  return {
    apiRequests: [],
    mocked: [],
    mockedWebSockets: [],
    seen: new Set(),
    unexpectedExternal: [],
    unstubbed: [],
    pageErrors: [],
    requestFailures: [],
    badResponses: [],
  };
}

function syntheticSignals() {
  const eur = fixture.symbols.EURUSD;
  return [{
    id: 'synthetic-ai-eurusd-1',
    symbol: 'EURUSD',
    tf: 'H1',
    direction: 'buy',
    entry: eur.mid,
    sl: round(eur.mid - eur.step * 12, eur.digits),
    tps: [round(eur.mid + eur.step * 18, eur.digits)],
  }];
}

export async function installSyntheticFixture(page, testInfo, scenario, state, options = {}) {
  const baseOrigin = new URL(testInfo.project.use.baseURL).origin;

  // Visual evidence keeps the fixed Playwright clock by default. Timing probes
  // can opt into the native monotonic clock because Playwright's fixed clock
  // replaces Performance.mark with a non-recording shim.
  if (options.clock !== 'native') await page.clock.setFixedTime(fixedAt);
  await page.addInitScript(({
    showOnboarding,
    workspace,
    watchlist,
    preserveWorkspaceOnReload,
    fixtureSessionKey,
  }) => {
    // Production adds random live-price noise each frame. The neutral term keeps
    // the renderer exercised while making state evidence byte-stable.
    Math.random = () => 0.5;
    try {
      if (!/^https?:$/.test(location.protocol)) return;
      if (preserveWorkspaceOnReload && sessionStorage.getItem(fixtureSessionKey) === '1') return;
      localStorage.clear();
      localStorage.setItem('pc_app_v1', JSON.stringify({ lang: 'fa', theme: 'light' }));
      localStorage.setItem('bn_workspace', JSON.stringify({
        symbol: workspace.symbol,
        tf: workspace.tf,
        chartType: workspace.chartType,
        theme: workspace.theme,
        tz: workspace.tz,
        overlays: [],
        subs: [],
        drawings: [],
        compares: [],
        gridPreset: '1',
        showVolume: true,
      }));
      localStorage.setItem('bn_watch_meta', JSON.stringify({
        lists: [{ id: 'visual-reference', name: 'پیش‌فرض', items: {}, sections: [] }],
        activeListId: 'visual-reference',
        view: 'list',
        showLogo: true,
        showDesc: false,
        logoSize: 'lg',
        sortBy: 'manual',
        sortDir: 'asc',
        groupBy: 'type',
        flagFilter: null,
        columns: ['chgAbs', 'change'],
        typeCollapsed: {},
        showDetails: true,
      }));
      localStorage.setItem('bn_gesture_hint_seen', '1');
      if (!showOnboarding) localStorage.setItem('pc_onboarded_v1', '1');
      localStorage.removeItem('pc_pin_v1');
      localStorage.removeItem('pc_biometric_v1');
      localStorage.removeItem('bn_owner_key');
      localStorage.removeItem('bn_admin_token');
      if (!Array.isArray(watchlist)) throw new Error('invalid synthetic fixture watchlist');
      if (preserveWorkspaceOnReload) sessionStorage.setItem(fixtureSessionKey, '1');
    } catch {
      // about:blank has no usable localStorage; the script runs again on navigation.
    }
  }, {
    showOnboarding: Boolean(scenario.onboarding),
    workspace: fixture.workspace,
    watchlist: fixture.watchlist,
    preserveWorkspaceOnReload: options.preserveWorkspaceOnReload === true,
    fixtureSessionKey: `__pc_fixture_initialized:${scenario.id}`,
  });

  // Register the broad route first. Playwright evaluates the newer API route first.
  // Every HTTP(S) origin other than the mapped disposable preview is fail-closed.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseOrigin) {
      await route.fallback();
      return;
    }
    state.unexpectedExternal.push({
      method: route.request().method(),
      origin: url.origin,
      pathname: url.pathname,
    });
    await route.abort('blockedbyclient');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    state.apiRequests.push(requestSummary(request));
    state.seen.add(key);

    const reply = async (json, status = 200) => {
      state.mocked.push(key);
      await route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: `${JSON.stringify(json)}\n`,
      });
    };

    if (key === 'POST /api/academy/auth/bn-guest') {
      await reply({ token: 'visual-fixture-token' });
      return;
    }
    if (key === 'GET /api/academy/me') {
      await reply({ id: 'visual-fixture-user', username: 'visual-fixture', tier: 'free', status: 'active' });
      return;
    }
    if (key === 'GET /api/academy/chart/symbols') {
      await reply({ symbols: fixture.watchlist });
      return;
    }

    const chartMatch = /^\/api\/academy\/chart\/([^/]+)$/.exec(url.pathname);
    if (request.method() === 'GET' && chartMatch) {
      const symbol = decodeURIComponent(chartMatch[1]).toUpperCase();
      const tf = url.searchParams.get('tf') || 'H1';
      const candles = candlesFor(symbol, tf, url.searchParams.get('limit'), url.searchParams.get('before'));
      if (candles) {
        await reply({ symbol, tf, candles });
        return;
      }
    }

    if (key === 'GET /api/academy/bn/watchlist') {
      await reply({ symbols: fixture.watchlist });
      return;
    }
    if (key === 'GET /api/academy/bn/prices') {
      const prices = Object.fromEntries(Object.entries(fixture.symbols).map(([symbol, spec], index) => [symbol, {
        mid: spec.mid,
        bid: spec.bid,
        ask: spec.ask,
        change_pct: round(index % 2 === 0 ? 0.42 + index * 0.08 : -0.31 - index * 0.07, 2),
      }]));
      await reply({ market_open: true, prices });
      return;
    }
    if (key === 'GET /api/academy/bn/news') {
      await reply({ items: fixture.news });
      return;
    }
    if (key === 'GET /api/academy/bn/calendar') {
      await reply({ events: [{
        id: 'synthetic-calendar-1',
        time: '12:30',
        country: 'EU',
        flag: '🇪🇺',
        title: 'رویداد کاملاً ساختگی QA',
        importance: 'medium',
        forecast: '1.8%',
        previous: '1.7%',
        actual: '1.9%',
      }] });
      return;
    }
    if (key === 'GET /api/academy/bn/scripts') {
      await reply({ scripts: [], starter: '' });
      return;
    }
    if (key === 'GET /api/academy/bn/layouts') {
      await reply([]);
      return;
    }
    if (key === 'GET /api/academy/bn/alerts') {
      await reply([]);
      return;
    }
    if (key === 'GET /api/academy/bn/ai-signal/active') {
      await reply(syntheticSignals());
      return;
    }
    if (key === 'GET /api/academy/bn/ai-signal/quota') {
      await reply({ used: 0, remaining: 10, limit: 10 });
      return;
    }
    if (key === 'GET /api/academy/bn/connect/status') {
      await reply({ lbank: false, mt5: false });
      return;
    }

    state.unstubbed.push({ key, queryKeys: [...url.searchParams.keys()].sort() });
    await route.abort('blockedbyclient');
  });

  await page.routeWebSocket('**/ws/**', async (ws) => {
    state.mockedWebSockets.push('local-ws');
    await ws.close({ code: 1000, reason: 'synthetic fixture only' });
  });
}

export async function waitForFinalFonts(page) {
  return page.evaluate(async () => {
    const sample = 'بازار EURUSD 1.14212 چارت حرفه‌ای';
    const faces = [
      '400 12px "IRANYekanX"',
      '600 12px "IRANYekanX"',
      '700 12px "IRANYekanX"',
      '800 12px "IRANYekanX"',
      '400 12px "Ravagh"',
      '600 12px "Ravagh"',
      '800 12px "Ravagh"',
      '400 12px "AnjomanMax"',
      '600 12px "AnjomanMax"',
      '400 12px "Vazirmatn"',
    ];
    await Promise.all(faces.map((face) => document.fonts.load(face, sample)));
    await document.fonts.ready;
    return { status: document.fonts.status, faces };
  });
}
