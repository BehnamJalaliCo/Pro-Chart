# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: referral-compliance.spec.mjs >> REFERRAL-COMPLIANCE: LBank gate is disclosed, acknowledged, and same-origin
- Location: tests/referral-compliance.spec.mjs:379:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: browserContext.unroute: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - img [ref=e7]
      - generic [ref=e9]: Pro·Chart پنلِ کاربری
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: referral-qa-user
        - generic [ref=e13]: رایگان
      - button "خروج" [ref=e14] [cursor=pointer]:
        - img [ref=e15]
        - generic [ref=e18]: خروج
  - generic [ref=e19]:
    - complementary [ref=e20]:
      - navigation [ref=e22]:
        - button "داشبوردِ امروز" [ref=e23] [cursor=pointer]:
          - img [ref=e24]
          - generic [ref=e29]: داشبوردِ امروز
        - button "حساب" [ref=e30] [cursor=pointer]:
          - img [ref=e31]
          - generic [ref=e34]: حساب
        - button "اشتراک" [ref=e35] [cursor=pointer]:
          - img [ref=e36]
          - generic [ref=e38]: اشتراک
        - button "اتصالِ حساب" [ref=e39] [cursor=pointer]:
          - img [ref=e40]
          - generic [ref=e43]: اتصالِ حساب
          - img [ref=e44]
        - button "واچ‌لیست" [ref=e47] [cursor=pointer]:
          - img [ref=e48]
          - generic [ref=e50]: واچ‌لیست
        - button "آلارم‌ها" [ref=e51] [cursor=pointer]:
          - img [ref=e52]
          - generic [ref=e55]: آلارم‌ها
        - button "اسکریپت‌ها" [ref=e56] [cursor=pointer]:
          - img [ref=e57]
          - generic [ref=e61]: اسکریپت‌ها
        - button "لِی‌اوت‌ها" [ref=e62] [cursor=pointer]:
          - img [ref=e63]
          - generic [ref=e68]: لِی‌اوت‌ها
        - button "اعلان‌ها" [ref=e69] [cursor=pointer]:
          - img [ref=e70]
          - generic [ref=e75]: اعلان‌ها
        - button "امنیت" [ref=e76] [cursor=pointer]:
          - img [ref=e77]
          - generic [ref=e80]: امنیت
        - button "معرفی" [ref=e81] [cursor=pointer]:
          - img [ref=e82]
          - generic [ref=e88]: معرفی
    - main [ref=e89]:
      - generic [ref=e90]:
        - heading "اتصالِ حساب" [level=2] [ref=e91]
        - generic [ref=e92]:
          - img [ref=e93]
          - text: اتصال حساب LBank فقط پس از بررسی شرایط و کنترل‌های حساب انجام می‌شود.
        - generic [ref=e96]:
          - generic [ref=e98]:
            - img [ref=e99]
            - text: اتصال به صرافیِ LBank (البنک)
          - paragraph [ref=e101]: اتصال حساب LBank از کنترل‌های جداگانهٔ حساب و ارائه‌دهنده پیروی می‌کند.
          - region "لینک معرفی LBank" [ref=e102]:
            - paragraph [ref=e103]:
              - strong [ref=e104]: "لینک معرفی:"
              - text: با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.
            - paragraph [ref=e105]: ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.
            - generic [ref=e106] [cursor=pointer]:
              - checkbox "شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم." [checked] [ref=e107]
              - generic [ref=e108]: شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.
            - button "لینک معرفی — ورود به وب‌سایت LBank" [active] [ref=e110] [cursor=pointer]
          - generic [ref=e111]:
            - generic [ref=e112]: "کلیدِ API صرافیِ LBank را وارد کن (برای تریدِ واقعی روی حسابِ خودت):"
            - textbox "API Key" [ref=e113]
            - generic [ref=e114]:
              - textbox "API Secret" [ref=e115]
              - button "نمایشِ رمزِ عبور" [ref=e116] [cursor=pointer]:
                - img [ref=e117]
            - textbox "UID لِی‌بنک (اختیاری — برای تأییدِ رفرال)" [ref=e120]
            - button "ذخیرهٔ امن" [disabled] [ref=e121]
        - generic [ref=e122]:
          - generic [ref=e124]:
            - img [ref=e125]
            - text: تریدِ واقعی روی چارت
          - paragraph [ref=e128]: قابلیت‌های حساب LBank به اشتراک، کنترل‌های اتصال و شرایط ارائه‌دهنده بستگی دارد.
          - link "رفتن به چارتِ بازارنما" [ref=e129] [cursor=pointer]:
            - /url: https://pro-chart.ir/
            - text: رفتن به چارتِ بازارنما
            - img [ref=e130]
