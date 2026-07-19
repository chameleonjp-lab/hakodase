import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTDOWN_STEPS, CountdownController } from '../src/app/countdown-controller.js';

class FakeScheduler {
  constructor({ ignoreClear = false } = {}) {
    this.nextId = 1;
    this.tasks = [];
    this.ignoreClear = ignoreClear;
  }

  schedule = (callback, delayMs) => {
    const task = { id: this.nextId++, callback, delayMs, cancelled: false };
    this.tasks.push(task);
    return task.id;
  };

  cancel = (id) => {
    if (this.ignoreClear) return;
    const task = this.tasks.find((item) => item.id === id);
    if (task) task.cancelled = true;
  };

  flushNext() {
    const task = this.tasks.shift();
    if (!task) return false;
    if (!task.cancelled) task.callback();
    return true;
  }

  flushAll() {
    while (this.flushNext()) {}
  }
}

test('3・2・1・STARTを順番に一度だけ通知する', () => {
  const fake = new FakeScheduler();
  const steps = [];
  let starts = 0;
  const countdown = new CountdownController({ schedule: fake.schedule, cancelSchedule: fake.cancel, stepMs: 900 });
  const started = countdown.start({ onStep: (step) => steps.push(step), onStart: () => { starts += 1; } });
  assert.equal(started.accepted, true);
  assert.deepEqual(steps, ['3']);
  fake.flushAll();
  assert.deepEqual(steps, COUNTDOWN_STEPS);
  assert.equal(starts, 1);
  assert.equal(countdown.active, false);
});

test('キャンセル後の古いタイマーはSTARTを発火しない', () => {
  const fake = new FakeScheduler({ ignoreClear: true });
  let starts = 0;
  const countdown = new CountdownController({ schedule: fake.schedule, cancelSchedule: fake.cancel });
  countdown.start({ onStart: () => { starts += 1; } });
  assert.equal(countdown.cancel('home'), true);
  fake.flushAll();
  assert.equal(starts, 0);
  assert.equal(countdown.cancel(), false);
});

test('新しいカウントダウンが古い世代を置き換える', () => {
  const fake = new FakeScheduler({ ignoreClear: true });
  const starts = [];
  const countdown = new CountdownController({ schedule: fake.schedule, cancelSchedule: fake.cancel });
  const first = countdown.start({ onStart: () => starts.push('first') });
  const second = countdown.start({ onStart: () => starts.push('second') });
  assert.notEqual(first.token, second.token);
  fake.flushAll();
  assert.deepEqual(starts, ['second']);
});

test('表示側の例外で進行を壊さない', () => {
  const fake = new FakeScheduler();
  let starts = 0;
  const countdown = new CountdownController({ schedule: fake.schedule, cancelSchedule: fake.cancel });
  countdown.start({ onStep: () => { throw new Error('view failure'); }, onStart: () => { starts += 1; } });
  fake.flushAll();
  assert.equal(starts, 1);
});

test('destroy後は開始できず古いタイマーも発火しない', () => {
  const fake = new FakeScheduler({ ignoreClear: true });
  let starts = 0;
  const countdown = new CountdownController({ schedule: fake.schedule, cancelSchedule: fake.cancel });
  countdown.start({ onStart: () => { starts += 1; } });
  assert.equal(countdown.destroy(), true);
  fake.flushAll();
  assert.equal(starts, 0);
  assert.equal(countdown.start({ onStart() {} }).reason, 'destroyed');
  assert.equal(countdown.destroy(), false);
});
