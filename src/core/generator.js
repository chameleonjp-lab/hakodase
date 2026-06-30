// seed 付き盤面生成。最短20手保証（マンハッタン距離の下界）とフォールバックを持つ。
// 無限ループ禁止: 試行回数・探索ともに上限を持つ。DOM 非依存。
//
// 設計上の重要な分岐（docs/architecture.md 参照）:
//  - ランキング難易度(4〜6色)は「開放グリッド＋開閉ゲート」のみを使う。
//    ・マンハッタン距離総和(=最短手数の下界)を 22 以上にして「最短20手以上」を保証する。
//    ・開放グリッドは複数ブランクのスライドパズルとして常に可解。ゲートは openFor>=1 で
//      必ず周期的に開くため可解性を壊さない。よって BFS による全探索検証は不要。
//      （多ブロックの厳密 BFS は状態爆発で非現実的なため、構成で保証する。）
//  - 非ランキング難易度(2〜3色)は壁・一方通行床を含む小盤面で、BFS により厳密に検証する。

import { makeRng, hashSeed } from './rng.js';
import { key, computeCycle, manhattanLowerBound } from './rules.js';
import { solve } from './solver.js';

/** 難易度定義。colors = 色数（= ブロック数, 1色1ブロック1ゴール）。 */
export const DIFFICULTIES = {
  practice: { colors: 2, width: 5, height: 5, walls: 2, oneway: 1, gates: 0, min20: false, ranking: false, bfsVerify: true, label: '練習(2色)' },
  easy: { colors: 3, width: 5, height: 5, walls: 2, oneway: 1, gates: 1, min20: false, ranking: false, bfsVerify: true, label: '初級(3色)' },
  normal: { colors: 4, width: 6, height: 6, walls: 0, oneway: 0, gates: 1, min20: true, ranking: true, bfsVerify: false, label: '標準(4色)' },
  hard: { colors: 5, width: 6, height: 6, walls: 0, oneway: 0, gates: 2, min20: true, ranking: true, bfsVerify: false, label: '上級(5色)' },
  expert: { colors: 6, width: 6, height: 6, walls: 0, oneway: 0, gates: 2, min20: true, ranking: true, bfsVerify: false, label: '達人(6色)' },
};

export const MIN20_THRESHOLD = 22; // マンハッタン距離総和の目標（>=20 の余裕を持たせる）
const MAX_PLACE_ATTEMPTS = 200; // 配置の試行上限（軽量。距離計算のみ）
const MAX_BFS_ATTEMPTS = 120; // BFS 検証難易度の試行上限
const GEN_SOLVE_OPTS = { maxNodes: 200000, maxDepth: 80 };

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 配列を rng で破壊的シャッフル（Fisher-Yates） */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function allCells(width, height) {
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) cells.push({ x, y });
  }
  return cells;
}

function totalManhattan(goals, blocks) {
  let sum = 0;
  for (let c = 0; c < blocks.length; c++) {
    sum += manhattan(blocks[c], goals[c]);
  }
  return sum;
}

/**
 * 1 回分の盤面候補を組み立てる（解の検証は呼び出し側）。
 */
function buildCandidate(cfg, rng) {
  const { colors, width, height } = cfg;

  // ゴール配置: 全セルから distinct に colors 個。
  const pool = shuffle(allCells(width, height), rng);
  const goals = [];
  for (let c = 0; c < colors; c++) {
    goals.push({ ...pool.pop(), color: c });
  }

  // ブロック配置: 各色ゴールから遠い残りセルを選ぶ（下界を伸ばす）。
  const blocks = [];
  for (let c = 0; c < colors; c++) {
    const goal = goals[c];
    const ranked = pool
      .map((cell, idx) => ({ idx, cell, d: manhattan(cell, goal) }))
      .sort((a, b) => b.d - a.d);
    // 上位（遠い）候補からランダムに選ぶ。
    const topN = Math.max(1, Math.ceil(ranked.length / 3));
    const chosen = ranked[rng.int(Math.min(topN, ranked.length))];
    blocks.push({ id: c, x: chosen.cell.x, y: chosen.cell.y, w: 1, h: 1, color: c });
    const removeIdx = pool.findIndex((p) => p.x === chosen.cell.x && p.y === chosen.cell.y);
    pool.splice(removeIdx, 1);
  }

  // 残りセルに 壁 / 一方通行 / ゲート を配置。
  const walls = new Set();
  for (let i = 0; i < cfg.walls && pool.length > 0; i++) {
    const cell = pool.pop();
    walls.add(key(cell.x, cell.y));
  }

  const oneway = new Map();
  const dirs = ['up', 'down', 'left', 'right'];
  for (let i = 0; i < cfg.oneway && pool.length > 0; i++) {
    const cell = pool.pop();
    oneway.set(key(cell.x, cell.y), rng.pick(dirs));
  }

  const gates = [];
  for (let i = 0; i < cfg.gates && pool.length > 0; i++) {
    const cell = pool.pop();
    const period = 4;
    gates.push({ x: cell.x, y: cell.y, period, phase: rng.int(period), openFor: 2 });
  }

  const board = {
    width,
    height,
    walls,
    oneway,
    gates,
    goals,
    blocks,
    cycle: computeCycle(gates),
  };
  return board;
}