```

# Test source

```ts
  234 |     exact: true,
  235 |   });
  236 |   const form = region.locator('form');
  237 | 
  238 |   await expect(checkbox).toHaveCount(1);
  239 |   await expect(submit).toHaveCount(1);
  240 |   await expect(submit).toBeDisabled();
  241 |   expect(await submit.evaluate((element) => ({
  242 |     tagName: element.tagName,
  243 |     type: element.type,
  244 |     nativeDisabled: element.disabled,
  245 |   }))).toEqual({ tagName: 'BUTTON', type: 'submit', nativeDisabled: true });
  246 | 
  247 |   const disclosureId = await paragraphs.nth(0).getAttribute('id');
  248 |   const eligibilityId = await paragraphs.nth(1).getAttribute('id');
  249 |   const expectedDescription = `لینک معرفی: ${DISCLOSURE} ${ELIGIBILITY}`;
  250 |   expect(disclosureId).toMatch(/^referral-disclosure-/);
  251 |   expect(eligibilityId).toMatch(/^referral-eligibility-/);
  252 |   expect(await checkbox.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  253 |   expect(await submit.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  254 |   await expect(checkbox).toHaveAccessibleName('شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.');
  255 |   await expect(checkbox).toHaveAccessibleDescription(expectedDescription);
  256 |   await expect(submit).toHaveAccessibleDescription(expectedDescription);
  257 | 
  258 |   const axeResult = await new AxeBuilder({ page })
  259 |     .include(`section[aria-label="لینک معرفی ${provider.name}"]`)
  260 |     .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
  261 |     .analyze();
  262 |   expect(axeResult.violations.map(({ id, impact, nodes }) => ({
  263 |     id,
  264 |     impact,
  265 |     nodeCount: nodes.length,
  266 |   }))).toEqual([]);
  267 | 
  268 |   const rawAction = await form.getAttribute('action');
  269 |   const resolvedAction = await form.evaluate((element) => element.action);
  270 |   const method = await form.getAttribute('method');
  271 |   const target = await form.getAttribute('target');
  272 |   const relTokens = (await form.getAttribute('rel') || '').split(/\s+/).filter(Boolean).sort();
  273 |   expect(rawAction, 'only the reviewed same-origin path is rendered').toBe(provider.approvedPath);
  274 |   expect(new URL(resolvedAction).origin, 'form action remains on the preview origin').toBe(expectedOrigin);
  275 |   expect(new URL(resolvedAction).pathname).toBe(provider.approvedPath);
  276 |   expect(method?.toLowerCase()).toBe('get');
  277 |   expect(target).toBe('_blank');
  278 |   expect(relTokens).toEqual(['noopener', 'noreferrer', 'sponsored']);
  279 | 
  280 |   const disclosureOrder = await region.evaluate((element) => {
  281 |     const [disclosure, eligibility] = element.querySelectorAll('p');
  282 |     const outboundForm = element.querySelector('form');
  283 |     return {
  284 |       disclosureBeforeEligibility: Boolean(disclosure?.compareDocumentPosition(eligibility) & Node.DOCUMENT_POSITION_FOLLOWING),
  285 |       disclosureBeforeForm: Boolean(disclosure?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING),
  286 |       eligibilityBeforeForm: Boolean(eligibility?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING),
  287 |     };
  288 |   });
  289 |   expect(disclosureOrder).toEqual({
  290 |     disclosureBeforeEligibility: true,
  291 |     disclosureBeforeForm: true,
  292 |     eligibilityBeforeForm: true,
  293 |   });
  294 | 
  295 |   await checkbox.focus();
  296 |   await expect(checkbox).toBeFocused();
  297 |   await checkbox.press('Space');
  298 |   await expect(checkbox).toBeChecked();
  299 |   await expect(submit).toBeEnabled();
  300 | 
  301 |   const departureRequests = [];
  302 |   const context = page.context();
  303 |   const departurePattern = `**${provider.approvedPath}`;
  304 |   const departureHandler = async (route) => {
  305 |     const requestUrl = new URL(route.request().url());
  306 |     departureRequests.push({
  307 |       method: route.request().method(),
  308 |       origin: requestUrl.origin,
  309 |       pathname: requestUrl.pathname,
  310 |     });
  311 |     await route.fulfill({
  312 |       status: 200,
  313 |       contentType: 'text/html; charset=utf-8',
  314 |       body: '<!doctype html><html lang="fa" dir="rtl"><title>referral intercepted</title></html>',
  315 |     });
  316 |   };
  317 |   await context.route(departurePattern, departureHandler);
  318 |   let popup;
  319 |   try {
  320 |     [popup] = await Promise.all([
  321 |       page.waitForEvent('popup'),
  322 |       submit.click(),
  323 |     ]);
  324 |     await popup.waitForLoadState('domcontentloaded');
  325 |     await expect.poll(() => departureRequests).toEqual([{
  326 |       method: 'GET',
  327 |       origin: expectedOrigin,
  328 |       pathname: provider.approvedPath,
  329 |     }]);
  330 |     expect(new URL(popup.url()).origin).toBe(expectedOrigin);
  331 |     expect(new URL(popup.url()).pathname).toBe(provider.approvedPath);
  332 |   } finally {
  333 |     await popup?.close();
> 334 |     await context.unroute(departurePattern, departureHandler);
      |                   ^ Error: browserContext.unroute: Target page, context or browser has been closed
  335 |   }
  336 | 
  337 |   const directProviderLinks = await surface.locator('a[href], form[action]').evaluateAll((elements, source) => elements
  338 |     .map((element) => ({
  339 |       tagName: element.tagName,
  340 |       raw: element.getAttribute(element.tagName === 'FORM' ? 'action' : 'href'),
  341 |       resolved: element.tagName === 'FORM' ? element.action : element.href,
  342 |     }))
  343 |     .filter(({ resolved }) => {
  344 |       try {
  345 |         return new RegExp(source).test(new URL(resolved).hostname);
  346 |       } catch {
  347 |         return false;
  348 |       }
  349 |     }), provider.directHostPattern.source);
  350 |   expect(directProviderLinks, `no direct ${provider.name} target may bypass the gate`).toEqual([]);
  351 | 
  352 |   const windowOpenCalls = await page.evaluate(() => window.__referralQaWindowOpenCalls || []);
  353 |   expect(windowOpenCalls, 'the reachable surface must not call window.open before acknowledgement').toEqual([]);
  354 | 
  355 |   return {
  356 |     disclosure: await paragraphs.nth(0).innerText(),
  357 |     eligibility: await paragraphs.nth(1).innerText(),
  358 |     rawAction,
  359 |     resolvedAction,
  360 |     method,
  361 |     target,
  362 |     relTokens,
  363 |     disclosureOrder,
  364 |     accessibility: {
  365 |       axeViolationCount: axeResult.violations.length,
  366 |       describedBy: `${disclosureId} ${eligibilityId}`,
  367 |       expectedDescription,
  368 |     },
  369 |     nativeSubmit: true,
  370 |     initiallyDisabled: true,
  371 |     keyboardAcknowledgementEnabledSubmit: true,
  372 |     departureRequests,
  373 |     directProviderLinks,
  374 |     windowOpenCalls,
  375 |   };
  376 | }
  377 | 
  378 | for (const provider of providers) {
  379 |   test(`REFERRAL-COMPLIANCE: ${provider.name} gate is disclosed, acknowledged, and same-origin`, async ({ page }, testInfo) => {
  380 |     await installWindowOpenProbe(page);
  381 | 
  382 |     const opened = testInfo.project.name === 'chromium-desktop'
  383 |       ? await openDesktopUserPanel(page, testInfo, provider)
  384 |       : await openMobileProfile(page, testInfo, provider);
  385 | 
  386 |     const gates = {
  387 |       connectOrProfile: await assertReferralGate(page, opened.surface, provider, opened.expectedOrigin),
  388 |     };
  389 | 
  390 |     if (provider.name === 'OneRoyal') {
  391 |       await assertOneRoyalReferralOnly(opened.surface);
  392 |     }
  393 | 
  394 |     // The desktop panel exposes the approved departure gate in both the account-
  395 |     // connection flow and its dedicated referral tab. Exercise both reachable
  396 |     // placements without submitting the outbound form.
  397 |     if (testInfo.project.name === 'chromium-desktop') {
  398 |       const referralTab = page.getByRole('button', { name: 'معرفی', exact: true });
  399 |       await referralTab.focus();
  400 |       await expect(referralTab).toBeFocused();
  401 |       await referralTab.press('Enter');
  402 |       await expect.poll(() => new URL(page.url()).hash).toBe('#/referral');
  403 |       await expect(page.getByRole('heading', { name: 'معرفی', exact: true })).toBeVisible();
  404 |       gates.referralTab = await assertReferralGate(page, opened.surface, provider, opened.expectedOrigin);
  405 |       if (provider.name === 'OneRoyal') await assertNoCredentialControls(opened.surface);
  406 |     }
  407 | 
  408 |     const network = testInfo.project.name === 'chromium-desktop'
  409 |       ? {
  410 |           apiRequests: opened.state.apiRequests,
  411 |           mocked: opened.state.mocked,
  412 |           unstubbed: opened.state.unstubbed,
  413 |           unexpectedExternal: opened.state.unexpectedExternal,
  414 |           pageErrors: opened.state.pageErrors,
  415 |           requestFailures: opened.state.requestFailures,
  416 |         }
  417 |       : {
  418 |           apiRequests: opened.state.apiRequests,
  419 |           mocked: opened.state.mocked,
  420 |           unstubbed: opened.state.unstubbed,
  421 |           unexpectedExternal: opened.state.unexpectedExternal,
  422 |           pageErrors: opened.state.pageErrors,
  423 |           requestFailures: opened.state.requestFailures,
  424 |           badResponses: opened.state.badResponses,
  425 |         };
  426 | 
  427 |     const ariaSnapshot = await opened.surface.ariaSnapshot();
  428 |     const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  429 |     await testInfo.attach('actual.png', { body: screenshot, contentType: 'image/png' });
  430 |     await testInfo.attach('aria-snapshot.yml', {
  431 |       body: Buffer.from(`${ariaSnapshot}\n`),
  432 |       contentType: 'text/yaml; charset=utf-8',
  433 |     });
  434 | 
```