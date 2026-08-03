# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance-baseline.spec.mjs >> PERF-BASELINE: mobile-chart
- Location: tests/performance-baseline.spec.mjs:652:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.pc-approot')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('.pc-approot')

```

# Test source

```ts
  589 |       },
  590 |       longTasks: {
  591 |         thresholdDefinitionMs: 50,
  592 |         count: longTaskDurations.length,
  593 |         totalDurationMs: roundMetric(longTaskDurations.reduce((sum, value) => sum + value, 0)),
  594 |         maxDurationMs: longTaskDurations.length ? roundMetric(Math.max(...longTaskDurations)) : 0,
  595 |         entries: store.longTasks,
  596 |         gate: null,
  597 |         gateReason: 'The repository requires reporting but defines no numeric count or duration ceiling.',
  598 |       },
  599 |       resources: { totals: resourceTotals, entries: resources },
  600 |       observerSupport: {
  601 |         supportedEntryTypes: store.supportedEntryTypes,
  602 |         observerErrors: store.observerErrors,
  603 |       },
  604 |     };
  605 |   });
  606 | }
  607 | 
  608 | async function collectEnvironment(page, browser, testInfo) {
  609 |   const playwrightPackage = JSON.parse(await fs.readFile(path.join(qaRoot, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'));
  610 |   const osReleaseSource = await fs.readFile('/etc/os-release', 'utf8').catch(() => '');
  611 |   const browserEnvironment = await page.evaluate(() => ({
  612 |     userAgent: navigator.userAgent,
  613 |     hardwareConcurrency: navigator.hardwareConcurrency,
  614 |     deviceMemoryGiB: navigator.deviceMemory ?? null,
  615 |     viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
  616 |     language: navigator.language,
  617 |     documentLanguage: document.documentElement.lang,
  618 |     documentDirection: document.documentElement.dir,
  619 |   }));
  620 | 
  621 |   return {
  622 |     image: { reference: imageReference, digest: imageDigest },
  623 |     runtime: {
  624 |       node: process.version,
  625 |       platform: process.platform,
  626 |       architecture: process.arch,
  627 |       playwright: playwrightPackage.version,
  628 |       browser: browser.browserType().name(),
  629 |       browserVersion: browser.version(),
  630 |       osRelease: parseOsRelease(osReleaseSource),
  631 |       cpuCountVisibleToNode: os.cpus().length,
  632 |     },
  633 |     project: {
  634 |       name: testInfo.project.name,
  635 |       locale: testInfo.project.use.locale,
  636 |       timezoneId: testInfo.project.use.timezoneId,
  637 |       colorScheme: testInfo.project.use.colorScheme,
  638 |       reducedMotion: testInfo.project.use.reducedMotion,
  639 |       serviceWorkers: testInfo.project.use.serviceWorkers,
  640 |     },
  641 |     browserEnvironment,
  642 |     profile: {
  643 |       networkThrottling: 'none; local loopback preview with synthetic API fulfillments',
  644 |       cpuThrottling: 'none',
  645 |       cacheState: 'new Playwright browser context per sample',
  646 |       referenceDeviceAdr: 'missing in repository performance budget',
  647 |     },
  648 |   };
  649 | }
  650 | 
  651 | for (const scenario of scenarios) {
  652 |   test(`PERF-BASELINE: ${scenario.id}`, async ({ page, browser }, testInfo) => {
  653 |     test.skip(testInfo.project.name !== scenario.project, `scenario belongs to ${scenario.project}`);
  654 | 
  655 |     const sampleId = `sample-${String(testInfo.repeatEachIndex + 1).padStart(2, '0')}`;
  656 |     const outDir = path.join(repoRoot, 'artifacts', 'qa', 'performance', baseline, runId, scenario.id, sampleId);
  657 |     const state = {
  658 |       apiRequests: [],
  659 |       mocked: [],
  660 |       mockedWebSockets: [],
  661 |       seen: new Set(),
  662 |       unexpectedExternal: [],
  663 |       unstubbed: [],
  664 |       pageErrors: [],
  665 |       requestFailures: [],
  666 |       badResponses: [],
  667 |       requests: [],
  668 |       completedRequests: [],
  669 |       sizeErrors: [],
  670 |       pendingSizeReads: [],
  671 |     };
  672 |     const readiness = {};
  673 |     let metrics = null;
  674 |     let environment = null;
  675 |     let gates = [];
  676 |     let result = 'FAIL';
  677 |     let failure = null;
  678 | 
  679 |     wireNetworkEvidence(page, state);
  680 | 
  681 |     try {
  682 |       expect(imageDigest, 'PLAYWRIGHT_IMAGE_DIGEST is required so the runner image is attributable').toBeTruthy();
  683 |       await installPerformanceObservers(page);
  684 |       await installFixture(page, testInfo, state);
  685 | 
  686 |       const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  687 |       readiness.domContentLoadedObservedMs = await page.evaluate(() => performance.now());
  688 | 
> 689 |       await expect(page.locator('.pc-approot')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  690 |       readiness.shellReadyMs = await page.evaluate(() => performance.now());
  691 | 
  692 |       await expect(page.locator('canvas').first()).toBeVisible();
  693 |       await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
  694 |       await expect(page.getByText(fixture.symbols.EURUSD.mid.toFixed(5), { exact: true }).first()).toBeVisible();
  695 |       readiness.chartReadyMs = await page.evaluate(() => performance.now());
  696 |       readiness.layoutRestoreAfterShellMs = round(readiness.chartReadyMs - readiness.shellReadyMs);
  697 | 
  698 |       await expect.poll(() => state.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);
  699 |       await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
  700 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/watchlist')).toBe(true);
  701 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);
  702 | 
  703 |       await expect(page.locator('.pc-launch')).toHaveCount(0);
  704 |       readiness.applicationReadyLaunchRemovedMs = await page.evaluate(() => performance.now());
  705 |       await page.waitForLoadState('load');
  706 |       await page.evaluate(() => document.fonts.ready);
  707 |       readiness.fontsReadyObservedMs = await page.evaluate(() => performance.now());
  708 | 
  709 |       const frames = await sampleActiveChartFrames(page, FRAME_SAMPLE_COUNT);
  710 |       await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  711 |       metrics = await collectBrowserMetrics(page);
  712 |       metrics.readiness = readiness;
  713 |       metrics.activeChartFrames = frames;
  714 | 
  715 |       await settleRequestSizes(state);
  716 |       const documentRequest = state.completedRequests.find((request) => request.resourceType === 'document');
  717 |       const documentTraceTtfb = Number(documentRequest?.timing?.responseStart);
  718 |       metrics.documentRequestTrace = {
  719 |         timing: documentRequest?.timing || null,
  720 |         ttfbMs: Number.isFinite(documentTraceTtfb) && documentTraceTtfb >= 0 ? round(documentTraceTtfb) : null,
  721 |         semantics: 'Playwright Request.timing responseStart for the main document, measured from request start.',
  722 |       };
  723 |       environment = await collectEnvironment(page, browser, testInfo);
  724 | 
  725 |       gates = [
  726 |         evaluateGate('labLcpMs', metrics.webVitalLabObservations.lcpMs),
  727 |         evaluateGate('labCls', metrics.webVitalLabObservations.cls),
  728 |         evaluateGate('labTtfbMs', metrics.navigation?.ttfbFromRequestStartMs ?? metrics.documentRequestTrace.ttfbMs),
  729 |         evaluateGate('activeChartFrameP95Ms', metrics.activeChartFrames.p95Ms),
  730 |         evaluateGate('layoutRestoreAfterShellMs', readiness.layoutRestoreAfterShellMs),
  731 |       ];
  732 | 
  733 |       expect(response?.status(), 'document HTTP status').toBe(200);
  734 |       expect(new URL(page.url()).origin, 'run must stay on the mapped preview origin').toBe(new URL(testInfo.project.use.baseURL).origin);
  735 |       expect(state.unstubbed, 'all API calls need an explicit synthetic response').toEqual([]);
  736 |       expect(state.unexpectedExternal, 'external requests are forbidden').toEqual([]);
  737 |       expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  738 |       expect(state.requestFailures, 'failed requests').toEqual([]);
  739 |       expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
  740 |       expect(state.sizeErrors, 'request byte accounting errors').toEqual([]);
  741 |       expect(gates.filter((gate) => !gate.pass), 'numeric performance gates').toEqual([]);
  742 |       result = 'PASS';
  743 |     } catch (error) {
  744 |       failure = safeError(error);
  745 |       throw error;
  746 |     } finally {
  747 |       await settleRequestSizes(state);
  748 |       await fs.mkdir(outDir, { recursive: true });
  749 |       const requestInventory = state.completedRequests.map((request) => ({
  750 |         ...request,
  751 |         sizes: request.sizes ? Object.fromEntries(Object.entries(request.sizes).map(([key, value]) => [key, Number(value)])) : null,
  752 |       }));
  753 |       const networkSummary = summarizeRequestSizes(requestInventory, state.requests.length);
  754 |       const evidence = {
  755 |         schemaVersion: 1,
  756 |         requirementIds: ['PC-138', 'PC-140', 'PC-141'],
  757 |         scenario: scenario.id,
  758 |         sampleId,
  759 |         project: testInfo.project.name,
  760 |         baseline,
  761 |         commit,
  762 |         sourceFingerprint,
  763 |         runId,
  764 |         result,
  765 |         failure,
  766 |         fixture: {
  767 |           id: fixture.fixtureId,
  768 |           sha256: fixtureSha256,
  769 |           fixedAt: fixture.fixedAt,
  770 |           provenance: fixture.provenance,
  771 |         },
  772 |         methodology: {
  773 |           classification: 'deterministic Chromium lab regression',
  774 |           fieldCoreWebVitalsEquivalent: false,
  775 |           fieldEquivalenceWarning: 'These synthetic, unthrottled, local Chromium observations are not RUM and are not a field p75 Core Web Vitals result.',
  776 |           sampleFrameCount: FRAME_SAMPLE_COUNT,
  777 |           observerWindowEndsAfterFrameSampling: true,
  778 |         },
  779 |         metrics,
  780 |         gates: {
  781 |           source: 'docs/performance/PERFORMANCE_BUDGET.md',
  782 |           checks: gates,
  783 |           result: gates.length > 0 && gates.every((gate) => gate.pass) ? 'PASS' : 'FAIL',
  784 |         },
  785 |         recordedWithoutNumericGate: {
  786 |           paints: ['first-paint', 'first-contentful-paint'],
  787 |           applicationAndChartReadiness: true,
  788 |           requestCountAndBytes: true,
  789 |           longTasksOver50Ms: true,
```