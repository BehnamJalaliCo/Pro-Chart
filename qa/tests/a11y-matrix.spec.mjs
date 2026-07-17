import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFixtureState,
  fixture,
  fixtureSha256,
  installSyntheticFixture,
  requestSummary,
  safeError,
  safeSegment,
  sha256,
  waitForFinalFonts,
} from '../support/synthetic-prochart-fixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const commit = safeSegment(process.env.BASELINE_COMMIT || 'working-tree');
const sourceFingerprint = process.env.BASELINE_SOURCE_FINGERPRINT || 'unrecorded';
const runId = safeSegment(process.env.A11Y_MATRIX_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z'));
const evidenceRoot = process.env.A11Y_MATRIX_EVIDENCE_ROOT
  ? path.resolve(process.env.A11Y_MATRIX_EVIDENCE_ROOT)
  : path.join(repoRoot, 'artifacts', 'qa', 'a11y-matrix', commit, runId);

// WCAG 2.2 inherits the 2.0 and 2.1 A/AA success criteria. Axe splits those
// generations into tags, so all six tags are required for the complete 2.2 set.
const WCAG_22_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const STRUCTURE_RULES = ['landmark-one-main', 'page-has-heading-one', 'region'];

const states = [
  {
    id: 'chart',
    heading: 'Pro-Chart — چارت حرفه‌ای بازارهای مالی',
    activation: [
      { index: 1, key: 'Enter', interimHeading: 'واچ‌لیست' },
      { index: 0, key: 'Space' },
    ],
    expectedApi: 'GET /api/academy/chart/EURUSD',
  },
  {
    id: 'watchlist',
    heading: 'واچ‌لیست',
    activation: [{ index: 1, key: 'Enter' }],
    expectedApi: 'GET /api/academy/bn/watchlist',
  },
  {
    id: 'ai',
    heading: 'سیگنال‌های هوش مصنوعی',
    activation: [{ index: 2, key: 'Space' }],
    expectedApi: 'GET /api/academy/bn/ai-signal/active',
  },
  {
    id: 'markets',
    heading: 'بازارها و اخبار',
    activation: [{ index: 3, key: 'Enter' }],
    expectedApi: 'GET /api/academy/bn/news',
  },
  {
    id: 'profile',
    heading: 'پروفایل',
    activation: [{ index: 4, key: 'Space' }],
    expectedApi: 'GET /api/academy/bn/connect/status',
  },
];

function impactCounts(items) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 };
  for (const item of items || []) counts[item.impact || 'unknown'] += 1;
  return counts;
}

async function activateStateWithKeyboard(page, state) {
  const nav = page.locator('.pc-approot > nav');
  const buttons = nav.locator('button');
  await expect(nav).toBeVisible();
  await expect(buttons).toHaveCount(5);

  const evidence = [];
  for (const step of state.activation) {
    const button = buttons.nth(step.index);
    await button.focus();
    await expect(button).toBeFocused();
    const accessibleName = await button.evaluate((element) => (
      element.getAttribute('aria-label') || element.innerText || ''
    ).trim().replace(/\s+/g, ' '));
    await page.keyboard.press(step.key);
    if (step.interimHeading) {
      await expect(page.locator('main h1')).toHaveText(step.interimHeading);
    }
    evidence.push({ index: step.index, key: step.key, accessibleName, focusedBeforeActivation: true });
  }
  return evidence;
}

async function waitForStateContent(page, state) {
  const heading = page.locator('main h1');
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText(state.heading);

  if (state.id === 'chart') {
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByText(fixture.workspace.symbol, { exact: true }).first()).toBeVisible();
    return;
  }
  if (state.id === 'watchlist') {
    await expect(page.locator('main ul li').first()).toBeVisible();
    await expect(page.getByText('EURUSD', { exact: true }).first()).toBeVisible();
    return;
  }
  if (state.id === 'ai') {
    await expect(page.locator('main ul li').first()).toBeVisible();
    await expect(page.getByText('EURUSD', { exact: false }).first()).toBeVisible();
    return;
  }
  if (state.id === 'markets') {
    await expect(page.getByText(fixture.news[0].title, { exact: true })).toBeVisible();
    return;
  }
  if (state.id === 'profile') {
    await expect(page.getByText('visual-fixture', { exact: true }).first()).toBeVisible();
  }
}

