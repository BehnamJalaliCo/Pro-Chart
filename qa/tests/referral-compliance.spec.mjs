import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import {
  createFixtureState,
  installSyntheticFixture,
} from '../support/synthetic-prochart-fixture.mjs';

const DISCLOSURE = 'با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.';
const ELIGIBILITY = 'ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.';

const providers = [
  {
    name: 'LBank',
    accountType: 'crypto',
    approvedPath: '/go/lbank',
    directHostPattern: /(^|\.)lbank\.com$/i,
  },
  {
    name: 'OneRoyal',
    accountType: 'broker',
    approvedPath: '/go/oneroyal',
    directHostPattern: /(^|\.)oneroyal\.com$/i,
  },
];

function userPanelUrl(baseURL, hash = '#/connect') {
  const target = new URL(baseURL);
  if (!target.hostname.startsWith('user.')) {
    if (target.hostname === 'localhost' || target.hostname.includes('.')) {
      target.hostname = `user.${target.hostname}`;
    } else {
      throw new Error(`Referral QA needs a user.* hostname derived from ${target.hostname}`);
    }
  }
  target.pathname = '/';
  target.search = '';
  target.hash = hash;
  return target;
}

async function installWindowOpenProbe(page) {
  await page.addInitScript(() => {
    const calls = [];
    Object.defineProperty(window, '__referralQaWindowOpenCalls', {
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
}

async function installUserPanelFixture(page, panelOrigin, provider) {
  const state = {
    apiRequests: [],
    mocked: [],
    unstubbed: [],
    unexpectedExternal: [],
    pageErrors: [],
    requestFailures: [],
  };

  page.on('pageerror', (error) => state.pageErrors.push(String(error?.message || error).slice(0, 1000)));
  page.on('requestfailed', (request) => state.requestFailures.push({
    method: request.method(),
    pathname: new URL(request.url()).pathname,
    error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
  }));

  await page.addInitScript(({ accountType }) => {
    localStorage.clear();
    localStorage.setItem('bn_auth', JSON.stringify({
      username: 'referral-qa-user',
      tier: 'free',
      account_type: accountType,
    }));
    localStorage.setItem('cp_academy_token', 'synthetic-referral-qa-token');
    localStorage.setItem('bn_panel_tab', 'connect');
  }, { accountType: provider.accountType });

  // Register the origin guard first. Playwright evaluates the newer API route first.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === panelOrigin) {
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
    const pathname = new URL(request.url()).pathname;
    const key = `${request.method()} ${pathname}`;
    state.apiRequests.push(key);

    const reply = async (body) => {
      state.mocked.push(key);
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: `${JSON.stringify(body)}\n`,
      });
    };

    if (key === 'GET /api/academy/me') {
      await reply({
        id: 'referral-qa-user',
        username: 'referral-qa-user',
        tier: 'free',
        status: 'active',
        account_type: provider.accountType,
      });
      return;
    }
    if (key === 'GET /api/academy/bn/connect/status') {
      await reply({ accounts: { lbank: null }, lbank: false, lbank_connected: false });
      return;
    }
    if (key === 'GET /api/academy/bn/alerts') {
      await reply([]);
      return;
    }
    if (key === 'GET /api/academy/bn/referral-link') {
      await reply({
        broker: provider.name,
        url: provider.approvedPath,
        referral_only: provider.name === 'OneRoyal',
      });
      return;
    }

    state.unstubbed.push(key);
    await route.abort('blockedbyclient');
  });

  return state;
}

async function openDesktopUserPanel(page, testInfo, provider) {
  const target = userPanelUrl(testInfo.project.use.baseURL);
  const state = await installUserPanelFixture(page, target.origin, provider);
  const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });

  expect(response?.status(), 'desktop UserPanel document status').toBe(200);
  await expect.poll(() => new URL(page.url()).hash).toBe('#/connect');
  await expect(page.getByRole('heading', { name: 'اتصالِ حساب', exact: true })).toBeVisible();

  return {
    state,
    surface: page.locator('main'),
    surfaceId: 'desktop-user-panel-connect',
    expectedOrigin: target.origin,
  };
}

