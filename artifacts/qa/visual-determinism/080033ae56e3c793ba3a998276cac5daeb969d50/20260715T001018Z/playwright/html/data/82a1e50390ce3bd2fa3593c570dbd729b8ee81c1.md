# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-reference.spec.mjs >> VISUAL-REF: mobile-onboarding
- Location: tests/visual-reference.spec.mjs:284:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'چارت حرفه‌ای' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: 'چارت حرفه‌ای' })

```

```yaml
- region "چارتِ حرفه‌ای":
  - dialog "چارتِ حرفه‌ای":
    - img "Pro-Chart"
    - button "رد شدن"
    - img
    - heading "چارتِ حرفه‌ای" [level=2]
    - paragraph: چارتِ حرفه‌ای با ۸۰+ اندیکاتور، ۱۳ نوعِ چارت و مجموعهٔ کاملِ ابزارِ ترسیم.
    - button "بعدی"
```

# Test source

```ts
  227 |     if (key === 'GET /api/academy/bn/news') {
  228 |       await reply({ items: fixture.news });
  229 |       return;
  230 |     }
  231 |     if (key === 'GET /api/academy/bn/scripts') {
  232 |       await reply({ scripts: [], starter: '' });
  233 |       return;
  234 |     }
  235 |     if (key === 'GET /api/academy/bn/layouts') {
  236 |       await reply([]);
  237 |       return;
  238 |     }
  239 |     if (key === 'GET /api/academy/bn/alerts') {
  240 |       await reply([]);
  241 |       return;
  242 |     }
  243 |     if (key === 'GET /api/academy/bn/ai-signal/active') {
  244 |       await reply([]);
  245 |       return;
  246 |     }
  247 |     if (key === 'GET /api/academy/bn/ai-signal/quota') {
  248 |       await reply({ used: 0, remaining: 10, limit: 10 });
  249 |       return;
  250 |     }
  251 | 
  252 |     state.unstubbed.push({ key, queryKeys: [...url.searchParams.keys()].sort() });
  253 |     await route.abort('blockedbyclient');
  254 |   });
  255 | 
  256 |   await page.routeWebSocket('**/ws/**', async (ws) => {
  257 |     state.mockedWebSockets.push('local-ws');
  258 |     await ws.close({ code: 1000, reason: 'visual fixture only' });
  259 |   });
  260 | }
  261 | 
  262 | async function waitForFinalFonts(page) {
  263 |   return page.evaluate(async () => {
  264 |     const sample = 'بازار EURUSD 1.14212 چارت حرفه‌ای';
  265 |     const faces = [
  266 |       '400 12px "IRANYekanX"',
  267 |       '600 12px "IRANYekanX"',
  268 |       '700 12px "IRANYekanX"',
  269 |       '800 12px "IRANYekanX"',
  270 |       '400 12px "Ravagh"',
  271 |       '600 12px "Ravagh"',
  272 |       '800 12px "Ravagh"',
  273 |       '400 12px "AnjomanMax"',
  274 |       '600 12px "AnjomanMax"',
  275 |       '400 12px "Vazirmatn"',
  276 |     ];
  277 |     await Promise.all(faces.map((face) => document.fonts.load(face, sample)));
  278 |     await document.fonts.ready;
  279 |     return { status: document.fonts.status, faces };
  280 |   });
  281 | }
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
> 327 |         await expect(page.getByRole('heading', { name: 'چارت حرفه‌ای' })).toBeVisible();
      |                                                                           ^ Error: expect(locator).toBeVisible() failed
  328 |         await expect(page.getByRole('button', { name: 'بعدی' })).toBeVisible();
  329 |       } else {
  330 |         await expect(page.locator('canvas').first()).toBeVisible();
  331 |         await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
  332 |         await expect(page.getByText(fixture.symbols.EURUSD.mid.toFixed(5), { exact: true }).first()).toBeVisible();
  333 |       }
  334 | 
  335 |       await expect.poll(() => state.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);
  336 |       await expect.poll(() => state.seen.has('GET /api/academy/chart/EURUSD')).toBe(true);
  337 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/watchlist')).toBe(true);
  338 |       await expect.poll(() => state.seen.has('GET /api/academy/bn/prices')).toBe(true);
  339 | 
  340 |       fontState = await waitForFinalFonts(page);
  341 |       await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  342 |       await page.waitForTimeout(250);
  343 | 
  344 |       viewport = await page.evaluate(() => ({
  345 |         width: innerWidth,
  346 |         height: innerHeight,
  347 |         dpr: devicePixelRatio,
  348 |         lang: document.documentElement.lang,
  349 |         dir: document.documentElement.dir,
  350 |       }));
  351 | 
  352 |       const screenshotOptions = { fullPage: true, animations: 'disabled', caret: 'hide' };
  353 |       candidate = await page.screenshot(screenshotOptions);
  354 |       candidateSha256 = sha256(candidate);
  355 |       await page.waitForTimeout(250);
  356 |       const stabilityProbe = await page.screenshot(screenshotOptions);
  357 |       stabilityProbeSha256 = sha256(stabilityProbe);
  358 | 
  359 |       expect(response?.status(), 'document HTTP status').toBe(200);
  360 |       expect(new URL(page.url()).origin, 'fixture must remain on local mapped origin').toBe(new URL(testInfo.project.use.baseURL).origin);
  361 |       expect(viewport.lang).toBe('fa');
  362 |       expect(viewport.dir).toBe('rtl');
  363 |       expect(stabilityProbeSha256, 'two consecutive captures must be byte-identical').toBe(candidateSha256);
  364 |       expect(state.unstubbed, 'all API calls must have an explicit synthetic response').toEqual([]);
  365 |       expect(state.unexpectedExternal, 'visual fixture must not contact external origins').toEqual([]);
  366 |       expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  367 |       expect(state.requestFailures, 'failed requests').toEqual([]);
  368 |       expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
  369 | 
  370 |       if (captureOnly) {
  371 |         testInfo.annotations.push({
  372 |           type: 'visual-approval',
  373 |           description: 'PENDING_MANUAL_APPROVAL: capture-only evidence is not a golden snapshot.',
  374 |         });
  375 |         result = 'CAPTURE_ONLY_PASS_PENDING_MANUAL_APPROVAL';
  376 |       } else {
  377 |         try {
  378 |           await fs.access(approvedPath);
  379 |         } catch {
  380 |           throw new Error(`Approved visual snapshot is missing: ${approvedPath}. Run explicit capture-only mode, review the candidate, and approve manually before enabling this gate.`);
  381 |         }
  382 |         await expect(page).toHaveScreenshot(snapshotName, {
  383 |           fullPage: true,
  384 |           animations: 'disabled',
  385 |           caret: 'hide',
  386 |           maxDiffPixels: 0,
  387 |         });
  388 |         result = 'APPROVED_GOLDEN_MATCH';
  389 |       }
  390 |     } catch (error) {
  391 |       failure = safeError(error);
  392 |       throw error;
  393 |     } finally {
  394 |       await fs.mkdir(outDir, { recursive: true });
  395 |       if (candidate) await fs.writeFile(path.join(outDir, 'actual.png'), candidate);
  396 |       const metadata = {
  397 |         schemaVersion: 1,
  398 |         requirementIds: ['PC-002', 'PC-009', 'PC-146', 'PC-153'],
  399 |         scenario: scenario.id,
  400 |         project: testInfo.project.name,
  401 |         commit,
  402 |         sourceFingerprint,
  403 |         runId,
  404 |         fixture: {
  405 |           id: fixture.fixtureId,
  406 |           sha256: fixtureSha256,
  407 |           fixedAt: fixture.fixedAt,
  408 |           provenance: fixture.provenance,
  409 |         },
  410 |         mode: captureOnly ? 'capture-only' : 'approved-golden-gate',
  411 |         approval: captureOnly ? 'PENDING_MANUAL_APPROVAL' : 'APPROVED_GOLDEN_REQUIRED',
  412 |         approvedPath,
  413 |         result,
  414 |         failure,
  415 |         viewport,
  416 |         fonts: fontState,
  417 |         screenshots: {
  418 |           candidateSha256,
  419 |           stabilityProbeSha256,
  420 |           byteIdentical: Boolean(candidateSha256 && candidateSha256 === stabilityProbeSha256),
  421 |         },
  422 |         network: {
  423 |           apiRequests: state.apiRequests,
  424 |           mocked: state.mocked,
  425 |           mockedWebSockets: state.mockedWebSockets,
  426 |           unstubbed: state.unstubbed,
  427 |           unexpectedExternal: state.unexpectedExternal,
```