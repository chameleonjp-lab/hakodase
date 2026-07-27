// HAKODASE P3-04 大量候補検査。
// P3-03生成器を1000件以上実行し、P3-04品質指標、boardHash重複、構造同型重複を集計する。
// Nodeスクリプトから使用する純粋な集計層であり、ファイル書き込みは行わない。

import {
  GENERATOR_V2_VERSION,
  generateCandidateBoardV2,
  listGeneratorV2Profiles,
} from './generator-v2.js';
import {
  P3_04_SCREENING_RULES,
  analyzeCandidateQualityV2,
  screenCandidateQualityV2,
} from './quality-metrics-v2.js';

export const P3_04_AUDIT_VERSION = 'candidate-quality-audit/1.0.0';
export const P3_04_AUDIT_DEFAULTS = Object.freeze({
  candidateCount: 1001,
  seedPrefix: 'p3-04-audit-v1',
  progressInterval: 25,
});

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function readInteger(value, fallback, name, minimum = 1) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum) {
    throw new TypeError(`${name} must be an integer >= ${minimum}`);
  }
  return resolved;
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function numericSummary(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) return Object.freeze({ count: 0, min: null, max: null, mean: null });
  const sum = valid.reduce((total, value) => total + value, 0);
  return Object.freeze({
    count: valid.length,
    min: Math.min(...valid),
    max: Math.max(...valid),
    mean: round(sum / valid.length),
  });
}

function incrementCounter(counter, keyName) {
  counter[keyName] = (counter[keyName] ?? 0) + 1;
}

function freezeRecord(record) {
  for (const value of Object.values(record)) {
    if (Array.isArray(value) && !Object.isFrozen(value)) Object.freeze(value);
    else if (value && typeof value === 'object' && !Object.isFrozen(value)) Object.freeze(value);
  }
  return Object.freeze(record);
}

function profileSummary(rows, profile) {
  const profileRows = rows.filter((row) => row.profileId === profile.id);
  const generated = profileRows.filter((row) => row.generationSuccess);
  const boardHashes = new Set(generated.map((row) => row.boardHash));
  const structureHashes = new Set(generated.map((row) => row.structureHash));

  return freezeRecord({
    profileId: profile.id,
    boxCount: profile.boxCount,
    colorCount: profile.colorCount,
    expectedOptimalSwipes: profile.expectedOptimalSwipes,
    attempted: profileRows.length,
    generated: generated.length,
    failed: profileRows.length - generated.length,
    candidate: generated.filter((row) => row.qualityStatus === 'candidate').length,
    review: generated.filter((row) => row.qualityStatus === 'review').length,
    reject: generated.filter((row) => row.qualityStatus === 'reject').length,
    uniqueBoardHashes: boardHashes.size,
    uniqueStructureHashes: structureHashes.size,
    boardHashUniqueRatio: round(boardHashes.size / Math.max(1, generated.length)),
    structureUniqueRatio: round(structureHashes.size / Math.max(1, generated.length)),
    optimalSwipes: numericSummary(generated.map((row) => row.metrics.optimalSwipes)),
    initialLegalActions: numericSummary(generated.map((row) => row.metrics.initialLegalActionCount)),
    initialDirectExitBlocks: numericSummary(generated.map((row) => row.metrics.initialDirectExitBlockCount)),
    decisionStepRate: numericSummary(generated.map((row) => row.metrics.solutionDecisionStepRate)),
    wallUtilizationRate: numericSummary(generated.map((row) => row.metrics.wallUtilizationRate)),
    immediateDeadEndAlternativeRate: numericSummary(generated.map((row) => row.metrics.immediateDeadEndAlternativeRate)),
    sameBlockRepeatRate: numericSummary(generated.map((row) => row.metrics.sameBlockRepeatRate)),
    dominantDirectionRate: numericSummary(generated.map((row) => row.metrics.dominantDirectionRate)),
    dominantColorRate: numericSummary(generated.map((row) => row.metrics.dominantColorRate)),
    solverNodes: numericSummary(generated.map((row) => row.solver.nodesExpanded)),
    solverDurationMs: numericSummary(generated.map((row) => row.solver.durationMs)),
  });
}

