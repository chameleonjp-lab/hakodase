import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePlayControlState } from '../src/app/play-control-policy.js';

const live = {
  appState: 'playing',
  runStatus: 'playing',
  engineStatus: 'playing',
  remainingCount: 2,
  historyLength: 1,
  hasLegalMove: true,
};

test('プレイ中かつ非ロック時だけ主要操作を許可する', () => {
  const state = derivePlayControlState(live);
  assert.equal(state.canUndo, true);
  assert.equal(state.canRetry, true);
  assert.equal(state.canRetire, true);
});

test('入力ロック中は主要操作を止める', () => {
  const state = derivePlayControlState({ ...live, inputLocked: true });
  assert.equal(state.canUndo, false);
  assert.equal(state.canRetry, false);
  assert.equal(state.canRetire, false);
});

test('履歴なしではundoできない', () => {
  assert.equal(derivePlayControlState({ ...live, historyLength: 0 }).canUndo, false);
});

test('残り箱があり合法手0件なら詰み表示を要求する', () => {
  assert.equal(derivePlayControlState({ ...live, hasLegalMove: false }).shouldShowStuck, true);
});

test('クリア済みや確認パネル表示中は詰み表示を要求しない', () => {
  assert.equal(derivePlayControlState({ ...live, engineStatus: 'cleared', hasLegalMove: false }).shouldShowStuck, false);
  assert.equal(derivePlayControlState({ ...live, dialogOpen: true, hasLegalMove: false }).shouldShowStuck, false);
});
