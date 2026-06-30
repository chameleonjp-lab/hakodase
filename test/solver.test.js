import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, quickSolvable } from '../src/core/solver.js';

// A(1,0)c0 は右ゲートへ出たいが B(2,0)c1 が塞ぐ。B は上ゲートへ退場でき、その後 A が出られる。
function orderingBoard() {
  return {
    width: 4, height: 2,
    walls: new Set(), oneway: new Map(),
    gates: [
      { side: 'right', line: 0, color: 0 },
      { side: 'top', line: 2, color: 1 },
    ],
    blocks: [
      { id: 0, x: 1, y: 0, w: 1, h: 1, color: 0 },
      { id: 1, x: 2, y: 0, w: 1, h: 1, color: 1 },
    ],
  };
}

test('一直線の盤面で最短手数（通過マス数）を返す', () => {
  const board = {
    width: 5, height: 1,
    walls: new Set(), oneway: new Map(),
    gates: [{ side: 'right', line: 0, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
  };
  const r = solve(board);
  assert.equal(r.solved, true);
  assert.equal(r.moves, 5); // 4マス + 退場1歩
});

test('順序が必要な盤面を解き、最短手数を返す', () => {
  const board = orderingBoard();
  const r = solve(board);
  assert.equal(r.solved, true);
  // B を上に1歩で退場、A を右へ(2,3 を抜けて)退場=3歩 → 計4
  assert.equal(r.moves, 4);
});

test('quickSolvable: 解ける盤面で true', () => {
  assert.equal(quickSolvable(orderingBoard()), true);
});

test('デッドロック盤面は解けない（solve=false / quickSolvable=false）', () => {
  // A(0,0)c0 は右ゲート, B(1,0)c1 は左ゲート。互いに相手を塞ぎ、どちらも自色ゲートへ出られない。
  const board = {
    width: 4, height: 1,
    walls: new Set(), oneway: new Map(),
    gates: [
      { side: 'right', line: 0, color: 0 },
      { side: 'left', line: 0, color: 1 },
    ],
    blocks: [
      { id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 },
      { id: 1, x: 1, y: 0, w: 1, h: 1, color: 1 },
    ],
  };
  assert.equal(quickSolvable(board), false);
  assert.equal(solve(board).solved, false);
});

test('探索上限を超えると solved=false（理由つき）', () => {
  const board = {
    width: 5, height: 1,
    walls: new Set(), oneway: new Map(),
    gates: [{ side: 'right', line: 0, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
  };
  const r = solve(board, { maxNodes: 0 });
  assert.equal(r.solved, false);
  assert.ok(['maxNodes', 'maxCost', 'exhausted'].includes(r.reason));
});
