# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: referral-compliance.spec.mjs >> REFERRAL-COMPLIANCE: LBank gate is disclosed, acknowledged, and same-origin
- Location: tests/referral-compliance.spec.mjs:315:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.focus: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'پروفایل', exact: true })

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e6]:
    - img [ref=e8]
    - generic [ref=e11]:
      - generic [ref=e12]: Pro·Chart
      - generic [ref=e13]: پلتفرمِ تریدِ بازارنما
  - generic [ref=e16]:
    - generic [ref=e18]:
      - img [ref=e20]
      - generic [ref=e23]:
        - generic [ref=e24]: Pro·Chart
        - generic [ref=e25]: پلتفرمِ تریدِ بازارنما
    - generic [ref=e26]:
      - generic [ref=e27]: ورود به حساب
      - generic [ref=e28]: برای ادامه وارد شو.
    - generic [ref=e29]:
      - button "ورود" [ref=e31] [cursor=pointer]
      - button "ثبت‌نام" [ref=e32] [cursor=pointer]
    - generic [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]: ایمیل یا نام‌کاربری
        - textbox "ایمیل یا نام‌کاربری" [ref=e36]:
          - /placeholder: example@mail.com
      - generic [ref=e37]:
        - generic [ref=e38]: رمزِ عبور
        - generic [ref=e39]:
          - textbox "رمزِ عبور نمایشِ رمزِ عبور" [ref=e40]:
            - /placeholder: ••••••••
          - button "نمایشِ رمزِ عبور" [ref=e41] [cursor=pointer]:
            - img [ref=e42]
      - button "ورود به پنل" [disabled] [ref=e45]
      - button "رمزت را فراموش کرده‌ای؟" [ref=e46] [cursor=pointer]
    - generic [ref=e47]:
      - generic [ref=e48]: کمک لازم داری؟
      - link "پشتیبانی" [ref=e49] [cursor=pointer]:
        - /url: https://t.me/CoinePro_Admin
        - img [ref=e50]
        - text: پشتیبانی
  - generic [ref=e53]: © Pro·Chart — بازارنما · تریدِ واقعیِ کریپتو و فارکس
```

# Test source

```ts
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
  156 |   const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
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
> 195 |   await profileTab.focus();
      |                    ^ Error: locator.focus: Test timeout of 60000ms exceeded.
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
  257 | 
  258 |   const disclosureOrder = await region.evaluate((element) => {
  259 |     const [disclosure, eligibility] = element.querySelectorAll('p');
  260 |     const outboundForm = element.querySelector('form');
  261 |     return {
  262 |       disclosureBeforeEligibility: Boolean(disclosure?.compareDocumentPosition(eligibility) & Node.DOCUMENT_POSITION_FOLLOWING),
  263 |       disclosureBeforeForm: Boolean(disclosure?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING),
  264 |       eligibilityBeforeForm: Boolean(eligibility?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING),
  265 |     };
  266 |   });
  267 |   expect(disclosureOrder).toEqual({
  268 |     disclosureBeforeEligibility: true,
  269 |     disclosureBeforeForm: true,
  270 |     eligibilityBeforeForm: true,
  271 |   });
  272 | 
  273 |   await checkbox.focus();
  274 |   await expect(checkbox).toBeFocused();
  275 |   await checkbox.press('Space');
  276 |   await expect(checkbox).toBeChecked();
  277 |   await expect(submit).toBeEnabled();
  278 | 
  279 |   const directProviderLinks = await surface.locator('a[href], form[action]').evaluateAll((elements, source) => elements
  280 |     .map((element) => ({
  281 |       tagName: element.tagName,
  282 |       raw: element.getAttribute(element.tagName === 'FORM' ? 'action' : 'href'),
  283 |       resolved: element.tagName === 'FORM' ? element.action : element.href,
  284 |     }))
  285 |     .filter(({ resolved }) => {
  286 |       try {
  287 |         return new RegExp(source).test(new URL(resolved).hostname);
  288 |       } catch {
  289 |         return false;
  290 |       }
  291 |     }), provider.directHostPattern.source);
  292 |   expect(directProviderLinks, `no direct ${provider.name} target may bypass the gate`).toEqual([]);
  293 | 
  294 |   const windowOpenCalls = await page.evaluate(() => window.__referralQaWindowOpenCalls || []);
  295 |   expect(windowOpenCalls, 'the reachable surface must not call window.open before acknowledgement').toEqual([]);
```