async function assertNoCredentialControls(surface) {
  await expect(surface.locator([
    'input[type="password"]',
    'input[placeholder*="API"]',
    'input[placeholder*="MT5"]',
    'input[placeholder*="سرور"]',
    'input[placeholder*="Login"]',
  ].join(','))).toHaveCount(0);
  await expect(surface.getByRole('button', { name: /ذخیره|حذف اتصال|قطع اتصال/ })).toHaveCount(0);
}

async function assertOneRoyalReferralOnly(surface) {
  await expect(surface.getByText(/OneRoyal.*اتصال حساب.*معامله.*فعال نیست/).first()).toBeVisible();
  await assertNoCredentialControls(surface);
}

async function openMobileProfile(page, testInfo, provider) {
  const state = createFixtureState();
  await installSyntheticFixture(page, testInfo, { onboarding: false }, state);
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

  expect(response?.status(), 'mobile app document status').toBe(200);
  await expect(page.locator('.pc-launch')).toHaveCount(0);

  const profileTab = page.getByRole('button', { name: 'پروفایل', exact: true });
  await profileTab.focus();
  await expect(profileTab).toBeFocused();
  await profileTab.press('Space');
  await expect(page.getByRole('heading', { name: 'پروفایل', exact: true })).toBeVisible();

  const surface = page.locator('main > .pc-screen-in').filter({
    has: page.getByRole('heading', { name: 'پروفایل', exact: true }),
  });
  await expect(surface).toHaveCount(1);

  const providerDisclosure = provider.name === 'LBank'
    ? surface.getByRole('button', { name: /LBank/ }).first()
    : surface.getByRole('button', { name: /معرفی OneRoyal/ }).first();
  await providerDisclosure.focus();
  await expect(providerDisclosure).toBeFocused();
  await providerDisclosure.press('Enter');

  return {
    state,
    surface,
    surfaceId: 'mobile-profile',
    expectedOrigin: new URL(testInfo.project.use.baseURL).origin,
  };
}

