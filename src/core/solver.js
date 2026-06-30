// 幅優先探索で最短手数を求めるソルバー。DOM 非依存。
// 状態 = ブロック位置列 ＋ (手数 mod cycle)。ゲート開閉が手数で決まるため手数の剰余を状態に含める。

import { isCleared, legalMove, applyMove, DIR_NAMES } from './rules.js';

/**
 * 状態をシリアライズ。位置はブロック順、末尾に手数の剰余を付ける。
 */
function serialize(positions, phase) {
  let s = '';
  for (const p of positions) {
    s += p.x + ',' + p.y + ';';
  }
  return s + '|' + phase;
}

/**
 * 盤面の最短手数を BFS で求める。
 * @param {object} board 静的盤面（blocks に初期位置を含む）
 * @param {object} [opts] { maxNodes, maxDepth }
 * @returns {{ solved: boolean, moves: number, reason?: string, nodes: number }}
 */
export function solve(board, opts = {}) {
  const maxNodes = opts.maxNodes ?? 500000;
  const maxDepth = opts.maxDepth ?? 200;
  const cycle = board.cycle || 1;

  const start = board.blocks.map((b) => ({ x: b.x, y: b.y }));

  // 初期状態で既にクリアなら 0 手。
  if (isCleared(board, start)) {
    return { solved: true, moves: 0, nodes: 0 };
  }

  const visited = new Set();
  visited.add(serialize(start, 0));

  // キュー: { positions, moveCount }
  let frontier = [{ positions: start, moveCount: 0 }];
  let depth = 0;
  let nodes = 0;

  while (frontier.length > 0) {
    if (depth >= maxDepth) {
      return { solved: false, moves: -1, reason: 'maxDepth', nodes };
    }
    const nextFrontier = [];

    for (const node of frontier) {
      for (let i = 0; i < node.positions.length; i++) {
        for (const dir of DIR_NAMES) {
          if (!legalMove(board, node.positions, node.moveCount, i, dir)) continue;
          const ns = applyMove(board, node.positions, node.moveCount, i, dir);
          nodes++;
          if (nodes > maxNodes) {
            return { solved: false, moves: -1, reason: 'maxNodes', nodes };
          }
          if (isCleared(board, ns.positions)) {
            return { solved: true, moves: depth + 1, nodes };
          }
          const skey = serialize(ns.positions, ns.moveCount % cycle);
          if (visited.has(skey)) continue;
          visited.add(skey);
          nextFrontier.push(ns);
        }
      }
    }

    frontier = nextFrontier;
    depth++;
  }

  return { solved: false, moves: -1, reason: 'exhausted', nodes };
}
