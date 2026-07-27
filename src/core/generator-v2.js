// HAKODASE P3-03R 候補生成器v3。
// 66件の独立した経路テンプレートをseedで選び、P3-02厳密ソルバーの基礎証明を
// 反転・色置換へ写像する。公開ゲームの開始処理や描画ループからは呼ばない。

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
import { GENERATOR_V3_TEMPLATE_CATALOG } from './generator-v3-catalog.js';
import { proveTemplateExactly } from './generator-v3-proof.js';

export const GENERATOR_V3_VERSION = 'route-catalog/3.0.0';
// 既存の開発APIとの互換性を保つ別名。新規文書ではGENERATOR_V3_VERSIONを正本とする。
export const GENERATOR_V2_VERSION = GENERATOR_V3_VERSION;
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
const DIRECTION_TRANSFORM = Object.freeze({
  identity: Object.freeze({ up: 'up', down: 'down', left: 'left', right: 'right' }),
  mirrorX: Object.freeze({ up: 'up', down: 'down', left: 'right', right: 'left' }),
  mirrorY: Object.freeze({ up: 'down', down: 'up', left: 'left', right: 'right' }),
  rotate180: Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' }),
});

const PROFILE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'b08c3', boxCount: 8, colorCount: 3, expectedOptimalSwipes: 20 }),
  Object.freeze({ id: 'b09c3', boxCount: 9, colorCount: 3, expectedOptimalSwipes: 21 }),
  Object.freeze({ id: 'b10c4', boxCount: 10, colorCount: 4, expectedOptimalSwipes: 24 }),
  Object.freeze({ id: 'b11c4', boxCount: 11, colorCount: 4, expectedOptimalSwipes: 25 }),
  Object.freeze({ id: 'b12c5', boxCount: 12, colorCount: 5, expectedOptimalSwipes: 28 }),
  Object.freeze({ id: 'b13c5', boxCount: 13, colorCount: 5, expectedOptimalSwipes: 29 }),
  Object.freeze({ id: 'b14c6', boxCount: 14, colorCount: 6, expectedOptimalSwipes: 28 }),
]);

const PROFILE_BY_ID = new Map(PROFILE_DEFINITIONS.map((profile) => [profile.id, profile]));
const TEMPLATE_BY_ID = new Map(GENERATOR_V3_TEMPLATE_CATALOG.map((template) => [template.id, template]));
const TEMPLATES_BY_PROFILE = new Map(PROFILE_DEFINITIONS.map((profile) => [
  profile.id,
  Object.freeze(GENERATOR_V3_TEMPLATE_CATALOG.filter((template) => template.profileId === profile.id)),
]));
const DEFAULT_PROOF_CACHE = new Map();

export const GENERATOR_V2_PROFILES = Object.freeze(PROFILE_DEFINITIONS.map((profile) => Object.freeze({
  ...profile,
  templateCount: TEMPLATES_BY_PROFILE.get(profile.id).length,
})));

function shuffle(values, rng) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = rng.int(index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function readPositiveInteger(value, fallback, name) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new TypeError(`${name} must be an integer >= 1`);
  }
  return resolved;
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

function transformDirection(transform, direction) {
  const mapped = DIRECTION_TRANSFORM[transform]?.[direction];
  if (!mapped) throw new TypeError(`unsupported direction ${direction} for ${transform}`);
  return mapped;
}

function chooseProfiles(options) {
  return PROFILE_DEFINITIONS.filter((entry) => (
    (options.profileId == null || entry.id === options.profileId)
    && (options.boxCount == null || entry.boxCount === options.boxCount)
    && (options.colorCount == null || entry.colorCount === options.colorCount)
  ));
}

function createColorPermutation(colorCount, rng) {
  return shuffle(Array.from({ length: colorCount }, (_, index) => index), rng);
}

function provisionalPuzzleId(profileId, templateId, seedHash, attempt) {
  return `cand-${profileId}-${templateId.slice(-3)}-${seedHash.toString(16).padStart(8, '0')}-a${String(attempt).padStart(2, '0')}`;
}

function contentPuzzleId(profileId, templateId, boardHash) {
  return `cand-${profileId}-${templateId.slice(-3)}-${boardHash.slice('sha256:'.length, 'sha256:'.length + 16)}`;
}

