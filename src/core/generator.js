// seed付き盤面生成。スライド＆退場モデル。
// normal難易度はP3-03Rで厳密検証した10箱・4色・最短24操作の軽量盤面バンクを使用する。
// 公開ブラウザでは厳密ソルバーを実行しない。
// practice/easy/hard/expertの旧MVP生成は互換・診断用として残す。

import { makeRng, hashSeed } from './rng.js';
import { key, manhattanLowerBound, isWall, occupantAt } from './rules.js';
import { quickSolvable, solveOptimalSwipes } from './solver.js';
import {
  getRuntimeTenBlockPuzzle,
  RUNTIME_TEN_BLOCK_BANK_VERSION,
  RUNTIME_TEN_BLOCK_COUNT,
  RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES,
} from './runtime-ten-block-bank.js';

/** 難易度定義。colorsは色数、blocksは公開時の箱数。 */
export const DIFFICULTIES = {
  practice: { colors: 2, blocks: 2, width: 5, height: 6, walls: 2, legacyDistance: false, ranking: false, label: '練習(2箱・2色)' },
  easy: { colors: 3, blocks: 3, width: 6, height: 8, walls: 4, legacyDistance: false, ranking: false, label: '初級(3箱・3色)' },
  normal: { colors: 4, blocks: RUNTIME_TEN_BLOCK_COUNT, width: 7, height: 9, walls: 8, legacyDistance: false, ranking: true, label: '標準(10箱・4色)' },
  hard: { colors: 5, blocks: 5, width: 7, height: 9, walls: 7, legacyDistance: true, ranking: true, label: '上級(5箱・5色)' },
  expert: { colors: 6, blocks: 6, width: 7, height: 9, walls: 8, legacyDistance: true, ranking: true, label: '達人(6箱・6色)' },
};

export const LEGACY_DISTANCE_THRESHOLD = 22;
const MAX_ATTEMPTS = 200;

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function allCells(width, height) {
  const cells = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cells.push({ x, y });
  return cells;
}

function lineRange(board, side) {
  return side === 'left' || side === 'right' ? board.height : board.width;
}

function inwardCells(board, side, line) {
  const cells = [];
  if (side === 'left') for (let x = 0; x < board.width; x++) cells.push({ x, y: line });
  else if (side === 'right') for (let x = board.width - 1; x >= 0; x--) cells.push({ x, y: line });
  else if (side === 'top') for (let y = 0; y < board.height; y++) cells.push({ x: line, y });
  else if (side === 'bottom') for (let y = board.height - 1; y >= 0; y--) cells.push({ x: line, y });
  return cells;
}

/**
 * 旧MVP互換の逆生成。各箱が自分の出口と一直線になるため、normalの公開経路では使わない。
 */
