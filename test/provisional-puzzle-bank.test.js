import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVISIONAL_PUZZLES,
  PROVISIONAL_PUZZLE_BANK_VERSION,
  PROVISIONAL_TRANSFORMS,
  getProvisionalPuzzle,
} from '../src/core/provisional-puzzle-bank.js';
import { computeSlide, key } from '../src/core/rules.js';
import { solveOptimalSwipes } from '../src/core/solver.js';

const OFFLINE_EXACT_MAX_NODES = 5_000_000;

function boardFromDefinition(definition) {
  return {
    width: 7,
    height: 9,
    walls: new Set(definition.walls.map(([x, y]) => key(x, y))),
    oneway: new Map(),
    gates: definition.gates.map((gate) => ({ ...gate })),
    blocks: definition.blocks.map((block) => ({ ...block })),
  };
}

function initialDirectExitCount(board) {
  const positions = board.blocks.map((block) => ({ x: block.x, y: block.y }));
  let count = 0;
  for (let index = 0; index < board.blocks.length; index++) {
    for (const direction of ['up', 'down', 'left', 'right']) {
      const result = computeSlide(board, positions, index, direction);
      if (result.legal && result.exit) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

test('試作盤面5件は厳密最短8〜12操作で、初期直行箱が0件', () => {
  assert.equal(PROVISIONAL_PUZZLES.length, 5);
  for (const definition of PROVISIONAL_PUZZLES) {
    const board = boardFromDefinition(definition);
    assert.equal(initialDirectExitCount(board), 0, `${definition.id}: 初期直行箱`);
    const solved = solveOptimalSwipes(board, { maxNodes: OFFLINE_EXACT_MAX_NODES });
    assert.equal(solved.solved, true, `${definition.id}: ${solved.reason || 'unsolved'} / nodes=${solved.nodes}`);
    assert.equal(solved.optimalSwipes, definition.expectedOptimalSwipes, `${definition.id}: 最短値`);
    assert.ok(solved.optimalSwipes >= 8 && solved.optimalSwipes <= 12, `${definition.id}: ${solved.optimalSwipes}`);
  }
});

test('seed選択後の盤面も直行箱0件と事前確認済み最短値を維持する', () => {
  for (const seed of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'daily-preview-v1']) {
    const selected = getProvisionalPuzzle(seed);
    assert.equal(selected.source, PROVISIONAL_PUZZLE_BANK_VERSION);
    assert.ok(PROVISIONAL_TRANSFORMS.includes(selected.transform));
    assert.equal(initialDirectExitCount(selected.board), 0, `${seed}: 初期直行箱`);
    assert.ok(selected.expectedOptimalSwipes >= 8 && selected.expectedOptimalSwipes <= 12);
  }
});

test('同じseedは同じ問題ID・壁・箱・出口を返す', () => {
  const first = getProvisionalPuzzle('repeatable-seed');
  const second = getProvisionalPuzzle('repeatable-seed');
  assert.equal(first.puzzleId, second.puzzleId);
  assert.deepEqual(first.board.walls, second.board.walls);
  assert.deepEqual(first.board.blocks, second.board.blocks);
  assert.deepEqual(first.board.gates, second.board.gates);
});

test('反転と色置換を使って単一盤面の反復を避ける', () => {
  const ids = new Set();
  for (let index = 0; index < 80; index++) ids.add(getProvisionalPuzzle(`variant-${index}`).puzzleId);
  assert.ok(ids.size >= 20, `問題IDの種類が少なすぎる: ${ids.size}`);
});
