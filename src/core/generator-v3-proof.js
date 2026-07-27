// P3-03R exact proof for verified route templates.
// Geometrically isolated routes are proved component-by-component. Templates with
// cross-route adjacency are proved as one full board with the P3-02 exact solver.

import {
  BOARD_PROFILES,
  BOARD_RULES_VERSION,
  BOARD_SCHEMA_VERSION,
  materializeBoardDataV2,
} from './board-data-v2.js';
import { solveBoardDataV2 } from './exact-solver-v2.js';

const WIDTH = 7;
const HEIGHT = 9;
const GENERATOR_VERSION = 'route-catalog/3.0.0';
const CARDINALS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

function nowDefault() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function routeBlockOffset(template, routeIndex) {
  let offset = 0;
  for (let index = 0; index < routeIndex; index++) offset += template.counts[index];
  return offset;
}

function routeBlocks(template, routeIndex) {
  const route = template.routes[routeIndex];
  const count = template.counts[routeIndex];
  const blockOffset = routeBlockOffset(template, routeIndex);
  return route.path.slice(0, count).map(([x, y], index) => ({
    id: `b${String(blockOffset + index).padStart(2, '0')}`,
    x,
    y,
    w: 1,
    h: 1,
    color: routeIndex,
  }));
}

function wallsOutside(openCells) {
  const walls = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!openCells.has(`${x},${y}`)) walls.push({ x, y });
    }
  }
  return walls;
}

function materializeProofBoard(template, suffix, blocks, openCells, gates, lanes) {
  return materializeBoardDataV2({
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: BOARD_RULES_VERSION,
    generatorVersion: GENERATOR_VERSION,
    puzzleId: `proof-${template.id}-${suffix}`,
    boardHash: null,
    width: WIDTH,
    height: HEIGHT,
    blocks,
    walls: wallsOutside(openCells),
    gates,
    lanes,
    shutters: [],
    expectedOptimalSwipes: null,
  }, { profile: BOARD_PROFILES.STRUCTURAL });
}

function buildComponentBoard(template, routeIndex) {
  const route = template.routes[routeIndex];
  const openCells = new Set(route.path.map(([x, y]) => `${x},${y}`));
  const lanes = (route.lanes ?? []).map((lane, index) => ({
    id: `l${String(index).padStart(2, '0')}`,
    x: lane.x,
    y: lane.y,
    direction: lane.direction,
  }));
  return materializeProofBoard(
    template,
    `r${routeIndex}`,
    routeBlocks(template, routeIndex),
    openCells,
    [{
      id: `g${String(routeIndex).padStart(2, '0')}`,
      side: route.gate.side,
      line: route.gate.line,
      color: routeIndex,
    }],
    lanes,
  );
}

function buildFullBoard(template) {
  const blocks = [];
  const gates = [];
  const openCells = new Set();
  const laneByCell = new Map();

  template.routes.forEach((route, routeIndex) => {
    for (const [x, y] of route.path) openCells.add(`${x},${y}`);
    blocks.push(...routeBlocks(template, routeIndex));
    gates.push({
      id: `g${String(routeIndex).padStart(2, '0')}`,
      side: route.gate.side,
      line: route.gate.line,
      color: routeIndex,
    });
    for (const lane of route.lanes ?? []) {
      const cell = `${lane.x},${lane.y}`;
      const previous = laneByCell.get(cell);
      if (previous && previous !== lane.direction) {
        throw new TypeError(`template ${template.id} has conflicting lane at ${cell}`);
      }
      laneByCell.set(cell, lane.direction);
    }
  });

  const lanes = [...laneByCell.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([cell, direction], index) => {
      const [x, y] = cell.split(',').map(Number);
      return { id: `l${String(index).padStart(2, '0')}`, x, y, direction };
    });
  return materializeProofBoard(template, 'global', blocks, openCells, gates, lanes);
}

function routesAreGeometricallyIsolated(template) {
  const ownerByCell = new Map();
  for (let routeIndex = 0; routeIndex < template.routes.length; routeIndex++) {
    for (const [x, y] of template.routes[routeIndex].path) {
      const cell = `${x},${y}`;
      const previous = ownerByCell.get(cell);
      if (previous != null && previous !== routeIndex) return false;
      ownerByCell.set(cell, routeIndex);
    }
  }

  for (const [cell, routeIndex] of ownerByCell) {
    const [x, y] = cell.split(',').map(Number);
    for (const [dx, dy] of CARDINALS) {
      const adjacentOwner = ownerByCell.get(`${x + dx},${y + dy}`);
      if (adjacentOwner != null && adjacentOwner !== routeIndex) return false;
    }
  }
  return true;
}