function buildLegacySolvableBoard(cfg, rng) {
  const { colors, width, height } = cfg;
  const board = { width, height, walls: new Set(), oneway: new Map(), gates: [], blocks: [] };

  const pool = shuffle(allCells(width, height), rng);
  for (let i = 0; i < cfg.walls && pool.length > colors + 3; i++) {
    const cell = pool.pop();
    board.walls.add(key(cell.x, cell.y));
  }

  const positions = [];
  const usedGate = new Set();
  const sides = ['left', 'right', 'top', 'bottom'];

  for (let c = 0; c < colors; c++) {
    const sideOrder = shuffle(sides.slice(), rng);
    let placed = false;
    for (const side of sideOrder) {
      const lr = lineRange(board, side);
      const lines = shuffle(Array.from({ length: lr }, (_, k) => k), rng);
      for (const line of lines) {
        if (usedGate.has(side + '|' + line)) continue;
        const reachable = [];
        for (const cell of inwardCells(board, side, line)) {
          if (isWall(board, cell.x, cell.y)) break;
          if (occupantAt(positions, cell.x, cell.y) !== -1) break;
          reachable.push(cell);
        }
        if (reachable.length === 0) continue;
        const half = Math.ceil(reachable.length / 2);
        const stop = reachable[half - 1 + rng.int(reachable.length - half + 1)];
        board.gates.push({ side, line, color: c });
        board.blocks.push({ id: c, x: stop.x, y: stop.y, w: 1, h: 1, color: c });
        positions.push({ x: stop.x, y: stop.y });
        usedGate.add(side + '|' + line);
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) return null;
  }
  return board;
}

/**
 * 検証済みフォールバック盤面。
 * normalは10箱の固定seedを使い、旧4箱盤面へ戻らない。
 */
export function getFallbackBoard(difficulty) {
  if (difficulty === 'normal') return getRuntimeTenBlockPuzzle('normal-fallback-v2').board;

  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const colors = cfg.colors;
  const width = cfg.width;
  const height = cfg.height;
  const blocks = [];
  const gates = [];
  for (let c = 0; c < colors; c++) {
    blocks.push({ id: c, x: width - 1, y: c, w: 1, h: 1, color: c });
    gates.push({ side: 'left', line: c, color: c });
  }
  return { width, height, walls: new Set(), oneway: new Map(), gates, blocks };
}

function generateNormalFromBank(baseSeed) {
  const selected = getRuntimeTenBlockPuzzle(baseSeed);
  const positions = selected.board.blocks.map((block) => ({ x: block.x, y: block.y }));
  return {
    board: selected.board,
    seed: baseSeed,
    difficulty: 'normal',
    shortestDistanceCells: manhattanLowerBound(selected.board, positions),
    optimalSwipes: selected.expectedOptimalSwipes,
    exact: true,
    fromFallback: false,
    source: selected.source,
    generatorVersion: selected.generatorVersion,
    puzzleId: selected.puzzleId,
    profileId: selected.profileId,
    templateId: selected.templateId,
    provisional: true,
  };
}

/**
 * 盤面を生成する。
 * @param {object} options { seed, difficulty }
 * @returns {{ board, seed, difficulty, shortestDistanceCells, optimalSwipes, exact, fromFallback, source?, generatorVersion?, puzzleId?, profileId?, templateId?, provisional? }}
 */
export function generateBoard(options = {}) {
  const difficulty = options.difficulty && DIFFICULTIES[options.difficulty] ? options.difficulty : 'normal';
  const cfg = DIFFICULTIES[difficulty];
  const baseSeed = options.seed != null ? options.seed : Date.now();

  if (difficulty === 'normal') return generateNormalFromBank(baseSeed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const derived = (hashSeed(baseSeed) ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
    const rng = makeRng(derived);
    const board = buildLegacySolvableBoard(cfg, rng);
    if (!board) continue;

    const startPos = board.blocks.map((block) => ({ x: block.x, y: block.y }));
    const lowerBound = manhattanLowerBound(board, startPos);
    if (cfg.legacyDistance && lowerBound < LEGACY_DISTANCE_THRESHOLD) continue;
    if (!quickSolvable(board)) continue;

    const solved = solveOptimalSwipes(board, { maxNodes: 20000 });
    return {
      board,
      seed: baseSeed,
      difficulty,
      shortestDistanceCells: lowerBound,
      optimalSwipes: solved.optimalSwipes,
      exact: solved.solved,
      fromFallback: false,
      source: 'legacy-runtime-generator-v1',
      generatorVersion: 'legacy-runtime-generator-v1',
      provisional: true,
    };
  }

  const board = getFallbackBoard(difficulty);
  const positions = board.blocks.map((block) => ({ x: block.x, y: block.y }));
  const distance = manhattanLowerBound(board, positions);
  const solved = solveOptimalSwipes(board, { maxNodes: 20000 });
  return {
    board,
    seed: baseSeed,
    difficulty,
    shortestDistanceCells: distance,
    optimalSwipes: solved.optimalSwipes,
    exact: solved.solved,
    fromFallback: true,
    source: 'legacy-fallback-v1',
    generatorVersion: 'legacy-fallback-v1',
    provisional: true,
  };
}

export const NORMAL_RUNTIME_PROFILE = Object.freeze({
  blockCount: RUNTIME_TEN_BLOCK_COUNT,
  colorCount: DIFFICULTIES.normal.colors,
  optimalSwipes: RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES,
  bankVersion: RUNTIME_TEN_BLOCK_BANK_VERSION,
});
