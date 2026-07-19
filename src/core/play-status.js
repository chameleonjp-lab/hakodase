// プレイ中の残り箱・合法操作・詰みを判定する純粋関数。
// DOM、Canvas、時計、保存へ依存しない。

import { legalMovesFor } from './rules.js';

export function countRemainingBlocks(positions) {
  if (!Array.isArray(positions)) return 0;
  let count = 0;
  for (const position of positions) if (position) count += 1;
  return count;
}

export function listLegalSlides(board, positions) {
  if (!board || !Array.isArray(positions)) return Object.freeze([]);
  const moves = [];
  for (let index = 0; index < positions.length; index += 1) {
    if (!positions[index]) continue;
    for (const dir of legalMovesFor(board, positions, index)) {
      moves.push(Object.freeze({ blockIndex: index, dir }));
    }
  }
  return Object.freeze(moves);
}

export function analyzePlayState(board, positions, status = 'playing') {
  const remainingBlocks = countRemainingBlocks(positions);
  const cleared = remainingBlocks === 0;
  const legalSlides = cleared ? Object.freeze([]) : listLegalSlides(board, positions);
  const movableBlocks = new Set(legalSlides.map((move) => move.blockIndex)).size;
  const deadlocked = status === 'playing' && !cleared && legalSlides.length === 0;
  return Object.freeze({
    remainingBlocks,
    legalSlideCount: legalSlides.length,
    movableBlocks,
    cleared,
    deadlocked,
  });
}
