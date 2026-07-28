import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBoard, getFallbackBoard, DIFFICULTIES, NORMAL_RUNTIME_PROFILE } from '../src/core/generator.js';
import { quickSolvable } from '../src/core/solver.js';
import { manhattanLowerBound, gateForBlock } from '../src/core/rules.js';
import {
  getRuntimeTenBlockPuzzle,
  RUNTIME_TEN_BLOCK_BANK_VERSION,
  RUNTIME_TEN_BLOCK_COUNT,
  RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES,
} from '../src/core/runtime-ten-block-bank.js';

function posOf(board) {
  return board.blocks.map((block) => ({ x: block.x, y: block.y }));
}

test('同じseed・難易度なら同じ盤面が生成される', () => {
  const a = generateBoard({ seed: 'hako-123', difficulty: 'normal' });
  const b = generateBoard({ seed: 'hako-123', difficulty: 'normal' });
  assert.deepEqual(a.board.blocks, b.board.blocks);
  assert.deepEqual(a.board.gates, b.board.gates);
  assert.deepEqual(a.board.walls, b.board.walls);
  assert.equal(a.shortestDistanceCells, b.shortestDistanceCells);
  assert.equal(a.optimalSwipes, b.optimalSwipes);
  assert.equal(a.puzzleId, b.puzzleId);
});

test('異なるseedなら10箱盤面の選択または変換が変わる', () => {
  const ids = new Set(['seedA', 'seedB', 'seedC', 'seedD', 'seedE', 'seedF', 'seedG', 'seedH'].map((seed) => (
    generateBoard({ seed, difficulty: 'normal' }).puzzleId
  )));
  assert.ok(ids.size >= 5, `盤面の種類が少なすぎる: ${[...ids].join(', ')}`);
});

test('normalは10箱・4色・厳密最短24操作の検証済み盤面を返す', () => {
  for (const seed of ['s1', 's2', 's3', 's4', 's5', 'daily-preview-v1', 'normal-fallback-v2']) {
    const result = generateBoard({ seed, difficulty: 'normal' });
    const colors = new Set(result.board.blocks.map((block) => block.color));

    assert.equal(result.source, RUNTIME_TEN_BLOCK_BANK_VERSION, `${seed}: source`);
    assert.equal(result.exact, true, `${seed}: exact`);
    assert.equal(result.fromFallback, false, `${seed}: fallback`);
    assert.equal(result.board.blocks.length, RUNTIME_TEN_BLOCK_COUNT, `${seed}: blocks`);
    assert.equal(colors.size, 4, `${seed}: colors`);
    assert.equal(result.optimalSwipes, RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES, `${seed}: optimal`);
    assert.ok(result.shortestDistanceCells >= result.optimalSwipes, `${seed}: distance ${result.shortestDistanceCells}`);
    assert.equal(result.profileId, 'b10c4', `${seed}: profile`);
    assert.ok(result.templateId?.startsWith('b10c4-t'), `${seed}: template ${result.templateId}`);
    assert.ok(result.puzzleId?.startsWith('preview-b10c4-t'), `${seed}: puzzleId ${result.puzzleId}`);
  }
});

test('旧互換のhard・expertは距離20以上かつ直線退場解を維持する', () => {
  for (const difficulty of ['hard', 'expert']) {
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const result = generateBoard({ seed, difficulty });
      assert.ok(result.shortestDistanceCells >= 20, `${difficulty}/${seed}: ${result.shortestDistanceCells}`);
      assert.ok(manhattanLowerBound(result.board, posOf(result.board)) >= 20, `${difficulty}/${seed}: 下界不足`);
      assert.equal(quickSolvable(result.board), true, `${difficulty}/${seed}: 可解でない`);
      assert.equal(result.fromFallback, false, `${difficulty}/${seed}: fallback`);
    }
  }
});

test('ランキング難易度の盤面は7×9', () => {
  for (const difficulty of ['normal', 'hard', 'expert']) {
    const result = generateBoard({ seed: 'dim', difficulty });
    assert.equal(result.board.width, 7);
    assert.equal(result.board.height, 9);
  }
});

test('各ブロックに同色の出口ゲートが対応する', () => {
  for (const difficulty of ['normal', 'hard']) {
    const result = generateBoard({ seed: 'gates', difficulty });
    for (let i = 0; i < result.board.blocks.length; i++) {
      const gate = gateForBlock(result.board, i);
      assert.ok(gate, `${difficulty}/block ${i}: ゲートが無い`);
      assert.equal(gate.color, result.board.blocks[i].color);
    }
  }
});

test('normalフォールバックも10箱の検証済み盤面を返す', () => {
  const board = getFallbackBoard('normal');
  const selected = getRuntimeTenBlockPuzzle('normal-fallback-v2');
  assert.deepEqual(board.blocks, selected.board.blocks);
  assert.deepEqual(board.gates, selected.board.gates);
  assert.deepEqual(board.walls, selected.board.walls);
  assert.equal(board.blocks.length, RUNTIME_TEN_BLOCK_COUNT);
  assert.equal(selected.expectedOptimalSwipes, RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES);
});

test('旧互換フォールバックは可解かつ距離条件を維持する', () => {
  for (const difficulty of ['hard', 'expert']) {
    const board = getFallbackBoard(difficulty);
    assert.equal(quickSolvable(board), true, `${difficulty}: fallback可解でない`);
    assert.ok(manhattanLowerBound(board, posOf(board)) >= 20, `${difficulty}: fallback < 20`);
  }
});

test('練習難易度は2箱の可解な盤面を返す', () => {
  const result = generateBoard({ seed: 'practice-seed', difficulty: 'practice' });
  assert.equal(result.board.blocks.length, 2);
  assert.equal(quickSolvable(result.board), true);
});

test('難易度定義の色数は2〜6の範囲', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    const colors = DIFFICULTIES[key].colors;
    assert.ok(colors >= 2 && colors <= 6, `${key}: ${colors}`);
  }
});

test('通常プレイの契約は10箱・4色・24操作', () => {
  assert.equal(DIFFICULTIES.normal.blocks, 10);
  assert.equal(DIFFICULTIES.normal.colors, 4);
  assert.deepEqual(NORMAL_RUNTIME_PROFILE, {
    blockCount: 10,
    colorCount: 4,
    optimalSwipes: 24,
    bankVersion: RUNTIME_TEN_BLOCK_BANK_VERSION,
  });
});

test('フォールバックの寸法が難易度定義と一致する', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const board = getFallbackBoard(difficulty);
    assert.equal(board.width, DIFFICULTIES[difficulty].width);
    assert.equal(board.height, DIFFICULTIES[difficulty].height);
  }
});

test('shortestDistanceCellsとoptimalSwipesを混同しない', () => {
  const result = generateBoard({ seed: 'metric', difficulty: 'normal' });
  assert.ok(result.shortestDistanceCells >= result.optimalSwipes);
  assert.equal(Number.isFinite(result.optimalSwipes), true);
});
