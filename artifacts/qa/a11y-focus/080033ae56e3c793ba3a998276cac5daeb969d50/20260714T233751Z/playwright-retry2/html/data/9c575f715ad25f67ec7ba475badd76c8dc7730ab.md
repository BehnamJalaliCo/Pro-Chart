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
                - generic [ref=e78]: "1.14236"
              - generic [ref=e79]:
                - generic [ref=e80]: L
                - generic [ref=e81]: "1.14230"
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
                  - generic [ref=e116]: "1.14231"
                  - generic [ref=e117]: SELL
                - generic [ref=e118]:
                  - generic [ref=e119]: "0"
                  - generic [ref=e120]: اسپرد
                - button [ref=e121] [cursor=pointer]:
                  - generic [ref=e122]: "1.14231"
                  - generic [ref=e123]: BUY
              - generic [ref=e124]:
                - generic [ref=e125]: "-0.00003"
                - generic [ref=e126]: (-0.00%)
            - generic:
              - img
              - generic: 19:29
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
              - generic [ref=e151]: 03:10:31
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
  37  |       const focused = document.activeElement === target;
  38  |       if (focused) window.__onboardingReturnTargetReady = true;
  39  |       return focused;
  40  |     };
  41  |     const observer = new MutationObserver(() => {
  42  |       if (markReturnTarget()) {
  43  |         observer.disconnect();
  44  |         clearInterval(retry);
  45  |       }
  46  |     });
  47  |     observer.observe(document.documentElement, { childList: true, subtree: true });
  48  |     const retry = setInterval(() => {
  49  |       if (markReturnTarget()) {
  50  |         observer.disconnect();
  51  |         clearInterval(retry);
  52  |       }
  53  |     }, 20);
  54  |     window.addEventListener('DOMContentLoaded', markReturnTarget, { once: true });
  55  |   });
  56  | 
  57  |   const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
> 58  |   await expect.poll(() => page.evaluate(() => window.__onboardingReturnTargetReady)).toBe(true);
      |                                                                                      ^ Error: expect(received).toBe(expected) // Object.is equality
  59  | 
  60  |   const app = page.locator('.pc-approot');
  61  |   const dialog = page.getByRole('dialog');
  62  |   const heading = page.locator('#pc-onboarding-title');
  63  |   const returnTarget = page.locator('[data-onboarding-return-target="true"]');
  64  |   await expect(dialog).toBeVisible();
  65  |   await expect(dialog).toHaveAttribute('aria-modal', 'true');
  66  |   await expect(dialog).toHaveAttribute('aria-labelledby', 'pc-onboarding-title');
  67  |   await expect(dialog).toHaveAttribute('aria-describedby', 'pc-onboarding-description');
  68  |   await expect(app).toHaveAttribute('inert', '');
  69  |   await expect(app).toHaveAttribute('aria-hidden', 'true');
  70  |   await expect(heading).toBeFocused();
  71  |   expect(await page.evaluate(() => document.querySelector('.pc-approot').inert)).toBe(true);
  72  | 
  73  |   const buttons = dialog.locator('button');
  74  |   await expect(buttons).toHaveCount(2);
  75  |   const skip = buttons.nth(0);
  76  |   const next = buttons.nth(1);
  77  | 
  78  |   // Heading is the safe initial focus. Tab enters natural DOM order, and both ends wrap.
  79  |   await page.keyboard.press('Tab');
  80  |   await expect(skip).toBeFocused();
  81  |   await page.keyboard.press('Tab');
  82  |   await expect(next).toBeFocused();
  83  |   await page.keyboard.press('Tab');
  84  |   await expect(skip).toBeFocused();
  85  |   await page.keyboard.press('Shift+Tab');
  86  |   await expect(next).toBeFocused();
  87  | 
  88  |   // Slide content changes are live-announced while the action button retains focus.
  89  |   const firstTitle = await heading.textContent();
  90  |   await next.click();
  91  |   await expect(heading).not.toHaveText(firstTitle || '');
  92  |   await expect(next).toBeFocused();
  93  | 
  94  |   // Native inert blocks programmatic focus; the focusin guard is a fallback for older WebViews.
  95  |   await page.evaluate(() => document.querySelector('[data-onboarding-return-target="true"]').focus());
  96  |   expect(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))).toBe(true);
  97  | 
  98  |   const axe = await new AxeBuilder({ page })
  99  |     .withRules(['aria-dialog-name', 'aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region'])
  100 |     .analyze();
  101 |   expect(axe.violations).toEqual([]);
  102 | 
  103 |   if (evidenceDir) {
  104 |     await page.screenshot({ path: path.join(evidenceDir, 'onboarding-open.png'), fullPage: true });
  105 |   }
  106 | 
  107 |   // Escape has the same durable close semantics as Skip and must not reach chart hotkeys.
  108 |   await page.keyboard.press('Escape');
  109 |   await expect(dialog).toHaveCount(0);
  110 |   await expect(app).not.toHaveAttribute('inert', '');
  111 |   await expect(app).not.toHaveAttribute('aria-hidden', 'true');
  112 |   await expect(returnTarget).toBeFocused();
  113 |   expect(await page.evaluate(() => localStorage.getItem('pc_onboarded_v1'))).toBe('1');
  114 | 
  115 |   if (evidenceDir) {
  116 |     await page.screenshot({ path: path.join(evidenceDir, 'onboarding-closed.png'), fullPage: true });
  117 |   }
  118 | 
  119 |   await page.reload({ waitUntil: 'domcontentloaded' });
  120 |   await expect(page.locator('.pc-launch')).toHaveCount(0);
  121 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  122 |   await expect(page.locator('.pc-approot')).not.toHaveAttribute('inert', '');
  123 | 
  124 |   const unexpectedMutations = mutations.filter(({ method, pathname }) => (
  125 |     !(method === 'POST' && pathname === '/api/academy/auth/bn-guest')
  126 |   ));
  127 |   expect(response?.status()).toBe(200);
  128 |   expect(unexpectedMutations).toEqual([]);
  129 | 
  130 |   const state = {
  131 |     scenario: 'mobile-first-run-onboarding-focus',
  132 |     project: testInfo.project.name,
  133 |     status: response?.status(),
  134 |     dialog: {
  135 |       role: 'dialog',
  136 |       modal: true,
  137 |       labelledBy: 'pc-onboarding-title',
  138 |       describedBy: 'pc-onboarding-description',
  139 |       initialFocus: 'pc-onboarding-title',
  140 |       focusableControls: 2,
  141 |       tabWrappedForward: true,
  142 |       tabWrappedBackward: true,
  143 |       escapedProgrammaticFocus: false,
  144 |     },
  145 |     background: {
  146 |       inertWhileOpen: true,
  147 |       ariaHiddenWhileOpen: true,
  148 |       restoredAfterClose: true,
  149 |     },
  150 |     close: {
  151 |       trigger: 'Escape',
  152 |       persisted: true,
  153 |       focusRestoredToPreviousControl: true,
  154 |       absentAfterReload: true,
  155 |     },
  156 |     axe: {
  157 |       engine: axe.testEngine,
  158 |       rules: ['aria-dialog-name', 'aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region'],
```