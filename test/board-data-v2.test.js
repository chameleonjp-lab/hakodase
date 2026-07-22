import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_PROFILES,
  BOARD_RULES_VERSION,
  BOARD_SCHEMA_VERSION,
  boardDataV2ToRuntime,
  canonicalBoardPayload,
  computeBoardHash,
  createBoardDataV2FromRuntime,
  materializeBoardDataV2,
  validateBoardDataV2,
} from '../src/core/board-data-v2.js';

function officialDraft(overrides = {}) {
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: BOARD_RULES_VERSION,
    generatorVersion: 'generator-v2-test',
    puzzleId: 'official-fixture-001',
    boardHash: null,
    width: 7,
    height: 9,
    blocks: [
      { id: 'b01', x: 0, y: 0, w: 1, h: 1, color: 0 },
      { id: 'b02', x: 2, y: 0, w: 1, h: 1, color: 0 },
      { id: 'b03', x: 4, y: 0, w: 1, h: 1, color: 0 },
      { id: 'b04', x: 1, y: 2, w: 1, h: 1, color: 1 },
      { id: 'b05', x: 3, y: 2, w: 1, h: 1, color: 1 },
      { id: 'b06', x: 5, y: 2, w: 1, h: 1, color: 1 },
      { id: 'b07', x: 2, y: 4, w: 1, h: 1, color: 2 },
      { id: 'b08', x: 4, y: 4, w: 1, h: 1, color: 2 },
    ],
    walls: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 5, y: 1 },
      { x: 0, y: 3 },
      { x: 6, y: 3 },
    ],
    gates: [
      { id: 'g0', side: 'bottom', line: 0, color: 0 },
      { id: 'g1', side: 'right', line: 5, color: 1 },
      { id: 'g2', side: 'top', line: 6, color: 2 },
    ],
    lanes: [],
    shutters: [],
    expectedOptimalSwipes: 20,
    ...overrides,
  };
}

test('official profile accepts 8 boxes, 3 colors, and duplicate colors', () => {
  const data = materializeBoardDataV2(officialDraft(), { profile: BOARD_PROFILES.OFFICIAL });
  assert.match(data.boardHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(data.blocks.length, 8);
  assert.equal(new Set(data.blocks.map((block) => block.color)).size, 3);
  assert.ok(data.blocks.filter((block) => block.color === 0).length > 1);
  assert.equal(validateBoardDataV2(data, { profile: BOARD_PROFILES.OFFICIAL }).valid, true);
});

test('canonical order ignores source array ordering', () => {
  const first = materializeBoardDataV2(officialDraft(), { profile: BOARD_PROFILES.OFFICIAL });
  const source = officialDraft({
    blocks: [...officialDraft().blocks].reverse(),
    walls: [...officialDraft().walls].reverse(),
    gates: [...officialDraft().gates].reverse(),
  });
  const second = materializeBoardDataV2(source, { profile: BOARD_PROFILES.OFFICIAL });
  assert.equal(first.boardHash, second.boardHash);
  assert.deepEqual(canonicalBoardPayload(first), canonicalBoardPayload(second));
});

test('provenance and expected score do not alter boardHash', () => {
  const first = materializeBoardDataV2(officialDraft(), { profile: BOARD_PROFILES.OFFICIAL });
  const second = materializeBoardDataV2(officialDraft({
    generatorVersion: 'generator-v2-other',
    puzzleId: 'official-fixture-other',
    expectedOptimalSwipes: 35,
  }), { profile: BOARD_PROFILES.OFFICIAL });
  assert.equal(first.boardHash, second.boardHash);
});

test('geometry and rules alter boardHash', () => {
  const first = materializeBoardDataV2(officialDraft(), { profile: BOARD_PROFILES.OFFICIAL });
  const moved = officialDraft();
  moved.blocks = moved.blocks.map((block) => block.id === 'b08' ? { ...block, x: 6 } : block);
  const second = materializeBoardDataV2(moved, { profile: BOARD_PROFILES.OFFICIAL });
  assert.notEqual(first.boardHash, second.boardHash);
  const differentRules = { ...first, rulesVersion: 'slide-exit/other', boardHash: first.boardHash };
  const result = validateBoardDataV2(differentRules, { profile: BOARD_PROFILES.OFFICIAL });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'unsupported-rules-version'));
});

