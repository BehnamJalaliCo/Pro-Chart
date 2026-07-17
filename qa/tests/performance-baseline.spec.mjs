import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const qaRoot = path.resolve(here, '..');
const repoRoot = path.resolve(qaRoot, '..');
const fixturePath = path.join(qaRoot, 'fixtures', 'visual-reference.json');
const fixtureSource = await fs.readFile(fixturePath, 'utf8');
const fixture = JSON.parse(fixtureSource);
const fixtureSha256 = sha256(fixtureSource);
const fixedAt = new Date(fixture.fixedAt);

if (Number.isNaN(fixedAt.getTime())) throw new Error('performance fixture has an invalid fixedAt value');

const baseline = safeSegment(process.env.PERF_BASELINE || process.env.BASELINE_COMMIT || 'working-tree');
const commit = safeSegment(process.env.BASELINE_COMMIT || 'working-tree');
const sourceFingerprint = process.env.BASELINE_SOURCE_FINGERPRINT || 'unrecorded';
const runId = safeSegment(process.env.PERF_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z'));
const imageDigest = process.env.PLAYWRIGHT_IMAGE_DIGEST?.trim() || null;
const imageReference = process.env.PLAYWRIGHT_IMAGE_REFERENCE?.trim() || null;

const FRAME_SAMPLE_COUNT = 120;

// Video and trace capture perturb frame cadence materially. The performance
// evidence is the explicit metrics/request inventory written by this spec.
test.use({ video: 'off', trace: 'off', screenshot: 'off' });

// These are the only numeric gates applied here. They are copied without
// relaxation from docs/performance/PERFORMANCE_BUDGET.md.
const BUDGETS = Object.freeze({
  labLcpMs: { operator: '<=', threshold: 2500, unit: 'ms', evidence: 'lab regression' },
  labCls: { operator: '<=', threshold: 0.1, unit: 'score', evidence: 'lab' },
  labTtfbMs: { operator: '<', threshold: 800, unit: 'ms', evidence: 'navigation timing / document request trace lab proxy' },
  activeChartFrameP95Ms: { operator: '<', threshold: 20, unit: 'ms', evidence: 'active-chart rAF interval proxy' },
  layoutRestoreAfterShellMs: { operator: '<', threshold: 2000, unit: 'ms', evidence: 'synthetic persisted-workspace E2E proxy' },
});

const scenarios = [
  { id: 'desktop-chart', project: 'chromium-desktop' },
  { id: 'mobile-chart', project: 'chromium-mobile' },
];

function safeSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 160) || 'unknown';
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function round(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
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

function parseOsRelease(source) {
  return Object.fromEntries(source.split('\n').flatMap((line) => {
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (!match) return [];
    return [[match[1], match[2].replace(/^"|"$/g, '')]];
  }));
}

function evaluateGate(metric, actual) {
  const budget = BUDGETS[metric];
  const available = typeof actual === 'number' && Number.isFinite(actual);
  const pass = available && (budget.operator === '<=' ? actual <= budget.threshold : actual < budget.threshold);
  return { metric, actual: available ? round(actual) : null, ...budget, pass, result: pass ? 'PASS' : 'FAIL' };
}

async function installPerformanceObservers(page) {
  await page.addInitScript(() => {
    const store = {
      supportedEntryTypes: globalThis.PerformanceObserver?.supportedEntryTypes || [],
      observerErrors: [],
      navigation: [],
      paints: [],
      resources: [],
      lcp: [],
      layoutShifts: [],
      longTasks: [],
    };
    globalThis.__prochartPerformance = store;

    const describeNode = (node) => {
      if (!node || !node.tagName) return null;
      const id = node.id ? `#${node.id}` : '';
      const classes = typeof node.className === 'string'
        ? node.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).map((value) => `.${value}`).join('')
        : '';
      return `${node.tagName.toLowerCase()}${id}${classes}`.slice(0, 240);
    };

    const observe = (type, callback) => {
      if (!globalThis.PerformanceObserver) {
        store.observerErrors.push({ type, error: 'PerformanceObserver unavailable' });
        return;
      }
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: true });
      } catch (error) {
        store.observerErrors.push({ type, error: String(error?.message || error).slice(0, 500) });
      }
    };

    observe('largest-contentful-paint', (entries) => {
      for (const entry of entries) {
        let pathname = null;
        try { pathname = entry.url ? new URL(entry.url, location.href).pathname : null; } catch { pathname = null; }
        store.lcp.push({
          startTime: entry.startTime,
          renderTime: entry.renderTime,
          loadTime: entry.loadTime,
          size: entry.size,
          id: entry.id || null,
          pathname,
          element: describeNode(entry.element),
        });
      }
    });

    observe('navigation', (entries) => {
      for (const entry of entries) {
        store.navigation.push({
          startTime: entry.startTime,
          fetchStart: entry.fetchStart,
          requestStart: entry.requestStart,
          responseStart: entry.responseStart,
          responseEnd: entry.responseEnd,
          domInteractive: entry.domInteractive,
          domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
          loadEventEnd: entry.loadEventEnd,
          duration: entry.duration,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          entryType: entry.entryType,
          type: entry.type,
        });
      }
    });

    observe('paint', (entries) => {
      for (const entry of entries) store.paints.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration });
    });

    observe('resource', (entries) => {
      for (const entry of entries) {
        let pathname = null;
        try { pathname = new URL(entry.name, location.href).pathname; } catch { pathname = null; }
        store.resources.push({
          pathname,
          initiatorType: entry.initiatorType,
          startTime: entry.startTime,
          duration: entry.duration,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
        });
      }
    });

    observe('layout-shift', (entries) => {
      for (const entry of entries) {
        store.layoutShifts.push({
          startTime: entry.startTime,
          duration: entry.duration,
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
          sources: (entry.sources || []).slice(0, 10).map((source) => ({
            node: describeNode(source.node),
            previousRect: source.previousRect,
            currentRect: source.currentRect,
          })),
        });
      }
    });

    observe('longtask', (entries) => {
      for (const entry of entries) {
        store.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
      }
    });
  });
}

