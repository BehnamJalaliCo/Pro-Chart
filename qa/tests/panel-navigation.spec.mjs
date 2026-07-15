import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const commit = process.env.BASELINE_COMMIT || 'working-tree';
const runId = process.env.PANEL_NAV_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');
const sourceFingerprint = process.env.PANEL_SOURCE_FINGERPRINT || 'unrecorded';

const legacyRedirects = [
  { from: '/signals', to: '/ai-signals' },
  { from: '/visitors', to: '/analytics' },
];

const unavailableCommands = [
  { query: 'backtest', label: 'بک‌تست' },
  { query: 'risk', label: 'مدیریت ریسک' },
  { query: 'pnl', label: 'عملکرد' },
  { query: 'heatmap', label: 'گزارش‌های پیشرفته' },
  { query: 'model', label: 'مدل‌های ML' },
  { query: 'monitor', label: 'مانیتورینگ' },
  { query: 'cms', label: 'مقالات' },
];

test('PANEL-NAV: legacy aliases resolve and unavailable palette actions stay hidden', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop command-palette contract');
  test.skip(new URL(testInfo.project.use.baseURL).hostname !== 'panel.pro-chart.com', 'Panel vhost contract runs only against panel.pro-chart.com');

  const outDir = path.join(repoRoot, 'artifacts', 'qa', 'panel-navigation', commit, runId);
  await fs.mkdir(outDir, { recursive: true });

  const expectedOrigin = new URL(testInfo.project.use.baseURL).origin;
  const unexpectedExternalRequests = [];
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error).slice(0, 1000)));

  await page.addInitScript(() => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        token: 'synthetic-panel-navigation-token',
        refreshToken: null,
        user: { role: 'admin' },
        isAuthenticated: true,
      },
      version: 0,
    }));
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === expectedOrigin) {
      await route.fallback();
      return;
    }
    unexpectedExternalRequests.push({ method: route.request().method(), origin: url.origin, pathname: url.pathname });
    await route.abort('blockedbyclient');
  });
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: '{}\n',
  }));

  const redirectResults = [];
  for (const redirect of legacyRedirects) {
    const response = await page.goto(redirect.from, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`${redirect.to.replace('/', '\\/')}$`));
    redirectResults.push({
      ...redirect,
      documentStatus: response?.status() ?? null,
      observedPath: new URL(page.url()).pathname,
    });
  }

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'جستجوی سریع' }).click();
  const input = page.locator('input[aria-label="جستجو"]');
  await expect(input).toBeFocused();

  const unavailableResults = [];
  for (const { query, label } of unavailableCommands) {
    await input.fill(query);
    const emptyVisible = await page.getByText('نتیجه‌ای یافت نشد').isVisible();
    const actionableCount = await page.getByRole('button', { name: label, exact: true }).count();
    unavailableResults.push({ query, label, actionableCount, emptyVisible });
    expect(actionableCount, `${query} must not expose the unavailable ${label} command`).toBe(0);
  }

  await input.fill('signal');
  await expect(page.getByRole('button', { name: /سیگنال‌ها/ })).toHaveCount(1);
  await input.press('Enter');
  await expect(page).toHaveURL(/\/ai-signals$/);

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'جستجوی سریع' })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[aria-label="جستجو"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('input[aria-label="جستجو"]')).toHaveCount(0);

  const ariaSnapshot = await page.locator('body').ariaSnapshot();
  await page.screenshot({ path: path.join(outDir, 'actual.png'), fullPage: true, animations: 'disabled' });
  await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${ariaSnapshot}\n`, 'utf8');
  await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify({
    schemaVersion: 1,
    requirementIds: ['PC-003', 'PC-005', 'PC-147', 'PC-159'],
    commit,
    runId,
    sourceFingerprint,
    project: testInfo.project.name,
    expectedOrigin,
    redirectResults,
    unavailableResults,
    enabledKeyboardResult: { query: 'signal', observedPath: '/ai-signals' },
    keyboardContract: { open: 'Control+k', activate: 'Enter', close: 'Escape' },
    unexpectedExternalRequests,
    pageErrors,
  }, null, 2)}\n`, 'utf8');

  expect(unexpectedExternalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
