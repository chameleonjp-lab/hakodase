// HAKODASE P3-03 候補生成器v2。
// 7×9の経路scaffoldをseedで変換し、P3-02厳密ソルバーで20〜35操作を確認した盤面だけを返す。
// 開発時・候補検査時専用。公開ゲームの開始処理や描画ループから呼ばない。

import {
  BOARD_PROFILES,
  BOARD_RULES_VERSION,
  BOARD_SCHEMA_VERSION,
  boardDataV2ToRuntime,
  materializeBoardDataV2,
  validateBoardDataV2,
} from './board-data-v2.js';
import {
  solveBoardDataV2,
  verifyExactSolutionV2,
} from './exact-solver-v2.js';
import { hashSeed, makeRng } from './rng.js';

export const GENERATOR_V2_VERSION = 'route-scaffold/2.0.0';
export const GENERATOR_V2_TARGET = Object.freeze({
  minOptimalSwipes: 20,
  maxOptimalSwipes: 35,
});
export const GENERATOR_V2_DEFAULTS = Object.freeze({
  maxAttempts: 16,
  solver: Object.freeze({
    maxNodes: 600_000,
    maxStates: 600_000,
    maxDepth: 35,
    timeoutMs: 15_000,
  }),
});

const WIDTH = 7;
const HEIGHT = 9;
const TRANSFORMS = Object.freeze(['identity', 'mirrorX', 'mirrorY', 'rotate180']);

function freezePath(path) {
  return Object.freeze(path.map(([x, y]) => Object.freeze([x, y])));
}

function route(id, path, gate) {
  return Object.freeze({
    id,
    path: freezePath(path),
    gate: Object.freeze({ side: gate.side, line: gate.line }),
  });
}

const U4_L2 = Object.freeze([
  route('u', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [5, 2], [6, 2]], { side: 'right', line: 2 }),
  route('l-a', [[1, 4], [1, 3], [1, 2], [0, 2]], { side: 'left', line: 2 }),
  route('l-b', [[1, 8], [1, 7], [1, 6], [0, 6]], { side: 'left', line: 6 }),
]);

const U4_L3 = Object.freeze([
  ...U4_L2,
  route('l-c', [[5, 6], [5, 5], [5, 4], [6, 4]], { side: 'right', line: 4 }),
]);

const U4_L4 = Object.freeze([
  route('u', [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0]], { side: 'top', line: 2 }),
  route('l-a', [[1, 8], [1, 7], [1, 6], [0, 6]], { side: 'left', line: 6 }),
  route('l-b', [[5, 5], [5, 4], [5, 3], [6, 3]], { side: 'right', line: 3 }),
  route('l-c', [[6, 1], [5, 1], [4, 1], [4, 0]], { side: 'top', line: 4 }),
  route('l-d', [[5, 7], [4, 7], [3, 7], [3, 8]], { side: 'bottom', line: 3 }),
]);

const SIX_L = Object.freeze([
  route('l-a', [[1, 5], [1, 4], [1, 3], [0, 3]], { side: 'left', line: 3 }),
  route('l-b', [[5, 5], [5, 4], [5, 3], [6, 3]], { side: 'right', line: 3 }),
  route('l-c', [[2, 1], [1, 1], [0, 1], [0, 0]], { side: 'top', line: 0 }),
  route('l-d', [[6, 1], [5, 1], [4, 1], [4, 0]], { side: 'top', line: 4 }),
  route('l-e', [[2, 7], [1, 7], [0, 7], [0, 8]], { side: 'bottom', line: 0 }),
  route('l-f', [[6, 7], [5, 7], [4, 7], [4, 8]], { side: 'bottom', line: 4 }),
]);

function profile(id, boxCount, colorCount, expectedOptimalSwipes, routes, counts, shuffleGroups = []) {
  return Object.freeze({
    id,
    boxCount,
    colorCount,
    expectedOptimalSwipes,
    routes,
    counts: Object.freeze([...counts]),
    shuffleGroups: Object.freeze(shuffleGroups.map((group) => Object.freeze([...group]))),
  });
}

export const GENERATOR_V2_PROFILES = Object.freeze([
  profile('b08c3', 8, 3, 20, U4_L2, [4, 2, 2], [[1, 2]]),
  profile('b09c3', 9, 3, 21, U4_L2, [4, 3, 2], [[1, 2]]),
  profile('b10c4', 10, 4, 24, U4_L3, [4, 2, 2, 2], [[1, 2, 3]]),
  profile('b11c4', 11, 4, 25, U4_L3, [4, 3, 2, 2], [[1, 2, 3]]),
  profile('b12c5', 12, 5, 28, U4_L4, [4, 2, 2, 2, 2], [[1, 2, 3, 4]]),
  profile('b13c5', 13, 5, 29, U4_L4, [4, 3, 2, 2, 2], [[1, 2, 3, 4]]),
  profile('b14c6', 14, 6, 26, SIX_L, [3, 3, 2, 2, 2, 2], [[0, 1, 2, 3, 4, 5]]),
]);

