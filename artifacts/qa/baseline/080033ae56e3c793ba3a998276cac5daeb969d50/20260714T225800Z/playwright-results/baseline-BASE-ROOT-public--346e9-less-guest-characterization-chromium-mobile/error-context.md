# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: baseline.spec.mjs >> BASE-ROOT: public shell stateless-guest characterization
- Location: tests/baseline.spec.mjs:30:1

# Error details

```
Error: critical/serious axe rule summary

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   Object {
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": 10,
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
        - generic [ref=e32]: "1.14203"
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
              - generic [ref=e80]: "1.14200"
            - generic [ref=e81]:
              - generic [ref=e82]: C
              - generic [ref=e83]: "1.14203"
          - generic [ref=e84]: −0.00057 (−0.05%)
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
              - button "1.14203 SELL" [ref=e114] [cursor=pointer]:
                - generic [ref=e115]: "1.14203"
                - generic [ref=e116]: SELL
              - generic [ref=e117]:
                - generic [ref=e118]: "0"
                - generic [ref=e119]: اسپرد
              - button "1.14203 BUY" [ref=e120] [cursor=pointer]:
                - generic [ref=e121]: "1.14203"
                - generic [ref=e122]: BUY
            - generic [ref=e123]:
              - generic [ref=e124]: "-0.00057"
              - generic [ref=e125]: (-0.05%)
          - button "برای جزئیات نگه‌دار · با دو انگشت زوم کن ✕" [ref=e126] [cursor=pointer]:
            - img [ref=e127]
            - generic [ref=e133]: برای جزئیات نگه‌دار · با دو انگشت زوم کن
            - generic [ref=e134]: ✕
          - generic:
            - img
            - generic: 2:24
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
          - button "02:27:36 (تهران)" [ref=e155] [cursor=pointer]:
            - img [ref=e156]
            - generic [ref=e159]: 02:27:36
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
  64  |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
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
  134 |     },
  135 |   }, null, 2)}\n`, 'utf8');
  136 | 
  137 |   const highImpactA11y = axe.violations
  138 |     .filter((v) => ['critical', 'serious'].includes(v.impact))
  139 |     .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  140 |   expect.soft(response?.status(), 'document HTTP status').toBe(200);
  141 |   expect.soft(new URL(page.url()).origin, 'final origin remains the explicitly mapped local origin').toBe(expectedOrigin);
  142 |   expect.soft(root.lang, 'document language').toBe('fa');
  143 |   expect.soft(root.dir, 'document direction').toBe('rtl');
  144 |   expect.soft(pageErrors, 'uncaught page errors').toEqual([]);
  145 |   expect.soft(requestFailures, 'failed requests').toEqual([]);
  146 |   expect.soft(badResponses, 'HTTP responses >=400').toEqual([]);
  147 |   expect.soft(unexpectedMutatingRequests, 'unexpected non-idempotent requests').toEqual([]);
> 148 |   expect.soft(highImpactA11y, 'critical/serious axe rule summary').toEqual([]);
      |                                                                    ^ Error: critical/serious axe rule summary
  149 | });
  150 | 
```