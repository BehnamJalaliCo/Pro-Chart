import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const evidenceDir = process.env.A11Y_FOCUS_EVIDENCE_DIR
  ? path.resolve(process.env.A11Y_FOCUS_EVIDENCE_DIR)
  : null;

async function writeEvidence(name, value) {
  if (!evidenceDir) return;
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('A11Y-FOCUS: onboarding traps focus, inerts the app, and restores focus on Escape', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Onboarding is intentionally disabled on desktop web');

  const mutations = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      mutations.push({ method: request.method(), pathname: new URL(request.url()).pathname });
    }
  });

  // Ensure this is a first-run context. AppShell renders before the deliberately delayed
  // onboarding overlay, giving the test a real control to use as the return-focus target.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__a11y_focus_initialized')) {
      localStorage.removeItem('pc_onboarded_v1');
      sessionStorage.setItem('__a11y_focus_initialized', '1');
    }
  });

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  const app = page.locator('.pc-approot');
  const returnTarget = app.locator('button:not([disabled])').first();
  await expect(returnTarget).toBeVisible();
  await returnTarget.evaluate((el) => el.setAttribute('data-onboarding-return-target', 'true'));
  await returnTarget.focus();
  await expect(returnTarget).toBeFocused();

  const dialog = page.getByRole('dialog');
  const heading = page.locator('#pc-onboarding-title');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-labelledby', 'pc-onboarding-title');
  await expect(dialog).toHaveAttribute('aria-describedby', 'pc-onboarding-description');
  await expect(app).toHaveAttribute('inert', '');
  await expect(app).toHaveAttribute('aria-hidden', 'true');
  await expect(heading).toBeFocused();
  expect(await page.evaluate(() => document.querySelector('.pc-approot').inert)).toBe(true);

  const dialogMotionMs = await page.locator('section.pc-screen-in').evaluate((element) => {
    const duration = getComputedStyle(element).animationDuration.split(',')[0].trim();
    return duration.endsWith('ms') ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000;
  });
  expect(dialogMotionMs).toBeGreaterThanOrEqual(200);
  expect(dialogMotionMs).toBeLessThanOrEqual(280);

  const buttons = dialog.locator('button');
  await expect(buttons).toHaveCount(2);
  const skip = buttons.nth(0);
  const next = buttons.nth(1);

  // Heading is the safe initial focus. Tab enters natural DOM order, and both ends wrap.
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(next).toBeFocused();

  // Slide content changes are live-announced while the action button retains focus.
  const firstTitle = await heading.textContent();
  await next.click();
  await expect(heading).not.toHaveText(firstTitle || '');
  await expect(next).toBeFocused();

  // Native inert blocks programmatic focus; the focusin guard is a fallback for older WebViews.
  await page.evaluate(() => document.querySelector('[data-onboarding-return-target="true"]').focus());
  expect(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement))).toBe(true);

  const axe = await new AxeBuilder({ page })
    .withRules(['aria-dialog-name', 'aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region'])
    .analyze();
  expect(axe.violations).toEqual([]);

  if (evidenceDir) {
    await page.screenshot({ path: path.join(evidenceDir, 'onboarding-open.png'), fullPage: true });
  }

  // Escape has the same durable close semantics as Skip and must not reach chart hotkeys.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(app).not.toHaveAttribute('inert', '');
  await expect(app).not.toHaveAttribute('aria-hidden', 'true');
  await expect(returnTarget).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('pc_onboarded_v1'))).toBe('1');

  if (evidenceDir) {
    await page.screenshot({ path: path.join(evidenceDir, 'onboarding-closed.png'), fullPage: true });
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.pc-launch')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.pc-approot')).not.toHaveAttribute('inert', '');

  const unexpectedMutations = mutations.filter(({ method, pathname }) => (
    !(method === 'POST' && pathname === '/api/academy/auth/bn-guest')
  ));
  expect(response?.status()).toBe(200);
  expect(unexpectedMutations).toEqual([]);

  const state = {
    scenario: 'mobile-first-run-onboarding-focus',
    project: testInfo.project.name,
    status: response?.status(),
    dialog: {
      role: 'dialog',
      modal: true,
      labelledBy: 'pc-onboarding-title',
      describedBy: 'pc-onboarding-description',
      initialFocus: 'pc-onboarding-title',
      focusableControls: 2,
      tabWrappedForward: true,
      tabWrappedBackward: true,
      escapedProgrammaticFocus: false,
    },
    background: {
      inertWhileOpen: true,
      ariaHiddenWhileOpen: true,
      restoredAfterClose: true,
    },
    close: {
      trigger: 'Escape',
      persisted: true,
      focusRestoredToPreviousControl: true,
      absentAfterReload: true,
    },
    axe: {
      engine: axe.testEngine,
      rules: ['aria-dialog-name', 'aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region'],
      violations: axe.violations.length,
    },
    requests: {
      unexpectedMutations,
    },
  };
  await writeEvidence('focus-state.json', state);
  await testInfo.attach('focus-state', {
    body: Buffer.from(JSON.stringify(state, null, 2)),
    contentType: 'application/json',
  });
});

test('A11Y-FOCUS: first-run desktop web keeps onboarding disabled and the app interactive', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'This assertion protects desktop-web behavior');

  await page.addInitScript(() => localStorage.removeItem('pc_onboarded_v1'));
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  const app = page.locator('.pc-approot');
  await expect(page.locator('.pc-launch')).toHaveCount(0);
  await expect(app).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(app).not.toHaveAttribute('inert', '');
  await expect(app).not.toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('main')).toHaveCount(1);
  expect(response?.status()).toBe(200);

  const state = {
    scenario: 'desktop-first-run-onboarding-disabled',
    project: testInfo.project.name,
    status: response?.status(),
    dialogCount: 0,
    appInteractive: true,
    mainCount: 1,
  };
  await writeEvidence('desktop-state.json', state);
  await testInfo.attach('desktop-state', {
    body: Buffer.from(JSON.stringify(state, null, 2)),
    contentType: 'application/json',
  });
});
