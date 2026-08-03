# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: referral-compliance.spec.mjs >> REFERRAL-COMPLIANCE: LBank gate is disclosed, acknowledged, and same-origin
- Location: tests/referral-compliance.spec.mjs:412:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.focus: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'معرفی', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: ب
      - generic [ref=e7]:
        - generic [ref=e8]: بازارنما
        - generic [ref=e9]: پنل کاربری
    - navigation [ref=e10]:
      - link "داشبورد" [ref=e11] [cursor=pointer]:
        - /url: /
        - img [ref=e12]
        - text: داشبورد
      - link "بازار و واچ‌لیست" [ref=e17] [cursor=pointer]:
        - /url: /market
        - img [ref=e18]
        - text: بازار و واچ‌لیست
      - link "سیگنال‌های AI" [ref=e21] [cursor=pointer]:
        - /url: /signals
        - img [ref=e22]
        - text: سیگنال‌های AI
      - link "معاملات" [ref=e24] [cursor=pointer]:
        - /url: /trade
        - img [ref=e25]
        - text: معاملات
      - link "اتصالِ صرافی" [ref=e28] [cursor=pointer]:
        - /url: /connect
        - img [ref=e29]
        - text: اتصالِ صرافی
      - link "اشتراک" [ref=e32] [cursor=pointer]:
        - /url: /subscription
        - img [ref=e33]
        - text: اشتراک
      - link "پروفایل" [ref=e35] [cursor=pointer]:
        - /url: /profile
        - img [ref=e36]
        - text: پروفایل
    - button "خروج" [ref=e39] [cursor=pointer]:
      - img [ref=e40]
      - text: خروج
  - generic [ref=e43]:
    - banner [ref=e44]:
      - generic [ref=e46]: کاربر
      - generic [ref=e47]:
        - button "تغییرِ تم" [ref=e48] [cursor=pointer]:
          - img [ref=e49]
        - button "اعلان‌ها" [ref=e56] [cursor=pointer]:
          - img [ref=e57]
    - main [ref=e60]:
      - generic [ref=e61]:
        - generic [ref=e62]:
          - img [ref=e63]
          - heading "اتصال LBank و معرفی OneRoyal" [level=1] [ref=e66]
        - button "این بخش چه می‌کند؟" [ref=e68] [cursor=pointer]:
          - img [ref=e69]
          - generic [ref=e71]: این بخش چه می‌کند؟
          - img [ref=e72]
        - generic [ref=e75]:
          - img [ref=e77]
          - generic [ref=e79]:
            - generic [ref=e80]: اتصالِ حساب LBank ویژهٔ اشتراکِ پرمیوم است
            - paragraph [ref=e81]: اتصال صرافی و معاملهٔ واقعی فقط برای حساب LBank و پس از ارتقا فعال می‌شود. OneRoyal صرفاً مسیر معرفی است.
            - link "ارتقا به پرمیوم" [ref=e82] [cursor=pointer]:
              - /url: /subscription
              - img [ref=e83]
              - text: ارتقا به پرمیوم
        - generic [ref=e85]:
          - generic [ref=e86]:
            - img [ref=e88]
            - generic [ref=e92]:
              - generic [ref=e93]: معرفی LBank
              - generic [ref=e94]: برای بررسی شرایط حساب LBank، ابتدا اطلاعیهٔ معرفی را بخوانید.
          - region "لینک معرفی LBank" [ref=e95]:
            - paragraph [ref=e96]:
              - strong [ref=e97]: "لینک معرفی:"
              - text: با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.
            - paragraph [ref=e98]: ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.
            - generic [ref=e99] [cursor=pointer]:
              - checkbox "شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم." [checked] [ref=e100]
              - generic [ref=e101]: شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.
            - button "لینک معرفی — ورود به وب‌سایت LBank" [active] [ref=e103] [cursor=pointer]
        - generic [ref=e104]:
          - generic [ref=e105]:
            - generic [ref=e106]:
              - img [ref=e108]
              - generic [ref=e110]:
                - generic [ref=e111]: صرافیِ LBank
                - generic [ref=e112]: اتصالِ کیفِ رمزارز برای معاملهٔ واقعی
            - generic [ref=e113]: متصل نیست
          - generic:
            - generic:
              - img
              - text: "کلیدهای شما رمزنگاری‌شده ذخیره می‌شوند. توصیه: دسترسیِ «فقط خواندن + معامله»."
            - generic:
              - text: API Key
              - generic:
                - textbox "API Key نمایش":
                  - /placeholder: API Key
                - button "نمایش":
                  - img
            - generic:
              - text: API Secret
              - generic:
                - textbox "API Secret نمایش":
                  - /placeholder: API Secret
                - button "نمایش":
                  - img
            - generic:
              - text: UID (اختیاری)
              - textbox "UID (اختیاری)":
                - /placeholder: UID
            - button "اتصالِ صرافی" [disabled]:
              - img
              - text: اتصالِ صرافی
