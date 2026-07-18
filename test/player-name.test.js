import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_NAME_MAX_CHARACTERS,
  limitPlayerNameInput,
  normalizePlayerName,
  validatePlayerName,
} from '../src/app/player-name.js';
import { PLAYER_NAME_STORAGE_KEY, PlayerNameStore } from '../src/services/player-name-store.js';

class FakeStorage {
  constructor() { this.value = null; }
  getItem() { return this.value; }
  setItem(_key, value) { this.value = String(value); }
  removeItem() { this.value = null; }
}

class ThrowingStorage {
  getItem() { throw new Error('blocked'); }
  setItem() { throw new Error('blocked'); }
  removeItem() { throw new Error('blocked'); }
}

test('前後空白を除去する', () => {
  assert.equal(normalizePlayerName('  箱太郎  '), '箱太郎');
});

test('空文字と空白だけを拒否する', () => {
  assert.equal(validatePlayerName('').reason, 'required');
  assert.equal(validatePlayerName('   ').reason, 'required');
});

test('20文字まで許可し21文字を拒否する', () => {
  assert.equal(validatePlayerName('あ'.repeat(PLAYER_NAME_MAX_CHARACTERS)).valid, true);
  assert.equal(validatePlayerName('あ'.repeat(PLAYER_NAME_MAX_CHARACTERS + 1)).reason, 'too-long');
});

test('絵文字を1文字として扱う', () => {
  assert.equal(validatePlayerName('📦'.repeat(20)).valid, true);
  assert.equal(validatePlayerName('📦'.repeat(21)).valid, false);
  assert.equal(Array.from(limitPlayerNameInput('📦'.repeat(21))).length, 20);
});

test('保存時に正規化し再利用できる', () => {
  const storage = new FakeStorage();
  const store = new PlayerNameStore(storage);
  const saved = store.save('  出荷係  ');
  assert.equal(saved.accepted, true);
  assert.equal(saved.persisted, true);
  assert.equal(storage.value, '出荷係');
  assert.equal(store.load(), '出荷係');
  assert.equal(PLAYER_NAME_STORAGE_KEY, 'hakodase.playerName.v1');
});

test('保存領域が使えなくても有効名で開始できる', () => {
  const store = new PlayerNameStore(new ThrowingStorage());
  const saved = store.save('出荷係');
  assert.equal(saved.accepted, true);
  assert.equal(saved.persisted, false);
  assert.equal(store.load(), '');
  assert.equal(store.clear(), false);
});

test('メモリ退避は永続保存済みと報告しない', () => {
  const previous = globalThis.localStorage;
  try {
    delete globalThis.localStorage;
    const store = new PlayerNameStore();
    const saved = store.save('出荷係');
    assert.equal(saved.accepted, true);
    assert.equal(saved.persisted, false);
    assert.equal(saved.reason, 'storage-unavailable');
    assert.equal(store.load(), '出荷係');
    assert.equal(store.clear(), false);
  } finally {
    if (previous !== undefined) globalThis.localStorage = previous;
  }
});

test('保存済み不正値を再利用しない', () => {
  const storage = new FakeStorage();
  storage.value = 'x'.repeat(21);
  assert.equal(new PlayerNameStore(storage).load(), '');
});
