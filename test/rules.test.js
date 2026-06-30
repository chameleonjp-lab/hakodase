import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSlide,
  applySlide,
  isCleared,
  legalMove,
  manhattanLowerBound,
  gateForBlock,
  gateOpeningCell,
  key,
} from '../src/core/rules.js';

function makeBoard(overrides = {}) {
  return {
    width: 5,
    height: 1,
    walls: new Set(),
    oneway: new Map(),
    gates: [],
    blocks: [],
    ...overrides,
  };
}

test('ブロックは壁/盤端に当たるまで一気に滑る', () => {
  const b = makeBoard({
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    gates: [], // 出口なし → 盤端で止まる
  });
  const pos = [{ x: 0, y: 0 }];
  const r = computeSlide(b, pos, 0, 'right');
  assert.equal(r.legal, true);
  assert.equal(r.exit, false);
  assert.equal(r.x, 4); // 右端で停止
  assert.equal(r.steps, 4);
});

test('他ブロックの手前で止まる', () => {
  const b = makeBoard({
    blocks: [
      { id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 },
      { id: 1, x: 3, y: 0, w: 1, h: 1, color: 1 },
    ],
  });
  const pos = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
  const r = computeSlide(b, pos, 0, 'right');
  assert.equal(r.x, 2); // ブロック(3)の手前
  assert.equal(r.steps, 2);
});

test('同色ゲートから盤外へ退場できる', () => {
  const b = makeBoard({
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    gates: [{ side: 'right', line: 0, color: 0 }],
  });
  const pos = [{ x: 0, y: 0 }];
  const r = computeSlide(b, pos, 0, 'right');
  assert.equal(r.exit, true);
  assert.equal(r.steps, 5); // 4マス移動 + 盤外へ1歩
});

test('色違いのゲートからは出られず盤端で止まる', () => {
  const b = makeBoard({
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    gates: [{ side: 'right', line: 0, color: 1 }], // 別色
  });
  const pos = [{ x: 0, y: 0 }];
  const r = computeSlide(b, pos, 0, 'right');
  assert.equal(r.exit, false);
  assert.equal(r.x, 4);
});

test('1マスも動けない方向は非合法', () => {
  const b = makeBoard({
    width: 3, height: 1,
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    gates: [],
  });
  const pos = [{ x: 0, y: 0 }];
  assert.equal(legalMove(b, pos, 0, 'left'), false); // すぐ盤端・ゲート無し
  assert.equal(legalMove(b, pos, 0, 'right'), true);
});

test('一方通行床: その向きにしか出られない／逆向き一方通行は壁扱い', () => {
  const b = makeBoard({
    width: 4, height: 1,
    oneway: new Map([[key(0, 0), 'right'], [key(2, 0), 'left']]),
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    gates: [],
  });
  const pos = [{ x: 0, y: 0 }];
  // 出発が right 一方通行 → left は不可
  assert.equal(legalMove(b, pos, 0, 'left'), false);
  // right に滑るが (2,0) は left 一方通行で進入不可 → その手前(1)で停止
  const r = computeSlide(b, pos, 0, 'right');
  assert.equal(r.x, 1);
  assert.equal(r.steps, 1);
});

test('applySlide は元を破壊せず、退場で null になる', () => {
  const b = makeBoard({
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
    gates: [{ side: 'right', line: 0, color: 0 }],
  });
  const pos = [{ x: 0, y: 0 }];
  const a = applySlide(b, pos, 0, 'right');
  assert.deepEqual(pos, [{ x: 0, y: 0 }]); // 元は不変
  assert.equal(a.positions[0], null); // 退場
  assert.equal(a.exit, true);
  assert.equal(a.steps, 5);
});

test('isCleared: 全ブロック退場でクリア', () => {
  assert.equal(isCleared([null, null]), true);
  assert.equal(isCleared([null, { x: 1, y: 0 }]), false);
});

test('manhattanLowerBound: 各ブロック→同色ゲート開口の距離総和', () => {
  const b = makeBoard({
    width: 5, height: 1,
    blocks: [{ id: 0, x: 1, y: 0, w: 1, h: 1, color: 0 }],
    gates: [{ side: 'right', line: 0, color: 0 }],
  });
  const gate = gateForBlock(b, 0);
  const open = gateOpeningCell(b, gate);
  assert.deepEqual(open, { x: 5, y: 0 });
  assert.equal(manhattanLowerBound(b, [{ x: 1, y: 0 }]), 4); // |5-1|
});
