# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-reference.spec.mjs >> VISUAL-REF: mobile-onboarding
- Location: tests/visual-reference.spec.mjs:284:3

# Error details

```
Error: Approved visual snapshot is missing: /home/bazaarnama/Pro-Chart/app/qa/tests/visual-reference.spec.mjs-snapshots/approved/mobile-onboarding-chromium-mobile-linux.png. Run explicit capture-only mode, review the candidate, and approve manually before enabling this gate.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - main [ref=e4]:
      - heading [level=1] [ref=e5]: Pro-Chart — چارت حرفه‌ای بازارهای مالی
      - generic [ref=e6]:
        - generic [ref=e7]:
          - button [ref=e8] [cursor=pointer]:
            - generic [ref=e9]:
              - img [ref=e12]
              - img [ref=e25]
            - generic [ref=e29]: EURUSD
          - generic [ref=e33]: "1.14212"
          - button [ref=e34] [cursor=pointer]:
            - text: 1H
            - img [ref=e35]
          - button [ref=e37] [cursor=pointer]:
            - img [ref=e38]
          - button [ref=e41] [cursor=pointer]:
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
            - button [ref=e89] [cursor=pointer]:
              - img [ref=e90]
          - generic [ref=e93]:
            - table [ref=e96]:
              - row [ref=e97]:
                - cell [ref=e98]
                - cell [ref=e102]
              - row [ref=e106]:
                - cell [ref=e107]
                - cell [ref=e111]
            - generic:
              - generic [ref=e114]:
                - button [ref=e115] [cursor=pointer]:
                  - generic [ref=e116]: "1.14210"
                  - generic [ref=e117]: SELL
                - generic [ref=e118]:
                  - generic [ref=e119]: "4"
                  - generic [ref=e120]: اسپرد
                - button [ref=e121] [cursor=pointer]:
                  - generic [ref=e122]: "1.14214"
                  - generic [ref=e123]: BUY
              - generic [ref=e124]:
                - generic [ref=e125]: "+0.00011"
                - generic [ref=e126]: (+0.01%)
            - generic:
              - img
              - generic: 25:04
            - generic [ref=e127]:
              - button [ref=e128] [cursor=pointer]: ٪
              - button [ref=e129] [cursor=pointer]: log
              - button [ref=e130] [cursor=pointer]: auto
            - generic:
              - img
              - generic: حجم · Vol
            - img
          - generic [ref=e131]:
            - button [ref=e132] [cursor=pointer]: 1D
            - button [ref=e133] [cursor=pointer]: 5D
            - button [ref=e134] [cursor=pointer]: 1M
            - button [ref=e135] [cursor=pointer]: 3M
            - button [ref=e136] [cursor=pointer]: 6M
            - button [ref=e137] [cursor=pointer]: YTD
            - button [ref=e138] [cursor=pointer]: 1Y
            - button [ref=e139] [cursor=pointer]: 5Y
            - button [ref=e140] [cursor=pointer]: All
            - button [ref=e142] [cursor=pointer]:
              - img [ref=e143]
            - button [ref=e147] [cursor=pointer]:
              - img [ref=e148]
              - generic [ref=e151]: 16:04:56
              - generic [ref=e152]: (تهران)
    - navigation [ref=e153]:
      - button [ref=e154] [cursor=pointer]:
        - img [ref=e156]
        - generic [ref=e160]: چارت
      - button [ref=e161] [cursor=pointer]:
        - img [ref=e163]
        - generic [ref=e164]: واچ‌لیست
      - button [ref=e165] [cursor=pointer]:
        - img [ref=e167]
      - button [ref=e169] [cursor=pointer]:
        - img [ref=e171]
        - generic [ref=e174]: بازارها
      - button [ref=e175] [cursor=pointer]:
        - img [ref=e177]
        - generic [ref=e180]: پروفایل
  - region "چارتِ حرفه‌ای" [ref=e181]:
    - dialog "چارتِ حرفه‌ای" [ref=e182]:
      - generic [ref=e183]:
        - img "Pro-Chart" [ref=e184]
        - button "رد شدن" [ref=e185] [cursor=pointer]
      - generic [ref=e187]:
        - img [ref=e189]
        - heading "چارتِ حرفه‌ای" [active] [level=2] [ref=e193]
        - paragraph [ref=e194]: چارتِ حرفه‌ای با ۸۰+ اندیکاتور، ۱۳ نوعِ چارت و مجموعهٔ کاملِ ابزارِ ترسیم.
      - button "بعدی" [ref=e200] [cursor=pointer]
```

