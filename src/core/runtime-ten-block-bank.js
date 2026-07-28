// HAKODASE 公開プレイ用の軽量10箱盤面バンク。
// P3-03Rで厳密検証済みのb10c4テンプレートだけを読み込み、
// 公開ブラウザでは厳密ソルバーを実行せずに盤面を組み立てる。

import { GENERATOR_V3_TEMPLATE_CATALOG } from './generator-v3-catalog.js';
import { hashSeed, makeRng } from './rng.js';
import { key } from './rules.js';

export const RUNTIME_TEN_BLOCK_BANK_VERSION = 'runtime-b10c4-preview/1.0.0';
export const RUNTIME_TEN_BLOCK_GENERATOR_VERSION = 'route-catalog/3.0.0';
export const RUNTIME_TEN_BLOCK_PROFILE_ID = 'b10c4';
export const RUNTIME_TEN_BLOCK_COUNT = 10;
export const RUNTIME_TEN_BLOCK_COLOR_COUNT = 4;
export const RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES = 24;

const WIDTH = 7;
const HEIGHT = 9;
const TRANSFORMS = Object.freeze(['identity', 'mirrorX', 'mirrorY', 'rotate180']);
const DIRECTION_TRANSFORM = Object.freeze({
  identity: Object.freeze({ up: 'up', down: 'down', left: 'left', right: 'right' }),
  mirrorX: Object.freeze({ up: 'up', down: 'down', left: 'right', right: 'left' }),
  mirrorY: Object.freeze({ up: 'down', down: 'up', left: 'left', right: 'right' }),
  rotate180: Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' }),
});

const TEN_BLOCK_TEMPLATES = Object.freeze(
  GENERATOR_V3_TEMPLATE_CATALOG.filter((template) => template.profileId === RUNTIME_TEN_BLOCK_PROFILE_ID),
);
const TEMPLATE_BY_ID = new Map(TEN_BLOCK_TEMPLATES.map((template) => [template.id, template]));

if (TEN_BLOCK_TEMPLATES.length !== 12) {
  throw new Error(`Expected 12 verified b10c4 templates, got ${TEN_BLOCK_TEMPLATES.length}`);
}
for (const template of TEN_BLOCK_TEMPLATES) {
  const blockCount = template.counts.reduce((total, count) => total + count, 0);
  if (blockCount !== RUNTIME_TEN_BLOCK_COUNT) {
    throw new Error(`Template ${template.id} has ${blockCount} blocks`);
  }
  if (template.routes.length !== RUNTIME_TEN_BLOCK_COLOR_COUNT) {
    throw new Error(`Template ${template.id} has ${template.routes.length} colors`);
  }
  if (template.expectedOptimalSwipes !== RUNTIME_TEN_BLOCK_OPTIMAL_SWIPES) {
    throw new Error(`Template ${template.id} has unexpected optimal swipes`);
  }
}

function shuffle(values, rng) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = rng.int(index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
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
  if (!mapped) throw new TypeError(`Unsupported direction ${direction} for ${transform}`);
  return mapped;
}

function createColorPermutation(rng) {
  return shuffle(
    Array.from({ length: RUNTIME_TEN_BLOCK_COLOR_COUNT }, (_, index) => index),
    rng,
  );
}

function buildRuntimeBoard(template, transform, colorPermutation) {
  const openCells = new Set();
  const walls = new Set();
  const oneway = new Map();
  const blocks = [];
  const gates = [];
  let blockNumber = 0;

  template.routes.forEach((route, routeIndex) => {
    const transformedPath = route.path.map(([x, y]) => transformPoint(transform, x, y));
    for (const point of transformedPath) openCells.add(key(point.x, point.y));

    const count = template.counts[routeIndex];
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
      const cell = key(point.x, point.y);
      const direction = transformDirection(transform, lane.direction);
      const previous = oneway.get(cell);
      if (previous && previous !== direction) {
        throw new Error(`Conflicting lane at ${cell} in ${template.id}`);
      }
      oneway.set(cell, direction);
    }
  });

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const cell = key(x, y);
      if (!openCells.has(cell)) walls.add(cell);
    }
  }

  return { width: WIDTH, height: HEIGHT, walls, oneway, gates, blocks };
}

/**
 * seedから検証済み10箱盤面を選ぶ。公開ブラウザで厳密探索は実行しない。
 * @param {string|number} seed
 * @param {{templateId?: string}} options
 */
export function getRuntimeTenBlockPuzzle(seed, options = {}) {
  const baseSeed = seed ?? 'runtime-ten-block-default';
  const requestedTemplate = options.templateId == null
    ? null
    : TEMPLATE_BY_ID.get(String(options.templateId));
  if (options.templateId != null && !requestedTemplate) {
    throw new RangeError(`Unknown verified 10-block template: ${options.templateId}`);
  }

  const derivedSeed = hashSeed(
    `${baseSeed}|${RUNTIME_TEN_BLOCK_PROFILE_ID}|0|${RUNTIME_TEN_BLOCK_GENERATOR_VERSION}`,
  );
  const template = requestedTemplate ?? TEN_BLOCK_TEMPLATES[derivedSeed % TEN_BLOCK_TEMPLATES.length];
  const rng = makeRng(derivedSeed ^ 0x85ebca6b);
  const transform = TRANSFORMS[rng.int(TRANSFORMS.length)];
  const colorPermutation = createColorPermutation(rng);
  const board = buildRuntimeBoard(template, transform, colorPermutation);

  return Object.freeze({
    board,
    puzzleId: `preview-${template.id}-${transform}-c${colorPermutation.join('')}`,
    expectedOptimalSwipes: template.expectedOptimalSwipes,
    source: RUNTIME_TEN_BLOCK_BANK_VERSION,
    generatorVersion: RUNTIME_TEN_BLOCK_GENERATOR_VERSION,
    profileId: RUNTIME_TEN_BLOCK_PROFILE_ID,
    templateId: template.id,
    transform,
    colorPermutation: Object.freeze([...colorPermutation]),
    derivedSeed,
    provisional: true,
  });
}

export function listRuntimeTenBlockTemplates() {
  return TEN_BLOCK_TEMPLATES.map((template) => Object.freeze({
    id: template.id,
    expectedOptimalSwipes: template.expectedOptimalSwipes,
    blockCount: template.counts.reduce((total, count) => total + count, 0),
    colorCount: template.routes.length,
  }));
}
