// 盤面の純粋ルール関数群。DOM・Canvas に一切依存しない。
// GameEngine と Solver はこのファイルの関数を共有し、手数とルールを完全一致させる。

/** 4方向の単位ベクトル */
export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIR_NAMES = ['up', 'down', 'left', 'right'];

/** セルキー */
export function key(x, y) {
  return x + ',' + y;
}

/** 最大公約数・最小公倍数（cycle 計算用） */
export function gcd(a, b) {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
export function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

/**
 * 全ゲート周期の最小公倍数。ゲートが無ければ 1。
 * BFS の状態に含める moveCount の周期。
 * @param {Array<{period:number}>} gates
 */
export function computeCycle(gates) {
  if (!gates || gates.length === 0) return 1;
  let c = 1;
  for (const g of gates) {
    c = lcm(c, g.period);
  }
  return c || 1;
}

/**
 * ゲートが指定手数で開いているか。手数のみで決まる純粋関数。
 * open = ((moveCount + phase) % period) < openFor
 */
export function gateOpen(gate, moveCount) {
  const period = gate.period;
  const phase = gate.phase || 0;
  const openFor = gate.openFor;
  return ((moveCount + phase) % period + period) % period < openFor;
}

/** 指定セルに「閉じているゲート」があるか */
export function isClosedGateAt(board, x, y, moveCount) {
  if (!board.gates) return false;
  for (const g of board.gates) {
    if (g.x === x && g.y === y) {
      return !gateOpen(g, moveCount);
    }
  }
  return false;
}

export function inBounds(board, x, y) {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function isWall(board, x, y) {
  return board.walls instanceof Set
    ? board.walls.has(key(x, y))
    : false;
}

/** 一方通行床の向き（無ければ null） */
export function onewayDirAt(board, x, y) {
  if (!board.oneway) return null;
  if (board.oneway instanceof Map) {
    return board.oneway.get(key(x, y)) || null;
  }
  return board.oneway[key(x, y)] || null;
}

/** 指定セルを占有しているブロックの index（exceptIndex は除く）。無ければ -1 */
export function occupantAt(positions, x, y, exceptIndex = -1) {
  for (let i = 0; i < positions.length; i++) {
    if (i === exceptIndex) continue;
    if (positions[i].x === x && positions[i].y === y) return i;
  }
  return -1;
}

/**
 * index のブロックを dir に 1 マス動かせるか。
 * @param {object} board 静的盤面
 * @param {Array<{x,y}>} positions 現在位置
 * @param {number} moveCount 現在手数（ゲート判定に使用）
 * @param {number} index ブロック番号
 * @param {string} dir 'up'|'down'|'left'|'right'
 */
export function legalMove(board, positions, moveCount, index, dir) {
  const d = DIRECTIONS[dir];
  if (!d) return false;
  const cur = positions[index];

  // 一方通行床にいる場合、出る方向は矢印方向のみ。
  const ow = onewayDirAt(board, cur.x, cur.y);
  if (ow && ow !== dir) return false;

  const nx = cur.x + d.dx;
  const ny = cur.y + d.dy;

  if (!inBounds(board, nx, ny)) return false;
  if (isWall(board, nx, ny)) return false;
  if (occupantAt(positions, nx, ny, index) !== -1) return false;
  // 進入先が閉じたゲートなら不可。
  if (isClosedGateAt(board, nx, ny, moveCount)) return false;

  return true;
}

/**
 * 移動を適用した新しい状態を返す（元を破壊しない）。legalMove が真であることが前提。
 * @returns {{ positions: Array<{x,y}>, moveCount: number }}
 */
export function applyMove(board, positions, moveCount, index, dir) {
  const d = DIRECTIONS[dir];
  const next = positions.map((p) => ({ x: p.x, y: p.y }));
  next[index] = { x: positions[index].x + d.dx, y: positions[index].y + d.dy };
  return { positions: next, moveCount: moveCount + 1 };
}

/** 指定位置にあるブロックが、対応する同色ゴール上にあるか */
export function isBlockOnGoal(board, positions, index) {
  const p = positions[index];
  const color = board.blocks[index].color;
  for (const g of board.goals) {
    if (g.x === p.x && g.y === p.y && g.color === color) return true;
  }
  return false;
}

/** 全ブロックが同色ゴール上にあればクリア */
export function isCleared(board, positions) {
  for (let i = 0; i < positions.length; i++) {
    if (!isBlockOnGoal(board, positions, i)) return false;
  }
  return true;
}

/** index のブロックの全合法手を返す */
export function legalMovesFor(board, positions, moveCount, index) {
  const out = [];
  for (const dir of DIR_NAMES) {
    if (legalMove(board, positions, moveCount, index, dir)) out.push(dir);
  }
  return out;
}

/** ブロック→対応同色ゴールのマンハッタン距離の総和（最短手数の下界） */
export function manhattanLowerBound(board, positions) {
  let sum = 0;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const color = board.blocks[i].color;
    let best = Infinity;
    for (const g of board.goals) {
      if (g.color !== color) continue;
      const d = Math.abs(g.x - p.x) + Math.abs(g.y - p.y);
      if (d < best) best = d;
    }
    if (best === Infinity) best = 0;
    sum += best;
  }
  return sum;
}
