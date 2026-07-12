// 盤面の純粋ルール関数群。DOM・Canvas に一切依存しない。
// GameEngine と Solver はこのファイルの関数を共有し、スライドルールを完全一致させる。
//
// ゲーム中核（Block Out 系にインスパイア／独自実装）:
//  - ブロックはドラッグ方向へ「壁・他ブロック・盤端に当たるまで一気にスライド」する。
//  - 各ブロックは自分と同じ色の「出口ゲート（盤の縁）」から盤外へ出すと退場（達成）。
//  - すべてのブロックを退場させるとクリア。
//  - 1スライドで通過したマス数は distanceCells として扱う。

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

export function inBounds(board, x, y) {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function isWall(board, x, y) {
  return board.walls instanceof Set ? board.walls.has(key(x, y)) : false;
}

/** 一方通行床の向き（無ければ null）。その向きにしか通過・進入できない。 */
export function onewayDirAt(board, x, y) {
  if (!board.oneway) return null;
  if (board.oneway instanceof Map) return board.oneway.get(key(x, y)) || null;
  return board.oneway[key(x, y)] || null;
}

/** 指定セルを占有している（退場していない）ブロックの index。無ければ -1 */
export function occupantAt(positions, x, y, exceptIndex = -1) {
  for (let i = 0; i < positions.length; i++) {
    if (i === exceptIndex) continue;
    const p = positions[i];
    if (p && p.x === x && p.y === y) return i;
  }
  return -1;
}

/**
 * セル (x,y) から dir 方向へ盤外へ出るときに横切るゲートを返す。無ければ null。
 * left/right の line は行(y)、top/bottom の line は列(x)。
 */
export function gateForExit(board, x, y, dir) {
  if (!board.gates) return null;
  let side, line;
  if (dir === 'left') { side = 'left'; line = y; }
  else if (dir === 'right') { side = 'right'; line = y; }
  else if (dir === 'up') { side = 'top'; line = x; }
  else if (dir === 'down') { side = 'bottom'; line = x; }
  else return null;
  for (const g of board.gates) {
    if (g.side === side && g.line === line) return g;
  }
  return null;
}

/** ゲートの「盤外の開口セル」座標（描画・距離計算用）。 */
export function gateOpeningCell(board, gate) {
  switch (gate.side) {
    case 'left': return { x: -1, y: gate.line };
    case 'right': return { x: board.width, y: gate.line };
    case 'top': return { x: gate.line, y: -1 };
    case 'bottom': return { x: gate.line, y: board.height };
    default: return { x: -1, y: -1 };
  }
}

/** ブロック index に対応する（同色の）ゲート。無ければ null。 */
export function gateForBlock(board, index) {
  const color = board.blocks[index].color;
  for (const g of board.gates) if (g.color === color) return g;
  return null;
}

/**
 * index のブロックを dir にスライドした結果を計算する（純粋）。
 * @returns {{ legal:boolean, steps:number, exit:boolean, x:number|null, y:number|null }}
 *   legal=false は「1マスも動けない＝非合法手」。
 *   exit=true なら盤外へ退場（x,y は null）。
 */
export function computeSlide(board, positions, index, dir) {
  const pos = positions[index];
  if (!pos) return { legal: false, steps: 0, exit: false, x: null, y: null };
  const d = DIRECTIONS[dir];
  if (!d) return { legal: false, steps: 0, exit: false, x: null, y: null };

  // 出発セルが一方通行なら、その向きにしか出られない。
  const ow = onewayDirAt(board, pos.x, pos.y);
  if (ow && ow !== dir) return { legal: false, steps: 0, exit: false, x: null, y: null };

  let x = pos.x;
  let y = pos.y;
  let steps = 0;
  const color = board.blocks[index].color;

  for (;;) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (!inBounds(board, nx, ny)) {
      // 盤端。同色ゲートがあれば退場、無ければ停止。
      const gate = gateForExit(board, x, y, dir);
      if (gate && gate.color === color) {
        steps += 1; // 盤外へ抜ける1歩
        return { legal: true, steps, exit: true, x: null, y: null };
      }
      break;
    }
    if (isWall(board, nx, ny)) break;
    if (occupantAt(positions, nx, ny, index) !== -1) break;
    // 進入先が逆向きの一方通行なら壁扱いで停止。
    const ow2 = onewayDirAt(board, nx, ny);
    if (ow2 && ow2 !== dir) break;
    x = nx;
    y = ny;
    steps += 1;
  }

  if (steps === 0) return { legal: false, steps: 0, exit: false, x: null, y: null };
  return { legal: true, steps, exit: false, x, y };
}

/** index が dir に動けるか（1マス以上スライドできるか） */
export function legalMove(board, positions, index, dir) {
  return computeSlide(board, positions, index, dir).legal;
}

/**
 * スライドを適用した新しい状態を返す（元を破壊しない）。非合法なら null。
 * @returns {{ positions:Array, steps:number, exit:boolean }|null}
 */
export function applySlide(board, positions, index, dir) {
  const r = computeSlide(board, positions, index, dir);
  if (!r.legal) return null;
  const next = positions.map((p) => (p ? { x: p.x, y: p.y } : null));
  next[index] = r.exit ? null : { x: r.x, y: r.y };
  return { positions: next, steps: r.steps, exit: r.exit };
}

/** index の全合法方向 */
export function legalMovesFor(board, positions, index) {
  const out = [];
  for (const dir of DIR_NAMES) {
    if (legalMove(board, positions, index, dir)) out.push(dir);
  }
  return out;
}

/** 全ブロックが退場していればクリア */
export function isCleared(positions) {
  for (const p of positions) if (p) return false;
  return true;
}

/**
 * 各ブロック→対応ゲート開口までのマンハッタン距離の総和。
 * 退場に必要な最小通過マス数の下界（最小通過マス数の下界）。
 */
export function manhattanLowerBound(board, positions) {
  let sum = 0;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!p) continue;
    const gate = gateForBlock(board, i);
    if (!gate) continue;
    const open = gateOpeningCell(board, gate);
    sum += Math.abs(open.x - p.x) + Math.abs(open.y - p.y);
  }
  return sum;
}
