import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResultShareText, createClearResultModel, formatOptimalComparison, formatResultTime } from '../src/app/result-model.js';

function model(overrides = {}) {
  return createClearResultModel({
    run: { playId: 4, result: { mode:'endless', timeMs:12345, swipeCount:9, distanceCells:31, seed:'abc' } },
    engine: { undoCount:2 },
    meta: { seed:'abc', optimalSwipes:7, exact:true },
    config: { mode:'endless', seed:'abc', playerName:'箱係', official:false, preview:false },
    playerName:'箱係',
    localSaved:true,
    localSummary:{ count:2, first:{timeMs:15000,swipeCount:10,distanceCells:40,clearedAt:'a'}, best:{timeMs:12345,swipeCount:9,distanceCells:31,clearedAt:'b'} },
    ...overrides,
  });
}

test('結果モデルへ時計・操作・距離・undo・問題情報を固定する', () => {
  const value = model();
  assert.equal(value.playId, 4);
  assert.equal(value.timeMs, 12345);
  assert.equal(value.swipeCount, 9);
  assert.equal(value.distanceCells, 31);
  assert.equal(value.undoCount, 2);
  assert.equal(value.problemLabel, 'seed abc');
  assert.equal(Object.isFrozen(value), true);
});

test('最短との差を正確値と目安で区別する', () => {
  assert.equal(formatOptimalComparison(model()), '最短より +2操作');
  assert.equal(formatOptimalComparison(model({ meta:{seed:'abc',optimalSwipes:9,exact:false} })), '目安と同じ');
  assert.match(formatOptimalComparison(model({ meta:{seed:'abc',optimalSwipes:20,exact:true} })), /整合性/);
});

test('正式問題IDがある時だけ公式結果として扱う', () => {
  const official = model({ config:{mode:'daily',official:true,preview:false,puzzleId:'daily-1'}, meta:{puzzleId:'daily-1',optimalSwipes:20,exact:true} });
  assert.equal(official.official, true);
  assert.equal(official.problemLabel, '問題 daily-1');
  const preview = model({ config:{mode:'daily',official:true,preview:true,puzzleId:'daily-1'}, meta:{puzzleId:'daily-1'} });
  assert.equal(preview.official, false);
});

test('共有文へゲーム名・記録・操作数・seedを含める', () => {
  const text = buildResultShareText(model());
  assert.match(text, /HAKODASE/);
  assert.match(text, /12\.35秒・9操作/);
  assert.match(text, /seed: abc/);
  assert.match(text, /戻す: 2回/);
});

test('時間表示を小数2桁に固定する', () => {
  assert.equal(formatResultTime(12345), '12.35秒');
  assert.equal(formatResultTime(-1), '0.00秒');
});