async function installFixture(page, testInfo, state) {
  const baseOrigin = new URL(testInfo.project.use.baseURL).origin;

  await page.clock.setFixedTime(fixedAt);
  await page.addInitScript(({ workspace, watchlist }) => {
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
        lists: [{ id: 'performance-baseline', name: 'پیش‌فرض', items: {}, sections: [] }],
        activeListId: 'performance-baseline',
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
      localStorage.setItem('pc_onboarded_v1', '1');
      localStorage.removeItem('pc_pin_v1');
      localStorage.removeItem('pc_biometric_v1');
      localStorage.removeItem('bn_owner_key');
      localStorage.removeItem('bn_admin_token');
      if (!Array.isArray(watchlist)) throw new Error('invalid performance fixture watchlist');
    } catch {
      // The script also runs for about:blank, where localStorage may be unavailable.
    }
  }, { workspace: fixture.workspace, watchlist: fixture.watchlist });

  // The broad route is registered first so the newer /api/** route gets first
  // refusal. Anything outside the mapped preview origin is blocked and fails the run.
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
      const body = `${JSON.stringify(json)}\n`;
      state.mocked.push(key);
      await route.fulfill({
        status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': String(Buffer.byteLength(body)),
          'cache-control': 'no-store',
        },
        body,
      });
    };

    if (key === 'POST /api/academy/auth/bn-guest') {
      await reply({ token: 'performance-fixture-token' });
      return;
    }
    if (key === 'GET /api/academy/me') {
      await reply({ id: 'performance-fixture-user', username: 'performance-fixture', tier: 'free', status: 'active' });
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
    await ws.close({ code: 1000, reason: 'performance fixture only' });
  });
}

