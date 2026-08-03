# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: referral-compliance.spec.mjs >> REFERRAL-COMPLIANCE: LBank gate is disclosed, acknowledged, and same-origin
- Location: tests/referral-compliance.spec.mjs:315:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://user.pro-chart.ir/#/connect
Call log:
  - navigating to "https://user.pro-chart.ir/#/connect", waiting until "domcontentloaded"

```

# Test source

```ts
  56  |     };
  57  |   });
  58  | }
  59  | 
  60  | async function installUserPanelFixture(page, panelOrigin, provider) {
  61  |   const state = {
  62  |     apiRequests: [],
  63  |     mocked: [],
  64  |     unstubbed: [],
  65  |     unexpectedExternal: [],
  66  |     pageErrors: [],
  67  |     requestFailures: [],
  68  |   };
  69  | 
  70  |   page.on('pageerror', (error) => state.pageErrors.push(String(error?.message || error).slice(0, 1000)));
  71  |   page.on('requestfailed', (request) => state.requestFailures.push({
  72  |     method: request.method(),
  73  |     pathname: new URL(request.url()).pathname,
  74  |     error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
  75  |   }));
  76  | 
  77  |   await page.addInitScript(({ accountType }) => {
  78  |     localStorage.clear();
  79  |     localStorage.setItem('bn_auth', JSON.stringify({
  80  |       username: 'referral-qa-user',
  81  |       tier: 'free',
  82  |       account_type: accountType,
  83  |     }));
  84  |     localStorage.setItem('cp_academy_token', 'synthetic-referral-qa-token');
  85  |     localStorage.setItem('bn_panel_tab', 'connect');
  86  |   }, { accountType: provider.accountType });
  87  | 
  88  |   // Register the origin guard first. Playwright evaluates the newer API route first.
  89  |   await page.route('**/*', async (route) => {
  90  |     const request = route.request();
  91  |     const url = new URL(request.url());
  92  |     if (url.origin === panelOrigin) {
  93  |       await route.fallback();
  94  |       return;
  95  |     }
  96  |     state.unexpectedExternal.push({
  97  |       method: request.method(),
  98  |       origin: url.origin,
  99  |       pathname: url.pathname,
  100 |     });
  101 |     await route.abort('blockedbyclient');
  102 |   });
  103 | 
  104 |   await page.route('**/api/**', async (route) => {
  105 |     const request = route.request();
  106 |     const pathname = new URL(request.url()).pathname;
  107 |     const key = `${request.method()} ${pathname}`;
  108 |     state.apiRequests.push(key);
  109 | 
  110 |     const reply = async (body) => {
  111 |       state.mocked.push(key);
  112 |       await route.fulfill({
  113 |         status: 200,
  114 |         contentType: 'application/json; charset=utf-8',
  115 |         body: `${JSON.stringify(body)}\n`,
  116 |       });
  117 |     };
  118 | 
  119 |     if (key === 'GET /api/academy/me') {
  120 |       await reply({
  121 |         id: 'referral-qa-user',
  122 |         username: 'referral-qa-user',
  123 |         tier: 'free',
  124 |         status: 'active',
  125 |         account_type: provider.accountType,
  126 |       });
  127 |       return;
  128 |     }
  129 |     if (key === 'GET /api/academy/bn/connect/status') {
  130 |       await reply({ accounts: { lbank: null }, lbank: false, lbank_connected: false });
  131 |       return;
  132 |     }
  133 |     if (key === 'GET /api/academy/bn/alerts') {
  134 |       await reply([]);
  135 |       return;
  136 |     }
  137 |     if (key === 'GET /api/academy/bn/referral-link') {
  138 |       await reply({
  139 |         broker: provider.name,
  140 |         url: provider.approvedPath,
  141 |         referral_only: provider.name === 'OneRoyal',
  142 |       });
  143 |       return;
  144 |     }
  145 | 
  146 |     state.unstubbed.push(key);
  147 |     await route.abort('blockedbyclient');
  148 |   });
  149 | 
  150 |   return state;
  151 | }
  152 | 
  153 | async function openDesktopUserPanel(page, testInfo, provider) {
  154 |   const target = userPanelUrl(testInfo.project.use.baseURL);
  155 |   const state = await installUserPanelFixture(page, target.origin, provider);
> 156 |   const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
      |                               ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://user.pro-chart.ir/#/connect
  157 | 
  158 |   expect(response?.status(), 'desktop UserPanel document status').toBe(200);
  159 |   await expect.poll(() => new URL(page.url()).hash).toBe('#/connect');
  160 |   await expect(page.getByRole('heading', { name: 'اتصالِ حساب', exact: true })).toBeVisible();
  161 | 
  162 |   return {
  163 |     state,
  164 |     surface: page.locator('main'),
  165 |     surfaceId: 'desktop-user-panel-connect',
  166 |     expectedOrigin: target.origin,
  167 |   };
  168 | }
  169 | 
  170 | async function assertNoCredentialControls(surface) {
  171 |   await expect(surface.locator([
  172 |     'input[type="password"]',
  173 |     'input[placeholder*="API"]',
  174 |     'input[placeholder*="MT5"]',
  175 |     'input[placeholder*="سرور"]',
  176 |     'input[placeholder*="Login"]',
  177 |   ].join(','))).toHaveCount(0);
  178 |   await expect(surface.getByRole('button', { name: /ذخیره|حذف اتصال|قطع اتصال/ })).toHaveCount(0);
  179 | }
  180 | 
  181 | async function assertOneRoyalReferralOnly(surface) {
  182 |   await expect(surface.getByText(/OneRoyal.*اتصال حساب.*معامله.*فعال نیست/).first()).toBeVisible();
  183 |   await assertNoCredentialControls(surface);
  184 | }
  185 | 
  186 | async function openMobileProfile(page, testInfo, provider) {
  187 |   const state = createFixtureState();
  188 |   await installSyntheticFixture(page, testInfo, { onboarding: false }, state);
  189 |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  190 | 
  191 |   expect(response?.status(), 'mobile app document status').toBe(200);
  192 |   await expect(page.locator('.pc-launch')).toHaveCount(0);
  193 | 
  194 |   const profileTab = page.getByRole('button', { name: 'پروفایل', exact: true });
  195 |   await profileTab.focus();
  196 |   await expect(profileTab).toBeFocused();
  197 |   await profileTab.press('Space');
  198 |   await expect(page.getByRole('heading', { name: 'پروفایل', exact: true })).toBeVisible();
  199 | 
  200 |   const surface = page.locator('main > .pc-screen-in').filter({
  201 |     has: page.getByRole('heading', { name: 'پروفایل', exact: true }),
  202 |   });
  203 |   await expect(surface).toHaveCount(1);
  204 | 
  205 |   const providerDisclosure = provider.name === 'LBank'
  206 |     ? surface.getByRole('button', { name: /LBank/ }).first()
  207 |     : surface.getByRole('button', { name: /معرفی OneRoyal/ }).first();
  208 |   await providerDisclosure.focus();
  209 |   await expect(providerDisclosure).toBeFocused();
  210 |   await providerDisclosure.press('Enter');
  211 | 
  212 |   return {
  213 |     state,
  214 |     surface,
  215 |     surfaceId: 'mobile-profile',
  216 |     expectedOrigin: new URL(testInfo.project.use.baseURL).origin,
  217 |   };
  218 | }
  219 | 
  220 | async function assertReferralGate(page, surface, provider, expectedOrigin) {
  221 |   const region = surface.locator(`section[aria-label="لینک معرفی ${provider.name}"]`);
  222 |   await expect(region).toHaveCount(1);
  223 |   await expect(region).toBeVisible();
  224 | 
  225 |   const paragraphs = region.locator('p');
  226 |   await expect(paragraphs).toHaveCount(2);
  227 |   await expect(paragraphs.nth(0)).toHaveText(`لینک معرفی: ${DISCLOSURE}`);
  228 |   await expect(paragraphs.nth(1)).toHaveText(ELIGIBILITY);
  229 | 
  230 |   const checkbox = region.getByRole('checkbox');
  231 |   const submit = region.getByRole('button', {
  232 |     name: `لینک معرفی — ورود به وب‌سایت ${provider.name}`,
  233 |     exact: true,
  234 |   });
  235 |   const form = region.locator('form');
  236 | 
  237 |   await expect(checkbox).toHaveCount(1);
  238 |   await expect(submit).toHaveCount(1);
  239 |   await expect(submit).toBeDisabled();
  240 |   expect(await submit.evaluate((element) => ({
  241 |     tagName: element.tagName,
  242 |     type: element.type,
  243 |     nativeDisabled: element.disabled,
  244 |   }))).toEqual({ tagName: 'BUTTON', type: 'submit', nativeDisabled: true });
  245 | 
  246 |   const rawAction = await form.getAttribute('action');
  247 |   const resolvedAction = await form.evaluate((element) => element.action);
  248 |   const method = await form.getAttribute('method');
  249 |   const target = await form.getAttribute('target');
  250 |   const relTokens = (await form.getAttribute('rel') || '').split(/\s+/).filter(Boolean).sort();
  251 |   expect(rawAction, 'only the reviewed same-origin path is rendered').toBe(provider.approvedPath);
  252 |   expect(new URL(resolvedAction).origin, 'form action remains on the preview origin').toBe(expectedOrigin);
  253 |   expect(new URL(resolvedAction).pathname).toBe(provider.approvedPath);
  254 |   expect(method?.toLowerCase()).toBe('get');
  255 |   expect(target).toBe('_blank');
  256 |   expect(relTokens).toEqual(['noopener', 'noreferrer', 'sponsored']);
```