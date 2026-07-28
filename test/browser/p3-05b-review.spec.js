import { test, expect } from '@playwright/test';

test('66候補を読み込み10箱候補を試遊開始できる', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/review.html');
  await expect(page.locator('#reviewApp')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#progressTotal')).toHaveText('66');
  await expect(page.locator('#candidatePosition')).toContainText('/ 66');

  await page.locator('#profileFilter').selectOption('b10c4');
  await expect(page.locator('#candidateProfile')).toContainText('10箱');
  await expect(page.locator('#candidateProfile')).toContainText('4色');
  await expect(page.locator('#candidateOptimal')).toHaveText('24操作');

  await page.locator('#reviewStart').click();
  await expect.poll(() => page.evaluate(() => window.hakodaseReview?.snapshot()?.status), {
    timeout: 10_000,
  }).toBe('playing');

  const snapshot = await page.evaluate(() => window.hakodaseReview.snapshot());
  expect(snapshot.blockCount).toBe(10);
  expect(snapshot.colorCount).toBe(4);
  expect(snapshot.optimalSwipes).toBe(24);
  await expect(page.locator('#reviewRemaining')).toContainText('10 / 10');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
});

test('手動評価を端末内へ保存し再読込後も維持する', async ({ page }) => {
  await page.goto('/review.html');
  await expect(page.locator('#reviewApp')).toBeVisible({ timeout: 20_000 });
  await page.locator('#profileFilter').selectOption('b10c4');

  const reviewId = await page.locator('#candidateReviewId').textContent();
  await page.locator('#reviewerName').fill('ブラウザ試遊');
  await page.locator('#reviewDevice').fill('自動ブラウザ');
  await page.locator('#reviewBrowser').fill('Playwright');
  for (const field of ['enjoyment', 'clarity', 'difficulty', 'distinctiveness', 'fairness']) {
    await page.locator(`[data-rating="${field}"]`).selectOption('4');
  }
  await page.locator('#reviewDecision').selectOption('revise');
  await page.locator('#decisionReason').fill('実機で追加確認する');
  await page.locator('#reviewNotes').fill('保存回帰テスト');
  await page.locator('#reviewForm button[type="submit"]').click();
  await expect(page.locator('#candidateDecisionBadge')).toHaveText('修正');

  await page.reload();
  await expect(page.locator('#reviewApp')).toBeVisible({ timeout: 20_000 });
  await page.evaluate((id) => window.hakodaseReview.selectReviewId(id), reviewId);
  await expect(page.locator('#reviewDecision')).toHaveValue('revise');
  await expect(page.locator('#reviewNotes')).toHaveValue('保存回帰テスト');
  await expect(page.locator('#progressRevise')).toHaveText('1');
});
