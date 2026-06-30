import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/core/engine.js';
import { key, computeCycle } from '../src/core/rules.js';

function simpleBoard() {
  // 3x1。block(0,0) を右へ2回でゴール(2,0)。
  return {
    width: 3, height: 1,
    walls: new Set(), oneway: new Map(), gates: [],
    goals: [{ x: 2, y: 0, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    cycle: 1,
  };
}

test('タイマーは最初の操作で開始し、未操作なら0', () => {
  const e = new GameEngine(simpleBoard());
  assert.equal(e.elapsedMs(1000), 0);
  e.tryMove(0, 'right', 1000);
  assert.equal(e.startedAt, 1000);
  assert.equal(e.elapsedMs(1500), 500);
});

test('手数が増え、クリアで判定される', () => {
  const e = new GameEngine(simpleBoard());
  let r = e.tryMove(0, 'right', 0);
  assert.equal(r.moved, true);
  assert.equal(r.cleared, false);
  assert.equal(e.moveCount, 1);
  r = e.tryMove(0, 'right', 100);
  assert.equal(r.cleared, true);
  assert.equal(e.moveCount, 2);
  assert.equal(e.isCleared(), true);
});

test('クリア後はタイムが固定され、以降の操作は無効', () => {
  const e = new GameEngine(simpleBoard());
  e.tryMove(0, 'right', 0);
  e.tryMove(0, 'right', 200); // クリア
  assert.equal(e.elapsedMs(99999), 200);
  const r = e.tryMove(0, 'left', 300);
  assert.equal(r.moved, false);
  assert.equal(e.moveCount, 2);
});

test('非合法手は手数を増やさずタイマーも開始しない', () => {
  const e = new GameEngine(simpleBoard());
  const r = e.tryMove(0, 'left', 500); // 盤外
  assert.equal(r.moved, false);
  assert.equal(e.moveCount, 0);
  assert.equal(e.startedAt, null);
});

test('reset で初期状態へ戻る', () => {
  const e = new GameEngine(simpleBoard());
  e.tryMove(0, 'right', 0);
  e.reset();
  assert.equal(e.moveCount, 0);
  assert.equal(e.startedAt, null);
  assert.equal(e.clearedAt, null);
  assert.deepEqual(e.positions, [{ x: 0, y: 0 }]);
});

test('blockAt で座標からブロックを引ける', () => {
  const e = new GameEngine(simpleBoard());
  assert.equal(e.blockAt(0, 0), 0);
  assert.equal(e.blockAt(2, 0), -1);
});

test('ゲートを跨ぐ移動は手数(moveCount)で開閉が変わる', () => {
  const gate = { x: 1, y: 0, period: 2, phase: 0, openFor: 1 }; // 偶数手で開
  const e = new GameEngine({
    width: 3, height: 1,
    walls: new Set(), oneway: new Map(), gates: [gate],
    goals: [{ x: 2, y: 0, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    cycle: computeCycle([gate]),
  });
  // moveCount 0（偶数）→ ゲート開、右へ進める。
  assert.equal(e.tryMove(0, 'right', 0).moved, true);
  assert.equal(e.positions[0].x, 1);
});
