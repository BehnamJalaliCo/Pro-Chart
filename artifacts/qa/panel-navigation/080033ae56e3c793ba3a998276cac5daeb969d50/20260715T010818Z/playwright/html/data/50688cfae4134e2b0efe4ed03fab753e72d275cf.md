# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: panel-navigation.spec.mjs >> PANEL-NAV: legacy aliases resolve and unavailable palette actions stay hidden
- Location: tests/panel-navigation.spec.mjs:27:1

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator: locator('input[aria-label="جستجو"]')
Expected: focused
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeFocused" with timeout 10000ms
  - waiting for locator('input[aria-label="جستجو"]')

```

```yaml
- complementary:
  - text: ب
  - heading "بازارنما" [level=1]
  - paragraph: پنل مدیریت
  - navigation "ناوبری اصلی":
    - link "داشبورد":
      - /url: /dashboard
      - img
      - text: داشبورد
    - link "کاربران":
      - /url: /users
      - img
      - text: کاربران
    - link "اشتراک‌ها و پرداخت‌ها":
      - /url: /subscriptions
      - img
      - text: اشتراک‌ها و پرداخت‌ها
    - link "سفارش‌ها":
      - /url: /orders
      - img
      - text: سفارش‌ها
    - link "اتصال صرافی":
      - /url: /exchange
      - img
      - text: اتصال صرافی
    - link "سیگنال‌های AI":
      - /url: /ai-signals
      - img
      - text: سیگنال‌های AI
    - link "چارت‌ها و واچ‌لیست":
      - /url: /charts
      - img
      - text: چارت‌ها و واچ‌لیست
    - link "تبلیغات":
      - /url: /ads
      - img
      - text: تبلیغات
    - link "اخبار و تقویم":
      - /url: /news
      - img
      - text: اخبار و تقویم
    - link "پیام‌رسانی":
      - /url: /broadcasts
      - img
      - text: پیام‌رسانی
    - link "آنالیتیکس":
      - /url: /analytics
      - img
      - text: آنالیتیکس
    - link "تنظیمات":
      - /url: /settings
      - img
      - text: تنظیمات
  - button "جمع کردن منو":
    - img
    - text: جمع کردن
  - button "خروج":
    - img
    - text: خروج
- banner:
  - heading "پنل مدیریت بازارنما" [level=2]
  - button "جستجوی سریع":
    - img
    - text: جستجو ⌘K
  - text: ۱۴۰۵ تیر ۲۴, چهارشنبه م
- main:
  - status:
    - img
    - heading "داده‌ی بازار در دسترس نیست" [level=3]
    - paragraph: در حال حاضر نمادی برای نمایش وجود ندارد.
  - heading "داشبورد بازارنما" [level=1]
  - paragraph: نمای کلیِ زنده از کاربران، بازار و زیرساخت
  - text: زنده
  - status:
    - img
    - heading "هنوز داده‌ای ثبت نشده است" [level=3]
    - paragraph: با فعال شدن کاربران و تراکنش‌ها، شاخص‌های کلیدی اینجا نمایش داده می‌شوند.
  - img
  - heading "واچ‌لیست بازار" [level=3]
  - paragraph: ۰ نماد زنده
  - status:
    - img
    - heading "نمادی برای نمایش نیست" [level=3]
    - paragraph: در حال حاضر داده‌ی زنده‌ای از بازار در دسترس نیست.
  - status:
    - img
    - heading "داده‌ی بازار در دسترس نیست" [level=3]
    - paragraph: در حال حاضر حرکتی برای نمایش وجود ندارد.
  - status:
    - img
    - heading "داده‌ای از سرور در دسترس نیست" [level=3]
    - paragraph: متریک‌های منابع سرور در حال حاضر قابل دریافت نیستند.
  - img
  - heading "روند ثبت‌نام کاربران" [level=3]
  - paragraph: ۳۰ روز گذشته
  - status:
    - img
    - heading "هنوز ثبت‌نامی ثبت نشده" [level=3]
    - paragraph: با ثبت‌نام کاربران جدید، روند رشد در این نمودار نمایش داده می‌شود.
  - img
  - heading "توزیع سطوح اشتراک" [level=3]
  - paragraph: تفکیک کاربران بر اساس نوع اشتراک
  - status:
    - img
    - heading "کاربری ثبت نشده است" [level=3]
    - paragraph: با افزوده‌شدن کاربران، توزیع سطوح اینجا نمایش داده می‌شود.
  - img
  - heading "وضعیت سفارش‌ها" [level=3]
  - status:
    - img
    - heading "سفارشی ثبت نشده" [level=3]
    - paragraph: با ثبت اولین سفارش، وضعیت آن‌ها اینجا نمایش داده می‌شود.
  - img
  - heading "فعالیت اخیر سیستم" [level=3]
  - paragraph: آخرین اقدامات مدیران
  - status:
    - img
    - heading "فعالیتی ثبت نشده" [level=3]
    - paragraph: اقدامات مدیران پس از انجام، به‌صورت زنده در این تایم‌لاین نمایش داده می‌شود.
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
  96  |   await page.keyboard.press('Control+k');
> 97  |   await expect(page.locator('input[aria-label="جستجو"]')).toBeFocused();
      |                                                           ^ Error: expect(locator).toBeFocused() failed
  98  |   await page.keyboard.press('Escape');
  99  |   await expect(page.locator('input[aria-label="جستجو"]')).toHaveCount(0);
  100 | 
  101 |   const ariaSnapshot = await page.locator('body').ariaSnapshot();
  102 |   await page.screenshot({ path: path.join(outDir, 'actual.png'), fullPage: true, animations: 'disabled' });
  103 |   await fs.writeFile(path.join(outDir, 'aria-snapshot.yml'), `${ariaSnapshot}\n`, 'utf8');
  104 |   await fs.writeFile(path.join(outDir, 'metadata.json'), `${JSON.stringify({
  105 |     schemaVersion: 1,
  106 |     requirementIds: ['PC-003', 'PC-005', 'PC-147', 'PC-159'],
  107 |     commit,
  108 |     runId,
  109 |     sourceFingerprint,
  110 |     project: testInfo.project.name,
  111 |     expectedOrigin,
  112 |     redirectResults,
  113 |     unavailableResults,
  114 |     enabledKeyboardResult: { query: 'signal', observedPath: '/ai-signals' },
  115 |     keyboardContract: { open: 'Control+k', activate: 'Enter', close: 'Escape' },
  116 |     unexpectedExternalRequests,
  117 |     pageErrors,
  118 |   }, null, 2)}\n`, 'utf8');
  119 | 
  120 |   expect(unexpectedExternalRequests).toEqual([]);
  121 |   expect(pageErrors).toEqual([]);
  122 | });
  123 | 
```