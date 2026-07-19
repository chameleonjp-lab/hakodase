import { test, expect } from '@playwright/test';

function watchBrowserErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => Math.max(
    0,
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ))).toBeLessThanOrEqual(1);
}

async function startMode(page, mode = 'practice') {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'home');
  await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator('#homeStart').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'nameConfirm');
  await page.locator('#playerNameInput').fill('ブラウザ検証係');
  await page.locator('#nameForm button[type="submit"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'countdown');
  await expect(page.locator('#screenPlaying')).toBeHidden();
  await expect(page.locator('#time')).toHaveText('0.00秒');
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'playing', { timeout: 7_000 });
  await expect(page.locator('#board')).toBeVisible();
  await expect.poll(() => page.locator('#time').textContent()).not.toBe('0.00秒');
}

async function forceClear(page, values = {}) {
  await page.evaluate(async (input) => {
    const game = window.hakodase;
    const now = performance.now();
    game.engine.positions = game.engine.positions.map(() => null);
    game.engine.swipeCount = input.swipeCount ?? 7;
    game.engine.distanceCells = input.distanceCells ?? 24;
    game.engine.undoCount = input.undoCount ?? 1;
    game.engine.status = 'cleared';
    game.engine.clearedAt = now;
    game.engine.finalElapsedMs = input.timeMs ?? 1234;
    await game._onClear();
  }, values);
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'result', { timeout: 7_000 });
}

test('各対象画面幅でホームが収まり、コンソールエラーがない', async ({ page }, testInfo) => {
  const errors = watchBrowserErrors(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'home');
  await expect(page.locator('#homeStart')).toBeVisible();
  await expect(page.locator('#homeLab')).toHaveAttribute('href', /chameleonjp_lab/);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('homeからnameConfirm、countdown、playingへ一度ずつ進む', async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await startMode(page, 'practice');
  await expect(page.locator('#runMode')).toContainText('練習');
  await expect(page.locator('#remaining')).toContainText('箱');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('クリア結果を一度だけ表示し、共有フォールバックと再挑戦が動く', async ({ page }, testInfo) => {
  const errors = watchBrowserErrors(page);
  await page.addInitScript(() => {
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); } catch (_) { /* noop */ }
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); } catch (_) { /* noop */ }
  });
  await startMode(page, 'endless');
  const firstPlayId = await page.evaluate(() => window.hakodase.currentPlayId);
  await forceClear(page, { timeMs: 1234, swipeCount: 7, distanceCells: 24, undoCount: 1 });

  await expect(page.locator('#resultTime')).toHaveText('1.23秒');
  await expect(page.locator('#resultSwipes')).toHaveText('7操作');
  await expect(page.locator('#resultDistance')).toHaveText('24マス');
  await expect(page.locator('#resultUndo')).toHaveText('1回');
  await expect(page.locator('#resultFirst')).not.toHaveText('記録対象外');
  await expect(page.locator('#resultBest')).not.toHaveText('記録対象外');
  await expect(page.locator('#resultNext')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true });

  await page.locator('#resultShare').click();
  await expect(page.locator('#resultShareFallback')).toBeVisible();
  await expect(page.locator('#resultShareFallback')).toHaveValue(/HAKODASE/);
  await expect(page.locator('#resultShareFallback')).toHaveValue(/http:\/\/127\.0\.0\.1:4173/);

  await page.locator('#resultRetry').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'countdown');
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'playing', { timeout: 7_000 });
  const nextPlayId = await page.evaluate(() => window.hakodase.currentPlayId);
  expect(nextPlayId).toBeGreaterThan(firstPlayId);
  expect(errors).toEqual([]);
});

test('pointercancelとlostpointercaptureは操作を確定しない', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390-webkit', '代表モバイルWebKitで入力中断を検証する');
  const errors = watchBrowserErrors(page);
  await startMode(page, 'practice');

  const point = await page.evaluate(() => {
    const game = window.hakodase;
    const blockIndex = game.engine.positions.findIndex(Boolean);
    const position = game.engine.positions[blockIndex];
    const layout = game.renderer.getLayout();
    const rect = game.canvas.getBoundingClientRect();
    return {
      x: rect.left + layout.originX + (position.x + 0.5) * layout.cell,
      y: rect.top + layout.originY + (position.y + 0.5) * layout.cell,
    };
  });

  const before = await page.evaluate(() => window.hakodase.engine.swipeCount);
  await page.evaluate(({ x, y }) => {
    const canvas = document.getElementById('board');
    const init = { bubbles: true, cancelable: true, composed: true, pointerId: 41, pointerType: 'touch', isPrimary: true };
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x, clientY: y }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + 80, clientY: y }));
    canvas.dispatchEvent(new PointerEvent('pointercancel', { ...init, clientX: x + 80, clientY: y }));

    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 42, clientX: x, clientY: y }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...init, pointerId: 42, clientX: x, clientY: y + 80 }));
    canvas.dispatchEvent(new PointerEvent('lostpointercapture', { ...init, pointerId: 42, clientX: x, clientY: y + 80 }));
  }, point);

  const state = await page.evaluate(() => ({
    swipeCount: window.hakodase.engine.swipeCount,
    activeId: window.hakodase.input.activeId,
    dragIndex: window.hakodase.dragIndex,
    preview: window.hakodase.preview,
  }));
  expect(state.swipeCount).toBe(before);
  expect(state.activeId).toBeNull();
  expect(state.dragIndex).toBe(-1);
  expect(state.preview).toBeNull();
  expect(errors).toEqual([]);
});

test('リタイアは確認後だけ確定し、結果画面を作らない', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390-webkit', '代表モバイルWebKitで確認パネルを検証する');
  const errors = watchBrowserErrors(page);
  await startMode(page, 'practice');

  await page.locator('#playHome').click();
  await expect(page.locator('#retireConfirm')).toBeVisible();
  await page.locator('#retireContinue').click();
  await expect(page.locator('#retireConfirm')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'playing');

  await page.locator('#playHome').click();
  await page.locator('#retireConfirmButton').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'home');
  await expect(page.locator('#screenResult')).toBeHidden();
  await expect(page.locator('#homeMessage')).toContainText('リタイア');
  expect(errors).toEqual([]);
});

test('本日の出荷はページ非表示で無効化される', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390-webkit', '代表モバイルWebKitで厳格時計を検証する');
  const errors = watchBrowserErrors(page);
  await startMode(page, 'daily');
  const simulated = await page.evaluate(() => {
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    } catch (_) {
      const inherited = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
      if (!inherited?.configurable) return false;
      Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
    }
    document.dispatchEvent(new Event('visibilitychange'));
    return document.hidden === true;
  });
  expect(simulated).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'home');
  await expect(page.locator('#homeMessage')).toContainText('無効');
  expect(errors).toEqual([]);
});