function failure(reason, startedAt, now, template, metrics = {}, proofMode = 'components') {
  return Object.freeze({
    solved: false,
    exact: false,
    optimalSwipes: null,
    solution: Object.freeze([]),
    reason,
    durationMs: Math.max(0, now() - startedAt),
    nodesExpanded: metrics.nodesExpanded ?? 0,
    movesGenerated: metrics.movesGenerated ?? 0,
    uniqueStates: metrics.uniqueStates ?? 0,
    frontierPeak: metrics.frontierPeak ?? 0,
    lowerBound: metrics.lowerBound ?? null,
    symmetryReduced: true,
    decomposed: proofMode === 'components',
    proofMode,
    componentCount: template.routes.length,
  });
}

function proveFullBoard(template, solverOptions) {
  const result = solveBoardDataV2(buildFullBoard(template), solverOptions);
  return Object.freeze({
    ...result,
    decomposed: false,
    proofMode: 'global',
    componentCount: template.routes.length,
  });
}

function proveIsolatedComponents(template, solverOptions) {
  const now = typeof solverOptions.now === 'function' ? solverOptions.now : nowDefault;
  const startedAt = now();
  const maxNodes = solverOptions.maxNodes;
  const maxStates = solverOptions.maxStates;
  const maxDepth = solverOptions.maxDepth;
  const timeoutMs = solverOptions.timeoutMs;

  if (template.expectedOptimalSwipes > maxDepth) {
    return failure('maxDepth', startedAt, now, template, { lowerBound: template.expectedOptimalSwipes });
  }

  const solution = [];
  let nodesExpanded = 0;
  let movesGenerated = 0;
  let uniqueStates = 0;
  let frontierPeak = 0;
  let lowerBound = 0;

  for (let routeIndex = 0; routeIndex < template.routes.length; routeIndex++) {
    const remainingNodes = maxNodes - nodesExpanded;
    const remainingStates = maxStates - uniqueStates;
    const remainingTimeout = Math.max(0, Math.floor(timeoutMs - (now() - startedAt)));
    if (remainingNodes <= 0) return failure('maxNodes', startedAt, now, template, { nodesExpanded, movesGenerated, uniqueStates, frontierPeak, lowerBound });
    if (remainingStates <= 0) return failure('maxStates', startedAt, now, template, { nodesExpanded, movesGenerated, uniqueStates, frontierPeak, lowerBound });
    if (remainingTimeout <= 0) return failure('timeout', startedAt, now, template, { nodesExpanded, movesGenerated, uniqueStates, frontierPeak, lowerBound });

    const component = solveBoardDataV2(buildComponentBoard(template, routeIndex), {
      ...solverOptions,
      maxNodes: remainingNodes,
      maxStates: remainingStates,
      maxDepth: maxDepth - solution.length,
      timeoutMs: remainingTimeout,
      now,
    });
    nodesExpanded += component.nodesExpanded;
    movesGenerated += component.movesGenerated;
    uniqueStates += component.uniqueStates;
    frontierPeak = Math.max(frontierPeak, component.frontierPeak);
    lowerBound += component.lowerBound ?? 0;

    if (!component.solved || !component.exact) {
      return failure(component.reason, startedAt, now, template, {
        nodesExpanded, movesGenerated, uniqueStates, frontierPeak, lowerBound,
      });
    }
    solution.push(...component.solution);
  }

  return Object.freeze({
    solved: true,
    exact: true,
    optimalSwipes: solution.length,
    solution: Object.freeze(solution),
    reason: 'solved',
    durationMs: Math.max(0, now() - startedAt),
    nodesExpanded,
    movesGenerated,
    uniqueStates,
    frontierPeak,
    lowerBound,
    symmetryReduced: true,
    decomposed: true,
    proofMode: 'components',
    componentCount: template.routes.length,
  });
}

export function proveTemplateExactly(template, solverOptions) {
  return routesAreGeometricallyIsolated(template)
    ? proveIsolatedComponents(template, solverOptions)
    : proveFullBoard(template, solverOptions);
}

export function templateUsesGlobalProof(template) {
  return !routesAreGeometricallyIsolated(template);
}