export function summarizeCandidateAuditV2(rows, options = {}) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  const profiles = options.profiles ?? listGeneratorV2Profiles();
  const generated = rows.filter((row) => row.generationSuccess);
  const failed = rows.filter((row) => !row.generationSuccess);
  const boardHashes = new Set(generated.map((row) => row.boardHash));
  const structureHashes = new Set(generated.map((row) => row.structureHash));
  const hardRejectReasonCounts = {};
  const reviewFlagCounts = {};
  const generationFailureReasonCounts = {};

  for (const row of generated) {
    for (const reason of row.hardRejectReasons) incrementCounter(hardRejectReasonCounts, reason);
    for (const flag of row.reviewFlags) incrementCounter(reviewFlagCounts, flag);
  }
  for (const row of failed) incrementCounter(generationFailureReasonCounts, row.generationReason);

  return freezeRecord({
    requestedCandidateCount: options.requestedCandidateCount ?? rows.length,
    inspectedCandidateCount: rows.length,
    generatedCount: generated.length,
    generationFailureCount: failed.length,
    candidateCount: generated.filter((row) => row.qualityStatus === 'candidate').length,
    reviewCount: generated.filter((row) => row.qualityStatus === 'review').length,
    rejectCount: generated.filter((row) => row.qualityStatus === 'reject').length,
    uniqueBoardHashCount: boardHashes.size,
    duplicateBoardHashCount: Math.max(0, generated.length - boardHashes.size),
    boardHashUniqueRatio: round(boardHashes.size / Math.max(1, generated.length)),
    uniqueStructureHashCount: structureHashes.size,
    structuralDuplicateCount: Math.max(0, generated.length - structureHashes.size),
    structureUniqueRatio: round(structureHashes.size / Math.max(1, generated.length)),
    hardRejectReasonCounts: Object.freeze({ ...hardRejectReasonCounts }),
    reviewFlagCounts: Object.freeze({ ...reviewFlagCounts }),
    generationFailureReasonCounts: Object.freeze({ ...generationFailureReasonCounts }),
    profiles: Object.freeze(profiles.map((profile) => profileSummary(rows, profile))),
    optimalSwipes: numericSummary(generated.map((row) => row.metrics.optimalSwipes)),
    initialLegalActions: numericSummary(generated.map((row) => row.metrics.initialLegalActionCount)),
    initialDirectExitBlocks: numericSummary(generated.map((row) => row.metrics.initialDirectExitBlockCount)),
    decisionStepRate: numericSummary(generated.map((row) => row.metrics.solutionDecisionStepRate)),
    wallUtilizationRate: numericSummary(generated.map((row) => row.metrics.wallUtilizationRate)),
    immediateDeadEndAlternativeRate: numericSummary(generated.map((row) => row.metrics.immediateDeadEndAlternativeRate)),
    sameBlockRepeatRate: numericSummary(generated.map((row) => row.metrics.sameBlockRepeatRate)),
    dominantDirectionRate: numericSummary(generated.map((row) => row.metrics.dominantDirectionRate)),
    dominantColorRate: numericSummary(generated.map((row) => row.metrics.dominantColorRate)),
    solverNodes: numericSummary(generated.map((row) => row.solver.nodesExpanded)),
    solverDurationMs: numericSummary(generated.map((row) => row.solver.durationMs)),
  });
}

function makeFailureRow(index, seed, profileId, generated) {
  return freezeRecord({
    index,
    seed,
    profileId,
    generationSuccess: false,
    generationReason: generated.reason,
    attempts: generated.attempts,
    failures: generated.failures,
    boardHash: null,
    structureHash: null,
    boardHashDuplicateOf: null,
    structureHashDuplicateOf: null,
    qualityStatus: 'reject',
    hardRejectReasons: Object.freeze(['generation-failed']),
    reviewFlags: Object.freeze([]),
    metrics: null,
    solver: null,
    variant: null,
  });
}

