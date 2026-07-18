// プレイヤー名の正規化・検査・端末内保存。DOM・Canvas・通信へ依存しない。

export const PLAYER_NAME_MAX_CHARACTERS = 20;
export const PLAYER_NAME_STORAGE_KEY = 'hakodase.playerName.v1';

function countCharacters(value) {
  return Array.from(value).length;
}

export function normalizePlayerName(value) {
  return String(value ?? '').trim();
}

export function limitPlayerNameInput(value, maxCharacters = PLAYER_NAME_MAX_CHARACTERS) {
  const safeMax = Number.isInteger(maxCharacters) && maxCharacters >= 0 ? maxCharacters : PLAYER_NAME_MAX_CHARACTERS;
  return Array.from(String(value ?? '')).slice(0, safeMax).join('');
}

export function validatePlayerName(value) {
  const name = normalizePlayerName(value);
  const length = countCharacters(name);
  if (length === 0) return Object.freeze({ valid: false, reason: 'required', name: '', length: 0 });
  if (length > PLAYER_NAME_MAX_CHARACTERS) {
    return Object.freeze({ valid: false, reason: 'too-long', name, length });
  }
  return Object.freeze({ valid: true, reason: null, name, length });
}

class MemoryStorage {
  constructor() { this._values = new Map(); }
  getItem(key) { return this._values.has(key) ? this._values.get(key) : null; }
  setItem(key, value) { this._values.set(key, String(value)); }
  removeItem(key) { this._values.delete(key); }
}

function defaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
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
