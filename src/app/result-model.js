// クリア結果の表示モデルと共有文を組み立てる純粋関数。
// DOM、Canvas、保存、通信、現在時刻へ依存しない。

import { getGameMode } from './modes.js';

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback;
}

function optionalNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function copyScore(score) {
  if (!score) return null;
  return Object.freeze({
    timeMs: nonNegativeInteger(score.timeMs),
    swipeCount: nonNegativeInteger(score.swipeCount),
    distanceCells: nonNegativeInteger(score.distanceCells),
    clearedAt: score.clearedAt == null ? null : String(score.clearedAt),
  });
}

function normalizeLocalSummary(summary) {
  if (!summary) return null;
  return Object.freeze({
    count: nonNegativeInteger(summary.count),
    first: copyScore(summary.first),
    best: copyScore(summary.best),
  });
}

export function formatResultTime(timeMs) {
  return `${(nonNegativeInteger(timeMs) / 1000).toFixed(2)}秒`;
}

export function createClearResultModel({
  run,
  engine,
  meta = {},
  config = {},
  playerName = '',
  localSummary = null,
  localSaved = null,
} = {}) {
  const runResult = run?.result || {};
  const modeId = String(runResult.mode ?? config.mode ?? '');
  const mode = getGameMode(modeId);
  const timeMs = nonNegativeInteger(runResult.timeMs ?? engine?.finalElapsedMs ?? 0);
  const swipeCount = nonNegativeInteger(runResult.swipeCount ?? engine?.swipeCount ?? 0);
  const distanceCells = nonNegativeInteger(runResult.distanceCells ?? engine?.distanceCells ?? 0);
  const undoCount = nonNegativeInteger(runResult.undoCount ?? engine?.undoCount ?? 0);
  const optimalSwipes = optionalNonNegativeInteger(meta.optimalSwipes);
  const optimalExact = optimalSwipes != null && meta.exact === true;
  const optimalDelta = optimalSwipes == null ? null : swipeCount - optimalSwipes;
  const puzzleIdValue = meta.puzzleId ?? config.puzzleId ?? runResult.puzzleId ?? null;
  const seedValue = runResult.seed ?? meta.seed ?? config.seed ?? null;
  const puzzleId = puzzleIdValue == null || puzzleIdValue === '' ? null : String(puzzleIdValue);
  const seed = seedValue == null || seedValue === '' ? null : String(seedValue);
  const official = Boolean(config.official === true && config.preview !== true && puzzleId);
  const rankingEligible = mode?.rankingEnabled === true;

  return Object.freeze({
    kind: 'cleared',
    playId: run?.playId ?? null,
    playerName: String(playerName || config.playerName || ''),
    mode: modeId,
    modeLabel: mode?.label || modeId || '不明なモード',
    official,
    preview: config.preview === true,
    timeMs,
    swipeCount,
    distanceCells,
    undoCount,
    optimalSwipes,
    optimalExact,
    optimalDelta,
    puzzleId,
    seed,
    problemLabel: puzzleId ? `問題 ${puzzleId}` : seed ? `seed ${seed}` : '問題情報なし',
    rankingEligible,
    localSaved: rankingEligible ? localSaved : null,
    localSummary: rankingEligible ? normalizeLocalSummary(localSummary) : null,
  });
}

export function formatOptimalComparison(model) {
  if (!model || model.optimalSwipes == null || model.optimalDelta == null) return '—';
  if (model.optimalDelta < 0) return '最短値との整合性を確認してください';
  const prefix = model.optimalExact ? '最短' : '目安';
  if (model.optimalDelta === 0) return `${prefix}と同じ`;
  return `${prefix}より +${model.optimalDelta}操作`;
}

export function buildResultShareText(model) {
  if (!model) return '';
  const modeLabel = model.preview ? `${model.modeLabel}（暫定問題）` : model.modeLabel;
  const lines = [
    'HAKODASE / ハコダセ',
    `${modeLabel}を${formatResultTime(model.timeMs)}・${model.swipeCount}操作でクリア！`,
  ];
  if (model.official && model.puzzleId) lines.push(`問題: ${model.puzzleId}`);
  else if (model.seed) lines.push(`seed: ${model.seed}`);
  if (model.undoCount > 0) lines.push(`戻す: ${model.undoCount}回`);
  return lines.join('\n');
}
