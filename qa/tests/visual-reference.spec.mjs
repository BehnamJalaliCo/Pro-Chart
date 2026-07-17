import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const qaRoot = path.resolve(here, '..');
const repoRoot = path.resolve(qaRoot, '..');
const fixturePath = path.join(qaRoot, 'fixtures', 'visual-reference.json');
const fixtureSource = await fs.readFile(fixturePath, 'utf8');
const fixture = JSON.parse(fixtureSource);
const fixtureSha256 = crypto.createHash('sha256').update(fixtureSource).digest('hex');

const captureOnly = process.env.VISUAL_CAPTURE_ONLY === '1';
const commit = safeSegment(process.env.BASELINE_COMMIT || 'working-tree');
const sourceFingerprint = process.env.BASELINE_SOURCE_FINGERPRINT || 'unrecorded';
const runId = safeSegment(process.env.VISUAL_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z'));
const fixedAt = new Date(fixture.fixedAt);

if (Number.isNaN(fixedAt.getTime())) throw new Error('visual-reference fixture has an invalid fixedAt value');

const scenarios = [
  { id: 'desktop-chart', project: 'chromium-desktop', onboarding: false },
  { id: 'mobile-onboarding', project: 'chromium-mobile', onboarding: true },
  { id: 'mobile-chart', project: 'chromium-mobile', onboarding: false },
];

function safeSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 160) || 'unknown';
}

function sha256(value) {
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

function requestSummary(request) {
  const url = new URL(request.url());
  return {
    method: request.method(),
    pathname: url.pathname,
    queryKeys: [...url.searchParams.keys()].sort(),
    resourceType: request.resourceType(),
  };
}

function safeError(error) {
  return String(error?.stack || error?.message || error || '')
    .replace(/(authorization|api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 4000);
}

async function installFixture(page, testInfo, scenario, state) {
  const baseOrigin = new URL(testInfo.project.use.baseURL).origin;

  await page.clock.setFixedTime(fixedAt);
  await page.addInitScript(({ showOnboarding, workspace, watchlist }) => {
    // The live-price renderer intentionally adds Math.random() noise every frame.
    // 0.5 is the neutral term, so production code is exercised without pixel drift.
    Math.random = () => 0.5;
    try {
      if (!/^https?:$/.test(location.protocol)) return;
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
      // Keep the state explicit even if a future browser context is accidentally reused.
      localStorage.removeItem('pc_pin_v1');
      localStorage.removeItem('pc_biometric_v1');
      localStorage.removeItem('bn_owner_key');
      localStorage.removeItem('bn_admin_token');
      if (!Array.isArray(watchlist)) throw new Error('invalid visual fixture watchlist');
    } catch {
      // about:blank has no usable localStorage; the init script runs again on navigation.
    }
  }, {
    showOnboarding: scenario.onboarding,
    workspace: fixture.workspace,
    watchlist: fixture.watchlist,
  });

  // Register the broad route first. The API-specific route below is newer and
  // therefore runs first for /api/**. All other external HTTP(S) is blocked.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseOrigin) {
      await route.fallback();
      return;
    }
    state.unexpectedExternal.push({ method: route.request().method(), origin: url.origin, pathname: url.pathname });
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
      await route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: `${JSON.stringify(json)}\n` });
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
      const prices = Object.fromEntries(Object.entries(fixture.symbols).map(([symbol, spec]) => [symbol, {
        mid: spec.mid,
        bid: spec.bid,
        ask: spec.ask,
      }]));
      await reply({ market_open: true, prices });
      return;
    }
    if (key === 'GET /api/academy/bn/news') {
      await reply({ items: fixture.news });
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
      await reply([]);
      return;
    }
    if (key === 'GET /api/academy/bn/ai-signal/quota') {
      await reply({ used: 0, remaining: 10, limit: 10 });
      return;
    }

    state.unstubbed.push({ key, queryKeys: [...url.searchParams.keys()].sort() });
    await route.abort('blockedbyclient');
  });

  await page.routeWebSocket('**/ws/**', async (ws) => {
    state.mockedWebSockets.push('local-ws');
    await ws.close({ code: 1000, reason: 'visual fixture only' });
  });
}