function shuffle(values, rng) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = rng.int(index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function assignCounts(profileDefinition, rng) {
  const counts = [...profileDefinition.counts];
  for (const group of profileDefinition.shuffleGroups) {
    const values = shuffle(group.map((index) => counts[index]), rng);
    group.forEach((index, valueIndex) => {
      counts[index] = values[valueIndex];
    });
  }
  return counts;
}

function transformPoint(transform, x, y) {
  if (transform === 'mirrorX') return { x: WIDTH - 1 - x, y };
  if (transform === 'mirrorY') return { x, y: HEIGHT - 1 - y };
  if (transform === 'rotate180') return { x: WIDTH - 1 - x, y: HEIGHT - 1 - y };
  return { x, y };
}

function transformGate(transform, gate) {
  if (transform === 'mirrorX') {
    if (gate.side === 'left') return { side: 'right', line: gate.line };
    if (gate.side === 'right') return { side: 'left', line: gate.line };
    return { side: gate.side, line: WIDTH - 1 - gate.line };
  }
  if (transform === 'mirrorY') {
    if (gate.side === 'top') return { side: 'bottom', line: gate.line };
    if (gate.side === 'bottom') return { side: 'top', line: gate.line };
    return { side: gate.side, line: HEIGHT - 1 - gate.line };
  }
  if (transform === 'rotate180') {
    if (gate.side === 'left') return { side: 'right', line: HEIGHT - 1 - gate.line };
    if (gate.side === 'right') return { side: 'left', line: HEIGHT - 1 - gate.line };
    if (gate.side === 'top') return { side: 'bottom', line: WIDTH - 1 - gate.line };
    return { side: 'top', line: WIDTH - 1 - gate.line };
  }
  return { side: gate.side, line: gate.line };
}

function chooseProfiles(options) {
  return GENERATOR_V2_PROFILES.filter((entry) => (
    (options.profileId == null || entry.id === options.profileId)
    && (options.boxCount == null || entry.boxCount === options.boxCount)
    && (options.colorCount == null || entry.colorCount === options.colorCount)
  ));
}

function readPositiveInteger(value, fallback, name, { allowZero = false } = {}) {
  const resolved = value ?? fallback;
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(resolved) || resolved < minimum) {
    throw new TypeError(`${name} must be an integer >= ${minimum}`);
  }
  return resolved;
}

function createColorPermutation(colorCount, rng) {
  return shuffle(Array.from({ length: colorCount }, (_, index) => index), rng);
}

function provisionalPuzzleId(profileId, seedHash, attempt) {
  return `cand-${profileId}-${seedHash.toString(16).padStart(8, '0')}-a${String(attempt).padStart(2, '0')}`;
}

function contentPuzzleId(profileId, boardHash) {
  return `cand-${profileId}-${boardHash.slice('sha256:'.length, 'sha256:'.length + 20)}`;
}

function buildDraft(profileDefinition, seedHash, attempt) {
  const derivedSeed = (seedHash ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
  const rng = makeRng(derivedSeed);
  const transform = TRANSFORMS[rng.int(TRANSFORMS.length)];
  const counts = assignCounts(profileDefinition, rng);
  const colorPermutation = createColorPermutation(profileDefinition.colorCount, rng);
  const openCells = new Set();
  const blocks = [];
  const gates = [];
  let blockNumber = 0;

  profileDefinition.routes.forEach((routeDefinition, routeIndex) => {
    const color = colorPermutation[routeIndex];
    const count = counts[routeIndex];
    if (!Number.isInteger(count) || count < 1 || count > routeDefinition.path.length - 1) {
      throw new RangeError(`profile ${profileDefinition.id} route ${routeDefinition.id} has invalid count ${count}`);
    }

    const transformedPath = routeDefinition.path.map(([x, y]) => transformPoint(transform, x, y));
    for (const point of transformedPath) openCells.add(`${point.x},${point.y}`);

    for (let offset = 0; offset < count; offset++) {
      const point = transformedPath[offset];
      blocks.push({
        id: `b${String(blockNumber++).padStart(2, '0')}`,
        x: point.x,
        y: point.y,
        w: 1,
        h: 1,
        color,
      });
    }

    const gate = transformGate(transform, routeDefinition.gate);
    gates.push({
      id: `g${String(routeIndex).padStart(2, '0')}`,
      side: gate.side,
      line: gate.line,
      color,
    });
  });

  const walls = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!openCells.has(`${x},${y}`)) walls.push({ x, y });
    }
  }

  const draft = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: BOARD_RULES_VERSION,
    generatorVersion: GENERATOR_V2_VERSION,
    puzzleId: provisionalPuzzleId(profileDefinition.id, seedHash, attempt),
    boardHash: null,
    width: WIDTH,
    height: HEIGHT,
    blocks,
    walls,
    gates,
    lanes: [],
    shutters: [],
    expectedOptimalSwipes: null,
  };

  return Object.freeze({
    draft,
    variant: Object.freeze({
      profileId: profileDefinition.id,
      transform,
      counts: Object.freeze(counts),
      colorPermutation: Object.freeze(colorPermutation),
      derivedSeed,
    }),
  });
}

