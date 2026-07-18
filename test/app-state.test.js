import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_STATES, allowedTransitionsFrom, canTransition, isAppState } from '../src/app/app-state.js';
import { AppController } from '../src/app/app-controller.js';

test('v2の全画面状態を識別できる', () => {
  for (const state of Object.values(APP_STATES)) assert.equal(isAppState(state), true);
  assert.equal(isAppState('unknown'), false);
});

test('許可された画面遷移だけを受け付ける', () => {
  assert.equal(canTransition(APP_STATES.HOME, APP_STATES.NAME_CONFIRM), true);
  assert.equal(canTransition(APP_STATES.HOME, APP_STATES.PLAYING), false);
  assert.equal(canTransition(APP_STATES.PLAYING, APP_STATES.RESULT), true);
  assert.deepEqual(allowedTransitionsFrom(APP_STATES.RULES), [APP_STATES.HOME]);
});

test('AppControllerは成功した遷移だけで世代を進める', () => {
  const app = new AppController();
  assert.equal(app.state, APP_STATES.HOME);
  assert.equal(app.version, 0);

  const forbidden = app.transition(APP_STATES.PLAYING);
  assert.equal(forbidden.accepted, false);
  assert.equal(forbidden.reason, 'forbidden-transition');
  assert.equal(app.version, 0);

  const moved = app.transition(APP_STATES.NAME_CONFIRM, { source: 'start' });
  assert.equal(moved.accepted, true);
  assert.equal(moved.previous, APP_STATES.HOME);
  assert.equal(app.state, APP_STATES.NAME_CONFIRM);
  assert.equal(app.version, 1);
  assert.equal(app.isCurrent(0), false);
  assert.equal(app.isCurrent(1), true);
});

test('同じ状態への遷移と未知状態を拒否する', () => {
  const app = new AppController(APP_STATES.PLAYING);
  assert.equal(app.transition(APP_STATES.PLAYING).reason, 'same-state');
  assert.equal(app.transition('broken').reason, 'unknown-state');
  assert.equal(app.state, APP_STATES.PLAYING);
  assert.equal(app.version, 0);
});

test('購読解除とdestroy後は古いイベントを流さない', () => {
  const app = new AppController();
  const events = [];
  const unsubscribe = app.subscribe((event) => events.push(event.state));
  app.transition(APP_STATES.RULES);
  unsubscribe();
  app.transition(APP_STATES.HOME);
  assert.deepEqual(events, [APP_STATES.RULES]);

  const version = app.version;
  assert.equal(app.destroy(), true);
  assert.equal(app.isCurrent(version), false);
  assert.equal(app.transition(APP_STATES.NAME_CONFIRM).reason, 'destroyed');
  assert.equal(app.destroy(), false);
});

test('購読者の例外で状態遷移を壊さない', () => {
  const app = new AppController();
  app.subscribe(() => { throw new Error('listener failure'); });
  const result = app.transition(APP_STATES.NAME_CONFIRM);
  assert.equal(result.accepted, true);
  assert.equal(app.state, APP_STATES.NAME_CONFIRM);
});
