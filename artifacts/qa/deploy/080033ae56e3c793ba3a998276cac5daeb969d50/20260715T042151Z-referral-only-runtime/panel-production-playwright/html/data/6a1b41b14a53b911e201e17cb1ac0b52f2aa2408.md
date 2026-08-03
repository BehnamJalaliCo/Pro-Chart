# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: panel-navigation.spec.mjs >> PANEL-NAV: legacy aliases resolve and unavailable palette actions stay hidden
- Location: tests/panel-navigation.spec.mjs:27:1

# Error details

```
Error: EACCES: permission denied, open '/work/artifacts/qa/panel-navigation/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T042151Z-production/actual.png'
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: ب
      - generic [ref=e7]:
        - heading "بازارنما" [level=1] [ref=e8]
        - paragraph [ref=e9]: پنل مدیریت
    - navigation "ناوبری اصلی" [ref=e10]:
      - link "داشبورد" [ref=e11] [cursor=pointer]:
        - /url: /dashboard
        - img [ref=e12]
        - generic [ref=e17]: داشبورد
      - link "کاربران" [ref=e18] [cursor=pointer]:
        - /url: /users
        - img [ref=e19]
        - generic [ref=e24]: کاربران
      - link "اشتراک‌ها و پرداخت‌ها" [ref=e25] [cursor=pointer]:
        - /url: /subscriptions
        - img [ref=e26]
        - generic [ref=e28]: اشتراک‌ها و پرداخت‌ها
      - link "سفارش‌ها" [ref=e29] [cursor=pointer]:
        - /url: /orders
        - img [ref=e30]
        - generic [ref=e34]: سفارش‌ها
      - link "اتصال صرافی" [ref=e35] [cursor=pointer]:
        - /url: /exchange
        - img [ref=e36]
        - generic [ref=e39]: اتصال صرافی
      - link "سیگنال‌های AI" [ref=e40] [cursor=pointer]:
        - /url: /ai-signals
        - img [ref=e41]
        - generic [ref=e43]: سیگنال‌های AI
      - link "چارت‌ها و واچ‌لیست" [ref=e44] [cursor=pointer]:
        - /url: /charts
        - img [ref=e45]
        - generic [ref=e49]: چارت‌ها و واچ‌لیست
      - link "تبلیغات" [ref=e50] [cursor=pointer]:
        - /url: /ads
        - img [ref=e51]
        - generic [ref=e54]: تبلیغات
      - link "اخبار و تقویم" [ref=e55] [cursor=pointer]:
        - /url: /news
        - img [ref=e56]
        - generic [ref=e59]: اخبار و تقویم
      - link "پیام‌رسانی" [ref=e60] [cursor=pointer]:
        - /url: /broadcasts
        - img [ref=e61]
        - generic [ref=e64]: پیام‌رسانی
      - link "آنالیتیکس" [ref=e65] [cursor=pointer]:
        - /url: /analytics
        - img [ref=e66]
        - generic [ref=e68]: آنالیتیکس
      - link "تنظیمات" [ref=e69] [cursor=pointer]:
        - /url: /settings
        - img [ref=e70]
        - generic [ref=e73]: تنظیمات
    - generic [ref=e74]:
      - button "جمع کردن منو" [ref=e75] [cursor=pointer]:
        - img [ref=e76]
        - generic [ref=e78]: جمع کردن
      - button "خروج" [ref=e79] [cursor=pointer]:
        - img [ref=e80]
        - generic [ref=e83]: خروج
  - generic [ref=e84]:
    - banner [ref=e85]:
      - heading "پنل مدیریت بازارنما" [level=2] [ref=e87]
      - generic [ref=e88]:
        - button "جستجوی سریع" [ref=e89] [cursor=pointer]:
          - img [ref=e90]
          - generic [ref=e92]: جستجو
          - generic [ref=e93]: ⌘K
        - generic [ref=e94]: ۱۴۰۵ تیر ۲۴, چهارشنبه
        - generic [ref=e95]: م
    - main [ref=e96]:
      - generic [ref=e97]:
        - status [ref=e99]:
          - img [ref=e101]
          - heading "داده‌ی بازار در دسترس نیست" [level=3] [ref=e103]
          - paragraph [ref=e104]: در حال حاضر نمادی برای نمایش وجود ندارد.
        - generic [ref=e105]:
          - generic [ref=e106]:
            - generic [ref=e107]:
              - heading "داشبورد بازارنما" [level=1] [ref=e108]
              - paragraph [ref=e109]: نمای کلیِ زنده از کاربران، بازار و زیرساخت
            - generic [ref=e113]: زنده
          - status [ref=e115]:
            - img [ref=e117]
            - heading "هنوز داده‌ای ثبت نشده است" [level=3] [ref=e119]
            - paragraph [ref=e120]: با فعال شدن کاربران و تراکنش‌ها، شاخص‌های کلیدی اینجا نمایش داده می‌شوند.
          - generic [ref=e121]:
            - generic [ref=e123]:
              - generic [ref=e125]:
                - img [ref=e127]
                - generic [ref=e130]:
                  - heading "واچ‌لیست بازار" [level=3] [ref=e131]
                  - paragraph [ref=e132]: ۰ نماد زنده
              - status [ref=e136]:
                - img [ref=e138]
                - heading "نمادی برای نمایش نیست" [level=3] [ref=e141]
                - paragraph [ref=e142]: در حال حاضر داده‌ی زنده‌ای از بازار در دسترس نیست.
            - status [ref=e145]:
              - img [ref=e147]
              - heading "داده‌ی بازار در دسترس نیست" [level=3] [ref=e149]
              - paragraph [ref=e150]: در حال حاضر حرکتی برای نمایش وجود ندارد.
          - status [ref=e151]:
            - img [ref=e153]
            - heading "داده‌ای از سرور در دسترس نیست" [level=3] [ref=e156]
            - paragraph [ref=e157]: متریک‌های منابع سرور در حال حاضر قابل دریافت نیستند.
          - generic [ref=e158]:
            - generic [ref=e159]:
              - generic [ref=e161]:
                - img [ref=e163]
                - generic [ref=e166]:
                  - heading "روند ثبت‌نام کاربران" [level=3] [ref=e167]
                  - paragraph [ref=e168]: ۳۰ روز گذشته
              - status [ref=e169]:
                - img [ref=e171]
                - heading "هنوز ثبت‌نامی ثبت نشده" [level=3] [ref=e174]
                - paragraph [ref=e175]: با ثبت‌نام کاربران جدید، روند رشد در این نمودار نمایش داده می‌شود.
            - generic [ref=e176]:
              - generic [ref=e177]:
                - img [ref=e179]
                - generic [ref=e184]:
                  - heading "توزیع سطوح اشتراک" [level=3] [ref=e185]
                  - paragraph [ref=e186]: تفکیک کاربران بر اساس نوع اشتراک
              - status [ref=e187]:
                - img [ref=e189]
                - heading "کاربری ثبت نشده است" [level=3] [ref=e194]
                - paragraph [ref=e195]: با افزوده‌شدن کاربران، توزیع سطوح اینجا نمایش داده می‌شود.
            - generic [ref=e196]:
              - generic [ref=e197]:
                - img [ref=e199]
                - heading "وضعیت سفارش‌ها" [level=3] [ref=e203]
              - status [ref=e204]:
                - img [ref=e206]
                - heading "سفارشی ثبت نشده" [level=3] [ref=e210]
                - paragraph [ref=e211]: با ثبت اولین سفارش، وضعیت آن‌ها اینجا نمایش داده می‌شود.
          - generic [ref=e212]:
            - generic [ref=e214]:
              - img [ref=e216]
              - generic [ref=e218]:
                - heading "فعالیت اخیر سیستم" [level=3] [ref=e219]
                - paragraph [ref=e220]: آخرین اقدامات مدیران
            - status [ref=e221]:
              - img [ref=e223]
              - heading "فعالیتی ثبت نشده" [level=3] [ref=e225]
              - paragraph [ref=e226]: اقدامات مدیران پس از انجام، به‌صورت زنده در این تایم‌لاین نمایش داده می‌شود.
```

