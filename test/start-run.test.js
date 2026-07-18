import test from 'node:test';
import assert from 'node:assert/strict';
import { RunController } from '../src/app/run-controller.js';
import { startPreparedRun } from '../src/app/start-run.js';

class FakeEngine {
  constructor() {
    this.status = 'ready';
    this.startedAt = null;
    this.resets = 0;
    this.failStart = false;
  }

  start(now) {
    if (this.failStart || this.status !== 'ready') return false;
    this.status = 'playing';
    this.startedAt = now;
    return true;
  }

  reset() {
    this.status = 'ready';
    this.startedAt = null;
    this.resets += 1;
  }
}

test('GameEngineとRunControllerを同じ時刻で一度だけ開始する', () => {
  const engine = new FakeEngine();
  const runs = new RunController();
  const prepared = runs.prepare({ mode: 'daily' });
  const result = startPreparedRun({ engine, runController: runs, playId: prepared.run.playId, now: 1200 });
  assert.equal(result.accepted, true);
  assert.equal(engine.startedAt, 1200);
  assert.equal(runs.snapshot().startedAt, 1200);
  assert.equal(startPreparedRun({ engine, runController: runs, playId: prepared.run.playId, now: 1300 }).accepted, false);
  assert.equal(engine.startedAt, 1200);
});

test('古いplayIdではGameEngineを開始しない', () => {
  const engine = new FakeEngine();
  const runs = new RunController();
  const first = runs.prepare({});
  runs.prepare({});
  const result = startPreparedRun({ engine, runController: runs, playId: first.run.playId, now: 10 });
  assert.equal(result.reason, 'stale-play');
  assert.equal(engine.status, 'ready');
});

test('不正な時刻を拒否する', () => {
  const engine = new FakeEngine();
  const runs = new RunController();
  const prepared = runs.prepare({});
  assert.equal(startPreparedRun({ engine, runController: runs, playId: prepared.run.playId, now: NaN }).reason, 'invalid-time');
  assert.equal(engine.status, 'ready');
});

test('RunController開始に失敗した場合はGameEngineをreadyへ戻す', () => {
  const engine = new FakeEngine();
  const runs = new RunController();
  const prepared = runs.prepare({});
  const originalStart = runs.start.bind(runs);
  runs.start = () => ({ accepted: false, reason: 'simulated' });
  const result = startPreparedRun({ engine, runController: runs, playId: prepared.run.playId, now: 50 });
  assert.equal(result.reason, 'run-start-failed');
  assert.equal(engine.status, 'ready');
  assert.equal(engine.resets, 1);
  runs.start = originalStart;
});
