# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-referral-compliance.spec.mjs >> USER-REFERRAL: real /connect keeps LBank referral departure gated
- Location: tests/user-referral-compliance.spec.mjs:354:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://user.pro-chart.com:18081/connect
Call log:
  - navigating to "http://user.pro-chart.com:18081/connect", waiting until "domcontentloaded"

```

# Test source

```ts
  258 |     impact,
  259 |     nodeCount: nodes.length,
  260 |   }))).toEqual([]);
  261 | 
  262 |   const departureRequests = [];
  263 |   const context = page.context();
  264 |   const departurePattern = `**${provider.approvedPath}*`;
  265 |   const departureHandler = async (route) => {
  266 |     const requestUrl = new URL(route.request().url());
  267 |     departureRequests.push({
  268 |       method: route.request().method(),
  269 |       origin: requestUrl.origin,
  270 |       pathname: requestUrl.pathname,
  271 |     });
  272 |     await route.fulfill({
  273 |       status: 200,
  274 |       contentType: 'text/html; charset=utf-8',
  275 |       body: '<!doctype html><html lang="fa" dir="rtl"><title>referral intercepted</title></html>',
  276 |     });
  277 |   };
  278 |   await context.route(departurePattern, departureHandler);
  279 |   const pagesBeforeDeparture = new Set(context.pages());
  280 |   try {
  281 |     const [departureRequest] = await Promise.all([
  282 |       context.waitForEvent('request', {
  283 |         predicate: (request) => new URL(request.url()).pathname === provider.approvedPath,
  284 |       }),
  285 |       submit.click({ noWaitAfter: true }),
  286 |     ]);
  287 |     await expect.poll(() => departureRequests).toEqual([{
  288 |       method: 'GET',
  289 |       origin: expectedOrigin,
  290 |       pathname: provider.approvedPath,
  291 |     }]);
  292 |     expect(departureRequest.method()).toBe('GET');
  293 |     expect(new URL(departureRequest.url()).origin).toBe(expectedOrigin);
  294 |     expect(new URL(departureRequest.url()).pathname).toBe(provider.approvedPath);
  295 |     await expect.poll(() => context.pages().length).toBe(pagesBeforeDeparture.size + 1);
  296 |   } finally {
  297 |     await Promise.all(context.pages()
  298 |       .filter((candidatePage) => !pagesBeforeDeparture.has(candidatePage))
  299 |       .map((candidatePage) => candidatePage.close()));
  300 |     await context.unroute(departurePattern, departureHandler);
  301 |   }
  302 | 
  303 |   const renderedTargets = await surface.locator('a[href], form[action]').evaluateAll((elements) => elements.map((element) => ({
  304 |     raw: element.getAttribute(element.tagName === 'FORM' ? 'action' : 'href'),
  305 |     resolved: element.tagName === 'FORM' ? element.action : element.href,
  306 |     tagName: element.tagName,
  307 |   })));
  308 |   const directProviderTargets = renderedTargets.filter(({ resolved }) => {
  309 |     try {
  310 |       return provider.directHostPattern.test(new URL(resolved).hostname);
  311 |     } catch {
  312 |       return false;
  313 |     }
  314 |   });
  315 |   expect(directProviderTargets, `no direct ${provider.name} target may bypass /go`).toEqual([]);
  316 |   expect(await surface.innerHTML()).not.toContain(provider.untrustedReferralUrl);
  317 |   expect(await page.evaluate(() => window.__userReferralQaWindowOpenCalls || [])).toEqual([]);
  318 |   await expect(page).toHaveURL((url) => url.origin === expectedOrigin && url.pathname === '/connect');
  319 | 
  320 |   return {
  321 |     accessibility: {
  322 |       axeViolationCount: axeResult.violations.length,
  323 |       acknowledgedAxeViolationCount: acknowledgedAxeResult.violations.length,
  324 |       describedBy: `${disclosureId} ${eligibilityId}`,
  325 |       expectedDescription,
  326 |       departureRequests,
  327 |     },
  328 |     disclosureOrder,
  329 |     formContract,
  330 |     renderedTargets,
  331 |   };
  332 | }
  333 | 
  334 | async function assertBrokerIsReferralOnly(surface) {
  335 |   await expect(surface.getByText('OneRoyal — فقط معرفی', { exact: true })).toBeVisible();
  336 |   await expect(surface.locator('input:not([type="checkbox"]), textarea, select')).toHaveCount(0);
  337 |   await expect(surface.locator('form')).toHaveCount(1);
  338 |   await expect(surface.getByRole('button', {
  339 |     name: /اتصال.*(?:MT5|حساب|صرافی)|ثبت.*سفارش|خرید|فروش/,
  340 |   })).toHaveCount(0);
  341 |   await expect(surface.locator('form[action*="connect"], form[action*="order"]')).toHaveCount(0);
  342 | }
  343 | 
  344 | async function assertCryptoKeepsLBankCredentials(surface) {
  345 |   await expect(surface.getByText('صرافیِ LBank', { exact: true })).toBeVisible();
  346 |   await expect(surface.locator('input[placeholder="API Key"][type="password"]')).toHaveCount(1);
  347 |   await expect(surface.locator('input[placeholder="API Secret"][type="password"]')).toHaveCount(1);
  348 |   await expect(surface.locator('input[placeholder="UID"]')).toHaveCount(1);
  349 |   await expect(surface.getByRole('button', { name: /اتصال.*صرافی/ })).toHaveCount(1);
  350 |   await expect(surface.locator('input[placeholder*="MT5"], input[placeholder*="Login"]')).toHaveCount(0);
  351 | }
  352 | 
  353 | for (const provider of providers) {
  354 |   test(`USER-REFERRAL: real /connect keeps ${provider.name} referral departure gated`, async ({ page }, testInfo) => {
  355 |     test.skip(new URL(testInfo.project.use.baseURL).hostname !== 'user.pro-chart.com', 'User Portal vhost contract runs only against user.pro-chart.com');
  356 |     const target = connectUrl(testInfo.project.use.baseURL);
  357 |     const state = await installUserPortalFixture(page, target.origin, provider);
> 358 |     const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
      |                                 ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://user.pro-chart.com:18081/connect
  359 | 
  360 |     expect(response?.status(), 'User Portal BrowserRouter document status').toBe(200);
  361 |     await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === '/connect');
  362 | 
  363 |     const surface = page.locator('main');
  364 |     await expect(surface).toBeVisible();
  365 |     expect(state.popups, 'no popup exists before explicit keyboard acknowledgement and submit').toEqual([]);
  366 |     const gate = await assertReferralGate(page, surface, target.origin, provider);
  367 | 
  368 |     const storageContract = await page.evaluate(() => ({
  369 |       legacyAuthAbsent: localStorage.getItem('bn_auth') === null,
  370 |       portalTokenPresent: Boolean(localStorage.getItem('cp_academy_token')),
  371 |     }));
  372 |     expect(storageContract).toEqual({ legacyAuthAbsent: true, portalTokenPresent: true });
  373 | 
  374 |     if (provider.accountType === 'broker') {
  375 |       await assertBrokerIsReferralOnly(surface);
  376 |     } else {
  377 |       await assertCryptoKeepsLBankCredentials(surface);
  378 |     }
  379 | 
  380 |     const uniqueApiRequests = [...new Set(state.apiRequests.map(({ key }) => key))].sort();
  381 |     expect(uniqueApiRequests).toEqual([
  382 |       'GET /api/academy/bn/connect/status',
  383 |       'GET /api/academy/bn/overview',
  384 |       'GET /api/academy/bn/referral-link',
  385 |     ]);
  386 |     expect(state.apiRequests.every(({ bearerTokenPresent }) => bearerTokenPresent)).toBe(true);
  387 | 
  388 |     await testInfo.attach('user-referral-compliance.json', {
  389 |       body: Buffer.from(`${JSON.stringify({
  390 |         schemaVersion: 1,
  391 |         scope: 'frontend-user-browser-router-connect',
  392 |         project: testInfo.project.name,
  393 |         provider: provider.name,
  394 |         accountType: provider.accountType,
  395 |         approvedPath: provider.approvedPath,
  396 |         storageContract,
  397 |         uniqueApiRequests,
  398 |         gate,
  399 |         network: {
  400 |           badResponses: state.badResponses,
  401 |           pageErrors: state.pageErrors,
  402 |           popups: state.popups,
  403 |           requestFailures: state.requestFailures,
  404 |           unexpectedExternal: state.unexpectedExternal,
  405 |           unstubbed: state.unstubbed,
  406 |         },
  407 |       }, null, 2)}\n`),
  408 |       contentType: 'application/json',
  409 |     });
  410 | 
  411 |     expect(state.unstubbed, 'every API request must have an explicit synthetic response').toEqual([]);
  412 |     expect(state.unexpectedExternal, 'the page must not make an outbound request').toEqual([]);
  413 |     expect(state.badResponses, 'the page must not receive an HTTP error').toEqual([]);
  414 |     expect(state.pageErrors, 'the page must not raise an uncaught error').toEqual([]);
  415 |     expect(state.requestFailures, 'the page must not have a failed request').toEqual([]);
  416 |     expect(state.popups.map((url) => {
  417 |       const parsed = new URL(url);
  418 |       return { method: 'GET', origin: parsed.origin, pathname: parsed.pathname };
  419 |     }), 'the only popup follows the explicit submit and remains same-origin').toEqual([{
  420 |       method: 'GET',
  421 |       origin: target.origin,
  422 |       pathname: provider.approvedPath,
  423 |     }]);
  424 |   });
  425 | }
  426 | 
```