import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFixtureState,
  fixture,
  fixtureSha256,
  installSyntheticFixture,
  requestSummary,
  safeError,
  safeSegment,
  sha256,
  waitForFinalFonts,
} from '../support/synthetic-prochart-fixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const qaRoot = path.resolve(here, '..');
const repoRoot = path.resolve(qaRoot, '..');

const baseline = safeSegment(process.env.QUOTE_COMMIT_BASELINE || process.env.BASELINE_COMMIT || 'working-tree');
const commit = safeSegment(process.env.BASELINE_COMMIT || 'working-tree');
const sourceFingerprint = process.env.BASELINE_SOURCE_FINGERPRINT || 'unrecorded';
const runId = safeSegment(process.env.QUOTE_COMMIT_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z'));
const imageDigest = process.env.PLAYWRIGHT_IMAGE_DIGEST?.trim() || null;
const imageReference = process.env.PLAYWRIGHT_IMAGE_REFERENCE?.trim() || null;

const QUOTE_STEP = 0.00001;
// Avoid round price-axis tick values while preserving small deterministic
// changes. The runtime guard still rejects any target drawn in the prior 250 ms.
const QUOTE_OFFSETS = [1, 2, 4, 6, 7, 9, 11, 12, 14, 16];
const EXPECTED_QUOTE_COUNT = QUOTE_OFFSETS.length;
const TRACE_CATEGORIES = [
  'blink.user_timing',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'toplevel',
].join(',');

// Playwright trace/video capture is deliberately disabled. This harness records
// an explicit Chromium performance trace and its own raw evidence instead.
test.use({ video: 'off', trace: 'off', screenshot: 'off' });

function round(value, digits = 3) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function metricSummary(values) {
  if (!values.length) return { count: 0, minMs: null, meanMs: null, medianMs: null, p95Ms: null, maxMs: null, rawMs: [] };
  return {
    count: values.length,
    minMs: round(Math.min(...values)),
    meanMs: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    medianMs: round(percentile(values, 0.5)),
    p95Ms: round(percentile(values, 0.95)),
    maxMs: round(Math.max(...values)),
    rawMs: values.map((value) => round(value)),
  };
}

function quotePlan() {
  const spec = fixture.symbols.EURUSD;
  return QUOTE_OFFSETS.map((offset, index) => {
    const sequence = index + 1;
    const mid = Number((spec.mid + offset * QUOTE_STEP).toFixed(spec.digits));
    return {
      sequence,
      symbol: 'EURUSD',
      mid,
      bid: Number((mid - 0.00002).toFixed(spec.digits)),
      ask: Number((mid + 0.00002).toFixed(spec.digits)),
      expectedText: mid.toLocaleString('en-US', { minimumFractionDigits: spec.digits, maximumFractionDigits: spec.digits }),
    };
  });
}

async function installQuoteProbe(page) {
  await page.addInitScript(() => {
    const store = {
      schemaVersion: 1,
      armed: false,
      measurementStartMs: null,
      measurementEndMs: null,
      inputs: [],
      domObservations: [],
      canvasCommits: [],
      nextAnimationFrames: [],
      pending: new Map(),
      longTasks: [],
      errors: [],
      candidateCanvases: [],
      userTimingMarks: [],
    };
    globalThis.__prochartQuoteCommitProbe = store;

    const mark = (name) => {
      try {
        performance.mark(name);
        const entry = performance.getEntriesByName(name, 'mark').at(-1);
        if (!entry) throw new Error(`PerformanceMark not retained at creation: ${name}`);
        store.userTimingMarks.push({ name: entry.name, entryType: entry.entryType, startTime: entry.startTime, duration: entry.duration });
      } catch (error) { store.errors.push(`mark:${String(error?.message || error)}`); }
      // Chromium TimeStamp is a trace-level fallback. Some trace-on runs do not
      // emit blink.user_timing even though the Performance Timeline retains the
      // mark; both boundaries use the same target-specific name.
      try { console.timeStamp(name); } catch (error) { store.errors.push(`timestamp:${String(error?.message || error)}`); }
    };

    const isMainChartCanvas = (canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      // The DrawingLayer overlay is itself classed `absolute inset-0`; the
      // lightweight-charts canvases are descendants of mainRef's div with those
      // classes. Requiring a distinct ancestor excludes the overlay and mini charts.
      let ancestor = canvas.parentElement;
      while (ancestor && ancestor !== document.body) {
        if (ancestor instanceof HTMLDivElement
          && ancestor.classList.contains('absolute')
          && ancestor.classList.contains('inset-0')) return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    };

    const canvasDetails = (canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: Number(rect.width.toFixed(3)),
        cssHeight: Number(rect.height.toFixed(3)),
        className: typeof canvas.className === 'string' ? canvas.className : '',
        mainChartCandidate: isMainChartCanvas(canvas),
      };
    };

    const lastMainChartTextAt = new Map();

    const OriginalXHR = XMLHttpRequest;
    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;
    OriginalXHR.prototype.open = function patchedOpen(method, url, ...rest) {
      this.__pcQaUrl = String(url);
      return originalOpen.call(this, method, url, ...rest);
    };
    OriginalXHR.prototype.send = function patchedSend(...args) {
      if (String(this.__pcQaUrl || '').includes('/api/academy/bn/prices')) {
        this.addEventListener('load', () => {
          if (!store.armed) return;
          try {
            const payload = this.responseType === 'json' && this.response
              ? this.response
              : JSON.parse(this.responseText || 'null');
            const probe = payload && payload.__qaQuoteCommit;
            if (!probe || !Number.isInteger(probe.sequence)) return;
            // Multiple mounted consumers can receive the same in-flight quote.
            // The first XHR load establishes the input boundary; later copies of
            // that exact sequence must not create duplicate pending records.
            if (store.inputs.some((item) => item.sequence === probe.sequence)) return;
            const atMs = performance.now();
            const inputMark = `pc.quote.input.${probe.sequence}`;
            mark(inputMark);
            const previousCanvasTextAtMs = lastMainChartTextAt.get(probe.expectedText) ?? null;
            const record = {
              sequence: probe.sequence,
              symbol: probe.symbol,
              expectedText: probe.expectedText,
              mid: probe.mid,
              atMs,
              mark: inputMark,
              xhrUrl: String(this.__pcQaUrl || ''),
              previousCanvasTextAtMs,
              preexistingWithin250Ms: previousCanvasTextAtMs != null && atMs - previousCanvasTextAtMs <= 250,
            };
            store.inputs.push(record);
            store.pending.set(probe.sequence, record);

            queueMicrotask(() => {
              try {
                if (document.body?.textContent?.includes(probe.expectedText)) {
                  const domAtMs = performance.now();
                  const domMark = `pc.quote.dom.${probe.sequence}`;
                  mark(domMark);
                  store.domObservations.push({ sequence: probe.sequence, atMs: domAtMs, mark: domMark });
                }
              } catch (error) { store.errors.push(`dom:${String(error?.message || error)}`); }
            });
          } catch (error) {
            store.errors.push(`xhr:${String(error?.message || error)}`);
          }
        }, { once: true });
      }
      return originalSend.apply(this, args);
    };

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function patchedFillText(text, ...args) {
      const result = originalFillText.call(this, text, ...args);
      const renderedText = String(text).trim();
      if (isMainChartCanvas(this.canvas)) lastMainChartTextAt.set(renderedText, performance.now());
      if (!store.armed || !store.pending.size || !isMainChartCanvas(this.canvas)) return result;
      for (const [sequence, input] of store.pending) {
        if (renderedText !== input.expectedText) continue;
        const atMs = performance.now();
        const canvasMark = `pc.quote.canvas-text.${sequence}`;
        mark(canvasMark);
        const details = canvasDetails(this.canvas);
        store.canvasCommits.push({
          sequence,
          atMs,
          mark: canvasMark,
          renderedText,
          quoteToCanvasTextMs: atMs - input.atMs,
          canvas: details,
          x: Number(args[0]),
          y: Number(args[1]),
          contextStyle: {
            fillStyle: String(this.fillStyle),
            font: String(this.font),
            textAlign: String(this.textAlign),
            textBaseline: String(this.textBaseline),
            globalAlpha: Number(this.globalAlpha),
          },
        });
        if (!store.candidateCanvases.some((item) => item.width === details.width && item.height === details.height && item.cssWidth === details.cssWidth && item.cssHeight === details.cssHeight)) {
          store.candidateCanvases.push(details);
        }
        store.pending.delete(sequence);
        try { performance.measure(`pc.quote.to-canvas.${sequence}`, input.mark, canvasMark); } catch { /* optional evidence */ }
        requestAnimationFrame((rafTimestamp) => {
          const rafAtMs = performance.now();
          const rafMark = `pc.quote.next-raf.${sequence}`;
          mark(rafMark);
          store.nextAnimationFrames.push({
            sequence,
            atMs: rafAtMs,
            callbackTimestampMs: rafTimestamp,
            mark: rafMark,
            canvasTextToNextRafMs: rafAtMs - atMs,
            quoteToNextRafAfterCanvasMs: rafAtMs - input.atMs,
          });
        });
        break;
      }
      return result;
    };

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        if (!store.armed) return;
        for (const entry of list.getEntries()) {
          store.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch (error) {
      store.errors.push(`longtask:${String(error?.message || error)}`);
    }

    store.arm = () => {
      store.armed = true;
      store.measurementStartMs = performance.now();
      store.measurementEndMs = null;
      store.inputs.length = 0;
      store.domObservations.length = 0;
      store.canvasCommits.length = 0;
      store.nextAnimationFrames.length = 0;
      store.pending.clear();
      store.longTasks.length = 0;
      store.errors.length = 0;
      store.candidateCanvases.length = 0;
      store.userTimingMarks.length = 0;
      mark('pc.quote.measurement-start');
    };
    store.markTraceSanity = () => mark('pc.quote.trace-sanity');
    store.finish = () => {
      store.measurementEndMs = performance.now();
      store.armed = false;
      mark('pc.quote.measurement-end');
    };
  });
}

async function startChromiumTrace(context, page) {
  const session = await context.newCDPSession(page);
  await session.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    traceConfig: {
      recordMode: 'recordAsMuchAsPossible',
      includedCategories: TRACE_CATEGORIES.split(','),
    },
  });
  return session;
}

