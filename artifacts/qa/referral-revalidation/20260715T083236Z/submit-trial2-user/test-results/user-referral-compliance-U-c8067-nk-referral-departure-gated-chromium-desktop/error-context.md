# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-referral-compliance.spec.mjs >> USER-REFERRAL: real /connect keeps LBank referral departure gated
- Location: tests/user-referral-compliance.spec.mjs:343:3

# Error details

```
Error: the gate must not navigate before an explicit submit

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "https://user.pro-chart.com/go/lbank?",
+ ]
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
      - generic [ref=e45]:
        - generic [ref=e46]: کاربر آزمون معرفی
        - generic [ref=e47]:
          - img [ref=e48]
          - text: پرمیوم
      - generic [ref=e51]:
        - button "تغییرِ تم" [ref=e52] [cursor=pointer]:
          - img [ref=e53]
        - button "اعلان‌ها" [ref=e60] [cursor=pointer]:
          - img [ref=e61]
    - main [ref=e64]:
      - generic [ref=e65]:
        - generic [ref=e66]:
          - img [ref=e67]
          - heading "اتصال LBank و معرفی OneRoyal" [level=1] [ref=e70]
        - button "این بخش چه می‌کند؟" [ref=e72] [cursor=pointer]:
          - img [ref=e73]
          - generic [ref=e75]: این بخش چه می‌کند؟
          - img [ref=e76]
        - generic [ref=e78]:
          - generic [ref=e79]:
            - img [ref=e81]
            - generic [ref=e85]:
              - generic [ref=e86]: معرفی LBank
              - generic [ref=e87]: برای بررسی شرایط حساب LBank، ابتدا اطلاعیهٔ معرفی را بخوانید.
          - region "لینک معرفی LBank" [ref=e88]:
            - paragraph [ref=e89]:
              - strong [ref=e90]: "لینک معرفی:"
              - text: با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.
            - paragraph [ref=e91]: ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.
            - generic [ref=e92] [cursor=pointer]:
              - checkbox "شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم." [checked] [ref=e93]
              - generic [ref=e94]: شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.
            - button "لینک معرفی — ورود به وب‌سایت LBank" [active] [ref=e96] [cursor=pointer]
        - generic [ref=e97]:
          - generic [ref=e98]:
            - generic [ref=e99]:
              - img [ref=e101]
              - generic [ref=e103]:
                - generic [ref=e104]: صرافیِ LBank
                - generic [ref=e105]: اتصالِ کیفِ رمزارز برای معاملهٔ واقعی
            - generic [ref=e106]: متصل نیست
          - generic [ref=e108]:
            - generic [ref=e109]:
              - img [ref=e110]
              - text: "کلیدهای شما رمزنگاری‌شده ذخیره می‌شوند. توصیه: دسترسیِ «فقط خواندن + معامله»."
            - generic [ref=e113]:
              - text: API Key
              - generic [ref=e114]:
                - textbox "API Key نمایش" [ref=e115]:
                  - /placeholder: API Key
                - button "نمایش" [ref=e116] [cursor=pointer]:
                  - img [ref=e117]
            - generic [ref=e120]:
              - text: API Secret
              - generic [ref=e121]:
                - textbox "API Secret نمایش" [ref=e122]:
                  - /placeholder: API Secret
                - button "نمایش" [ref=e123] [cursor=pointer]:
                  - img [ref=e124]
            - generic [ref=e127]:
              - text: UID (اختیاری)
              - textbox "UID (اختیاری)" [ref=e128]:
                - /placeholder: UID
            - button "اتصالِ صرافی" [disabled] [ref=e129]:
              - img [ref=e130]
              - text: اتصالِ صرافی
```

# Test source