async function assertReferralGate(page, surface, provider, expectedOrigin) {
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
    tagName: element.tagName,
    type: element.type,
    nativeDisabled: element.disabled,
  }))).toEqual({ tagName: 'BUTTON', type: 'submit', nativeDisabled: true });

  const disclosureId = await paragraphs.nth(0).getAttribute('id');
  const eligibilityId = await paragraphs.nth(1).getAttribute('id');
  const expectedDescription = `لینک معرفی: ${DISCLOSURE} ${ELIGIBILITY}`;
  expect(disclosureId).toMatch(/^referral-disclosure-/);
  expect(eligibilityId).toMatch(/^referral-eligibility-/);
  expect(await checkbox.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  expect(await submit.getAttribute('aria-describedby')).toBe(`${disclosureId} ${eligibilityId}`);
  await expect(checkbox).toHaveAccessibleName('شرایط محل اقامت و ارائه‌دهنده را بررسی کرده‌ام و می‌خواهم ادامه دهم.');
  await expect(checkbox).toHaveAccessibleDescription(expectedDescription);
  await expect(submit).toHaveAccessibleDescription(expectedDescription);

  const axeResult = await new AxeBuilder({ page })
    .include(`section[aria-label="لینک معرفی ${provider.name}"]`)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(axeResult.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    nodeCount: nodes.length,
  }))).toEqual([]);

  const rawAction = await form.getAttribute('action');
  const resolvedAction = await form.evaluate((element) => element.action);
  const method = await form.getAttribute('method');
  const target = await form.getAttribute('target');
  const relTokens = (await form.getAttribute('rel') || '').split(/\s+/).filter(Boolean).sort();
  expect(rawAction, 'only the reviewed same-origin path is rendered').toBe(provider.approvedPath);
  expect(new URL(resolvedAction).origin, 'form action remains on the preview origin').toBe(expectedOrigin);
  expect(new URL(resolvedAction).pathname).toBe(provider.approvedPath);
  expect(method?.toLowerCase()).toBe('get');
  expect(target).toBe('_blank');
  expect(relTokens).toEqual(['noopener', 'noreferrer', 'sponsored']);

  const disclosureOrder = await region.evaluate((element) => {
    const [disclosure, eligibility] = element.querySelectorAll('p');
    const outboundForm = element.querySelector('form');
    return {
      disclosureBeforeEligibility: Boolean(disclosure?.compareDocumentPosition(eligibility) & Node.DOCUMENT_POSITION_FOLLOWING),
      disclosureBeforeForm: Boolean(disclosure?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING),
      eligibilityBeforeForm: Boolean(eligibility?.compareDocumentPosition(outboundForm) & Node.DOCUMENT_POSITION_FOLLOWING),
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

  const acknowledgedAxeResult = await new AxeBuilder({ page })
    .include(`section[aria-label="لینک معرفی ${provider.name}"]`)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  expect(acknowledgedAxeResult.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    nodeCount: nodes.length,
  }))).toEqual([]);

  const departureRequests = [];
  const context = page.context();
  const departurePattern = `**${provider.approvedPath}*`;
  const departureHandler = async (route) => {
    const requestUrl = new URL(route.request().url());
    departureRequests.push({
      method: route.request().method(),
      origin: requestUrl.origin,
      pathname: requestUrl.pathname,
    });
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="fa" dir="rtl"><title>referral intercepted</title></html>',
    });
  };
  await context.route(departurePattern, departureHandler);
  const pagesBeforeDeparture = new Set(context.pages());
  try {
    const [departureRequest] = await Promise.all([
      context.waitForEvent('request', {
        predicate: (request) => new URL(request.url()).pathname === provider.approvedPath,
      }),
      submit.click({ noWaitAfter: true }),
    ]);
    await expect.poll(() => departureRequests).toEqual([{
      method: 'GET',
      origin: expectedOrigin,
      pathname: provider.approvedPath,
    }]);
    expect(departureRequest.method()).toBe('GET');
    expect(new URL(departureRequest.url()).origin).toBe(expectedOrigin);
    expect(new URL(departureRequest.url()).pathname).toBe(provider.approvedPath);
    await expect.poll(() => context.pages().length).toBe(pagesBeforeDeparture.size + 1);
  } finally {
    await Promise.all(context.pages()
      .filter((candidatePage) => !pagesBeforeDeparture.has(candidatePage))
      .map((candidatePage) => candidatePage.close()));
    await context.unroute(departurePattern, departureHandler);
  }

  const directProviderLinks = await surface.locator('a[href], form[action]').evaluateAll((elements, source) => elements
    .map((element) => ({
      tagName: element.tagName,
      raw: element.getAttribute(element.tagName === 'FORM' ? 'action' : 'href'),
      resolved: element.tagName === 'FORM' ? element.action : element.href,
    }))
    .filter(({ resolved }) => {
      try {
        return new RegExp(source).test(new URL(resolved).hostname);
      } catch {
        return false;
      }
    }), provider.directHostPattern.source);
  expect(directProviderLinks, `no direct ${provider.name} target may bypass the gate`).toEqual([]);

  const windowOpenCalls = await page.evaluate(() => window.__referralQaWindowOpenCalls || []);
  expect(windowOpenCalls, 'the reachable surface must not call window.open before acknowledgement').toEqual([]);

  return {
    disclosure: await paragraphs.nth(0).innerText(),
    eligibility: await paragraphs.nth(1).innerText(),
    rawAction,
    resolvedAction,
    method,
    target,
    relTokens,
    disclosureOrder,
    accessibility: {
      axeViolationCount: axeResult.violations.length,
      acknowledgedAxeViolationCount: acknowledgedAxeResult.violations.length,
      describedBy: `${disclosureId} ${eligibilityId}`,
      expectedDescription,
    },
    nativeSubmit: true,
    initiallyDisabled: true,
    keyboardAcknowledgementEnabledSubmit: true,
    departureRequests,
    directProviderLinks,
    windowOpenCalls,
  };
}