```

# Test source

```ts
  332 |     const requestUrl = new URL(route.request().url());
  333 |     departureRequests.push({
  334 |       method: route.request().method(),
  335 |       origin: requestUrl.origin,
  336 |       pathname: requestUrl.pathname,
  337 |     });
  338 |     await route.fulfill({
  339 |       status: 200,
  340 |       contentType: 'text/html; charset=utf-8',
  341 |       body: '<!doctype html><html lang="fa" dir="rtl"><title>referral intercepted</title></html>',
  342 |     });
  343 |   };
  344 |   await context.route(departurePattern, departureHandler);
  345 |   const pagesBeforeDeparture = new Set(context.pages());
  346 |   try {
  347 |     const [departureRequest] = await Promise.all([
  348 |       context.waitForEvent('request', {
  349 |         predicate: (request) => new URL(request.url()).pathname === provider.approvedPath,
  350 |       }),
  351 |       submit.click({ noWaitAfter: true }),
  352 |     ]);
  353 |     await expect.poll(() => departureRequests).toEqual([{
  354 |       method: 'GET',
  355 |       origin: expectedOrigin,
  356 |       pathname: provider.approvedPath,
  357 |     }]);
  358 |     expect(departureRequest.method()).toBe('GET');
  359 |     expect(new URL(departureRequest.url()).origin).toBe(expectedOrigin);
  360 |     expect(new URL(departureRequest.url()).pathname).toBe(provider.approvedPath);
  361 |     await expect.poll(() => context.pages().length).toBe(pagesBeforeDeparture.size + 1);
  362 |   } finally {
  363 |     await Promise.all(context.pages()
  364 |       .filter((candidatePage) => !pagesBeforeDeparture.has(candidatePage))
  365 |       .map((candidatePage) => candidatePage.close()));
  366 |     await context.unroute(departurePattern, departureHandler);
  367 |   }
  368 | 
  369 |   const directProviderLinks = await surface.locator('a[href], form[action]').evaluateAll((elements, source) => elements
  370 |     .map((element) => ({
  371 |       tagName: element.tagName,
  372 |       raw: element.getAttribute(element.tagName === 'FORM' ? 'action' : 'href'),
  373 |       resolved: element.tagName === 'FORM' ? element.action : element.href,
  374 |     }))
  375 |     .filter(({ resolved }) => {
  376 |       try {
  377 |         return new RegExp(source).test(new URL(resolved).hostname);
  378 |       } catch {
  379 |         return false;
  380 |       }
  381 |     }), provider.directHostPattern.source);
  382 |   expect(directProviderLinks, `no direct ${provider.name} target may bypass the gate`).toEqual([]);
  383 | 
  384 |   const windowOpenCalls = await page.evaluate(() => window.__referralQaWindowOpenCalls || []);
  385 |   expect(windowOpenCalls, 'the reachable surface must not call window.open before acknowledgement').toEqual([]);
  386 | 
  387 |   return {
  388 |     disclosure: await paragraphs.nth(0).innerText(),
  389 |     eligibility: await paragraphs.nth(1).innerText(),
  390 |     rawAction,
  391 |     resolvedAction,
  392 |     method,
  393 |     target,
  394 |     relTokens,
  395 |     disclosureOrder,
  396 |     accessibility: {
  397 |       axeViolationCount: axeResult.violations.length,
  398 |       acknowledgedAxeViolationCount: acknowledgedAxeResult.violations.length,
  399 |       describedBy: `${disclosureId} ${eligibilityId}`,
  400 |       expectedDescription,
  401 |     },
  402 |     nativeSubmit: true,
  403 |     initiallyDisabled: true,
  404 |     keyboardAcknowledgementEnabledSubmit: true,
  405 |     departureRequests,
  406 |     directProviderLinks,
  407 |     windowOpenCalls,
  408 |   };
  409 | }
  410 | 
  411 | for (const provider of providers) {
  412 |   test(`REFERRAL-COMPLIANCE: ${provider.name} gate is disclosed, acknowledged, and same-origin`, async ({ page }, testInfo) => {
  413 |     await installWindowOpenProbe(page);
  414 | 
  415 |     const opened = testInfo.project.name === 'chromium-desktop'
  416 |       ? await openDesktopUserPanel(page, testInfo, provider)
  417 |       : await openMobileProfile(page, testInfo, provider);
  418 | 
  419 |     const gates = {
  420 |       connectOrProfile: await assertReferralGate(page, opened.surface, provider, opened.expectedOrigin),
  421 |     };
  422 | 
  423 |     if (provider.name === 'OneRoyal') {
  424 |       await assertOneRoyalReferralOnly(opened.surface);
  425 |     }
  426 | 
  427 |     // The desktop panel exposes the approved departure gate in both the account-
  428 |     // connection flow and its dedicated referral tab. Exercise both reachable
  429 |     // placements without submitting the outbound form.
  430 |     if (testInfo.project.name === 'chromium-desktop') {
  431 |       const referralTab = page.getByRole('button', { name: 'معرفی', exact: true });
> 432 |       await referralTab.focus();
      |                         ^ Error: locator.focus: Test timeout of 60000ms exceeded.
  433 |       await expect(referralTab).toBeFocused();
  434 |       await referralTab.press('Enter');
  435 |       await expect.poll(() => new URL(page.url()).hash).toBe('#/referral');
  436 |       await expect(page.getByRole('heading', { name: 'معرفی', exact: true })).toBeVisible();
  437 |       gates.referralTab = await assertReferralGate(page, opened.surface, provider, opened.expectedOrigin);
  438 |       if (provider.name === 'OneRoyal') await assertNoCredentialControls(opened.surface);
  439 |     }
  440 | 
  441 |     const network = testInfo.project.name === 'chromium-desktop'
  442 |       ? {
  443 |           apiRequests: opened.state.apiRequests,
  444 |           mocked: opened.state.mocked,
  445 |           unstubbed: opened.state.unstubbed,
  446 |           unexpectedExternal: opened.state.unexpectedExternal,
  447 |           pageErrors: opened.state.pageErrors,
  448 |           requestFailures: opened.state.requestFailures,
  449 |         }
  450 |       : {
  451 |           apiRequests: opened.state.apiRequests,
  452 |           mocked: opened.state.mocked,
  453 |           unstubbed: opened.state.unstubbed,
  454 |           unexpectedExternal: opened.state.unexpectedExternal,
  455 |           pageErrors: opened.state.pageErrors,
  456 |           requestFailures: opened.state.requestFailures,
  457 |           badResponses: opened.state.badResponses,
  458 |         };
  459 | 
  460 |     const ariaSnapshot = await opened.surface.ariaSnapshot();
  461 |     const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  462 |     await testInfo.attach('actual.png', { body: screenshot, contentType: 'image/png' });
  463 |     await testInfo.attach('aria-snapshot.yml', {
  464 |       body: Buffer.from(`${ariaSnapshot}\n`),
  465 |       contentType: 'text/yaml; charset=utf-8',
  466 |     });
  467 | 
  468 |     await testInfo.attach('referral-compliance.json', {
  469 |       body: Buffer.from(`${JSON.stringify({
  470 |         schemaVersion: 1,
  471 |         scope: 'approved-provider-referral-departure-gate',
  472 |         project: testInfo.project.name,
  473 |         surface: opened.surfaceId,
  474 |         provider: provider.name,
  475 |         accountType: provider.accountType,
  476 |         expectedOrigin: opened.expectedOrigin,
  477 |         approvedPath: provider.approvedPath,
  478 |         gates,
  479 |         oneRoyalReferralOnly: provider.name === 'OneRoyal',
  480 |         network,
  481 |       }, null, 2)}\n`),
  482 |       contentType: 'application/json',
  483 |     });
  484 | 
  485 |     expect(network.unstubbed, 'all API calls are explicitly synthetic').toEqual([]);
  486 |     expect(network.unexpectedExternal, 'no outbound network request is made').toEqual([]);
  487 |     expect(network.pageErrors, 'no uncaught page error').toEqual([]);
  488 |     expect(network.requestFailures, 'no failed request').toEqual([]);
  489 |     if ('badResponses' in network) expect(network.badResponses, 'no HTTP error response').toEqual([]);
  490 |   });
  491 | }
  492 | 
```