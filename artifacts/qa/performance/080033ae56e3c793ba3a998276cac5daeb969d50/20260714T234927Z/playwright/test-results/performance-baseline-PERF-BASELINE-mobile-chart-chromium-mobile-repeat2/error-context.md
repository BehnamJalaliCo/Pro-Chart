# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance-baseline.spec.mjs >> PERF-BASELINE: mobile-chart
- Location: tests/performance-baseline.spec.mjs:601:3

# Error details

```
Error: numeric performance gates

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 12

- Array []
+ Array [
+   Object {
+     "actual": null,
+     "evidence": "local navigation lab proxy",
+     "metric": "labTtfbMs",
+     "operator": "<",
+     "pass": false,
+     "result": "FAIL",
+     "threshold": 800,
+     "unit": "ms",
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - main [ref=e4]:
    - heading "Pro-Chart — چارت حرفه‌ای بازارهای مالی" [level=1] [ref=e5]
    - generic [ref=e6]:
      - generic [ref=e7]:
        - button "جستجوی نماد" [ref=e8] [cursor=pointer]:
          - generic [ref=e9]:
            - img [ref=e12]
            - img [ref=e25]
          - generic [ref=e29]: EURUSD
        - generic [ref=e33]: "1.14212"
        - button "تایم‌فریم" [ref=e34] [cursor=pointer]:
          - text: 1H
          - img [ref=e35]
        - button "نوعِ چارت" [ref=e37] [cursor=pointer]:
          - img [ref=e38]
        - button "بیشتر" [ref=e41] [cursor=pointer]:
          - img [ref=e42]
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic [ref=e46]:
            - img [ref=e49]
            - img [ref=e62]
          - generic [ref=e66]: EURUSD
          - generic [ref=e67]: 1H · فارکس
          - img [ref=e68]
          - generic [ref=e72]:
            - generic [ref=e73]:
              - generic [ref=e74]: O
              - generic [ref=e75]: "1.14201"
            - generic [ref=e76]:
              - generic [ref=e77]: H
              - generic [ref=e78]: "1.14243"
            - generic [ref=e79]:
              - generic [ref=e80]: L
              - generic [ref=e81]: "1.14169"
            - generic [ref=e82]:
              - generic [ref=e83]: C
              - generic [ref=e84]: "1.14212"
          - generic [ref=e85]: +0.00011 (+0.01%)
          - generic [ref=e86]:
            - generic [ref=e87]: Vol
            - generic [ref=e88]: 2.88K
          - button "تنظیماتِ چارت" [ref=e89] [cursor=pointer]:
            - img [ref=e90]
        - generic [ref=e93]:
          - table [ref=e96]:
            - row [ref=e97]:
              - cell
              - cell [ref=e98]
              - cell [ref=e102]
            - row [ref=e106]:
              - cell
              - cell [ref=e107]
              - cell [ref=e111]
          - generic:
            - generic [ref=e114]:
              - button "1.14210 SELL" [ref=e115] [cursor=pointer]:
                - generic [ref=e116]: "1.14210"
                - generic [ref=e117]: SELL
              - generic [ref=e118]:
                - generic [ref=e119]: "4"
                - generic [ref=e120]: اسپرد
              - button "1.14214 BUY" [ref=e121] [cursor=pointer]:
                - generic [ref=e122]: "1.14214"
                - generic [ref=e123]: BUY
            - generic [ref=e124]:
              - generic [ref=e125]: "+0.00011"
              - generic [ref=e126]: (+0.01%)
          - generic:
            - img
            - generic: 25:04
          - generic [ref=e127]:
            - button "مقیاسِ درصدی" [ref=e128] [cursor=pointer]: ٪
            - button "مقیاسِ لگاریتمی" [ref=e129] [cursor=pointer]: log
            - button "مقیاسِ خودکار (Fit)" [ref=e130] [cursor=pointer]: auto
          - generic:
            - img
            - generic: حجم · Vol
          - img "بازارنما"
        - generic [ref=e131]:
          - button "1D" [ref=e132] [cursor=pointer]
          - button "5D" [ref=e133] [cursor=pointer]
          - button "1M" [ref=e134] [cursor=pointer]
          - button "3M" [ref=e135] [cursor=pointer]
          - button "6M" [ref=e136] [cursor=pointer]
          - button "YTD" [ref=e137] [cursor=pointer]
          - button "1Y" [ref=e138] [cursor=pointer]
          - button "5Y" [ref=e139] [cursor=pointer]
          - button "All" [ref=e140] [cursor=pointer]
          - button "پرش به تاریخ" [ref=e142] [cursor=pointer]:
            - img [ref=e143]
          - button "16:04:56 (تهران)" [ref=e147] [cursor=pointer]:
            - img [ref=e148]
            - generic [ref=e151]: 16:04:56
            - generic [ref=e152]: (تهران)
  - navigation [ref=e153]:
    - button "چارت" [ref=e154] [cursor=pointer]:
      - img [ref=e156]
      - generic [ref=e160]: چارت
    - button "واچ‌لیست" [ref=e161] [cursor=pointer]:
      - img [ref=e163]
      - generic [ref=e164]: واچ‌لیست
    - button "سیگنالِ AI" [ref=e165] [cursor=pointer]:
      - img [ref=e167]
    - button "بازارها" [ref=e169] [cursor=pointer]:
      - img [ref=e171]
      - generic [ref=e174]: بازارها
    - button "پروفایل" [ref=e175] [cursor=pointer]:
      - img [ref=e177]
      - generic [ref=e180]: پروفایل
```

