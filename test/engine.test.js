import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/core/engine.js';

// W=5,H=1。block(0,0)c0 を右ゲート(line0,c0)へ。右へ1スライド=5歩で退場・クリア。
function simpleBoard() {
  return {
    width: 5, height: 1,
    walls: new Set(), oneway: new Map(),
    gates: [{ side: 'right', line: 0, color: 0 }],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
  };
}

test('タイマーは最初の操作で開始し、未操作なら0', () => {
  const e = new GameEngine(simpleBoard());
  assert.equal(e.elapsedMs(1000), 0);
  e.tryMove(0, 'right', 1000);
  assert.equal(e.startedAt, 1000);
});

test('手数は通過マス数で増え、退場でクリアになる', () => {
  const e = new GameEngine(simpleBoard());
  const r = e.tryMove(0, 'right', 0);
  assert.equal(r.moved, true);
  assert.equal(r.exit, true);
  assert.equal(r.steps, 5);
  assert.equal(e.moveCount, 5);
  assert.equal(r.cleared, true);
  assert.equal(e.isCleared(), true);
});

test('複数ブロック: 全部退場でクリア', () => {
  const e = new GameEngine({
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
  });
  // A は B に塞がれて右へ出られない（0歩=非合法）。
  assert.equal(e.tryMove(0, 'right', 0).moved, false);
  // B を上ゲートへ退場。
  let r = e.tryMove(1, 'up', 0);
  assert.equal(r.exit, true);
  assert.equal(e.isCleared(), false);
  // A を右ゲートへ退場 → クリア。
  r = e.tryMove(0, 'right', 10);
  assert.equal(r.exit, true);
  assert.equal(r.cleared, true);
});

test('クリア後はタイムが固定され、以降の操作は無効', () => {
  const e = new GameEngine(simpleBoard());
  e.tryMove(0, 'right', 0); // クリア（200ms想定の前にクリア）
  e.clearedAt = 200; // 明示
  assert.equal(e.elapsedMs(99999), 200);
  const r = e.tryMove(0, 'left', 300);
  assert.equal(r.moved, false);
});

test('非合法手は手数を増やさずタイマーも開始しない', () => {
  const e = new GameEngine(simpleBoard());
  const r = e.tryMove(0, 'left', 500); // 左はゲート無し→0歩
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

test('blockAt は退場後 -1 を返す', () => {
  const e = new GameEngine(simpleBoard());
  assert.equal(e.blockAt(0, 0), 0);
  e.tryMove(0, 'right', 0);
  assert.equal(e.blockAt(0, 0), -1);
});
