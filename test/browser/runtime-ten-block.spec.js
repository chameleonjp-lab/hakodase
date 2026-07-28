import { test, expect } from '@playwright/test';

test('本日の出荷は10箱・4色・目安24操作で開始する', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('[data-mode="daily"]')).toContainText('10箱');
  await page.locator('#homeStart').click();
  await page.locator('#playerNameInput').fill('10箱確認');
  await page.locator('#nameForm button[type="submit"]').click();

  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'playing', { timeout: 10_000 });
  await expect.poll(async () => page.evaluate(() => window.hakodase?.engine?.board?.blocks?.length ?? 0), {
    timeout: 10_000,
  }).toBe(10);

  const state = await page.evaluate(() => {
    const game = window.hakodase;
    return {
      appState: document.body.dataset.appState,
      blockCount: game.engine.board.blocks.length,
      colorCount: new Set(game.engine.board.blocks.map((block) => block.color)).size,
      optimalSwipes: game.meta.optimalSwipes,
      exact: game.meta.exact,
      profileId: game.meta.profileId,
      templateId: game.meta.templateId,
      remainingText: document.getElementById('remaining')?.textContent,
      targetText: document.getElementById('target')?.textContent,
    };
  });

  expect(state.appState).toBe('playing');
  expect(state.blockCount).toBe(10);
  expect(state.colorCount).toBe(4);
  expect(state.optimalSwipes).toBe(24);
  expect(state.exact).toBe(true);
  expect(state.profileId).toBe('b10c4');
  expect(state.templateId).toMatch(/^b10c4-t\d{2}$/);
  expect(state.remainingText).toContain('10');
  expect(state.targetText).toContain('24');
  expect(pageErrors).toEqual([]);
});