/**
 * ランキング難易度の生成。開放グリッド＋ゲートのみ。
 * マンハッタン距離総和 >= THRESHOLD を満たす配置を軽量に探す（BFS 不要）。
 */
function generateRanking(cfg, baseSeed) {
  for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt++) {
    const derived = (hashSeed(baseSeed) ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
    const rng = makeRng(derived);
    const board = buildCandidate(cfg, rng);
    const sum = totalManhattan(board.goals, board.blocks);
    if (sum >= MIN20_THRESHOLD) {
      // 開放グリッド＋ゲートは構成上常に可解。最短手数は下界(マンハッタン総和)を採用。
      return {
        board,
        seed: baseSeed,
        difficulty: cfg.key,
        shortestSolutionMoves: sum, // 検証済み下界（実際の最短はこれ以上）
        exact: false,
        fromFallback: false,
      };
    }
  }
  return null; // 配置に失敗（極めて稀）。呼び出し側でフォールバック。
}

/**
 * 非ランキング難易度の生成。壁・一方通行を含む小盤面を BFS で厳密検証。
 */
function generateVerified(cfg, baseSeed) {
  for (let attempt = 0; attempt < MAX_BFS_ATTEMPTS; attempt++) {
    const derived = (hashSeed(baseSeed) ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0;
    const rng = makeRng(derived);
    const board = buildCandidate(cfg, rng);
    const result = solve(board, GEN_SOLVE_OPTS);
    if (!result.solved) continue;
    if (cfg.min20 && result.moves < 20) continue;
    return {
      board,
      seed: baseSeed,
      difficulty: cfg.key,
      shortestSolutionMoves: result.moves,
      exact: true,
      fromFallback: false,
    };
  }
  return null;
}

/**
 * 検証済みフォールバック盤面。各色を独立した縦一列に配置し、相互干渉ゼロ。
 * 開放盤面なので常に可解で、最短手数 = (height-1)*colors（解析的に厳密）。
 */
export function getFallbackBoard(difficulty) {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const colors = cfg.colors;
  const width = Math.max(6, colors);
  const height = 7; // 各色のブロックは縦 6 マス移動 → 干渉ゼロで厳密
  const goals = [];
  const blocks = [];
  for (let c = 0; c < colors; c++) {
    goals.push({ x: c, y: 0, color: c });
    blocks.push({ id: c, x: c, y: height - 1, w: 1, h: 1, color: c });
  }
  return {
    width,
    height,
    walls: new Set(),
    oneway: new Map(),
    gates: [],
    goals,
    blocks,
    cycle: 1,
  };
}

/**
 * 盤面を生成する。
 * @param {object} options { seed, difficulty }
 * @returns {{ board, seed, difficulty, shortestSolutionMoves, exact, fromFallback }}
 */
export function generateBoard(options = {}) {
  const difficulty = options.difficulty && DIFFICULTIES[options.difficulty] ? options.difficulty : 'normal';
  const cfg = { ...DIFFICULTIES[difficulty], key: difficulty };
  const baseSeed = options.seed != null ? options.seed : Date.now();

  const result = cfg.ranking
    ? generateRanking(cfg, baseSeed)
    : generateVerified(cfg, baseSeed);

  if (result) return result;

  // 全試行失敗: 検証済みフォールバック（解析的に最短手数を確定）。
  const board = getFallbackBoard(difficulty);
  const moves = manhattanLowerBound(board, board.blocks.map((b) => ({ x: b.x, y: b.y })));
  return {
    board,
    seed: baseSeed,
    difficulty,
    shortestSolutionMoves: moves,
    exact: true,
    fromFallback: true,
  };
}
