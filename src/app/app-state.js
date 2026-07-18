// HAKODASE v2 の画面状態と許可遷移。DOM・Canvas に依存しない。

export const APP_STATES = Object.freeze({
  HOME: 'home',
  NAME_CONFIRM: 'nameConfirm',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  RESULT: 'result',
  RULES: 'rules',
  RANKING: 'ranking',
});

const STATE_VALUES = new Set(Object.values(APP_STATES));

const TRANSITIONS = new Map([
  [APP_STATES.HOME, new Set([APP_STATES.NAME_CONFIRM, APP_STATES.RULES, APP_STATES.RANKING])],
  [APP_STATES.NAME_CONFIRM, new Set([APP_STATES.HOME, APP_STATES.COUNTDOWN])],
  [APP_STATES.COUNTDOWN, new Set([APP_STATES.HOME, APP_STATES.PLAYING])],
  [APP_STATES.PLAYING, new Set([APP_STATES.HOME, APP_STATES.COUNTDOWN, APP_STATES.RESULT])],
  [APP_STATES.RESULT, new Set([APP_STATES.HOME, APP_STATES.COUNTDOWN, APP_STATES.RANKING])],
  [APP_STATES.RULES, new Set([APP_STATES.HOME])],
  [APP_STATES.RANKING, new Set([APP_STATES.HOME, APP_STATES.RESULT])],
]);

export function isAppState(value) {
  return STATE_VALUES.has(value);
}

export function canTransition(from, to) {
  if (!isAppState(from) || !isAppState(to) || from === to) return false;
  return TRANSITIONS.get(from)?.has(to) === true;
}

export function allowedTransitionsFrom(state) {
  if (!isAppState(state)) return [];
  return [...(TRANSITIONS.get(state) || [])];
}