function wireNetworkEvidence(page, state) {
  page.on('pageerror', (error) => state.pageErrors.push(safeError(error)));
  page.on('request', (request) => state.requests.push(requestSummary(request)));
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
  page.on('requestfinished', (request) => {
    const pending = (async () => {
      try {
        const sizes = typeof request.sizes === 'function' ? await request.sizes() : null;
        const timing = typeof request.timing === 'function' ? request.timing() : null;
        state.completedRequests.push({ ...requestSummary(request), sizes, timing });
      } catch (error) {
        state.sizeErrors.push({ ...requestSummary(request), error: safeError(error) });
      }
    })();
    state.pendingSizeReads.push(pending);
  });
}

async function settleRequestSizes(state) {
  let cursor = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    const batch = state.pendingSizeReads.slice(cursor);
    cursor = state.pendingSizeReads.length;
    if (!batch.length) break;
    await Promise.allSettled(batch);
  }
}

function summarizeRequestSizes(requests, totalObserved) {
  const byteFields = ['requestBodySize', 'requestHeadersSize', 'responseBodySize', 'responseHeadersSize'];
  const totals = Object.fromEntries(byteFields.map((field) => [field, 0]));
  const byResourceType = {};

  for (const request of requests) {
    const group = byResourceType[request.resourceType] || {
      count: 0,
      ...Object.fromEntries(byteFields.map((field) => [field, 0])),
    };
    group.count += 1;
    for (const field of byteFields) {
      const value = Number(request.sizes?.[field] || 0);
      group[field] += value;
      totals[field] += value;
    }
    byResourceType[request.resourceType] = group;
  }

  return {
    observedRequestCount: totalObserved,
    completedRequestCount: requests.length,
    ...totals,
    totalWireBytes: Object.values(totals).reduce((sum, value) => sum + value, 0),
    byResourceType,
    semantics: 'Playwright Request.sizes values; response body size may reflect protocol encoding rather than decoded DOM resource size.',
  };
}

