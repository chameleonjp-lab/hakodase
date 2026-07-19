// P2-04のDOM統合。プレイ中の残り箱、undo、リタイア、合法操作0件の詰み案内を接続する。

import { APP_STATES } from '../app/app-state.js';
import { RUN_STATUS } from '../app/run-controller.js';
import { analyzePlayState } from '../core/play-status.js';
import { canUndoCurrentRun, retireCurrentRun, undoCurrentRun } from '../app/play-actions.js';

function defaultNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0;
}

function stopEvent(event) {
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
}

function bind(target, type, listener, options, removers) {
  if (!target?.addEventListener) return;
  target.addEventListener(type, listener, options);
  removers.push(() => target.removeEventListener?.(type, listener, options));
}

function resolveElements(documentRef, provided = {}) {
  const byId = (id) => provided[id] || documentRef?.getElementById?.(id) || null;
  return {
    screen: byId('screenPlaying'),
    remaining: byId('remaining'),
    undo: byId('undo'),
    retry: byId('retry'),
    next: byId('new'),
    retire: byId('playHome'),
    deadlock: byId('deadlockPanel'),
    retirePanel: byId('retirePanel'),
    retireCancel: byId('retireCancel'),
    retireConfirm: byId('retireConfirm'),
  };
}

function syncViewToEngine(game) {
  const positions = game.engine?.positions || [];
  game.view = positions.map((position) => (position ? { x: position.x, y: position.y } : null));
  game.target = positions.map((position) => (position ? { x: position.x, y: position.y } : null));
  game.exiting = positions.map(() => false);
  game.dragIndex = -1;
  game.dragOffset = { x: 0, y: 0 };
  game.preview = null;
  game.particles = [];
  game.engine?.deselect?.();
}

