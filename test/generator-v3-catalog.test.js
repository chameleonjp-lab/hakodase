import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardDataV2ToRuntime } from '../src/core/board-data-v2.js';
import {
  GENERATOR_V2_VERSION,
  clearGeneratorV3ProofCache,
  generateCandidateBoardV2,
  listGeneratorV2Profiles,
  listGeneratorV3Templates,
} from '../src/core/generator-v2.js';
import { GENERATOR_V3_TEMPLATE_CATALOG } from '../src/core/generator-v3-catalog.js';
import { verifyExactSolutionV2 } from '../src/core/exact-solver-v2.js';
import { analyzeCandidateQualityV2 } from '../src/core/quality-metrics-v2.js';

const EXPECTED_TEMPLATE_COUNTS = Object.freeze({
  b08c3: 12,
  b09c3: 12,
  b10c4: 12,
  b11c4: 12,
  b12c5: 8,
  b13c5: 5,
  b14c6: 5,
});

test('generator v3 catalogは66件・各profile5件以上を持つ', () => {
  assert.equal(GENERATOR_V2_VERSION, 'route-catalog/3.0.0');
  assert.equal(GENERATOR_V3_TEMPLATE_CATALOG.length, 66);
  assert.equal(listGeneratorV3Templates().length, 66);

  const profiles = listGeneratorV2Profiles();
  assert.deepEqual(
    Object.fromEntries(profiles.map((profile) => [profile.id, profile.templateCount])),
    EXPECTED_TEMPLATE_COUNTS,
  );
  for (const profile of profiles) assert.ok(profile.templateCount >= 5);
});

test('66件すべてが厳密20〜35操作・直行箱0・一意構造である', { timeout: 120_000 }, () => {
  clearGeneratorV3ProofCache();
  const structureHashes = new Set();
  const profileStructureHashes = new Map();

  for (const template of GENERATOR_V3_TEMPLATE_CATALOG) {
    const generated = generateCandidateBoardV2({
      seed: `catalog-proof-${template.id}`,
      templateId: template.id,
      maxAttempts: 1,
    });
    assert.equal(generated.success, true, `${template.id}: ${JSON.stringify(generated.failures)}`);
    assert.equal(generated.solver.solved, true, template.id);
    assert.equal(generated.solver.exact, true, template.id);
    assert.equal(generated.solver.optimalSwipes, template.expectedOptimalSwipes, template.id);
    assert.ok(generated.solver.optimalSwipes >= 20 && generated.solver.optimalSwipes <= 35, template.id);
    assert.deepEqual(
      verifyExactSolutionV2(boardDataV2ToRuntime(generated.boardData), generated.solution),
      { valid: true, cleared: true, failedAt: null, reason: null },
      template.id,
    );

    const metrics = analyzeCandidateQualityV2(generated.boardData, generated.solution);
    assert.equal(metrics.initialDirectExitBlockCount, 0, template.id);
    assert.equal(metrics.structureHash.startsWith('sha256:'), true, template.id);
    structureHashes.add(metrics.structureHash);
    if (!profileStructureHashes.has(template.profileId)) profileStructureHashes.set(template.profileId, new Set());
    profileStructureHashes.get(template.profileId).add(metrics.structureHash);
  }

  assert.equal(structureHashes.size, 66);
  for (const [profileId, expectedCount] of Object.entries(EXPECTED_TEMPLATE_COUNTS)) {
    assert.equal(profileStructureHashes.get(profileId)?.size, expectedCount, profileId);
  }
});

test('同じseedとtemplateは同じ盤面・解法を返し、proof cacheを再利用する', () => {
  clearGeneratorV3ProofCache();
  const options = { seed: 'generator-v3-deterministic', templateId: 'b10c4-t04', maxAttempts: 1 };
  const first = generateCandidateBoardV2(options);
  const second = generateCandidateBoardV2(options);
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.boardData.boardHash, second.boardData.boardHash);
  assert.deepEqual(first.solution, second.solution);
  assert.deepEqual(first.variant, second.variant);
  assert.equal(first.solver.proofReused, false);
  assert.equal(second.solver.proofReused, true);
});

test('未登録templateは推測生成せず拒否する', () => {
  const result = generateCandidateBoardV2({ seed: 'unsupported', templateId: 'b08c3-t99' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'unsupported-template');
  assert.equal(result.boardData, null);
  assert.deepEqual(result.solution, []);
});
