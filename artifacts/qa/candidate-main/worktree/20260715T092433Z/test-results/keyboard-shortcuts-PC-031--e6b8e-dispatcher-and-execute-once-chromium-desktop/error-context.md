# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: keyboard-shortcuts.spec.mjs >> PC-031: Help-visible shortcuts use one dispatcher and execute once
- Location: tests/keyboard-shortcuts.spec.mjs:20:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('canvas.absolute.inset-0.z-10')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('canvas.absolute.inset-0.z-10')

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import {
  3   |   createFixtureState,
  4   |   installSyntheticFixture,
  5   |   safeError,
  6   |   waitForFinalFonts,
  7   | } from '../support/synthetic-prochart-fixture.mjs';
  8   | 
  9   | const WORKSPACE_KEY = 'bn_workspace';
  10  | 
  11  | async function drawingCount(page) {
  12  |   return page.evaluate((key) => {
  13  |     const workspace = JSON.parse(localStorage.getItem(key) || '{}');
  14  |     return Array.isArray(workspace.drawings) ? workspace.drawings.length : 0;
  15  |   }, WORKSPACE_KEY);
  16  | }
  17  | 
  18  | test.use({ trace: 'on', video: 'on' });
  19  | 
  20  | test('PC-031: Help-visible shortcuts use one dispatcher and execute once', async ({ page }, testInfo) => {
  21  |   test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop keyboard matrix');
  22  | 
  23  |   const state = createFixtureState();
  24  |   const scriptSaves = [];
  25  |   page.on('pageerror', (error) => state.pageErrors.push(safeError(error)));
  26  |   page.on('requestfailed', (request) => state.requestFailures.push({
  27  |     method: request.method(),
  28  |     pathname: new URL(request.url()).pathname,
  29  |     error: request.failure()?.errorText || 'unknown',
  30  |   }));
  31  |   page.on('response', (response) => {
  32  |     if (response.status() >= 400) state.badResponses.push({
  33  |       status: response.status(),
  34  |       pathname: new URL(response.url()).pathname,
  35  |     });
  36  |   });
  37  | 
  38  |   await installSyntheticFixture(page, testInfo, { id: 'pc-031-keyboard', onboarding: false }, state);
  39  |   // The editor path is a premium feature; the deterministic account is premium
  40  |   // only for this shortcut contract, without contacting an external service.
  41  |   await page.route('**/api/academy/me', async (route) => {
  42  |     await route.fulfill({
  43  |       status: 200,
  44  |       contentType: 'application/json; charset=utf-8',
  45  |       body: `${JSON.stringify({ id: 'pc-031-user', username: 'pc-031', tier: 'premium', status: 'active' })}\n`,
  46  |     });
  47  |   });
  48  |   await page.route('**/api/academy/bn/scripts', async (route) => {
  49  |     if (route.request().method() !== 'POST') {
  50  |       await route.fallback();
  51  |       return;
  52  |     }
  53  |     scriptSaves.push(JSON.parse(route.request().postData() || '{}'));
  54  |     await route.fulfill({
  55  |       status: 200,
  56  |       contentType: 'application/json; charset=utf-8',
  57  |       body: `${JSON.stringify({ id: 'pc-031-script' })}\n`,
  58  |     });
  59  |   });
  60  | 
  61  |   await page.goto('/', { waitUntil: 'domcontentloaded' });
  62  |   await waitForFinalFonts(page);
  63  |   const overlay = page.locator('canvas.absolute.inset-0.z-10');
> 64  |   await expect(overlay).toBeVisible();
      |                         ^ Error: expect(locator).toBeVisible() failed
  65  | 
  66  |   // The same declarative registry drives both dispatch and the visible Help.
  67  |   // Playwright requires the shifted key value (`?`) explicitly; `Shift+/`
  68  |   // reports key `/` even though a physical browser keyboard reports `?`.
  69  |   await page.keyboard.press('Shift+?');
  70  |   const helpHeading = page.getByRole('heading', { name: 'میان‌بُرهای صفحه‌کلید' });
  71  |   await expect(helpHeading).toBeVisible();
  72  |   for (const [label, chord] of [
  73  |     ['تکثیرِ آبجکتِ انتخابی', 'Ctrl+D'],
  74  |     ['جست‌وجوی نماد', 'Ctrl+K'],
  75  |     ['ذخیرهٔ اسکریپت', 'Ctrl+Shift+S'],
  76  |   ]) {
  77  |     const row = page.locator('div.flex.items-center.justify-between').filter({ hasText: label });
  78  |     await expect(row).toHaveCount(1);
  79  |     await expect(row.locator('kbd')).toHaveText(chord);
  80  |   }
  81  |   await page.keyboard.press('Escape');
  82  |   await expect(helpHeading).toBeHidden();
  83  | 
  84  |   // Ctrl+K is owned by attachHotkeys, not a second page-level listener.
  85  |   await page.keyboard.press('Control+K');
  86  |   const symbolSearch = page.getByPlaceholder('جستجوی نماد… (EURUSD، طلا، BTC)');
  87  |   await expect(symbolSearch).toHaveCount(1);
  88  |   await expect(symbolSearch).toBeVisible();
  89  |   await page.keyboard.press('Escape');
  90  |   await expect(symbolSearch).toBeHidden();
  91  | 
  92  |   // Build two independent history commands. Exact counts expose duplicate
  93  |   // Ctrl+D, Ctrl+Z, Ctrl+Y, and Delete dispatch immediately.
  94  |   const box = await overlay.boundingBox();
  95  |   expect(box).toBeTruthy();
  96  |   await page.keyboard.press('Alt+H');
  97  |   await overlay.click({ position: { x: box.width * 0.48, y: box.height * 0.42 } });
  98  |   await expect.poll(() => drawingCount(page)).toBe(1);
  99  |   await page.keyboard.press('Escape');
  100 |   await page.getByTitle('درختِ آبجکت‌ها (مدیریتِ ترسیم‌ها)').click();
  101 |   await page.getByText(/^خطِ افقی/).first().click();
  102 | 
  103 |   const historyCounts = [];
  104 |   await page.keyboard.press('Control+D');
  105 |   await expect.poll(() => drawingCount(page)).toBe(2);
  106 |   historyCounts.push(await drawingCount(page));
  107 |   await page.keyboard.press('Control+D');
  108 |   await expect.poll(() => drawingCount(page)).toBe(3);
  109 |   historyCounts.push(await drawingCount(page));
  110 |   await page.keyboard.press('Control+Z');
  111 |   await expect.poll(() => drawingCount(page)).toBe(2);
  112 |   historyCounts.push(await drawingCount(page));
  113 |   await page.keyboard.press('Control+Z');
  114 |   await expect.poll(() => drawingCount(page)).toBe(1);
  115 |   historyCounts.push(await drawingCount(page));
  116 |   await page.keyboard.press('Control+Y');
  117 |   await expect.poll(() => drawingCount(page)).toBe(2);
  118 |   historyCounts.push(await drawingCount(page));
  119 |   await page.getByText(/^خطِ افقی/).first().click();
  120 |   await page.keyboard.press('Delete');
  121 |   await expect.poll(() => drawingCount(page)).toBe(1);
  122 |   historyCounts.push(await drawingCount(page));
  123 |   expect(historyCounts).toEqual([2, 3, 2, 1, 2, 1]);
  124 | 
  125 |   // Ctrl+Shift+S must work inside the textarea (allowInInput) and use the
  126 |   // latest React state, proving that the handler is not a stale closure.
  127 |   const scriptButton = page.getByTitle('نمااسکریپت');
  128 |   await expect(scriptButton).toBeVisible();
  129 |   await scriptButton.click();
  130 |   const scriptName = page.locator('input.w-32').last();
  131 |   const editor = page.locator('textarea').last();
  132 |   await expect(editor).toBeVisible();
  133 |   await scriptName.fill('میان‌بر قطعی');
  134 |   await editor.fill('plot(close, "PC-031")');
  135 |   await editor.press('Control+Shift+S');
  136 |   await expect.poll(() => scriptSaves.length).toBe(1);
  137 |   expect(scriptSaves).toEqual([{
  138 |     name: 'میان‌بر قطعی',
  139 |     source: 'plot(close, "PC-031")',
  140 |   }]);
  141 | 
  142 |   await testInfo.attach('pc-031-keyboard-evidence', {
  143 |     body: Buffer.from(JSON.stringify({
  144 |       requirementIds: ['PC-031'],
  145 |       project: testInfo.project.name,
  146 |       visibleHelp: ['Ctrl+D', 'Ctrl+K', 'Ctrl+Shift+S'],
  147 |       historyCounts,
  148 |       scriptSaves,
  149 |       network: {
  150 |         unexpectedExternal: state.unexpectedExternal,
  151 |         unstubbed: state.unstubbed,
  152 |         pageErrors: state.pageErrors,
  153 |         requestFailures: state.requestFailures,
  154 |         badResponses: state.badResponses,
  155 |       },
  156 |     }, null, 2)),
  157 |     contentType: 'application/json',
  158 |   });
  159 | 
  160 |   expect(state.unexpectedExternal, 'external requests are forbidden').toEqual([]);
  161 |   expect(state.unstubbed, 'every API request must be deterministic').toEqual([]);
  162 |   expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  163 |   expect(state.requestFailures, 'failed requests').toEqual([]);
  164 |   expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
```