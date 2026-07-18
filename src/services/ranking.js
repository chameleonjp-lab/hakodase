// ランキング保存サービス。v2操作数と旧v1距離記録を混ぜない。

export class RankingService {
  async saveScore(score) { throw new Error('not implemented'); }
  async listScores(filter) { throw new Error('not implemented'); }
  async clearScores() { throw new Error('not implemented'); }
}

export const STORAGE_KEY = 'hakodase.ranking.v2';

function validNumber(value) { return Number.isFinite(value) && value >= 0; }

function normalize(score) {
  const timeMs = Math.round(Number(score.timeMs));
  const swipeCount = Math.round(Number(score.swipeCount));
  const distanceCells = Math.round(Number(score.distanceCells));
  if (!validNumber(timeMs) || !validNumber(swipeCount) || !validNumber(distanceCells)) return null;
  if (!score.difficulty || score.seed == null) return null;
  return {
    seed: score.seed,
    difficulty: String(score.difficulty),
    mode: score.mode ? String(score.mode) : 'legacy',
    timeMs,
    swipeCount,
    distanceCells,
    clearedAt: score.clearedAt || new Date().toISOString(),
  };
}

function byRank(a, b) {
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  if (a.swipeCount !== b.swipeCount) return a.swipeCount - b.swipeCount;
  return String(a.clearedAt || '').localeCompare(String(b.clearedAt || ''));
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_) {
    // 保存機能が制限されたブラウザではメモリ保存へ退避する。
  }
  return new MemoryStorage();
}

export class LocalRankingService extends RankingService {
  constructor(storage = defaultStorage()) {
    super();
    this.storage = storage;
  }

  _read() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const values = JSON.parse(raw);
      if (!Array.isArray(values)) return [];
      return values.map(normalize).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  _write(values) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(values));
  }

  async saveScore(score) {
    const entry = normalize(score);
    if (!entry) throw new Error('invalid score');
    const all = this._read();
    all.push(entry);
    all.sort(byRank);
    this._write(all);
    return entry;
  }

  async listScores(filter = {}) {
    let all = this._read();
    if (filter.mode) all = all.filter((score) => score.mode === filter.mode);
    if (filter.difficulty) all = all.filter((score) => score.difficulty === filter.difficulty);
    if (filter.seed != null) all = all.filter((score) => String(score.seed) === String(filter.seed));
    all.sort(byRank);
    if (filter.limit) all = all.slice(0, filter.limit);
    return all;
  }

  async clearScores() {
    try {
      this.storage.removeItem(STORAGE_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }
}

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
