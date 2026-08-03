# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chart-quote-commit.spec.mjs >> QUOTE-COMMIT: deterministic changing quotes to chart canvas
- Location: tests/chart-quote-commit.spec.mjs:443:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 403
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - heading "403 Forbidden" [level=1] [ref=e3]
  - separator [ref=e4]
  - generic [ref=e5]: nginx/1.27.5
```

# Test source

```ts
  418 |     browserVersion: browser.version(),
  419 |     platform: process.platform,
  420 |     architecture: process.arch,
  421 |     cpuCountVisibleToNode: os.cpus().length,
  422 |     loadAverageAtCollection: os.loadavg().map((value) => round(value)),
  423 |     osRelease: Object.fromEntries(osRelease.split('\n').flatMap((line) => {
  424 |       const match = /^([A-Z_]+)=(.*)$/.exec(line);
  425 |       return match ? [[match[1], match[2].replace(/^"|"$/g, '')]] : [];
  426 |     })),
  427 |     project: {
  428 |       name: testInfo.project.name,
  429 |       locale: testInfo.project.use.locale,
  430 |       timezoneId: testInfo.project.use.timezoneId,
  431 |       viewport: testInfo.project.use.viewport,
  432 |       deviceScaleFactor: testInfo.project.use.deviceScaleFactor,
  433 |     },
  434 |     browserEnvironment: await page.evaluate(() => ({
  435 |       userAgent: navigator.userAgent,
  436 |       hardwareConcurrency: navigator.hardwareConcurrency,
  437 |       viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
  438 |       language: navigator.language,
  439 |     })),
  440 |   };
  441 | }
  442 | 
  443 | test('QUOTE-COMMIT: deterministic changing quotes to chart canvas', async ({ page, context, browser }, testInfo) => {
  444 |   test.skip(testInfo.project.name !== 'chromium-desktop', 'direct quote-commit characterization is desktop-only');
  445 | 
  446 |   const sampleId = `sample-${String(testInfo.repeatEachIndex + 1).padStart(2, '0')}`;
  447 |   const outDir = path.join(repoRoot, 'artifacts', 'qa', 'quote-commit', baseline, runId, 'desktop-chart', sampleId);
  448 |   const state = createFixtureState();
  449 |   const plan = quotePlan();
  450 |   let measurementArmed = false;
  451 |   let sentQuotes = 0;
  452 |   let traceSession = null;
  453 |   let trace = null;
  454 |   let probe = null;
  455 |   let traceEvidence = null;
  456 |   let failure = null;
  457 |   let measurementStatus = 'NOT_MEASURED';
  458 | 
  459 |   wireRequestEvidence(page, state);
  460 |   await installQuoteProbe(page);
  461 |   await installSyntheticFixture(page, testInfo, { id: 'quote-commit', onboarding: false }, state);
  462 | 
  463 |   // Registered last so it takes first refusal before the general synthetic API route.
  464 |   await page.route('**/api/academy/bn/prices*', async (route) => {
  465 |     const request = route.request();
  466 |     const url = new URL(request.url());
  467 |     const key = `${request.method()} ${url.pathname}`;
  468 |     state.apiRequests.push({ ...requestSummary(request), query: url.searchParams.get('symbols') || '' });
  469 |     state.seen.add(key);
  470 |     state.mocked.push(key);
  471 | 
  472 |     // More than one mounted consumer can request /prices in the same turn. Issue
  473 |     // at most one measured quote until the browser confirms its target-specific
  474 |     // canvas commit; concurrent consumers receive the current price without a
  475 |     // new probe sequence.
  476 |     const committedCount = measurementArmed
  477 |       ? await page.evaluate(() => globalThis.__prochartQuoteCommitProbe?.canvasCommits?.length || 0).catch(() => 0)
  478 |       : 0;
  479 |     const selected = measurementArmed && sentQuotes < plan.length && (sentQuotes === 0 || committedCount >= sentQuotes)
  480 |       ? plan[sentQuotes++]
  481 |       : null;
  482 |     // Every concurrent response carrying the currently in-flight price also
  483 |     // carries its probe metadata. This prevents an unmarked sibling response
  484 |     // from drawing the target before the measured XHR load boundary.
  485 |     const outstanding = measurementArmed && sentQuotes > committedCount ? plan[sentQuotes - 1] : null;
  486 |     const signaled = selected || outstanding;
  487 |     const lastCommitted = committedCount > 0 ? plan[Math.min(committedCount, plan.length) - 1] : null;
  488 |     const active = signaled || lastCommitted || {
  489 |       mid: fixture.symbols.EURUSD.mid,
  490 |       bid: fixture.symbols.EURUSD.bid,
  491 |       ask: fixture.symbols.EURUSD.ask,
  492 |     };
  493 |     const prices = Object.fromEntries(Object.entries(fixture.symbols).map(([symbol, spec]) => [symbol, {
  494 |       mid: symbol === 'EURUSD' ? active.mid : spec.mid,
  495 |       bid: symbol === 'EURUSD' ? active.bid : spec.bid,
  496 |       ask: symbol === 'EURUSD' ? active.ask : spec.ask,
  497 |       change_pct: symbol === 'EURUSD' ? 0.42 : 0,
  498 |     }]));
  499 |     const body = `${JSON.stringify({
  500 |       market_open: true,
  501 |       prices,
  502 |       ...(signaled ? { __qaQuoteCommit: signaled } : {}),
  503 |     })}\n`;
  504 |     await route.fulfill({
  505 |       status: 200,
  506 |       headers: {
  507 |         'content-type': 'application/json; charset=utf-8',
  508 |         'content-length': String(Buffer.byteLength(body)),
  509 |         'cache-control': 'no-store',
  510 |       },
  511 |       body,
  512 |     });
  513 |   });
  514 | 
  515 |   try {
  516 |     expect(imageDigest, 'PLAYWRIGHT_IMAGE_DIGEST is required').toBeTruthy();
  517 |     const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
> 518 |     expect(response?.status()).toBe(200);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  519 |     await expect(page.locator('.pc-approot')).toBeVisible();
  520 |     await expect(page.locator('canvas').first()).toBeVisible();
  521 |     await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
  522 |     await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
  523 |     await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);
  524 |     await expect(page.locator('.pc-launch')).toHaveCount(0);
  525 |     await waitForFinalFonts(page);
  526 | 
  527 |     const mainCanvasCandidates = await page.evaluate(() => [...document.querySelectorAll('canvas')].map((canvas) => {
  528 |       let ancestor = canvas.parentElement;
  529 |       let mainChartCandidate = false;
  530 |       while (ancestor && ancestor !== document.body) {
  531 |         if (ancestor instanceof HTMLDivElement && ancestor.classList.contains('absolute') && ancestor.classList.contains('inset-0')) {
  532 |           mainChartCandidate = true;
  533 |           break;
  534 |         }
  535 |         ancestor = ancestor.parentElement;
  536 |       }
  537 |       const rect = canvas.getBoundingClientRect();
  538 |       return { width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height, className: canvas.className, mainChartCandidate };
  539 |     }).filter((canvas) => canvas.mainChartCandidate));
  540 |     expect(mainCanvasCandidates.length, 'lightweight-charts canvas candidates').toBeGreaterThan(0);
  541 | 
  542 |     traceSession = await startChromiumTrace(context, page);
  543 |     await page.evaluate(() => globalThis.__prochartQuoteCommitProbe.arm());
  544 |     await page.evaluate(() => globalThis.__prochartQuoteCommitProbe.markTraceSanity());
  545 |     measurementArmed = true;
  546 | 
  547 |     await expect.poll(() => sentQuotes, { timeout: 20_000, intervals: [100, 250, 500] }).toBe(EXPECTED_QUOTE_COUNT);
  548 |     await expect.poll(async () => page.evaluate(() => globalThis.__prochartQuoteCommitProbe.canvasCommits.length), {
  549 |       timeout: 20_000,
  550 |       intervals: [100, 250, 500],
  551 |     }).toBe(EXPECTED_QUOTE_COUNT);
  552 |     await expect.poll(async () => page.evaluate(() => globalThis.__prochartQuoteCommitProbe.nextAnimationFrames.length), {
  553 |       timeout: 5_000,
  554 |       intervals: [50, 100, 250],
  555 |     }).toBe(EXPECTED_QUOTE_COUNT);
  556 | 
  557 |     measurementArmed = false;
  558 |     await page.evaluate(() => globalThis.__prochartQuoteCommitProbe.finish());
  559 |     trace = await stopChromiumTrace(traceSession);
  560 |     traceSession = null;
  561 |     probe = await page.evaluate(() => {
  562 |       const source = globalThis.__prochartQuoteCommitProbe;
  563 |       return {
  564 |         schemaVersion: source.schemaVersion,
  565 |         measurementStartMs: source.measurementStartMs,
  566 |         measurementEndMs: source.measurementEndMs,
  567 |         inputs: source.inputs,
  568 |         domObservations: source.domObservations,
  569 |         canvasCommits: source.canvasCommits,
  570 |         nextAnimationFrames: source.nextAnimationFrames,
  571 |         pendingSequences: [...source.pending.keys()],
  572 |         longTasks: source.longTasks,
  573 |         errors: source.errors,
  574 |         candidateCanvases: source.candidateCanvases,
  575 |         userTimingMarks: source.userTimingMarks,
  576 |       };
  577 |     });
  578 |     traceEvidence = traceSummary(trace, plan.map((item) => item.sequence));
  579 | 
  580 |     const inputSequences = probe.inputs.map((item) => item.sequence);
  581 |     const commitSequences = probe.canvasCommits.map((item) => item.sequence);
  582 |     const rafSequences = probe.nextAnimationFrames.map((item) => item.sequence);
  583 |     expect(inputSequences).toEqual(plan.map((item) => item.sequence));
  584 |     expect(commitSequences).toEqual(plan.map((item) => item.sequence));
  585 |     expect(rafSequences).toEqual(plan.map((item) => item.sequence));
  586 |     expect(probe.pendingSequences).toEqual([]);
  587 |     expect(probe.errors).toEqual([]);
  588 |     expect(probe.inputs.every((item) => item.preexistingWithin250Ms === false), 'target text must not be a pre-existing/recent chart label').toBe(true);
  589 |     expect(probe.canvasCommits.every((item) => item.canvas.mainChartCandidate)).toBe(true);
  590 |     expect(probe.canvasCommits.map((item) => item.renderedText)).toEqual(plan.map((item) => item.expectedText));
  591 |     const userTimingNames = new Set(probe.userTimingMarks.map((entry) => entry.name));
  592 |     const expectedUserTimingNames = ['pc.quote.trace-sanity', ...plan.flatMap((item) => [
  593 |       `pc.quote.input.${item.sequence}`,
  594 |       `pc.quote.canvas-text.${item.sequence}`,
  595 |       `pc.quote.next-raf.${item.sequence}`,
  596 |     ])];
  597 |     expect(expectedUserTimingNames.every((name) => userTimingNames.has(name)), 'all target-specific browser User Timing marks must be retained').toBe(true);
  598 |     expect(traceEvidence.sanityMarkPresent, 'post-start marker must be present in the Chromium trace').toBe(true);
  599 |     expect(traceEvidence.correlations.every((item) => item.inputMarkPresent && item.canvasMarkPresent && item.nextRafMarkPresent), 'all browser probe marks must be present in the Chromium trace').toBe(true);
  600 |     expect(state.unstubbed).toEqual([]);
  601 |     expect(state.unexpectedExternal).toEqual([]);
  602 |     expect(state.pageErrors).toEqual([]);
  603 |     expect(state.requestFailures).toEqual([]);
  604 |     expect(state.badResponses).toEqual([]);
  605 |     measurementStatus = 'MEASURED_UNGATED';
  606 |   } catch (error) {
  607 |     failure = safeError(error);
  608 |     throw error;
  609 |   } finally {
  610 |     measurementArmed = false;
  611 |     if (traceSession) {
  612 |       try { trace = await stopChromiumTrace(traceSession); } catch (error) { failure ||= safeError(error); }
  613 |     }
  614 |     if (!probe) {
  615 |       probe = await page.evaluate(() => {
  616 |         const source = globalThis.__prochartQuoteCommitProbe;
  617 |         if (!source) return null;
  618 |         return {
```