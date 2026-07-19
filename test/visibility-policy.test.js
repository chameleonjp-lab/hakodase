import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_STATES } from '../src/app/app-state.js';
import { RUN_STATUS } from '../src/app/run-controller.js';
import { shouldInvalidateOnHidden } from '../src/app/visibility-policy.js';

test('厳格時計の準備中とプレイ中だけ非表示で無効化する', () => {
  assert.equal(shouldInvalidateOnHidden({ strictClock: true, appState: APP_STATES.COUNTDOWN, runStatus: RUN_STATUS.PREPARED }), true);
  assert.equal(shouldInvalidateOnHidden({ strictClock: true, appState: APP_STATES.PLAYING, runStatus: RUN_STATUS.PLAYING }), true);
});

test('練習・エンドレス相当の非厳格時計は無効化しない', () => {
  assert.equal(shouldInvalidateOnHidden({ strictClock: false, appState: APP_STATES.PLAYING, runStatus: RUN_STATUS.PLAYING }), false);
});

test('クリア後やホームでは無効化しない', () => {
  assert.equal(shouldInvalidateOnHidden({ strictClock: true, appState: APP_STATES.PLAYING, runStatus: RUN_STATUS.CLEARED }), false);
  assert.equal(shouldInvalidateOnHidden({ strictClock: true, appState: APP_STATES.HOME, runStatus: RUN_STATUS.PREPARED }), false);
});
