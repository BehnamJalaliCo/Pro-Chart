import { test, expect } from '@playwright/test';
import {
  createFixtureState,
  installSyntheticFixture,
} from '../support/synthetic-prochart-fixture.mjs';

const USER_ROUTES = [
  '/',
  '/market',
  '/signals',
  '/trade',
  '/connect',
  '/subscription',
  '/profile',
];

const PANEL_ROUTES = [
  '/dashboard',
  '/users',
  '/subscriptions',
  '/orders',
  '/exchange',
  '/ai-signals',
  '/charts',
  '/ads',
  '/news',
  '/broadcasts',
  '/analytics',
  '/settings',
  '/signals',
  '/visitors',
];

function portalOrigin(name, testInfo) {
  const environmentValue = process.env[`PROCHART_${name.toUpperCase()}_BASE_URL`];
  if (environmentValue) return new URL(environmentValue).origin;

  const configured = new URL(testInfo.project.use.baseURL);
  if (configured.hostname === `${name}.pro-chart.com`) return configured.origin;
  return `https://${name}.pro-chart.com`;
}

async function verifyPersianDocumentRoutes(page, origin, paths) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const results = [];
  for (const requestedPath of paths) {
    const target = new URL(requestedPath, origin);
    const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0);

    results.push(await page.evaluate(({ path, status }) => ({
      requestedPath: path,
      documentStatus: status,
      finalOrigin: location.origin,
      finalPath: location.pathname,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
    }), { path: requestedPath, status: response?.status() ?? null }));
  }

  return results;
}

test('PC-009: persisted English stays inside the Main app while the public document root remains Persian RTL', async ({ page }, testInfo) => {
  const fixtureState = createFixtureState();
  await installSyntheticFixture(
    page,
    testInfo,
    { id: 'pc-009-main-root', onboarding: false },
    fixtureState,
    { preserveWorkspaceOnReload: true },
  );

  const initialResponse = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(initialResponse?.status()).toBe(200);
  await expect(page.locator('#root')).not.toBeEmpty();

  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('pc_app_v1') || '{}');
    localStorage.setItem('pc_app_v1', JSON.stringify({ ...current, lang: 'en' }));
  });

  const persistedResponse = await page.reload({ waitUntil: 'domcontentloaded' });
  expect(persistedResponse?.status()).toBe(200);
  await expect(page.locator('#root')).not.toBeEmpty();

  const semantics = await page.evaluate(() => ({
    html: {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
    },
    body: {
      lang: document.body.lang,
      dir: document.body.dir,
    },
    app: {
      lang: document.getElementById('root')?.lang || '',
      dir: document.getElementById('root')?.dir || '',
    },
    persistedLang: JSON.parse(localStorage.getItem('pc_app_v1') || '{}').lang,
  }));

  expect(semantics).toEqual({
    html: { lang: 'fa', dir: 'rtl' },
    body: { lang: 'en', dir: 'ltr' },
    app: { lang: 'en', dir: 'ltr' },
    persistedLang: 'en',
  });
  expect(fixtureState.unexpectedExternal).toEqual([]);
  expect(fixtureState.unstubbed).toEqual([]);
  expect(fixtureState.pageErrors).toEqual([]);
});

test('PC-009: every audited User route keeps a Persian RTL document root', async ({ page }, testInfo) => {
  const origin = portalOrigin('user', testInfo);
  const results = await verifyPersianDocumentRoutes(page, origin, USER_ROUTES);
  await testInfo.attach('user-route-status.json', {
    body: Buffer.from(`${JSON.stringify(results, null, 2)}\n`),
    contentType: 'application/json',
  });

  expect(results.map(({ requestedPath, documentStatus, finalOrigin, lang, dir }) => ({
    requestedPath,
    documentStatus,
    finalOrigin,
    lang,
    dir,
  }))).toEqual(USER_ROUTES.map((requestedPath) => ({
    requestedPath,
    documentStatus: 200,
    finalOrigin: origin,
    lang: 'fa',
    dir: 'rtl',
  })));
});

test('PC-009: every audited Panel route and legacy alias keeps a Persian RTL document root', async ({ page }, testInfo) => {
  const origin = portalOrigin('panel', testInfo);
  const results = await verifyPersianDocumentRoutes(page, origin, PANEL_ROUTES);
  await testInfo.attach('panel-route-status.json', {
    body: Buffer.from(`${JSON.stringify(results, null, 2)}\n`),
    contentType: 'application/json',
  });

  expect(results.map(({ requestedPath, documentStatus, finalOrigin, lang, dir }) => ({
    requestedPath,
    documentStatus,
    finalOrigin,
    lang,
    dir,
  }))).toEqual(PANEL_ROUTES.map((requestedPath) => ({
    requestedPath,
    documentStatus: 200,
    finalOrigin: origin,
    lang: 'fa',
    dir: 'rtl',
  })));
});
