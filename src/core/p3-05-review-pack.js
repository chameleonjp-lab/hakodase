// HAKODASE P3-05 人間試遊用レビュー候補パック。
// 生成器v3の66基礎構造を、固定seed・固定templateIdで再生成し、
// 盤面、厳密解、品質指標を一つの決定論的な証拠パックへまとめる。
// 公開ゲームの開始処理では使用しない。

import {
  GENERATOR_V3_VERSION,
  generateCandidateBoardV2,
  listGeneratorV2Profiles,
  listGeneratorV3Templates,
} from './generator-v2.js';
import { analyzeCandidateQualityV2 } from './quality-metrics-v2.js';

export const P3_05_REVIEW_PACK_SCHEMA = 'hakodase.review-pack/1';
export const P3_05_REVIEW_PACK_VERSION = 'p3-05-review-pack/1.0.0';
export const P3_05_REVIEW_SEED_PREFIX = 'p3-05-review-v1';
export const P3_05_EXPECTED_CANDIDATE_COUNT = 66;

function freezeDeep(value) {
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    return Object.freeze(value);
  }
  return value;
}

function compactQuality(metrics) {
  return freezeDeep({
    structureHash: metrics.structureHash,
    initialLegalActionCount: metrics.initialLegalActionCount,
    initialMovableBlockCount: metrics.initialMovableBlockCount,
    initialDirectExitBlockCount: metrics.initialDirectExitBlockCount,
    solutionAverageBranching: metrics.solutionAverageBranching,
    solutionMaxBranching: metrics.solutionMaxBranching,
    solutionDecisionStepRate: metrics.solutionDecisionStepRate,
    wallUtilizationRate: metrics.wallUtilizationRate,
    immediateDeadEndAlternativeRate: metrics.immediateDeadEndAlternativeRate,
    sameBlockRepeatRate: metrics.sameBlockRepeatRate,
    maxSameBlockRun: metrics.maxSameBlockRun,
    dominantDirectionRate: metrics.dominantDirectionRate,
    dominantColorRate: metrics.dominantColorRate,
  });
}

function compactProof(generated) {
  return freezeDeep({
    exact: generated.solver.exact,
    reason: generated.solver.reason,
    optimalSwipes: generated.solver.optimalSwipes,
    nodesExpanded: generated.solver.nodesExpanded,
    uniqueStates: generated.solver.uniqueStates,
    frontierPeak: generated.solver.frontierPeak,
    proofSource: generated.solver.proofSource,
    proofTemplateId: generated.solver.proofTemplateId,
    proofMode: generated.solver.proofMode ?? null,
    proofTransformInvariant: generated.solver.proofTransformInvariant === true,
  });
}

function seedForTemplate(templateId, prefix = P3_05_REVIEW_SEED_PREFIX) {
  return `${prefix}:${templateId}`;
}

function reviewIdFor(generated) {
  const hash = generated.boardData.boardHash.slice('sha256:'.length, 'sha256:'.length + 12);
  return `review-${generated.variant.templateId}-${hash}`;
}

function buildCandidate(template, options) {
  const seed = seedForTemplate(template.id, options.seedPrefix);
  const generated = generateCandidateBoardV2({
    seed,
    templateId: template.id,
    maxAttempts: 1,
  });
  if (!generated.success) {
    const detail = generated.failures.map((entry) => `${entry.reason}:${entry.detail ?? ''}`).join(',');
    throw new Error(`P3-05 candidate generation failed for ${template.id}: ${generated.reason} ${detail}`.trim());
  }

  const metrics = analyzeCandidateQualityV2(generated.boardData, generated.solution);
  if (metrics.initialDirectExitBlockCount !== 0) {
    throw new Error(`P3-05 candidate ${template.id} has an initial direct-exit block`);
  }
  if (!generated.solver.exact || generated.solver.optimalSwipes !== generated.boardData.expectedOptimalSwipes) {
    throw new Error(`P3-05 candidate ${template.id} lacks an exact matching proof`);
  }
  if (generated.solution.length !== generated.boardData.expectedOptimalSwipes) {
    throw new Error(`P3-05 candidate ${template.id} solution length mismatch`);
  }

  return freezeDeep({
    reviewId: reviewIdFor(generated),
    reviewStatus: 'unreviewed',
    templateId: generated.variant.templateId,
    profileId: generated.variant.profileId,
    seed,
    puzzleId: generated.boardData.puzzleId,
    boardHash: generated.boardData.boardHash,
    structureHash: metrics.structureHash,
    schemaVersion: generated.boardData.schemaVersion,
    rulesVersion: generated.boardData.rulesVersion,
    generatorVersion: generated.boardData.generatorVersion,
    optimalSwipes: generated.boardData.expectedOptimalSwipes,
    variant: {
      transform: generated.variant.transform,
      colorPermutation: [...generated.variant.colorPermutation],
      usesLanes: generated.variant.usesLanes,
    },
    boardData: generated.boardData,
    representativeSolution: generated.solution,
    proof: compactProof(generated),
    quality: compactQuality(metrics),
  });
}

