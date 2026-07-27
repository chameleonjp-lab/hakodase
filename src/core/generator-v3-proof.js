// P3-03R exact proof for disconnected route templates.
// Each route is isolated by walls, so the global optimum is the exact sum of component optima.

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

function nowDefault() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function routeBlockOffset(template, routeIndex) {
  let offset = 0;
  for (let index = 0; index < routeIndex; index++) offset += template.counts[index];
  return offset;
}

function buildComponentBoard(template, routeIndex) {
  const route = template.routes[routeIndex];
  const count = template.counts[routeIndex];
  const blockOffset = routeBlockOffset(template, routeIndex);
  const openCells = new Set(route.path.map(([x, y]) => `${x},${y}`));
  const blocks = route.path.slice(0, count).map(([x, y], index) => ({
    id: `b${String(blockOffset + index).padStart(2, '0')}`,
    x,
    y,
    w: 1,
    h: 1,
    color: routeIndex,
  }));
  const walls = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!openCells.has(`${x},${y}`)) walls.push({ x, y });
    }
  }
  const lanes = (route.lanes ?? []).map((lane, index) => ({
    id: `l${String(index).padStart(2, '0')}`,
    x: lane.x,
    y: lane.y,
    direction: lane.direction,
  }));

  return materializeBoardDataV2({
    schemaVersion: BOARD_SCHEMA_VERSION,
    rulesVersion: BOARD_RULES_VERSION,
    generatorVersion: GENERATOR_VERSION,
    puzzleId: `proof-${template.id}-r${routeIndex}`,
    boardHash: null,
    width: WIDTH,
    height: HEIGHT,
    blocks,
    walls,
    gates: [{
      id: `g${String(routeIndex).padStart(2, '0')}`,
      side: route.gate.side,
      line: route.gate.line,
      color: routeIndex,
    }],
    lanes,
    shutters: [],
    expectedOptimalSwipes: null,
  }, { profile: BOARD_PROFILES.STRUCTURAL });
}

function failure(reason, startedAt, now, template, metrics = {}) {
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
    decomposed: true,
    componentCount: template.routes.length,
  });
}

export function proveTemplateExactly(template, solverOptions) {
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
    componentCount: template.routes.length,
  });
}
