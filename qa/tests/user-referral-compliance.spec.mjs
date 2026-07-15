import { test, expect } from '@playwright/test';

const DISCLOSURE = 'با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.';
const ELIGIBILITY = 'ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.';

const providers = [
  {
    name: 'LBank',
    accountType: 'crypto',
    approvedPath: '/go/lbank',
    untrustedReferralUrl: 'https://www.lbank.com/synthetic-referral-qa',
    directHostPattern: /(^|\.)lbank\.com$/i,
  },
  {
    name: 'OneRoyal',
    accountType: 'broker',
    approvedPath: '/go/oneroyal',
    untrustedReferralUrl: 'https://my.oneroyal.com/synthetic-referral-qa',
    directHostPattern: /(^|\.)oneroyal\.com$/i,
  },
];

function connectUrl(baseURL) {
  const target = new URL(baseURL);
  target.pathname = '/connect';
  target.search = '';
  target.hash = '';
  return target;
}

async function installUserPortalFixture(page, expectedOrigin, provider) {
  const state = {
    apiRequests: [],
    badResponses: [],
    pageErrors: [],
    popups: [],
    requestFailures: [],
    unexpectedExternal: [],
    unstubbed: [],
  };

  page.on('pageerror', (error) => {
    state.pageErrors.push(String(error?.message || error).slice(0, 1000));
  });
  page.on('popup', (popup) => {
    state.popups.push(popup.url());
  });
  page.on('requestfailed', (request) => {
    state.requestFailures.push({
      method: request.method(),
      url: request.url(),
      error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      state.badResponses.push({ status: response.status(), url: response.url() });
    }
  });

  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('cp_academy_token', 'synthetic-user-referral-qa-token');

    const calls = [];
    Object.defineProperty(window, '__userReferralQaWindowOpenCalls', {
      configurable: false,
      enumerable: false,
      value: calls,
      writable: false,
    });
    window.open = (...args) => {
      calls.push({
        url: args[0] == null ? null : String(args[0]),
        target: args[1] == null ? null : String(args[1]),
      });
      return null;
    };
  });

  // Register the broad origin guard first: Playwright evaluates the newer,
  // API-specific route before it and falls back here only for other traffic.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === expectedOrigin) {
      await route.fallback();
      return;
    }

    state.unexpectedExternal.push({
      method: request.method(),
      origin: url.origin,
      pathname: url.pathname,
    });
    await route.abort('blockedbyclient');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;

    if (url.origin !== expectedOrigin) {
      state.unexpectedExternal.push({
        method: request.method(),
        origin: url.origin,
        pathname: url.pathname,
      });
      await route.abort('blockedbyclient');
      return;
    }

    state.apiRequests.push({
      key,
      bearerTokenPresent: request.headers().authorization === 'Bearer synthetic-user-referral-qa-token',
    });

    const fulfill = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: `${JSON.stringify(body)}\n`,
    });

    if (key === 'GET /api/academy/bn/overview') {
      await fulfill({
        profile: {
          accountType: provider.accountType,
          account_type: provider.accountType,
          fullName: 'کاربر آزمون معرفی',
          tier: 'premium',
          username: 'user-referral-qa',
        },
      });
      return;
    }
    if (key === 'GET /api/academy/bn/connect/status') {
      await fulfill({
        account_type: provider.accountType,
        accounts: { lbank: null },
      });
      return;
    }
    if (key === 'GET /api/academy/bn/referral-link') {
      // Deliberately return an unreviewed external candidate. The UI must map
      // it to the provider's fixed same-origin /go path before rendering.
      await fulfill({
        broker: provider.name,
        referral_only: provider.name === 'OneRoyal',
        url: provider.untrustedReferralUrl,
      });
      return;
    }

    state.unstubbed.push(key);
    await route.abort('blockedbyclient');
  });

  return state;
}

