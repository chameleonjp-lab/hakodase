// ページが隠れた時に試行を無効化する条件。DOMへ依存しない。

import { APP_STATES } from './app-state.js';
import { RUN_STATUS } from './run-controller.js';

const ACTIVE_APP_STATES = new Set([APP_STATES.COUNTDOWN, APP_STATES.PLAYING]);
const ACTIVE_RUN_STATES = new Set([RUN_STATUS.PREPARED, RUN_STATUS.PLAYING]);

export function shouldInvalidateOnHidden({ strictClock, appState, runStatus } = {}) {
  return strictClock === true
    && ACTIVE_APP_STATES.has(appState)
    && ACTIVE_RUN_STATES.has(runStatus);
}
