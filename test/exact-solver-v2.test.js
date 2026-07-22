import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_RULES_VERSION,
  BOARD_SCHEMA_VERSION,
  boardDataV2ToRuntime,
  materializeBoardDataV2,
} from '../src/core/board-data-v2.js';
import {
  canonicalStateKeyV2,
  solveBoardDataV2,
  solveRuntimeBoardExactV2,
  validateExpectedOptimalSwipesV2,
  verifyExactSolutionV2,
} from '../src/core/exact-solver-v2.js';

function createStackRuntime(counts) {
  const width = 7;
  const height = 9;
  const blocks = [];
  const gates = [];
  const oneway = new Map();
  let blockNumber = 0;

  counts.forEach((count, color) => {
    gates.push({ id: `gate-${color}`, side: 'bottom', line: color, color });
    for (let y = 0; y < height; y++) oneway.set(`${color},${y}`, 'down');
    for (let offset = 0; offset < count; offset++) {
      const y = height - count + offset;
      blocks.push({
        id: `block-${String(blockNumber++).padStart(2, '0')}`,
        x: color,
        y,
        w: 1,
        h: 1,
        color,
      });
    }
  });

  return { width, height, blocks, walls: new Set(), gates, oneway, shutters: [] };
}

function createStackBoardData(counts, expectedOptimalSwipes = counts.reduce((sum, count) => sum + count, 0)) {
  const runtime = createStackRuntime(counts);
  return materializeBoardDataV2({
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: BOARD_RULES_VERSION,
    generatorVersion: 'solver-fixture-v1',
    puzzleId: `solver-${counts.join('-')}`,
    boardHash: null,
    width: runtime.width,
    height: runtime.height,
    blocks: runtime.blocks,
    walls: [],
    gates: runtime.gates,
    lanes: [...runtime.oneway.entries()].map(([cell, direction]) => {
      const [x, y] = cell.split(',').map(Number);
      return { id: `lane-${x}-${y}`, x, y, direction };
    }),
    shutters: [],
    expectedOptimalSwipes,
  });
}

const SOLVER_OPTIONS = Object.freeze({
  maxNodes: 100_000,
  maxStates: 100_000,
  maxDepth: 40,
  timeoutMs: 5_000,
});

test('8箱・3色・同色複数箱を厳密に解く', () => {
  const boardData = createStackBoardData([3, 3, 2]);
  const result = solveBoardDataV2(boardData, SOLVER_OPTIONS);
  assert.equal(result.solved, true);
  assert.equal(result.exact, true);
  assert.equal(result.optimalSwipes, 8);
  assert.equal(result.solution.length, 8);
  assert.equal(result.symmetryReduced, true);
  assert.ok(result.nodesExpanded > 0);
  assert.ok(result.uniqueStates > 0);
  assert.deepEqual(
    verifyExactSolutionV2(boardDataV2ToRuntime(boardData), result.solution),
    { valid: true, cleared: true, failedAt: null, reason: null },
  );
});

test('11箱・4色fixtureを厳密に解く', () => {
  const result = solveRuntimeBoardExactV2(createStackRuntime([3, 3, 3, 2]), SOLVER_OPTIONS);
  assert.equal(result.solved, true);
  assert.equal(result.optimalSwipes, 11);
  assert.ok(result.uniqueStates < 1_000);
});

test('14箱・6色fixtureを厳密に解く', () => {
  const runtime = createStackRuntime([3, 3, 2, 2, 2, 2]);
  const result = solveRuntimeBoardExactV2(runtime, SOLVER_OPTIONS);
  assert.equal(result.solved, true);
  assert.equal(result.optimalSwipes, 14);
  assert.ok(result.uniqueStates < 5_000, `unexpected state count: ${result.uniqueStates}`);
  assert.equal(verifyExactSolutionV2(runtime, result.solution).cleared, true);
});

test('同じ盤面では同じ解法列を返す', () => {
  const runtime = createStackRuntime([3, 3, 2]);
  const first = solveRuntimeBoardExactV2(runtime, SOLVER_OPTIONS);
  const second = solveRuntimeBoardExactV2(runtime, SOLVER_OPTIONS);
  assert.equal(first.optimalSwipes, second.optimalSwipes);
  assert.deepEqual(first.solution, second.solution);
  assert.equal(first.nodesExpanded, second.nodesExpanded);
  assert.equal(first.uniqueStates, second.uniqueStates);
});

