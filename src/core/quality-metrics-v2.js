// HAKODASE P3-04 候補品質指標。
// 盤面データv2とP3-02の代表解法を読み取り、分岐・直行・壁利用・誤手/詰み・反復・偏りを数値化する。
// 開発時と候補検査時専用。公開ゲームの描画ループからは呼ばない。

import { boardDataV2ToRuntime } from './board-data-v2.js';
import { canonicalJson, sha256Hex } from './board-hash.js';
import {
  DIRECTIONS,
  DIR_NAMES,
  applySlide,
  computeSlide,
  isCleared,
  key,
  occupantAt,
  onewayDirAt,
} from './rules.js';

const STRUCTURE_TRANSFORMS = Object.freeze(['identity', 'mirrorX', 'mirrorY', 'rotate180']);
const SIDE_ORDER = Object.freeze({ left: 0, right: 1, top: 2, bottom: 3 });

export const P3_04_SCREENING_RULES = Object.freeze({
  maxInitialDirectExitBlocks: 0,
  minInitialLegalActions: 2,
  minDecisionStepRate: 0.25,
  minWallUtilizationRate: 0.05,
  maxSameBlockRepeatRate: 0.55,
  maxDominantDirectionRate: 0.70,
  maxDominantColorRate: 0.70,
});

