import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_PROFILES,
  boardDataV2ToRuntime,
  validateBoardDataV2,
} from '../src/core/board-data-v2.js';
import {
  generateCandidateBoardV2,
  GENERATOR_V2_PROFILES,
  GENERATOR_V2_TARGET,
  listGeneratorV2Profiles,
} from '../src/core/generator-v2.js';
import { verifyExactSolutionV2 } from '../src/core/exact-solver-v2.js';

const SOLVER_LIMITS = Object.freeze({
  maxNodes: 600_000,
  maxStates: 600_000,
  maxDepth: 35,
  timeoutMs: 15_000,
});

test('generator v2 profileは8〜14箱と3〜6色を覆う', () => {
  const profiles = listGeneratorV2Profiles();
  assert.deepEqual(profiles.map((entry) => entry.boxCount), [8, 9, 10, 11, 12, 13, 14]);
  assert.deepEqual([...new Set(profiles.map((entry) => entry.colorCount))], [3, 4, 5, 6]);
  for (const entry of profiles) {
    assert.ok(entry.expectedOptimalSwipes >= GENERATOR_V2_TARGET.minOptimalSwipes);
    assert.ok(entry.expectedOptimalSwipes <= GENERATOR_V2_TARGET.maxOptimalSwipes);
  }
});

test('全profileがofficial盤面と厳密20〜35操作を返す', () => {
  for (const profile of GENERATOR_V2_PROFILES) {
    const generated = generateCandidateBoardV2({
      seed: `profile-${profile.id}`,
      profileId: profile.id,
      maxAttempts: 1,
      solver: SOLVER_LIMITS,
    });
    assert.equal(generated.success, true, `${profile.id}: ${JSON.stringify(generated.failures)}`);
    assert.equal(generated.attempts, 1);
    assert.equal(generated.boardData.blocks.length, profile.boxCount);
    assert.equal(new Set(generated.boardData.blocks.map((block) => block.color)).size, profile.colorCount);
    assert.equal(generated.solver.solved, true);
    assert.equal(generated.solver.exact, true);
    assert.equal(generated.solver.optimalSwipes, profile.expectedOptimalSwipes);
    assert.equal(generated.boardData.expectedOptimalSwipes, generated.solver.optimalSwipes);
    assert.ok(generated.solver.optimalSwipes >= 20 && generated.solver.optimalSwipes <= 35);
    assert.equal(generated.solution.length, generated.solver.optimalSwipes);
    assert.equal(generated.failures.length, 0);

    const colorCounts = new Map();
    for (const block of generated.boardData.blocks) {
      colorCounts.set(block.color, (colorCounts.get(block.color) ?? 0) + 1);
    }
    assert.ok(Math.max(...colorCounts.values()) >= 2);

    const validation = validateBoardDataV2(generated.boardData, {
      profile: BOARD_PROFILES.OFFICIAL,
      requireHash: true,
    });
    assert.equal(validation.valid, true, validation.errors.map((entry) => entry.code).join(','));
    assert.deepEqual(
      verifyExactSolutionV2(boardDataV2ToRuntime(generated.boardData), generated.solution),
      { valid: true, cleared: true, failedAt: null, reason: null },
    );
  }
});

test('同じseedとprofileは同じ盤面・解法・variantを返す', () => {
  const options = {
    seed: 'deterministic-generator-v2',
    boxCount: 10,
    colorCount: 4,
    maxAttempts: 1,
    solver: SOLVER_LIMITS,
  };
  const first = generateCandidateBoardV2(options);
  const second = generateCandidateBoardV2(options);
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.deepEqual(first.boardData, second.boardData);
  assert.deepEqual(first.solution, second.solution);
  assert.deepEqual(first.variant, second.variant);
  assert.equal(first.solver.nodesExpanded, second.solver.nodesExpanded);
  assert.equal(first.solver.uniqueStates, second.solver.uniqueStates);
});

test('seed変化で決定論的variantを変えられる', () => {
  const hashes = new Set();
  const variants = new Set();
  for (const seed of ['variant-a', 'variant-b', 'variant-c', 'variant-d']) {
    const generated = generateCandidateBoardV2({
      seed,
      boxCount: 8,
      colorCount: 3,
      maxAttempts: 1,
      solver: SOLVER_LIMITS,
    });
    assert.equal(generated.success, true);
    hashes.add(generated.boardData.boardHash);
    variants.add(JSON.stringify(generated.variant));
  }
  assert.ok(hashes.size >= 2);
  assert.ok(variants.size >= 2);
});

test('対応しない箱数・色数の組合せは推測生成しない', () => {
  const generated = generateCandidateBoardV2({
    seed: 'unsupported',
    boxCount: 14,
    colorCount: 3,
  });
  assert.equal(generated.success, false);
  assert.equal(generated.reason, 'unsupported-profile');
  assert.equal(generated.attempts, 0);
  assert.equal(generated.boardData, null);
});

test('solver上限到達時は厳密値や盤面を返さない', () => {
  const generated = generateCandidateBoardV2({
    seed: 'budget-stop',
    boxCount: 8,
    maxAttempts: 2,
    solver: {
      ...SOLVER_LIMITS,
      maxNodes: 0,
    },
  });
  assert.equal(generated.success, false);
  assert.equal(generated.reason, 'attempts-exhausted');
  assert.equal(generated.boardData, null);
  assert.equal(generated.solution.length, 0);
  assert.equal(generated.failures.length, 2);
  assert.ok(generated.failures.every((entry) => entry.reason === 'solver-maxNodes'));
});

test('maxAttemptsの不正値を拒否する', () => {
  assert.throws(
    () => generateCandidateBoardV2({ seed: 'invalid', maxAttempts: 0 }),
    /maxAttempts must be an integer >= 1/,
  );
});
