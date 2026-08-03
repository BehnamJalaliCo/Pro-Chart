# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: panel-navigation.spec.mjs >> PANEL-NAV: legacy aliases resolve and unavailable palette actions stay hidden
- Location: tests/panel-navigation.spec.mjs:27:1

# Error details

```
Error: cms must not expose an actionable command

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
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
  - dialog "Command palette" [ref=e84]:
    - generic [ref=e85]:
      - generic [ref=e86]:
        - img [ref=e87]
        - textbox "جستجو" [active] [ref=e90]:
          - /placeholder: جستجو یا دستور... (ESC برای بستن)
          - text: cms
        - button "بستن" [ref=e91] [cursor=pointer]:
          - img [ref=e92]
      - button "پیام‌ها broadcast Enter" [ref=e96] [cursor=pointer]:
        - generic [ref=e97]:
          - generic [ref=e98]: پیام‌ها
          - generic [ref=e99]: broadcast
        - generic [ref=e100]: Enter
      - generic [ref=e101]:
        - generic [ref=e102]:
          - generic [ref=e103]: ↑↓ ناوبری
          - generic [ref=e104]: ↵ اجرا
          - generic [ref=e105]: Esc بستن
        - generic [ref=e106]: 1 مورد
  - generic [ref=e107]:
    - banner [ref=e108]:
      - heading "پنل مدیریت بازارنما" [level=2] [ref=e110]
      - generic [ref=e111]:
        - button "جستجوی سریع" [ref=e112] [cursor=pointer]:
          - img [ref=e113]
          - generic [ref=e115]: جستجو
          - generic [ref=e116]: ⌘K
        - generic [ref=e117]: ۱۴۰۵ تیر ۲۴, چهارشنبه
        - generic [ref=e118]: م
    - main [ref=e119]:
      - generic [ref=e120]:
        - status [ref=e122]:
          - img [ref=e124]
          - heading "داده‌ی بازار در دسترس نیست" [level=3] [ref=e126]
          - paragraph [ref=e127]: در حال حاضر نمادی برای نمایش وجود ندارد.
        - generic [ref=e128]:
          - generic [ref=e129]:
            - generic [ref=e130]:
              - heading "داشبورد بازارنما" [level=1] [ref=e131]
              - paragraph [ref=e132]: نمای کلیِ زنده از کاربران، بازار و زیرساخت
            - generic [ref=e136]: زنده
          - status [ref=e138]:
            - img [ref=e140]
            - heading "هنوز داده‌ای ثبت نشده است" [level=3] [ref=e142]
            - paragraph [ref=e143]: با فعال شدن کاربران و تراکنش‌ها، شاخص‌های کلیدی اینجا نمایش داده می‌شوند.
          - generic [ref=e144]:
            - generic [ref=e146]:
              - generic [ref=e148]:
                - img [ref=e150]
                - generic [ref=e153]:
                  - heading "واچ‌لیست بازار" [level=3] [ref=e154]
                  - paragraph [ref=e155]: ۰ نماد زنده
              - status [ref=e159]:
                - img [ref=e161]
                - heading "نمادی برای نمایش نیست" [level=3] [ref=e164]
                - paragraph [ref=e165]: در حال حاضر داده‌ی زنده‌ای از بازار در دسترس نیست.
            - status [ref=e168]:
              - img [ref=e170]
              - heading "داده‌ی بازار در دسترس نیست" [level=3] [ref=e172]
              - paragraph [ref=e173]: در حال حاضر حرکتی برای نمایش وجود ندارد.
          - status [ref=e174]:
            - img [ref=e176]
            - heading "داده‌ای از سرور در دسترس نیست" [level=3] [ref=e179]
            - paragraph [ref=e180]: متریک‌های منابع سرور در حال حاضر قابل دریافت نیستند.
          - generic [ref=e181]:
            - generic [ref=e182]:
              - generic [ref=e184]:
                - img [ref=e186]
                - generic [ref=e189]:
                  - heading "روند ثبت‌نام کاربران" [level=3] [ref=e190]
                  - paragraph [ref=e191]: ۳۰ روز گذشته
              - status [ref=e192]:
                - img [ref=e194]
                - heading "هنوز ثبت‌نامی ثبت نشده" [level=3] [ref=e197]
                - paragraph [ref=e198]: با ثبت‌نام کاربران جدید، روند رشد در این نمودار نمایش داده می‌شود.
            - generic [ref=e199]:
              - generic [ref=e200]:
                - img [ref=e202]
                - generic [ref=e207]:
                  - heading "توزیع سطوح اشتراک" [level=3] [ref=e208]
                  - paragraph [ref=e209]: تفکیک کاربران بر اساس نوع اشتراک
              - status [ref=e210]:
                - img [ref=e212]
                - heading "کاربری ثبت نشده است" [level=3] [ref=e217]
                - paragraph [ref=e218]: با افزوده‌شدن کاربران، توزیع سطوح اینجا نمایش داده می‌شود.
            - generic [ref=e219]:
              - generic [ref=e220]:
                - img [ref=e222]
                - heading "وضعیت سفارش‌ها" [level=3] [ref=e226]
              - status [ref=e227]:
                - img [ref=e229]
                - heading "سفارشی ثبت نشده" [level=3] [ref=e233]
                - paragraph [ref=e234]: با ثبت اولین سفارش، وضعیت آن‌ها اینجا نمایش داده می‌شود.
          - generic [ref=e235]:
            - generic [ref=e237]:
              - img [ref=e239]
              - generic [ref=e241]:
                - heading "فعالیت اخیر سیستم" [level=3] [ref=e242]
                - paragraph [ref=e243]: آخرین اقدامات مدیران
            - status [ref=e244]:
              - img [ref=e246]
              - heading "فعالیتی ثبت نشده" [level=3] [ref=e248]
              - paragraph [ref=e249]: اقدامات مدیران پس از انجام، به‌صورت زنده در این تایم‌لاین نمایش داده می‌شود.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import fs from 'node:fs/promises';
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
  17  | const unavailableQueries = [
  18  |   'backtest',
  19  |   'risk',
  20  |   'pnl',
  21  |   'heatmap',
  22  |   'model',
  23  |   'monitor',
  24  |   'cms',
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
  82  |   for (const query of unavailableQueries) {
  83  |     await input.fill(query);
  84  |     const emptyVisible = await page.getByText('نتیجه‌ای یافت نشد').isVisible();
  85  |     unavailableResults.push({ query, emptyVisible });
> 86  |     expect(emptyVisible, `${query} must not expose an actionable command`).toBe(true);
      |                                                                            ^ Error: cms must not expose an actionable command
  87  |   }
  88  | 
  89  |   await input.fill('signal');
  90  |   await expect(page.getByRole('button', { name: /سیگنال‌ها/ })).toHaveCount(1);
  91  |   await input.press('Enter');
  92  |   await expect(page).toHaveURL(/\/ai-signals$/);
  93  | 
  94  |   await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  95  |   await page.keyboard.press('Control+k');
  96  |   await expect(page.locator('input[aria-label="جستجو"]')).toBeFocused();
  97  |   await page.keyboard.press('Escape');
  98  |   await expect(page.locator('input[aria-label="جستجو"]')).toHaveCount(0);
  99  | 
  100 |   const ariaSnapshot = await page.locator('body').ariaSnapshot();
  101 |   await page.screenshot({ path: path.join(outDir, 'actual.png'), fullPage: true, animations: 'disabled' });
  102 |   await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${ariaSnapshot}\n`, 'utf8');
  103 |   await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify({
  104 |     schemaVersion: 1,
  105 |     requirementIds: ['PC-003', 'PC-005', 'PC-147', 'PC-159'],
  106 |     commit,
  107 |     runId,
  108 |     sourceFingerprint,
  109 |     project: testInfo.project.name,
  110 |     expectedOrigin,
  111 |     redirectResults,
  112 |     unavailableResults,
  113 |     enabledKeyboardResult: { query: 'signal', observedPath: '/ai-signals' },
  114 |     keyboardContract: { open: 'Control+k', activate: 'Enter', close: 'Escape' },
  115 |     unexpectedExternalRequests,
  116 |     pageErrors,
  117 |   }, null, 2)}\n`, 'utf8');
  118 | 
  119 |   expect(unexpectedExternalRequests).toEqual([]);
  120 |   expect(pageErrors).toEqual([]);
  121 | });
  122 | 
```