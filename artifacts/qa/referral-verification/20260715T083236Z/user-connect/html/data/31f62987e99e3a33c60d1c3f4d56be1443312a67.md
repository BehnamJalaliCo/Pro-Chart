# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-referral-compliance.spec.mjs >> USER-REFERRAL: real /connect keeps LBank referral departure gated
- Location: tests/user-referral-compliance.spec.mjs:354:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodeCount": 1,
+   },
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
              - checkbox "شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم." [checked] [active] [ref=e93]
              - generic [ref=e94]: شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.
            - button "لینک معرفی — ورود به وب‌سایت LBank" [ref=e96] [cursor=pointer]
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
  160 |   return state;
  161 | }
  162 | 
  163 | async function assertReferralGate(page, surface, expectedOrigin, provider) {
  164 |   const region = surface.locator(`section[aria-label="لینک معرفی ${provider.name}"]`);
  165 |   await expect(region).toHaveCount(1);
  166 |   await expect(region).toBeVisible();
  167 | 
  168 |   const paragraphs = region.locator('p');
  169 |   await expect(paragraphs).toHaveCount(2);
  170 |   await expect(paragraphs.nth(0)).toHaveText(`لینک معرفی: ${DISCLOSURE}`);
  171 |   await expect(paragraphs.nth(1)).toHaveText(ELIGIBILITY);
  172 | 
  173 |   const checkbox = region.getByRole('checkbox');
  174 |   const submit = region.getByRole('button', {
  175 |     name: `لینک معرفی — ورود به وب‌سایت ${provider.name}`,
  176 |     exact: true,
  177 |   });
  178 |   const form = region.locator('form');
  179 | 
  180 |   await expect(checkbox).toHaveCount(1);
  181 |   await expect(submit).toHaveCount(1);
  182 |   await expect(submit).toBeDisabled();
  183 |   expect(await submit.evaluate((element) => ({
  184 |     disabled: element.disabled,
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
  252 |   const acknowledgedAxeResult = await new AxeBuilder({ page })
  253 |     .include(`section[aria-label="لینک معرفی ${provider.name}"]`)
  254 |     .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
  255 |     .analyze();
  256 |   expect(acknowledgedAxeResult.violations.map(({ id, impact, nodes }) => ({
  257 |     id,
  258 |     impact,
  259 |     nodeCount: nodes.length,
> 260 |   }))).toEqual([]);
      |        ^ Error: expect(received).toEqual(expected) // deep equality
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
  358 |     const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  359 | 
  360 |     expect(response?.status(), 'User Portal BrowserRouter document status').toBe(200);
```