// seed 付き盤面生成。スライド＆退場モデル。最短20手保証（マンハッタン下界）とフォールバックを持つ。
// 無限ループ禁止: 試行回数に上限を持つ。DOM 非依存。
//
// 生成方針（逆生成・探索不要）:
//  - 各ブロックを「自分の同色ゲートから盤内へ滑り込ませて」配置する。挿入時に通路が空である限り、
//    その逆順（後から入れたものから先に出す）が必ず成立する正解手順になる＝常に可解。
//  - 各ブロックは自分のゲートと一直線上に並ぶので、最短手数(通過マス数の総和)はマンハッタン距離総和に一致し、
//    解析的に確定できる（探索不要）。
//  - min20 難易度は総和 >= 22 を満たす配置のみ採用（>=20 の保証）。
//  - 仕上げに quickSolvable で可解性を再確認（十分条件）。失敗時は seed を変えて再試行→フォールバック。
//  - 盤面サイズはタイムアタック向けに縦長 7×9 を基本にする。

import { makeRng, hashSeed } from './rng.js';
import { key, manhattanLowerBound, isWall, occupantAt } from './rules.js';
import { quickSolvable } from './solver.js';

/** 難易度定義。colors = 色数（= ブロック数, 1色1ブロック1ゲート）。 */
export const DIFFICULTIES = {
  practice: { colors: 2, width: 5, height: 6, walls: 2, min20: false, ranking: false, label: '練習(2色)' },
  easy: { colors: 3, width: 6, height: 8, walls: 4, min20: false, ranking: false, label: '初級(3色)' },
  normal: { colors: 4, width: 7, height: 9, walls: 6, min20: true, ranking: true, label: '標準(4色)' },
  hard: { colors: 5, width: 7, height: 9, walls: 7, min20: true, ranking: true, label: '上級(5色)' },
  expert: { colors: 6, width: 7, height: 9, walls: 8, min20: true, ranking: true, label: '達人(6色)' },
};

export const MIN20_THRESHOLD = 22;
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

/** side 用の line の取りうる範囲 */
function lineRange(board, side) {
  return side === 'left' || side === 'right' ? board.height : board.width;
}

/** ゲートから盤内へ向かうセル列（手前から奥へ） */
function inwardCells(board, side, line) {
  const cells = [];
  if (side === 'left') for (let x = 0; x < board.width; x++) cells.push({ x, y: line });
  else if (side === 'right') for (let x = board.width - 1; x >= 0; x--) cells.push({ x, y: line });
  else if (side === 'top') for (let y = 0; y < board.height; y++) cells.push({ x: line, y });
  else if (side === 'bottom') for (let y = board.height - 1; y >= 0; y--) cells.push({ x: line, y });
  return cells;
}

/**
 * 逆生成で 1 枚の盤面を作る。失敗（配置不能）したら null。
 */
function buildSolvableBoard(cfg, rng) {
  const { colors, width, height } = cfg;
  const board = { width, height, walls: new Set(), oneway: new Map(), gates: [], blocks: [] };

  // 壁を先に置く。
  const pool = shuffle(allCells(width, height), rng);
  for (let i = 0; i < cfg.walls && pool.length > colors + 3; i++) {
    const cell = pool.pop();
    board.walls.add(key(cell.x, cell.y));
  }

  const positions = []; // 既配置ブロックの占有判定用
  const usedGate = new Set();
  const sides = ['left', 'right', 'top', 'bottom'];

  for (let c = 0; c < colors; c++) {
    // ゲート候補をランダム順に試し、挿入できる場所を探す。
    const sideOrder = shuffle(sides.slice(), rng);
    let placed = false;
    for (const side of sideOrder) {
      const lr = lineRange(board, side);
      const lines = shuffle(Array.from({ length: lr }, (_, k) => k), rng);
      for (const line of lines) {
        if (usedGate.has(side + '|' + line)) continue;
        // 手前から空セルを辿り、止められる候補を集める。
        const reachable = [];
        for (const cell of inwardCells(board, side, line)) {
          if (isWall(board, cell.x, cell.y)) break;
          if (occupantAt(positions, cell.x, cell.y) !== -1) break;
          reachable.push(cell);
        }
        if (reachable.length === 0) continue;
        // 退場距離を稼ぐため奥寄りを優先しつつランダム。
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
 * 検証済みフォールバック盤面。各色が独立した行を真横に滑って左の同色ゲートから出るだけ。
 * 相互干渉ゼロで常に可解。最短手数 = width*colors（解析的に厳密）。
 */
export function getFallbackBoard(difficulty) {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const colors = cfg.colors;
  const width = 7;
  const height = Math.max(9, colors);
  const blocks = [];
  const gates = [];
  for (let c = 0; c < colors; c++) {
    blocks.push({ id: c, x: width - 1, y: c, w: 1, h: 1, color: c });
    gates.push({ side: 'left', line: c, color: c });
  }
  return { width, height, walls: new Set(), oneway: new Map(), gates, blocks };
}

/**
 * 盤面を生成する。
 * @param {object} options { seed, difficulty }
 * @returns {{ board, seed, difficulty, shortestSolutionMoves, exact, fromFallback }}
 */
export function generateBoard(options = {}) {
  const difficulty = options.difficulty && DIFFICULTIES[options.difficulty] ? options.difficulty : 'normal';
  const cfg = DIFFICULTIES[difficulty];
  const baseSeed = options.seed != null ? options.seed : Date.now();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const derived = (hashSeed(baseSeed) ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
    const rng = makeRng(derived);
    const board = buildSolvableBoard(cfg, rng);
    if (!board) continue;

    const startPos = board.blocks.map((b) => ({ x: b.x, y: b.y }));
    const lb = manhattanLowerBound(board, startPos);
    if (cfg.min20 && lb < MIN20_THRESHOLD) continue;
    if (!quickSolvable(board)) continue; // 念のための十分条件チェック

    return {
      board,
      seed: baseSeed,
      difficulty,
      shortestSolutionMoves: lb, // 一直線配置のため最短手数に一致（厳密）
      exact: true,
      fromFallback: false,
    };
  }

  const board = getFallbackBoard(difficulty);
  const moves = manhattanLowerBound(board, board.blocks.map((b) => ({ x: b.x, y: b.y })));
  return { board, seed: baseSeed, difficulty, shortestSolutionMoves: moves, exact: true, fromFallback: true };
}
