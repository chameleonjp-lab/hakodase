// P2-06実機Gateで発見した「箱数=最短操作数」のBLOCKERを止める試作盤面バンク。
// 最終版の8〜14箱・20〜35操作はPhase 3で実装する。このファイルはnormal難易度の暫定改善専用。

import { hashSeed, makeRng } from './rng.js';
import { key } from './rules.js';

export const PROVISIONAL_PUZZLE_BANK_VERSION = 'provisional-bank-v1';
export const PROVISIONAL_TRANSFORMS = Object.freeze(['identity', 'mirrorX', 'mirrorY', 'rotate180']);

// すべて7×9、4箱、初期状態から出口へ直行できる箱0個。
// expectedOptimalSwipesは現行solveOptimalSwipes()で厳密確認する。
export const PROVISIONAL_PUZZLES = Object.freeze([
  Object.freeze({
    id: 'trial-001',
    expectedOptimalSwipes: 9,
    walls: Object.freeze([[4, 5], [1, 6], [5, 6], [5, 3], [4, 3], [3, 8], [2, 8], [3, 5]]),
    gates: Object.freeze([
      Object.freeze({ side: 'top', line: 6, color: 0 }),
      Object.freeze({ side: 'top', line: 3, color: 1 }),
      Object.freeze({ side: 'left', line: 2, color: 2 }),
      Object.freeze({ side: 'left', line: 1, color: 3 }),
    ]),
    blocks: Object.freeze([
      Object.freeze({ id: 0, x: 2, y: 1, w: 1, h: 1, color: 0 }),
      Object.freeze({ id: 1, x: 6, y: 1, w: 1, h: 1, color: 1 }),
      Object.freeze({ id: 2, x: 6, y: 3, w: 1, h: 1, color: 2 }),
      Object.freeze({ id: 3, x: 6, y: 6, w: 1, h: 1, color: 3 }),
    ]),
  }),
  Object.freeze({
    id: 'trial-002',
    expectedOptimalSwipes: 10,
    walls: Object.freeze([[0, 5], [0, 7], [5, 3], [2, 4], [2, 7], [1, 3], [1, 7], [1, 6]]),
    gates: Object.freeze([
      Object.freeze({ side: 'bottom', line: 0, color: 0 }),
      Object.freeze({ side: 'bottom', line: 4, color: 1 }),
      Object.freeze({ side: 'right', line: 1, color: 2 }),
      Object.freeze({ side: 'right', line: 4, color: 3 }),
    ]),
    blocks: Object.freeze([
      Object.freeze({ id: 0, x: 6, y: 8, w: 1, h: 1, color: 0 }),
      Object.freeze({ id: 1, x: 4, y: 3, w: 1, h: 1, color: 1 }),
      Object.freeze({ id: 2, x: 2, y: 6, w: 1, h: 1, color: 2 }),
      Object.freeze({ id: 3, x: 4, y: 5, w: 1, h: 1, color: 3 }),
    ]),
  }),
  Object.freeze({
    id: 'trial-003',
    expectedOptimalSwipes: 8,
    walls: Object.freeze([[2, 2], [1, 1], [4, 4], [3, 2], [5, 5], [3, 6], [1, 4], [2, 5]]),
    gates: Object.freeze([
      Object.freeze({ side: 'bottom', line: 4, color: 0 }),
      Object.freeze({ side: 'right', line: 0, color: 1 }),
      Object.freeze({ side: 'right', line: 1, color: 2 }),
      Object.freeze({ side: 'bottom', line: 6, color: 3 }),
    ]),
    blocks: Object.freeze([
      Object.freeze({ id: 0, x: 6, y: 6, w: 1, h: 1, color: 0 }),
      Object.freeze({ id: 1, x: 0, y: 6, w: 1, h: 1, color: 1 }),
      Object.freeze({ id: 2, x: 3, y: 0, w: 1, h: 1, color: 2 }),
      Object.freeze({ id: 3, x: 3, y: 3, w: 1, h: 1, color: 3 }),
    ]),
  }),
  Object.freeze({
    id: 'trial-004',
    expectedOptimalSwipes: 8,
    walls: Object.freeze([[3, 4], [5, 2], [3, 1], [4, 1], [2, 2], [4, 3], [1, 5], [3, 2]]),
    gates: Object.freeze([
      Object.freeze({ side: 'right', line: 3, color: 0 }),
      Object.freeze({ side: 'right', line: 0, color: 1 }),
      Object.freeze({ side: 'bottom', line: 6, color: 2 }),
      Object.freeze({ side: 'right', line: 8, color: 3 }),
    ]),
    blocks: Object.freeze([
      Object.freeze({ id: 0, x: 5, y: 6, w: 1, h: 1, color: 0 }),
      Object.freeze({ id: 1, x: 1, y: 1, w: 1, h: 1, color: 1 }),
      Object.freeze({ id: 2, x: 4, y: 4, w: 1, h: 1, color: 2 }),
      Object.freeze({ id: 3, x: 0, y: 0, w: 1, h: 1, color: 3 }),
    ]),
  }),
  Object.freeze({
    id: 'trial-005',
    expectedOptimalSwipes: 12,
    walls: Object.freeze([[5, 4], [3, 8], [6, 7], [2, 1], [6, 2], [3, 5], [4, 7], [6, 6], [5, 0], [3, 4]]),
    gates: Object.freeze([
      Object.freeze({ side: 'left', line: 3, color: 0 }),
      Object.freeze({ side: 'left', line: 6, color: 1 }),
      Object.freeze({ side: 'left', line: 4, color: 2 }),
      Object.freeze({ side: 'bottom', line: 4, color: 3 }),
    ]),
    blocks: Object.freeze([
      Object.freeze({ id: 0, x: 5, y: 1, w: 1, h: 1, color: 0 }),
      Object.freeze({ id: 1, x: 6, y: 3, w: 1, h: 1, color: 1 }),
      Object.freeze({ id: 2, x: 5, y: 3, w: 1, h: 1, color: 2 }),
      Object.freeze({ id: 3, x: 6, y: 8, w: 1, h: 1, color: 3 }),
    ]),
  }),
]);

