import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('A11Y-STATE: mobile chart after onboarding has a named main region', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'این state مخصوص shell موبایل است');

  const mutatingRequests = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      mutatingRequests.push({ method: request.method(), pathname: new URL(request.url()).pathname });
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem('pc_onboarded_v1', '1');
  });

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.pc-launch')).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const axe = await new AxeBuilder({ page })
    .withRules(['landmark-one-main', 'page-has-heading-one', 'region'])
    .analyze();

  expect(response?.status()).toBe(200);
  expect(axe.violations).toEqual([]);
  expect(mutatingRequests.filter(({ method, pathname }) => (
    !(method === 'POST' && pathname === '/api/academy/auth/bn-guest')
  ))).toEqual([]);
});
