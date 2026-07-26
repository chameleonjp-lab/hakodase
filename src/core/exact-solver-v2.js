// HAKODASE P3-02 厳密最短操作ソルバー。
// 同色箱のID交換を同一状態として圧縮し、開発時・候補検査時だけ使用する。
// 公開ゲームの開始処理や描画ループからは呼ばない。

import { boardDataV2ToRuntime } from './board-data-v2.js';

const EXIT_CELL = 255;
const DIRECTIONS = Object.freeze([
  Object.freeze({ name: 'up', dx: 0, dy: -1, code: 0 }),
  Object.freeze({ name: 'down', dx: 0, dy: 1, code: 1 }),
  Object.freeze({ name: 'left', dx: -1, dy: 0, code: 2 }),
  Object.freeze({ name: 'right', dx: 1, dy: 0, code: 3 }),
]);
const DIRECTION_CODE = Object.freeze({ up: 0, down: 1, left: 2, right: 3 });

export const EXACT_SOLVER_V2_DEFAULTS = Object.freeze({
  maxNodes: 2_000_000,
  maxStates: 2_000_000,
  maxDepth: 40,
  timeoutMs: 10_000,
  timeCheckInterval: 1024,
});

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function readLimit(value, fallback, name, { allowZero = false } = {}) {
  const resolved = value ?? fallback;
  const minimum = allowZero ? 0 : 1;
  if (!Number.isFinite(resolved) || !Number.isInteger(resolved) || resolved < minimum) {
    throw new TypeError(`${name} must be an integer >= ${minimum}`);
  }
  return resolved;
}

function failure(reason, startedAt, now, metrics = {}) {
  return Object.freeze({
    solved: false,
    exact: reason === 'exhausted',
    optimalSwipes: null,
    solution: Object.freeze([]),
    reason,
    durationMs: Math.max(0, now() - startedAt),
    nodesExpanded: metrics.nodesExpanded ?? 0,
    movesGenerated: metrics.movesGenerated ?? 0,
    uniqueStates: metrics.uniqueStates ?? 0,
    frontierPeak: metrics.frontierPeak ?? 0,
    lowerBound: metrics.lowerBound ?? null,
    symmetryReduced: metrics.symmetryReduced ?? true,
  });
}

function parseCellKey(value, path) {
  const parts = String(value).split(',');
  if (parts.length !== 2) throw new TypeError(`Invalid cell at ${path}: ${value}`);
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError(`Invalid cell at ${path}: ${value}`);
  return { x, y };
}

