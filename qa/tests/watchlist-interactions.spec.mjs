import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const symbols = ['EURUSD', 'GBPUSD'];

async function bootWatchlist(page, view) {
  const writes = [];

  await page.addInitScript(({ selectedView }) => {
    localStorage.setItem('bn_watch_meta', JSON.stringify({
      lists: [{ id: 'qa-watch', name: 'QA', items: {}, sections: [] }],
      activeListId: 'qa-watch',
      view: selectedView,
      showLogo: true,
      showDesc: false,
      logoSize: 'lg',
      sortBy: 'manual',
      sortDir: 'asc',
      groupBy: 'none',
      flagFilter: null,
      columns: ['chgAbs', 'change'],
      typeCollapsed: {},
      showDetails: false,
    }));
  }, { selectedView: view });

  await page.route('**/api/academy/bn/watchlist', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({ json: { symbols } });
      return;
    }
    if (request.method() === 'PUT') {
      writes.push(request.postDataJSON());
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.abort('blockedbyclient');
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-watch-row]')).toHaveCount(symbols.length);
  return writes;
}

const row = (page, symbol) => page.locator(`[data-watch-row="${symbol}"]`);
const select = (page, symbol) => row(page, symbol).locator('[data-watch-select]');

test.beforeEach(async ({}, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'پنل واچ‌لیستِ RightPanel فقط در نمای دسکتاپ است');
});

for (const view of ['list', 'table']) {
  test(`${view}: انتخاب با ماوس و کیبورد، منوی زمینه و هندسه`, async ({ page }) => {
    const writes = await bootWatchlist(page, view);

    await select(page, 'GBPUSD').click();
    await expect(select(page, 'GBPUSD')).toHaveAttribute('aria-current', 'true');

    await select(page, 'EURUSD').focus();
    await select(page, 'EURUSD').press('Enter');
    await expect(select(page, 'EURUSD')).toHaveAttribute('aria-current', 'true');

    await select(page, 'GBPUSD').focus();
    await select(page, 'GBPUSD').press('Space');
    await expect(select(page, 'GBPUSD')).toHaveAttribute('aria-current', 'true');

    const target = row(page, 'EURUSD');
    const before = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    await target.hover();
    const after = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    expect(after).toEqual(before);
    expect(after.height).toBe(36);

    await select(page, 'EURUSD').click({ button: 'right' });
    await expect(page.getByRole('button', { name: 'بازکردن روی چارت' })).toBeVisible();
    await expect(select(page, 'GBPUSD')).toHaveAttribute('aria-current', 'true');
    expect(writes).toEqual([]);

    const axe = await new AxeBuilder({ page })
      .include('[data-watch-row]')
      .withRules(['nested-interactive'])
      .analyze();
    expect(axe.violations).toEqual([]);
  });

  test(`${view}: پرچم و حذف، ردیف را انتخاب نمی‌کنند`, async ({ page }) => {
    const writes = await bootWatchlist(page, view);

    await select(page, 'GBPUSD').click();
    const eur = row(page, 'EURUSD');
    await eur.hover();

    await eur.getByRole('button', { name: 'پرچمِ تفکیک' }).click();
    await expect(eur.getByRole('group', { name: /رنگ پرچم/ })).toBeVisible();
    await eur.getByRole('button', { name: 'پرچم red' }).click();

    await expect(select(page, 'GBPUSD')).toHaveAttribute('aria-current', 'true');
    expect(writes).toEqual([]);
    await expect.poll(() => page.evaluate(() => {
      const meta = JSON.parse(localStorage.getItem('bn_watch_meta'));
      const active = meta.lists.find((item) => item.id === meta.activeListId);
      return active.items.EURUSD?.flag;
    })).toBe('red');

    await eur.hover();
    const put = page.waitForRequest((request) => (
      request.method() === 'PUT'
      && new URL(request.url()).pathname === '/api/academy/bn/watchlist'
    ));
    await eur.getByRole('button', { name: 'حذف از واچ‌لیست' }).click();

    expect((await put).postDataJSON()).toEqual({ symbols: ['GBPUSD'] });
    await expect(eur).toHaveCount(0);
    await expect(select(page, 'GBPUSD')).toHaveAttribute('aria-current', 'true');
  });
}