for (const state of states) {
  test(`A11Y-MATRIX: mobile ${state.id}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'The requested matrix covers the mobile shell');

    const outDir = path.join(evidenceRoot, state.id);
    await fs.mkdir(outDir, { recursive: true });

    const fixtureState = createFixtureState();
    const allRequests = [];
    let documentStatus = null;
    let finalUrl = null;
    let activation = [];
    let fontState = null;
    let semantics = null;
    let ariaSnapshot = null;
    let wcag = null;
    let structure = null;
    let screenshotSha256 = null;
    let result = 'FAIL';
    let failure = null;

    page.on('request', (request) => allRequests.push(requestSummary(request)));
    page.on('pageerror', (error) => fixtureState.pageErrors.push(safeError(error)));
    page.on('requestfailed', (request) => fixtureState.requestFailures.push({
      ...requestSummary(request),
      error: String(request.failure()?.errorText || 'unknown').slice(0, 500),
    }));
    page.on('response', (response) => {
      if (response.status() >= 400) fixtureState.badResponses.push({
        status: response.status(),
        pathname: new URL(response.url()).pathname,
      });
    });

    try {
      await installSyntheticFixture(page, testInfo, { onboarding: false }, fixtureState);
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      documentStatus = response?.status() ?? null;
      finalUrl = page.url();

      await expect(page.locator('.pc-launch')).toHaveCount(0);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('.pc-approot > nav')).toBeVisible();
      await expect(page.locator('canvas').first()).toBeVisible();
      await expect.poll(() => fixtureState.seen.has('POST /api/academy/auth/bn-guest')).toBe(true);

      activation = await activateStateWithKeyboard(page, state);
      await waitForStateContent(page, state);
      await expect.poll(() => fixtureState.seen.has(state.expectedApi)).toBe(true);

      fontState = await waitForFinalFonts(page);
      await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
      await page.waitForTimeout(250);

      semantics = await page.evaluate(() => {
        const main = document.querySelector('main');
        const h1s = [...document.querySelectorAll('h1')];
        const navs = [...document.querySelectorAll('nav')];
        return {
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          mainCount: document.querySelectorAll('main').length,
          h1Count: h1s.length,
          h1InsideMain: Boolean(main && h1s.length === 1 && main.contains(h1s[0])),
          h1Text: h1s.map((item) => item.textContent.trim()),
          navigationCount: navs.length,
          mainAriaHidden: main?.getAttribute('aria-hidden') || null,
        };
      });

      // No impact level is filtered: critical through minor violations all fail.
      wcag = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze();
      // `region` is an axe best-practice rule rather than a WCAG tag, so structural
      // landmark coverage is run separately instead of weakening the full WCAG scan.
      structure = await new AxeBuilder({ page }).withRules(STRUCTURE_RULES).analyze();
      ariaSnapshot = await page.locator('body').ariaSnapshot();

      const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      screenshotSha256 = sha256(screenshot);
      await fs.writeFile(path.join(outDir, 'actual.png'), screenshot);
      await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${ariaSnapshot}\n`, 'utf8');
      await fs.writeFile(path.join(outDir, 'axe-wcag-22-aa.json'), `${JSON.stringify(wcag, null, 2)}\n`, 'utf8');
      await fs.writeFile(path.join(outDir, 'axe-structure.json'), `${JSON.stringify(structure, null, 2)}\n`, 'utf8');

      const unexpectedMutations = allRequests.filter(({ method, pathname }) => (
        !['GET', 'HEAD', 'OPTIONS'].includes(method)
        && !(method === 'POST' && pathname === '/api/academy/auth/bn-guest')
      ));
      const failures = [];
      if (documentStatus !== 200) failures.push(`document status ${documentStatus}`);
      if (new URL(finalUrl).origin !== new URL(testInfo.project.use.baseURL).origin) failures.push('final origin escaped disposable preview');
      if (semantics.lang !== 'fa' || semantics.dir !== 'rtl') failures.push('document language or direction changed');
      if (semantics.mainCount !== 1) failures.push(`expected one main, found ${semantics.mainCount}`);
      if (semantics.h1Count !== 1 || !semantics.h1InsideMain) failures.push('expected one h1 inside main');
      if (semantics.h1Text[0] !== state.heading) failures.push('active h1 does not identify the requested state');
      if (semantics.navigationCount !== 1) failures.push(`expected one navigation landmark, found ${semantics.navigationCount}`);
      if (wcag.violations.length) failures.push(`${wcag.violations.length} WCAG 2.2 A/AA axe violation(s)`);
      if (structure.violations.length) failures.push(`${structure.violations.length} structural axe violation(s)`);
      if (fixtureState.unstubbed.length) failures.push(`${fixtureState.unstubbed.length} unstubbed API request(s)`);
      if (fixtureState.unexpectedExternal.length) failures.push(`${fixtureState.unexpectedExternal.length} external request(s)`);
      if (fixtureState.pageErrors.length) failures.push(`${fixtureState.pageErrors.length} page error(s)`);
      if (fixtureState.requestFailures.length) failures.push(`${fixtureState.requestFailures.length} failed request(s)`);
      if (fixtureState.badResponses.length) failures.push(`${fixtureState.badResponses.length} HTTP error response(s)`);
      if (unexpectedMutations.length) failures.push(`${unexpectedMutations.length} unexpected mutation(s)`);

      result = failures.length ? 'FAIL' : 'PASS';
      expect(failures, `${state.id} accessibility matrix failures`).toEqual([]);
    } catch (error) {
      failure = safeError(error);
      throw error;
    } finally {
      if (!screenshotSha256) {
        try {
          const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
          screenshotSha256 = sha256(screenshot);
          await fs.writeFile(path.join(outDir, 'actual.png'), screenshot);
        } catch {
          // The metadata below remains authoritative if navigation itself failed.
        }
      }

      const unexpectedMutations = allRequests.filter(({ method, pathname }) => (
        !['GET', 'HEAD', 'OPTIONS'].includes(method)
        && !(method === 'POST' && pathname === '/api/academy/auth/bn-guest')
      ));
      const metadata = {
        schemaVersion: 1,
        scope: 'mobile-shell-accessibility-state-matrix',
        state: state.id,
        project: testInfo.project.name,
        commit,
        sourceFingerprint,
        runId,
        result,
        failure,
        document: {
          status: documentStatus,
          finalOrigin: finalUrl ? new URL(finalUrl).origin : null,
          expectedOrigin: new URL(testInfo.project.use.baseURL).origin,
        },
        fixture: {
          id: fixture.fixtureId,
          sha256: fixtureSha256,
          fixedAt: fixture.fixedAt,
          provenance: fixture.provenance,
        },
        keyboardActivation: activation,
        semantics,
        fonts: fontState,
        axe: {
          engine: wcag?.testEngine || structure?.testEngine || null,
          wcag22AA: {
            tags: WCAG_22_AA_TAGS,
            violations: wcag?.violations.length ?? null,
            violationImpacts: impactCounts(wcag?.violations),
            incomplete: wcag?.incomplete.length ?? null,
            passes: wcag?.passes.length ?? null,
          },
          structure: {
            rules: STRUCTURE_RULES,
            violations: structure?.violations.length ?? null,
            violationIds: structure?.violations.map((item) => item.id) || [],
          },
        },
        network: {
          apiRequests: fixtureState.apiRequests,
          mocked: [...new Set(fixtureState.mocked)].sort(),
          mockedWebSockets: fixtureState.mockedWebSockets,
          unstubbed: fixtureState.unstubbed,
          unexpectedExternal: fixtureState.unexpectedExternal,
          unexpectedMutations,
          requestFailures: fixtureState.requestFailures,
          badResponses: fixtureState.badResponses,
        },
        pageErrors: fixtureState.pageErrors,
        screenshot: { path: 'actual.png', sha256: screenshotSha256 },
      };
      await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
      await testInfo.attach(`${state.id}-metadata`, {
        body: Buffer.from(JSON.stringify(metadata, null, 2)),
        contentType: 'application/json',
      });
    }
  });
}
