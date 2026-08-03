# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: baseline.spec.mjs >> BASE-ROOT: public shell read-only characterization
- Location: tests/baseline.spec.mjs:29:1

# Error details

```
Error: critical/serious axe rule summary

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 12

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": 10,
+   },
+   Object {
+     "id": "meta-viewport",
+     "impact": "critical",
+     "nodes": 1,
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - button "جستجوی نماد" [ref=e7] [cursor=pointer]:
          - generic [ref=e8]:
            - img [ref=e11]
            - img [ref=e24]
          - generic [ref=e28]: EURUSD
        - generic [ref=e32]: "1.14211"
        - button "تایم‌فریم" [ref=e33] [cursor=pointer]:
          - text: 1H
          - img [ref=e34]
        - button "نوعِ چارت" [ref=e36] [cursor=pointer]:
          - img [ref=e37]
        - button "بیشتر" [ref=e40] [cursor=pointer]:
          - img [ref=e41]
      - generic [ref=e43]:
        - generic [ref=e44]:
          - generic [ref=e45]:
            - img [ref=e48]
            - img [ref=e61]
          - generic [ref=e65]: EURUSD
          - generic [ref=e66]: 1H · فارکس
          - img [ref=e67]
          - generic [ref=e71]:
            - generic [ref=e72]:
              - generic [ref=e73]: O
              - generic [ref=e74]: "1.14260"
            - generic [ref=e75]:
              - generic [ref=e76]: H
              - generic [ref=e77]: "1.14260"
            - generic [ref=e78]:
              - generic [ref=e79]: L
              - generic [ref=e80]: "1.14208"
            - generic [ref=e81]:
              - generic [ref=e82]: C
              - generic [ref=e83]: "1.14211"
          - generic [ref=e84]: −0.00049 (−0.04%)
          - generic [ref=e85]:
            - generic [ref=e86]: Vol
            - generic [ref=e87]: "0"
          - button "تنظیماتِ چارت" [ref=e88] [cursor=pointer]:
            - img [ref=e89]
        - generic [ref=e92]:
          - table [ref=e95]:
            - row [ref=e96]:
              - cell
              - cell [ref=e97]
              - cell [ref=e101]
            - row [ref=e105]:
              - cell
              - cell [ref=e106]
              - cell [ref=e110]
          - generic:
            - generic [ref=e113]:
              - button "1.14212 SELL" [ref=e114] [cursor=pointer]:
                - generic [ref=e115]: "1.14212"
                - generic [ref=e116]: SELL
              - generic [ref=e117]:
                - generic [ref=e118]: "0"
                - generic [ref=e119]: اسپرد
              - button "1.14212 BUY" [ref=e120] [cursor=pointer]:
                - generic [ref=e121]: "1.14212"
                - generic [ref=e122]: BUY
            - generic [ref=e123]:
              - generic [ref=e124]: "-0.00048"
              - generic [ref=e125]: (-0.04%)
          - button "برای جزئیات نگه‌دار · با دو انگشت زوم کن ✕" [ref=e126] [cursor=pointer]:
            - img [ref=e127]
            - generic [ref=e133]: برای جزئیات نگه‌دار · با دو انگشت زوم کن
            - generic [ref=e134]: ✕
          - generic:
            - img
            - generic: 16:10
          - generic [ref=e135]:
            - button "مقیاسِ درصدی" [ref=e136] [cursor=pointer]: ٪
            - button "مقیاسِ لگاریتمی" [ref=e137] [cursor=pointer]: log
            - button "مقیاسِ خودکار (Fit)" [ref=e138] [cursor=pointer]: auto
          - generic:
            - img
            - generic: حجم · Vol
          - img "بازارنما"
        - generic [ref=e139]:
          - button "1D" [ref=e140] [cursor=pointer]
          - button "5D" [ref=e141] [cursor=pointer]
          - button "1M" [ref=e142] [cursor=pointer]
          - button "3M" [ref=e143] [cursor=pointer]
          - button "6M" [ref=e144] [cursor=pointer]
          - button "YTD" [ref=e145] [cursor=pointer]
          - button "1Y" [ref=e146] [cursor=pointer]
          - button "5Y" [ref=e147] [cursor=pointer]
          - button "All" [ref=e148] [cursor=pointer]
          - button "پرش به تاریخ" [ref=e150] [cursor=pointer]:
            - img [ref=e151]
          - button "02:13:50 (تهران)" [ref=e155] [cursor=pointer]:
            - img [ref=e156]
            - generic [ref=e159]: 02:13:50
            - generic [ref=e160]: (تهران)
    - navigation [ref=e161]:
      - button "چارت" [ref=e162] [cursor=pointer]:
        - img [ref=e164]
        - generic [ref=e168]: چارت
      - button "واچ‌لیست" [ref=e169] [cursor=pointer]:
        - img [ref=e171]
        - generic [ref=e172]: واچ‌لیست
      - button "سیگنالِ AI" [ref=e173] [cursor=pointer]:
        - img [ref=e175]
      - button "بازارها" [ref=e177] [cursor=pointer]:
        - img [ref=e179]
        - generic [ref=e182]: بازارها
      - button "پروفایل" [ref=e183] [cursor=pointer]:
        - img [ref=e185]
        - generic [ref=e188]: پروفایل
  - generic [ref=e189]:
    - generic [ref=e190]:
      - img "Pro-Chart" [ref=e191]
      - button "رد شدن" [ref=e192] [cursor=pointer]
    - generic [ref=e194]:
      - img [ref=e196]
      - heading "چارتِ حرفه‌ای" [level=2] [ref=e200]
      - paragraph [ref=e201]: چارتِ حرفه‌ای با ۸۰+ اندیکاتور، ۱۳ نوعِ چارت و مجموعهٔ کاملِ ابزارِ ترسیم.
    - button "بعدی" [ref=e207] [cursor=pointer]
```

