import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const commit = process.env.BASELINE_COMMIT || 'working-tree';
const sourceFingerprint = process.env.BASELINE_SOURCE_FINGERPRINT || 'unrecorded';
const runId = process.env.BASELINE_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');

function scrubUrl(raw) {
  try {
    const u = new URL(raw);
    const keys = [...u.searchParams.keys()].sort();
    return `${u.origin}${u.pathname}${keys.length ? `?keys=${keys.join(',')}` : ''}`;
  } catch {
    return '<invalid-url>';
  }
}

function redact(value) {
  return String(value)
    .replace(/(authorization|api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/[A-Za-z0-9+/_=-]{32,}/g, '[REDACTED]')
    .slice(0, 1000);
}

test('BASE-ROOT: public shell stateless-guest characterization', async ({ page, context }, testInfo) => {
  const scenario = `${testInfo.project.name}-root`;
  const outDir = path.join(repoRoot, 'artifacts', 'qa', 'baseline', commit, runId, scenario);
  await fs.mkdir(outDir, { recursive: true });

  const requests = [];
  const consoleEvents = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];

  page.on('request', (request) => requests.push({
    method: request.method(),
    url: scrubUrl(request.url()),
    resourceType: request.resourceType(),
  }));
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleEvents.push({ type: msg.type(), text: redact(msg.text()) });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(redact(error.message)));
  page.on('requestfailed', (request) => requestFailures.push({
    method: request.method(),
    url: scrubUrl(request.url()),
    error: redact(request.failure()?.errorText || 'unknown'),
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push({ status: response.status(), url: scrubUrl(response.url()) });
    }
  });

  const startedAt = new Date().toISOString();
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2_000);

  const root = await page.evaluate(async () => ({
    title: document.title,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    bodyClass: document.body.className,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    localStorageKeys: Object.keys(localStorage).sort(),
    sessionStorageKeys: Object.keys(sessionStorage).sort(),
    indexedDbNames: typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map((item) => item.name).filter(Boolean).sort()
      : [],
    interactive: [...document.querySelectorAll('a,button,input,select,textarea,[role],[tabindex]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      type: el.getAttribute('type') || '',
      name: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
      href: el instanceof HTMLAnchorElement ? `${el.origin}${el.pathname}` : '',
      disabled: 'disabled' in el ? Boolean(el.disabled) : el.getAttribute('aria-disabled') === 'true',
      tabIndex: el.tabIndex,
    })),
  }));

  const cookies = (await context.cookies()).map(({ name, domain, path: cookiePath, expires, httpOnly, secure, sameSite }) => ({
    name, domain, path: cookiePath, expires, httpOnly, secure, sameSite,
  }));
  const aria = await page.locator('body').ariaSnapshot();
  const axe = await new AxeBuilder({ page }).analyze();
  const mutatingRequests = requests.filter(({ method }) => !['GET', 'HEAD', 'OPTIONS'].includes(method));
  const unexpectedMutatingRequests = mutatingRequests.filter(({ method, url }) => {
    try {
      return !(method === 'POST' && new URL(url).pathname === '/api/academy/auth/bn-guest');
    } catch {
      return true;
    }
  });
  const expectedOrigin = new URL(testInfo.project.use.baseURL).origin;

  await page.screenshot({ path: path.join(outDir, 'actual.png'), fullPage: true, animations: 'disabled' });
  await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${aria}\n`, 'utf8');
  await fs.writeFile(path.join(outDir, 'axe.json'), `${JSON.stringify(axe, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify({
    requirementIds: ['PC-002', 'PC-009', 'PC-146', 'PC-153', 'PC-159'],
    scenario,
    commit,
    sourceFingerprint,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    url: scrubUrl(page.url()),
    expectedOrigin,
    httpStatus: response?.status() ?? null,
    project: testInfo.project.name,
    root,
    cookies,
    requests,
    mutatingRequests,
    unexpectedMutatingRequests,
    consoleEvents,
    pageErrors,
    requestFailures,
    badResponses,
    axeSummary: {
      violations: axe.violations.length,
      critical: axe.violations.filter((v) => v.impact === 'critical').length,
      serious: axe.violations.filter((v) => v.impact === 'serious').length,
      moderate: axe.violations.filter((v) => v.impact === 'moderate').length,
      minor: axe.violations.filter((v) => v.impact === 'minor').length,
    },
  }, null, 2)}\n`, 'utf8');

  const a11yViolations = axe.violations
    .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  expect.soft(response?.status(), 'document HTTP status').toBe(200);
  expect.soft(new URL(page.url()).origin, 'final origin remains the explicitly mapped local origin').toBe(expectedOrigin);
  expect.soft(root.lang, 'document language').toBe('fa');
  expect.soft(root.dir, 'document direction').toBe('rtl');
  expect.soft(pageErrors, 'uncaught page errors').toEqual([]);
  expect.soft(requestFailures, 'failed requests').toEqual([]);
  expect.soft(badResponses, 'HTTP responses >=400').toEqual([]);
  expect.soft(unexpectedMutatingRequests, 'unexpected non-idempotent requests').toEqual([]);
  expect.soft(a11yViolations, 'axe rule summary').toEqual([]);
});
