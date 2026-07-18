import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUN_STATUS, RunController } from '../src/app/run-controller.js';

test('prepareごとにplayIdを進め、古いプレイを無効にする', () => {
  const runs = new RunController();
  const first = runs.prepare({ mode: 'endless', seed: 'a' });
  const second = runs.prepare({ mode: 'endless', seed: 'b' });

  assert.equal(first.run.playId, 1);
  assert.equal(second.run.playId, 2);
  assert.equal(second.supersededPlayId, 1);
  assert.equal(runs.isCurrent(1), false);
  assert.equal(runs.isCurrent(2), true);
  assert.equal(runs.start(1, 10).reason, 'stale-play');
});

test('startは現在のpreparedプレイだけを1回開始する', () => {
  const runs = new RunController();
  const { run } = runs.prepare({ mode: 'daily' });
  const started = runs.start(run.playId, 125.5);

  assert.equal(started.accepted, true);
  assert.equal(started.run.status, RUN_STATUS.PLAYING);
  assert.equal(started.run.startedAt, 125.5);
  assert.equal(runs.start(run.playId, 300).reason, 'invalid-status');
  assert.equal(runs.snapshot().startedAt, 125.5);
});

test('クリア結果は1回だけ確定する', () => {
  const runs = new RunController();
  const { run } = runs.prepare({ mode: 'daily' });
  runs.start(run.playId, 100);

  const complete = runs.complete(run.playId, { timeMs: 1234, swipeCount: 20 }, 1334);
  assert.equal(complete.accepted, true);
  assert.equal(complete.run.status, RUN_STATUS.CLEARED);
  assert.equal(complete.run.result.timeMs, 1234);

  const duplicate = runs.complete(run.playId, { timeMs: 999 }, 1500);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, 'already-settled');
  assert.equal(runs.snapshot().result.timeMs, 1234);
});

test('retireとinvalidateはpreparedまたはplayingを終端化する', () => {
  const runs = new RunController();
  const prepared = runs.prepare({ mode: 'practice' }).run;
  const retired = runs.retire(prepared.playId, 'user-retired', 10);
  assert.equal(retired.accepted, true);
  assert.equal(retired.run.status, RUN_STATUS.RETIRED);
  assert.equal(retired.run.reason, 'user-retired');

  const active = runs.prepare({ mode: 'daily' }).run;
  runs.start(active.playId, 20);
  const invalidated = runs.invalidate(active.playId, 'page-hidden', 30);
  assert.equal(invalidated.accepted, true);
  assert.equal(invalidated.run.status, RUN_STATUS.INVALIDATED);
  assert.equal(invalidated.run.reason, 'page-hidden');
  assert.equal(runs.retire(active.playId, 'late').reason, 'already-settled');
});

test('runIfCurrentは古いPromise相当の処理を現在プレイへ作用させない', () => {
  const runs = new RunController();
  const oldId = runs.prepare({ seed: 'old' }).run.playId;
  const newId = runs.prepare({ seed: 'new' }).run.playId;
  const effects = [];

  assert.equal(runs.runIfCurrent(oldId, () => effects.push('old')), false);
  assert.equal(runs.runIfCurrent(newId, (run) => effects.push(run.config.seed)), true);
  assert.deepEqual(effects, ['new']);
});

test('snapshotを書き換えても内部設定と結果を変更できない', () => {
  const runs = new RunController();
  const { run } = runs.prepare({ nested: { value: 1 } });
  const snapshot = runs.snapshot();
  snapshot.config.nested.value = 99;
  assert.equal(runs.snapshot().config.nested.value, 1);

  runs.start(run.playId, 0);
  runs.complete(run.playId, { nested: { value: 2 } }, 10);
  const result = runs.snapshot();
  result.result.nested.value = 77;
  assert.equal(runs.snapshot().result.nested.value, 2);
});

test('購読解除とdestroyで古い世代を無効化する', () => {
  const runs = new RunController();
  const events = [];
  const unsubscribe = runs.subscribe((event) => events.push(event.type));
  const { run } = runs.prepare();
  runs.start(run.playId, 0);
  unsubscribe();
  runs.complete(run.playId, {}, 1);
  assert.deepEqual(events, ['prepared', 'started']);

  assert.equal(runs.destroy(), true);
  assert.equal(runs.isCurrent(run.playId), false);
  assert.equal(runs.prepare().reason, 'destroyed');
  assert.equal(runs.destroy(), false);
});

test('購読者の例外でプレイ状態を壊さない', () => {
  const runs = new RunController();
  runs.subscribe(() => { throw new Error('listener failure'); });
  const prepared = runs.prepare();
  assert.equal(prepared.accepted, true);
  assert.equal(runs.start(prepared.run.playId, 1).accepted, true);
  assert.equal(runs.status, RUN_STATUS.PLAYING);
});
