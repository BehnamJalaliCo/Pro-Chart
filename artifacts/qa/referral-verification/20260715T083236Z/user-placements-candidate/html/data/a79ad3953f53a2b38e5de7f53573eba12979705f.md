# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-referral-placement-matrix.spec.mjs >> USER-REFERRAL-PLACEMENT: /trade broker
- Location: tests/user-referral-placement-matrix.spec.mjs:125:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://user.pro-chart.com:18081/trade
Call log:
  - navigating to "http://user.pro-chart.com:18081/trade", waiting until "domcontentloaded"

```

# Test source

```ts
  33  | }
  34  | 
  35  | async function installPlacementFixture(page, expectedOrigin, account) {
  36  |   const state = {
  37  |     apiRequests: [],
  38  |     badResponses: [],
  39  |     pageErrors: [],
  40  |     requestFailures: [],
  41  |     unexpectedExternal: [],
  42  |     unstubbed: [],
  43  |   };
  44  | 
  45  |   page.on('pageerror', (error) => state.pageErrors.push(String(error?.message || error).slice(0, 1000)));
  46  |   page.on('requestfailed', (request) => state.requestFailures.push({
  47  |     method: request.method(),
  48  |     pathname: new URL(request.url()).pathname,
  49  |     error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
  50  |   }));
  51  |   page.on('response', (response) => {
  52  |     if (response.status() >= 400) {
  53  |       state.badResponses.push({ status: response.status(), pathname: new URL(response.url()).pathname });
  54  |     }
  55  |   });
  56  | 
  57  |   await page.addInitScript(() => {
  58  |     localStorage.clear();
  59  |     localStorage.setItem('cp_academy_token', 'synthetic-user-placement-token');
  60  |   });
  61  | 
  62  |   await page.route('**/*', async (route) => {
  63  |     const url = new URL(route.request().url());
  64  |     if (url.origin === expectedOrigin) {
  65  |       await route.fallback();
  66  |       return;
  67  |     }
  68  |     state.unexpectedExternal.push({
  69  |       method: route.request().method(),
  70  |       origin: url.origin,
  71  |       pathname: url.pathname,
  72  |     });
  73  |     await route.abort('blockedbyclient');
  74  |   });
  75  | 
  76  |   await page.route('**/api/**', async (route) => {
  77  |     const request = route.request();
  78  |     const url = new URL(request.url());
  79  |     const key = `${request.method()} ${url.pathname}`;
  80  |     state.apiRequests.push(key);
  81  | 
  82  |     const bodies = new Map([
  83  |       ['GET /api/academy/me', overviewFor(account.accountType).profile],
  84  |       ['GET /api/academy/bn/overview', overviewFor(account.accountType)],
  85  |       ['GET /api/academy/bn/ai-signal/quota', { used: 0, remaining: 0, limit: 0 }],
  86  |       ['GET /api/academy/bn/watchlist', { symbols: [] }],
  87  |       ['GET /api/academy/bn/news', { items: [] }],
  88  |       ['GET /api/academy/bn/connect/status', {
  89  |         account_type: account.accountType,
  90  |         accounts: { lbank: null },
  91  |       }],
  92  |       ['GET /api/academy/bn/my-orders', { items: [] }],
  93  |       ['GET /api/academy/pricing', {
  94  |         currency: 'USDT',
  95  |         network: 'BEP-20 (BSC)',
  96  |         wallet: '',
  97  |         tiers: [],
  98  |       }],
  99  |       ['GET /api/academy/bn/referral-link', {
  100 |         account_type: account.accountType,
  101 |         broker: account.provider,
  102 |         referral_only: account.provider === 'OneRoyal',
  103 |         url: account.approvedPath,
  104 |       }],
  105 |     ]);
  106 | 
  107 |     if (bodies.has(key)) {
  108 |       await route.fulfill({
  109 |         status: 200,
  110 |         contentType: 'application/json; charset=utf-8',
  111 |         body: `${JSON.stringify(bodies.get(key))}\n`,
  112 |       });
  113 |       return;
  114 |     }
  115 | 
  116 |     state.unstubbed.push(key);
  117 |     await route.abort('blockedbyclient');
  118 |   });
  119 | 
  120 |   return state;
  121 | }
  122 | 
  123 | for (const routeCase of routes) {
  124 |   for (const account of accounts) {
  125 |     test(`USER-REFERRAL-PLACEMENT: ${routeCase.pathname} ${account.accountType}`, async ({ page }, testInfo) => {
  126 |       test.skip(
  127 |         new URL(testInfo.project.use.baseURL).hostname !== 'user.pro-chart.com',
  128 |         'User Portal placement matrix runs only against the canonical user.pro-chart.com vhost',
  129 |       );
  130 | 
  131 |       const target = new URL(routeCase.pathname, testInfo.project.use.baseURL);
  132 |       const state = await installPlacementFixture(page, target.origin, account);
> 133 |       const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
      |                                   ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://user.pro-chart.com:18081/trade
  134 | 
  135 |       expect(response?.status()).toBe(200);
  136 |       await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === routeCase.pathname);
  137 |       await expect(page.getByRole('heading', { name: routeCase.heading, exact: true })).toBeVisible();
  138 | 
  139 |       const surface = page.locator('main');
  140 |       const allGates = surface.locator('section[aria-label^="لینک معرفی "]');
  141 |       const expectedGate = account.accountType === 'crypto' ? routeCase.cryptoGate : routeCase.brokerGate;
  142 |       await expect(allGates).toHaveCount(expectedGate ? 1 : 0);
  143 | 
  144 |       const approvedGate = surface.locator(`section[aria-label="لینک معرفی ${account.provider}"]`);
  145 |       const otherProvider = account.provider === 'LBank' ? 'OneRoyal' : 'LBank';
  146 |       await expect(surface.locator(`section[aria-label="لینک معرفی ${otherProvider}"]`)).toHaveCount(0);
  147 | 
  148 |       if (expectedGate) {
  149 |         await expect(approvedGate).toHaveCount(1);
  150 |         await expect(approvedGate.locator('p').nth(0)).toHaveText(`لینک معرفی: ${DISCLOSURE}`);
  151 |         await expect(approvedGate.locator('p').nth(1)).toHaveText(ELIGIBILITY);
  152 | 
  153 |         const checkbox = approvedGate.getByRole('checkbox');
  154 |         const submit = approvedGate.getByRole('button', {
  155 |           name: `لینک معرفی — ورود به وب‌سایت ${account.provider}`,
  156 |           exact: true,
  157 |         });
  158 |         const form = approvedGate.locator('form');
  159 |         await expect(checkbox).toHaveCount(1);
  160 |         await expect(submit).toBeDisabled();
  161 |         expect(await form.evaluate((element) => ({
  162 |           method: element.method,
  163 |           origin: new URL(element.action).origin,
  164 |           pathname: new URL(element.action).pathname,
  165 |           rel: element.rel.split(/\s+/).filter(Boolean).sort(),
  166 |           target: element.target,
  167 |         }))).toEqual({
  168 |           method: 'get',
  169 |           origin: target.origin,
  170 |           pathname: account.approvedPath,
  171 |           rel: ['noopener', 'noreferrer', 'sponsored'],
  172 |           target: '_blank',
  173 |         });
  174 |       }
  175 | 
  176 |       expect([...new Set(state.apiRequests)].sort()).not.toEqual([]);
  177 |       expect(state.unstubbed).toEqual([]);
  178 |       expect(state.unexpectedExternal).toEqual([]);
  179 |       expect(state.badResponses).toEqual([]);
  180 |       expect(state.pageErrors).toEqual([]);
  181 |       expect(state.requestFailures).toEqual([]);
  182 | 
  183 |       await testInfo.attach('user-referral-placement.json', {
  184 |         body: Buffer.from(`${JSON.stringify({
  185 |           schemaVersion: 1,
  186 |           route: routeCase.pathname,
  187 |           project: testInfo.project.name,
  188 |           accountType: account.accountType,
  189 |           expectedGate,
  190 |           provider: account.provider,
  191 |           approvedPath: account.approvedPath,
  192 |           apiRequests: [...new Set(state.apiRequests)].sort(),
  193 |         }, null, 2)}\n`),
  194 |         contentType: 'application/json; charset=utf-8',
  195 |       });
  196 |     });
  197 |   }
  198 | }
  199 | 
```