// プレイヤー名の端末内保存。検査規則はapp/player-name.jsを利用する。

import { validatePlayerName } from '../app/player-name.js';

export const PLAYER_NAME_STORAGE_KEY = 'hakodase.playerName.v1';

class MemoryStorage {
  constructor() { this._values = new Map(); }
  getItem(key) { return this._values.has(key) ? this._values.get(key) : null; }
  setItem(key, value) { this._values.set(key, String(value)); }
  removeItem(key) { this._values.delete(key); }
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_) {
    // プライベートモードや制限付き環境ではメモリ保存へ退避する。
  }
  return new MemoryStorage();
}

export class PlayerNameStore {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
  }

  load() {
    try {
      const checked = validatePlayerName(this.storage.getItem(PLAYER_NAME_STORAGE_KEY));
      return checked.valid ? checked.name : '';
    } catch (_) {
      return '';
    }
  }

  save(value) {
    const checked = validatePlayerName(value);
    if (!checked.valid) return Object.freeze({ accepted: false, persisted: false, ...checked });
    try {
      this.storage.setItem(PLAYER_NAME_STORAGE_KEY, checked.name);
      return Object.freeze({ accepted: true, persisted: true, name: checked.name, length: checked.length, reason: null });
    } catch (_) {
      return Object.freeze({ accepted: true, persisted: false, name: checked.name, length: checked.length, reason: 'storage-unavailable' });
    }
  }

  clear() {
    try {
      this.storage.removeItem(PLAYER_NAME_STORAGE_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }
}