function assertUnique(candidates, keyName) {
  const seen = new Map();
  for (const candidate of candidates) {
    const value = candidate[keyName];
    if (seen.has(value)) {
      throw new Error(`duplicate ${keyName}: ${value} (${seen.get(value)}, ${candidate.templateId})`);
    }
    seen.set(value, candidate.templateId);
  }
}

function profileSummaries(candidates) {
  return listGeneratorV2Profiles().map((profile) => {
    const entries = candidates.filter((candidate) => candidate.profileId === profile.id);
    return freezeDeep({
      profileId: profile.id,
      boxCount: profile.boxCount,
      colorCount: profile.colorCount,
      expectedOptimalSwipes: profile.expectedOptimalSwipes,
      candidateCount: entries.length,
      templateIds: entries.map((candidate) => candidate.templateId),
    });
  });
}

export function buildP305ReviewPack(options = {}) {
  const seedPrefix = String(options.seedPrefix ?? P3_05_REVIEW_SEED_PREFIX);
  const templates = listGeneratorV3Templates().sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const candidates = templates.map((template) => buildCandidate(template, { seedPrefix }));

  if (options.requireCompleteCatalog !== false && candidates.length !== P3_05_EXPECTED_CANDIDATE_COUNT) {
    throw new Error(`P3-05 review pack requires ${P3_05_EXPECTED_CANDIDATE_COUNT} candidates, got ${candidates.length}`);
  }

  for (const keyName of ['reviewId', 'templateId', 'puzzleId', 'boardHash', 'structureHash']) {
    assertUnique(candidates, keyName);
  }

  const optimalSwipes = candidates.map((candidate) => candidate.optimalSwipes);
  const pack = {
    schemaVersion: P3_05_REVIEW_PACK_SCHEMA,
    packVersion: P3_05_REVIEW_PACK_VERSION,
    generatorVersion: GENERATOR_V3_VERSION,
    seedPrefix,
    candidateCount: candidates.length,
    minOptimalSwipes: Math.min(...optimalSwipes),
    maxOptimalSwipes: Math.max(...optimalSwipes),
    profiles: profileSummaries(candidates),
    candidates,
  };
  return freezeDeep(pack);
}

export function validateP305ReviewPack(pack) {
  const errors = [];
  if (!pack || typeof pack !== 'object') return Object.freeze({ valid: false, errors: ['invalid-root'] });
  if (pack.schemaVersion !== P3_05_REVIEW_PACK_SCHEMA) errors.push('unsupported-schema-version');
  if (pack.packVersion !== P3_05_REVIEW_PACK_VERSION) errors.push('unsupported-pack-version');
  if (pack.generatorVersion !== GENERATOR_V3_VERSION) errors.push('generator-version-mismatch');
  if (!Array.isArray(pack.candidates)) errors.push('invalid-candidates');

  const candidates = Array.isArray(pack.candidates) ? pack.candidates : [];
  if (pack.candidateCount !== candidates.length) errors.push('candidate-count-mismatch');
  if (candidates.length !== P3_05_EXPECTED_CANDIDATE_COUNT) errors.push('incomplete-catalog');

  for (const candidate of candidates) {
    if (candidate.reviewStatus !== 'unreviewed') errors.push(`invalid-review-status:${candidate.reviewId}`);
    if (candidate.boardHash !== candidate.boardData?.boardHash) errors.push(`board-hash-mismatch:${candidate.reviewId}`);
    if (candidate.puzzleId !== candidate.boardData?.puzzleId) errors.push(`puzzle-id-mismatch:${candidate.reviewId}`);
    if (candidate.optimalSwipes !== candidate.representativeSolution?.length) errors.push(`solution-length-mismatch:${candidate.reviewId}`);
    if (candidate.proof?.exact !== true) errors.push(`non-exact-proof:${candidate.reviewId}`);
    if (candidate.quality?.initialDirectExitBlockCount !== 0) errors.push(`initial-direct-exit:${candidate.reviewId}`);
  }

  for (const keyName of ['reviewId', 'templateId', 'puzzleId', 'boardHash', 'structureHash']) {
    const values = candidates.map((candidate) => candidate[keyName]);
    if (new Set(values).size !== values.length) errors.push(`duplicate-${keyName}`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