function buildDraft(template, transform, colorPermutation, seedHash, attempt) {
  const openCells = new Set();
  const blocks = [];
  const gates = [];
  const laneByCell = new Map();
  let blockNumber = 0;

  template.routes.forEach((route, routeIndex) => {
    const transformedPath = route.path.map(([x, y]) => transformPoint(transform, x, y));
    for (const point of transformedPath) openCells.add(`${point.x},${point.y}`);

    const count = template.counts[routeIndex];
    if (!Number.isInteger(count) || count < 1 || count >= transformedPath.length) {
      throw new RangeError(`template ${template.id} route ${routeIndex} has invalid count ${count}`);
    }

    for (let offset = 0; offset < count; offset++) {
      const point = transformedPath[offset];
      blocks.push({
        id: `b${String(blockNumber++).padStart(2, '0')}`,
        x: point.x,
        y: point.y,
        w: 1,
        h: 1,
        color: colorPermutation[routeIndex],
      });
    }

    const gate = transformGate(transform, route.gate);
    gates.push({
      id: `g${String(routeIndex).padStart(2, '0')}`,
      side: gate.side,
      line: gate.line,
      color: colorPermutation[routeIndex],
    });

    for (const lane of route.lanes ?? []) {
      const point = transformPoint(transform, lane.x, lane.y);
      const direction = transformDirection(transform, lane.direction);
      const cell = `${point.x},${point.y}`;
      const previous = laneByCell.get(cell);
      if (previous && previous !== direction) {
        throw new TypeError(`template ${template.id} has conflicting lane at ${cell}`);
      }
      laneByCell.set(cell, direction);
    }
  });

  const walls = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!openCells.has(`${x},${y}`)) walls.push({ x, y });
    }
  }

  const lanes = [...laneByCell.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([cell, direction], index) => {
      const [x, y] = cell.split(',').map(Number);
      return { id: `l${String(index).padStart(2, '0')}`, x, y, direction };
    });

  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: BOARD_RULES_VERSION,
    generatorVersion: GENERATOR_V2_VERSION,
    puzzleId: provisionalPuzzleId(template.profileId, template.id, seedHash, attempt),
    boardHash: null,
    width: WIDTH,
    height: HEIGHT,
    blocks,
    walls,
    gates,
    lanes,
    shutters: [],
    expectedOptimalSwipes: null,
  };
}

function identityPermutation(colorCount) {
  return Array.from({ length: colorCount }, (_, index) => index);
}

function buildStructuralBoard(template, transform, colorPermutation, seedHash, attempt) {
  let structural = materializeBoardDataV2(
    buildDraft(template, transform, colorPermutation, seedHash, attempt),
    { profile: BOARD_PROFILES.STRUCTURAL },
  );
  structural = materializeBoardDataV2({
    ...structural,
    puzzleId: contentPuzzleId(template.profileId, template.id, structural.boardHash),
    boardHash: null,
  }, { profile: BOARD_PROFILES.STRUCTURAL });
  return structural;
}

function transformSolution(solution, transform, colorPermutation) {
  return Object.freeze(solution.map((action) => Object.freeze({
    ...action,
    color: colorPermutation[action.color],
    from: Object.freeze(transformPoint(transform, action.from.x, action.from.y)),
    direction: transformDirection(transform, action.direction),
  })));
}

function baseProof(template, solverOptions, useDefaultCache) {
  if (useDefaultCache && DEFAULT_PROOF_CACHE.has(template.id)) {
    return Object.freeze({ ...DEFAULT_PROOF_CACHE.get(template.id), cacheHit: true });
  }

  const profile = PROFILE_BY_ID.get(template.profileId);
  const structural = buildStructuralBoard(
    template,
    'identity',
    identityPermutation(profile.colorCount),
    hashSeed(`proof:${template.id}`),
    0,
  );
  const solver = proveTemplateExactly(template, solverOptions);
  if (!solver.solved || !solver.exact || solver.optimalSwipes !== template.expectedOptimalSwipes) {
    const proof = Object.freeze({ ok: false, structural, solver, cacheHit: false });
    if (useDefaultCache) DEFAULT_PROOF_CACHE.set(template.id, proof);
    return proof;
  }

  const verification = verifyExactSolutionV2(boardDataV2ToRuntime(structural), solver.solution);
  const proof = Object.freeze({
    ok: verification.valid && verification.cleared,
    structural,
    solver,
    verification,
    cacheHit: false,
  });
  if (useDefaultCache) DEFAULT_PROOF_CACHE.set(template.id, proof);
  return proof;
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
  return GENERATOR_V2_PROFILES.map((entry) => Object.freeze({ ...entry }));
}

export function listGeneratorV3Templates(profileId = null) {
  return GENERATOR_V3_TEMPLATE_CATALOG
    .filter((template) => profileId == null || template.profileId === profileId)
    .map((template) => Object.freeze({
      id: template.id,
      profileId: template.profileId,
      expectedOptimalSwipes: template.expectedOptimalSwipes,
      routeCount: template.routes.length,
      usesLanes: template.routes.some((route) => route.lanes.length > 0),
    }));
}

export function clearGeneratorV3ProofCache() {
  DEFAULT_PROOF_CACHE.clear();
}

