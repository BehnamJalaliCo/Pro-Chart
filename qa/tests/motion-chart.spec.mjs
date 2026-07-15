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
