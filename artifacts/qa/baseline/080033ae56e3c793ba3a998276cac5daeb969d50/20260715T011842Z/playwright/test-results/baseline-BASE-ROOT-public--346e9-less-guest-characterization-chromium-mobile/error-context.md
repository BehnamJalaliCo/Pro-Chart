# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: baseline.spec.mjs >> BASE-ROOT: public shell stateless-guest characterization
- Location: tests/baseline.spec.mjs:30:1

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at http://prochart.local:4173/
Call log:
  - navigating to "http://prochart.local:4173/", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | import fs from 'node:fs/promises';
  4   | import path from 'node:path';
  5   | import { fileURLToPath } from 'node:url';
  6   | 
  7   | const here = path.dirname(fileURLToPath(import.meta.url));
  8   | const repoRoot = path.resolve(here, '..', '..');
  9   | const commit = process.env.BASELINE_COMMIT || 'working-tree';
  10  | const sourceFingerprint = process.env.BASELINE_SOURCE_FINGERPRINT || 'unrecorded';
  11  | const runId = process.env.BASELINE_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');
  12  | 
  13  | function scrubUrl(raw) {
  14  |   try {
  15  |     const u = new URL(raw);
  16  |     const keys = [...u.searchParams.keys()].sort();
  17  |     return `${u.origin}${u.pathname}${keys.length ? `?keys=${keys.join(',')}` : ''}`;
  18  |   } catch {
  19  |     return '<invalid-url>';
  20  |   }
  21  | }
  22  | 
  23  | function redact(value) {
  24  |   return String(value)
  25  |     .replace(/(authorization|api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
  26  |     .replace(/[A-Za-z0-9+/_=-]{32,}/g, '[REDACTED]')
  27  |     .slice(0, 1000);
  28  | }
  29  | 
  30  | test('BASE-ROOT: public shell stateless-guest characterization', async ({ page, context }, testInfo) => {
  31  |   const scenario = `${testInfo.project.name}-root`;
  32  |   const outDir = path.join(repoRoot, 'artifacts', 'qa', 'baseline', commit, runId, scenario);
  33  |   await fs.mkdir(outDir, { recursive: true });
  34  | 
  35  |   const requests = [];
  36  |   const consoleEvents = [];
  37  |   const pageErrors = [];
  38  |   const requestFailures = [];
  39  |   const badResponses = [];
  40  | 
  41  |   page.on('request', (request) => requests.push({
  42  |     method: request.method(),
  43  |     url: scrubUrl(request.url()),
  44  |     resourceType: request.resourceType(),
  45  |   }));
  46  |   page.on('console', (msg) => {
  47  |     if (['error', 'warning'].includes(msg.type())) {
  48  |       consoleEvents.push({ type: msg.type(), text: redact(msg.text()) });
  49  |     }
  50  |   });
  51  |   page.on('pageerror', (error) => pageErrors.push(redact(error.message)));
  52  |   page.on('requestfailed', (request) => requestFailures.push({
  53  |     method: request.method(),
  54  |     url: scrubUrl(request.url()),
  55  |     error: redact(request.failure()?.errorText || 'unknown'),
  56  |   }));
  57  |   page.on('response', (response) => {
  58  |     if (response.status() >= 400) {
  59  |       badResponses.push({ status: response.status(), url: scrubUrl(response.url()) });
  60  |     }
  61  |   });
  62  | 
  63  |   const startedAt = new Date().toISOString();
> 64  |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      |                               ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at http://prochart.local:4173/
  65  |   await page.evaluate(() => document.fonts.ready);
  66  |   await page.waitForTimeout(2_000);
  67  | 
  68  |   const root = await page.evaluate(async () => ({
  69  |     title: document.title,
  70  |     lang: document.documentElement.lang,
  71  |     dir: document.documentElement.dir,
  72  |     bodyClass: document.body.className,
  73  |     viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
  74  |     scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
  75  |     localStorageKeys: Object.keys(localStorage).sort(),
  76  |     sessionStorageKeys: Object.keys(sessionStorage).sort(),
  77  |     indexedDbNames: typeof indexedDB.databases === 'function'
  78  |       ? (await indexedDB.databases()).map((item) => item.name).filter(Boolean).sort()
  79  |       : [],
  80  |     interactive: [...document.querySelectorAll('a,button,input,select,textarea,[role],[tabindex]')].map((el) => ({
  81  |       tag: el.tagName.toLowerCase(),
  82  |       role: el.getAttribute('role') || '',
  83  |       type: el.getAttribute('type') || '',
  84  |       name: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
  85  |       href: el instanceof HTMLAnchorElement ? `${el.origin}${el.pathname}` : '',
  86  |       disabled: 'disabled' in el ? Boolean(el.disabled) : el.getAttribute('aria-disabled') === 'true',
  87  |       tabIndex: el.tabIndex,
  88  |     })),
  89  |   }));
  90  | 
  91  |   const cookies = (await context.cookies()).map(({ name, domain, path: cookiePath, expires, httpOnly, secure, sameSite }) => ({
  92  |     name, domain, path: cookiePath, expires, httpOnly, secure, sameSite,
  93  |   }));
  94  |   const aria = await page.locator('body').ariaSnapshot();
  95  |   const axe = await new AxeBuilder({ page }).analyze();
  96  |   const mutatingRequests = requests.filter(({ method }) => !['GET', 'HEAD', 'OPTIONS'].includes(method));
  97  |   const unexpectedMutatingRequests = mutatingRequests.filter(({ method, url }) => {
  98  |     try {
  99  |       return !(method === 'POST' && new URL(url).pathname === '/api/academy/auth/bn-guest');
  100 |     } catch {
  101 |       return true;
  102 |     }
  103 |   });
  104 |   const expectedOrigin = new URL(testInfo.project.use.baseURL).origin;
  105 | 
  106 |   await page.screenshot({ path: path.join(outDir, 'actual.png'), fullPage: true, animations: 'disabled' });
  107 |   await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${aria}\n`, 'utf8');
  108 |   await fs.writeFile(path.join(outDir, 'axe.json'), `${JSON.stringify(axe, null, 2)}\n`, 'utf8');
  109 |   await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify({
  110 |     requirementIds: ['PC-002', 'PC-009', 'PC-146', 'PC-153', 'PC-159'],
  111 |     scenario,
  112 |     commit,
  113 |     sourceFingerprint,
  114 |     runId,
  115 |     startedAt,
  116 |     finishedAt: new Date().toISOString(),
  117 |     url: scrubUrl(page.url()),
  118 |     expectedOrigin,
  119 |     httpStatus: response?.status() ?? null,
  120 |     project: testInfo.project.name,
  121 |     root,
  122 |     cookies,
  123 |     requests,
  124 |     mutatingRequests,
  125 |     unexpectedMutatingRequests,
  126 |     consoleEvents,
  127 |     pageErrors,
  128 |     requestFailures,
  129 |     badResponses,
  130 |     axeSummary: {
  131 |       violations: axe.violations.length,
  132 |       critical: axe.violations.filter((v) => v.impact === 'critical').length,
  133 |       serious: axe.violations.filter((v) => v.impact === 'serious').length,
  134 |       moderate: axe.violations.filter((v) => v.impact === 'moderate').length,
  135 |       minor: axe.violations.filter((v) => v.impact === 'minor').length,
  136 |     },
  137 |   }, null, 2)}\n`, 'utf8');
  138 | 
  139 |   const a11yViolations = axe.violations
  140 |     .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  141 |   expect.soft(response?.status(), 'document HTTP status').toBe(200);
  142 |   expect.soft(new URL(page.url()).origin, 'final origin remains the explicitly mapped local origin').toBe(expectedOrigin);
  143 |   expect.soft(root.lang, 'document language').toBe('fa');
  144 |   expect.soft(root.dir, 'document direction').toBe('rtl');
  145 |   expect.soft(pageErrors, 'uncaught page errors').toEqual([]);
  146 |   expect.soft(requestFailures, 'failed requests').toEqual([]);
  147 |   expect.soft(badResponses, 'HTTP responses >=400').toEqual([]);
  148 |   expect.soft(unexpectedMutatingRequests, 'unexpected non-idempotent requests').toEqual([]);
  149 |   expect.soft(a11yViolations, 'axe rule summary').toEqual([]);
  150 | });
  151 | 
```