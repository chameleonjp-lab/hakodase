// seed付き盤面生成。スライド＆退場モデル。
// normal難易度はP2-06実機Gateで発見した「箱数=最短操作数」のBLOCKERを避けるため、
// 厳密最短を事前確認した試作盤面バンクを使用する。
// practice/easy/hard/expertの旧MVP生成は互換・診断用として残す。

import { makeRng, hashSeed } from './rng.js';
import { key, manhattanLowerBound, isWall, occupantAt } from './rules.js';
import { quickSolvable, solveOptimalSwipes } from './solver.js';
import { getProvisionalPuzzle, PROVISIONAL_PUZZLE_BANK_VERSION } from './provisional-puzzle-bank.js';

/** 難易度定義。colors = 色数（旧MVPではブロック数と同じ）。 */
export const DIFFICULTIES = {
  practice: { colors: 2, width: 5, height: 6, walls: 2, legacyDistance: false, ranking: false, label: '練習(2色)' },
  easy: { colors: 3, width: 6, height: 8, walls: 4, legacyDistance: false, ranking: false, label: '初級(3色)' },
  normal: { colors: 4, width: 7, height: 9, walls: 8, legacyDistance: false, ranking: true, label: '標準(試作問題バンク)' },
  hard: { colors: 5, width: 7, height: 9, walls: 7, legacyDistance: true, ranking: true, label: '上級(5色)' },
  expert: { colors: 6, width: 7, height: 9, walls: 8, legacyDistance: true, ranking: true, label: '達人(6色)' },
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
 * 旧MVP互換の逆生成。各箱が自分の出口と一直線になるため、normalの本番経路では使わない。
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
 * normalは非自明な試作盤面バンクを使用し、旧4操作盤面へ戻らない。
 */
export function getFallbackBoard(difficulty) {
  if (difficulty === 'normal') return getProvisionalPuzzle('normal-fallback-v1').board;

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
  const selected = getProvisionalPuzzle(baseSeed);
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
    generatorVersion: PROVISIONAL_PUZZLE_BANK_VERSION,
    puzzleId: selected.puzzleId,
    provisional: true,
  };
}

/**
 * 盤面を生成する。
 * @param {object} options { seed, difficulty }
 * @returns {{ board, seed, difficulty, shortestDistanceCells, optimalSwipes, exact, fromFallback, source?, generatorVersion?, puzzleId?, provisional? }}
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