# Test source

```ts
  583 |       name: testInfo.project.name,
  584 |       locale: testInfo.project.use.locale,
  585 |       timezoneId: testInfo.project.use.timezoneId,
  586 |       colorScheme: testInfo.project.use.colorScheme,
  587 |       reducedMotion: testInfo.project.use.reducedMotion,
  588 |       serviceWorkers: testInfo.project.use.serviceWorkers,
  589 |     },
  590 |     browserEnvironment,
  591 |     profile: {
  592 |       networkThrottling: 'none; local loopback preview with synthetic API fulfillments',
  593 |       cpuThrottling: 'none',
  594 |       cacheState: 'new Playwright browser context per sample',
  595 |       referenceDeviceAdr: 'missing in repository performance budget',
  596 |     },
  597 |   };
  598 | }
  599 | 
  600 | for (const scenario of scenarios) {
  601 |   test(`PERF-BASELINE: ${scenario.id}`, async ({ page, browser }, testInfo) => {
  602 |     test.skip(testInfo.project.name !== scenario.project, `scenario belongs to ${scenario.project}`);
  603 | 
  604 |     const sampleId = `sample-${String(testInfo.repeatEachIndex + 1).padStart(2, '0')}`;
  605 |     const outDir = path.join(repoRoot, 'artifacts', 'qa', 'performance', baseline, runId, scenario.id, sampleId);
  606 |     const state = {
  607 |       apiRequests: [],
  608 |       mocked: [],
  609 |       mockedWebSockets: [],
  610 |       seen: new Set(),
  611 |       unexpectedExternal: [],
  612 |       unstubbed: [],
  613 |       pageErrors: [],
  614 |       requestFailures: [],
  615 |       badResponses: [],
  616 |       requests: [],
  617 |       completedRequests: [],
  618 |       sizeErrors: [],
  619 |       pendingSizeReads: [],
  620 |     };
  621 |     const readiness = {};
  622 |     let metrics = null;
  623 |     let environment = null;
  624 |     let gates = [];
  625 |     let result = 'FAIL';
  626 |     let failure = null;
  627 | 
  628 |     wireNetworkEvidence(page, state);
  629 | 
  630 |     try {
  631 |       expect(imageDigest, 'PLAYWRIGHT_IMAGE_DIGEST is required so the runner image is attributable').toBeTruthy();
  632 |       await installPerformanceObservers(page);
  633 |       await installFixture(page, testInfo, state);
  634 | 
  635 |       const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  636 |       readiness.domContentLoadedObservedMs = await page.evaluate(() => performance.now());
  637 | 
  638 |       await expect(page.locator('.pc-approot')).toBeVisible();
  639 |       readiness.shellReadyMs = await page.evaluate(() => performance.now());
  640 | 
  641 |       await expect(page.locator('canvas').first()).toBeVisible();
  642 |       await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
  643 |       await expect(page.getByText(fixture.symbols.EURUSD.mid.toFixed(5), { exact: true }).first()).toBeVisible();
  644 |       readiness.chartReadyMs = await page.evaluate(() => performance.now());
  645 |       readiness.layoutRestoreAfterShellMs = round(readiness.chartReadyMs - readiness.shellReadyMs);
  646 | 
  647 |       await expect.poll(() => state.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);
  648 |       await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
  649 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/watchlist')).toBe(true);
  650 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);
  651 | 
  652 |       await expect(page.locator('.pc-launch')).toHaveCount(0);
  653 |       readiness.applicationReadyLaunchRemovedMs = await page.evaluate(() => performance.now());
  654 |       await page.waitForLoadState('load');
  655 |       await page.evaluate(() => document.fonts.ready);
  656 |       readiness.fontsReadyObservedMs = await page.evaluate(() => performance.now());
  657 | 
  658 |       const frames = await sampleActiveChartFrames(page, FRAME_SAMPLE_COUNT);
  659 |       await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  660 |       metrics = await collectBrowserMetrics(page);
  661 |       metrics.readiness = readiness;
  662 |       metrics.activeChartFrames = frames;
  663 | 
  664 |       await settleRequestSizes(state);
  665 |       environment = await collectEnvironment(page, browser, testInfo);
  666 | 
  667 |       gates = [
  668 |         evaluateGate('labLcpMs', metrics.webVitalLabObservations.lcpMs),
  669 |         evaluateGate('labCls', metrics.webVitalLabObservations.cls),
  670 |         evaluateGate('labTtfbMs', metrics.navigation?.ttfbFromRequestStartMs),
  671 |         evaluateGate('activeChartFrameP95Ms', metrics.activeChartFrames.p95Ms),
  672 |         evaluateGate('layoutRestoreAfterShellMs', readiness.layoutRestoreAfterShellMs),
  673 |       ];
  674 | 
  675 |       expect(response?.status(), 'document HTTP status').toBe(200);
  676 |       expect(new URL(page.url()).origin, 'run must stay on the mapped preview origin').toBe(new URL(testInfo.project.use.baseURL).origin);
  677 |       expect(state.unstubbed, 'all API calls need an explicit synthetic response').toEqual([]);
  678 |       expect(state.unexpectedExternal, 'external requests are forbidden').toEqual([]);
  679 |       expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  680 |       expect(state.requestFailures, 'failed requests').toEqual([]);
  681 |       expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
  682 |       expect(state.sizeErrors, 'request byte accounting errors').toEqual([]);
> 683 |       expect(gates.filter((gate) => !gate.pass), 'numeric performance gates').toEqual([]);
      |                                                                               ^ Error: numeric performance gates
  684 |       result = 'PASS';
  685 |     } catch (error) {
  686 |       failure = safeError(error);
  687 |       throw error;
  688 |     } finally {
  689 |       await settleRequestSizes(state);
  690 |       await fs.mkdir(outDir, { recursive: true });
  691 |       const requestInventory = state.completedRequests.map((request) => ({
  692 |         ...request,
  693 |         sizes: request.sizes ? Object.fromEntries(Object.entries(request.sizes).map(([key, value]) => [key, Number(value)])) : null,
  694 |       }));
  695 |       const networkSummary = summarizeRequestSizes(requestInventory, state.requests.length);
  696 |       const evidence = {
  697 |         schemaVersion: 1,
  698 |         requirementIds: ['PC-138', 'PC-140', 'PC-141'],
  699 |         scenario: scenario.id,
  700 |         sampleId,
  701 |         project: testInfo.project.name,
  702 |         baseline,
  703 |         commit,
  704 |         sourceFingerprint,
  705 |         runId,
  706 |         result,
  707 |         failure,
  708 |         fixture: {
  709 |           id: fixture.fixtureId,
  710 |           sha256: fixtureSha256,
  711 |           fixedAt: fixture.fixedAt,
  712 |           provenance: fixture.provenance,
  713 |         },
  714 |         methodology: {
  715 |           classification: 'deterministic Chromium lab regression',
  716 |           fieldCoreWebVitalsEquivalent: false,
  717 |           fieldEquivalenceWarning: 'These synthetic, unthrottled, local Chromium observations are not RUM and are not a field p75 Core Web Vitals result.',
  718 |           sampleFrameCount: FRAME_SAMPLE_COUNT,
  719 |           observerWindowEndsAfterFrameSampling: true,
  720 |         },
  721 |         metrics,
  722 |         gates: {
  723 |           source: 'docs/performance/PERFORMANCE_BUDGET.md',
  724 |           checks: gates,
  725 |           result: gates.length > 0 && gates.every((gate) => gate.pass) ? 'PASS' : 'FAIL',
  726 |         },
  727 |         recordedWithoutNumericGate: {
  728 |           paints: ['first-paint', 'first-contentful-paint'],
  729 |           applicationAndChartReadiness: true,
  730 |           requestCountAndBytes: true,
  731 |           longTasksOver50Ms: true,
  732 |         },
  733 |         deliberatelyNotMeasured: {
  734 |           inp: 'No representative interaction is performed; the repository requires RUM and a separately defined lab interaction proxy.',
  735 |           inputFeedback: 'No interaction trace in this navigation-focused baseline.',
  736 |           crosshairResponse: 'Requires a dedicated interaction benchmark.',
  737 |           quoteToPaintOverhead: 'Requires a timestamped streaming fixture and paint trace.',
  738 |           indicator10k: 'Requires a worker benchmark, not a navigation run.',
  739 |           memoryLeak: 'The budget states that its observation window and tolerance still require an ADR.',
  740 |           jsBundleBudget: 'The budget states that a numeric JS bundle limit still requires an ADR.',
  741 |         },
  742 |         environment,
  743 |         network: {
  744 |           summary: networkSummary,
  745 |           apiRequests: state.apiRequests,
  746 |           mocked: state.mocked,
  747 |           mockedWebSockets: state.mockedWebSockets,
  748 |           unstubbed: state.unstubbed,
  749 |           unexpectedExternal: state.unexpectedExternal,
  750 |           requestFailures: state.requestFailures,
  751 |           badResponses: state.badResponses,
  752 |           sizeErrors: state.sizeErrors,
  753 |         },
  754 |         pageErrors: state.pageErrors,
  755 |       };
  756 |       await fs.writeFile(path.join(outDir, 'metrics.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  757 |       await fs.writeFile(path.join(outDir, 'request-inventory.json'), `${JSON.stringify(requestInventory, null, 2)}\n`, 'utf8');
  758 |     }
  759 |   });
  760 | }
  761 | 
```