# Test source

```ts
  25  |     .replace(/[A-Za-z0-9+/_=-]{32,}/g, '[REDACTED]')
  26  |     .slice(0, 1000);
  27  | }
  28  | 
  29  | test('BASE-ROOT: public shell read-only characterization', async ({ page, context }, testInfo) => {
  30  |   const scenario = `${testInfo.project.name}-root`;
  31  |   const outDir = path.join(repoRoot, 'artifacts', 'qa', 'baseline', commit, runId, scenario);
  32  |   await fs.mkdir(outDir, { recursive: true });
  33  | 
  34  |   const consoleEvents = [];
  35  |   const pageErrors = [];
  36  |   const requestFailures = [];
  37  |   const badResponses = [];
  38  | 
  39  |   page.on('console', (msg) => {
  40  |     if (['error', 'warning'].includes(msg.type())) {
  41  |       consoleEvents.push({ type: msg.type(), text: redact(msg.text()) });
  42  |     }
  43  |   });
  44  |   page.on('pageerror', (error) => pageErrors.push(redact(error.message)));
  45  |   page.on('requestfailed', (request) => requestFailures.push({
  46  |     method: request.method(),
  47  |     url: scrubUrl(request.url()),
  48  |     error: redact(request.failure()?.errorText || 'unknown'),
  49  |   }));
  50  |   page.on('response', (response) => {
  51  |     if (response.status() >= 400) {
  52  |       badResponses.push({ status: response.status(), url: scrubUrl(response.url()) });
  53  |     }
  54  |   });
  55  | 
  56  |   const startedAt = new Date().toISOString();
  57  |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  58  |   await page.evaluate(() => document.fonts.ready);
  59  |   await page.waitForTimeout(2_000);
  60  | 
  61  |   const root = await page.evaluate(async () => ({
  62  |     title: document.title,
  63  |     lang: document.documentElement.lang,
  64  |     dir: document.documentElement.dir,
  65  |     bodyClass: document.body.className,
  66  |     viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
  67  |     scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
  68  |     localStorageKeys: Object.keys(localStorage).sort(),
  69  |     sessionStorageKeys: Object.keys(sessionStorage).sort(),
  70  |     indexedDbNames: typeof indexedDB.databases === 'function'
  71  |       ? (await indexedDB.databases()).map((item) => item.name).filter(Boolean).sort()
  72  |       : [],
  73  |     interactive: [...document.querySelectorAll('a,button,input,select,textarea,[role],[tabindex]')].map((el) => ({
  74  |       tag: el.tagName.toLowerCase(),
  75  |       role: el.getAttribute('role') || '',
  76  |       type: el.getAttribute('type') || '',
  77  |       name: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
  78  |       href: el instanceof HTMLAnchorElement ? `${el.origin}${el.pathname}` : '',
  79  |       disabled: 'disabled' in el ? Boolean(el.disabled) : el.getAttribute('aria-disabled') === 'true',
  80  |       tabIndex: el.tabIndex,
  81  |     })),
  82  |   }));
  83  | 
  84  |   const cookies = (await context.cookies()).map(({ name, domain, path: cookiePath, expires, httpOnly, secure, sameSite }) => ({
  85  |     name, domain, path: cookiePath, expires, httpOnly, secure, sameSite,
  86  |   }));
  87  |   const aria = await page.locator('body').ariaSnapshot();
  88  |   const axe = await new AxeBuilder({ page }).analyze();
  89  | 
  90  |   await page.screenshot({ path: path.join(outDir, 'actual.png'), fullPage: true, animations: 'disabled' });
  91  |   await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${aria}\n`, 'utf8');
  92  |   await fs.writeFile(path.join(outDir, 'axe.json'), `${JSON.stringify(axe, null, 2)}\n`, 'utf8');
  93  |   await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify({
  94  |     requirementIds: ['PC-002', 'PC-009', 'PC-146', 'PC-153', 'PC-159'],
  95  |     scenario,
  96  |     commit,
  97  |     runId,
  98  |     startedAt,
  99  |     finishedAt: new Date().toISOString(),
  100 |     url: scrubUrl(page.url()),
  101 |     httpStatus: response?.status() ?? null,
  102 |     project: testInfo.project.name,
  103 |     root,
  104 |     cookies,
  105 |     consoleEvents,
  106 |     pageErrors,
  107 |     requestFailures,
  108 |     badResponses,
  109 |     axeSummary: {
  110 |       violations: axe.violations.length,
  111 |       critical: axe.violations.filter((v) => v.impact === 'critical').length,
  112 |       serious: axe.violations.filter((v) => v.impact === 'serious').length,
  113 |     },
  114 |   }, null, 2)}\n`, 'utf8');
  115 | 
  116 |   const highImpactA11y = axe.violations
  117 |     .filter((v) => ['critical', 'serious'].includes(v.impact))
  118 |     .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  119 |   expect.soft(response?.status(), 'document HTTP status').toBe(200);
  120 |   expect.soft(root.lang, 'document language').toBe('fa');
  121 |   expect.soft(root.dir, 'document direction').toBe('rtl');
  122 |   expect.soft(pageErrors, 'uncaught page errors').toEqual([]);
  123 |   expect.soft(requestFailures, 'failed requests').toEqual([]);
  124 |   expect.soft(badResponses, 'HTTP responses >=400').toEqual([]);
> 125 |   expect.soft(highImpactA11y, 'critical/serious axe rule summary').toEqual([]);
      |                                                                    ^ Error: critical/serious axe rule summary
  126 | });
  127 | 
```