function clampRate(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

function histogramDominantRate(histogram, total) {
  if (total <= 0) return 0;
  let max = 0;
  for (const value of Object.values(histogram)) max = Math.max(max, value);
  return max / total;
}

function sortedHistogram(histogram) {
  return Object.freeze(Object.fromEntries(
    Object.entries(histogram).sort(([left], [right]) => left.localeCompare(right, 'en')),
  ));
}

function transformPoint(transform, width, height, x, y) {
  if (transform === 'mirrorX') return { x: width - 1 - x, y };
  if (transform === 'mirrorY') return { x, y: height - 1 - y };
  if (transform === 'rotate180') return { x: width - 1 - x, y: height - 1 - y };
  return { x, y };
}

function transformGate(transform, width, height, gate) {
  if (transform === 'mirrorX') {
    if (gate.side === 'left') return { side: 'right', line: gate.line, color: gate.color };
    if (gate.side === 'right') return { side: 'left', line: gate.line, color: gate.color };
    return { side: gate.side, line: width - 1 - gate.line, color: gate.color };
  }
  if (transform === 'mirrorY') {
    if (gate.side === 'top') return { side: 'bottom', line: gate.line, color: gate.color };
    if (gate.side === 'bottom') return { side: 'top', line: gate.line, color: gate.color };
    return { side: gate.side, line: height - 1 - gate.line, color: gate.color };
  }
  if (transform === 'rotate180') {
    if (gate.side === 'left') return { side: 'right', line: height - 1 - gate.line, color: gate.color };
    if (gate.side === 'right') return { side: 'left', line: height - 1 - gate.line, color: gate.color };
    if (gate.side === 'top') return { side: 'bottom', line: width - 1 - gate.line, color: gate.color };
    return { side: 'top', line: width - 1 - gate.line, color: gate.color };
  }
  return { side: gate.side, line: gate.line, color: gate.color };
}

function transformDirection(transform, direction) {
  if (transform === 'mirrorX') {
    if (direction === 'left') return 'right';
    if (direction === 'right') return 'left';
    return direction;
  }
  if (transform === 'mirrorY') {
    if (direction === 'up') return 'down';
    if (direction === 'down') return 'up';
    return direction;
  }
  if (transform === 'rotate180') {
    if (direction === 'left') return 'right';
    if (direction === 'right') return 'left';
    if (direction === 'up') return 'down';
    if (direction === 'down') return 'up';
  }
  return direction;
}

function compareGateGeometry(left, right) {
  return SIDE_ORDER[left.side] - SIDE_ORDER[right.side] || left.line - right.line;
}

function canonicalStructurePayload(boardData, transform) {
  if (boardData.shutters?.length) {
    throw new TypeError('P3-04 structural fingerprint does not support shutters');
  }

  const width = boardData.width;
  const height = boardData.height;
  const gates = boardData.gates
    .map((gate) => transformGate(transform, width, height, gate))
    .sort(compareGateGeometry);
  const colorMap = new Map(gates.map((gate, index) => [gate.color, index]));

  const blocks = boardData.blocks.map((block) => {
    const point = transformPoint(transform, width, height, block.x, block.y);
    return {
      x: point.x,
      y: point.y,
      w: block.w,
      h: block.h,
      color: colorMap.get(block.color),
    };
  }).sort((left, right) => (
    left.color - right.color || left.y - right.y || left.x - right.x
  ));

  const walls = boardData.walls.map((wall) => {
    const point = transformPoint(transform, width, height, wall.x, wall.y);
    return { x: point.x, y: point.y };
  }).sort((left, right) => left.y - right.y || left.x - right.x);

  const canonicalGates = gates.map((gate) => ({
    side: gate.side,
    line: gate.line,
    color: colorMap.get(gate.color),
  })).sort((left, right) => (
    left.color - right.color || compareGateGeometry(left, right)
  ));

  const lanes = (boardData.lanes ?? []).map((lane) => {
    const point = transformPoint(transform, width, height, lane.x, lane.y);
    return {
      x: point.x,
      y: point.y,
      direction: transformDirection(transform, lane.direction),
    };
  }).sort((left, right) => (
    left.y - right.y || left.x - right.x || left.direction.localeCompare(right.direction, 'en')
  ));

  return {
    rulesVersion: boardData.rulesVersion,
    width,
    height,
    blocks,
    walls,
    gates: canonicalGates,
    lanes,
  };
}

export function canonicalStructureJsonV2(boardData) {
  const variants = STRUCTURE_TRANSFORMS.map((transform) => (
    canonicalJson(canonicalStructurePayload(boardData, transform))
  ));
  variants.sort();
  return variants[0];
}

export function computeStructureHashV2(boardData) {
  return `sha256:${sha256Hex(canonicalStructureJsonV2(boardData))}`;
}

export function enumerateLegalActionsV2(runtimeBoard, positions) {
  const actions = [];
  for (let blockIndex = 0; blockIndex < runtimeBoard.blocks.length; blockIndex++) {
    if (!positions[blockIndex]) continue;
    for (const direction of DIR_NAMES) {
      const result = computeSlide(runtimeBoard, positions, blockIndex, direction);
      if (!result.legal) continue;
      actions.push(Object.freeze({
        blockIndex,
        blockId: String(runtimeBoard.blocks[blockIndex].id),
        color: runtimeBoard.blocks[blockIndex].color,
        direction,
        steps: result.steps,
        exit: result.exit,
      }));
    }
  }
  return Object.freeze(actions);
}

function countActiveWalls(runtimeBoard) {
  let count = 0;
  for (const entry of runtimeBoard.walls ?? []) {
    const [x, y] = String(entry).split(',').map(Number);
    let adjacentOpen = false;
    for (const direction of Object.values(DIRECTIONS)) {
      const nextX = x + direction.dx;
      const nextY = y + direction.dy;
      if (nextX < 0 || nextX >= runtimeBoard.width || nextY < 0 || nextY >= runtimeBoard.height) continue;
      if (!runtimeBoard.walls.has(key(nextX, nextY))) {
        adjacentOpen = true;
        break;
      }
    }
    if (adjacentOpen) count++;
  }
  return count;
}

function stopReason(runtimeBoard, positionsAfter, blockIndex, direction, exit) {
  if (exit) return { reason: 'exit', wallKey: null };
  const position = positionsAfter[blockIndex];
  const vector = DIRECTIONS[direction];
  const nextX = position.x + vector.dx;
  const nextY = position.y + vector.dy;

  if (nextX < 0 || nextX >= runtimeBoard.width || nextY < 0 || nextY >= runtimeBoard.height) {
    return { reason: 'edge', wallKey: null };
  }
  const nextKey = key(nextX, nextY);
  if (runtimeBoard.walls?.has(nextKey)) return { reason: 'wall', wallKey: nextKey };
  if (occupantAt(positionsAfter, nextX, nextY, blockIndex) !== -1) return { reason: 'block', wallKey: null };
  const lane = onewayDirAt(runtimeBoard, nextX, nextY);
  if (lane && lane !== direction) return { reason: 'lane', wallKey: null };
  return { reason: 'unknown', wallKey: null };
}

function actionMatchesSolution(action, expected) {
  return action.blockId === String(expected.blockId) && action.direction === expected.direction;
}

function freezeMetricObject(value) {
  for (const [keyName, child] of Object.entries(value)) {
    if (Array.isArray(child)) Object.freeze(child);
    else if (child && typeof child === 'object' && !Object.isFrozen(child)) Object.freeze(child);
    void keyName;
  }
  return Object.freeze(value);
}

export function analyzeCandidateQualityV2(boardData, solution) {
  if (!Array.isArray(solution) || solution.length === 0) {
    throw new TypeError('solution must be a non-empty array');
  }

  const runtimeBoard = boardDataV2ToRuntime(boardData);
  let positions = runtimeBoard.blocks.map((block) => ({ x: block.x, y: block.y }));
  const initialActions = enumerateLegalActionsV2(runtimeBoard, positions);
  const initialDirectExitBlocks = new Set(initialActions.filter((action) => action.exit).map((action) => action.blockId));
  const initialMovableBlocks = new Set(initialActions.map((action) => action.blockId));

  const activeWallCount = countActiveWalls(runtimeBoard);
  const usedWalls = new Set();
  const branchingByStep = [];
  const directionHistogram = Object.fromEntries(DIR_NAMES.map((direction) => [direction, 0]));
  const colorHistogram = {};
  const stopHistogram = { exit: 0, wall: 0, block: 0, lane: 0, edge: 0, unknown: 0 };
  const movedBlocks = new Set();
  const movedColors = new Set();

  let totalLegalActions = 0;
  let decisionStepCount = 0;
  let forcedStepCount = 0;
  let offRouteAlternativeCount = 0;
  let immediateDeadEndAlternativeCount = 0;
  let adjacentSameBlockCount = 0;
  let maxSameBlockRun = 0;
  let currentSameBlockRun = 0;
  let previousBlockId = null;

  for (let stepIndex = 0; stepIndex < solution.length; stepIndex++) {
    const expected = solution[stepIndex];
    const legalActions = enumerateLegalActionsV2(runtimeBoard, positions);
    const chosen = legalActions.find((action) => actionMatchesSolution(action, expected));
    if (!chosen) throw new TypeError(`solution step ${stepIndex} is not legal for quality analysis`);

    branchingByStep.push(legalActions.length);
    totalLegalActions += legalActions.length;
    if (legalActions.length > 1) decisionStepCount++;
    if (legalActions.length === 1) forcedStepCount++;

    for (const alternative of legalActions) {
      if (actionMatchesSolution(alternative, expected)) continue;
      offRouteAlternativeCount++;
      const alternateResult = applySlide(runtimeBoard, positions, alternative.blockIndex, alternative.direction);
      if (!alternateResult || isCleared(alternateResult.positions)) continue;
      if (enumerateLegalActionsV2(runtimeBoard, alternateResult.positions).length === 0) {
        immediateDeadEndAlternativeCount++;
      }
    }

    const applied = applySlide(runtimeBoard, positions, chosen.blockIndex, chosen.direction);
    if (!applied) throw new TypeError(`solution step ${stepIndex} could not be applied`);
    if (expected.steps != null && expected.steps !== applied.steps) {
      throw new TypeError(`solution step ${stepIndex} has a steps mismatch`);
    }
    if (expected.exit != null && expected.exit !== applied.exit) {
      throw new TypeError(`solution step ${stepIndex} has an exit mismatch`);
    }

    const stopped = stopReason(runtimeBoard, applied.positions, chosen.blockIndex, chosen.direction, applied.exit);
    stopHistogram[stopped.reason] = (stopHistogram[stopped.reason] ?? 0) + 1;
    if (stopped.wallKey) usedWalls.add(stopped.wallKey);

    directionHistogram[chosen.direction]++;
    colorHistogram[String(chosen.color)] = (colorHistogram[String(chosen.color)] ?? 0) + 1;
    movedBlocks.add(chosen.blockId);
    movedColors.add(chosen.color);

    if (previousBlockId === chosen.blockId) {
      adjacentSameBlockCount++;
      currentSameBlockRun++;
    } else {
      currentSameBlockRun = 1;
      previousBlockId = chosen.blockId;
    }
    maxSameBlockRun = Math.max(maxSameBlockRun, currentSameBlockRun);
    positions = applied.positions;
  }

  if (!isCleared(positions)) throw new TypeError('solution does not clear the board');

  const openCellCount = runtimeBoard.width * runtimeBoard.height - runtimeBoard.walls.size;
  const solutionLength = solution.length;
  const averageBranching = totalLegalActions / solutionLength;
  const maxBranching = Math.max(...branchingByStep);
  const initialDirectExitActionCount = initialActions.filter((action) => action.exit).length;

  return freezeMetricObject({
    boardHash: boardData.boardHash,
    structureHash: computeStructureHashV2(boardData),
    profileId: boardData.puzzleId?.split('-')[1] ?? null,
    boxCount: boardData.blocks.length,
    colorCount: new Set(boardData.blocks.map((block) => block.color)).size,
    optimalSwipes: solutionLength,
    openCellCount,
    initialOccupancyRate: clampRate(boardData.blocks.length, openCellCount),
    initialLegalActionCount: initialActions.length,
    initialMovableBlockCount: initialMovableBlocks.size,
    initialDirectExitActionCount,
    initialDirectExitBlockCount: initialDirectExitBlocks.size,
    branchingByStep: Object.freeze(branchingByStep),
    solutionAverageBranching: averageBranching,
    solutionMaxBranching: maxBranching,
    solutionDecisionStepCount: decisionStepCount,
    solutionForcedStepCount: forcedStepCount,
    solutionDecisionStepRate: clampRate(decisionStepCount, solutionLength),
    solutionForcedStepRate: clampRate(forcedStepCount, solutionLength),
    offRouteAlternativeCount,
    offRouteAlternativeRate: clampRate(offRouteAlternativeCount, totalLegalActions),
    immediateDeadEndAlternativeCount,
    immediateDeadEndAlternativeRate: clampRate(immediateDeadEndAlternativeCount, offRouteAlternativeCount),
    activeWallCount,
    solutionUsedWallCount: usedWalls.size,
    wallUtilizationRate: clampRate(usedWalls.size, activeWallCount),
    stopHistogram: Object.freeze({ ...stopHistogram }),
    sameBlockAdjacentRepeatCount: adjacentSameBlockCount,
    sameBlockRepeatRate: clampRate(adjacentSameBlockCount, solutionLength - 1),
    maxSameBlockRun,
    movedBlockCount: movedBlocks.size,
    movedColorCount: movedColors.size,
    directionHistogram: sortedHistogram(directionHistogram),
    colorHistogram: sortedHistogram(colorHistogram),
    dominantDirectionRate: histogramDominantRate(directionHistogram, solutionLength),
    dominantColorRate: histogramDominantRate(colorHistogram, solutionLength),
  });
}

export function screenCandidateQualityV2(metrics, rules = P3_04_SCREENING_RULES) {
  const hardRejectReasons = [];
  const reviewFlags = [];

  if (metrics.initialLegalActionCount === 0) hardRejectReasons.push('no-initial-legal-action');
  if (metrics.initialDirectExitBlockCount > rules.maxInitialDirectExitBlocks) {
    hardRejectReasons.push('initial-direct-exit');
  }

  if (metrics.initialLegalActionCount < rules.minInitialLegalActions) reviewFlags.push('low-initial-branching');
  if (metrics.solutionDecisionStepRate < rules.minDecisionStepRate) reviewFlags.push('low-decision-density');
  if (metrics.wallUtilizationRate < rules.minWallUtilizationRate) reviewFlags.push('low-wall-utilization');
  if (metrics.sameBlockRepeatRate > rules.maxSameBlockRepeatRate) reviewFlags.push('high-same-block-repeat');
  if (metrics.dominantDirectionRate > rules.maxDominantDirectionRate) reviewFlags.push('high-direction-bias');
  if (metrics.dominantColorRate > rules.maxDominantColorRate) reviewFlags.push('high-color-bias');

  const status = hardRejectReasons.length > 0 ? 'reject' : reviewFlags.length > 0 ? 'review' : 'candidate';
  return Object.freeze({
    status,
    hardRejectReasons: Object.freeze(hardRejectReasons),
    reviewFlags: Object.freeze(reviewFlags),
  });
}