async function stopChromiumTrace(session) {
  const completed = new Promise((resolve) => session.once('Tracing.tracingComplete', resolve));
  await session.send('Tracing.end');
  const { stream } = await completed;
  const chunks = [];
  for (;;) {
    const result = await session.send('IO.read', { handle: stream });
    chunks.push(result.data || '');
    if (result.eof) break;
  }
  await session.send('IO.close', { handle: stream });
  await session.detach();
  return JSON.parse(chunks.join(''));
}

function traceSummary(trace, sequences) {
  const events = Array.isArray(trace?.traceEvents) ? trace.traceEvents : [];
  const userTiming = events.filter((event) => String(event.cat || '').includes('blink.user_timing'));
  const timeStamps = events.filter((event) => event.name === 'TimeStamp');
  const paints = events.filter((event) => event.name === 'Paint').sort((a, b) => a.ts - b.ts);
  const drawFrames = events.filter((event) => event.name === 'DrawFrame').sort((a, b) => a.ts - b.ts);
  const namedMarker = (name) => userTiming.find((event) => event.name === name)
    || timeStamps.find((event) => event.args?.data?.message === name || event.args?.data?.name === name)
    || null;
  const correlations = sequences.map((sequence) => {
    const inputName = `pc.quote.input.${sequence}`;
    const canvasName = `pc.quote.canvas-text.${sequence}`;
    const rafName = `pc.quote.next-raf.${sequence}`;
    const input = namedMarker(inputName);
    const canvas = namedMarker(canvasName);
    const raf = namedMarker(rafName);
    const nextPaint = canvas
      ? paints.find((event) => event.pid === canvas.pid && event.ts >= canvas.ts && event.ts - canvas.ts <= 100_000)
      : null;
    const nextDrawFrame = canvas
      ? drawFrames.find((event) => event.ts >= canvas.ts && event.ts - canvas.ts <= 100_000)
      : null;
    return {
      sequence,
      inputMarkPresent: Boolean(input),
      canvasMarkPresent: Boolean(canvas),
      nextRafMarkPresent: Boolean(raf),
      inputTraceMarkerKind: input?.cat === 'blink.user_timing' ? 'UserTiming' : input ? 'TimeStamp' : null,
      canvasTraceMarkerKind: canvas?.cat === 'blink.user_timing' ? 'UserTiming' : canvas ? 'TimeStamp' : null,
      nextRafTraceMarkerKind: raf?.cat === 'blink.user_timing' ? 'UserTiming' : raf ? 'TimeStamp' : null,
      nearestRendererPaintAfterCanvasMs: canvas && nextPaint ? round((nextPaint.ts - canvas.ts) / 1000) : null,
      nearestDrawFrameAfterCanvasMs: canvas && nextDrawFrame ? round((nextDrawFrame.ts - canvas.ts) / 1000) : null,
      rendererPaintCorrelationSemantics: 'Nearest renderer Paint after the target-specific canvas-text mark, same pid, within 100 ms; ordering corroboration only, not proof that this Paint contains the target label.',
    };
  });
  return {
    traceEventCount: events.length,
    userTimingEventCount: userTiming.length,
    timeStampEventCount: timeStamps.length,
    sanityMarkPresent: Boolean(namedMarker('pc.quote.trace-sanity')),
    paintEventCount: paints.length,
    drawFrameEventCount: drawFrames.length,
    categories: TRACE_CATEGORIES.split(','),
    correlations,
  };
}