function compileRuntimeBoard(runtimeBoard) {
  if (!runtimeBoard || typeof runtimeBoard !== 'object') throw new TypeError('runtimeBoard must be an object');
  const width = runtimeBoard.width;
  const height = runtimeBoard.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new TypeError('runtimeBoard width/height must be integers >= 2');
  }

  const cellCount = width * height;
  if (cellCount >= EXIT_CELL) throw new RangeError('exact solver v2 supports at most 254 cells');
  const blocks = Array.isArray(runtimeBoard.blocks) ? runtimeBoard.blocks : [];
  if (blocks.length < 1 || blocks.length > 64) throw new TypeError('runtimeBoard blocks must contain 1..64 entries');
  if (runtimeBoard.shutters?.length) {
    throw new TypeError('exact solver v2 does not support shutters for rulesVersion slide-exit/1');
  }

  const walls = new Uint8Array(cellCount);
  if (runtimeBoard.walls instanceof Set) {
    let index = 0;
    for (const entry of runtimeBoard.walls) {
      const { x, y } = parseCellKey(entry, `walls[${index++}]`);
      if (x < 0 || x >= width || y < 0 || y >= height) throw new TypeError(`wall out of bounds: ${entry}`);
      walls[y * width + x] = 1;
    }
  }

  const lanes = new Int8Array(cellCount);
  lanes.fill(-1);
  if (runtimeBoard.oneway instanceof Map) {
    let index = 0;
    for (const [entry, direction] of runtimeBoard.oneway.entries()) {
      const { x, y } = parseCellKey(entry, `oneway[${index++}]`);
      const code = DIRECTION_CODE[direction];
      if (code === undefined) throw new TypeError(`invalid lane direction: ${direction}`);
      if (x < 0 || x >= width || y < 0 || y >= height) throw new TypeError(`lane out of bounds: ${entry}`);
      lanes[y * width + x] = code;
    }
  }

  const ids = [];
  const idSet = new Set();
  const colors = new Uint8Array(blocks.length);
  const start = new Uint8Array(blocks.length);
  const occupied = new Set();
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const id = String(block.id ?? `block-${index + 1}`);
    if (idSet.has(id)) throw new TypeError(`duplicate block id: ${id}`);
    if (!Number.isInteger(block.x) || !Number.isInteger(block.y)
        || block.x < 0 || block.x >= width || block.y < 0 || block.y >= height) {
      throw new TypeError(`block ${id} out of bounds`);
    }
    if (!Number.isInteger(block.color) || block.color < 0 || block.color > 255) {
      throw new TypeError(`invalid color for ${id}`);
    }
    const cell = block.y * width + block.x;
    if (walls[cell]) throw new TypeError(`block ${id} overlaps wall`);
    if (occupied.has(cell)) throw new TypeError(`block overlap at ${block.x},${block.y}`);
    occupied.add(cell);
    idSet.add(id);
    ids.push(id);
    colors[index] = block.color;
    start[index] = cell;
  }

  const gateByColor = new Map();
  const gateByExit = new Map();
  for (const gate of runtimeBoard.gates ?? []) {
    if (!gate || !['left', 'right', 'top', 'bottom'].includes(gate.side)
        || !Number.isInteger(gate.line) || !Number.isInteger(gate.color)) {
      throw new TypeError('invalid gate');
    }
    const limit = gate.side === 'left' || gate.side === 'right' ? height : width;
    if (gate.line < 0 || gate.line >= limit) throw new TypeError('gate line out of bounds');
    if (gateByColor.has(gate.color)) throw new TypeError(`multiple gates for color ${gate.color}`);
    const direction = gate.side === 'left' ? 'left'
      : gate.side === 'right' ? 'right'
        : gate.side === 'top' ? 'up' : 'down';
    const exitKey = `${direction}:${gate.line}`;
    if (gateByExit.has(exitKey)) throw new TypeError(`duplicate gate opening ${exitKey}`);
    const compiledGate = { side: gate.side, line: gate.line, color: gate.color, direction };
    gateByColor.set(gate.color, compiledGate);
    gateByExit.set(exitKey, gate.color);
  }
  for (const color of new Set(colors)) {
    if (!gateByColor.has(color)) throw new TypeError(`missing gate for color ${color}`);
  }

  const groupsMap = new Map();
  for (let index = 0; index < colors.length; index++) {
    const color = colors[index];
    if (!groupsMap.has(color)) groupsMap.set(color, []);
    groupsMap.get(color).push(index);
  }
  const groups = [...groupsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([color, indices]) => ({ color, indices }));

  return { width, height, cellCount, walls, lanes, ids, colors, start, gateByColor, gateByExit, groups };
}

function stateKey(state, compiled, symmetryReduced) {
  if (!symmetryReduced) return String.fromCharCode(...state);
  const codes = [];
  for (const group of compiled.groups) {
    const values = group.indices.map((index) => state[index]).sort((a, b) => a - b);
    codes.push(...values);
  }
  return String.fromCharCode(...codes);
}

export function canonicalStateKeyV2(runtimeBoard, positions, options = {}) {
  const compiled = compileRuntimeBoard(runtimeBoard);
  if (!Array.isArray(positions) || positions.length !== compiled.ids.length) {
    throw new TypeError('positions length must match blocks');
  }
  const state = new Uint8Array(positions.length);
  for (let index = 0; index < positions.length; index++) {
    const position = positions[index];
    if (position == null) {
      state[index] = EXIT_CELL;
      continue;
    }
    const x = Number.isInteger(position) ? position % compiled.width : position.x;
    const y = Number.isInteger(position) ? Math.floor(position / compiled.width) : position.y;
    if (!Number.isInteger(x) || !Number.isInteger(y)
        || x < 0 || x >= compiled.width || y < 0 || y >= compiled.height) {
      throw new TypeError(`invalid position at index ${index}`);
    }
    state[index] = y * compiled.width + x;
  }
  return stateKey(state, compiled, options.symmetryReduced !== false);
}

function buildOccupancy(state, occupancy) {
  occupancy.fill(-1);
  for (let index = 0; index < state.length; index++) {
    const cell = state[index];
    if (cell !== EXIT_CELL) occupancy[cell] = index;
  }
}

