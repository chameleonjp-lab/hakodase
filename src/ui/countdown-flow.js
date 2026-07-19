// P2-03のDOM統合。既存ゲーム画面へカウントダウン、開始同期、中断無効化を接続する。

import { APP_STATES } from '../app/app-state.js';
import { CountdownController } from '../app/countdown-controller.js';
import { RUN_STATUS } from '../app/run-controller.js';
import { startPreparedRun } from '../app/start-run.js';
import { shouldInvalidateOnHidden } from '../app/visibility-policy.js';
import { GAME_MODES, getGameMode } from '../app/modes.js';

const START_FLASH_MS = 450;

function safeNow(now) {
  const value = typeof now === 'function' ? now() : performance.now();
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function renderBoardFrame(game) {
  if (!game.engine) return;
  const frameState = game.engine.getFrameState();
  frameState.viewPositions = game.view;
  frameState.particles = game.particles;
  frameState.preview = game.preview;
  game.renderer.render(frameState);
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
}

export function installCountdownFlow(game, {
  documentRef = document,
  requestFrame = requestAnimationFrame,
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
  now = () => performance.now(),
} = {}) {
  if (!game || game.__p203Installed) return false;
  game.__p203Installed = true;

  const originalNewBoard = game.newBoard.bind(game);
  const countdown = new CountdownController({ schedule, cancelSchedule });
  let countdownToken = null;
  let flashTimer = null;

  const elements = {
    mode: documentRef.getElementById('countdownMode'),
    value: documentRef.getElementById('countdownValue'),
    hint: documentRef.getElementById('countdownHint'),
    cancel: documentRef.getElementById('countdownCancel'),
    flash: documentRef.getElementById('startFlash'),
  };

  function hideStartFlash() {
    if (flashTimer != null) cancelSchedule(flashTimer);
    flashTimer = null;
    if (elements.flash) elements.flash.hidden = true;
  }

  function showStartFlash(playId) {
    if (!elements.flash) return;
    hideStartFlash();
    elements.flash.hidden = true;
    void elements.flash.offsetWidth;
    elements.flash.hidden = false;
    flashTimer = schedule(() => {
      flashTimer = null;
      if (game.runController.isCurrent(playId)) elements.flash.hidden = true;
    }, START_FLASH_MS);
  }

  function cancelCountdown(reason = 'cancelled') {
    countdownToken = null;
    countdown.cancel(reason);
  }

  function invalidateCurrent(reason) {
    const playId = game.currentPlayId;
    if (playId == null || !game.runController.isCurrent(playId)) return false;
    if (game.runController.status !== RUN_STATUS.PREPARED && game.runController.status !== RUN_STATUS.PLAYING) return false;
    return game.runController.invalidate(playId, reason, safeNow(now)).accepted;
  }

  function abortCurrent(reason, message) {
    cancelCountdown(reason);
    hideStartFlash();
    invalidateCurrent(reason);
    clearRunView(game);
    if (game.appController.state === APP_STATES.COUNTDOWN || game.appController.state === APP_STATES.PLAYING) {
      game.appController.transition(APP_STATES.HOME, { reason });
    }
    if (message) game._setHomeMessage(message, 'error');
    return true;
  }

  function queueStart(playId, token, screenVersion) {
    requestFrame((frameTime) => {
      if (countdownToken !== token) return;
      if (!game.appController.isCurrent(screenVersion) || game.appController.state !== APP_STATES.COUNTDOWN) return;
      if (!game.runController.isCurrent(playId) || game.runController.status !== RUN_STATUS.PREPARED) return;

      countdownToken = null;
      const transitioned = game.appController.transition(APP_STATES.PLAYING, { playId, startToken: token });
      if (!transitioned.accepted) {
        abortCurrent('playing-transition-failed', '開始処理に失敗しました。ホームからやりなおしてください。');
        return;
      }

      game._fit?.();
      renderBoardFrame(game);
      const started = startPreparedRun({
        engine: game.engine,
        runController: game.runController,
        playId,
        now: Number.isFinite(frameTime) && frameTime >= 0 ? frameTime : safeNow(now),
      });
      if (!started.accepted) {
        abortCurrent('start-transaction-failed', '開始処理に失敗しました。ホームからやりなおしてください。');
        return;
      }

      game.inputLocked = false;
      showStartFlash(playId);
    });
  }

  function beginCountdown(playId, definition) {
    const screenVersion = game.appController.version;
    if (elements.mode) {
      elements.mode.textContent = definition.id === GAME_MODES.DAILY
        ? `${definition.label}（暫定問題・厳格時計）`
        : definition.label;
    }
    if (elements.hint) {
      elements.hint.textContent = definition.strictClock
        ? 'STARTまで盤面は表示されません。画面を閉じるとこの試行は無効になります。'
        : 'STARTまで盤面は表示されません。';
    }

    const started = countdown.start({
      onStep: (step, _index, token) => {
        if (!game.runController.isCurrent(playId)) return;
        if (!game.appController.isCurrent(screenVersion) || game.appController.state !== APP_STATES.COUNTDOWN) return;
        if (elements.value) {
          elements.value.textContent = step;
          elements.value.dataset.step = step === 'START' ? 'start' : step;
        }
      },
      onStart: (token) => queueStart(playId, token, screenVersion),
    });
    if (!started.accepted) {
      abortCurrent('countdown-start-failed', 'カウントダウンを開始できませんでした。');
      return false;
    }
    countdownToken = started.token;
    return true;
  }

  function prepareRun(config, definition = getGameMode(config?.mode)) {
    if (!definition || !config) return false;
    cancelCountdown('replaced');
    hideStartFlash();

    const prepared = game.runController.prepare(config);
    if (!prepared.accepted) return false;
    const playId = prepared.run.playId;
    game.currentPlayId = playId;
    game.activeMode = definition.id;
    game.activeRunConfig = { ...config };
    game.difficulty = definition.difficulty;
    game._configurePlayingMode(definition);

    const transitioned = game.appController.transition(APP_STATES.COUNTDOWN, { mode: definition.id, playId });
    if (!transitioned.accepted) {
      game.runController.invalidate(playId, 'countdown-transition-failed', safeNow(now));
      return false;
    }

    try {
      originalNewBoard(definition.difficulty, config.seed, playId);
      game.pendingStart = null;
    } catch (_) {
      abortCurrent('board-generation-failed', '盤面を準備できませんでした。もう一度お試しください。');
      return false;
    }
    return beginCountdown(playId, definition);
  }

  game._prepareSelectedMode = function prepareSelectedModeP203(seedOverride = null) {
    const definition = getGameMode(game.selectedMode);
    if (!definition || !game.playerName || game.appController.state !== APP_STATES.NAME_CONFIRM) return false;
    const seed = seedOverride ?? definition.previewSeed ?? Math.random().toString(36).slice(2, 8);
    const config = {
      mode: definition.id,
      playerName: game.playerName,
      difficulty: definition.difficulty,
      seed,
      official: false,
      strictClock: definition.strictClock,
      preview: true,
    };
    return prepareRun(config, definition);
  };

  game._restartActiveRun = function restartActiveRunP203(seed) {
    const restartableState = game.appController.state === APP_STATES.PLAYING || game.appController.state === APP_STATES.RESULT;
    if (!game.activeRunConfig || !restartableState) return false;
    invalidateCurrent('restart');
    const config = { ...game.activeRunConfig, seed };
    return prepareRun(config, getGameMode(config.mode));
  };

  game._startPendingRun = function disableLegacyPendingStart() {
    game.pendingStart = null;
  };

  game._leavePlay = function leavePlayP203() {
    return abortCurrent('left-preview', '');
  };

  if (elements.cancel) {
    elements.cancel.addEventListener('click', () => abortCurrent('countdown-cancelled', '開始を中止しました。'));
  }

  const visibilityHandler = () => {
    if (!documentRef.hidden || !game.activeRunConfig) return;
    if (!shouldInvalidateOnHidden({
      strictClock: game.activeRunConfig.strictClock,
      appState: game.appController.state,
      runStatus: game.runController.status,
    })) return;
    abortCurrent('page-hidden', '画面が隠れたため、本日の出荷の試行を無効にしました。');
  };
  documentRef.addEventListener('visibilitychange', visibilityHandler);

  game.destroyCountdownFlow = () => {
    cancelCountdown('destroyed');
    hideStartFlash();
    documentRef.removeEventListener('visibilitychange', visibilityHandler);
    countdown.destroy();
    game.__p203Installed = false;
  };

  return true;
}
