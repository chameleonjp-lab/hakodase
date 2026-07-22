// HAKODASE 盤面データv2の正本。
// JSON保存可能なデータ、意味検証、正規化、boardHash、現行Engine形式への変換を提供する。

import { sha256Canonical } from './board-hash.js';

export const BOARD_SCHEMA_VERSION = 'hakodase.board/2';
export const BOARD_RULES_VERSION = 'slide-exit/1';
export const BOARD_HASH_ALGORITHM = 'sha256';
export const BOARD_PROFILES = Object.freeze({
  STRUCTURAL: 'structural',
  OFFICIAL: 'official',
});

const SIDES = Object.freeze(['left', 'right', 'top', 'bottom']);
const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);
const AXES = Object.freeze(['horizontal', 'vertical']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SIDE_ORDER = Object.freeze({ left: 0, right: 1, top: 2, bottom: 3 });

function cellKey(x, y) {
  return `${x},${y}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function compareId(a, b) {
  return a.id.localeCompare(b.id, 'en');
}

function compareCell(a, b) {
  return a.y - b.y || a.x - b.x;
}

function compareGate(a, b) {
  return a.color - b.color || SIDE_ORDER[a.side] - SIDE_ORDER[b.side] || a.line - b.line || a.id.localeCompare(b.id, 'en');
}

function cloneBlock(block) {
  return { id: block.id, x: block.x, y: block.y, w: block.w, h: block.h, color: block.color };
}

function cloneWall(wall) {
  return { x: wall.x, y: wall.y };
}

function cloneGate(gate) {
  return { id: gate.id, side: gate.side, line: gate.line, color: gate.color };
}

function cloneLane(lane) {
  return { id: lane.id, x: lane.x, y: lane.y, direction: lane.direction };
}

function cloneShutter(shutter) {
  return {
    id: shutter.id,
    x: shutter.x,
    y: shutter.y,
    axis: shutter.axis,
    period: shutter.period,
    openPhases: [...shutter.openPhases].sort((a, b) => a - b),
  };
}

export function canonicalBoardPayload(input) {
  return {
    schemaVersion: input.schemaVersion,
    rulesVersion: input.rulesVersion,
    width: input.width,
    height: input.height,
    blocks: input.blocks.map(cloneBlock).sort(compareId),
    walls: input.walls.map(cloneWall).sort(compareCell),
    gates: input.gates.map(cloneGate).sort(compareGate),
    lanes: input.lanes.map(cloneLane).sort(compareId),
    shutters: input.shutters.map(cloneShutter).sort(compareId),
  };
}

export function computeBoardHash(input) {
  return sha256Canonical(canonicalBoardPayload(input));
}

export function normalizeBoardDataV2(input) {
  return {
    schemaVersion: input.schemaVersion,
    rulesVersion: input.rulesVersion,
    generatorVersion: input.generatorVersion,
    puzzleId: input.puzzleId,
    boardHash: input.boardHash ?? null,
    width: input.width,
    height: input.height,
    blocks: input.blocks.map(cloneBlock).sort(compareId),
    walls: input.walls.map(cloneWall).sort(compareCell),
    gates: input.gates.map(cloneGate).sort(compareGate),
    lanes: input.lanes.map(cloneLane).sort(compareId),
    shutters: input.shutters.map(cloneShutter).sort(compareId),
    expectedOptimalSwipes: input.expectedOptimalSwipes ?? null,
  };
}

function issue(code, path, message) {
  return Object.freeze({ code, path, message });
}

function validateIdentifier(value, path, errors) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    errors.push(issue('invalid-id', path, '1〜64文字の英数字・._-で始まる識別子が必要です。'));
    return false;
  }
  return true;
}

function validateVersion(value, path, errors) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    errors.push(issue('invalid-version', path, '1〜64文字の英数字・._/-で始まる版識別子が必要です。'));
    return false;
  }
  return true;
}

export function validateBoardDataV2(input, options = {}) {
  const profile = options.profile ?? BOARD_PROFILES.STRUCTURAL;
  const requireHash = options.requireHash ?? true;
  const errors = [];
  const warnings = [];

  if (!isPlainObject(input)) {
    return Object.freeze({ valid: false, errors: [issue('invalid-root', '$', '盤面データはオブジェクトである必要があります。')], warnings, computedBoardHash: null, normalized: null });
  }

  if (input.schemaVersion !== BOARD_SCHEMA_VERSION) {
    errors.push(issue('unsupported-schema-version', 'schemaVersion', `schemaVersionは${BOARD_SCHEMA_VERSION}である必要があります。`));
  }
  if (input.rulesVersion !== BOARD_RULES_VERSION) {
    errors.push(issue('unsupported-rules-version', 'rulesVersion', `rulesVersionは${BOARD_RULES_VERSION}である必要があります。`));
  }
  validateVersion(input.generatorVersion, 'generatorVersion', errors);
  validateIdentifier(input.puzzleId, 'puzzleId', errors);

  if (!isIntegerInRange(input.width, 2, 32)) errors.push(issue('invalid-width', 'width', 'widthは2〜32の整数である必要があります。'));
  if (!isIntegerInRange(input.height, 2, 32)) errors.push(issue('invalid-height', 'height', 'heightは2〜32の整数である必要があります。'));

  const collectionNames = ['blocks', 'walls', 'gates', 'lanes', 'shutters'];
  for (const name of collectionNames) {
    if (!Array.isArray(input[name])) errors.push(issue('invalid-array', name, `${name}は配列である必要があります。`));
  }

  if (input.expectedOptimalSwipes !== null && input.expectedOptimalSwipes !== undefined
      && !isIntegerInRange(input.expectedOptimalSwipes, 0, 999)) {
    errors.push(issue('invalid-optimal-swipes', 'expectedOptimalSwipes', 'expectedOptimalSwipesは0〜999の整数またはnullである必要があります。'));
  }

  if (input.boardHash == null || input.boardHash === '') {
    if (requireHash) errors.push(issue('missing-board-hash', 'boardHash', 'boardHashが必要です。'));
  } else if (typeof input.boardHash !== 'string' || !HASH_PATTERN.test(input.boardHash)) {
    errors.push(issue('invalid-board-hash', 'boardHash', 'boardHashはsha256:に続く64桁の小文字16進数である必要があります。'));
  }

  const widthValid = Number.isInteger(input.width);
  const heightValid = Number.isInteger(input.height);
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const walls = Array.isArray(input.walls) ? input.walls : [];
  const gates = Array.isArray(input.gates) ? input.gates : [];
  const lanes = Array.isArray(input.lanes) ? input.lanes : [];
  const shutters = Array.isArray(input.shutters) ? input.shutters : [];

  if (blocks.length < 1 || blocks.length > 64) {
    errors.push(issue('invalid-block-count', 'blocks', 'blocksは1〜64件である必要があります。'));
  }

  const blockIds = new Set();
  const occupiedCells = new Set();
  const colorCounts = new Map();
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const path = `blocks[${index}]`;
    if (!isPlainObject(block)) {
      errors.push(issue('invalid-block', path, 'blockはオブジェクトである必要があります。'));
      continue;
    }
    if (validateIdentifier(block.id, `${path}.id`, errors)) {
      if (blockIds.has(block.id)) errors.push(issue('duplicate-block-id', `${path}.id`, `block id ${block.id}が重複しています。`));
      blockIds.add(block.id);
    }
    if (!Number.isInteger(block.x)) errors.push(issue('invalid-coordinate', `${path}.x`, 'xは整数である必要があります。'));
    if (!Number.isInteger(block.y)) errors.push(issue('invalid-coordinate', `${path}.y`, 'yは整数である必要があります。'));
    if (block.w !== 1 || block.h !== 1) errors.push(issue('unsupported-block-size', path, '現在のrulesVersionでは1×1の箱だけを使用できます。'));
    if (!isIntegerInRange(block.color, 0, 5)) errors.push(issue('invalid-color', `${path}.color`, 'colorは0〜5の整数である必要があります。'));
    else colorCounts.set(block.color, (colorCounts.get(block.color) ?? 0) + 1);

    if (widthValid && heightValid && Number.isInteger(block.x) && Number.isInteger(block.y)) {
      if (block.x < 0 || block.x >= input.width || block.y < 0 || block.y >= input.height) {
        errors.push(issue('block-out-of-bounds', path, '箱の初期位置が盤面外です。'));
      } else {
        const key = cellKey(block.x, block.y);
        if (occupiedCells.has(key)) errors.push(issue('overlapping-blocks', path, `箱の初期位置${key}が重複しています。`));
        occupiedCells.add(key);
      }
    }
  }

  const wallCells = new Set();
  for (let index = 0; index < walls.length; index++) {
    const wall = walls[index];
    const path = `walls[${index}]`;
    if (!isPlainObject(wall)) {
      errors.push(issue('invalid-wall', path, 'wallはオブジェクトである必要があります。'));
      continue;
    }
    if (!Number.isInteger(wall.x) || !Number.isInteger(wall.y)) {
      errors.push(issue('invalid-coordinate', path, '壁座標は整数である必要があります。'));
      continue;
    }
    const key = cellKey(wall.x, wall.y);
    if (widthValid && heightValid && (wall.x < 0 || wall.x >= input.width || wall.y < 0 || wall.y >= input.height)) {
      errors.push(issue('wall-out-of-bounds', path, '壁が盤面外です。'));
    }
    if (wallCells.has(key)) errors.push(issue('duplicate-wall', path, `壁${key}が重複しています。`));
    if (occupiedCells.has(key)) errors.push(issue('wall-block-overlap', path, `壁${key}が箱の初期位置と重なっています。`));
    wallCells.add(key);
  }

  const gateIds = new Set();
  const gateOpenings = new Set();
  const gateColors = new Map();
  for (let index = 0; index < gates.length; index++) {
    const gate = gates[index];
    const path = `gates[${index}]`;
    if (!isPlainObject(gate)) {
      errors.push(issue('invalid-gate', path, 'gateはオブジェクトである必要があります。'));
      continue;
    }
    if (validateIdentifier(gate.id, `${path}.id`, errors)) {
      if (gateIds.has(gate.id)) errors.push(issue('duplicate-gate-id', `${path}.id`, `gate id ${gate.id}が重複しています。`));
      gateIds.add(gate.id);
    }
    if (!SIDES.includes(gate.side)) errors.push(issue('invalid-gate-side', `${path}.side`, 'sideはleft/right/top/bottomのいずれかです。'));
    if (!Number.isInteger(gate.line)) errors.push(issue('invalid-gate-line', `${path}.line`, 'lineは整数である必要があります。'));
    if (!isIntegerInRange(gate.color, 0, 5)) errors.push(issue('invalid-color', `${path}.color`, 'colorは0〜5の整数である必要があります。'));
    else gateColors.set(gate.color, (gateColors.get(gate.color) ?? 0) + 1);

    if (SIDES.includes(gate.side) && Number.isInteger(gate.line) && widthValid && heightValid) {
      const limit = gate.side === 'left' || gate.side === 'right' ? input.height : input.width;
      if (gate.line < 0 || gate.line >= limit) errors.push(issue('gate-out-of-bounds', path, 'gateのlineが盤面範囲外です。'));
      const opening = `${gate.side}:${gate.line}`;
      if (gateOpenings.has(opening)) errors.push(issue('duplicate-gate-opening', path, `搬出口${opening}が重複しています。`));
      gateOpenings.add(opening);
    }
  }

  for (const color of colorCounts.keys()) {
    if ((gateColors.get(color) ?? 0) !== 1) errors.push(issue('gate-count-for-color', 'gates', `使用色${color}には搬出口がちょうど1件必要です。`));
  }
  for (const color of gateColors.keys()) {
    if (!colorCounts.has(color)) errors.push(issue('gate-for-unused-color', 'gates', `未使用色${color}の搬出口があります。`));
  }

  const laneIds = new Set();
  const laneCells = new Set();
  for (let index = 0; index < lanes.length; index++) {
    const lane = lanes[index];
    const path = `lanes[${index}]`;
    if (!isPlainObject(lane)) {
      errors.push(issue('invalid-lane', path, 'laneはオブジェクトである必要があります。'));
      continue;
    }
    if (validateIdentifier(lane.id, `${path}.id`, errors)) {
      if (laneIds.has(lane.id)) errors.push(issue('duplicate-lane-id', `${path}.id`, `lane id ${lane.id}が重複しています。`));
      laneIds.add(lane.id);
    }
    if (!Number.isInteger(lane.x) || !Number.isInteger(lane.y)) errors.push(issue('invalid-coordinate', path, 'lane座標は整数である必要があります。'));
    if (!DIRECTIONS.includes(lane.direction)) errors.push(issue('invalid-lane-direction', `${path}.direction`, 'directionはup/down/left/rightのいずれかです。'));
    if (widthValid && heightValid && Number.isInteger(lane.x) && Number.isInteger(lane.y)) {
      const key = cellKey(lane.x, lane.y);
      if (lane.x < 0 || lane.x >= input.width || lane.y < 0 || lane.y >= input.height) errors.push(issue('lane-out-of-bounds', path, 'laneが盤面外です。'));
      if (laneCells.has(key)) errors.push(issue('duplicate-lane-cell', path, `laneセル${key}が重複しています。`));
      if (wallCells.has(key)) errors.push(issue('lane-wall-overlap', path, `laneセル${key}が壁と重なっています。`));
      laneCells.add(key);
    }
  }

  const shutterIds = new Set();
  const shutterCells = new Set();
  for (let index = 0; index < shutters.length; index++) {
    const shutter = shutters[index];
    const path = `shutters[${index}]`;
    if (!isPlainObject(shutter)) {
      errors.push(issue('invalid-shutter', path, 'shutterはオブジェクトである必要があります。'));
      continue;
    }
    if (validateIdentifier(shutter.id, `${path}.id`, errors)) {
      if (shutterIds.has(shutter.id)) errors.push(issue('duplicate-shutter-id', `${path}.id`, `shutter id ${shutter.id}が重複しています。`));
      shutterIds.add(shutter.id);
    }
    if (!Number.isInteger(shutter.x) || !Number.isInteger(shutter.y)) errors.push(issue('invalid-coordinate', path, 'shutter座標は整数である必要があります。'));
    if (!AXES.includes(shutter.axis)) errors.push(issue('invalid-shutter-axis', `${path}.axis`, 'axisはhorizontal/verticalのいずれかです。'));
    if (!isIntegerInRange(shutter.period, 2, 60)) errors.push(issue('invalid-shutter-period', `${path}.period`, 'periodは2〜60の整数である必要があります。'));
    if (!Array.isArray(shutter.openPhases) || shutter.openPhases.length === 0) {
      errors.push(issue('invalid-open-phases', `${path}.openPhases`, 'openPhasesは1件以上の整数配列である必要があります。'));
    } else {
      const phases = new Set();
      for (let phaseIndex = 0; phaseIndex < shutter.openPhases.length; phaseIndex++) {
        const phase = shutter.openPhases[phaseIndex];
        if (!Number.isInteger(phase) || !Number.isInteger(shutter.period) || phase < 0 || phase >= shutter.period) {
          errors.push(issue('invalid-open-phase', `${path}.openPhases[${phaseIndex}]`, 'open phaseは0以上period未満の整数です。'));
        }
        if (phases.has(phase)) errors.push(issue('duplicate-open-phase', `${path}.openPhases[${phaseIndex}]`, `open phase ${phase}が重複しています。`));
        phases.add(phase);
      }
    }
    if (widthValid && heightValid && Number.isInteger(shutter.x) && Number.isInteger(shutter.y)) {
      const key = cellKey(shutter.x, shutter.y);
      if (shutter.x < 0 || shutter.x >= input.width || shutter.y < 0 || shutter.y >= input.height) errors.push(issue('shutter-out-of-bounds', path, 'shutterが盤面外です。'));
      if (shutterCells.has(key)) errors.push(issue('duplicate-shutter-cell', path, `shutterセル${key}が重複しています。`));
      if (wallCells.has(key)) errors.push(issue('shutter-wall-overlap', path, `shutterセル${key}が壁と重なっています。`));
      shutterCells.add(key);
    }
  }

  if (profile === BOARD_PROFILES.OFFICIAL) {
    if (input.width !== 7 || input.height !== 9) errors.push(issue('official-board-size', '$', '公式候補は7×9である必要があります。'));
    if (blocks.length < 8 || blocks.length > 14) errors.push(issue('official-block-count', 'blocks', '公式候補は8〜14箱である必要があります。'));
    if (colorCounts.size < 3 || colorCounts.size > 6) errors.push(issue('official-color-count', 'blocks', '公式候補は3〜6色である必要があります。'));
    const maxMultiplicity = Math.max(0, ...colorCounts.values());
    if (maxMultiplicity < 2) errors.push(issue('official-same-color-blocks', 'blocks', '公式候補には同色の複数箱が少なくとも1組必要です。'));
    if (!isIntegerInRange(input.expectedOptimalSwipes, 20, 35)) {
      errors.push(issue('official-optimal-swipes', 'expectedOptimalSwipes', '公式候補の厳密最短操作数は20〜35である必要があります。'));
    }
  } else if (profile !== BOARD_PROFILES.STRUCTURAL) {
    errors.push(issue('unknown-profile', '$', `未知の検証profileです: ${profile}`));
  }

  if (shutters.length > 0) warnings.push(issue('runtime-shutters-not-connected', 'shutters', '現行Engineはshuttersをまだ実行できません。Phase 5まで公開盤面へ使用しないでください。'));

  let normalized = null;
  let computedBoardHash = null;
  const nonHashErrors = errors.filter((entry) => !['missing-board-hash', 'invalid-board-hash'].includes(entry.code));
  if (nonHashErrors.length === 0) {
    normalized = normalizeBoardDataV2(input);
    computedBoardHash = computeBoardHash(normalized);
    if (typeof input.boardHash === 'string' && HASH_PATTERN.test(input.boardHash) && input.boardHash !== computedBoardHash) {
      errors.push(issue('board-hash-mismatch', 'boardHash', `boardHashが内容と一致しません。期待値: ${computedBoardHash}`));
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    computedBoardHash,
    normalized,
  });
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function materializeBoardDataV2(draft, options = {}) {
  const result = validateBoardDataV2(draft, { ...options, requireHash: false });
  if (!result.valid) {
    const error = new TypeError(`Invalid HAKODASE board data v2: ${result.errors.map((entry) => `${entry.path} ${entry.code}`).join(', ')}`);
    error.issues = result.errors;
    throw error;
  }
  const materialized = { ...result.normalized, boardHash: result.computedBoardHash };
  return deepFreeze(materialized);
}

export function assertValidBoardDataV2(input, options = {}) {
  const result = validateBoardDataV2(input, options);
  if (!result.valid) {
    const error = new TypeError(`Invalid HAKODASE board data v2: ${result.errors.map((entry) => `${entry.path} ${entry.code}`).join(', ')}`);
    error.issues = result.errors;
    throw error;
  }
  return result.normalized;
}

export function boardDataV2ToRuntime(input, options = {}) {
  const normalized = assertValidBoardDataV2(input, { profile: options.profile ?? BOARD_PROFILES.STRUCTURAL, requireHash: true });
  if (normalized.shutters.length > 0 && options.allowUnsupportedShutters !== true) {
    throw new TypeError('shutters are not supported by the current GameEngine');
  }
  return {
    width: normalized.width,
    height: normalized.height,
    blocks: normalized.blocks.map(cloneBlock),
    walls: new Set(normalized.walls.map((wall) => cellKey(wall.x, wall.y))),
    gates: normalized.gates.map(cloneGate),
    oneway: new Map(normalized.lanes.map((lane) => [cellKey(lane.x, lane.y), lane.direction])),
    shutters: normalized.shutters.map(cloneShutter),
  };
}

function parseRuntimeCell(value, path) {
  const [xText, yText, ...rest] = String(value).split(',');
  const x = Number(xText);
  const y = Number(yText);
  if (rest.length > 0 || !Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError(`Invalid runtime cell at ${path}: ${value}`);
  return { x, y };
}

export function createBoardDataV2FromRuntime(runtimeBoard, metadata = {}, options = {}) {
  if (!isPlainObject(runtimeBoard)) throw new TypeError('runtimeBoard must be an object');
  const walls = runtimeBoard.walls instanceof Set
    ? [...runtimeBoard.walls].map((value, index) => parseRuntimeCell(value, `walls[${index}]`))
    : [];
  const lanes = runtimeBoard.oneway instanceof Map
    ? [...runtimeBoard.oneway.entries()].map(([value, direction], index) => {
      const cell = parseRuntimeCell(value, `oneway[${index}]`);
      return { id: `lane-${cell.x}-${cell.y}`, ...cell, direction };
    })
    : [];
  const draft = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: metadata.rulesVersion ?? BOARD_RULES_VERSION,
    generatorVersion: metadata.generatorVersion,
    puzzleId: metadata.puzzleId,
    boardHash: null,
    width: runtimeBoard.width,
    height: runtimeBoard.height,
    blocks: (runtimeBoard.blocks ?? []).map((block, index) => ({
      id: String(block.id ?? `block-${index + 1}`),
      x: block.x,
      y: block.y,
      w: block.w ?? 1,
      h: block.h ?? 1,
      color: block.color,
    })),
    walls,
    gates: (runtimeBoard.gates ?? []).map((gate) => ({ id: String(gate.id ?? `gate-${gate.side}-${gate.line}-${gate.color}`), side: gate.side, line: gate.line, color: gate.color })),
    lanes,
    shutters: Array.isArray(runtimeBoard.shutters) ? runtimeBoard.shutters.map(cloneShutter) : [],
    expectedOptimalSwipes: metadata.expectedOptimalSwipes ?? null,
  };
  return materializeBoardDataV2(draft, { profile: options.profile ?? BOARD_PROFILES.STRUCTURAL });
}
