# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: referral-compliance.spec.mjs >> REFERRAL-COMPLIANCE: LBank gate is disclosed, acknowledged, and same-origin
- Location: tests/referral-compliance.spec.mjs:395:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'اتصالِ حساب', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: 'اتصالِ حساب', exact: true })

```

```yaml
- complementary:
  - text: ب بازارنما پنل کاربری
  - navigation:
    - link "داشبورد":
      - /url: /
      - img
      - text: داشبورد
    - link "بازار و واچ‌لیست":
      - /url: /market
      - img
      - text: بازار و واچ‌لیست
    - link "سیگنال‌های AI":
      - /url: /signals
      - img
      - text: سیگنال‌های AI
    - link "معاملات":
      - /url: /trade
      - img
      - text: معاملات
    - link "اتصالِ صرافی":
      - /url: /connect
      - img
      - text: اتصالِ صرافی
    - link "اشتراک":
      - /url: /subscription
      - img
      - text: اشتراک
    - link "پروفایل":
      - /url: /profile
      - img
      - text: پروفایل
  - button "خروج":
    - img
    - text: خروج
- banner:
  - text: کاربر
  - button "تغییرِ تم":
    - img
  - button "اعلان‌ها":
    - img
- main:
  - img
  - paragraph: خطا
  - paragraph: ارتباط با سرور برقرار نشد.
  - button "تلاشِ دوباره":
    - img
    - text: تلاشِ دوباره