function wireRequestEvidence(page, state) {
  state.requests = [];
  state.completedRequests = [];
  state.pendingSizeReads = [];
  state.sizeErrors = [];
  page.on('request', (request) => state.requests.push(requestSummary(request)));
  page.on('requestfinished', (request) => {
    const pending = (async () => {
      try {
        state.completedRequests.push({
          ...requestSummary(request),
          sizes: typeof request.sizes === 'function' ? await request.sizes() : null,
          timing: typeof request.timing === 'function' ? request.timing() : null,
        });
      } catch (error) {
        state.sizeErrors.push({ ...requestSummary(request), error: safeError(error) });
      }
    })();
    state.pendingSizeReads.push(pending);
  });
}

async function settleRequestEvidence(state) {
  let cursor = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    const batch = state.pendingSizeReads.slice(cursor);
    cursor = state.pendingSizeReads.length;
    if (!batch.length) break;
    await Promise.allSettled(batch);
  }
}

function requestTotals(requests) {
  const fields = ['requestBodySize', 'requestHeadersSize', 'responseBodySize', 'responseHeadersSize'];
  const totals = Object.fromEntries(fields.map((field) => [field, 0]));
  for (const request of requests) {
    for (const field of fields) totals[field] += Number(request.sizes?.[field] || 0);
  }
  return {
    requestCount: requests.length,
    ...totals,
    totalWireBytes: Object.values(totals).reduce((sum, value) => sum + value, 0),
  };
}