async function assertReferralGate(page, surface, expectedOrigin, provider) {
  const region = surface.locator(`section[aria-label="لینک معرفی ${provider.name}"]`);
  await expect(region).toHaveCount(1);
  await expect(region).toBeVisible();

  const paragraphs = region.locator('p');
  await expect(paragraphs).toHaveCount(2);
  await expect(paragraphs.nth(0)).toHaveText(`لینک معرفی: ${DISCLOSURE}`);
  await expect(paragraphs.nth(1)).toHaveText(ELIGIBILITY);

  const checkbox = region.getByRole('checkbox');
  const submit = region.getByRole('button', {
    name: `لینک معرفی — ورود به وب‌سایت ${provider.name}`,
    exact: true,
  });
  const form = region.locator('form');

  await expect(checkbox).toHaveCount(1);
  await expect(submit).toHaveCount(1);
  await expect(submit).toBeDisabled();
  expect(await submit.evaluate((element) => ({
    disabled: element.disabled,
    tagName: element.tagName,
    type: element.type,
  }))).toEqual({ disabled: true, tagName: 'BUTTON', type: 'submit' });

  const formContract = await form.evaluate((element) => ({
    method: element.getAttribute('method'),
    rawAction: element.getAttribute('action'),
    rel: (element.getAttribute('rel') || '').split(/\s+/).filter(Boolean).sort(),
    resolvedAction: element.action,
    target: element.getAttribute('target'),
  }));
  expect(formContract.rawAction).toBe(provider.approvedPath);
  expect(new URL(formContract.resolvedAction).origin).toBe(expectedOrigin);
  expect(new URL(formContract.resolvedAction).pathname).toBe(provider.approvedPath);
  expect(formContract.method?.toLowerCase()).toBe('get');
  expect(formContract.target).toBe('_blank');
  expect(formContract.rel).toEqual(['noopener', 'noreferrer', 'sponsored']);

  const disclosureOrder = await region.evaluate((element) => {
    const [disclosure, eligibility] = element.querySelectorAll('p');
    const outboundForm = element.querySelector('form');
    return {
      disclosureBeforeEligibility: Boolean(
        disclosure?.compareDocumentPosition(eligibility) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      disclosureBeforeForm: Boolean(
        disclosure?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      eligibilityBeforeForm: Boolean(
        eligibility?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
    };
  });
  expect(disclosureOrder).toEqual({
    disclosureBeforeEligibility: true,
    disclosureBeforeForm: true,
    eligibilityBeforeForm: true,
  });

  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  await checkbox.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(submit).toBeEnabled();
  expect(await submit.evaluate((element) => element.disabled)).toBe(false);

  const renderedTargets = await surface.locator('a[href], form[action]').evaluateAll((elements) => elements.map((element) => ({
    raw: element.getAttribute(element.tagName === 'FORM' ? 'action' : 'href'),
    resolved: element.tagName === 'FORM' ? element.action : element.href,
    tagName: element.tagName,
  })));
  const directProviderTargets = renderedTargets.filter(({ resolved }) => {
    try {
      return provider.directHostPattern.test(new URL(resolved).hostname);
    } catch {
      return false;
    }
  });
  expect(directProviderTargets, `no direct ${provider.name} target may bypass /go`).toEqual([]);
  expect(await surface.innerHTML()).not.toContain(provider.untrustedReferralUrl);
  expect(await page.evaluate(() => window.__userReferralQaWindowOpenCalls || [])).toEqual([]);
  await expect(page).toHaveURL((url) => url.origin === expectedOrigin && url.pathname === '/connect');

  return { disclosureOrder, formContract, renderedTargets };
}

async function assertBrokerIsReferralOnly(surface) {
  await expect(surface.getByText('OneRoyal — فقط معرفی', { exact: true })).toBeVisible();
  await expect(surface.locator('input:not([type="checkbox"]), textarea, select')).toHaveCount(0);
  await expect(surface.locator('form')).toHaveCount(1);
  await expect(surface.getByRole('button', {
    name: /اتصال.*(?:MT5|حساب|صرافی)|ثبت.*سفارش|خرید|فروش/,
  })).toHaveCount(0);
  await expect(surface.locator('form[action*="connect"], form[action*="order"]')).toHaveCount(0);
}

async function assertCryptoKeepsLBankCredentials(surface) {
  await expect(surface.getByText('صرافیِ LBank', { exact: true })).toBeVisible();
  await expect(surface.locator('input[placeholder="API Key"][type="password"]')).toHaveCount(1);
  await expect(surface.locator('input[placeholder="API Secret"][type="password"]')).toHaveCount(1);
  await expect(surface.locator('input[placeholder="UID"]')).toHaveCount(1);
  await expect(surface.getByRole('button', { name: /اتصال.*صرافی/ })).toHaveCount(1);
  await expect(surface.locator('input[placeholder*="MT5"], input[placeholder*="Login"]')).toHaveCount(0);
}

for (const provider of providers) {
  test(`USER-REFERRAL: real /connect keeps ${provider.name} referral departure gated`, async ({ page }, testInfo) => {
    test.skip(new URL(testInfo.project.use.baseURL).hostname !== 'user.pro-chart.com', 'User Portal vhost contract runs only against user.pro-chart.com');
    const target = connectUrl(testInfo.project.use.baseURL);
    const state = await installUserPortalFixture(page, target.origin, provider);
    const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });

    expect(response?.status(), 'User Portal BrowserRouter document status').toBe(200);
    await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === '/connect');

    const surface = page.locator('main');
    await expect(surface).toBeVisible();
    const gate = await assertReferralGate(page, surface, target.origin, provider);

    const storageContract = await page.evaluate(() => ({
      legacyAuthAbsent: localStorage.getItem('bn_auth') === null,
      portalTokenPresent: Boolean(localStorage.getItem('cp_academy_token')),
    }));
    expect(storageContract).toEqual({ legacyAuthAbsent: true, portalTokenPresent: true });

    if (provider.accountType === 'broker') {
      await assertBrokerIsReferralOnly(surface);
    } else {
      await assertCryptoKeepsLBankCredentials(surface);
    }

    const uniqueApiRequests = [...new Set(state.apiRequests.map(({ key }) => key))].sort();
    expect(uniqueApiRequests).toEqual([
      'GET /api/academy/bn/connect/status',
      'GET /api/academy/bn/overview',
      'GET /api/academy/bn/referral-link',
    ]);
    expect(state.apiRequests.every(({ bearerTokenPresent }) => bearerTokenPresent)).toBe(true);

    await testInfo.attach('user-referral-compliance.json', {
      body: Buffer.from(`${JSON.stringify({
        schemaVersion: 1,
        scope: 'frontend-user-browser-router-connect',
        project: testInfo.project.name,
        provider: provider.name,
        accountType: provider.accountType,
        approvedPath: provider.approvedPath,
        storageContract,
        uniqueApiRequests,
        gate,
        network: {
          badResponses: state.badResponses,
          pageErrors: state.pageErrors,
          popups: state.popups,
          requestFailures: state.requestFailures,
          unexpectedExternal: state.unexpectedExternal,
          unstubbed: state.unstubbed,
        },
      }, null, 2)}\n`),
      contentType: 'application/json',
    });

    expect(state.unstubbed, 'every API request must have an explicit synthetic response').toEqual([]);
    expect(state.unexpectedExternal, 'the page must not make an outbound request').toEqual([]);
    expect(state.badResponses, 'the page must not receive an HTTP error').toEqual([]);
    expect(state.pageErrors, 'the page must not raise an uncaught error').toEqual([]);
    expect(state.requestFailures, 'the page must not have a failed request').toEqual([]);
    expect(state.popups, 'the gate must not navigate before an explicit submit').toEqual([]);
  });
}
