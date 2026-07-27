import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  P3_05_EXPECTED_CANDIDATE_COUNT,
  buildP305ReviewPack,
  validateP305ReviewPack,
} from '../src/core/p3-05-review-pack.js';

let cachedPack = null;
function getPack() {
  cachedPack ??= buildP305ReviewPack();
  return cachedPack;
}

test('P3-05レビュー候補は66構造を重複なく固定する', () => {
  const pack = getPack();
  assert.equal(pack.candidateCount, P3_05_EXPECTED_CANDIDATE_COUNT);
  assert.deepEqual(
    Object.fromEntries(pack.profiles.map((profile) => [profile.profileId, profile.candidateCount])),
    { b08c3: 12, b09c3: 12, b10c4: 12, b11c4: 12, b12c5: 8, b13c5: 5, b14c6: 5 },
  );
  assert.equal(new Set(pack.candidates.map((candidate) => candidate.reviewId)).size, 66);
  assert.equal(new Set(pack.candidates.map((candidate) => candidate.boardHash)).size, 66);
  assert.equal(new Set(pack.candidates.map((candidate) => candidate.structureHash)).size, 66);
  assert.equal(validateP305ReviewPack(pack).valid, true);
});

test('全レビュー候補が厳密証明・直行箱0・20〜35操作を満たす', () => {
  const pack = getPack();
  for (const candidate of pack.candidates) {
    assert.equal(candidate.reviewStatus, 'unreviewed');
    assert.equal(candidate.proof.exact, true, candidate.reviewId);
    assert.equal(candidate.proof.proofTemplateId, candidate.templateId);
    assert.equal(candidate.quality.initialDirectExitBlockCount, 0, candidate.reviewId);
    assert.equal(candidate.representativeSolution.length, candidate.optimalSwipes, candidate.reviewId);
    assert.ok(candidate.optimalSwipes >= 20 && candidate.optimalSwipes <= 35, candidate.reviewId);
    assert.equal(candidate.boardData.boardHash, candidate.boardHash);
    assert.equal(candidate.boardData.puzzleId, candidate.puzzleId);
  }
});

test('同じ生成条件で同じレビュー候補パックを返す', () => {
  const first = getPack();
  const second = buildP305ReviewPack();
  assert.deepEqual(second, first);
});

test('レビュー候補の証拠改ざんを検出する', () => {
  const clone = JSON.parse(JSON.stringify(getPack()));
  clone.candidates[0].boardHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const result = validateP305ReviewPack(clone);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('board-hash-mismatch:')));
});
