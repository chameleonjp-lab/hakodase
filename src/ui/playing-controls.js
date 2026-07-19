// P2-04のDOM統合。残り箱、undo、リタイア、合法手0件の詰み案内を既存ゲームへ接続する。

import { APP_STATES } from '../app/app-state.js';
import { RUN_STATUS } from '../app/run-controller.js';
import { derivePlayControlState } from '../app/play-control-policy.js';

function copyPosition(position) {
  return position ? { x: position.x, y: position.y } : null;
}

function syncViewToEngine(game) {
  const positions = game.engine?.positions || [];
  game.view = positions.map(copyPosition);
  game.target = positions.map(copyPosition);
  game.exiting = positions.map(() => false);
  game.dragIndex = -1;
  game.dragOffset = { x: 0, y: 0 };
  game.preview = null;
  game.particles = [];
  game.engine?.deselect();
}

export function installPlayingControls(game, {
  documentRef = document,
  now = () => performance.now(),
} = {}) {
  if (!game || game.__p204Installed) return false;

  const elements = {
    remaining: documentRef.getElementById('remaining'),
    undoCount: documentRef.getElementById('undoCount'),
    undo: documentRef.getElementById('undoButton'),
    retry: documentRef.getElementById('retry'),
    retire: documentRef.getElementById('playHome'),
    retirePanel: documentRef.getElementById('retireConfirm'),
    retireContinue: documentRef.getElementById('retireContinue'),
    retireConfirm: documentRef.getElementById('retireConfirmButton'),
    stuckPanel: documentRef.getElementById('stuckPanel'),
    stuckUndo: documentRef.getElementById('stuckUndo'),
    stuckRetry: documentRef.getElementById('stuckRetry'),
    stuckRetire: documentRef.getElementById('stuckRetire'),
  };
  if (Object.values(elements).some((element) => !element)) return false;

  game.__p204Installed = true;
  game.hud.els.remaining = elements.remaining;
  game.hud.els.undoCount = elements.undoCount;

  const originalUpdateAnimationsMethod = game._updateAnimations;
  const originalLeavePlayMethod = game._leavePlay;
  const originalConfigurePlayingModeMethod = game._configurePlayingMode;
  const originalUpdateAnimations = originalUpdateAnimationsMethod.bind(game);
  const originalLeavePlay = originalLeavePlayMethod.bind(game);
  const originalConfigurePlayingMode = originalConfigurePlayingModeMethod.bind(game);
  let retireOpen = false;
  let stuckOpen = false;
  let lastSignature = '';

  function isLivePlaying() {
    return Boolean(
      game.engine
      && game.appController.state === APP_STATES.PLAYING
      && game.runController.isPlaying(game.currentPlayId)
      && game.engine.status === 'playing'
    );
  }

  function dialogOpen() {
    return retireOpen || stuckOpen;
  }

  function hideRetire({ unlock = false } = {}) {
    retireOpen = false;
    elements.retirePanel.hidden = true;
    if (unlock && isLivePlaying() && !stuckOpen) game.inputLocked = false;
  }

  function hideStuck({ unlock = false } = {}) {
    stuckOpen = false;
    elements.stuckPanel.hidden = true;
    if (unlock && isLivePlaying() && !retireOpen) game.inputLocked = false;
  }

  function showRetire() {
    if (!isLivePlaying() || game.engine?.status === 'cleared') return false;
    retireOpen = true;
    game.inputLocked = true;
    elements.retirePanel.hidden = false;
    elements.retireContinue.focus?.({ preventScroll: true });
    refresh(true);
    return true;
  }

  function showStuck() {
    if (stuckOpen || !isLivePlaying() || game.engine.remainingCount === 0) return false;
    stuckOpen = true;
    game.inputLocked = true;
    elements.stuckPanel.hidden = false;
    game.hud.message('出荷できる操作がありません。戻すか、やりなおしてください。', 'error');
    elements.stuckUndo.focus?.({ preventScroll: true });
    refresh(true);
    return true;
  }

  function performUndo({ fromStuck = false } = {}) {
    if (!isLivePlaying()) return false;
    if (!fromStuck && game.inputLocked) return false;
    if (!game.engine.canUndo) return false;
    const result = game.engine.undo();
    if (!result.undone) return false;
    hideRetire();
    hideStuck();
    syncViewToEngine(game);
    game.inputLocked = false;
    game.hud.setStats(game.engine.swipeCount, game.engine.distanceCells);
    game.hud.setUndoCount(game.engine.undoCount);
    game.hud.message('1操作戻しました。タイマーは進み続けます。', 'info');
    refresh(true);
    return true;
  }

  function retryRun() {
    if (!isLivePlaying()) return false;
    hideRetire();
    hideStuck();
    game.inputLocked = false;
    game.retry();
    return true;
  }

  function confirmRetire() {
    if (!isLivePlaying()) return false;
    const playId = game.currentPlayId;
    const settled = game.runController.retire(playId, 'player-retired', now());
    if (!settled.accepted) return false;
    hideRetire();
    hideStuck();
    originalLeavePlay();
    game._setHomeMessage('リタイアしました。この試行は記録されません。', 'info');
    return true;
  }

  function refresh(force = false) {
    const engine = game.engine;
    const active = isLivePlaying();
    const remainingCount = engine?.remainingCount ?? 0;
    const historyLength = engine?.history?.length ?? 0;
    const hasLegalMove = active && !game.inputLocked && !dialogOpen()
      ? engine.hasAnyLegalMove()
      : true;
    const controlState = derivePlayControlState({
      appState: game.appController.state,
      runStatus: game.runController.status,
      engineStatus: engine?.status,
      inputLocked: game.inputLocked,
      historyLength,
      remainingCount,
      hasLegalMove,
      dialogOpen: dialogOpen(),
    });
    const signature = [
      active, game.inputLocked, historyLength, remainingCount, engine?.undoCount ?? 0,
      retireOpen, stuckOpen, hasLegalMove,
    ].join('|');
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    game.hud.setRemaining(remainingCount, engine?.board?.blocks?.length ?? null);
    game.hud.setUndoCount(engine?.undoCount ?? 0);
    elements.undo.disabled = !controlState.canUndo;
    elements.retry.disabled = !controlState.canRetry;
    elements.retire.disabled = !controlState.canRetire;
    elements.stuckUndo.disabled = !engine?.canUndo;

    if (controlState.shouldShowStuck) showStuck();
  }

  game._updateAnimations = function updateAnimationsP204(dt) {
    originalUpdateAnimations(dt);
    refresh();
  };

  game._configurePlayingMode = function configurePlayingModeP204(definition) {
    originalConfigurePlayingMode(definition);
    hideRetire();
    hideStuck();
    lastSignature = '';
    refresh(true);
  };

  game._leavePlay = function requestRetireP204() {
    return showRetire();
  };

  const onUndo = () => performUndo();
  const onRetireContinue = () => { hideRetire({ unlock: true }); refresh(true); };
  const onRetireConfirm = () => confirmRetire();
  const onStuckUndo = () => performUndo({ fromStuck: true });
  const onStuckRetry = () => retryRun();
  const onStuckRetire = () => { hideStuck(); showRetire(); };

  elements.undo.addEventListener('click', onUndo);
  elements.retireContinue.addEventListener('click', onRetireContinue);
  elements.retireConfirm.addEventListener('click', onRetireConfirm);
  elements.stuckUndo.addEventListener('click', onStuckUndo);
  elements.stuckRetry.addEventListener('click', onStuckRetry);
  elements.stuckRetire.addEventListener('click', onStuckRetire);

  const unsubscribe = game.appController.subscribe((event) => {
    if (event.state !== APP_STATES.PLAYING) {
      hideRetire();
      hideStuck();
    }
    refresh(true);
  });

  game.destroyPlayingControls = () => {
    unsubscribe();
    elements.undo.removeEventListener('click', onUndo);
    elements.retireContinue.removeEventListener('click', onRetireContinue);
    elements.retireConfirm.removeEventListener('click', onRetireConfirm);
    elements.stuckUndo.removeEventListener('click', onStuckUndo);
    elements.stuckRetry.removeEventListener('click', onStuckRetry);
    elements.stuckRetire.removeEventListener('click', onStuckRetire);
    game._updateAnimations = originalUpdateAnimationsMethod;
    game._leavePlay = originalLeavePlayMethod;
    game._configurePlayingMode = originalConfigurePlayingModeMethod;
    hideRetire();
    hideStuck();
    game.__p204Installed = false;
  };

  refresh(true);
  return true;
}