async function sampleActiveChartFrames(page, count) {
  const values = await page.evaluate((sampleCount) => new Promise((resolve) => {
    const deltas = [];
    let previous = null;
    const tick = (now) => {
      if (previous !== null) deltas.push(now - previous);
      previous = now;
      if (deltas.length >= sampleCount) resolve(deltas);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), count);

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    sampleCount: values.length,
    minMs: round(Math.min(...values)),
    meanMs: round(total / values.length),
    medianMs: round(percentile(values, 0.5)),
    p95Ms: round(percentile(values, 0.95)),
    maxMs: round(Math.max(...values)),
    intervalsOver16_7Ms: values.filter((value) => value > 16.7).length,
    intervalsAtOrOver20Ms: values.filter((value) => value >= 20).length,
    rawIntervalsMs: values.map((value) => round(value)),
    semantics: 'Consecutive requestAnimationFrame intervals while the synthetic chart is visible; a Chromium lab cadence proxy, not direct chart paint CPU duration.',
  };
}

async function collectBrowserMetrics(page) {
  return page.evaluate(() => {
    const roundMetric = (value) => typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(3)) : null;
    const store = globalThis.__prochartPerformance || {
      supportedEntryTypes: [], observerErrors: [], navigation: [], paints: [], resources: [], lcp: [], layoutShifts: [], longTasks: [],
    };
    const nav = performance.getEntriesByType('navigation')[0] || store.navigation.at(-1) || null;

    const shifts = store.layoutShifts.filter((entry) => !entry.hadRecentInput).sort((a, b) => a.startTime - b.startTime);
    let sessionValue = 0;
    let sessionStart = 0;
    let previousShift = 0;
    let cls = 0;
    for (const shift of shifts) {
      if (sessionValue && shift.startTime - previousShift < 1000 && shift.startTime - sessionStart < 5000) {
        sessionValue += shift.value;
      } else {
        sessionValue = shift.value;
        sessionStart = shift.startTime;
      }
      previousShift = shift.startTime;
      cls = Math.max(cls, sessionValue);
    }

    const lcpEntry = store.lcp.at(-1) || null;
    const paintEntries = performance.getEntriesByType('paint');
    const paints = Object.fromEntries((paintEntries.length ? paintEntries : store.paints).map((entry) => [entry.name, roundMetric(entry.startTime)]));
    const directResources = performance.getEntriesByType('resource');
    const resources = (directResources.length ? directResources : store.resources).map((entry) => {
      let pathname = entry.pathname || null;
      try { pathname ||= new URL(entry.name, location.href).pathname; } catch { pathname ||= null; }
      return {
        pathname,
        initiatorType: entry.initiatorType,
        startTime: roundMetric(entry.startTime),
        duration: roundMetric(entry.duration),
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      };
    });

    const resourceTotals = resources.reduce((result, entry) => ({
      count: result.count + 1,
      transferSize: result.transferSize + (entry.transferSize || 0),
      encodedBodySize: result.encodedBodySize + (entry.encodedBodySize || 0),
      decodedBodySize: result.decodedBodySize + (entry.decodedBodySize || 0),
    }), { count: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0 });

    const longTaskDurations = store.longTasks.map((entry) => entry.duration);
    return {
      navigation: nav ? {
        startTime: roundMetric(nav.startTime),
        fetchStart: roundMetric(nav.fetchStart),
        requestStart: roundMetric(nav.requestStart),
        responseStart: roundMetric(nav.responseStart),
        responseEnd: roundMetric(nav.responseEnd),
        domInteractive: roundMetric(nav.domInteractive),
        domContentLoadedEventEnd: roundMetric(nav.domContentLoadedEventEnd),
        loadEventEnd: roundMetric(nav.loadEventEnd),
        duration: roundMetric(nav.duration),
        ttfbFromRequestStartMs: roundMetric(nav.responseStart - nav.requestStart),
        ttfbFromFetchStartMs: roundMetric(nav.responseStart - nav.fetchStart),
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize,
        type: nav.type,
      } : null,
      paints,
      webVitalLabObservations: {
        lcpMs: lcpEntry ? roundMetric(lcpEntry.startTime) : null,
        lcpEntry,
        cls: roundMetric(cls),
        totalLayoutShift: roundMetric(shifts.reduce((sum, entry) => sum + entry.value, 0)),
        layoutShifts: store.layoutShifts,
      },
      longTasks: {
        thresholdDefinitionMs: 50,
        count: longTaskDurations.length,
        totalDurationMs: roundMetric(longTaskDurations.reduce((sum, value) => sum + value, 0)),
        maxDurationMs: longTaskDurations.length ? roundMetric(Math.max(...longTaskDurations)) : 0,
        entries: store.longTasks,
        gate: null,
        gateReason: 'The repository requires reporting but defines no numeric count or duration ceiling.',
      },
      resources: { totals: resourceTotals, entries: resources },
      observerSupport: {
        supportedEntryTypes: store.supportedEntryTypes,
        observerErrors: store.observerErrors,
      },
    };
  });
}

async function collectEnvironment(page, browser, testInfo) {
  const playwrightPackage = JSON.parse(await fs.readFile(path.join(qaRoot, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'));
  const osReleaseSource = await fs.readFile('/etc/os-release', 'utf8').catch(() => '');
  const browserEnvironment = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGiB: navigator.deviceMemory ?? null,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    language: navigator.language,
    documentLanguage: document.documentElement.lang,
    documentDirection: document.documentElement.dir,
  }));

  return {
    image: { reference: imageReference, digest: imageDigest },
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      playwright: playwrightPackage.version,
      browser: browser.browserType().name(),
      browserVersion: browser.version(),
      osRelease: parseOsRelease(osReleaseSource),
      cpuCountVisibleToNode: os.cpus().length,
    },
    project: {
      name: testInfo.project.name,
      locale: testInfo.project.use.locale,
      timezoneId: testInfo.project.use.timezoneId,
      colorScheme: testInfo.project.use.colorScheme,
      reducedMotion: testInfo.project.use.reducedMotion,
      serviceWorkers: testInfo.project.use.serviceWorkers,
    },
    browserEnvironment,
    profile: {
      networkThrottling: 'none; local loopback preview with synthetic API fulfillments',
      cpuThrottling: 'none',
      cacheState: 'new Playwright browser context per sample',
      referenceDeviceAdr: 'missing in repository performance budget',
    },
  };
}

