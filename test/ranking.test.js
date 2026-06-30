import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalRankingService, MemoryStorage } from '../src/services/ranking.js';

function svc() {
  return new LocalRankingService(new MemoryStorage());
}

test('スコアを保存して読み出せる', async () => {
  const s = svc();
  await s.saveScore({ seed: 'a', difficulty: 'normal', timeMs: 12340, moves: 25, clearedAt: '2026-06-30T00:00:00.000Z' });
  const list = await s.listScores();
  assert.equal(list.length, 1);
  assert.equal(list[0].seed, 'a');
  assert.equal(list[0].timeMs, 12340);
  assert.equal(list[0].moves, 25);
});

test('タイム昇順で並ぶ', async () => {
  const s = svc();
  await s.saveScore({ seed: 'a', difficulty: 'normal', timeMs: 5000, moves: 20 });
  await s.saveScore({ seed: 'b', difficulty: 'normal', timeMs: 3000, moves: 22 });
  await s.saveScore({ seed: 'c', difficulty: 'normal', timeMs: 9000, moves: 21 });
  const list = await s.listScores();
  assert.deepEqual(list.map((x) => x.timeMs), [3000, 5000, 9000]);
});

test('同タイムは手数の少ない順に並ぶ（タイブレーク）', async () => {
  const s = svc();
  await s.saveScore({ seed: 'a', difficulty: 'normal', timeMs: 5000, moves: 30, clearedAt: '2026-01-01T00:00:00.000Z' });
  await s.saveScore({ seed: 'b', difficulty: 'normal', timeMs: 5000, moves: 22, clearedAt: '2026-01-02T00:00:00.000Z' });
  const list = await s.listScores();
  assert.deepEqual(list.map((x) => x.moves), [22, 30]);
});

test('難易度でフィルタできる', async () => {
  const s = svc();
  await s.saveScore({ seed: 'a', difficulty: 'normal', timeMs: 5000, moves: 20 });
  await s.saveScore({ seed: 'b', difficulty: 'hard', timeMs: 3000, moves: 22 });
  const normals = await s.listScores({ difficulty: 'normal' });
  assert.equal(normals.length, 1);
  assert.equal(normals[0].difficulty, 'normal');
});

test('limit で件数を絞れる', async () => {
  const s = svc();
  for (let i = 0; i < 5; i++) {
    await s.saveScore({ seed: 's' + i, difficulty: 'normal', timeMs: 1000 * i, moves: 20 });
  }
  const top3 = await s.listScores({ limit: 3 });
  assert.equal(top3.length, 3);
});

test('clearScores で全消去', async () => {
  const s = svc();
  await s.saveScore({ seed: 'a', difficulty: 'normal', timeMs: 5000, moves: 20 });
  await s.clearScores();
  const list = await s.listScores();
  assert.equal(list.length, 0);
});

test('timeMs は四捨五入して保存される', async () => {
  const s = svc();
  await s.saveScore({ seed: 'a', difficulty: 'normal', timeMs: 1234.7, moves: 20 });
  const list = await s.listScores();
  assert.equal(list[0].timeMs, 1235);
});
