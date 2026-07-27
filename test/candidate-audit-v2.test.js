import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runCandidateAuditV2,
  summarizeCandidateAuditV2,
} from '../src/core/candidate-audit-v2.js';

function fakeMetrics(overrides = {}) {
  return Object.freeze({
    boardHash: 'sha256:board-a',
    structureHash: 'sha256:structure-a',
    optimalSwipes: 20,
    initialLegalActionCount: 3,
    initialDirectExitBlockCount: 0,
    solutionDecisionStepRate: 0.5,
    wallUtilizationRate: 0.25,
    immediateDeadEndAlternativeRate: 0.1,
    sameBlockRepeatRate: 0.2,
    dominantDirectionRate: 0.4,
    dominantColorRate: 0.5,
    ...overrides,
  });
}

function fakeSolver() {
  return Object.freeze({
    reason: 'solved',
    optimalSwipes: 20,
    nodesExpanded: 100,
    movesGenerated: 200,
    uniqueStates: 150,
    frontierPeak: 40,
    durationMs: 5,
  });
}

test('summaryがboardHash重複と構造同型重複を分けて集計する', () => {
  const rows = [
    {
      profileId: 'p0', generationSuccess: true, qualityStatus: 'candidate',
      boardHash: 'board-a', structureHash: 'structure-a', hardRejectReasons: [], reviewFlags: [],
      metrics: fakeMetrics({ boardHash: 'board-a', structureHash: 'structure-a' }), solver: fakeSolver(),
    },
    {
      profileId: 'p0', generationSuccess: true, qualityStatus: 'review',
      boardHash: 'board-b', structureHash: 'structure-a', hardRejectReasons: [], reviewFlags: ['low-wall-utilization'],
      metrics: fakeMetrics({ boardHash: 'board-b', structureHash: 'structure-a', wallUtilizationRate: 0 }), solver: fakeSolver(),
    },
    {
      profileId: 'p1', generationSuccess: true, qualityStatus: 'reject',
      boardHash: 'board-b', structureHash: 'structure-b', hardRejectReasons: ['initial-direct-exit'], reviewFlags: [],
      metrics: fakeMetrics({ boardHash: 'board-b', structureHash: 'structure-b', initialDirectExitBlockCount: 1 }), solver: fakeSolver(),
    },
    {
      profileId: 'p1', generationSuccess: false, qualityStatus: 'reject', generationReason: 'solver-timeout',
      boardHash: null, structureHash: null, hardRejectReasons: ['generation-failed'], reviewFlags: [],
      metrics: null, solver: null,
    },
  ];
  const profiles = [
    { id: 'p0', boxCount: 8, colorCount: 3, expectedOptimalSwipes: 20 },
    { id: 'p1', boxCount: 9, colorCount: 3, expectedOptimalSwipes: 21 },
  ];

  const summary = summarizeCandidateAuditV2(rows, { profiles, requestedCandidateCount: 4 });
  assert.equal(summary.generatedCount, 3);
  assert.equal(summary.generationFailureCount, 1);
  assert.equal(summary.uniqueBoardHashCount, 2);
  assert.equal(summary.duplicateBoardHashCount, 1);
  assert.equal(summary.uniqueStructureHashCount, 2);
  assert.equal(summary.structuralDuplicateCount, 1);
  assert.equal(summary.candidateCount, 1);
  assert.equal(summary.reviewCount, 1);
  assert.equal(summary.rejectCount, 1);
  assert.equal(summary.hardRejectReasonCounts['initial-direct-exit'], 1);
  assert.equal(summary.reviewFlagCounts['low-wall-utilization'], 1);
  assert.equal(summary.generationFailureReasonCounts['solver-timeout'], 1);
});

test('注入した軽量依存で1001件の監査経路を完走する', () => {
  const profiles = [
    { id: 'p0', boxCount: 8, colorCount: 3, expectedOptimalSwipes: 20 },
    { id: 'p1', boxCount: 9, colorCount: 3, expectedOptimalSwipes: 21 },
  ];
  let generatedCount = 0;
  let progressCount = 0;

  const report = runCandidateAuditV2({
    candidateCount: 1001,
    progressInterval: 100,
    seedPrefix: 'audit-test',
    profiles,
    generateCandidate({ seed, profileId }) {
      generatedCount++;
      return {
        success: true,
        reason: 'generated',
        attempts: 1,
        failures: [],
        boardData: { marker: `${seed}:${profileId}` },
        solution: [{}],
        solver: fakeSolver(),
        variant: { transform: 'identity', counts: [1], colorPermutation: [0] },
      };
    },
    analyzeCandidate(boardData) {
      const index = Number(boardData.marker.match(/-(\d{5})-/)?.[1] ?? 0);
      return fakeMetrics({
        boardHash: `board-${index % 10}`,
        structureHash: `structure-${index % 3}`,
      });
    },
    screenCandidate() {
      return { status: 'candidate', hardRejectReasons: [], reviewFlags: [] };
    },
    now: (() => {
      let tick = 0;
      return () => tick++;
    })(),
    onProgress() {
      progressCount++;
    },
  });

  assert.equal(generatedCount, 1001);
  assert.equal(report.summary.inspectedCandidateCount, 1001);
  assert.equal(report.summary.generatedCount, 1001);
  assert.equal(report.summary.uniqueBoardHashCount, 10);
  assert.equal(report.summary.uniqueStructureHashCount, 3);
  assert.equal(report.summary.candidateCount, 1001);
  assert.equal(report.rows.length, 1001);
  assert.equal(progressCount, 11);
});
