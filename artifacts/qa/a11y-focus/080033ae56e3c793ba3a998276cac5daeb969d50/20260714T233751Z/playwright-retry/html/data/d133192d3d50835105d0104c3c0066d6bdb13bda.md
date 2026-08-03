# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-focus.spec.mjs >> A11Y-FOCUS: onboarding traps focus, inerts the app, and restores focus on Escape
- Location: tests/onboarding-focus.spec.mjs:16:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 10000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - main [ref=e4]:
      - heading [level=1] [ref=e5]: Pro-Chart — چارت حرفه‌ای بازارهای مالی
      - generic [ref=e6]:
        - generic [ref=e7]:
          - button [ref=e8] [cursor=pointer]:
            - generic [ref=e9]:
              - img [ref=e12]
              - img [ref=e25]
            - generic [ref=e29]: EURUSD
          - generic [ref=e33]: "1.14230"
          - button [ref=e34] [cursor=pointer]:
            - text: 1H
            - img [ref=e35]
          - button [ref=e37] [cursor=pointer]:
            - img [ref=e38]
          - button [ref=e41] [cursor=pointer]:
            - img [ref=e42]
        - generic [ref=e44]:
          - generic [ref=e45]:
            - generic [ref=e46]:
              - img [ref=e49]
              - img [ref=e62]
            - generic [ref=e66]: EURUSD
            - generic [ref=e67]: 1H · فارکس
            - img [ref=e68]
            - generic [ref=e72]:
              - generic [ref=e73]:
                - generic [ref=e74]: O
                - generic [ref=e75]: "1.14233"
              - generic [ref=e76]:
                - generic [ref=e77]: H
                - generic [ref=e78]: "1.14233"
              - generic [ref=e79]:
                - generic [ref=e80]: L
                - generic [ref=e81]: "1.14225"
              - generic [ref=e82]:
                - generic [ref=e83]: C
                - generic [ref=e84]: "1.14230"
            - generic [ref=e85]: −0.00003 (−0.00%)
            - generic [ref=e86]:
              - generic [ref=e87]: Vol
              - generic [ref=e88]: "0"
            - button [ref=e89] [cursor=pointer]:
              - img [ref=e90]
          - generic [ref=e93]:
            - table [ref=e96]:
              - row [ref=e97]:
                - cell [ref=e98]
                - cell [ref=e102]
              - row [ref=e106]:
                - cell [ref=e107]
                - cell [ref=e111]
            - generic:
              - generic [ref=e114]:
                - button [ref=e115] [cursor=pointer]:
                  - generic [ref=e116]: "1.14230"
                  - generic [ref=e117]: SELL
                - generic [ref=e118]:
                  - generic [ref=e119]: "0"
                  - generic [ref=e120]: اسپرد
                - button [ref=e121] [cursor=pointer]:
                  - generic [ref=e122]: "1.14230"
                  - generic [ref=e123]: BUY
              - generic [ref=e124]:
                - generic [ref=e125]: "-0.00004"
                - generic [ref=e126]: (-0.00%)
            - generic:
              - img
              - generic: 20:40
            - generic [ref=e127]:
              - button [ref=e128] [cursor=pointer]: ٪
              - button [ref=e129] [cursor=pointer]: log
              - button [ref=e130] [cursor=pointer]: auto
            - generic:
              - img
              - generic: حجم · Vol
            - img
          - generic [ref=e131]:
            - button [ref=e132] [cursor=pointer]: 1D
            - button [ref=e133] [cursor=pointer]: 5D
            - button [ref=e134] [cursor=pointer]: 1M
            - button [ref=e135] [cursor=pointer]: 3M
            - button [ref=e136] [cursor=pointer]: 6M
            - button [ref=e137] [cursor=pointer]: YTD
            - button [ref=e138] [cursor=pointer]: 1Y
            - button [ref=e139] [cursor=pointer]: 5Y
            - button [ref=e140] [cursor=pointer]: All
            - button [ref=e142] [cursor=pointer]:
              - img [ref=e143]
            - button [ref=e147] [cursor=pointer]:
              - img [ref=e148]
              - generic [ref=e151]: 03:09:20
              - generic [ref=e152]: (تهران)
    - navigation [ref=e153]:
      - button [ref=e154] [cursor=pointer]:
        - img [ref=e156]
        - generic [ref=e160]: چارت
      - button [ref=e161] [cursor=pointer]:
        - img [ref=e163]
        - generic [ref=e164]: واچ‌لیست
      - button [ref=e165] [cursor=pointer]:
        - img [ref=e167]
      - button [ref=e169] [cursor=pointer]:
        - img [ref=e171]
        - generic [ref=e174]: بازارها
      - button [ref=e175] [cursor=pointer]:
        - img [ref=e177]
        - generic [ref=e180]: پروفایل
  - region "چارتِ حرفه‌ای" [ref=e181]:
    - dialog "چارتِ حرفه‌ای" [ref=e182]:
      - generic [ref=e183]:
        - img "Pro-Chart" [ref=e184]
        - button "رد شدن" [ref=e185] [cursor=pointer]
      - generic [ref=e187]:
        - img [ref=e189]
        - heading "چارتِ حرفه‌ای" [active] [level=2] [ref=e193]
        - paragraph [ref=e194]: چارتِ حرفه‌ای با ۸۰+ اندیکاتور، ۱۳ نوعِ چارت و مجموعهٔ کاملِ ابزارِ ترسیم.
      - button "بعدی" [ref=e200] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | import fs from 'node:fs/promises';
  4   | import path from 'node:path';
  5   | 
  6   | const evidenceDir = process.env.A11Y_FOCUS_EVIDENCE_DIR
  7   |   ? path.resolve(process.env.A11Y_FOCUS_EVIDENCE_DIR)
  8   |   : null;
  9   | 
  10  | async function writeEvidence(name, value) {
  11  |   if (!evidenceDir) return;
  12  |   await fs.mkdir(evidenceDir, { recursive: true });
  13  |   await fs.writeFile(path.join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  14  | }
  15  | 
  16  | test('A11Y-FOCUS: onboarding traps focus, inerts the app, and restores focus on Escape', async ({ page }, testInfo) => {
  17  |   test.skip(!testInfo.project.name.includes('mobile'), 'Onboarding is intentionally disabled on desktop web');
  18  | 
  19  |   const mutations = [];
  20  |   page.on('request', (request) => {
  21  |     if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
  22  |       mutations.push({ method: request.method(), pathname: new URL(request.url()).pathname });
  23  |     }
  24  |   });
  25  | 
  26  |   // Mark and focus a real app control as soon as AppShell mounts, before the delayed
  27  |   // onboarding overlay opens. This gives focus restoration an exact opener surrogate.
  28  |   await page.addInitScript(() => {
  29  |     localStorage.removeItem('pc_onboarded_v1');
  30  |     window.__onboardingReturnTargetReady = false;
  31  |     const markReturnTarget = () => {
  32  |       const candidates = Array.from(document.querySelectorAll('.pc-approot button:not([disabled])'));
  33  |       const target = candidates.find((el) => el.getClientRects().length > 0);
  34  |       if (!target) return false;
  35  |       target.setAttribute('data-onboarding-return-target', 'true');
  36  |       target.focus({ preventScroll: true });
  37  |       window.__onboardingReturnTargetReady = document.activeElement === target;
  38  |       return window.__onboardingReturnTargetReady;
  39  |     };
  40  |     const observer = new MutationObserver(() => {
  41  |       if (markReturnTarget()) {
  42  |         observer.disconnect();
  43  |         clearInterval(retry);
  44  |       }
  45  |     });
  46  |     observer.observe(document.documentElement, { childList: true, subtree: true });
  47  |     const retry = setInterval(() => {
  48  |       if (markReturnTarget()) {
  49  |         observer.disconnect();
  50  |         clearInterval(retry);
  51  |       }
  52  |     }, 20);
  53  |     window.addEventListener('DOMContentLoaded', markReturnTarget, { once: true });
  54  |   });
  55  | 
  56  |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
> 57  |   await expect.poll(() => page.evaluate(() => window.__onboardingReturnTargetReady)).toBe(true);
      |                                                                                      ^ Error: expect(received).toBe(expected) // Object.is equality
  58  | 
  59  |   const app = page.locator('.pc-approot');
  60  |   const dialog = page.getByRole('dialog');
  61  |   const heading = page.locator('#pc-onboarding-title');
  62  |   const returnTarget = page.locator('[data-onboarding-return-target="true"]');
  63  |   await expect(dialog).toBeVisible();
  64  |   await expect(dialog).toHaveAttribute('aria-modal', 'true');
  65  |   await expect(dialog).toHaveAttribute('aria-labelledby', 'pc-onboarding-title');
  66  |   await expect(dialog).toHaveAttribute('aria-describedby', 'pc-onboarding-description');
  67  |   await expect(app).toHaveAttribute('inert', '');
  68  |   await expect(app).toHaveAttribute('aria-hidden', 'true');
  69  |   await expect(heading).toBeFocused();
  70  |   expect(await page.evaluate(() => document.querySelector('.pc-approot').inert)).toBe(true);
  71  | 
  72  |   const buttons = dialog.locator('button');
  73  |   await expect(buttons).toHaveCount(2);
  74  |   const skip = buttons.nth(0);
  75  |   const next = buttons.nth(1);
  76  | 
  77  |   // Heading is the safe initial focus. Tab enters natural DOM order, and both ends wrap.
  78  |   await page.keyboard.press('Tab');
  79  |   await expect(skip).toBeFocused();
  80  |   await page.keyboard.press('Tab');
  81  |   await expect(next).toBeFocused();
  82  |   await page.keyboard.press('Tab');
  83  |   await expect(skip).toBeFocused();
  84  |   await page.keyboard.press('Shift+Tab');
  85  |   await expect(next).toBeFocused();
  86  | 
  87  |   // Slide content changes are live-announced while the action button retains focus.
  88  |   const firstTitle = await heading.textContent();
  89  |   await next.click();
  90  |   await expect(heading).not.toHaveText(firstTitle || '');
  91  |   await expect(next).toBeFocused();
  92  | 
  93  |   // Native inert blocks programmatic focus; the focusin guard is a fallback for older WebViews.
  94  |   await page.evaluate(() => document.querySelector('[data-onboarding-return-target="true"]').focus());
  95  |   expect(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))).toBe(true);
  96  | 
  97  |   const axe = await new AxeBuilder({ page })
  98  |     .withRules(['aria-dialog-name', 'aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region'])
  99  |     .analyze();
  100 |   expect(axe.violations).toEqual([]);
  101 | 
  102 |   if (evidenceDir) {
  103 |     await page.screenshot({ path: path.join(evidenceDir, 'onboarding-open.png'), fullPage: true });
  104 |   }
  105 | 
  106 |   // Escape has the same durable close semantics as Skip and must not reach chart hotkeys.
  107 |   await page.keyboard.press('Escape');
  108 |   await expect(dialog).toHaveCount(0);
  109 |   await expect(app).not.toHaveAttribute('inert', '');
  110 |   await expect(app).not.toHaveAttribute('aria-hidden', 'true');
  111 |   await expect(returnTarget).toBeFocused();
  112 |   expect(await page.evaluate(() => localStorage.getItem('pc_onboarded_v1'))).toBe('1');
  113 | 
  114 |   if (evidenceDir) {
  115 |     await page.screenshot({ path: path.join(evidenceDir, 'onboarding-closed.png'), fullPage: true });
  116 |   }
  117 | 
  118 |   await page.reload({ waitUntil: 'domcontentloaded' });
  119 |   await expect(page.locator('.pc-launch')).toHaveCount(0);
  120 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  121 |   await expect(page.locator('.pc-approot')).not.toHaveAttribute('inert', '');
  122 | 
  123 |   const unexpectedMutations = mutations.filter(({ method, pathname }) => (
  124 |     !(method === 'POST' && pathname === '/api/academy/auth/bn-guest')
  125 |   ));
  126 |   expect(response?.status()).toBe(200);
  127 |   expect(unexpectedMutations).toEqual([]);
  128 | 
  129 |   const state = {
  130 |     scenario: 'mobile-first-run-onboarding-focus',
  131 |     project: testInfo.project.name,
  132 |     status: response?.status(),
  133 |     dialog: {
  134 |       role: 'dialog',
  135 |       modal: true,
  136 |       labelledBy: 'pc-onboarding-title',
  137 |       describedBy: 'pc-onboarding-description',
  138 |       initialFocus: 'pc-onboarding-title',
  139 |       focusableControls: 2,
  140 |       tabWrappedForward: true,
  141 |       tabWrappedBackward: true,
  142 |       escapedProgrammaticFocus: false,
  143 |     },
  144 |     background: {
  145 |       inertWhileOpen: true,
  146 |       ariaHiddenWhileOpen: true,
  147 |       restoredAfterClose: true,
  148 |     },
  149 |     close: {
  150 |       trigger: 'Escape',
  151 |       persisted: true,
  152 |       focusRestoredToPreviousControl: true,
  153 |       absentAfterReload: true,
  154 |     },
  155 |     axe: {
  156 |       engine: axe.testEngine,
  157 |       rules: ['aria-dialog-name', 'aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region'],
```