import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveRuntimeBoardExactV2 } from '../src/core/exact-solver-v2.js';
import { applySlide, isCleared } from '../src/core/rules.js';

function replayWithCanonicalRules(board, solution) {
  let positions = board.blocks.map((block) => ({ x: block.x, y: block.y }));
  for (let stepIndex = 0; stepIndex < solution.length; stepIndex++) {
    const action = solution[stepIndex];
    const blockIndex = board.blocks.findIndex((block) => String(block.id) === action.blockId);
    assert.ok(blockIndex >= 0, `step ${stepIndex}: blockId ${action.blockId}`);
    const current = positions[blockIndex];
    assert.deepEqual(current, action.from, `step ${stepIndex}: from`);
    const result = applySlide(board, positions, blockIndex, action.direction);
    assert.ok(result, `step ${stepIndex}: canonical rules rejected ${action.direction}`);
    assert.equal(result.steps, action.steps, `step ${stepIndex}: steps`);
    assert.equal(result.exit, action.exit, `step ${stepIndex}: exit`);
    positions = result.positions;
  }
  return positions;
}

function createLaneStackBoard() {
  const width = 7;
  const height = 9;
  const counts = [3, 3, 2];
  const blocks = [];
  const gates = [];
  const oneway = new Map();
  let blockNumber = 0;
  counts.forEach((count, color) => {
    gates.push({ id: `gate-${color}`, side: 'bottom', line: color, color });
    for (let y = 0; y < height; y++) oneway.set(`${color},${y}`, 'down');
    for (let offset = 0; offset < count; offset++) {
      blocks.push({
        id: `block-${String(blockNumber++).padStart(2, '0')}`,
        x: color,
        y: height - count + offset,
        w: 1,
        h: 1,
        color,
      });
    }
  });
  return { width, height, blocks, gates, walls: new Set(), oneway, shutters: [] };
}

test('一方通行と他箱を含む解法は既存rules.jsでも同じ結果になる', () => {
  const board = createLaneStackBoard();
  const result = solveRuntimeBoardExactV2(board, {
    maxNodes: 100_000,
    maxStates: 100_000,
    maxDepth: 20,
    timeoutMs: 5_000,
  });
  assert.equal(result.solved, true);
  assert.equal(result.optimalSwipes, 8);
  assert.equal(isCleared(replayWithCanonicalRules(board, result.solution)), true);
});

test('壁を停止位置として使う解法は既存rules.jsでも同じ結果になる', () => {
  const board = {
    width: 4,
    height: 4,
    blocks: [{ id: 'box-1', x: 0, y: 0, w: 1, h: 1, color: 0 }],
    walls: new Set(['2,0']),
    gates: [{ id: 'gate-0', side: 'bottom', line: 1, color: 0 }],
    oneway: new Map(),
    shutters: [],
  };
  const result = solveRuntimeBoardExactV2(board, {
    maxNodes: 10_000,
    maxStates: 10_000,
    maxDepth: 10,
    timeoutMs: 1_000,
  });
  assert.equal(result.solved, true);
  assert.equal(result.optimalSwipes, 2);
  assert.deepEqual(result.solution.map((step) => step.direction), ['right', 'down']);
  assert.equal(isCleared(replayWithCanonicalRules(board, result.solution)), true);
});