```

# Test source

```ts
  61  | async function installUserPanelFixture(page, panelOrigin, provider) {
  62  |   const state = {
  63  |     apiRequests: [],
  64  |     mocked: [],
  65  |     unstubbed: [],
  66  |     unexpectedExternal: [],
  67  |     pageErrors: [],
  68  |     requestFailures: [],
  69  |   };
  70  | 
  71  |   page.on('pageerror', (error) => state.pageErrors.push(String(error?.message || error).slice(0, 1000)));
  72  |   page.on('requestfailed', (request) => state.requestFailures.push({
  73  |     method: request.method(),
  74  |     pathname: new URL(request.url()).pathname,
  75  |     error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
  76  |   }));
  77  | 
  78  |   await page.addInitScript(({ accountType }) => {
  79  |     localStorage.clear();
  80  |     localStorage.setItem('bn_auth', JSON.stringify({
  81  |       username: 'referral-qa-user',
  82  |       tier: 'free',
  83  |       account_type: accountType,
  84  |     }));
  85  |     localStorage.setItem('cp_academy_token', 'synthetic-referral-qa-token');
  86  |     localStorage.setItem('bn_panel_tab', 'connect');
  87  |   }, { accountType: provider.accountType });
  88  | 
  89  |   // Register the origin guard first. Playwright evaluates the newer API route first.
  90  |   await page.route('**/*', async (route) => {
  91  |     const request = route.request();
  92  |     const url = new URL(request.url());
  93  |     if (url.origin === panelOrigin) {
  94  |       await route.fallback();
  95  |       return;
  96  |     }
  97  |     state.unexpectedExternal.push({
  98  |       method: request.method(),
  99  |       origin: url.origin,
  100 |       pathname: url.pathname,
  101 |     });
  102 |     await route.abort('blockedbyclient');
  103 |   });
  104 | 
  105 |   await page.route('**/api/**', async (route) => {
  106 |     const request = route.request();
  107 |     const pathname = new URL(request.url()).pathname;
  108 |     const key = `${request.method()} ${pathname}`;
  109 |     state.apiRequests.push(key);
  110 | 
  111 |     const reply = async (body) => {
  112 |       state.mocked.push(key);
  113 |       await route.fulfill({
  114 |         status: 200,
  115 |         contentType: 'application/json; charset=utf-8',
  116 |         body: `${JSON.stringify(body)}\n`,
  117 |       });
  118 |     };
  119 | 
  120 |     if (key === 'GET /api/academy/me') {
  121 |       await reply({
  122 |         id: 'referral-qa-user',
  123 |         username: 'referral-qa-user',
  124 |         tier: 'free',
  125 |         status: 'active',
  126 |         account_type: provider.accountType,
  127 |       });
  128 |       return;
  129 |     }
  130 |     if (key === 'GET /api/academy/bn/connect/status') {
  131 |       await reply({ accounts: { lbank: null }, lbank: false, lbank_connected: false });
  132 |       return;
  133 |     }
  134 |     if (key === 'GET /api/academy/bn/alerts') {
  135 |       await reply([]);
  136 |       return;
  137 |     }
  138 |     if (key === 'GET /api/academy/bn/referral-link') {
  139 |       await reply({
  140 |         broker: provider.name,
  141 |         url: provider.approvedPath,
  142 |         referral_only: provider.name === 'OneRoyal',
  143 |       });
  144 |       return;
  145 |     }
  146 | 
  147 |     state.unstubbed.push(key);
  148 |     await route.abort('blockedbyclient');
  149 |   });
  150 | 
  151 |   return state;
  152 | }
  153 | 
  154 | async function openDesktopUserPanel(page, testInfo, provider) {
  155 |   const target = userPanelUrl(testInfo.project.use.baseURL);
  156 |   const state = await installUserPanelFixture(page, target.origin, provider);
  157 |   const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  158 | 
  159 |   expect(response?.status(), 'desktop UserPanel document status').toBe(200);
  160 |   await expect.poll(() => new URL(page.url()).hash).toBe('#/connect');
> 161 |   await expect(page.getByRole('heading', { name: 'اتصالِ حساب', exact: true })).toBeVisible();
      |                                                                                 ^ Error: expect(locator).toBeVisible() failed
  162 | 
  163 |   return {
  164 |     state,
  165 |     surface: page.locator('main'),
  166 |     surfaceId: 'desktop-user-panel-connect',
  167 |     expectedOrigin: target.origin,
  168 |   };
  169 | }
  170 | 
  171 | async function assertNoCredentialControls(surface) {
  172 |   await expect(surface.locator([
  173 |     'input[type="password"]',
  174 |     'input[placeholder*="API"]',
  175 |     'input[placeholder*="MT5"]',
  176 |     'input[placeholder*="سرور"]',
  177 |     'input[placeholder*="Login"]',
  178 |   ].join(','))).toHaveCount(0);
  179 |   await expect(surface.getByRole('button', { name: /ذخیره|حذف اتصال|قطع اتصال/ })).toHaveCount(0);
  180 | }
  181 | 
  182 | async function assertOneRoyalReferralOnly(surface) {
  183 |   await expect(surface.getByText(/OneRoyal.*اتصال حساب.*معامله.*فعال نیست/).first()).toBeVisible();
  184 |   await assertNoCredentialControls(surface);
  185 | }
  186 | 
  187 | async function openMobileProfile(page, testInfo, provider) {
  188 |   const state = createFixtureState();
  189 |   await installSyntheticFixture(page, testInfo, { onboarding: false }, state);
  190 |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  191 | 
  192 |   expect(response?.status(), 'mobile app document status').toBe(200);
  193 |   await expect(page.locator('.pc-launch')).toHaveCount(0);
  194 | 
  195 |   const profileTab = page.getByRole('button', { name: 'پروفایل', exact: true });
  196 |   await profileTab.focus();
  197 |   await expect(profileTab).toBeFocused();
  198 |   await profileTab.press('Space');
  199 |   await expect(page.getByRole('heading', { name: 'پروفایل', exact: true })).toBeVisible();
  200 | 
  201 |   const surface = page.locator('main > .pc-screen-in').filter({
  202 |     has: page.getByRole('heading', { name: 'پروفایل', exact: true }),
  203 |   });
  204 |   await expect(surface).toHaveCount(1);
  205 | 
  206 |   const providerDisclosure = provider.name === 'LBank'
  207 |     ? surface.getByRole('button', { name: /LBank/ }).first()
  208 |     : surface.getByRole('button', { name: /معرفی OneRoyal/ }).first();
  209 |   await providerDisclosure.focus();
  210 |   await expect(providerDisclosure).toBeFocused();
  211 |   await providerDisclosure.press('Enter');
  212 | 
  213 |   return {
  214 |     state,
  215 |     surface,
  216 |     surfaceId: 'mobile-profile',
  217 |     expectedOrigin: new URL(testInfo.project.use.baseURL).origin,
  218 |   };
  219 | }
  220 | 
  221 | async function assertReferralGate(page, surface, provider, expectedOrigin) {
  222 |   const region = surface.locator(`section[aria-label="لینک معرفی ${provider.name}"]`);
  223 |   await expect(region).toHaveCount(1);
  224 |   await expect(region).toBeVisible();
  225 | 
  226 |   const paragraphs = region.locator('p');
  227 |   await expect(paragraphs).toHaveCount(2);
  228 |   await expect(paragraphs.nth(0)).toHaveText(`لینک معرفی: ${DISCLOSURE}`);
  229 |   await expect(paragraphs.nth(1)).toHaveText(ELIGIBILITY);
  230 | 
  231 |   const checkbox = region.getByRole('checkbox');
  232 |   const submit = region.getByRole('button', {
  233 |     name: `لینک معرفی — ورود به وب‌سایت ${provider.name}`,
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
```