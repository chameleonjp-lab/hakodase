// 決定論的な seed 付き擬似乱数生成器。
// 同じ seed なら必ず同じ数列を返す（盤面の再現性に使用）。
// 外部依存なし・DOM 非依存。Node でもブラウザでも同一に動く。

/**
 * 文字列または数値の seed を 32bit 整数へ変換する。
 * @param {string|number} seed
 * @returns {number} 32bit 符号なし整数
 */
export function hashSeed(seed) {
  if (typeof seed === 'number') {
    // 整数化して 32bit に収める。
    return seed >>> 0;
  }
  const str = String(seed);
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * mulberry32: 軽量で再現性のある PRNG。
 * @param {string|number} seed
 * @returns {{ next: () => number, int: (n:number)=>number, pick: (arr:any[])=>any, state: () => number }}
 */
export function makeRng(seed) {
  let a = hashSeed(seed);
  // 0 だと縮退するので 1 を加える。
  if (a === 0) a = 0x9e3779b9;

  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    /** [0,1) の浮動小数 */
    next,
    /** [0,n) の整数 */
    int(n) {
      return Math.floor(next() * n);
    },
    /** 配列から1つ選ぶ */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    /** 現在の内部状態（デバッグ用） */
    state() {
      return a >>> 0;
    },
  };
}
