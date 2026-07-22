import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBoard, getFallbackBoard, DIFFICULTIES } from '../src/core/generator.js';
import { quickSolvable, solveOptimalSwipes } from '../src/core/solver.js';
import { manhattanLowerBound, gateForBlock } from '../src/core/rules.js';
import { PROVISIONAL_PUZZLE_BANK_VERSION } from '../src/core/provisional-puzzle-bank.js';

const OFFLINE_EXACT_MAX_NODES = 5_000_000;

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

test('異なるseedなら試作盤面の選択または変換が変わる', () => {
  const ids = new Set(['seedA', 'seedB', 'seedC', 'seedD', 'seedE'].map((seed) => (
    generateBoard({ seed, difficulty: 'normal' }).puzzleId
  )));
  assert.ok(ids.size >= 3, `盤面の種類が少なすぎる: ${[...ids].join(', ')}`);
});

test('normalは旧4操作生成を使わず、厳密最短8〜12操作の試作盤面を返す', () => {
  for (const seed of ['s1', 's2', 's3', 's4', 's5', 'daily-preview-v1', 'normal-fallback-v1']) {
    const result = generateBoard({ seed, difficulty: 'normal' });
    assert.equal(result.source, PROVISIONAL_PUZZLE_BANK_VERSION, `${seed}: source`);
    assert.equal(result.generatorVersion, PROVISIONAL_PUZZLE_BANK_VERSION, `${seed}: version`);
    assert.equal(result.exact, true, `${seed}: exact`);
    assert.equal(result.fromFallback, false, `${seed}: fallback`);
    assert.ok(result.optimalSwipes >= 8 && result.optimalSwipes <= 12, `${seed}: ${result.optimalSwipes}`);
    assert.ok(result.shortestDistanceCells >= 20, `${seed}: distance ${result.shortestDistanceCells}`);
    assert.ok(result.puzzleId?.startsWith('trial-'), `${seed}: puzzleId ${result.puzzleId}`);
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

test('normalフォールバックは旧4操作盤面へ戻らない', () => {
  const board = getFallbackBoard('normal');
  const solved = solveOptimalSwipes(board, { maxNodes: OFFLINE_EXACT_MAX_NODES });
  assert.equal(solved.solved, true, solved.reason || 'unsolved');
  assert.ok(solved.optimalSwipes >= 8, `normal fallback: ${solved.optimalSwipes}`);
  assert.ok(manhattanLowerBound(board, posOf(board)) >= 20);
});

test('旧互換フォールバックは可解かつ距離条件を維持する', () => {
  for (const difficulty of ['hard', 'expert']) {
    const board = getFallbackBoard(difficulty);
    assert.equal(quickSolvable(board), true, `${difficulty}: fallback可解でない`);
    assert.ok(manhattanLowerBound(board, posOf(board)) >= 20, `${difficulty}: fallback < 20`);
  }
});

test('練習難易度は可解な盤面を返す', () => {
  const result = generateBoard({ seed: 'practice-seed', difficulty: 'practice' });
  assert.equal(quickSolvable(result.board), true);
});

test('難易度定義の色数は2〜6の範囲', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    const colors = DIFFICULTIES[key].colors;
    assert.ok(colors >= 2 && colors <= 6, `${key}: ${colors}`);
  }
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