export function generateCandidateBoardV2(options = {}) {
  const seed = options.seed ?? Date.now();
  const seedHash = hashSeed(seed);
  const maxAttempts = readPositiveInteger(options.maxAttempts, GENERATOR_V2_DEFAULTS.maxAttempts, 'maxAttempts');
  const requestedTemplate = options.templateId == null ? null : TEMPLATE_BY_ID.get(String(options.templateId));
  if (options.templateId != null && !requestedTemplate) {
    return generationFailure(seed, 0, [], 'unsupported-template');
  }
  const eligibleProfiles = chooseProfiles(options).filter((profile) => (
    requestedTemplate == null || profile.id === requestedTemplate.profileId
  ));
  if (eligibleProfiles.length === 0) return generationFailure(seed, 0, [], 'unsupported-profile');

  const solverOptions = {
    ...GENERATOR_V2_DEFAULTS.solver,
    ...(options.solver ?? {}),
  };
  const useDefaultCache = options.solver == null;
  const failures = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const profile = eligibleProfiles[(seedHash + attempt) % eligibleProfiles.length];
    const templates = requestedTemplate ? [requestedTemplate] : TEMPLATES_BY_PROFILE.get(profile.id);
    const templateHash = hashSeed(`${seed}|${profile.id}|${attempt}|${GENERATOR_V2_VERSION}`);
    const template = templates[templateHash % templates.length];
    const rng = makeRng(templateHash ^ 0x85ebca6b);
    const transform = TRANSFORMS[rng.int(TRANSFORMS.length)];
    const colorPermutation = createColorPermutation(profile.colorCount, rng);

    let proof;
    try {
      proof = baseProof(template, solverOptions, useDefaultCache);
    } catch (error) {
      failures.push({ attempt, profileId: profile.id, templateId: template.id, reason: 'proof-error', detail: error.message });
      continue;
    }
    if (!proof.ok) {
      failures.push({
        attempt,
        profileId: profile.id,
        templateId: template.id,
        reason: `solver-${proof.solver.reason}`,
        nodesExpanded: proof.solver.nodesExpanded,
        uniqueStates: proof.solver.uniqueStates,
      });
      continue;
    }

    let structural;
    try {
      structural = buildStructuralBoard(template, transform, colorPermutation, seedHash, attempt);
    } catch (error) {
      failures.push({ attempt, profileId: profile.id, templateId: template.id, reason: 'structural-invalid', detail: error.message });
      continue;
    }

    const solution = transformSolution(proof.solver.solution, transform, colorPermutation);
    const verification = verifyExactSolutionV2(boardDataV2ToRuntime(structural), solution);
    if (!verification.valid || !verification.cleared) {
      failures.push({
        attempt,
        profileId: profile.id,
        templateId: template.id,
        reason: 'solution-verification-failed',
        detail: verification.reason,
      });
      continue;
    }

    if (template.expectedOptimalSwipes < GENERATOR_V2_TARGET.minOptimalSwipes
        || template.expectedOptimalSwipes > GENERATOR_V2_TARGET.maxOptimalSwipes) {
      failures.push({
        attempt,
        profileId: profile.id,
        templateId: template.id,
        reason: 'outside-target',
        optimalSwipes: template.expectedOptimalSwipes,
      });
      continue;
    }

    let boardData;
    try {
      boardData = materializeBoardDataV2({
        ...structural,
        boardHash: null,
        expectedOptimalSwipes: template.expectedOptimalSwipes,
      }, { profile: BOARD_PROFILES.OFFICIAL });
    } catch (error) {
      failures.push({ attempt, profileId: profile.id, templateId: template.id, reason: 'official-invalid', detail: error.message });
      continue;
    }

    const finalValidation = validateBoardDataV2(boardData, {
      profile: BOARD_PROFILES.OFFICIAL,
      requireHash: true,
    });
    if (!finalValidation.valid) {
      failures.push({
        attempt,
        profileId: profile.id,
        templateId: template.id,
        reason: 'official-validation-failed',
        detail: finalValidation.errors.map((entry) => entry.code).join(','),
      });
      continue;
    }

    const solver = Object.freeze({
      ...proof.solver,
      solution,
      proofSource: 'catalog-template',
      proofTemplateId: template.id,
      proofReused: proof.cacheHit,
      proofTransformInvariant: true,
    });

    return Object.freeze({
      success: true,
      reason: 'generated',
      seed,
      attempts: attempt + 1,
      failures: Object.freeze(failures.map((entry) => Object.freeze({ ...entry }))),
      boardData,
      solution,
      solver,
      variant: Object.freeze({
        profileId: profile.id,
        templateId: template.id,
        transform,
        colorPermutation: Object.freeze(colorPermutation),
        derivedSeed: templateHash,
        usesLanes: template.routes.some((route) => route.lanes.length > 0),
      }),
    });
  }

  return generationFailure(seed, maxAttempts, failures);
}
