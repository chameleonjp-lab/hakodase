// P2-04のプレイ操作可否と詰み表示条件。DOM・Canvas・保存・通信へ依存しない。

import { APP_STATES } from './app-state.js';
import { RUN_STATUS } from './run-controller.js';

export function derivePlayControlState({
  appState,
  runStatus,
  engineStatus,
  inputLocked = false,
  historyLength = 0,
  remainingCount = 0,
  hasLegalMove = true,
  dialogOpen = false,
} = {}) {
  const active = appState === APP_STATES.PLAYING
    && runStatus === RUN_STATUS.PLAYING
    && engineStatus === 'playing';
  const safeHistory = Number.isInteger(historyLength) && historyLength > 0 ? historyLength : 0;
  const safeRemaining = Number.isInteger(remainingCount) && remainingCount > 0 ? remainingCount : 0;
  const blocked = !active || inputLocked || dialogOpen;

  return Object.freeze({
    active,
    canUndo: !blocked && safeHistory > 0,
    canRetry: !blocked,
    canRetire: !blocked,
    shouldShowStuck: !blocked && safeRemaining > 0 && hasLegalMove === false,
  });
}
