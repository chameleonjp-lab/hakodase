import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../src/core/solver.js';
import { key, computeCycle } from '../src/core/rules.js';

test('一直線の盤面で最短手数を返す', () => {
  const board = {
    width: 5,
    height: 1,
    walls: new Set(),
    oneway: new Map(),
    gates: [],
    goals: [{ x: 4, y: 0, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    cycle: 1,
  };
  const r = solve(board);
  assert.equal(r.solved, true);
  assert.equal(r.moves, 4);
});

test('既にゴール上なら 0 手', () => {
  const board = {
    width: 3, height: 1,
    walls: new Set(), oneway: new Map(), gates: [],
    goals: [{ x: 1, y: 0, color: 0 }],
    blocks: [{ id: 0, x: 1, y: 0, w: 1, h: 1, color: 0 }],
    cycle: 1,
  };
  assert.equal(solve(board).moves, 0);
});

test('到達不能な盤面は solved=false', () => {
  const board = {
    width: 3, height: 1,
    walls: new Set([key(1, 0)]), // 真ん中が壁で分断
    oneway: new Map(), gates: [],
    goals: [{ x: 2, y: 0, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    cycle: 1,
  };
  const r = solve(board);
  assert.equal(r.solved, false);
});

test('一方通行床が最短手数を伸ばす', () => {
  // (1,1) を下向き一方通行にすると、(1,0) への直行(1手)が回り道(5手)になる。
  const board = {
    width: 3, height: 3,
    walls: new Set(),
    oneway: new Map([[key(1, 1), 'down']]),
    gates: [],
    goals: [{ x: 1, y: 0, color: 0 }],
    blocks: [{ id: 0, x: 1, y: 1, w: 1, h: 1, color: 0 }],
    cycle: 1,
  };
  const r = solve(board);
  assert.equal(r.solved, true);
  assert.equal(r.moves, 5);
});

test('開閉ゲートを考慮して解く（待ちが必要な構成）', () => {
  // 唯一の出口がゲート。block は (1,1) 偶数手でしか上れず、ゲートは moveCount%4==2 で開く。
  // よって 2 手ロイター（左→右で (1,1) に戻る）してから上る必要があり最短 3 手。
  const gate = { x: 1, y: 0, period: 4, phase: 2, openFor: 1 };
  const board = {
    width: 3, height: 2,
    walls: new Set([key(0, 0), key(2, 0)]), // 上段は中央(ゲート)以外壁
    oneway: new Map(),
    gates: [gate],
    goals: [{ x: 1, y: 0, color: 0 }],
    blocks: [{ id: 0, x: 1, y: 1, w: 1, h: 1, color: 0 }],
    cycle: computeCycle([gate]),
  };
  const r = solve(board);
  assert.equal(r.solved, true);
  assert.equal(r.moves, 3);
});

test('探索上限を超えると solved=false（理由つき）', () => {
  const board = {
    width: 6, height: 6,
    walls: new Set(), oneway: new Map(), gates: [],
    goals: [{ x: 5, y: 5, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    cycle: 1,
  };
  const r = solve(board, { maxNodes: 2 });
  assert.equal(r.solved, false);
  assert.ok(['maxNodes', 'maxDepth'].includes(r.reason));
});
