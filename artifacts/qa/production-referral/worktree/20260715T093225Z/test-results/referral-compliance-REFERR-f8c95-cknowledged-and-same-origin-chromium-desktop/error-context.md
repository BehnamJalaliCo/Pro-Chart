# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: referral-compliance.spec.mjs >> REFERRAL-COMPLIANCE: OneRoyal gate is disclosed, acknowledged, and same-origin
- Location: tests/referral-compliance.spec.mjs:412:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'اتصال LBank و معرفی OneRoyal', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: 'اتصال LBank و معرفی OneRoyal', exact: true })

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
  - text: صبح‌ به‌خیر،
  - heading "کاربر" [level=1]
  - img
  - text: رایگان
  - img
  - text: نیازمندِ تکمیل پروفایل
  - button "ارتقا به پرمیوم":
    - img
    - text: ارتقا به پرمیوم
  - button "معامله":
    - img
    - text: معامله
  - button "سیگنال AI":
    - img
    - text: سیگنال AI
  - button "معرفی OneRoyal":
    - img
    - text: معرفی OneRoyal
  - button "اشتراک":
    - img
    - text: اشتراک
  - button "۰ واچ‌لیست":
    - img
    - text: ۰ واچ‌لیست
  - button "۰ سفارش‌ها":
    - img
    - text: ۰ سفارش‌ها
  - button "۰ هشدارها":
    - img
    - text: ۰ هشدارها
  - button "۰ سیگنال فعال":
    - img
    - text: ۰ سیگنال فعال
  - img
  - heading "اشتراک" [level=2]
  - text: پلنِ رایگان
  - paragraph: با ارتقا به پرمیوم به سیگنال‌های هوشِ مصنوعی، معاملهٔ واقعی و اسکریپت‌ها دسترسی پیدا می‌کنید.
  - button "تهیهٔ اشتراک":
    - img
    - text: تهیهٔ اشتراک
  - img
  - heading "OneRoyal — فقط معرفی" [level=2]
  - paragraph: اتصال MT5، دریافت رمز و معاملهٔ مستقیم OneRoyal در Pro Chart فعال نیست.
  - region "لینک معرفی OneRoyal":
    - paragraph:
      - strong: "لینک معرفی:"
      - text: با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.
    - paragraph: ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.
    - checkbox "شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم."
    - text: شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.
    - button "لینک معرفی — ورود به وب‌سایت OneRoyal" [disabled]
  - img
  - heading "سیگنال‌های هوشِ مصنوعی" [level=2]
  - img
  - paragraph: ویژهٔ پرمیوم
  - paragraph: سیگنال‌های هوشِ مصنوعی تنها برای کاربرانِ پرمیوم فعال است.
  - button "ارتقا":
    - img
    - text: ارتقا
  - img
  - heading "واچ‌لیست زنده" [level=2]
  - button "مدیریت":
    - text: مدیریت
    - img
  - img
  - paragraph: خطا
  - paragraph: ارتباط با سرور برقرار نشد.
  - button "تلاشِ دوباره":
    - img
    - text: تلاشِ دوباره
  - img
  - heading "سفارش‌های اخیر" [level=2]
  - img
  - paragraph: هنوز سفارشی ثبت نشده
  - paragraph: نخستین سفارشِ خود را از بخشِ معاملات ثبت کنید.
  - button "رفتن به معاملات"
  - img
  - heading "اخبار بازار" [level=2]
  - img
  - paragraph: خطا
  - paragraph: ارتباط با سرور برقرار نشد.
  - button "تلاشِ دوباره":
    - img
    - text: تلاشِ دوباره