test('同色箱の位置交換は圧縮時に同一状態として扱う', () => {
  const runtime = createStackRuntime([2, 2, 2]);
  const original = runtime.blocks.map((block) => ({ x: block.x, y: block.y }));
  const swapped = original.map((position) => ({ ...position }));
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];

  assert.equal(canonicalStateKeyV2(runtime, original), canonicalStateKeyV2(runtime, swapped));
  assert.notEqual(
    canonicalStateKeyV2(runtime, original, { symmetryReduced: false }),
    canonicalStateKeyV2(runtime, swapped, { symmetryReduced: false }),
  );
});

test('expectedOptimalSwipesとの一致と不一致を報告する', () => {
  const matching = createStackBoardData([3, 3, 2], 8);
  const mismatch = createStackBoardData([3, 3, 2], 9);
  const matchedResult = validateExpectedOptimalSwipesV2(matching, SOLVER_OPTIONS);
  const mismatchResult = validateExpectedOptimalSwipesV2(mismatch, SOLVER_OPTIONS);
  assert.equal(matchedResult.matchesExpected, true);
  assert.equal(matchedResult.expectedOptimalSwipes, 8);
  assert.equal(mismatchResult.solved, true);
  assert.equal(mismatchResult.optimalSwipes, 8);
  assert.equal(mismatchResult.matchesExpected, false);
});

test('maxDepth未満で解けない場合は厳密値を捏造しない', () => {
  const result = solveRuntimeBoardExactV2(createStackRuntime([3, 3, 2]), {
    ...SOLVER_OPTIONS,
    maxDepth: 7,
  });
  assert.equal(result.solved, false);
  assert.equal(result.exact, false);
  assert.equal(result.optimalSwipes, null);
  assert.equal(result.reason, 'maxDepth');
});

test('maxNodes到達時は理由と計測値を返す', () => {
  const result = solveRuntimeBoardExactV2(createStackRuntime([3, 3, 2]), {
    ...SOLVER_OPTIONS,
    maxNodes: 0,
  });
  assert.equal(result.solved, false);
  assert.equal(result.reason, 'maxNodes');
  assert.equal(result.nodesExpanded, 0);
  assert.equal(result.optimalSwipes, null);
});

test('timeoutを注入時計で決定的に検査できる', () => {
  let tick = 0;
  const result = solveRuntimeBoardExactV2(createStackRuntime([3, 3, 2]), {
    ...SOLVER_OPTIONS,
    timeoutMs: 0,
    timeCheckInterval: 1,
    now: () => tick++ * 10,
  });
  assert.equal(result.solved, false);
  assert.equal(result.reason, 'timeout');
  assert.equal(result.optimalSwipes, null);
});

test('AbortSignalで探索を中断できる', () => {
  const controller = new AbortController();
  controller.abort();
  const result = solveRuntimeBoardExactV2(createStackRuntime([3, 3, 2]), {
    ...SOLVER_OPTIONS,
    signal: controller.signal,
  });
  assert.equal(result.solved, false);
  assert.equal(result.reason, 'aborted');
  assert.equal(result.optimalSwipes, null);
});

test('解法の改ざんを再生検証で拒否する', () => {
  const runtime = createStackRuntime([3, 3, 2]);
  const result = solveRuntimeBoardExactV2(runtime, SOLVER_OPTIONS);
  const altered = result.solution.map((step) => ({ ...step, from: { ...step.from } }));
  altered[0].steps += 1;
  const verification = verifyExactSolutionV2(runtime, altered);
  assert.equal(verification.valid, false);
  assert.equal(verification.failedAt, 0);
  assert.equal(verification.reason, 'steps');
});

test('未対応shutterを含む盤面は探索前に拒否する', () => {
  const runtime = createStackRuntime([3, 3, 2]);
  runtime.shutters.push({ id: 'shutter-1', x: 6, y: 0, axis: 'vertical', period: 2, openPhases: [0] });
  assert.throws(
    () => solveRuntimeBoardExactV2(runtime, SOLVER_OPTIONS),
    /does not support shutters/,
  );
});
