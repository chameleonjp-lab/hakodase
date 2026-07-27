import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_RULES_VERSION,
  BOARD_SCHEMA_VERSION,
  materializeBoardDataV2,
} from '../src/core/board-data-v2.js';
import { generateCandidateBoardV2 } from '../src/core/generator-v2.js';
import {
  analyzeCandidateQualityV2,
  computeStructureHashV2,
  screenCandidateQualityV2,
} from '../src/core/quality-metrics-v2.js';

function materialize(draft) {
  return materializeBoardDataV2({
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: BOARD_RULES_VERSION,
    generatorVersion: 'quality-test/1',
    puzzleId: draft.puzzleId,
    boardHash: null,
    width: draft.width,
    height: draft.height,
    blocks: draft.blocks,
    walls: draft.walls ?? [],
    gates: draft.gates,
    lanes: draft.lanes ?? [],
    shutters: [],
    expectedOptimalSwipes: draft.expectedOptimalSwipes ?? null,
  });
}

test('初期直行箱を検出してhard rejectにする', () => {
  const boardData = materialize({
    puzzleId: 'quality-direct-exit',
    width: 2,
    height: 2,
    blocks: [{ id: 'b0', x: 0, y: 0, w: 1, h: 1, color: 0 }],
    gates: [{ id: 'g0', side: 'left', line: 0, color: 0 }],
  });
  const solution = [{
    blockIndex: 0,
    blockId: 'b0',
    color: 0,
    from: { x: 0, y: 0 },
    direction: 'left',
    steps: 1,
    exit: true,
  }];

  const metrics = analyzeCandidateQualityV2(boardData, solution);
  const screening = screenCandidateQualityV2(metrics);

  assert.equal(metrics.initialDirectExitBlockCount, 1);
  assert.equal(metrics.initialDirectExitActionCount, 1);
  assert.equal(metrics.optimalSwipes, 1);
  assert.equal(screening.status, 'reject');
  assert.deepEqual(screening.hardRejectReasons, ['initial-direct-exit']);
});

test('左右反転と色置換をstructureHashで同一構造として扱う', () => {
  const original = materialize({
    puzzleId: 'quality-structure-original',
    width: 4,
    height: 3,
    blocks: [
      { id: 'b0', x: 1, y: 1, w: 1, h: 1, color: 0 },
      { id: 'b1', x: 2, y: 1, w: 1, h: 1, color: 1 },
    ],
    walls: [{ x: 0, y: 0 }, { x: 3, y: 2 }],
    gates: [
      { id: 'g0', side: 'left', line: 1, color: 0 },
      { id: 'g1', side: 'right', line: 1, color: 1 },
    ],
  });

  const mirroredAndRecolored = materialize({
    puzzleId: 'quality-structure-mirrored',
    width: 4,
    height: 3,
    blocks: [
      { id: 'other-a', x: 2, y: 1, w: 1, h: 1, color: 1 },
      { id: 'other-b', x: 1, y: 1, w: 1, h: 1, color: 0 },
    ],
    walls: [{ x: 3, y: 0 }, { x: 0, y: 2 }],
    gates: [
      { id: 'other-g0', side: 'right', line: 1, color: 1 },
      { id: 'other-g1', side: 'left', line: 1, color: 0 },
    ],
  });

  assert.notEqual(original.boardHash, mirroredAndRecolored.boardHash);
  assert.equal(computeStructureHashV2(original), computeStructureHashV2(mirroredAndRecolored));
});

test('P3-03候補の代表解法から分岐・壁利用・反復を計測する', () => {
  const generated = generateCandidateBoardV2({
    seed: 'p3-04-quality-integration',
    profileId: 'b08c3',
  });
  assert.equal(generated.success, true);

  const metrics = analyzeCandidateQualityV2(generated.boardData, generated.solution);
  assert.equal(metrics.optimalSwipes, 20);
  assert.match(metrics.structureHash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(metrics.initialLegalActionCount > 0);
  assert.equal(
    metrics.solutionDecisionStepCount + metrics.solutionForcedStepCount,
    generated.solution.length,
  );
  assert.ok(metrics.solutionAverageBranching >= 1);
  assert.ok(metrics.wallUtilizationRate >= 0 && metrics.wallUtilizationRate <= 1);
  assert.ok(metrics.immediateDeadEndAlternativeRate >= 0 && metrics.immediateDeadEndAlternativeRate <= 1);
  assert.ok(metrics.sameBlockRepeatRate >= 0 && metrics.sameBlockRepeatRate <= 1);
  assert.ok(['candidate', 'review', 'reject'].includes(screenCandidateQualityV2(metrics).status));
});
