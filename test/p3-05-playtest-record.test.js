import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyP305PlaytestRecord,
  summarizeP305PlaytestRecords,
  validateP305PlaytestRecord,
} from '../src/core/p3-05-playtest-record.js';

const candidate = Object.freeze({
  reviewId: 'review-b08c3-t00-123456789abc',
  puzzleId: 'cand-b08c3-t00-1234567890abcdef',
  boardHash: `sha256:${'1'.repeat(64)}`,
  templateId: 'b08c3-t00',
  profileId: 'b08c3',
  optimalSwipes: 20,
});

function acceptedRecord() {
  return {
    ...JSON.parse(JSON.stringify(createEmptyP305PlaytestRecord(candidate))),
    reviewer: 'tester-a',
    device: 'iPhone 17 Pro',
    browser: 'Safari',
    playedAt: '2026-07-27T12:00:00.000Z',
    attemptCount: 3,
    clearCount: 2,
    bestTimeMs: 42000,
    bestSwipeCount: 23,
    ratings: {
      enjoyment: 4,
      clarity: 5,
      difficulty: 3,
      distinctiveness: 4,
      fairness: 4,
    },
    knownDeadlocks: ['右上の青箱を先に動かすと遠回りになる'],
    notes: '操作は見やすい。',
    decision: 'accept',
    decisionReason: '考える順番があり、誤操作からも戻せる。',
  };
}

test('空の試遊記録は候補識別を固定し、未完了として扱う', () => {
  const record = createEmptyP305PlaytestRecord(candidate);
  assert.equal(record.reviewId, candidate.reviewId);
  assert.equal(record.boardHash, candidate.boardHash);
  assert.equal(record.decision, 'pending');
  const validation = validateP305PlaytestRecord(record, candidate);
  assert.equal(validation.valid, true);
  assert.equal(validation.complete, false);
});

test('必要な試遊証拠を持つaccept記録だけ完了扱いにする', () => {
  const record = acceptedRecord();
  const validation = validateP305PlaytestRecord(record, candidate);
  assert.equal(validation.valid, true);
  assert.equal(validation.complete, true);
});

test('厳密最短より少ない操作数や候補不一致を拒否する', () => {
  const record = acceptedRecord();
  record.bestSwipeCount = 19;
  record.boardHash = `sha256:${'2'.repeat(64)}`;
  const validation = validateP305PlaytestRecord(record, candidate);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('best-swipes-below-exact-optimum'));
  assert.ok(validation.errors.includes('boardHash-mismatch'));
});

test('30件以上のacceptと不正記録0件で公式選定準備完了になる', () => {
  const candidates = Array.from({ length: 30 }, (_, index) => ({
    ...candidate,
    reviewId: `review-${index}`,
    puzzleId: `puzzle-${index}`,
    boardHash: `sha256:${index.toString(16).padStart(64, '0')}`,
    templateId: `template-${index}`,
  }));
  const pack = { candidates };
  const records = candidates.map((entry) => {
    const record = acceptedRecord();
    return {
      ...record,
      reviewId: entry.reviewId,
      puzzleId: entry.puzzleId,
      boardHash: entry.boardHash,
      templateId: entry.templateId,
    };
  });
  const summary = summarizeP305PlaytestRecords(pack, records);
  assert.equal(summary.accept, 30);
  assert.equal(summary.complete, 30);
  assert.equal(summary.invalid, 0);
  assert.equal(summary.readyForOfficialSelection, true);
});