for (const provider of providers) {
  test(`REFERRAL-COMPLIANCE: ${provider.name} gate is disclosed, acknowledged, and same-origin`, async ({ page }, testInfo) => {
    await installWindowOpenProbe(page);

    const opened = testInfo.project.name === 'chromium-desktop'
      ? await openDesktopUserPanel(page, testInfo, provider)
      : await openMobileProfile(page, testInfo, provider);

    const gates = {
      connectOrProfile: await assertReferralGate(page, opened.surface, provider, opened.expectedOrigin),
    };

    if (provider.name === 'OneRoyal') {
      await assertOneRoyalReferralOnly(opened.surface);
    }

    // The desktop panel exposes the approved departure gate in both the account-
    // connection flow and its dedicated referral tab. Exercise both reachable
    // placements without submitting the outbound form.
    if (testInfo.project.name === 'chromium-desktop') {
      const referralTab = page.getByRole('button', { name: 'معرفی', exact: true });
      await referralTab.focus();
      await expect(referralTab).toBeFocused();
      await referralTab.press('Enter');
      await expect.poll(() => new URL(page.url()).hash).toBe('#/referral');
      await expect(page.getByRole('heading', { name: 'معرفی', exact: true })).toBeVisible();
      gates.referralTab = await assertReferralGate(page, opened.surface, provider, opened.expectedOrigin);
      if (provider.name === 'OneRoyal') await assertNoCredentialControls(opened.surface);
    }

    const network = testInfo.project.name === 'chromium-desktop'
      ? {
          apiRequests: opened.state.apiRequests,
          mocked: opened.state.mocked,
          unstubbed: opened.state.unstubbed,
          unexpectedExternal: opened.state.unexpectedExternal,
          pageErrors: opened.state.pageErrors,
          requestFailures: opened.state.requestFailures,
        }
      : {
          apiRequests: opened.state.apiRequests,
          mocked: opened.state.mocked,
          unstubbed: opened.state.unstubbed,
          unexpectedExternal: opened.state.unexpectedExternal,
          pageErrors: opened.state.pageErrors,
          requestFailures: opened.state.requestFailures,
          badResponses: opened.state.badResponses,
        };

    const ariaSnapshot = await opened.surface.ariaSnapshot();
    const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
    await testInfo.attach('actual.png', { body: screenshot, contentType: 'image/png' });
    await testInfo.attach('aria-snapshot.yml', {
      body: Buffer.from(`${ariaSnapshot}\n`),
      contentType: 'text/yaml; charset=utf-8',
    });

    await testInfo.attach('referral-compliance.json', {
      body: Buffer.from(`${JSON.stringify({
        schemaVersion: 1,
        scope: 'approved-provider-referral-departure-gate',
        project: testInfo.project.name,
        surface: opened.surfaceId,
        provider: provider.name,
        accountType: provider.accountType,
        expectedOrigin: opened.expectedOrigin,
        approvedPath: provider.approvedPath,
        gates,
        oneRoyalReferralOnly: provider.name === 'OneRoyal',
        network,
      }, null, 2)}\n`),
      contentType: 'application/json',
    });

    expect(network.unstubbed, 'all API calls are explicitly synthetic').toEqual([]);
    expect(network.unexpectedExternal, 'no outbound network request is made').toEqual([]);
    expect(network.pageErrors, 'no uncaught page error').toEqual([]);
    expect(network.requestFailures, 'no failed request').toEqual([]);
    if ('badResponses' in network) expect(network.badResponses, 'no HTTP error response').toEqual([]);
  });
}