test('tampered hash is rejected', () => {
  const data = materializeBoardDataV2(officialDraft(), { profile: BOARD_PROFILES.OFFICIAL });
  const result = validateBoardDataV2({ ...data, boardHash: `sha256:${'0'.repeat(64)}` }, { profile: BOARD_PROFILES.OFFICIAL });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'board-hash-mismatch'));
  assert.equal(result.computedBoardHash, computeBoardHash(data));
});

test('official profile enforces size, box count, colors, and 20-35 swipes', () => {
  const draft = officialDraft({
    width: 6,
    blocks: officialDraft().blocks.slice(0, 7).map((block, index) => ({ ...block, color: index % 2 })),
    gates: [
      { id: 'g0', side: 'bottom', line: 0, color: 0 },
      { id: 'g1', side: 'right', line: 5, color: 1 },
    ],
    expectedOptimalSwipes: 19,
  });
  const result = validateBoardDataV2(draft, { profile: BOARD_PROFILES.OFFICIAL, requireHash: false });
  const codes = new Set(result.errors.map((entry) => entry.code));
  assert.ok(codes.has('official-board-size'));
  assert.ok(codes.has('official-block-count'));
  assert.ok(codes.has('official-color-count'));
  assert.ok(codes.has('official-optimal-swipes'));
});

test('semantic collisions and gate inconsistencies are rejected', () => {
  const draft = officialDraft();
  draft.blocks = draft.blocks.map((block) => block.id === 'b02' ? { ...block, x: 0, y: 0 } : block);
  draft.walls = [...draft.walls, { x: 0, y: 0 }, { x: 1, y: 1 }];
  draft.gates = [
    ...draft.gates,
    { id: 'g3', side: 'bottom', line: 0, color: 2 },
  ];
  const result = validateBoardDataV2(draft, { profile: BOARD_PROFILES.STRUCTURAL, requireHash: false });
  const codes = new Set(result.errors.map((entry) => entry.code));
  assert.ok(codes.has('overlapping-blocks'));
  assert.ok(codes.has('wall-block-overlap'));
  assert.ok(codes.has('duplicate-wall'));
  assert.ok(codes.has('duplicate-gate-opening'));
  assert.ok(codes.has('gate-count-for-color'));
});

test('runtime adapter preserves same-color boxes and maps lanes to oneway', () => {
  const draft = officialDraft({ lanes: [{ id: 'lane-1', x: 6, y: 8, direction: 'up' }] });
  const data = materializeBoardDataV2(draft, { profile: BOARD_PROFILES.OFFICIAL });
  const runtime = boardDataV2ToRuntime(data, { profile: BOARD_PROFILES.OFFICIAL });
  assert.equal(runtime.blocks.filter((block) => block.color === 0).length, 3);
  assert.equal(runtime.oneway.get('6,8'), 'up');
  assert.ok(runtime.walls instanceof Set);
});

test('unsupported shutters are not silently ignored by runtime adapter', () => {
  const draft = officialDraft({
    shutters: [{ id: 'shutter-1', x: 6, y: 8, axis: 'horizontal', period: 3, openPhases: [0, 2] }],
  });
  const data = materializeBoardDataV2(draft, { profile: BOARD_PROFILES.OFFICIAL });
  const result = validateBoardDataV2(data, { profile: BOARD_PROFILES.OFFICIAL });
  assert.ok(result.warnings.some((entry) => entry.code === 'runtime-shutters-not-connected'));
  assert.throws(() => boardDataV2ToRuntime(data, { profile: BOARD_PROFILES.OFFICIAL }), /shutters are not supported/);
});

test('runtime board can migrate to v2 and round-trip through JSON', () => {
  const source = officialDraft();
  const materialized = materializeBoardDataV2(source, { profile: BOARD_PROFILES.OFFICIAL });
  const runtime = boardDataV2ToRuntime(materialized, { profile: BOARD_PROFILES.OFFICIAL });
  const migrated = createBoardDataV2FromRuntime(runtime, {
    generatorVersion: 'migration-test',
    puzzleId: 'migrated-fixture-001',
    expectedOptimalSwipes: 20,
  }, { profile: BOARD_PROFILES.OFFICIAL });
  const parsed = JSON.parse(JSON.stringify(migrated));
  assert.equal(validateBoardDataV2(parsed, { profile: BOARD_PROFILES.OFFICIAL }).valid, true);
  assert.equal(migrated.boardHash, materialized.boardHash);
});