for (const scenario of scenarios) {
  test(`PERF-BASELINE: ${scenario.id}`, async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== scenario.project, `scenario belongs to ${scenario.project}`);

    const sampleId = `sample-${String(testInfo.repeatEachIndex + 1).padStart(2, '0')}`;
    const outDir = path.join(repoRoot, 'artifacts', 'qa', 'performance', baseline, runId, scenario.id, sampleId);
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
      requests: [],
      completedRequests: [],
      sizeErrors: [],
      pendingSizeReads: [],
    };
    const readiness = {};
    let metrics = null;
    let environment = null;
    let gates = [];
    let result = 'FAIL';
    let failure = null;

    wireNetworkEvidence(page, state);

    try {
      expect(imageDigest, 'PLAYWRIGHT_IMAGE_DIGEST is required so the runner image is attributable').toBeTruthy();
      await installPerformanceObservers(page);
      await installFixture(page, testInfo, state);

      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      readiness.domContentLoadedObservedMs = await page.evaluate(() => performance.now());

      await expect(page.locator('.pc-approot')).toBeVisible();
      readiness.shellReadyMs = await page.evaluate(() => performance.now());

      await expect(page.locator('canvas').first()).toBeVisible();
      await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(fixture.symbols.EURUSD.mid.toFixed(5), { exact: true }).first()).toBeVisible();
      readiness.chartReadyMs = await page.evaluate(() => performance.now());
      readiness.layoutRestoreAfterShellMs = round(readiness.chartReadyMs - readiness.shellReadyMs);

      await expect.poll(() => state.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);
      await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
      await expect.poll(() => state.seen.has('GET /api/academy/bn/watchlist')).toBe(true);
      await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);

      await expect(page.locator('.pc-launch')).toHaveCount(0);
      readiness.applicationReadyLaunchRemovedMs = await page.evaluate(() => performance.now());
      await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      readiness.fontsReadyObservedMs = await page.evaluate(() => performance.now());

      const frames = await sampleActiveChartFrames(page, FRAME_SAMPLE_COUNT);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      metrics = await collectBrowserMetrics(page);
      metrics.readiness = readiness;
      metrics.activeChartFrames = frames;

      await settleRequestSizes(state);
      const documentRequest = state.completedRequests.find((request) => request.resourceType === 'document');
      const documentTraceTtfb = Number(documentRequest?.timing?.responseStart);
      metrics.documentRequestTrace = {
        timing: documentRequest?.timing || null,
        ttfbMs: Number.isFinite(documentTraceTtfb) && documentTraceTtfb >= 0 ? round(documentTraceTtfb) : null,
        semantics: 'Playwright Request.timing responseStart for the main document, measured from request start.',
      };
      environment = await collectEnvironment(page, browser, testInfo);

      gates = [
        evaluateGate('labLcpMs', metrics.webVitalLabObservations.lcpMs),
        evaluateGate('labCls', metrics.webVitalLabObservations.cls),
        evaluateGate('labTtfbMs', metrics.navigation?.ttfbFromRequestStartMs ?? metrics.documentRequestTrace.ttfbMs),
        evaluateGate('activeChartFrameP95Ms', metrics.activeChartFrames.p95Ms),
        evaluateGate('layoutRestoreAfterShellMs', readiness.layoutRestoreAfterShellMs),
      ];

      expect(response?.status(), 'document HTTP status').toBe(200);
      expect(new URL(page.url()).origin, 'run must stay on the mapped preview origin').toBe(new URL(testInfo.project.use.baseURL).origin);
      expect(state.unstubbed, 'all API calls need an explicit synthetic response').toEqual([]);
      expect(state.unexpectedExternal, 'external requests are forbidden').toEqual([]);
      expect(state.pageErrors, 'uncaught page errors').toEqual([]);
      expect(state.requestFailures, 'failed requests').toEqual([]);
      expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
      expect(state.sizeErrors, 'request byte accounting errors').toEqual([]);
      expect(gates.filter((gate) => !gate.pass), 'numeric performance gates').toEqual([]);
      result = 'PASS';
    } catch (error) {
      failure = safeError(error);
      throw error;
    } finally {
      await settleRequestSizes(state);
      await fs.mkdir(outDir, { recursive: true });
      const requestInventory = state.completedRequests.map((request) => ({
        ...request,
        sizes: request.sizes ? Object.fromEntries(Object.entries(request.sizes).map(([key, value]) => [key, Number(value)])) : null,
      }));
      const networkSummary = summarizeRequestSizes(requestInventory, state.requests.length);
      const evidence = {
        schemaVersion: 1,
        requirementIds: ['PC-138', 'PC-140', 'PC-141'],
        scenario: scenario.id,
        sampleId,
        project: testInfo.project.name,
        baseline,
        commit,
        sourceFingerprint,
        runId,
        result,
        failure,
        fixture: {
          id: fixture.fixtureId,
          sha256: fixtureSha256,
          fixedAt: fixture.fixedAt,
          provenance: fixture.provenance,
        },
        methodology: {
          classification: 'deterministic Chromium lab regression',
          fieldCoreWebVitalsEquivalent: false,
          fieldEquivalenceWarning: 'These synthetic, unthrottled, local Chromium observations are not RUM and are not a field p75 Core Web Vitals result.',
          sampleFrameCount: FRAME_SAMPLE_COUNT,
          observerWindowEndsAfterFrameSampling: true,
        },
        metrics,
        gates: {
          source: 'docs/performance/PERFORMANCE_BUDGET.md',
          checks: gates,
          result: gates.length > 0 && gates.every((gate) => gate.pass) ? 'PASS' : 'FAIL',
        },
        recordedWithoutNumericGate: {
          paints: ['first-paint', 'first-contentful-paint'],
          applicationAndChartReadiness: true,
          requestCountAndBytes: true,
          longTasksOver50Ms: true,
        },
        deliberatelyNotMeasured: {
          inp: 'No representative interaction is performed; the repository requires RUM and a separately defined lab interaction proxy.',
          inputFeedback: 'No interaction trace in this navigation-focused baseline.',
          crosshairResponse: 'Requires a dedicated interaction benchmark.',
          quoteToPaintOverhead: 'Requires a timestamped streaming fixture and paint trace.',
          indicator10k: 'Requires a worker benchmark, not a navigation run.',
          memoryLeak: 'The budget states that its observation window and tolerance still require an ADR.',
          jsBundleBudget: 'The budget states that a numeric JS bundle limit still requires an ADR.',
        },
        environment,
        network: {
          summary: networkSummary,
          apiRequests: state.apiRequests,
          mocked: state.mocked,
          mockedWebSockets: state.mockedWebSockets,
          unstubbed: state.unstubbed,
          unexpectedExternal: state.unexpectedExternal,
          requestFailures: state.requestFailures,
          badResponses: state.badResponses,
          sizeErrors: state.sizeErrors,
        },
        pageErrors: state.pageErrors,
      };
      await fs.writeFile(path.join(outDir, 'metrics.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
      await fs.writeFile(path.join(outDir, 'request-inventory.json'), `${JSON.stringify(requestInventory, null, 2)}\n`, 'utf8');
    }
  });
}