export function installPlayFlow(game, {
  documentRef = typeof document !== 'undefined' ? document : null,
  now = defaultNow,
  elements: providedElements = {},
} = {}) {
  if (!game || game.__p204Installed) return false;

  const elements = resolveElements(documentRef, providedElements);
  const required = ['remaining', 'undo', 'retire', 'deadlock', 'retirePanel', 'retireCancel', 'retireConfirm'];
  if (required.some((key) => !elements[key])) return false;

  game.__p204Installed = true;
  const removers = [];
  const originalUpdateAnimations = typeof game._updateAnimations === 'function' ? game._updateAnimations.bind(game) : null;
  const originalLeavePlay = typeof game._leavePlay === 'function' ? game._leavePlay.bind(game) : null;

  let lastEngine = null;
  let lastPlayId = null;
  let deadlocked = false;
  let retireOpen = false;
  let lockBeforeRetire = false;
  let lastBoard = null;
  let lastPositions = null;
  let lastEngineStatus = null;
  let lastSwipeCount = null;
  let lastUndoCount = null;
  let lastAnalysis = null;

  function setRetirePanel(open) {
    retireOpen = Boolean(open);
    elements.retirePanel.hidden = !retireOpen;
    if (documentRef?.body?.dataset) {
      if (retireOpen) documentRef.body.dataset.retireOpen = 'true';
      else delete documentRef.body.dataset.retireOpen;
    }
  }

  function setDeadlocked(value) {
    deadlocked = Boolean(value);
    elements.deadlock.hidden = !deadlocked;
    elements.screen?.classList?.toggle?.('is-deadlocked', deadlocked);
    if (deadlocked) game.inputLocked = true;
  }

  function resetTransient() {
    setRetirePanel(false);
    setDeadlocked(false);
    lockBeforeRetire = false;
    lastBoard = null;
    lastPositions = null;
    lastEngineStatus = null;
    lastSwipeCount = null;
    lastUndoCount = null;
    lastAnalysis = null;
  }

  function currentAnalysis() {
    if (!game.engine) return analyzePlayState(null, [], 'ready');
    if (lastBoard === game.engine.board
      && lastPositions === game.engine.positions
      && lastEngineStatus === game.engine.status
      && lastSwipeCount === game.engine.swipeCount
      && lastUndoCount === game.engine.undoCount
      && lastAnalysis) return lastAnalysis;
    lastBoard = game.engine.board;
    lastPositions = game.engine.positions;
    lastEngineStatus = game.engine.status;
    lastSwipeCount = game.engine.swipeCount;
    lastUndoCount = game.engine.undoCount;
    lastAnalysis = analyzePlayState(game.engine.board, game.engine.positions, game.engine.status);
    return lastAnalysis;
  }

  function isPlayingScreen() {
    return game.appController?.state === APP_STATES.PLAYING && Boolean(game.engine);
  }

  function isClearedRun() {
    return game.runController?.isCurrent?.(game.currentPlayId)
      && (game.runController.status === RUN_STATUS.CLEARED || game.engine?.status === 'cleared');
  }

  function refresh() {
    if (lastEngine !== game.engine || lastPlayId !== game.currentPlayId) {
      lastEngine = game.engine;
      lastPlayId = game.currentPlayId;
      resetTransient();
    }

    if (!isPlayingScreen()) {
      elements.remaining.textContent = '—';
      elements.undo.disabled = true;
      elements.retire.disabled = true;
      return;
    }

    const analysis = currentAnalysis();
    elements.remaining.textContent = `${analysis.remainingBlocks}箱`;

    const runPlaying = game.runController?.isPlaying?.(game.currentPlayId) === true && game.engine.status === 'playing';
    const runCleared = isClearedRun();

    if (!runPlaying || analysis.cleared) {
      setDeadlocked(false);
    } else if (!retireOpen && (!game.inputLocked || deadlocked)) {
      setDeadlocked(analysis.deadlocked);
    }

    if (retireOpen) game.inputLocked = true;
    if (deadlocked) game.inputLocked = true;

    const undoAllowed = canUndoCurrentRun({
      engine: game.engine,
      runController: game.runController,
      playId: game.currentPlayId,
    });
    const blockedByAnimation = game.inputLocked && !deadlocked;
    elements.undo.disabled = !undoAllowed || blockedByAnimation || retireOpen;

    elements.retire.textContent = runCleared ? 'ホームへ' : 'リタイア';
    elements.retire.disabled = retireOpen || (!runPlaying && !runCleared);
  }

  function performUndo(event) {
    stopEvent(event);
    if (retireOpen) return false;
    const result = undoCurrentRun({
      engine: game.engine,
      runController: game.runController,
      playId: game.currentPlayId,
    });
    if (!result.accepted) return false;

    setDeadlocked(false);
    syncViewToEngine(game);
    game.inputLocked = false;
    game.hud?.setStats?.(result.swipeCount, result.distanceCells);
    game.hud?.message?.(`1操作戻しました。戻す${result.undoCount}回。タイマーは進み続けます。`, 'info');
    refresh();
    return true;
  }

  function openRetire(event) {
    stopEvent(event);
    if (isClearedRun()) {
      originalLeavePlay?.();
      game._setHomeMessage?.('プレイを終了しました。', 'info');
      return true;
    }
    if (!game.runController?.isPlaying?.(game.currentPlayId)) return false;
    lockBeforeRetire = Boolean(game.inputLocked);
    game.inputLocked = true;
    setRetirePanel(true);
    refresh();
    elements.retireCancel.focus?.({ preventScroll: true });
    return true;
  }

  function cancelRetire(event) {
    stopEvent(event);
    if (!retireOpen) return false;
    setRetirePanel(false);
    game.inputLocked = deadlocked || lockBeforeRetire;
    lockBeforeRetire = false;
    refresh();
    elements.retire.focus?.({ preventScroll: true });
    return true;
  }

  function confirmRetire(event) {
    stopEvent(event);
    if (!retireOpen) return false;
    const timestamp = now();
    const result = retireCurrentRun({
      runController: game.runController,
      playId: game.currentPlayId,
      now: Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : 0,
      reason: 'player-retired',
    });
    if (!result.accepted) {
      cancelRetire();
      game.hud?.message?.('リタイアできませんでした。', 'error');
      return false;
    }

    setRetirePanel(false);
    originalLeavePlay?.();
    game._setHomeMessage?.('リタイアしました。記録は保存されません。', 'info');
    return true;
  }

  function onKeyDown(event) {
    if (event?.key === 'Escape' && retireOpen) cancelRetire(event);
  }

  bind(elements.undo, 'click', performUndo, false, removers);
  // 既存の「ホームへ」リスナーより先に捕捉し、P2-04のリタイア確認へ置き換える。
  bind(elements.retire, 'click', openRetire, true, removers);
  bind(elements.retireCancel, 'click', cancelRetire, false, removers);
  bind(elements.retireConfirm, 'click', confirmRetire, false, removers);
  bind(documentRef, 'keydown', onKeyDown, false, removers);

  const unsubscribe = game.appController?.subscribe?.((event) => {
    if (event.state !== APP_STATES.PLAYING) resetTransient();
    refresh();
  });
  if (typeof unsubscribe === 'function') removers.push(unsubscribe);

  if (originalUpdateAnimations) {
    game._updateAnimations = function updateAnimationsP204(dt) {
      originalUpdateAnimations(dt);
      refresh();
    };
  }

  game.refreshPlayFlow = refresh;
  game.destroyPlayFlow = () => {
    for (const remove of removers.splice(0)) remove();
    if (originalUpdateAnimations) game._updateAnimations = originalUpdateAnimations;
    resetTransient();
    delete game.refreshPlayFlow;
    delete game.destroyPlayFlow;
    game.__p204Installed = false;
  };

  refresh();
  return true;
}
