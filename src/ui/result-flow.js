// P2-05の結果画面統合。クリア結果の一回表示、再挑戦、共有、ホーム導線を接続する。

import { APP_STATES } from '../app/app-state.js';
import { RUN_STATUS } from '../app/run-controller.js';
import { GAME_MODES, getGameMode } from '../app/modes.js';
import {
  buildResultShareText,
  createClearResultModel,
  formatOptimalComparison,
  formatResultTime,
} from '../app/result-model.js';
import { shareResult } from '../services/share-result.js';

export const RESULT_REVEAL_DELAY_MS = 550;

function formatStoredScore(score) {
  if (!score) return '—';
  return `${formatResultTime(score.timeMs)} / ${score.swipeCount}操作`;
}

function clearRunView(game) {
  game.pendingStart = null;
  game.inputLocked = true;
  game.engine = null;
  game.meta = null;
  game.view = [];
  game.target = [];
  game.exiting = [];
  game.particles = [];
  game.dragIndex = -1;
  game.dragOffset = { x: 0, y: 0 };
  game.preview = null;
  game.currentPlayId = null;
  game.activeMode = null;
  game.activeRunConfig = null;
}

function currentUrl(locationRef) {
  const href = String(locationRef?.href || '');
  return href.split('#')[0];
}

export function installResultFlow(game, {
  documentRef = typeof document !== 'undefined' ? document : null,
  navigatorRef = typeof navigator !== 'undefined' ? navigator : null,
  locationRef = typeof window !== 'undefined' ? window.location : null,
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
  resultDelayMs = RESULT_REVEAL_DELAY_MS,
} = {}) {
  if (!game || game.__p205Installed) return false;

  const ids = [
    'resultMode', 'resultPlayer', 'resultTime', 'resultSwipes', 'resultDistance', 'resultUndo',
    'resultOptimal', 'resultDelta', 'resultProblem', 'resultFirst', 'resultBest',
    'resultSaveStatus', 'resultNetworkStatus', 'resultMessage', 'resultRetry', 'resultNext',
    'resultShare', 'resultHome', 'resultLab', 'resultShareFallback',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, documentRef?.getElementById?.(id) || null]));
  if (ids.some((id) => !elements[id])) return false;
  if (typeof game._onClear !== 'function' || typeof game._restartActiveRun !== 'function') return false;

  game.__p205Installed = true;
  const originalOnClearMethod = game._onClear;
  const originalOnClear = originalOnClearMethod.bind(game);
  const removers = [];
  const shownPlayIds = new Set();
  const processingPlayIds = new Set();
  let pendingTimer = null;
  let pendingPlayId = null;
  let shareBusy = false;

  function bind(target, type, listener) {
    target.addEventListener(type, listener);
    removers.push(() => target.removeEventListener(type, listener));
  }

  function cancelPendingResult() {
    if (pendingTimer != null) cancelSchedule(pendingTimer);
    pendingTimer = null;
    pendingPlayId = null;
  }

  function resetShareFallback() {
    elements.resultShareFallback.hidden = true;
    elements.resultShareFallback.value = '';
  }

  function renderModel(model) {
    elements.resultMode.textContent = model.preview ? `${model.modeLabel}（暫定問題）` : model.modeLabel;
    elements.resultPlayer.textContent = model.playerName ? `プレイヤー: ${model.playerName}` : '';
    elements.resultTime.textContent = formatResultTime(model.timeMs);
    elements.resultSwipes.textContent = `${model.swipeCount}操作`;
    elements.resultDistance.textContent = `${model.distanceCells}マス`;
    elements.resultUndo.textContent = `${model.undoCount}回`;
    elements.resultOptimal.textContent = model.optimalSwipes == null
      ? '—'
      : `${model.optimalSwipes}操作${model.optimalExact ? '' : '以上（目安）'}`;
    elements.resultDelta.textContent = formatOptimalComparison(model);
    elements.resultProblem.textContent = model.problemLabel;

    if (model.rankingEligible) {
      elements.resultFirst.textContent = formatStoredScore(model.localSummary?.first);
      elements.resultBest.textContent = formatStoredScore(model.localSummary?.best);
      elements.resultSaveStatus.textContent = model.localSaved === true
        ? '端末内へ保存しました'
        : model.localSaved === false
          ? '端末内へ保存できませんでした'
          : '端末内保存の状態を確認できません';
    } else {
      elements.resultFirst.textContent = '記録対象外';
      elements.resultBest.textContent = '記録対象外';
      elements.resultSaveStatus.textContent = 'このモードは端末内記録の対象外です';
    }

    elements.resultNetworkStatus.textContent = model.mode === GAME_MODES.DAILY
      ? model.official
        ? 'オンライン送信: 未接続（Phase 4）'
        : 'オンライン送信: 暫定問題のため送信しません'
      : 'オンライン送信: 対象外';
    elements.resultMessage.textContent = '';
    elements.resultMessage.dataset.kind = 'info';
    elements.resultShare.disabled = false;
    elements.resultRetry.disabled = !model.seed;
    elements.resultNext.hidden = model.mode !== GAME_MODES.ENDLESS;
    elements.resultLab.href = documentRef?.getElementById?.('homeLab')?.href || elements.resultLab.href;
    resetShareFallback();
  }

  async function loadLocalSummary({ mode, difficulty, seed, rankingEligible }) {
    if (!rankingEligible || typeof game.ranking?.getScoreSummary !== 'function') return null;
    try {
      return await game.ranking.getScoreSummary({ mode, difficulty, seed });
    } catch (_) {
      return null;
    }
  }

  function revealResult(model) {
    const playId = model.playId;
    if (shownPlayIds.has(playId)) return false;
    if (game.currentPlayId !== playId) return false;
    if (!game.runController.isCurrent(playId) || game.runController.status !== RUN_STATUS.CLEARED) return false;
    if (game.appController.state !== APP_STATES.PLAYING) return false;

    renderModel(model);
    game.inputLocked = true;
    const transitioned = game.appController.transition(APP_STATES.RESULT, { playId, result: 'cleared' });
    if (!transitioned.accepted) return false;
    shownPlayIds.add(playId);
    game.resultModel = model;
    elements.resultRetry.focus?.({ preventScroll: true });
    return true;
  }

  game._onClear = async function onClearP205() {
    const playId = game.currentPlayId;
    const engine = game.engine;
    const meta = game.meta;
    const config = game.activeRunConfig ? { ...game.activeRunConfig } : {};
    if (playId == null || pendingPlayId === playId || shownPlayIds.has(playId) || processingPlayIds.has(playId)) return false;
    processingPlayIds.add(playId);

    const mode = getGameMode(config.mode);
    const summaryQuery = {
      mode: config.mode,
      difficulty: config.difficulty || meta?.difficulty,
      seed: config.seed ?? meta?.seed,
      rankingEligible: mode?.rankingEnabled === true,
    };
    const beforeSummaryPromise = loadLocalSummary(summaryQuery);

    try {
      await originalOnClear();
    } catch (_) {
      processingPlayIds.delete(playId);
      game.hud?.message?.('クリア結果の確定に失敗しました。', 'error');
      return false;
    }
    if (game.currentPlayId !== playId || !game.runController.isCurrent(playId) || game.runController.status !== RUN_STATUS.CLEARED) {
      processingPlayIds.delete(playId);
      return false;
    }

    const beforeSummary = await beforeSummaryPromise;
    const localSummary = await loadLocalSummary(summaryQuery);
    if (game.currentPlayId !== playId || !game.runController.isCurrent(playId) || game.runController.status !== RUN_STATUS.CLEARED) {
      processingPlayIds.delete(playId);
      return false;
    }
    const localSaved = summaryQuery.rankingEligible && beforeSummary && localSummary
      ? localSummary.count > beforeSummary.count
      : null;
    const model = createClearResultModel({
      run: game.runController.snapshot(),
      engine,
      meta,
      config,
      playerName: game.playerName,
      localSaved,
      localSummary,
    });

    cancelPendingResult();
    processingPlayIds.delete(playId);
    pendingPlayId = playId;
    pendingTimer = schedule(() => {
      pendingTimer = null;
      pendingPlayId = null;
      revealResult(model);
    }, Math.max(0, Number(resultDelayMs) || 0));
    return true;
  };

  function restart(seed) {
    if (seed == null || seed === '') return false;
    const model = game.resultModel;
    if (!model || game.appController.state !== APP_STATES.RESULT || !game.runController.isCurrent(model.playId)) return false;
    const accepted = game._restartActiveRun(seed);
    if (accepted) {
      game.resultModel = null;
      resetShareFallback();
    }
    return accepted;
  }

  function onRetry() {
    restart(game.resultModel?.seed);
  }

  function onNext() {
    if (game.resultModel?.mode !== GAME_MODES.ENDLESS) return;
    let seed = Math.random().toString(36).slice(2, 8) || 'next01';
    if (seed === game.resultModel.seed) seed = `${seed}x`;
    restart(seed);
  }

  async function onShare() {
    const model = game.resultModel;
    if (!model || shareBusy || game.appController.state !== APP_STATES.RESULT) return;
    shareBusy = true;
    elements.resultShare.disabled = true;
    const playId = model.playId;
    const outcome = await shareResult({
      text: buildResultShareText(model),
      url: currentUrl(locationRef),
      navigatorRef,
    });
    shareBusy = false;
    if (!game.resultModel || game.resultModel.playId !== playId || game.appController.state !== APP_STATES.RESULT) return;
    elements.resultShare.disabled = false;
    if (outcome.status === 'shared') {
      elements.resultMessage.textContent = outcome.method === 'web-share' ? '共有画面を開きました。' : '結果をコピーしました。';
      elements.resultMessage.dataset.kind = 'success';
      resetShareFallback();
    } else if (outcome.status === 'cancelled') {
      elements.resultMessage.textContent = '共有をキャンセルしました。';
      elements.resultMessage.dataset.kind = 'info';
    } else {
      elements.resultShareFallback.hidden = false;
      elements.resultShareFallback.value = outcome.fullText;
      elements.resultShareFallback.focus?.({ preventScroll: true });
      elements.resultShareFallback.select?.();
      elements.resultMessage.textContent = '共有文を表示しました。選択してコピーしてください。';
      elements.resultMessage.dataset.kind = 'info';
    }
  }

  function onHome() {
    if (game.appController.state !== APP_STATES.RESULT) return;
    const transitioned = game.appController.transition(APP_STATES.HOME, { reason: 'result-home' });
    if (!transitioned.accepted) return;
    clearRunView(game);
    game.resultModel = null;
    resetShareFallback();
  }

  bind(elements.resultRetry, 'click', onRetry);
  bind(elements.resultNext, 'click', onNext);
  bind(elements.resultShare, 'click', onShare);
  bind(elements.resultHome, 'click', onHome);

  const unsubscribe = game.appController.subscribe((event) => {
    if (event.state !== APP_STATES.PLAYING && event.state !== APP_STATES.RESULT) cancelPendingResult();
    if (event.state !== APP_STATES.RESULT) resetShareFallback();
  });
  removers.push(unsubscribe);

  game.destroyResultFlow = () => {
    cancelPendingResult();
    for (const remove of removers.splice(0)) remove();
    game._onClear = originalOnClearMethod;
    game.resultModel = null;
    delete game.destroyResultFlow;
    game.__p205Installed = false;
  };

  return true;
}