function slide(compiled, state, occupancy, blockIndex, direction) {
  const startCell = state[blockIndex];
  if (startCell === EXIT_CELL) return null;
  const startLane = compiled.lanes[startCell];
  if (startLane !== -1 && startLane !== direction.code) return null;

  let x = startCell % compiled.width;
  let y = Math.floor(startCell / compiled.width);
  let steps = 0;
  for (;;) {
    const nextX = x + direction.dx;
    const nextY = y + direction.dy;
    if (nextX < 0 || nextX >= compiled.width || nextY < 0 || nextY >= compiled.height) {
      const line = direction.name === 'left' || direction.name === 'right' ? y : x;
      const gateColor = compiled.gateByExit.get(`${direction.name}:${line}`);
      if (gateColor === compiled.colors[blockIndex]) {
        return { cell: EXIT_CELL, steps: steps + 1, exit: true };
      }
      break;
    }

    const nextCell = nextY * compiled.width + nextX;
    if (compiled.walls[nextCell]) break;
    if (occupancy[nextCell] !== -1 && occupancy[nextCell] !== blockIndex) break;
    const lane = compiled.lanes[nextCell];
    if (lane !== -1 && lane !== direction.code) break;
    x = nextX;
    y = nextY;
    steps++;
  }

  if (steps === 0) return null;
  return { cell: y * compiled.width + x, steps, exit: false };
}

function isCleared(state) {
  for (const cell of state) if (cell !== EXIT_CELL) return false;
  return true;
}

function remainingLowerBound(state, compiled) {
  let bound = 0;
  for (let index = 0; index < state.length; index++) {
    const cell = state[index];
    if (cell === EXIT_CELL) continue;
    const gate = compiled.gateByColor.get(compiled.colors[index]);
    const x = cell % compiled.width;
    const y = Math.floor(cell / compiled.width);
    const aligned = gate.side === 'left' || gate.side === 'right' ? y === gate.line : x === gate.line;
    bound += aligned ? 1 : 2;
  }
  return bound;
}

function reconstructSolution(goalIndex, parents, moves) {
  const solution = [];
  for (let index = goalIndex; parents[index] !== -1; index = parents[index]) solution.push(moves[index]);
  solution.reverse();
  return Object.freeze(solution.map((move) => Object.freeze({
    ...move,
    from: Object.freeze({ ...move.from }),
  })));
}

export function solveRuntimeBoardExactV2(runtimeBoard, options = {}) {
  const compiled = compileRuntimeBoard(runtimeBoard);
  const now = typeof options.now === 'function' ? options.now : defaultNow;
  const startedAt = now();
  const maxNodes = readLimit(options.maxNodes, EXACT_SOLVER_V2_DEFAULTS.maxNodes, 'maxNodes', { allowZero: true });
  const maxStates = readLimit(options.maxStates, EXACT_SOLVER_V2_DEFAULTS.maxStates, 'maxStates');
  const maxDepth = readLimit(options.maxDepth, EXACT_SOLVER_V2_DEFAULTS.maxDepth, 'maxDepth', { allowZero: true });
  const timeoutMs = readLimit(options.timeoutMs, EXACT_SOLVER_V2_DEFAULTS.timeoutMs, 'timeoutMs', { allowZero: true });
  const timeCheckInterval = readLimit(options.timeCheckInterval, EXACT_SOLVER_V2_DEFAULTS.timeCheckInterval, 'timeCheckInterval');
  const symmetryReduced = options.symmetryReduced !== false;
  const signal = options.signal ?? null;
  const start = compiled.start.slice();
  const lowerBound = remainingLowerBound(start, compiled);
  if (lowerBound > maxDepth) return failure('maxDepth', startedAt, now, { lowerBound, symmetryReduced });

  const states = [start];
  const depths = [0];
  const parents = [-1];
  const moves = [null];
  const seen = new Map([[stateKey(start, compiled, symmetryReduced), 0]]);
  const occupancy = new Int16Array(compiled.cellCount);
  let head = 0;
  let nodesExpanded = 0;
  let movesGenerated = 0;
  let frontierPeak = 1;
  let depthLimited = false;

  while (head < states.length) {
    const metrics = { nodesExpanded, movesGenerated, uniqueStates: states.length, frontierPeak, lowerBound, symmetryReduced };
    if (signal?.aborted) return failure('aborted', startedAt, now, metrics);
    if (nodesExpanded >= maxNodes) return failure('maxNodes', startedAt, now, metrics);
    if (nodesExpanded % timeCheckInterval === 0 && now() - startedAt > timeoutMs) {
      return failure('timeout', startedAt, now, metrics);
    }

    const state = states[head];
    const depth = depths[head];
    if (depth >= maxDepth) {
      depthLimited = true;
      head++;
      nodesExpanded++;
      continue;
    }

    buildOccupancy(state, occupancy);
    for (let blockIndex = 0; blockIndex < state.length; blockIndex++) {
      if (state[blockIndex] === EXIT_CELL) continue;
      for (const direction of DIRECTIONS) {
        const result = slide(compiled, state, occupancy, blockIndex, direction);
        if (!result) continue;
        movesGenerated++;

        const next = state.slice();
        const fromCell = state[blockIndex];
        next[blockIndex] = result.cell;
        const nextDepth = depth + 1;
        const nextLowerBound = remainingLowerBound(next, compiled);
        if (!isCleared(next) && nextDepth + nextLowerBound > maxDepth) {
          depthLimited = true;
          continue;
        }

        const key = stateKey(next, compiled, symmetryReduced);
        if (seen.has(key)) continue;
        const from = { x: fromCell % compiled.width, y: Math.floor(fromCell / compiled.width) };
        const move = {
          blockIndex,
          blockId: compiled.ids[blockIndex],
          color: compiled.colors[blockIndex],
          from,
          direction: direction.name,
          steps: result.steps,
          exit: result.exit,
        };

        if (isCleared(next)) {
          const goalIndex = states.length;
          states.push(next);
          depths.push(nextDepth);
          parents.push(head);
          moves.push(move);
          const solution = reconstructSolution(goalIndex, parents, moves);
          return Object.freeze({
            solved: true,
            exact: true,
            optimalSwipes: solution.length,
            solution,
            reason: 'solved',
            durationMs: Math.max(0, now() - startedAt),
            nodesExpanded: nodesExpanded + 1,
            movesGenerated,
            uniqueStates: states.length,
            frontierPeak: Math.max(frontierPeak, states.length - head - 1),
            lowerBound,
            symmetryReduced,
          });
        }

        if (states.length >= maxStates) {
          return failure('maxStates', startedAt, now, {
            nodesExpanded,
            movesGenerated,
            uniqueStates: states.length,
            frontierPeak,
            lowerBound,
            symmetryReduced,
          });
        }
        const nextIndex = states.length;
        states.push(next);
        depths.push(nextDepth);
        parents.push(head);
        moves.push(move);
        seen.set(key, nextIndex);
      }
    }

    head++;
    nodesExpanded++;
    frontierPeak = Math.max(frontierPeak, states.length - head);
  }

  return failure(depthLimited ? 'maxDepth' : 'exhausted', startedAt, now, {
    nodesExpanded,
    movesGenerated,
    uniqueStates: states.length,
    frontierPeak,
    lowerBound,
    symmetryReduced,
  });
}

