import { test, expect } from '@playwright/test';

const DISCLOSURE = 'با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.';
const ELIGIBILITY = 'ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.';

const accounts = [
  { accountType: 'crypto', provider: 'LBank', approvedPath: '/go/lbank' },
  { accountType: 'broker', provider: 'OneRoyal', approvedPath: '/go/oneroyal' },
];

const routes = [
  { pathname: '/', heading: 'کاربر آزمون معرفی', cryptoGate: false, brokerGate: true },
  { pathname: '/connect', heading: 'اتصال LBank و معرفی OneRoyal', cryptoGate: true, brokerGate: true },
  { pathname: '/trade', heading: 'معاملات', cryptoGate: false, brokerGate: true },
  { pathname: '/subscription', heading: 'اشتراک و صورت‌حساب', cryptoGate: true, brokerGate: true },
];

function overviewFor(accountType) {
  return {
    profile: {
      accountType,
      account_type: accountType,
      fullName: 'کاربر آزمون معرفی',
      full_name: 'کاربر آزمون معرفی',
      tier: 'premium',
      username: 'user-referral-qa',
    },
    connections: [],
    counts: {},
    recentOrders: [],
    aiSignalsActive: 0,
  };
}

async function installPlacementFixture(page, expectedOrigin, account) {
  const state = {
    apiRequests: [],
    badResponses: [],
    pageErrors: [],
    requestFailures: [],
    unexpectedExternal: [],
    unstubbed: [],
  };

  page.on('pageerror', (error) => state.pageErrors.push(String(error?.message || error).slice(0, 1000)));
  page.on('requestfailed', (request) => state.requestFailures.push({
    method: request.method(),
    pathname: new URL(request.url()).pathname,
    error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      state.badResponses.push({ status: response.status(), pathname: new URL(response.url()).pathname });
    }
  });

  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('cp_academy_token', 'synthetic-user-placement-token');
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === expectedOrigin) {
      await route.fallback();
      return;
    }
    state.unexpectedExternal.push({
      method: route.request().method(),
      origin: url.origin,
      pathname: url.pathname,
    });
    await route.abort('blockedbyclient');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    state.apiRequests.push(key);

    const bodies = new Map([
      ['GET /api/academy/me', overviewFor(account.accountType).profile],
      ['GET /api/academy/bn/overview', overviewFor(account.accountType)],
      ['GET /api/academy/bn/ai-signal/quota', { used: 0, remaining: 0, limit: 0 }],
      ['GET /api/academy/bn/watchlist', { symbols: [] }],
      ['GET /api/academy/bn/news', { items: [] }],
      ['GET /api/academy/bn/connect/status', {
        account_type: account.accountType,
        accounts: { lbank: null },
      }],
      ['GET /api/academy/bn/my-orders', { items: [] }],
      ['GET /api/academy/pricing', {
        currency: 'USDT',
        network: 'BEP-20 (BSC)',
        wallet: '',
        tiers: [],
      }],
      ['GET /api/academy/bn/referral-link', {
        account_type: account.accountType,
        broker: account.provider,
        referral_only: account.provider === 'OneRoyal',
        url: account.approvedPath,
      }],
    ]);

    if (bodies.has(key)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: `${JSON.stringify(bodies.get(key))}\n`,
      });
      return;
    }

    state.unstubbed.push(key);
    await route.abort('blockedbyclient');
  });

  return state;
}

for (const routeCase of routes) {
  for (const account of accounts) {
    test(`USER-REFERRAL-PLACEMENT: ${routeCase.pathname} ${account.accountType}`, async ({ page }, testInfo) => {
      test.skip(
        new URL(testInfo.project.use.baseURL).hostname !== 'user.pro-chart.com',
        'User Portal placement matrix runs only against the canonical user.pro-chart.com vhost',
      );

      const target = new URL(routeCase.pathname, testInfo.project.use.baseURL);
      const state = await installPlacementFixture(page, target.origin, account);
      const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });

      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === routeCase.pathname);
      await expect(page.getByRole('heading', { name: routeCase.heading, exact: true })).toBeVisible();

      const surface = page.locator('main');
      const allGates = surface.locator('section[aria-label^="لینک معرفی "]');
      const expectedGate = account.accountType === 'crypto' ? routeCase.cryptoGate : routeCase.brokerGate;
      await expect(allGates).toHaveCount(expectedGate ? 1 : 0);

      const approvedGate = surface.locator(`section[aria-label="لینک معرفی ${account.provider}"]`);
      const otherProvider = account.provider === 'LBank' ? 'OneRoyal' : 'LBank';
      await expect(surface.locator(`section[aria-label="لینک معرفی ${otherProvider}"]`)).toHaveCount(0);

      if (expectedGate) {
        await expect(approvedGate).toHaveCount(1);
        await expect(approvedGate.locator('p').nth(0)).toHaveText(`لینک معرفی: ${DISCLOSURE}`);
        await expect(approvedGate.locator('p').nth(1)).toHaveText(ELIGIBILITY);

        const checkbox = approvedGate.getByRole('checkbox');
        const submit = approvedGate.getByRole('button', {
          name: `لینک معرفی — ورود به وب‌سایت ${account.provider}`,
          exact: true,
        });
        const form = approvedGate.locator('form');
        await expect(checkbox).toHaveCount(1);
        await expect(submit).toBeDisabled();
        expect(await form.evaluate((element) => ({
          method: element.method,
          origin: new URL(element.action).origin,
          pathname: new URL(element.action).pathname,
          rel: element.rel.split(/\s+/).filter(Boolean).sort(),
          target: element.target,
        }))).toEqual({
          method: 'get',
          origin: target.origin,
          pathname: account.approvedPath,
          rel: ['noopener', 'noreferrer', 'sponsored'],
          target: '_blank',
        });
      }

      expect([...new Set(state.apiRequests)].sort()).not.toEqual([]);
      expect(state.unstubbed).toEqual([]);
      expect(state.unexpectedExternal).toEqual([]);
      expect(state.badResponses).toEqual([]);
      expect(state.pageErrors).toEqual([]);
      expect(state.requestFailures).toEqual([]);

      await testInfo.attach('user-referral-placement.json', {
        body: Buffer.from(`${JSON.stringify({
          schemaVersion: 1,
          route: routeCase.pathname,
          project: testInfo.project.name,
          accountType: account.accountType,
          expectedGate,
          provider: account.provider,
          approvedPath: account.approvedPath,
          apiRequests: [...new Set(state.apiRequests)].sort(),
        }, null, 2)}\n`),
        contentType: 'application/json; charset=utf-8',
      });
    });
  }
}
