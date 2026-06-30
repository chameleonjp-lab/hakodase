// スライド＆退場モデルのソルバー。最短手数（通過マス数の総和）を求める。DOM 非依存。
// 1スライドのコストが可変（通過マス数）なので、均一コスト探索＝ダイクストラで最短を求める。
// 状態 = 各ブロックの位置（退場は 'E'）。時間依存ギミックが無いので手数の剰余は不要。

import { isCleared, computeSlide, applySlide, gateForBlock, DIR_NAMES } from './rules.js';

/** ゲートの向き → ブロックが出るスライド方向 */
function gateExitDir(gate) {
  return { left: 'left', right: 'right', top: 'up', bottom: 'down' }[gate.side];
}

/**
 * 軽量な可解性チェック（十分条件）。
 * 「同色ゲートへ真っ直ぐ滑って出られるブロックを片端から退場させる」を繰り返す。
 * 退場は他を塞がない（盤上から消える）ので、毎ステップ1つでも出せれば前進し、貪欲で解ける。
 * 逆生成で作った盤面はこの形の解を必ず持つ。探索不要・高速。
 * @returns {boolean}
 */
export function quickSolvable(board) {
  let positions = board.blocks.map((b) => ({ x: b.x, y: b.y }));
  let remaining = positions.length;
  for (let guard = 0; guard < positions.length + 1; guard++) {
    let progressed = false;
    for (let i = 0; i < positions.length; i++) {
      if (!positions[i]) continue;
      const gate = gateForBlock(board, i);
      if (!gate) continue;
      const r = applySlide(board, positions, i, gateExitDir(gate));
      if (r && r.exit) {
        positions = r.positions;
        remaining--;
        progressed = true;
      }
    }
    if (remaining === 0) return true;
    if (!progressed) return false;
  }
  return remaining === 0;
}

function serialize(positions) {
  let s = '';
  for (const p of positions) s += (p ? p.x + ',' + p.y : 'E') + ';';
  return s;
}

/** 最小ヒープ（[cost, payload]） */
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(cost, val) {
    const a = this.a;
    a.push({ cost, val });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let m = i;
        if (l < a.length && a[l].cost < a[m].cost) m = l;
        if (r < a.length && a[r].cost < a[m].cost) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * 盤面の最短手数（通過マス数の総和）を求める。
 * @param {object} board 静的盤面（blocks に初期位置）
 * @param {object} [opts] { maxNodes, maxCost }
 * @returns {{ solved:boolean, moves:number, reason?:string, nodes:number }}
 */
export function solve(board, opts = {}) {
  const maxNodes = opts.maxNodes ?? 400000;
  const maxCost = opts.maxCost ?? 2000;

  const start = board.blocks.map((b) => ({ x: b.x, y: b.y }));
  if (isCleared(start)) return { solved: true, moves: 0, nodes: 0 };

  const best = new Map();
  best.set(serialize(start), 0);
  const heap = new MinHeap();
  heap.push(0, start);
  let nodes = 0;

  while (heap.size > 0) {
    const { cost, val: positions } = heap.pop();
    const skey = serialize(positions);
    if (cost > (best.get(skey) ?? Infinity)) continue; // 古いエントリ
    if (cost > maxCost) return { solved: false, moves: -1, reason: 'maxCost', nodes };

    for (let i = 0; i < positions.length; i++) {
      if (!positions[i]) continue;
      for (const dir of DIR_NAMES) {
        const r = applySlide(board, positions, i, dir);
        if (!r) continue;
        nodes++;
        if (nodes > maxNodes) return { solved: false, moves: -1, reason: 'maxNodes', nodes };
        const nc = cost + r.steps;
        if (isCleared(r.positions)) return { solved: true, moves: nc, nodes };
        const nk = serialize(r.positions);
        if (nc < (best.get(nk) ?? Infinity)) {
          best.set(nk, nc);
          heap.push(nc, r.positions);
        }
      }
    }
  }

  return { solved: false, moves: -1, reason: 'exhausted', nodes };
}
