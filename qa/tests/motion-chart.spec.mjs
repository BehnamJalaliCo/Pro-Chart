import { test, expect } from '@playwright/test';
import {
  createFixtureState,
  installSyntheticFixture,
  waitForFinalFonts,
} from '../support/synthetic-prochart-fixture.mjs';

test.use({ trace: 'on', video: 'on' });

test('MOTION-002: wheel over chart is captured without page-scroll conflict', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'chart wheel characterization is desktop-only');

  const state = createFixtureState();
  await installSyntheticFixture(page, testInfo, { id: 'motion-chart', onboarding: false }, state);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas').first()).toBeVisible();
  await waitForFinalFonts(page);

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.evaluate(() => {
    window.__pcMotionWheel = { count: 0, deltaY: 0, defaultPrevented: false };
    document.addEventListener('wheel', (event) => {
      window.__pcMotionWheel.count += 1;
      window.__pcMotionWheel.deltaY += event.deltaY;
      window.__pcMotionWheel.defaultPrevented ||= event.defaultPrevented;
    }, { capture: true, passive: false });
  });
  const before = await page.evaluate(() => ({ x: scrollX, y: scrollY, url: location.href }));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    scroll: { x: scrollX, y: scrollY },
    url: location.href,
    wheel: window.__pcMotionWheel,
  }));
  const afterBox = await canvas.boundingBox();

  expect(after.wheel.count).toBeGreaterThan(0);
  expect(after.wheel.deltaY).toBe(240);
  expect(after.scroll).toEqual({ x: before.x, y: before.y });
  expect(after.url).toBe(before.url);
  expect(afterBox).toEqual(box);
  await testInfo.attach('motion-wheel-evidence', {
    body: Buffer.from(JSON.stringify({ scenario: 'MOT-002', before, after }, null, 2)),
    contentType: 'application/json',
  });
});

test('MOTION-008: reduced-motion collapses global animation and transition durations', async ({ page }, testInfo) => {
  const state = createFixtureState();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installSyntheticFixture(page, testInfo, { id: 'motion-reduced', onboarding: false }, state);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.pc-approot')).toBeVisible();

  const styles = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'pc-spin pc-chart-swap';
    probe.style.transitionProperty = 'opacity';
    probe.style.transitionDuration = '2s';
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe);
    const root = getComputedStyle(document.documentElement);
    const result = {
      animationDuration: computed.animationDuration,
      animationIterationCount: computed.animationIterationCount,
      transitionDuration: computed.transitionDuration,
      scrollBehavior: root.scrollBehavior,
    };
    probe.remove();
    return result;
  });

  const seconds = (value) => value.split(',').map((token) => {
    const item = token.trim();
    return item.endsWith('ms') ? Number.parseFloat(item) / 1000 : Number.parseFloat(item);
  });
  expect(seconds(styles.animationDuration).every((value) => value <= 0.00001)).toBe(true);
  expect(seconds(styles.transitionDuration).every((value) => value <= 0.00001)).toBe(true);
  expect(styles.animationIterationCount.split(',').every((value) => Number.parseFloat(value) <= 1)).toBe(true);
  expect(styles.scrollBehavior).toBe('auto');

  await testInfo.attach('reduced-motion-evidence', {
    body: Buffer.from(JSON.stringify({ scenario: 'MOT-008', styles }, null, 2)),
    contentType: 'application/json',
  });
});
