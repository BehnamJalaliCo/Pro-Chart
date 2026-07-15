import { test, expect } from '@playwright/test';
import {
  createFixtureState,
  installSyntheticFixture,
  safeError,
  waitForFinalFonts,
} from '../support/synthetic-prochart-fixture.mjs';

const WORKSPACE_KEY = 'bn_workspace';

async function drawingCount(page) {
  return page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key) || '{}');
    return Array.isArray(workspace.drawings) ? workspace.drawings.length : 0;
  }, WORKSPACE_KEY);
}

test.use({ trace: 'on', video: 'on' });

test('PC-031: Help-visible shortcuts use one dispatcher and execute once', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop keyboard matrix');

  const state = createFixtureState();
  const scriptSaves = [];
  page.on('pageerror', (error) => state.pageErrors.push(safeError(error)));
  page.on('requestfailed', (request) => state.requestFailures.push({
    method: request.method(),
    pathname: new URL(request.url()).pathname,
    error: request.failure()?.errorText || 'unknown',
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) state.badResponses.push({
      status: response.status(),
      pathname: new URL(response.url()).pathname,
    });
  });

  await installSyntheticFixture(page, testInfo, { id: 'pc-031-keyboard', onboarding: false }, state);
  // The editor path is a premium feature; the deterministic account is premium
  // only for this shortcut contract, without contacting an external service.
  await page.route('**/api/academy/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: `${JSON.stringify({ id: 'pc-031-user', username: 'pc-031', tier: 'premium', status: 'active' })}\n`,
    });
  });
  await page.route('**/api/academy/bn/scripts', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    scriptSaves.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: `${JSON.stringify({ id: 'pc-031-script' })}\n`,
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFinalFonts(page);
  const overlay = page.locator('canvas.absolute.inset-0.z-10');
  await expect(overlay).toBeVisible();

  // The same declarative registry drives both dispatch and the visible Help.
  // Playwright requires the shifted key value (`?`) explicitly; `Shift+/`
  // reports key `/` even though a physical browser keyboard reports `?`.
  await page.keyboard.press('Shift+?');
  const helpHeading = page.getByRole('heading', { name: 'میان‌بُرهای صفحه‌کلید' });
  await expect(helpHeading).toBeVisible();
  for (const [label, chord] of [
    ['تکثیرِ آبجکتِ انتخابی', 'Ctrl+D'],
    ['جست‌وجوی نماد', 'Ctrl+K'],
    ['ذخیرهٔ اسکریپت', 'Ctrl+Shift+S'],
  ]) {
    const row = page.locator('div.flex.items-center.justify-between').filter({ hasText: label });
    await expect(row).toHaveCount(1);
    await expect(row.locator('kbd')).toHaveText(chord);
  }
  await page.keyboard.press('Escape');
  await expect(helpHeading).toBeHidden();

  // Ctrl+K is owned by attachHotkeys, not a second page-level listener.
  await page.keyboard.press('Control+K');
  const symbolSearch = page.getByPlaceholder('جستجوی نماد… (EURUSD، طلا، BTC)');
  await expect(symbolSearch).toHaveCount(1);
  await expect(symbolSearch).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(symbolSearch).toBeHidden();

  // Build two independent history commands. Exact counts expose duplicate
  // Ctrl+D, Ctrl+Z, Ctrl+Y, and Delete dispatch immediately.
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  await page.keyboard.press('Alt+H');
  await overlay.click({ position: { x: box.width * 0.48, y: box.height * 0.42 } });
  await expect.poll(() => drawingCount(page)).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByTitle('درختِ آبجکت‌ها (مدیریتِ ترسیم‌ها)').click();
  await page.getByText(/^خطِ افقی/).first().click();

  const historyCounts = [];
  await page.keyboard.press('Control+D');
  await expect.poll(() => drawingCount(page)).toBe(2);
  historyCounts.push(await drawingCount(page));
  await page.keyboard.press('Control+D');
  await expect.poll(() => drawingCount(page)).toBe(3);
  historyCounts.push(await drawingCount(page));
  await page.keyboard.press('Control+Z');
  await expect.poll(() => drawingCount(page)).toBe(2);
  historyCounts.push(await drawingCount(page));
  await page.keyboard.press('Control+Z');
  await expect.poll(() => drawingCount(page)).toBe(1);
  historyCounts.push(await drawingCount(page));
  await page.keyboard.press('Control+Y');
  await expect.poll(() => drawingCount(page)).toBe(2);
  historyCounts.push(await drawingCount(page));
  await page.getByText(/^خطِ افقی/).first().click();
  await page.keyboard.press('Delete');
  await expect.poll(() => drawingCount(page)).toBe(1);
  historyCounts.push(await drawingCount(page));
  expect(historyCounts).toEqual([2, 3, 2, 1, 2, 1]);

  // Ctrl+Shift+S must work inside the textarea (allowInInput) and use the
  // latest React state, proving that the handler is not a stale closure.
  const scriptButton = page.getByTitle('نمااسکریپت');
  await expect(scriptButton).toBeVisible();
  await scriptButton.click();
  const scriptName = page.locator('input.w-32').last();
  const editor = page.locator('textarea').last();
  await expect(editor).toBeVisible();
  await scriptName.fill('میان‌بر قطعی');
  await editor.fill('plot(close, "PC-031")');
  await editor.press('Control+Shift+S');
  await expect.poll(() => scriptSaves.length).toBe(1);
  expect(scriptSaves).toEqual([{
    name: 'میان‌بر قطعی',
    source: 'plot(close, "PC-031")',
  }]);

  await testInfo.attach('pc-031-keyboard-evidence', {
    body: Buffer.from(JSON.stringify({
      requirementIds: ['PC-031'],
      project: testInfo.project.name,
      visibleHelp: ['Ctrl+D', 'Ctrl+K', 'Ctrl+Shift+S'],
      historyCounts,
      scriptSaves,
      network: {
        unexpectedExternal: state.unexpectedExternal,
        unstubbed: state.unstubbed,
        pageErrors: state.pageErrors,
        requestFailures: state.requestFailures,
        badResponses: state.badResponses,
      },
    }, null, 2)),
    contentType: 'application/json',
  });

  expect(state.unexpectedExternal, 'external requests are forbidden').toEqual([]);
  expect(state.unstubbed, 'every API request must be deterministic').toEqual([]);
  expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  expect(state.requestFailures, 'failed requests').toEqual([]);
  expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
});
