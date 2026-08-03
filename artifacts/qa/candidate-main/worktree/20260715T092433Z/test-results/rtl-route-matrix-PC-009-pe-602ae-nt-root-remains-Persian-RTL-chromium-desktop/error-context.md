# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rtl-route-matrix.spec.mjs >> PC-009: persisted English stays inside the Main app while the public document root remains Persian RTL
- Location: tests/rtl-route-matrix.spec.mjs:68:1

# Error details

```
Error: expect(locator).not.toBeEmpty() failed

Locator: locator('#root')
Expected: not empty
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "not toBeEmpty" with timeout 10000ms
  - waiting for locator('#root')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import {
  3   |   createFixtureState,
  4   |   installSyntheticFixture,
  5   | } from '../support/synthetic-prochart-fixture.mjs';
  6   | 
  7   | const USER_ROUTES = [
  8   |   '/',
  9   |   '/market',
  10  |   '/signals',
  11  |   '/trade',
  12  |   '/connect',
  13  |   '/subscription',
  14  |   '/profile',
  15  | ];
  16  | 
  17  | const PANEL_ROUTES = [
  18  |   '/dashboard',
  19  |   '/users',
  20  |   '/subscriptions',
  21  |   '/orders',
  22  |   '/exchange',
  23  |   '/ai-signals',
  24  |   '/charts',
  25  |   '/ads',
  26  |   '/news',
  27  |   '/broadcasts',
  28  |   '/analytics',
  29  |   '/settings',
  30  |   '/signals',
  31  |   '/visitors',
  32  | ];
  33  | 
  34  | function portalOrigin(name, testInfo) {
  35  |   const environmentValue = process.env[`PROCHART_${name.toUpperCase()}_BASE_URL`];
  36  |   if (environmentValue) return new URL(environmentValue).origin;
  37  | 
  38  |   const configured = new URL(testInfo.project.use.baseURL);
  39  |   if (configured.hostname === `${name}.pro-chart.com`) return configured.origin;
  40  |   return `https://${name}.pro-chart.com`;
  41  | }
  42  | 
  43  | async function verifyPersianDocumentRoutes(page, origin, paths) {
  44  |   await page.addInitScript(() => {
  45  |     localStorage.clear();
  46  |     sessionStorage.clear();
  47  |   });
  48  | 
  49  |   const results = [];
  50  |   for (const requestedPath of paths) {
  51  |     const target = new URL(requestedPath, origin);
  52  |     const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  53  |     await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0);
  54  | 
  55  |     results.push(await page.evaluate(({ path, status }) => ({
  56  |       requestedPath: path,
  57  |       documentStatus: status,
  58  |       finalOrigin: location.origin,
  59  |       finalPath: location.pathname,
  60  |       lang: document.documentElement.lang,
  61  |       dir: document.documentElement.dir,
  62  |     }), { path: requestedPath, status: response?.status() ?? null }));
  63  |   }
  64  | 
  65  |   return results;
  66  | }
  67  | 
  68  | test('PC-009: persisted English stays inside the Main app while the public document root remains Persian RTL', async ({ page }, testInfo) => {
  69  |   const fixtureState = createFixtureState();
  70  |   await installSyntheticFixture(
  71  |     page,
  72  |     testInfo,
  73  |     { id: 'pc-009-main-root', onboarding: false },
  74  |     fixtureState,
  75  |     { preserveWorkspaceOnReload: true },
  76  |   );
  77  | 
  78  |   const initialResponse = await page.goto('/', { waitUntil: 'domcontentloaded' });
  79  |   expect(initialResponse?.status()).toBe(200);
> 80  |   await expect(page.locator('#root')).not.toBeEmpty();
      |                                           ^ Error: expect(locator).not.toBeEmpty() failed
  81  | 
  82  |   await page.evaluate(() => {
  83  |     const current = JSON.parse(localStorage.getItem('pc_app_v1') || '{}');
  84  |     localStorage.setItem('pc_app_v1', JSON.stringify({ ...current, lang: 'en' }));
  85  |   });
  86  | 
  87  |   const persistedResponse = await page.reload({ waitUntil: 'domcontentloaded' });
  88  |   expect(persistedResponse?.status()).toBe(200);
  89  |   await expect(page.locator('#root')).not.toBeEmpty();
  90  | 
  91  |   const semantics = await page.evaluate(() => ({
  92  |     html: {
  93  |       lang: document.documentElement.lang,
  94  |       dir: document.documentElement.dir,
  95  |     },
  96  |     body: {
  97  |       lang: document.body.lang,
  98  |       dir: document.body.dir,
  99  |     },
  100 |     app: {
  101 |       lang: document.getElementById('root')?.lang || '',
  102 |       dir: document.getElementById('root')?.dir || '',
  103 |     },
  104 |     persistedLang: JSON.parse(localStorage.getItem('pc_app_v1') || '{}').lang,
  105 |   }));
  106 | 
  107 |   expect(semantics).toEqual({
  108 |     html: { lang: 'fa', dir: 'rtl' },
  109 |     body: { lang: 'en', dir: 'ltr' },
  110 |     app: { lang: 'en', dir: 'ltr' },
  111 |     persistedLang: 'en',
  112 |   });
  113 |   expect(fixtureState.unexpectedExternal).toEqual([]);
  114 |   expect(fixtureState.unstubbed).toEqual([]);
  115 |   expect(fixtureState.pageErrors).toEqual([]);
  116 | });
  117 | 
  118 | test('PC-009: every audited User route keeps a Persian RTL document root', async ({ page }, testInfo) => {
  119 |   const origin = portalOrigin('user', testInfo);
  120 |   const results = await verifyPersianDocumentRoutes(page, origin, USER_ROUTES);
  121 |   await testInfo.attach('user-route-status.json', {
  122 |     body: Buffer.from(`${JSON.stringify(results, null, 2)}\n`),
  123 |     contentType: 'application/json',
  124 |   });
  125 | 
  126 |   expect(results.map(({ requestedPath, documentStatus, finalOrigin, lang, dir }) => ({
  127 |     requestedPath,
  128 |     documentStatus,
  129 |     finalOrigin,
  130 |     lang,
  131 |     dir,
  132 |   }))).toEqual(USER_ROUTES.map((requestedPath) => ({
  133 |     requestedPath,
  134 |     documentStatus: 200,
  135 |     finalOrigin: origin,
  136 |     lang: 'fa',
  137 |     dir: 'rtl',
  138 |   })));
  139 | });
  140 | 
  141 | test('PC-009: every audited Panel route and legacy alias keeps a Persian RTL document root', async ({ page }, testInfo) => {
  142 |   const origin = portalOrigin('panel', testInfo);
  143 |   const results = await verifyPersianDocumentRoutes(page, origin, PANEL_ROUTES);
  144 |   await testInfo.attach('panel-route-status.json', {
  145 |     body: Buffer.from(`${JSON.stringify(results, null, 2)}\n`),
  146 |     contentType: 'application/json',
  147 |   });
  148 | 
  149 |   expect(results.map(({ requestedPath, documentStatus, finalOrigin, lang, dir }) => ({
  150 |     requestedPath,
  151 |     documentStatus,
  152 |     finalOrigin,
  153 |     lang,
  154 |     dir,
  155 |   }))).toEqual(PANEL_ROUTES.map((requestedPath) => ({
  156 |     requestedPath,
  157 |     documentStatus: 200,
  158 |     finalOrigin: origin,
  159 |     lang: 'fa',
  160 |     dir: 'rtl',
  161 |   })));
  162 | });
  163 | 
```