function transformPoint(transform, x, y, width, height) {
  if (transform === 'mirrorX') return { x: width - 1 - x, y };
  if (transform === 'mirrorY') return { x, y: height - 1 - y };
  if (transform === 'rotate180') return { x: width - 1 - x, y: height - 1 - y };
  return { x, y };
}

function transformGate(transform, gate, width, height) {
  const { side, line } = gate;
  if (transform === 'mirrorX') {
    if (side === 'left') return { ...gate, side: 'right' };
    if (side === 'right') return { ...gate, side: 'left' };
    return { ...gate, line: width - 1 - line };
  }
  if (transform === 'mirrorY') {
    if (side === 'top') return { ...gate, side: 'bottom' };
    if (side === 'bottom') return { ...gate, side: 'top' };
    return { ...gate, line: height - 1 - line };
  }
  if (transform === 'rotate180') {
    if (side === 'left') return { ...gate, side: 'right', line: height - 1 - line };
    if (side === 'right') return { ...gate, side: 'left', line: height - 1 - line };
    if (side === 'top') return { ...gate, side: 'bottom', line: width - 1 - line };
    return { ...gate, side: 'top', line: width - 1 - line };
  }
  return { ...gate };
}

function createColorPermutation(seedHash) {
  const permutation = [0, 1, 2, 3];
  const rng = makeRng(seedHash ^ 0xa511e9b3);
  for (let i = permutation.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  return permutation;
}

function colorCode(permutation) {
  return permutation.join('');
}

export function getProvisionalPuzzle(seed) {
  const seedHash = hashSeed(seed);
  const definition = PROVISIONAL_PUZZLES[seedHash % PROVISIONAL_PUZZLES.length];
  const transform = PROVISIONAL_TRANSFORMS[(seedHash >>> 4) % PROVISIONAL_TRANSFORMS.length];
  const permutation = createColorPermutation(seedHash);
  const width = 7;
  const height = 9;

  const walls = new Set(definition.walls.map(([x, y]) => {
    const point = transformPoint(transform, x, y, width, height);
    return key(point.x, point.y);
  }));
  const gates = definition.gates.map((gate) => {
    const transformed = transformGate(transform, gate, width, height);
    return { ...transformed, color: permutation[gate.color] };
  });
  const blocks = definition.blocks.map((block) => {
    const point = transformPoint(transform, block.x, block.y, width, height);
    return { ...block, x: point.x, y: point.y, color: permutation[block.color] };
  });

  return {
    board: { width, height, walls, oneway: new Map(), gates, blocks },
    puzzleId: `${definition.id}-${transform}-c${colorCode(permutation)}`,
    expectedOptimalSwipes: definition.expectedOptimalSwipes,
    source: PROVISIONAL_PUZZLE_BANK_VERSION,
    basePuzzleId: definition.id,
    transform,
  };
}
