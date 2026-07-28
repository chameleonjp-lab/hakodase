import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardDataV2ToRuntime } from '../src/core/board-data-v2.js';
import { generateCandidateBoardV2 } from '../src/core/generator-v2.js';
import { DIR_NAMES, computeSlide } from '../src/core/rules.js';
import {
  getRuntimeTenBlockPuzzle,
  listRuntimeTenBlockTemplates,
  RUNTIME_TEN_BLOCK_BANK_VERSION,
  RUNTIME_TEN_BLOCK_COLOR_COUNT,
  RUNTIME_TEN_BLOCK_COUNT,
  RUNTIME_TEN_BLOCK_GENERATOR_VERSION,
  RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES,
} from '../src/core/runtime-ten-block-bank.js';

function positionsOf(board) {
  return board.blocks.map((block) => ({ x: block.x, y: block.y }));
}

function directExitBlockCount(board) {
  const positions = positionsOf(board);
  const direct = new Set();
  for (let index = 0; index < board.blocks.length; index++) {
    for (const direction of DIR_NAMES) {
      if (computeSlide(board, positions, index, direction).exit) direct.add(index);
    }
  }
  return direct.size;
}

function comparableBoard(board) {
  return {
    width: board.width,
    height: board.height,
    blocks: board.blocks.map((block) => ({ ...block })),
    gates: board.gates.map((gate) => ({ ...gate })),
    walls: [...board.walls].sort(),
    oneway: [...board.oneway.entries()].sort(([left], [right]) => left.localeCompare(right, 'en')),
  };
}

test('10箱ランタイムバンクは検証済み12構造だけを公開する', () => {
  const templates = listRuntimeTenBlockTemplates();
  assert.equal(templates.length, 12);
  assert.equal(new Set(templates.map((template) => template.id)).size, 12);
  for (const template of templates) {
    assert.equal(template.blockCount, RUNTIME_TEN_BLOCK_COUNT);
    assert.equal(template.colorCount, RUNTIME_TEN_BLOCK_COLOR_COUNT);
    assert.equal(template.expectedOptimalSwipes, RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES);
  }
});

test('同じseedは同じ10箱盤面を返す', () => {
  const first = getRuntimeTenBlockPuzzle('runtime-ten-block-deterministic');
  const second = getRuntimeTenBlockPuzzle('runtime-ten-block-deterministic');
  assert.equal(first.puzzleId, second.puzzleId);
  assert.equal(first.templateId, second.templateId);
  assert.deepEqual(comparableBoard(first.board), comparableBoard(second.board));
});

test('seedにより複数の10箱盤面を選べる', () => {
  const ids = new Set();
  for (let index = 0; index < 32; index++) {
    ids.add(getRuntimeTenBlockPuzzle(`runtime-variation-${index}`).puzzleId);
  }
  assert.ok(ids.size >= 8, `盤面差分が少なすぎる: ${ids.size}`);
});

test('全12構造が10箱・4色・最短24操作・初期直行0箱を満たす', () => {
  for (const template of listRuntimeTenBlockTemplates()) {
    const result = getRuntimeTenBlockPuzzle(`runtime-check:${template.id}`, { templateId: template.id });
    const colors = [...new Set(result.board.blocks.map((block) => block.color))].sort((a, b) => a - b);
    const counts = colors.map((color) => result.board.blocks.filter((block) => block.color === color).length).sort((a, b) => a - b);
    const occupied = new Set(result.board.blocks.map((block) => `${block.x},${block.y}`));

    assert.equal(result.source, RUNTIME_TEN_BLOCK_BANK_VERSION, template.id);
    assert.equal(result.generatorVersion, RUNTIME_TEN_BLOCK_GENERATOR_VERSION, template.id);
    assert.equal(result.expectedOptimalSwipes, RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES, template.id);
    assert.equal(result.board.width, 7, template.id);
    assert.equal(result.board.height, 9, template.id);
    assert.equal(result.board.blocks.length, RUNTIME_TEN_BLOCK_COUNT, template.id);
    assert.equal(result.board.gates.length, RUNTIME_TEN_BLOCK_COLOR_COUNT, template.id);
    assert.equal(colors.length, RUNTIME_TEN_BLOCK_COLOR_COUNT, template.id);
    assert.deepEqual(counts, [2, 2, 2, 4], template.id);
    assert.equal(occupied.size, RUNTIME_TEN_BLOCK_COUNT, `${template.id}: block overlap`);
    assert.equal(directExitBlockCount(result.board), 0, `${template.id}: direct exit`);
    assert.ok(result.puzzleId.startsWith(`preview-${template.id}-`), result.puzzleId);
  }
});

test('公開用の軽量盤面は開発用生成器v3と同じ盤面を組み立てる', () => {
  const seed = 'runtime-parity-seed';
  const templateId = 'b10c4-t00';
  const runtime = getRuntimeTenBlockPuzzle(seed, { templateId });
  const verified = generateCandidateBoardV2({ seed, profileId: 'b10c4', templateId });

  assert.equal(verified.success, true, verified.reason);
  assert.equal(verified.boardData.expectedOptimalSwipes, RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES);
  assert.deepEqual(
    comparableBoard(runtime.board),
    comparableBoard(boardDataV2ToRuntime(verified.boardData)),
  );
});

test('未登録の10箱構造を推測で生成しない', () => {
  assert.throws(
    () => getRuntimeTenBlockPuzzle('unknown-template', { templateId: 'b10c4-unknown' }),
    RangeError,
  );
});
