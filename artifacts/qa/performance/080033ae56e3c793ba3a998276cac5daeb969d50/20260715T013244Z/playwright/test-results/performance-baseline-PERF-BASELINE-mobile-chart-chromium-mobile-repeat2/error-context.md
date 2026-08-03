# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance-baseline.spec.mjs >> PERF-BASELINE: mobile-chart
- Location: tests/performance-baseline.spec.mjs:652:3

# Error details

```
Error: numeric performance gates

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 12

- Array []
+ Array [
+   Object {
+     "actual": 4188,
+     "evidence": "lab regression",
+     "metric": "labLcpMs",
+     "operator": "<=",
+     "pass": false,
+     "result": "FAIL",
+     "threshold": 2500,
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
  689 |       await expect(page.locator('.pc-approot')).toBeVisible();
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
> 741 |       expect(gates.filter((gate) => !gate.pass), 'numeric performance gates').toEqual([]);
      |                                                                               ^ Error: numeric performance gates
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
  790 |         },
  791 |         deliberatelyNotMeasured: {
  792 |           inp: 'No representative interaction is performed; the repository requires RUM and a separately defined lab interaction proxy.',
  793 |           inputFeedback: 'No interaction trace in this navigation-focused baseline.',
  794 |           crosshairResponse: 'Requires a dedicated interaction benchmark.',
  795 |           quoteToPaintOverhead: 'Requires a timestamped streaming fixture and paint trace.',
  796 |           indicator10k: 'Requires a worker benchmark, not a navigation run.',
  797 |           memoryLeak: 'The budget states that its observation window and tolerance still require an ADR.',
  798 |           jsBundleBudget: 'The budget states that a numeric JS bundle limit still requires an ADR.',
  799 |         },
  800 |         environment,
  801 |         network: {
  802 |           summary: networkSummary,
  803 |           apiRequests: state.apiRequests,
  804 |           mocked: state.mocked,
  805 |           mockedWebSockets: state.mockedWebSockets,
  806 |           unstubbed: state.unstubbed,
  807 |           unexpectedExternal: state.unexpectedExternal,
  808 |           requestFailures: state.requestFailures,
  809 |           badResponses: state.badResponses,
  810 |           sizeErrors: state.sizeErrors,
  811 |         },
  812 |         pageErrors: state.pageErrors,
  813 |       };
  814 |       await fs.writeFile(path.join(outDir, 'metrics.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  815 |       await fs.writeFile(path.join(outDir, 'request-inventory.json'), `${JSON.stringify(requestInventory, null, 2)}\n`, 'utf8');
  816 |     }
  817 |   });
  818 | }
  819 | 
```