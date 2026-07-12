import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBoard, getFallbackBoard, DIFFICULTIES } from '../src/core/generator.js';
import { quickSolvable } from '../src/core/solver.js';
import { manhattanLowerBound, gateForBlock } from '../src/core/rules.js';

function posOf(board) {
  return board.blocks.map((b) => ({ x: b.x, y: b.y }));
}

test('同じ seed・難易度なら同じ盤面が生成される', () => {
  const a = generateBoard({ seed: 'hako-123', difficulty: 'normal' });
  const b = generateBoard({ seed: 'hako-123', difficulty: 'normal' });
  assert.deepEqual(a.board.blocks, b.board.blocks);
  assert.deepEqual(a.board.gates, b.board.gates);
  assert.deepEqual(a.board.walls, b.board.walls);
  assert.equal(a.shortestDistanceCells, b.shortestDistanceCells);
  assert.equal(a.optimalSwipes, b.optimalSwipes);
});

test('異なる seed なら（多くの場合）異なる盤面になる', () => {
  const a = generateBoard({ seed: 'seedA', difficulty: 'normal' });
  const b = generateBoard({ seed: 'seedB', difficulty: 'normal' });
  assert.notDeepEqual(a.board.blocks, b.board.blocks);
});

test('ランキング難易度は旧MVP距離20以上かつ可解', () => {
  for (const diff of ['normal', 'hard', 'expert']) {
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const r = generateBoard({ seed, difficulty: diff });
      assert.ok(r.shortestDistanceCells >= 20, `${diff}/${seed}: ${r.shortestDistanceCells}`);
      assert.ok(manhattanLowerBound(r.board, posOf(r.board)) >= 20, `${diff}/${seed} 下界不足`);
      assert.equal(quickSolvable(r.board), true, `${diff}/${seed} 可解でない`);
      assert.equal(r.fromFallback, false, `${diff}/${seed} がフォールバック`);
    }
  }
});

test('ランキング難易度の盤面は 7×9', () => {
  for (const diff of ['normal', 'hard', 'expert']) {
    const r = generateBoard({ seed: 'dim', difficulty: diff });
    assert.equal(r.board.width, 7);
    assert.equal(r.board.height, 9);
  }
});

test('各ブロックに同色の出口ゲートが対応する', () => {
  const r = generateBoard({ seed: 'gates', difficulty: 'hard' });
  for (let i = 0; i < r.board.blocks.length; i++) {
    const g = gateForBlock(r.board, i);
    assert.ok(g, `block ${i} にゲートが無い`);
    assert.equal(g.color, r.board.blocks[i].color);
  }
});

test('フォールバック盤面は可解かつ旧距離条件を維持する', () => {
  for (const diff of ['normal', 'hard', 'expert']) {
    const board = getFallbackBoard(diff);
    assert.equal(quickSolvable(board), true, `${diff} fallback 可解でない`);
    assert.ok(manhattanLowerBound(board, posOf(board)) >= 20, `${diff} fallback < 20`);
  }
});

test('練習難易度は可解な盤面を返す（20手制約なし）', () => {
  const r = generateBoard({ seed: 'practice-seed', difficulty: 'practice' });
  assert.equal(quickSolvable(r.board), true);
});

test('難易度定義の色数は 2〜6 の範囲', () => {
  for (const k of Object.keys(DIFFICULTIES)) {
    const c = DIFFICULTIES[k].colors;
    assert.ok(c >= 2 && c <= 6, `${k}: ${c}`);
  }
});

test('フォールバックの寸法が難易度定義と一致する', () => { for (const diff of Object.keys(DIFFICULTIES)) { const b=getFallbackBoard(diff); assert.equal(b.width, DIFFICULTIES[diff].width); assert.equal(b.height, DIFFICULTIES[diff].height); } });

test('shortestDistanceCells と optimalSwipes を混同しない', () => { const r=generateBoard({seed:'metric',difficulty:'normal'}); assert.ok(r.shortestDistanceCells >= r.optimalSwipes); assert.equal(Number.isFinite(r.optimalSwipes), true); });
