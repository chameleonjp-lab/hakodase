import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePlayState, countRemainingBlocks, listLegalSlides } from '../src/core/play-status.js';

function board({ width = 3, height = 2, blocks = [] } = {}) {
  return { width, height, walls: new Set(), oneway: new Map(), gates: [], blocks };
}

test('残り箱をnull以外だけ数える', () => {
  assert.equal(countRemainingBlocks([{ x: 0, y: 0 }, null, { x: 1, y: 1 }]), 2);
  assert.equal(countRemainingBlocks(null), 0);
});

test('合法スライドを箱番号と方向で列挙する', () => {
  const blocks = [
    { id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 },
    { id: 1, x: 1, y: 1, w: 1, h: 1, color: 1 },
  ];
  const positions = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const moves = listLegalSlides(board({ blocks }), positions);
  assert.deepEqual(moves, [
    { blockIndex: 0, dir: 'down' },
    { blockIndex: 0, dir: 'right' },
    { blockIndex: 1, dir: 'up' },
    { blockIndex: 1, dir: 'left' },
    { blockIndex: 1, dir: 'right' },
  ]);
});

test('playingかつ残り箱あり・合法操作0件だけを詰みとする', () => {
  const blocks = [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }];
  const lockedBoard = board({ width: 1, height: 1, blocks });
  assert.equal(analyzePlayState(lockedBoard, [{ x: 0, y: 0 }], 'playing').deadlocked, true);
  assert.equal(analyzePlayState(lockedBoard, [{ x: 0, y: 0 }], 'ready').deadlocked, false);
  assert.equal(analyzePlayState(lockedBoard, [null], 'playing').deadlocked, false);
});

test('可動箱数と合法操作数を分ける', () => {
  const blocks = [
    { id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 },
    { id: 1, x: 1, y: 1, w: 1, h: 1, color: 1 },
  ];
  const result = analyzePlayState(board({ blocks }), [{ x: 0, y: 0 }, { x: 1, y: 1 }], 'playing');
  assert.equal(result.remainingBlocks, 2);
  assert.equal(result.movableBlocks, 2);
  assert.equal(result.legalSlideCount, 5);
});