async function waitForFinalFonts(page) {
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

for (const scenario of scenarios) {
  test(`VISUAL-REF: ${scenario.id}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== scenario.project, `scenario belongs to ${scenario.project}`);

    const state = {
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
    const outDir = path.join(repoRoot, 'artifacts', 'qa', 'visual-determinism', commit, runId, scenario.id);
    const snapshotName = ['approved', `${scenario.id}.png`];
    const approvedPath = testInfo.snapshotPath(...snapshotName, { kind: 'screenshot' });
    let candidate = null;
    let candidateSha256 = null;
    let stabilityProbeSha256 = null;
    let fontState = null;
    let viewport = null;
    let result = 'FAIL';
    let failure = null;

    page.on('pageerror', (error) => state.pageErrors.push(safeError(error)));
    page.on('requestfailed', (request) => state.requestFailures.push({
      ...requestSummary(request),
      error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
    }));
    page.on('response', (response) => {
      if (response.status() >= 400) state.badResponses.push({
        status: response.status(),
        pathname: new URL(response.url()).pathname,
      });
    });

    try {
      await installFixture(page, testInfo, scenario, state);
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('.pc-launch')).toHaveCount(0);
      if (scenario.onboarding) {
        const onboardingTitle = page.locator('#pc-onboarding-title');
        await expect(onboardingTitle).toBeVisible();
        await expect(page.getByRole('heading').and(onboardingTitle)).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'بعدی' })).toBeVisible();
      } else {
        await expect(page.locator('canvas').first()).toBeVisible();
        await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
        await expect(page.getByText(fixture.symbols.EURUSD.mid.toFixed(5), { exact: true }).first()).toBeVisible();
      }

      await expect.poll(() => state.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);
      await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
      await expect.poll(() => state.seen.has('GET /api/academy/bn/watchlist')).toBe(true);
      await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);

      fontState = await waitForFinalFonts(page);
      await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
      await page.waitForTimeout(250);

      viewport = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
      }));

      const screenshotOptions = { fullPage: true, animations: 'disabled', caret: 'hide' };
      candidate = await page.screenshot(screenshotOptions);
      candidateSha256 = sha256(candidate);
      await page.waitForTimeout(250);
      const stabilityProbe = await page.screenshot(screenshotOptions);
      stabilityProbeSha256 = sha256(stabilityProbe);

      expect(response?.status(), 'document HTTP status').toBe(200);
      expect(new URL(page.url()).origin, 'fixture must remain on local mapped origin').toBe(new URL(testInfo.project.use.baseURL).origin);
      expect(viewport.lang).toBe('fa');
      expect(viewport.dir).toBe('rtl');
      expect(stabilityProbeSha256, 'two consecutive captures must be byte-identical').toBe(candidateSha256);
      expect(state.unstubbed, 'all API calls must have an explicit synthetic response').toEqual([]);
      expect(state.unexpectedExternal, 'visual fixture must not contact external origins').toEqual([]);
      expect(state.pageErrors, 'uncaught page errors').toEqual([]);
      expect(state.requestFailures, 'failed requests').toEqual([]);
      expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);

      if (captureOnly) {
        testInfo.annotations.push({
          type: 'visual-approval',
          description: 'PENDING_MANUAL_APPROVAL: capture-only evidence is not a golden snapshot.',
        });
        result = 'CAPTURE_ONLY_PASS_PENDING_MANUAL_APPROVAL';
      } else {
        try {
          await fs.access(approvedPath);
        } catch {
          throw new Error(`Approved visual snapshot is missing: ${approvedPath}. Run explicit capture-only mode, review the candidate, and approve manually before enabling this gate.`);
        }
        await expect(page).toHaveScreenshot(snapshotName, {
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixels: 0,
        });
        result = 'APPROVED_GOLDEN_MATCH';
      }
    } catch (error) {
      failure = safeError(error);
      throw error;
    } finally {
      await fs.mkdir(outDir, { recursive: true });
      if (candidate) await fs.writeFile(path.join(outDir, 'actual.png'), candidate);
      const metadata = {
        schemaVersion: 1,
        requirementIds: ['PC-002', 'PC-009', 'PC-146', 'PC-153'],
        scenario: scenario.id,
        project: testInfo.project.name,
        commit,
        sourceFingerprint,
        runId,
        fixture: {
          id: fixture.fixtureId,
          sha256: fixtureSha256,
          fixedAt: fixture.fixedAt,
          provenance: fixture.provenance,
        },
        mode: captureOnly ? 'capture-only' : 'approved-golden-gate',
        approval: captureOnly ? 'PENDING_MANUAL_APPROVAL' : 'APPROVED_GOLDEN_REQUIRED',
        approvedPath,
        result,
        failure,
        viewport,
        fonts: fontState,
        screenshots: {
          candidateSha256,
          stabilityProbeSha256,
          byteIdentical: Boolean(candidateSha256 && candidateSha256 === stabilityProbeSha256),
        },
        network: {
          apiRequests: state.apiRequests,
          mocked: state.mocked,
          mockedWebSockets: state.mockedWebSockets,
          unstubbed: state.unstubbed,
          unexpectedExternal: state.unexpectedExternal,
          requestFailures: state.requestFailures,
          badResponses: state.badResponses,
        },
        pageErrors: state.pageErrors,
      };
      await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    }
  });
}