```ts
  304 |   });
  305 |   expect(directProviderTargets, `no direct ${provider.name} target may bypass /go`).toEqual([]);
  306 |   expect(await surface.innerHTML()).not.toContain(provider.untrustedReferralUrl);
  307 |   expect(await page.evaluate(() => window.__userReferralQaWindowOpenCalls || [])).toEqual([]);
  308 |   await expect(page).toHaveURL((url) => url.origin === expectedOrigin && url.pathname === '/connect');
  309 | 
  310 |   return {
  311 |     accessibility: {
  312 |       axeViolationCount: axeResult.violations.length,
  313 |       describedBy: `${disclosureId} ${eligibilityId}`,
  314 |       expectedDescription,
  315 |       departureRequests,
  316 |     },
  317 |     disclosureOrder,
  318 |     formContract,
  319 |     renderedTargets,
  320 |   };
  321 | }
  322 | 
  323 | async function assertBrokerIsReferralOnly(surface) {
  324 |   await expect(surface.getByText('OneRoyal — فقط معرفی', { exact: true })).toBeVisible();
  325 |   await expect(surface.locator('input:not([type="checkbox"]), textarea, select')).toHaveCount(0);
  326 |   await expect(surface.locator('form')).toHaveCount(1);
  327 |   await expect(surface.getByRole('button', {
  328 |     name: /اتصال.*(?:MT5|حساب|صرافی)|ثبت.*سفارش|خرید|فروش/,
  329 |   })).toHaveCount(0);
  330 |   await expect(surface.locator('form[action*="connect"], form[action*="order"]')).toHaveCount(0);
  331 | }
  332 | 
  333 | async function assertCryptoKeepsLBankCredentials(surface) {
  334 |   await expect(surface.getByText('صرافیِ LBank', { exact: true })).toBeVisible();
  335 |   await expect(surface.locator('input[placeholder="API Key"][type="password"]')).toHaveCount(1);
  336 |   await expect(surface.locator('input[placeholder="API Secret"][type="password"]')).toHaveCount(1);
  337 |   await expect(surface.locator('input[placeholder="UID"]')).toHaveCount(1);
  338 |   await expect(surface.getByRole('button', { name: /اتصال.*صرافی/ })).toHaveCount(1);
  339 |   await expect(surface.locator('input[placeholder*="MT5"], input[placeholder*="Login"]')).toHaveCount(0);
  340 | }
  341 | 
  342 | for (const provider of providers) {
  343 |   test(`USER-REFERRAL: real /connect keeps ${provider.name} referral departure gated`, async ({ page }, testInfo) => {
  344 |     test.skip(new URL(testInfo.project.use.baseURL).hostname !== 'user.pro-chart.com', 'User Portal vhost contract runs only against user.pro-chart.com');
  345 |     const target = connectUrl(testInfo.project.use.baseURL);
  346 |     const state = await installUserPortalFixture(page, target.origin, provider);
  347 |     const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  348 | 
  349 |     expect(response?.status(), 'User Portal BrowserRouter document status').toBe(200);
  350 |     await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === '/connect');
  351 | 
  352 |     const surface = page.locator('main');
  353 |     await expect(surface).toBeVisible();
  354 |     const gate = await assertReferralGate(page, surface, target.origin, provider);
  355 | 
  356 |     const storageContract = await page.evaluate(() => ({
  357 |       legacyAuthAbsent: localStorage.getItem('bn_auth') === null,
  358 |       portalTokenPresent: Boolean(localStorage.getItem('cp_academy_token')),
  359 |     }));
  360 |     expect(storageContract).toEqual({ legacyAuthAbsent: true, portalTokenPresent: true });
  361 | 
  362 |     if (provider.accountType === 'broker') {
  363 |       await assertBrokerIsReferralOnly(surface);
  364 |     } else {
  365 |       await assertCryptoKeepsLBankCredentials(surface);
  366 |     }
  367 | 
  368 |     const uniqueApiRequests = [...new Set(state.apiRequests.map(({ key }) => key))].sort();
  369 |     expect(uniqueApiRequests).toEqual([
  370 |       'GET /api/academy/bn/connect/status',
  371 |       'GET /api/academy/bn/overview',
  372 |       'GET /api/academy/bn/referral-link',
  373 |     ]);
  374 |     expect(state.apiRequests.every(({ bearerTokenPresent }) => bearerTokenPresent)).toBe(true);
  375 | 
  376 |     await testInfo.attach('user-referral-compliance.json', {
  377 |       body: Buffer.from(`${JSON.stringify({
  378 |         schemaVersion: 1,
  379 |         scope: 'frontend-user-browser-router-connect',
  380 |         project: testInfo.project.name,
  381 |         provider: provider.name,
  382 |         accountType: provider.accountType,
  383 |         approvedPath: provider.approvedPath,
  384 |         storageContract,
  385 |         uniqueApiRequests,
  386 |         gate,
  387 |         network: {
  388 |           badResponses: state.badResponses,
  389 |           pageErrors: state.pageErrors,
  390 |           popups: state.popups,
  391 |           requestFailures: state.requestFailures,
  392 |           unexpectedExternal: state.unexpectedExternal,
  393 |           unstubbed: state.unstubbed,
  394 |         },
  395 |       }, null, 2)}\n`),
  396 |       contentType: 'application/json',
  397 |     });
  398 | 
  399 |     expect(state.unstubbed, 'every API request must have an explicit synthetic response').toEqual([]);
  400 |     expect(state.unexpectedExternal, 'the page must not make an outbound request').toEqual([]);
  401 |     expect(state.badResponses, 'the page must not receive an HTTP error').toEqual([]);
  402 |     expect(state.pageErrors, 'the page must not raise an uncaught error').toEqual([]);
  403 |     expect(state.requestFailures, 'the page must not have a failed request').toEqual([]);
> 404 |     expect(state.popups, 'the gate must not navigate before an explicit submit').toEqual([]);
      |                                                                                  ^ Error: the gate must not navigate before an explicit submit
  405 |   });
  406 | }
  407 | 
```