function generationFailure(seed, attempts, failures, reason = 'attempts-exhausted') {
  return Object.freeze({
    success: false,
    reason,
    seed,
    attempts,
    failures: Object.freeze(failures.map((entry) => Object.freeze({ ...entry }))),
    boardData: null,
    solution: Object.freeze([]),
    solver: null,
    variant: null,
  });
}

export function listGeneratorV2Profiles() {
  return GENERATOR_V2_PROFILES.map((entry) => Object.freeze({
    id: entry.id,
    boxCount: entry.boxCount,
    colorCount: entry.colorCount,
    expectedOptimalSwipes: entry.expectedOptimalSwipes,
  }));
}

export function generateCandidateBoardV2(options = {}) {
  const seed = options.seed ?? Date.now();
  const seedHash = hashSeed(seed);
  const maxAttempts = readPositiveInteger(options.maxAttempts, GENERATOR_V2_DEFAULTS.maxAttempts, 'maxAttempts');
  const eligibleProfiles = chooseProfiles(options);
  if (eligibleProfiles.length === 0) {
    return generationFailure(seed, 0, [], 'unsupported-profile');
  }

  const solverOptions = {
    ...GENERATOR_V2_DEFAULTS.solver,
    ...(options.solver ?? {}),
  };
  const failures = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const profileDefinition = eligibleProfiles[(seedHash + attempt) % eligibleProfiles.length];
    let built;
    try {
      built = buildDraft(profileDefinition, seedHash, attempt);
    } catch (error) {
      failures.push({ attempt, profileId: profileDefinition.id, reason: 'build-error', detail: error.message });
      continue;
    }

    let structural;
    try {
      structural = materializeBoardDataV2(built.draft, { profile: BOARD_PROFILES.STRUCTURAL });
      structural = materializeBoardDataV2({
        ...structural,
        puzzleId: contentPuzzleId(profileDefinition.id, structural.boardHash),
        boardHash: null,
      }, { profile: BOARD_PROFILES.STRUCTURAL });
    } catch (error) {
      failures.push({ attempt, profileId: profileDefinition.id, reason: 'structural-invalid', detail: error.message });
      continue;
    }

    const solver = solveBoardDataV2(structural, solverOptions);
    if (!solver.solved || !solver.exact || !Number.isInteger(solver.optimalSwipes)) {
      failures.push({
        attempt,
        profileId: profileDefinition.id,
        reason: `solver-${solver.reason}`,
        nodesExpanded: solver.nodesExpanded,
        uniqueStates: solver.uniqueStates,
      });
      continue;
    }
    if (solver.optimalSwipes < GENERATOR_V2_TARGET.minOptimalSwipes
        || solver.optimalSwipes > GENERATOR_V2_TARGET.maxOptimalSwipes) {
      failures.push({
        attempt,
        profileId: profileDefinition.id,
        reason: 'outside-target',
        optimalSwipes: solver.optimalSwipes,
      });
      continue;
    }
    if (solver.optimalSwipes !== profileDefinition.expectedOptimalSwipes) {
      failures.push({
        attempt,
        profileId: profileDefinition.id,
        reason: 'profile-proof-mismatch',
        expected: profileDefinition.expectedOptimalSwipes,
        actual: solver.optimalSwipes,
      });
      continue;
    }

    const runtimeBoard = boardDataV2ToRuntime(structural);
    const verification = verifyExactSolutionV2(runtimeBoard, solver.solution);
    if (!verification.valid || !verification.cleared) {
      failures.push({
        attempt,
        profileId: profileDefinition.id,
        reason: 'solution-verification-failed',
        detail: verification.reason,
      });
      continue;
    }

    let boardData;
    try {
      boardData = materializeBoardDataV2({
        ...structural,
        boardHash: null,
        expectedOptimalSwipes: solver.optimalSwipes,
      }, { profile: BOARD_PROFILES.OFFICIAL });
    } catch (error) {
      failures.push({ attempt, profileId: profileDefinition.id, reason: 'official-invalid', detail: error.message });
      continue;
    }

    const finalValidation = validateBoardDataV2(boardData, {
      profile: BOARD_PROFILES.OFFICIAL,
      requireHash: true,
    });
    if (!finalValidation.valid) {
      failures.push({
        attempt,
        profileId: profileDefinition.id,
        reason: 'official-validation-failed',
        detail: finalValidation.errors.map((entry) => entry.code).join(','),
      });
      continue;
    }

    return Object.freeze({
      success: true,
      reason: 'generated',
      seed,
      attempts: attempt + 1,
      failures: Object.freeze(failures.map((entry) => Object.freeze({ ...entry }))),
      boardData,
      solution: solver.solution,
      solver,
      variant: built.variant,
    });
  }

  return generationFailure(seed, maxAttempts, failures);
}