async function runtimeMetadata(browser, page, testInfo) {
  const playwrightPackage = JSON.parse(await fs.readFile(path.join(qaRoot, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'));
  const osRelease = await fs.readFile('/etc/os-release', 'utf8').catch(() => '');
  return {
    image: { reference: imageReference, digest: imageDigest },
    node: process.version,
    playwright: playwrightPackage.version,
    browser: browser.browserType().name(),
    browserVersion: browser.version(),
    platform: process.platform,
    architecture: process.arch,
    cpuCountVisibleToNode: os.cpus().length,
    loadAverageAtCollection: os.loadavg().map((value) => round(value)),
    osRelease: Object.fromEntries(osRelease.split('\n').flatMap((line) => {
      const match = /^([A-Z_]+)=(.*)$/.exec(line);
      return match ? [[match[1], match[2].replace(/^"|"$/g, '')]] : [];
    })),
    project: {
      name: testInfo.project.name,
      locale: testInfo.project.use.locale,
      timezoneId: testInfo.project.use.timezoneId,
      viewport: testInfo.project.use.viewport,
      deviceScaleFactor: testInfo.project.use.deviceScaleFactor,
    },
    browserEnvironment: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      language: navigator.language,
    })),
  };
}

test('QUOTE-COMMIT: deterministic changing quotes to chart canvas', async ({ page, context, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'direct quote-commit characterization is desktop-only');

  const sampleId = `sample-${String(testInfo.repeatEachIndex + 1).padStart(2, '0')}`;
  const outDir = path.join(repoRoot, 'artifacts', 'qa', 'quote-commit', baseline, runId, 'desktop-chart', sampleId);
  const state = createFixtureState();
  const plan = quotePlan();
  let measurementArmed = false;
  let sentQuotes = 0;
  let traceSession = null;
  let trace = null;
  let probe = null;
  let traceEvidence = null;
  let failure = null;
  let measurementStatus = 'NOT_MEASURED';

  wireRequestEvidence(page, state);
  await installQuoteProbe(page);
  await installSyntheticFixture(page, testInfo, { id: 'quote-commit', onboarding: false }, state, { clock: 'native' });

  // Registered last so it takes first refusal before the general synthetic API route.
  await page.route('**/api/academy/bn/prices*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    state.apiRequests.push({ ...requestSummary(request), query: url.searchParams.get('symbols') || '' });
    state.seen.add(key);
    state.mocked.push(key);

    // More than one mounted consumer can request /prices in the same turn. Issue
    // at most one measured quote until the browser confirms its target-specific
    // canvas commit; concurrent consumers receive the current price without a
    // new probe sequence.
    const committedCount = measurementArmed
      ? await page.evaluate(() => globalThis.__prochartQuoteCommitProbe?.canvasCommits?.length || 0).catch(() => 0)
      : 0;
    const selected = measurementArmed && sentQuotes < plan.length && (sentQuotes === 0 || committedCount >= sentQuotes)
      ? plan[sentQuotes++]
      : null;
    // Every concurrent response carrying the currently in-flight price also
    // carries its probe metadata. This prevents an unmarked sibling response
    // from drawing the target before the measured XHR load boundary.
    const outstanding = measurementArmed && sentQuotes > committedCount ? plan[sentQuotes - 1] : null;
    const signaled = selected || outstanding;
    const lastCommitted = committedCount > 0 ? plan[Math.min(committedCount, plan.length) - 1] : null;
    const active = signaled || lastCommitted || {
      mid: fixture.symbols.EURUSD.mid,
      bid: fixture.symbols.EURUSD.bid,
      ask: fixture.symbols.EURUSD.ask,
    };
    const prices = Object.fromEntries(Object.entries(fixture.symbols).map(([symbol, spec]) => [symbol, {
      mid: symbol === 'EURUSD' ? active.mid : spec.mid,
      bid: symbol === 'EURUSD' ? active.bid : spec.bid,
      ask: symbol === 'EURUSD' ? active.ask : spec.ask,
      change_pct: symbol === 'EURUSD' ? 0.42 : 0,
    }]));
    const body = `${JSON.stringify({
      market_open: true,
      prices,
      ...(signaled ? { __qaQuoteCommit: signaled } : {}),
    })}\n`;
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(Buffer.byteLength(body)),
        'cache-control': 'no-store',
      },
      body,
    });
  });

  try {
    expect(imageDigest, 'PLAYWRIGHT_IMAGE_DIGEST is required').toBeTruthy();
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('.pc-approot')).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
    await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
    await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);
    await expect(page.locator('.pc-launch')).toHaveCount(0);
    await waitForFinalFonts(page);

    const mainCanvasCandidates = await page.evaluate(() => [...document.querySelectorAll('canvas')].map((canvas) => {
      let ancestor = canvas.parentElement;
      let mainChartCandidate = false;
      while (ancestor && ancestor !== document.body) {
        if (ancestor instanceof HTMLDivElement && ancestor.classList.contains('absolute') && ancestor.classList.contains('inset-0')) {
          mainChartCandidate = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const rect = canvas.getBoundingClientRect();
      return { width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height, className: canvas.className, mainChartCandidate };
    }).filter((canvas) => canvas.mainChartCandidate));
    expect(mainCanvasCandidates.length, 'lightweight-charts canvas candidates').toBeGreaterThan(0);

    traceSession = await startChromiumTrace(context, page);
    await page.evaluate(() => globalThis.__prochartQuoteCommitProbe.arm());
    await page.evaluate(() => globalThis.__prochartQuoteCommitProbe.markTraceSanity());
    measurementArmed = true;

    await expect.poll(() => sentQuotes, { timeout: 20_000, intervals: [100, 250, 500] }).toBe(EXPECTED_QUOTE_COUNT);
    await expect.poll(async () => page.evaluate(() => globalThis.__prochartQuoteCommitProbe.canvasCommits.length), {
      timeout: 20_000,
      intervals: [100, 250, 500],
    }).toBe(EXPECTED_QUOTE_COUNT);
    await expect.poll(async () => page.evaluate(() => globalThis.__prochartQuoteCommitProbe.nextAnimationFrames.length), {
      timeout: 5_000,
      intervals: [50, 100, 250],
    }).toBe(EXPECTED_QUOTE_COUNT);

    measurementArmed = false;
    await page.evaluate(() => globalThis.__prochartQuoteCommitProbe.finish());
    trace = await stopChromiumTrace(traceSession);
    traceSession = null;
    probe = await page.evaluate(() => {
      const source = globalThis.__prochartQuoteCommitProbe;
      return {
        schemaVersion: source.schemaVersion,
        measurementStartMs: source.measurementStartMs,
        measurementEndMs: source.measurementEndMs,
        inputs: source.inputs,
        domObservations: source.domObservations,
        canvasCommits: source.canvasCommits,
        nextAnimationFrames: source.nextAnimationFrames,
        pendingSequences: [...source.pending.keys()],
        longTasks: source.longTasks,
        errors: source.errors,
        candidateCanvases: source.candidateCanvases,
        userTimingMarks: source.userTimingMarks,
      };
    });
    traceEvidence = traceSummary(trace, plan.map((item) => item.sequence));

    const inputSequences = probe.inputs.map((item) => item.sequence);
    const commitSequences = probe.canvasCommits.map((item) => item.sequence);
    const rafSequences = probe.nextAnimationFrames.map((item) => item.sequence);
    expect(inputSequences).toEqual(plan.map((item) => item.sequence));
    expect(commitSequences).toEqual(plan.map((item) => item.sequence));
    expect(rafSequences).toEqual(plan.map((item) => item.sequence));
    expect(probe.pendingSequences).toEqual([]);
    expect(probe.errors).toEqual([]);
    expect(probe.inputs.every((item) => item.preexistingWithin250Ms === false), 'target text must not be a pre-existing/recent chart label').toBe(true);
    expect(probe.canvasCommits.every((item) => item.canvas.mainChartCandidate)).toBe(true);
    expect(probe.canvasCommits.map((item) => item.renderedText)).toEqual(plan.map((item) => item.expectedText));
    const userTimingNames = new Set(probe.userTimingMarks.map((entry) => entry.name));
    const expectedUserTimingNames = ['pc.quote.trace-sanity', ...plan.flatMap((item) => [
      `pc.quote.input.${item.sequence}`,
      `pc.quote.canvas-text.${item.sequence}`,
      `pc.quote.next-raf.${item.sequence}`,
    ])];
    expect(expectedUserTimingNames.every((name) => userTimingNames.has(name)), 'all target-specific browser User Timing marks must be retained').toBe(true);
    expect(traceEvidence.sanityMarkPresent, 'post-start marker must be present in the Chromium trace').toBe(true);
    expect(traceEvidence.correlations.every((item) => item.inputMarkPresent && item.canvasMarkPresent && item.nextRafMarkPresent), 'all browser probe marks must be present in the Chromium trace').toBe(true);
    expect(traceEvidence.correlations.every((item) => item.nearestRendererPaintAfterCanvasMs != null), 'every target-specific canvas mark must have a same-renderer Paint within 100 ms').toBe(true);
    expect(state.unstubbed).toEqual([]);
    expect(state.unexpectedExternal).toEqual([]);
    expect(state.pageErrors).toEqual([]);
    expect(state.requestFailures).toEqual([]);
    expect(state.badResponses).toEqual([]);
    measurementStatus = 'MEASURED_UNGATED';
  } catch (error) {
    failure = safeError(error);
    throw error;
  } finally {
    measurementArmed = false;
    if (traceSession) {
      try { trace = await stopChromiumTrace(traceSession); } catch (error) { failure ||= safeError(error); }
    }
    if (!probe) {
      probe = await page.evaluate(() => {
        const source = globalThis.__prochartQuoteCommitProbe;
        if (!source) return null;
        return {
          schemaVersion: source.schemaVersion,
          measurementStartMs: source.measurementStartMs,
          measurementEndMs: source.measurementEndMs,
          inputs: source.inputs,
          domObservations: source.domObservations,
          canvasCommits: source.canvasCommits,
          nextAnimationFrames: source.nextAnimationFrames,
          pendingSequences: [...source.pending.keys()],
          longTasks: source.longTasks,
          errors: source.errors,
          candidateCanvases: source.candidateCanvases,
          userTimingMarks: source.userTimingMarks,
        };
      }).catch(() => null);
    }
    if (trace && !traceEvidence) traceEvidence = traceSummary(trace, plan.map((item) => item.sequence));
    await settleRequestEvidence(state);
    await fs.mkdir(outDir, { recursive: true });

    const requestInventory = state.completedRequests.map((request) => ({
      ...request,
      sizes: request.sizes ? Object.fromEntries(Object.entries(request.sizes).map(([key, value]) => [key, Number(value)])) : null,
    }));
    const quoteToCanvasValues = (probe?.canvasCommits || []).map((item) => item.quoteToCanvasTextMs);
    const canvasToRafValues = (probe?.nextAnimationFrames || []).map((item) => item.canvasTextToNextRafMs);
    const quoteToRafValues = (probe?.nextAnimationFrames || []).map((item) => item.quoteToNextRafAfterCanvasMs);
    const longTasks = (probe?.longTasks || []).filter((entry) => entry.startTime >= (probe?.measurementStartMs || 0)
      && entry.startTime <= (probe?.measurementEndMs || Number.POSITIVE_INFINITY));
    const runtime = await runtimeMetadata(browser, page, testInfo).catch((error) => ({ error: safeError(error) }));

    if (trace) await fs.writeFile(path.join(outDir, 'chromium-trace.json'), `${JSON.stringify(trace)}\n`, 'utf8');
    await fs.writeFile(path.join(outDir, 'probe-events.json'), `${JSON.stringify(probe, null, 2)}\n`, 'utf8');
    await fs.writeFile(path.join(outDir, 'request-inventory.json'), `${JSON.stringify(requestInventory, null, 2)}\n`, 'utf8');

    const evidence = {
      schemaVersion: 1,
      classification: 'deterministic synthetic quote-to-observable-chart-draw characterization',
      fieldEquivalent: false,
      baseline,
      commit,
      sourceFingerprint,
      runId,
      scenario: 'desktop-chart',
      sampleId,
      measurementStatus,
      failure,
      fixture: {
        id: fixture.id,
        sha256: fixtureSha256,
        fixedAt: fixture.fixedAt,
        quotePlan: plan,
        clockMode: 'native monotonic/browser wall clock; synthetic API payload timestamps remain fixed by the fixture',
      },
      profile: {
        workers: 1,
        browserContext: 'new isolated context per Playwright repeat',
        network: 'local disposable preview; every API response synthetic; external origins fail closed',
        cpuThrottling: 'none',
        traceOverhead: 'Chromium tracing is enabled during the measurement window; results characterize this pinned trace-on lab profile.',
        referenceDeviceAdr: null,
      },
      metricSemantics: {
        quoteToCanvasTextMs: 'From the XHR load event for a synthetic prices response, before Axios resolves it to the app, to completion of the first fillText call on a main lightweight-charts canvas whose exact formatted text equals that quote. The harness rejects a target observed on that canvas in the preceding 250 ms. This is a target-specific observable canvas draw command, not compositor presentation.',
        canvasTextToNextRafMs: 'From that fillText completion to the next requestAnimationFrame callback. This is only a presentation-opportunity proxy, not proof of committed pixels.',
        quoteToNextRafAfterCanvasMs: 'XHR input-to-next-rAF after the target-specific canvas draw. It includes application work and scheduler cadence and is not a direct CPU metric.',
        traceMarker: 'Each browser Performance Timeline mark is paired with a same-name Chromium TimeStamp. Trace correlation prefers blink.user_timing and falls back to the TimeStamp when Chromium omits that category.',
        tracePaintCorrelation: 'Nearest same-renderer Paint after each target-specific trace marker, within 100 ms. It corroborates ordering only and is not assumed target-specific.',
      },
      thresholdProvenance: {
        quoteToCanvasTextMs: { threshold: null, result: 'NOT_GATED', reason: 'No repository budget defines this newly isolated metric.' },
        canvasTextToNextRafMs: { threshold: null, result: 'NOT_GATED', reason: 'The existing activeChartFrameP95Ms <20 ms budget measures free-running rAF intervals and is not transferred to this different semantic.' },
        quoteToNextRafAfterCanvasMs: { threshold: null, result: 'NOT_GATED', reason: 'No approved quote-to-present threshold or reference-device ADR exists.' },
        validityProtocol: {
          expectedQuotes: EXPECTED_QUOTE_COUNT,
          exactSequenceRequired: true,
          targetTextMatchRequired: true,
          preexistingTargetWithin250MsForbidden: true,
          userTimingAndTraceMarkersRequired: true,
          sameRendererPaintWithin100MsRequired: true,
          provenance: 'Harness measurement-completeness rule; not a product performance budget.',
        },
      },
      metrics: {
        quoteToCanvasText: metricSummary(quoteToCanvasValues),
        canvasTextToNextRaf: metricSummary(canvasToRafValues),
        quoteToNextRafAfterCanvas: metricSummary(quoteToRafValues),
        longTasks: {
          count: longTasks.length,
          totalDurationMs: round(longTasks.reduce((sum, entry) => sum + entry.duration, 0)),
          maxDurationMs: longTasks.length ? round(Math.max(...longTasks.map((entry) => entry.duration))) : 0,
          entries: longTasks,
          threshold: null,
          result: 'NOT_GATED',
        },
      },
      trace: {
        file: trace ? 'chromium-trace.json' : null,
        sha256: trace ? sha256(`${JSON.stringify(trace)}\n`) : null,
        summary: traceEvidence,
      },
      probe: {
        file: 'probe-events.json',
        inputCount: probe?.inputs?.length || 0,
        canvasCommitCount: probe?.canvasCommits?.length || 0,
        nextAnimationFrameCount: probe?.nextAnimationFrames?.length || 0,
        userTimingMarkCount: probe?.userTimingMarks?.length || 0,
        pendingSequences: probe?.pendingSequences || [],
        errors: probe?.errors || [],
        candidateCanvases: probe?.candidateCanvases || [],
      },
      requests: {
        file: 'request-inventory.json',
        summary: requestTotals(requestInventory),
        observedCount: state.requests.length,
        sizeErrors: state.sizeErrors,
        unexpectedExternal: state.unexpectedExternal,
        unstubbed: state.unstubbed,
        pageErrors: state.pageErrors,
        requestFailures: state.requestFailures,
        badResponses: state.badResponses,
      },
      runtime,
      interpretation: 'MEASURED_UNGATED means the harness isolated a reproducible target-specific chart draw. It does not mean 60fps, budget compliance, field performance, or remediation.',
    };
    await fs.writeFile(path.join(outDir, 'metrics.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
});
