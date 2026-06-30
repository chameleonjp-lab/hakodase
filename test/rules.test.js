import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  legalMove,
  applyMove,
  isCleared,
  gateOpen,
  computeCycle,
  key,
} from '../src/core/rules.js';

function board(overrides = {}) {
  return {
    width: 3,
    height: 3,
    walls: new Set(),
    oneway: new Map(),
    gates: [],
    goals: [],
    blocks: [{ id: 0, x: 1, y: 1, w: 1, h: 1, color: 0 }],
    cycle: 1,
    ...overrides,
  };
}

test('中央のブロックは上下左右に動ける', () => {
  const b = board();
  const pos = [{ x: 1, y: 1 }];
  for (const dir of ['up', 'down', 'left', 'right']) {
    assert.equal(legalMove(b, pos, 0, 0, dir), true, dir);
  }
});

test('盤外へは動けない', () => {
  const b = board({ blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }] });
  const pos = [{ x: 0, y: 0 }];
  assert.equal(legalMove(b, pos, 0, 0, 'up'), false);
  assert.equal(legalMove(b, pos, 0, 0, 'left'), false);
  assert.equal(legalMove(b, pos, 0, 0, 'right'), true);
});

test('壁へは進めない', () => {
  const b = board({ walls: new Set([key(2, 1)]) });
  const pos = [{ x: 1, y: 1 }];
  assert.equal(legalMove(b, pos, 0, 0, 'right'), false);
});

test('他ブロックの占有セルへは進めない', () => {
  const b = board({
    blocks: [
      { id: 0, x: 1, y: 1, w: 1, h: 1, color: 0 },
      { id: 1, x: 2, y: 1, w: 1, h: 1, color: 1 },
    ],
  });
  const pos = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
  assert.equal(legalMove(b, pos, 0, 0, 'right'), false);
  assert.equal(legalMove(b, pos, 0, 0, 'up'), true);
});

test('一方通行床: 矢印方向にしか出られない', () => {
  const b = board({ oneway: new Map([[key(1, 1), 'right']]) });
  const pos = [{ x: 1, y: 1 }];
  assert.equal(legalMove(b, pos, 0, 0, 'right'), true);
  assert.equal(legalMove(b, pos, 0, 0, 'left'), false);
  assert.equal(legalMove(b, pos, 0, 0, 'up'), false);
  assert.equal(legalMove(b, pos, 0, 0, 'down'), false);
});

test('開閉ゲート: 閉じていると進入不可、開くと進入可', () => {
  // phase 1, period 2, openFor 1 → moveCount 0 で閉, 1 で開。
  const gate = { x: 2, y: 1, period: 2, phase: 1, openFor: 1 };
  const b = board({ gates: [gate], cycle: computeCycle([gate]) });
  const pos = [{ x: 1, y: 1 }];
  assert.equal(gateOpen(gate, 0), false);
  assert.equal(gateOpen(gate, 1), true);
  assert.equal(legalMove(b, pos, 0, 0, 'right'), false); // 閉
  assert.equal(legalMove(b, pos, 1, 0, 'right'), true); // 開
});

test('applyMove は元を破壊せず手数を増やす', () => {
  const b = board();
  const pos = [{ x: 1, y: 1 }];
  const next = applyMove(b, pos, 0, 0, 'right');
  assert.deepEqual(pos, [{ x: 1, y: 1 }]); // 元は不変
  assert.deepEqual(next.positions, [{ x: 2, y: 1 }]);
  assert.equal(next.moveCount, 1);
});

test('isCleared: 全ブロックが同色ゴール上でクリア', () => {
  const b = board({
    blocks: [
      { id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 },
      { id: 1, x: 0, y: 1, w: 1, h: 1, color: 1 },
    ],
    goals: [
      { x: 2, y: 2, color: 0 },
      { x: 1, y: 2, color: 1 },
    ],
  });
  assert.equal(isCleared(b, [{ x: 2, y: 2 }, { x: 1, y: 2 }]), true);
  assert.equal(isCleared(b, [{ x: 2, y: 2 }, { x: 0, y: 1 }]), false);
  // 色違いのゴールに乗ってもクリアにならない
  assert.equal(isCleared(b, [{ x: 1, y: 2 }, { x: 2, y: 2 }]), false);
});

test('computeCycle は周期の最小公倍数', () => {
  assert.equal(computeCycle([]), 1);
  assert.equal(computeCycle([{ period: 4 }, { period: 6 }]), 12);
});
