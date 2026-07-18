import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRankingService, MemoryStorage, STORAGE_KEY } from '../src/services/ranking.js';

const score = (overrides = {}) => ({
  seed: 's',
  difficulty: 'normal',
  mode: 'endless',
  timeMs: 1000,
  swipeCount: 3,
  distanceCells: 9,
  clearedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

class ThrowingStorage {
  getItem() { throw new Error('blocked'); }
  setItem() { throw new Error('blocked'); }
  removeItem() { throw new Error('blocked'); }
}

test('v2保存キーを使い、モード・操作数・移動距離を保存する', async () => {
  const storage = new MemoryStorage();
  const ranking = new LocalRankingService(storage);
  await ranking.saveScore(score());
  assert.equal(storage.getItem('hakodase.ranking.v1'), null);
  assert.ok(storage.getItem(STORAGE_KEY));
  const [saved] = await ranking.listScores();
  assert.equal(saved.mode, 'endless');
  assert.equal(saved.swipeCount, 3);
  assert.equal(saved.distanceCells, 9);
});

test('旧v1記録を新一覧へ混ぜない', async () => {
  const storage = new MemoryStorage();
  storage.setItem('hakodase.ranking.v1', JSON.stringify([score({ moves: 9 })]));
  const ranking = new LocalRankingService(storage);
  assert.deepEqual(await ranking.listScores(), []);
});

test('モード未保存の旧v2記録を公式・エンドレスへ混ぜない', async () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify([{ ...score(), mode: undefined }]));
  const ranking = new LocalRankingService(storage);
  assert.equal((await ranking.listScores({ mode: 'endless' })).length, 0);
  assert.equal((await ranking.listScores({ mode: 'legacy' })).length, 1);
});

test('タイム、操作数、達成日時で並ぶ', async () => {
  const ranking = new LocalRankingService(new MemoryStorage());
  await ranking.saveScore(score({ timeMs: 1000, swipeCount: 5, clearedAt: 'b' }));
  await ranking.saveScore(score({ timeMs: 900, swipeCount: 9, clearedAt: 'c' }));
  await ranking.saveScore(score({ timeMs: 1000, swipeCount: 3, clearedAt: 'z' }));
  await ranking.saveScore(score({ timeMs: 1000, swipeCount: 3, clearedAt: 'a' }));
  const values = await ranking.listScores();
  assert.deepEqual(values.map((value) => [value.timeMs, value.swipeCount, value.clearedAt]), [
    [900, 9, 'c'], [1000, 3, 'a'], [1000, 3, 'z'], [1000, 5, 'b'],
  ]);
});

test('壊れた保存値でゲームを止めない', async () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, '{');
  const ranking = new LocalRankingService(storage);
  assert.deepEqual(await ranking.listScores(), []);
});

test('保存領域を読み取れず消去できなくてもゲームを止めない', async () => {
  const ranking = new LocalRankingService(new ThrowingStorage());
  assert.deepEqual(await ranking.listScores(), []);
  assert.equal(await ranking.clearScores(), false);
  await assert.rejects(() => ranking.saveScore(score()), /blocked/);
});

test('モード、難易度、seed、limitでフィルタでき、clearできる', async () => {
  const ranking = new LocalRankingService(new MemoryStorage());
  await ranking.saveScore(score({ seed: 'a', difficulty: 'normal', mode: 'endless' }));
  await ranking.saveScore(score({ seed: 'b', difficulty: 'hard', mode: 'endless' }));
  await ranking.saveScore(score({ seed: 'c', difficulty: 'normal', mode: 'practice' }));
  assert.equal((await ranking.listScores({ mode: 'endless', difficulty: 'normal', seed: 'a', limit: 1 })).length, 1);
  assert.equal((await ranking.listScores({ mode: 'practice' })).length, 1);
  assert.equal(await ranking.clearScores(), true);
  assert.equal((await ranking.listScores()).length, 0);
});
