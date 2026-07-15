import { test, expect } from '@playwright/test';
import {
  createFixtureState,
  installSyntheticFixture,
  safeError,
  sha256,
  waitForFinalFonts,
} from '../support/synthetic-prochart-fixture.mjs';

const WORKSPACE_KEY = 'bn_workspace';

async function readDrawings(page) {
  return page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key) || '{}');
    return Array.isArray(workspace.drawings) ? workspace.drawings : [];
  }, WORKSPACE_KEY);
}

test.use({ trace: 'on', video: 'on' });

test('MOT-006: toolbar undo/redo and drawing persistence survive reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'drawing toolbar evidence is desktop-only');

  const state = createFixtureState();
  page.on('pageerror', (error) => state.pageErrors.push(safeError(error)));
  page.on('requestfailed', (request) => state.requestFailures.push({
    method: request.method(),
    pathname: new URL(request.url()).pathname,
    error: request.failure()?.errorText || 'unknown',
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) state.badResponses.push({
      status: response.status(),
      pathname: new URL(response.url()).pathname,
    });
  });

  await installSyntheticFixture(
    page,
    testInfo,
    { id: 'drawing-history-e2e', onboarding: false },
    state,
    { preserveWorkspaceOnReload: true },
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForFinalFonts(page);

  const overlay = page.locator('canvas.absolute.inset-0.z-10');
  const undo = page.getByTitle('واگرد (Ctrl+Z)');
  const redo = page.getByTitle('ازنو (Ctrl+Y)');
  await expect(overlay).toBeVisible();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  await page.keyboard.press('Control+Alt+D');
  await expect.poll(() => page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key) || '{}');
    return workspace.stayDraw;
  }, WORKSPACE_KEY)).toBe(true);
  await page.keyboard.press('Alt+H');
  await expect(overlay).toHaveCSS('pointer-events', 'auto');
  for (let index = 0; index < 50; index += 1) {
    await overlay.click({
      position: {
        x: box.width * 0.45,
        y: box.height * (0.2 + (index % 20) * 0.025),
      },
    });
  }

  await expect.poll(async () => (await readDrawings(page)).length).toBe(50);
  const created = await readDrawings(page);
  expect(created).toHaveLength(50);
  expect(created.every((drawing) => drawing.type === 'hline' && Number.isFinite(drawing.p))).toBe(true);
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();

  await undo.evaluate((button) => {
    for (let index = 0; index < 50; index += 1) button.click();
  });
  await expect.poll(async () => (await readDrawings(page)).length).toBe(0);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();

  await redo.evaluate((button) => {
    for (let index = 0; index < 50; index += 1) button.click();
  });
  await expect.poll(() => readDrawings(page)).toEqual(created);
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(overlay).toBeVisible();
  await expect.poll(() => readDrawings(page)).toEqual(created);
  await page.waitForTimeout(650);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  // A new command after hydration must snapshot the restored 50 drawings. Its
  // undo proves that reload populated DrawingLayer, not merely localStorage.
  await page.keyboard.press('Alt+H');
  await expect(overlay).toHaveCSS('pointer-events', 'auto');
  await overlay.click({ position: { x: box.width * 0.55, y: box.height * 0.72 } });
  await expect.poll(async () => (await readDrawings(page)).length).toBe(51);
  await undo.click();
  await expect.poll(() => readDrawings(page)).toEqual(created);

  const evidence = {
    scenario: 'MOT-006',
    project: testInfo.project.name,
    commands: {
      createHline: 50,
      undoToolbar: 50,
      redoToolbar: 50,
      reload: 1,
      postReloadCreateUndo: 1,
    },
    persistedCount: created.length,
    persistedSha256: sha256(JSON.stringify(created)),
    workspaceKey: WORKSPACE_KEY,
    network: {
      unexpectedExternal: state.unexpectedExternal,
      pageErrors: state.pageErrors,
      requestFailures: state.requestFailures,
      badResponses: state.badResponses,
    },
  };
  await testInfo.attach('drawing-history-e2e-evidence', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  });

  expect(state.unexpectedExternal, 'external requests are forbidden').toEqual([]);
  expect(state.pageErrors, 'uncaught page errors').toEqual([]);
  expect(state.requestFailures, 'failed requests').toEqual([]);
  expect(state.badResponses, 'HTTP responses >= 400').toEqual([]);
});