```

# Test source

```ts
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
  131 |       await reply({
  132 |         accounts: { lbank: null },
  133 |         account_type: provider.accountType,
  134 |         lbank: false,
  135 |         lbank_connected: false,
  136 |       });
  137 |       return;
  138 |     }
  139 |     if (key === 'GET /api/academy/bn/overview') {
  140 |       await reply({
  141 |         profile: {
  142 |           tier: 'free',
  143 |           account_type: provider.accountType,
  144 |         },
  145 |       });
  146 |       return;
  147 |     }
  148 |     if (key === 'GET /api/academy/bn/alerts') {
  149 |       await reply([]);
  150 |       return;
  151 |     }
  152 |     if (key === 'GET /api/academy/bn/referral-link') {
  153 |       await reply({
  154 |         broker: provider.name,
  155 |         url: provider.approvedPath,
  156 |         referral_only: provider.name === 'OneRoyal',
  157 |       });
  158 |       return;
  159 |     }
  160 | 
  161 |     state.unstubbed.push(key);
  162 |     await route.abort('blockedbyclient');
  163 |   });
  164 | 
  165 |   return state;
  166 | }
  167 | 
  168 | async function openDesktopUserPanel(page, testInfo, provider) {
  169 |   const target = userPanelUrl(testInfo.project.use.baseURL);
  170 |   const state = await installUserPanelFixture(page, target.origin, provider);
  171 |   const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  172 | 
  173 |   expect(response?.status(), 'desktop UserPanel document status').toBe(200);
  174 |   await expect.poll(() => new URL(page.url()).hash).toBe('#/connect');
  175 |   await expect(page.getByRole('heading', {
  176 |     name: 'اتصال LBank و معرفی OneRoyal',
  177 |     exact: true,
> 178 |   })).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
  179 | 
  180 |   return {
  181 |     state,
  182 |     surface: page.locator('main'),
  183 |     surfaceId: 'desktop-user-panel-connect',
  184 |     expectedOrigin: target.origin,
  185 |   };
  186 | }
  187 | 
  188 | async function assertNoCredentialControls(surface) {
  189 |   await expect(surface.locator([
  190 |     'input[type="password"]',
  191 |     'input[placeholder*="API"]',
  192 |     'input[placeholder*="MT5"]',
  193 |     'input[placeholder*="سرور"]',
  194 |     'input[placeholder*="Login"]',
  195 |   ].join(','))).toHaveCount(0);
  196 |   await expect(surface.getByRole('button', { name: /ذخیره|حذف اتصال|قطع اتصال/ })).toHaveCount(0);
  197 | }
  198 | 
  199 | async function assertOneRoyalReferralOnly(surface) {
  200 |   await expect(surface.getByText(/OneRoyal.*اتصال حساب.*معامله.*فعال نیست/).first()).toBeVisible();
  201 |   await assertNoCredentialControls(surface);
  202 | }
  203 | 
  204 | async function openMobileProfile(page, testInfo, provider) {
  205 |   const state = createFixtureState();
  206 |   await installSyntheticFixture(page, testInfo, { onboarding: false }, state);
  207 |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  208 | 
  209 |   expect(response?.status(), 'mobile app document status').toBe(200);
  210 |   await expect(page.locator('.pc-launch')).toHaveCount(0);
  211 | 
  212 |   const profileTab = page.getByRole('button', { name: 'پروفایل', exact: true });
  213 |   await profileTab.focus();
  214 |   await expect(profileTab).toBeFocused();
  215 |   await profileTab.press('Space');
  216 |   await expect(page.getByRole('heading', { name: 'پروفایل', exact: true })).toBeVisible();
  217 | 
  218 |   const surface = page.locator('main > .pc-screen-in').filter({
  219 |     has: page.getByRole('heading', { name: 'پروفایل', exact: true }),
  220 |   });
  221 |   await expect(surface).toHaveCount(1);
  222 | 
  223 |   const providerDisclosure = provider.name === 'LBank'
  224 |     ? surface.getByRole('button', { name: /LBank/ }).first()
  225 |     : surface.getByRole('button', { name: /معرفی OneRoyal/ }).first();
  226 |   await providerDisclosure.focus();
  227 |   await expect(providerDisclosure).toBeFocused();
  228 |   await providerDisclosure.press('Enter');
  229 | 
  230 |   return {
  231 |     state,
  232 |     surface,
  233 |     surfaceId: 'mobile-profile',
  234 |     expectedOrigin: new URL(testInfo.project.use.baseURL).origin,
  235 |   };
  236 | }
  237 | 
  238 | async function assertReferralGate(page, surface, provider, expectedOrigin) {
  239 |   const region = surface.locator(`section[aria-label="لینک معرفی ${provider.name}"]`);
  240 |   await expect(region).toHaveCount(1);
  241 |   await expect(region).toBeVisible();
  242 | 
  243 |   const paragraphs = region.locator('p');
  244 |   await expect(paragraphs).toHaveCount(2);
  245 |   await expect(paragraphs.nth(0)).toHaveText(`لینک معرفی: ${DISCLOSURE}`);
  246 |   await expect(paragraphs.nth(1)).toHaveText(ELIGIBILITY);
  247 | 
  248 |   const checkbox = region.getByRole('checkbox');
  249 |   const submit = region.getByRole('button', {
  250 |     name: `لینک معرفی — ورود به وب‌سایت ${provider.name}`,
  251 |     exact: true,
  252 |   });
  253 |   const form = region.locator('form');
  254 | 
  255 |   await expect(checkbox).toHaveCount(1);
  256 |   await expect(submit).toHaveCount(1);
  257 |   await expect(submit).toBeDisabled();
  258 |   expect(await submit.evaluate((element) => ({
  259 |     tagName: element.tagName,
  260 |     type: element.type,
  261 |     nativeDisabled: element.disabled,
  262 |   }))).toEqual({ tagName: 'BUTTON', type: 'submit', nativeDisabled: true });
  263 | 
  264 |   const disclosureId = await paragraphs.nth(0).getAttribute('id');
  265 |   const eligibilityId = await paragraphs.nth(1).getAttribute('id');
  266 |   const expectedDescription = `لینک معرفی: ${DISCLOSURE} ${ELIGIBILITY}`;
  267 |   expect(disclosureId).toMatch(/^referral-disclosure-/);
  268 |   expect(eligibilityId).toMatch(/^referral-eligibility-/);
  269 |   expect(await checkbox.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  270 |   expect(await submit.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  271 |   await expect(checkbox).toHaveAccessibleName('شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.');
  272 |   await expect(checkbox).toHaveAccessibleDescription(expectedDescription);
  273 |   await expect(submit).toHaveAccessibleDescription(expectedDescription);
  274 | 
  275 |   const axeResult = await new AxeBuilder({ page })
  276 |     .include(`section[aria-label="لینک معرفی ${provider.name}"]`)
  277 |     .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
  278 |     .analyze();
```