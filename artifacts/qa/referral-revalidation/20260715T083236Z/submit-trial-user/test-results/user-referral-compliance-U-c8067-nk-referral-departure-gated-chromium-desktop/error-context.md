# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-referral-compliance.spec.mjs >> USER-REFERRAL: real /connect keeps LBank referral departure gated
- Location: tests/user-referral-compliance.spec.mjs:338:3

# Error details

```
Error: browserContext.unroute: Target page, context or browser has been closed
```

# Test source

```ts
  185 |     tagName: element.tagName,
  186 |     type: element.type,
  187 |   }))).toEqual({ disabled: true, tagName: 'BUTTON', type: 'submit' });
  188 | 
  189 |   const disclosureId = await paragraphs.nth(0).getAttribute('id');
  190 |   const eligibilityId = await paragraphs.nth(1).getAttribute('id');
  191 |   const expectedDescription = `لینک معرفی: ${DISCLOSURE} ${ELIGIBILITY}`;
  192 |   expect(disclosureId).toMatch(/^referral-disclosure-/);
  193 |   expect(eligibilityId).toMatch(/^referral-eligibility-/);
  194 |   expect(await checkbox.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  195 |   expect(await submit.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  196 |   await expect(checkbox).toHaveAccessibleName('شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.');
  197 |   await expect(checkbox).toHaveAccessibleDescription(expectedDescription);
  198 |   await expect(submit).toHaveAccessibleDescription(expectedDescription);
  199 | 
  200 |   const axeResult = await new AxeBuilder({ page })
  201 |     .include(`section[aria-label="لینک معرفی ${provider.name}"]`)
  202 |     .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
  203 |     .analyze();
  204 |   expect(axeResult.violations.map(({ id, impact, nodes }) => ({
  205 |     id,
  206 |     impact,
  207 |     nodeCount: nodes.length,
  208 |   }))).toEqual([]);
  209 | 
  210 |   const formContract = await form.evaluate((element) => ({
  211 |     method: element.getAttribute('method'),
  212 |     rawAction: element.getAttribute('action'),
  213 |     rel: (element.getAttribute('rel') || '').split(/\s+/).filter(Boolean).sort(),
  214 |     resolvedAction: element.action,
  215 |     target: element.getAttribute('target'),
  216 |   }));
  217 |   expect(formContract.rawAction).toBe(provider.approvedPath);
  218 |   expect(new URL(formContract.resolvedAction).origin).toBe(expectedOrigin);
  219 |   expect(new URL(formContract.resolvedAction).pathname).toBe(provider.approvedPath);
  220 |   expect(formContract.method?.toLowerCase()).toBe('get');
  221 |   expect(formContract.target).toBe('_blank');
  222 |   expect(formContract.rel).toEqual(['noopener', 'noreferrer', 'sponsored']);
  223 | 
  224 |   const disclosureOrder = await region.evaluate((element) => {
  225 |     const [disclosure, eligibility] = element.querySelectorAll('p');
  226 |     const outboundForm = element.querySelector('form');
  227 |     return {
  228 |       disclosureBeforeEligibility: Boolean(
  229 |         disclosure?.compareDocumentPosition(eligibility) & Node.DOCUMENT_POSITION_FOLLOWING
  230 |       ),
  231 |       disclosureBeforeForm: Boolean(
  232 |         disclosure?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING
  233 |       ),
  234 |       eligibilityBeforeForm: Boolean(
  235 |         eligibility?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING
  236 |       ),
  237 |     };
  238 |   });
  239 |   expect(disclosureOrder).toEqual({
  240 |     disclosureBeforeEligibility: true,
  241 |     disclosureBeforeForm: true,
  242 |     eligibilityBeforeForm: true,
  243 |   });
  244 | 
  245 |   await checkbox.focus();
  246 |   await expect(checkbox).toBeFocused();
  247 |   await checkbox.press('Space');
  248 |   await expect(checkbox).toBeChecked();
  249 |   await expect(submit).toBeEnabled();
  250 |   expect(await submit.evaluate((element) => element.disabled)).toBe(false);
  251 | 
  252 |   const departureRequests = [];
  253 |   const context = page.context();
  254 |   const departurePattern = `**${provider.approvedPath}`;
  255 |   const departureHandler = async (route) => {
  256 |     const requestUrl = new URL(route.request().url());
  257 |     departureRequests.push({
  258 |       method: route.request().method(),
  259 |       origin: requestUrl.origin,
  260 |       pathname: requestUrl.pathname,
  261 |     });
  262 |     await route.fulfill({
  263 |       status: 200,
  264 |       contentType: 'text/html; charset=utf-8',
  265 |       body: '<!doctype html><html lang="fa" dir="rtl"><title>referral intercepted</title></html>',
  266 |     });
  267 |   };
  268 |   await context.route(departurePattern, departureHandler);
  269 |   let popup;
  270 |   try {
  271 |     [popup] = await Promise.all([
  272 |       context.waitForEvent('page'),
  273 |       submit.click(),
  274 |     ]);
  275 |     await popup.waitForLoadState('domcontentloaded');
  276 |     await expect.poll(() => departureRequests).toEqual([{
  277 |       method: 'GET',
  278 |       origin: expectedOrigin,
  279 |       pathname: provider.approvedPath,
  280 |     }]);
  281 |     expect(new URL(popup.url()).origin).toBe(expectedOrigin);
  282 |     expect(new URL(popup.url()).pathname).toBe(provider.approvedPath);
  283 |   } finally {
  284 |     await popup?.close();
> 285 |     await context.unroute(departurePattern, departureHandler);
      |                   ^ Error: browserContext.unroute: Target page, context or browser has been closed
  286 |   }
  287 | 
  288 |   const renderedTargets = await surface.locator('a[href], form[action]').evaluateAll((elements) => elements.map((element) => ({
  289 |     raw: element.getAttribute(element.tagName === 'FORM' ? 'action' : 'href'),
  290 |     resolved: element.tagName === 'FORM' ? element.action : element.href,
  291 |     tagName: element.tagName,
  292 |   })));
  293 |   const directProviderTargets = renderedTargets.filter(({ resolved }) => {
  294 |     try {
  295 |       return provider.directHostPattern.test(new URL(resolved).hostname);
  296 |     } catch {
  297 |       return false;
  298 |     }
  299 |   });
  300 |   expect(directProviderTargets, `no direct ${provider.name} target may bypass /go`).toEqual([]);
  301 |   expect(await surface.innerHTML()).not.toContain(provider.untrustedReferralUrl);
  302 |   expect(await page.evaluate(() => window.__userReferralQaWindowOpenCalls || [])).toEqual([]);
  303 |   await expect(page).toHaveURL((url) => url.origin === expectedOrigin && url.pathname === '/connect');
  304 | 
  305 |   return {
  306 |     accessibility: {
  307 |       axeViolationCount: axeResult.violations.length,
  308 |       describedBy: `${disclosureId} ${eligibilityId}`,
  309 |       expectedDescription,
  310 |       departureRequests,
  311 |     },
  312 |     disclosureOrder,
  313 |     formContract,
  314 |     renderedTargets,
  315 |   };
  316 | }
  317 | 
  318 | async function assertBrokerIsReferralOnly(surface) {
  319 |   await expect(surface.getByText('OneRoyal — فقط معرفی', { exact: true })).toBeVisible();
  320 |   await expect(surface.locator('input:not([type="checkbox"]), textarea, select')).toHaveCount(0);
  321 |   await expect(surface.locator('form')).toHaveCount(1);
  322 |   await expect(surface.getByRole('button', {
  323 |     name: /اتصال.*(?:MT5|حساب|صرافی)|ثبت.*سفارش|خرید|فروش/,
  324 |   })).toHaveCount(0);
  325 |   await expect(surface.locator('form[action*="connect"], form[action*="order"]')).toHaveCount(0);
  326 | }
  327 | 
  328 | async function assertCryptoKeepsLBankCredentials(surface) {
  329 |   await expect(surface.getByText('صرافیِ LBank', { exact: true })).toBeVisible();
  330 |   await expect(surface.locator('input[placeholder="API Key"][type="password"]')).toHaveCount(1);
  331 |   await expect(surface.locator('input[placeholder="API Secret"][type="password"]')).toHaveCount(1);
  332 |   await expect(surface.locator('input[placeholder="UID"]')).toHaveCount(1);
  333 |   await expect(surface.getByRole('button', { name: /اتصال.*صرافی/ })).toHaveCount(1);
  334 |   await expect(surface.locator('input[placeholder*="MT5"], input[placeholder*="Login"]')).toHaveCount(0);
  335 | }
  336 | 
  337 | for (const provider of providers) {
  338 |   test(`USER-REFERRAL: real /connect keeps ${provider.name} referral departure gated`, async ({ page }, testInfo) => {
  339 |     test.skip(new URL(testInfo.project.use.baseURL).hostname !== 'user.pro-chart.com', 'User Portal vhost contract runs only against user.pro-chart.com');
  340 |     const target = connectUrl(testInfo.project.use.baseURL);
  341 |     const state = await installUserPortalFixture(page, target.origin, provider);
  342 |     const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  343 | 
  344 |     expect(response?.status(), 'User Portal BrowserRouter document status').toBe(200);
  345 |     await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === '/connect');
  346 | 
  347 |     const surface = page.locator('main');
  348 |     await expect(surface).toBeVisible();
  349 |     const gate = await assertReferralGate(page, surface, target.origin, provider);
  350 | 
  351 |     const storageContract = await page.evaluate(() => ({
  352 |       legacyAuthAbsent: localStorage.getItem('bn_auth') === null,
  353 |       portalTokenPresent: Boolean(localStorage.getItem('cp_academy_token')),
  354 |     }));
  355 |     expect(storageContract).toEqual({ legacyAuthAbsent: true, portalTokenPresent: true });
  356 | 
  357 |     if (provider.accountType === 'broker') {
  358 |       await assertBrokerIsReferralOnly(surface);
  359 |     } else {
  360 |       await assertCryptoKeepsLBankCredentials(surface);
  361 |     }
  362 | 
  363 |     const uniqueApiRequests = [...new Set(state.apiRequests.map(({ key }) => key))].sort();
  364 |     expect(uniqueApiRequests).toEqual([
  365 |       'GET /api/academy/bn/connect/status',
  366 |       'GET /api/academy/bn/overview',
  367 |       'GET /api/academy/bn/referral-link',
  368 |     ]);
  369 |     expect(state.apiRequests.every(({ bearerTokenPresent }) => bearerTokenPresent)).toBe(true);
  370 | 
  371 |     await testInfo.attach('user-referral-compliance.json', {
  372 |       body: Buffer.from(`${JSON.stringify({
  373 |         schemaVersion: 1,
  374 |         scope: 'frontend-user-browser-router-connect',
  375 |         project: testInfo.project.name,
  376 |         provider: provider.name,
  377 |         accountType: provider.accountType,
  378 |         approvedPath: provider.approvedPath,
  379 |         storageContract,
  380 |         uniqueApiRequests,
  381 |         gate,
  382 |         network: {
  383 |           badResponses: state.badResponses,
  384 |           pageErrors: state.pageErrors,
  385 |           popups: state.popups,
```