export function solveBoardDataV2(boardData, options = {}) {
  const runtimeBoard = boardDataV2ToRuntime(boardData, {
    profile: options.profile,
    allowUnsupportedShutters: false,
  });
  return solveRuntimeBoardExactV2(runtimeBoard, options);
}

export function verifyExactSolutionV2(runtimeBoard, solution) {
  const compiled = compileRuntimeBoard(runtimeBoard);
  if (!Array.isArray(solution)) throw new TypeError('solution must be an array');
  const state = compiled.start.slice();
  const occupancy = new Int16Array(compiled.cellCount);

  for (let stepIndex = 0; stepIndex < solution.length; stepIndex++) {
    const action = solution[stepIndex];
    const blockIndex = compiled.ids.indexOf(action.blockId);
    if (blockIndex < 0 || state[blockIndex] === EXIT_CELL) {
      return Object.freeze({ valid: false, cleared: false, failedAt: stepIndex, reason: 'block' });
    }
    const fromCell = state[blockIndex];
    const direction = DIRECTIONS.find((entry) => entry.name === action.direction);
    if (!direction) return Object.freeze({ valid: false, cleared: false, failedAt: stepIndex, reason: 'direction' });

    buildOccupancy(state, occupancy);
    const result = slide(compiled, state, occupancy, blockIndex, direction);
    if (!result) return Object.freeze({ valid: false, cleared: false, failedAt: stepIndex, reason: 'illegal' });
    if (action.from && (action.from.x !== fromCell % compiled.width
        || action.from.y !== Math.floor(fromCell / compiled.width))) {
      return Object.freeze({ valid: false, cleared: false, failedAt: stepIndex, reason: 'from' });
    }
    if (action.steps != null && action.steps !== result.steps) {
      return Object.freeze({ valid: false, cleared: false, failedAt: stepIndex, reason: 'steps' });
    }
    if (action.exit != null && action.exit !== result.exit) {
      return Object.freeze({ valid: false, cleared: false, failedAt: stepIndex, reason: 'exit' });
    }
    state[blockIndex] = result.cell;
  }

  return Object.freeze({ valid: true, cleared: isCleared(state), failedAt: null, reason: null });
}

export function validateExpectedOptimalSwipesV2(boardData, options = {}) {
  const result = solveBoardDataV2(boardData, options);
  const expected = boardData.expectedOptimalSwipes;
  return Object.freeze({
    ...result,
    expectedOptimalSwipes: expected,
    matchesExpected: result.solved && Number.isInteger(expected) && result.optimalSwipes === expected,
  });
}
