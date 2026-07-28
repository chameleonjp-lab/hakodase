import test from 'node:test';
import assert from 'node:assert/strict';
import { validateP305PlaytestRecord } from '../src/core/p3-05-playtest-record.js';
import {
  P305ReviewStorage,
  beginP305Attempt,
  completeP305Attempt,
  createP305RecordSet,
  parseP305RecordSet,
  patchP305ReviewRecord,
  reconcileP305ReviewRecords,
  summarizeP305ReviewProgress,
} from '../src/review/review-store.js';

function candidate(id, optimalSwipes = 20) {
  return {
    reviewId: `review-${id}`,
    puzzleId: `puzzle-${id}`,
    boardHash: `sha256:${id.padEnd(64, '0').slice(0, 64)}`,
    templateId: id,
    profileId: 'b08c3',
    optimalSwipes,
  };
}

function pack() {
  return {
    packVersion: 'p3-05-review-pack/1.0.0',
    generatorVersion: 'route-catalog/3.0.0',
    candidates: [candidate('a'), candidate('b', 21)],
  };
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('候補パックから空の2件を作り同じpackVersionの保存記録だけ復元する', () => {
  const value = pack();
  const empty = reconcileP305ReviewRecords(value, null);
  assert.equal(empty.length, 2);
  assert.equal(empty[0].decision, 'pending');

  empty[0].notes = '保存済み';
  const stored = createP305RecordSet(value, empty, 0);
  const restored = reconcileP305ReviewRecords(value, stored);
  assert.equal(restored[0].notes, '保存済み');

  const wrongVersion = { ...stored, packVersion: 'old' };
  assert.equal(reconcileP305ReviewRecords(value, wrongVersion)[0].notes, '');
});

test('試行・クリア・評価を記録しacceptの完了条件を満たす', () => {
  const value = pack();
  const entry = reconcileP305ReviewRecords(value, null)[0];
  const attempted = beginP305Attempt(entry, {
    reviewer: '試遊者',
    device: 'iPhone',
    browser: 'Safari',
  }, Date.parse('2026-07-28T00:00:00.000Z'));
  assert.equal(attempted.attemptCount, 1);
  assert.equal(attempted.playedAt, '2026-07-28T00:00:00.000Z');

  const cleared = completeP305Attempt(attempted, { timeMs: 45000, swipeCount: 22 });
  const reviewed = patchP305ReviewRecord(cleared, {
    ratings: { enjoyment: 4, clarity: 5, difficulty: 3, distinctiveness: 4, fairness: 5 },
    decision: 'accept',
    decisionReason: '順序判断が明確',
    knownDeadlocks: '赤を先に出すと詰む',
    notes: '再試遊済み',
  });
  const validation = validateP305PlaytestRecord(reviewed, value.candidates[0]);
  assert.equal(validation.valid, true);
  assert.equal(validation.complete, true);
  assert.equal(reviewed.clearCount, 1);
  assert.equal(reviewed.bestTimeMs, 45000);
  assert.equal(reviewed.bestSwipeCount, 22);
  assert.deepEqual(reviewed.knownDeadlocks, ['赤を先に出すと詰む']);
});

test('厳密最短を下回る人間記録は不整合になる', () => {
  const value = pack();
  const entry = beginP305Attempt(reconcileP305ReviewRecords(value, null)[0], {
    reviewer: 'A', device: 'iPhone', browser: 'Safari',
  }, 0);
  const cleared = completeP305Attempt(entry, { timeMs: 1000, swipeCount: 19 });
  const validation = validateP305PlaytestRecord(cleared, value.candidates[0]);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('best-swipes-below-exact-optimum'));
});

test('JSON取込はpackVersion不一致・未知候補・重複候補を拒否する', () => {
  const value = pack();
  const records = reconcileP305ReviewRecords(value, null);
  const validText = JSON.stringify(createP305RecordSet(value, records, 0));
  assert.equal(parseP305RecordSet(validText, value).valid, true);

  const wrongPack = JSON.parse(validText);
  wrongPack.packVersion = 'wrong';
  assert.deepEqual(parseP305RecordSet(JSON.stringify(wrongPack), value).errors, ['pack-version-mismatch']);

  const unknown = JSON.parse(validText);
  unknown.records[0].reviewId = 'review-unknown';
  assert.equal(parseP305RecordSet(JSON.stringify(unknown), value).valid, false);

  const duplicate = JSON.parse(validText);
  duplicate.records[1] = structuredClone(duplicate.records[0]);
  assert.equal(parseP305RecordSet(JSON.stringify(duplicate), value).valid, false);
});

test('端末保存サービスは記録と試遊者情報を分けて保存する', () => {
  const memory = new MemoryStorage();
  const service = new P305ReviewStorage(memory);
  const value = pack();
  const records = reconcileP305ReviewRecords(value, null);
  records[0].notes = '端末保存';
  service.saveRecordSet(value, records);
  service.saveIdentity({ reviewer: 'カメレオンJP', device: 'iPhone 17 Pro', browser: 'Safari' });

  assert.equal(service.loadRecordSet(value)[0].notes, '端末保存');
  assert.equal(service.loadIdentity().reviewer, 'カメレオンJP');
  service.clear();
  assert.equal(service.loadRecordSet(value)[0].notes, '');
  assert.equal(service.loadIdentity().reviewer, 'カメレオンJP');
});

test('進捗集計は完了評価だけをcompleteへ数える', () => {
  const value = pack();
  const records = reconcileP305ReviewRecords(value, null);
  records[0] = patchP305ReviewRecord(records[0], { decision: 'revise', decisionReason: '要修正' });
  const summary = summarizeP305ReviewProgress(value, records);
  assert.equal(summary.revise, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.complete, 0);
});