# Test source

```ts
  3   | import path from 'node:path';
  4   | import { fileURLToPath } from 'node:url';
  5   | 
  6   | const here = path.dirname(fileURLToPath(import.meta.url));
  7   | const repoRoot = path.resolve(here, '..', '..');
  8   | const commit = process.env.BASELINE_COMMIT || 'working-tree';
  9   | const runId = process.env.PANEL_NAV_RUN_ID || new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');
  10  | const sourceFingerprint = process.env.PANEL_SOURCE_FINGERPRINT || 'unrecorded';
  11  | 
  12  | const legacyRedirects = [
  13  |   { from: '/signals', to: '/ai-signals' },
  14  |   { from: '/visitors', to: '/analytics' },
  15  | ];
  16  | 
  17  | const unavailableCommands = [
  18  |   { query: 'backtest', label: 'بک‌تست' },
  19  |   { query: 'risk', label: 'مدیریت ریسک' },
  20  |   { query: 'pnl', label: 'عملکرد' },
  21  |   { query: 'heatmap', label: 'گزارش‌های پیشرفته' },
  22  |   { query: 'model', label: 'مدل‌های ML' },
  23  |   { query: 'monitor', label: 'مانیتورینگ' },
  24  |   { query: 'cms', label: 'مقالات' },
  25  | ];
  26  | 
  27  | test('PANEL-NAV: legacy aliases resolve and unavailable palette actions stay hidden', async ({ page }, testInfo) => {
  28  |   test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop command-palette contract');
  29  | 
  30  |   const outDir = path.join(repoRoot, 'artifacts', 'qa', 'panel-navigation', commit, runId);
  31  |   await fs.mkdir(outDir, { recursive: true });
  32  | 
  33  |   const expectedOrigin = new URL(testInfo.project.use.baseURL).origin;
  34  |   const unexpectedExternalRequests = [];
  35  |   const pageErrors = [];
  36  |   page.on('pageerror', (error) => pageErrors.push(String(error?.message || error).slice(0, 1000)));
  37  | 
  38  |   await page.addInitScript(() => {
  39  |     localStorage.setItem('auth-storage', JSON.stringify({
  40  |       state: {
  41  |         token: 'synthetic-panel-navigation-token',
  42  |         refreshToken: null,
  43  |         user: { role: 'admin' },
  44  |         isAuthenticated: true,
  45  |       },
  46  |       version: 0,
  47  |     }));
  48  |   });
  49  | 
  50  |   await page.route('**/*', async (route) => {
  51  |     const url = new URL(route.request().url());
  52  |     if (url.origin === expectedOrigin) {
  53  |       await route.fallback();
  54  |       return;
  55  |     }
  56  |     unexpectedExternalRequests.push({ method: route.request().method(), origin: url.origin, pathname: url.pathname });
  57  |     await route.abort('blockedbyclient');
  58  |   });
  59  |   await page.route('**/api/**', (route) => route.fulfill({
  60  |     status: 200,
  61  |     contentType: 'application/json; charset=utf-8',
  62  |     body: '{}\n',
  63  |   }));
  64  | 
  65  |   const redirectResults = [];
  66  |   for (const redirect of legacyRedirects) {
  67  |     const response = await page.goto(redirect.from, { waitUntil: 'domcontentloaded' });
  68  |     await expect(page).toHaveURL(new RegExp(`${redirect.to.replace('/', '\\/')}$`));
  69  |     redirectResults.push({
  70  |       ...redirect,
  71  |       documentStatus: response?.status() ?? null,
  72  |       observedPath: new URL(page.url()).pathname,
  73  |     });
  74  |   }
  75  | 
  76  |   await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  77  |   await page.getByRole('button', { name: 'جستجوی سریع' }).click();
  78  |   const input = page.locator('input[aria-label="جستجو"]');
  79  |   await expect(input).toBeFocused();
  80  | 
  81  |   const unavailableResults = [];
  82  |   for (const { query, label } of unavailableCommands) {
  83  |     await input.fill(query);
  84  |     const emptyVisible = await page.getByText('نتیجه‌ای یافت نشد').isVisible();
  85  |     const actionableCount = await page.getByRole('button', { name: label, exact: true }).count();
  86  |     unavailableResults.push({ query, label, actionableCount, emptyVisible });
  87  |     expect(actionableCount, `${query} must not expose the unavailable ${label} command`).toBe(0);
  88  |   }
  89  | 
  90  |   await input.fill('signal');
  91  |   await expect(page.getByRole('button', { name: /سیگنال‌ها/ })).toHaveCount(1);
  92  |   await input.press('Enter');
  93  |   await expect(page).toHaveURL(/\/ai-signals$/);
  94  | 
  95  |   await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  96  |   await expect(page.getByRole('button', { name: 'جستجوی سریع' })).toBeVisible();
  97  |   await page.keyboard.press('Control+k');
  98  |   await expect(page.locator('input[aria-label="جستجو"]')).toBeFocused();
  99  |   await page.keyboard.press('Escape');
  100 |   await expect(page.locator('input[aria-label="جستجو"]')).toHaveCount(0);
  101 | 
  102 |   const ariaSnapshot = await page.locator('body').ariaSnapshot();
> 103 |   await page.screenshot({ path: path.join(outDir, 'actual.png'), fullPage: true, animations: 'disabled' });
      |   ^ Error: EACCES: permission denied, open '/work/artifacts/qa/panel-navigation/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T042151Z-production/actual.png'
  104 |   await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${ariaSnapshot}\n`, 'utf8');
  105 |   await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify({
  106 |     schemaVersion: 1,
  107 |     requirementIds: ['PC-003', 'PC-005', 'PC-147', 'PC-159'],
  108 |     commit,
  109 |     runId,
  110 |     sourceFingerprint,
  111 |     project: testInfo.project.name,
  112 |     expectedOrigin,
  113 |     redirectResults,
  114 |     unavailableResults,
  115 |     enabledKeyboardResult: { query: 'signal', observedPath: '/ai-signals' },
  116 |     keyboardContract: { open: 'Control+k', activate: 'Enter', close: 'Escape' },
  117 |     unexpectedExternalRequests,
  118 |     pageErrors,
  119 |   }, null, 2)}\n`, 'utf8');
  120 | 
  121 |   expect(unexpectedExternalRequests).toEqual([]);
  122 |   expect(pageErrors).toEqual([]);
  123 | });
  124 | 
```