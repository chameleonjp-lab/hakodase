// ランキング保存サービス。GameEngine から分離。
// RankingService interface を実装すれば将来オンライン版へ差し替え可能。

/**
 * @typedef {Object} Score
 * @property {string|number} seed
 * @property {string} difficulty
 * @property {number} timeMs
 * @property {number} moves
 * @property {string} clearedAt ISO 文字列
 */

/** 抽象インターフェース（ドキュメント用） */
export class RankingService {
  // eslint-disable-next-line no-unused-vars
  async saveScore(score) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async listScores(filter) { throw new Error('not implemented'); }
  async clearScores() { throw new Error('not implemented'); }
}

const STORAGE_KEY = 'hakodase.ranking.v1';

/**
 * localStorage ベースの実装。テスト時はフェイクストレージを注入できる。
 */
export class LocalRankingService extends RankingService {
  /**
   * @param {Storage|object} [storage] getItem/setItem/removeItem を持つオブジェクト
   */
  constructor(storage) {
    super();
    this.storage =
      storage ||
      (typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage());
  }

  _read() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  _write(arr) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  /** @param {Score} score */
  async saveScore(score) {
    const entry = {
      seed: score.seed,
      difficulty: score.difficulty,
      timeMs: Math.round(score.timeMs),
      moves: score.moves,
      clearedAt: score.clearedAt || new Date().toISOString(),
    };
    const all = this._read();
    all.push(entry);
    all.sort((a, b) => a.timeMs - b.timeMs);
    this._write(all);
    return entry;
  }

  /**
   * @param {object} [filter] { difficulty, seed, limit }
   * @returns {Promise<Score[]>} タイム昇順
   */
  async listScores(filter = {}) {
    let all = this._read();
    if (filter.difficulty) all = all.filter((s) => s.difficulty === filter.difficulty);
    if (filter.seed != null) all = all.filter((s) => String(s.seed) === String(filter.seed));
    all.sort((a, b) => a.timeMs - b.timeMs);
    if (filter.limit) all = all.slice(0, filter.limit);
    return all;
  }

  async clearScores() {
    this.storage.removeItem(STORAGE_KEY);
  }
}

/** メモリ上のストレージ（Node テスト・非対応環境用） */
export class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