# Test source

```ts
  282 | 
  283 | for (const scenario of scenarios) {
  284 |   test(`VISUAL-REF: ${scenario.id}`, async ({ page }, testInfo) => {
  285 |     test.skip(testInfo.project.name !== scenario.project, `scenario belongs to ${scenario.project}`);
  286 | 
  287 |     const state = {
  288 |       apiRequests: [],
  289 |       mocked: [],
  290 |       mockedWebSockets: [],
  291 |       seen: new Set(),
  292 |       unexpectedExternal: [],
  293 |       unstubbed: [],
  294 |       pageErrors: [],
  295 |       requestFailures: [],
  296 |       badResponses: [],
  297 |     };
  298 |     const outDir = path.join(repoRoot, 'artifacts', 'qa', 'visual-determinism', commit, runId, scenario.id);
  299 |     const snapshotName = ['approved', `${scenario.id}.png`];
  300 |     const approvedPath = testInfo.snapshotPath(...snapshotName, { kind: 'screenshot' });
  301 |     let candidate = null;
  302 |     let candidateSha256 = null;
  303 |     let stabilityProbeSha256 = null;
  304 |     let fontState = null;
  305 |     let viewport = null;
  306 |     let result = 'FAIL';
  307 |     let failure = null;
  308 | 
  309 |     page.on('pageerror', (error) => state.pageErrors.push(safeError(error)));
  310 |     page.on('requestfailed', (request) => state.requestFailures.push({
  311 |       ...requestSummary(request),
  312 |       error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
  313 |     }));
  314 |     page.on('response', (response) => {
  315 |       if (response.status() >= 400) state.badResponses.push({
  316 |         status: response.status(),
  317 |         pathname: new URL(response.url()).pathname,
  318 |       });
  319 |     });
  320 | 
  321 |     try {
  322 |       await installFixture(page, testInfo, scenario, state);
  323 |       const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  324 | 
  325 |       await expect(page.locator('.pc-launch')).toHaveCount(0);
  326 |       if (scenario.onboarding) {
  327 |         const onboardingTitle = page.locator('#pc-onboarding-title');
  328 |         await expect(onboardingTitle).toBeVisible();
  329 |         await expect(page.getByRole('heading').and(onboardingTitle)).toHaveCount(1);
  330 |         await expect(page.getByRole('button', { name: 'بعدی' })).toBeVisible();
  331 |       } else {
  332 |         await expect(page.locator('canvas').first()).toBeVisible();
  333 |         await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
  334 |         await expect(page.getByText(fixture.symbols.EURUSD.mid.toFixed(5), { exact: true }).first()).toBeVisible();
  335 |       }
  336 | 
  337 |       await expect.poll(() => state.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);
  338 |       await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
  339 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/watchlist')).toBe(true);
  340 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);
  341 | 
  342 |       fontState = await waitForFinalFonts(page);
  343 |       await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  344 |       await page.waitForTimeout(250);
  345 | 
  346 |       viewport = await page.evaluate(() => ({
  347 |         width: innerWidth,
  348 |         height: innerHeight,
  349 |         dpr: devicePixelRatio,
  350 |         lang: document.documentElement.lang,
  351 |         dir: document.documentElement.dir,
  352 |       }));
  353 | 
  354 |       const screenshotOptions = { fullPage: true, animations: 'disabled', caret: 'hide' };
  355 |       candidate = await page.screenshot(screenshotOptions);
  356 |       candidateSha256 = sha256(candidate);
  357 |       await page.waitForTimeout(250);
  358 |       const stabilityProbe = await page.screenshot(screenshotOptions);
  359 |       stabilityProbeSha256 = sha256(stabilityProbe);
  360 | 
  361 |       expect(response?.status(), 'document HTTP status').toBe(200);
  362 |       expect(new URL(page.url()).origin, 'fixture must remain on local mapped origin').toBe(new URL(testInfo.project.use.baseURL).origin);
  363 |       expect(viewport.lang).toBe('fa');
  364 |       expect(viewport.dir).toBe('rtl');
  365 |       expect(stabilityProbeSha256, 'two consecutive captures must be byte-identical').toBe(candidateSha256);
  366 |       expect(state.unstubbed, 'all API calls must have an explicit synthetic response').toEqual([]);
  367 |       expect(state.unexpectedExternal, 'visual fixture must not contact external origins').toEqual([]);
  368 |       expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  369 |       expect(state.requestFailures, 'failed requests').toEqual([]);
  370 |       expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
  371 | 
  372 |       if (captureOnly) {
  373 |         testInfo.annotations.push({
  374 |           type: 'visual-approval',
  375 |           description: 'PENDING_MANUAL_APPROVAL: capture-only evidence is not a golden snapshot.',
  376 |         });
  377 |         result = 'CAPTURE_ONLY_PASS_PENDING_MANUAL_APPROVAL';
  378 |       } else {
  379 |         try {
  380 |           await fs.access(approvedPath);
  381 |         } catch {
> 382 |           throw new Error(`Approved visual snapshot is missing: ${approvedPath}. Run explicit capture-only mode, review the candidate, and approve manually before enabling this gate.`);
      |                 ^ Error: Approved visual snapshot is missing: /home/bazaarnama/Pro-Chart/app/qa/tests/visual-reference.spec.mjs-snapshots/approved/mobile-onboarding-chromium-mobile-linux.png. Run explicit capture-only mode, review the candidate, and approve manually before enabling this gate.
  383 |         }
  384 |         await expect(page).toHaveScreenshot(snapshotName, {
  385 |           fullPage: true,
  386 |           animations: 'disabled',
  387 |           caret: 'hide',
  388 |           maxDiffPixels: 0,
  389 |         });
  390 |         result = 'APPROVED_GOLDEN_MATCH';
  391 |       }
  392 |     } catch (error) {
  393 |       failure = safeError(error);
  394 |       throw error;
  395 |     } finally {
  396 |       await fs.mkdir(outDir, { recursive: true });
  397 |       if (candidate) await fs.writeFile(path.join(outDir, 'actual.png'), candidate);
  398 |       const metadata = {
  399 |         schemaVersion: 1,
  400 |         requirementIds: ['PC-002', 'PC-009', 'PC-146', 'PC-153'],
  401 |         scenario: scenario.id,
  402 |         project: testInfo.project.name,
  403 |         commit,
  404 |         sourceFingerprint,
  405 |         runId,
  406 |         fixture: {
  407 |           id: fixture.fixtureId,
  408 |           sha256: fixtureSha256,
  409 |           fixedAt: fixture.fixedAt,
  410 |           provenance: fixture.provenance,
  411 |         },
  412 |         mode: captureOnly ? 'capture-only' : 'approved-golden-gate',
  413 |         approval: captureOnly ? 'PENDING_MANUAL_APPROVAL' : 'APPROVED_GOLDEN_REQUIRED',
  414 |         approvedPath,
  415 |         result,
  416 |         failure,
  417 |         viewport,
  418 |         fonts: fontState,
  419 |         screenshots: {
  420 |           candidateSha256,
  421 |           stabilityProbeSha256,
  422 |           byteIdentical: Boolean(candidateSha256 && candidateSha256 === stabilityProbeSha256),
  423 |         },
  424 |         network: {
  425 |           apiRequests: state.apiRequests,
  426 |           mocked: state.mocked,
  427 |           mockedWebSockets: state.mockedWebSockets,
  428 |           unstubbed: state.unstubbed,
  429 |           unexpectedExternal: state.unexpectedExternal,
  430 |           requestFailures: state.requestFailures,
  431 |           badResponses: state.badResponses,
  432 |         },
  433 |         pageErrors: state.pageErrors,
  434 |       };
  435 |       await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  436 |     }
  437 |   });
  438 | }
  439 | 
```