export function runCandidateAuditV2(options = {}) {
  const candidateCount = readInteger(
    options.candidateCount,
    P3_04_AUDIT_DEFAULTS.candidateCount,
    'candidateCount',
  );
  const progressInterval = readInteger(
    options.progressInterval,
    P3_04_AUDIT_DEFAULTS.progressInterval,
    'progressInterval',
  );
  const seedPrefix = String(options.seedPrefix ?? P3_04_AUDIT_DEFAULTS.seedPrefix);
  const profiles = options.profiles ?? listGeneratorV2Profiles();
  if (!Array.isArray(profiles) || profiles.length === 0) throw new TypeError('profiles must be a non-empty array');

  const generate = options.generateCandidate ?? generateCandidateBoardV2;
  const analyze = options.analyzeCandidate ?? analyzeCandidateQualityV2;
  const screen = options.screenCandidate ?? screenCandidateQualityV2;
  const now = typeof options.now === 'function' ? options.now : defaultNow;
  const startedAt = now();
  const boardHashFirstIndex = new Map();
  const structureHashFirstIndex = new Map();
  const rows = [];

  for (let index = 0; index < candidateCount; index++) {
    const profile = profiles[index % profiles.length];
    const seed = `${seedPrefix}-${String(index).padStart(5, '0')}-${profile.id}`;
    const generated = generate({
      seed,
      profileId: profile.id,
      maxAttempts: options.maxAttempts,
      solver: options.solver,
    });

    if (!generated.success) {
      rows.push(makeFailureRow(index, seed, profile.id, generated));
    } else {
      const metrics = analyze(generated.boardData, generated.solution);
      const screening = screen(metrics, options.screeningRules ?? P3_04_SCREENING_RULES);
      const firstBoardIndex = boardHashFirstIndex.get(metrics.boardHash);
      const firstStructureIndex = structureHashFirstIndex.get(metrics.structureHash);
      if (firstBoardIndex == null) boardHashFirstIndex.set(metrics.boardHash, index);
      if (firstStructureIndex == null) structureHashFirstIndex.set(metrics.structureHash, index);

      rows.push(freezeRecord({
        index,
        seed,
        profileId: profile.id,
        generationSuccess: true,
        generationReason: generated.reason,
        attempts: generated.attempts,
        failures: generated.failures,
        boardHash: metrics.boardHash,
        structureHash: metrics.structureHash,
        boardHashDuplicateOf: firstBoardIndex ?? null,
        structureHashDuplicateOf: firstStructureIndex ?? null,
        qualityStatus: screening.status,
        hardRejectReasons: screening.hardRejectReasons,
        reviewFlags: screening.reviewFlags,
        metrics,
        solver: Object.freeze({
          reason: generated.solver.reason,
          optimalSwipes: generated.solver.optimalSwipes,
          nodesExpanded: generated.solver.nodesExpanded,
          movesGenerated: generated.solver.movesGenerated,
          uniqueStates: generated.solver.uniqueStates,
          frontierPeak: generated.solver.frontierPeak,
          durationMs: generated.solver.durationMs,
        }),
        variant: generated.variant,
      }));
    }

    if (typeof options.onProgress === 'function'
        && ((index + 1) % progressInterval === 0 || index + 1 === candidateCount)) {
      options.onProgress(Object.freeze({ completed: index + 1, total: candidateCount, row: rows[rows.length - 1] }));
    }
  }

  const summary = summarizeCandidateAuditV2(rows, {
    profiles,
    requestedCandidateCount: candidateCount,
  });

  return freezeRecord({
    auditVersion: P3_04_AUDIT_VERSION,
    generatorVersion: GENERATOR_V2_VERSION,
    seedPrefix,
    screeningRules: Object.freeze({ ...(options.screeningRules ?? P3_04_SCREENING_RULES) }),
    durationMs: Math.max(0, now() - startedAt),
    summary,
    rows: Object.freeze(rows),
  });
}
