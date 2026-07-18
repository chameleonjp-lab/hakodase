import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_STATES } from '../src/app/app-state.js';
import { AppController } from '../src/app/app-controller.js';
import { RunController } from '../src/app/run-controller.js';
import { GAME_MODES } from '../src/app/modes.js';
import { installCountdownFlow } from '../src/ui/countdown-flow.js';

class FakeScheduler {
  constructor() { this.nextId = 1; this.tasks = []; }
  schedule = (callback) => { const id = this.nextId++; this.tasks.push({ id, callback, cancelled: false }); return id; };
  cancel = (id) => { const task = this.tasks.find((item) => item.id === id); if (task) task.cancelled = true; };
  flushAll() { while (this.tasks.length) { const task = this.tasks.shift(); if (!task.cancelled) task.callback(); } }
}

class FakeElement {
  constructor() { this.hidden = false; this.textContent = ''; this.dataset = {}; this.listeners = new Map(); this.offsetWidth = 100; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { this.listeners.get('click')?.({ preventDefault() {} }); }
}

class FakeDocument {
  constructor() {
    this.hidden = false;
    this.listeners = new Map();
    this.elements = new Map([
      ['countdownMode', new FakeElement()],
      ['countdownValue', new FakeElement()],
      ['countdownHint', new FakeElement()],
      ['countdownCancel', new FakeElement()],
      ['startFlash', new FakeElement()],
    ]);
    this.elements.get('startFlash').hidden = true;
  }
  getElementById(id) { return this.elements.get(id) || null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  dispatch(type) { this.listeners.get(type)?.(); }
}

class FakeEngine {
  constructor() { this.status = 'ready'; this.startedAt = null; }
  start(now) { if (this.status !== 'ready') return false; this.status = 'playing'; this.startedAt = now; return true; }
  reset() { this.status = 'ready'; this.startedAt = null; }
  getFrameState() { return { status: this.status }; }
}

function createHarness(mode = GAME_MODES.DAILY) {
  const scheduler = new FakeScheduler();
  const documentRef = new FakeDocument();
  const frames = [];
  const game = {
    appController: new AppController(APP_STATES.NAME_CONFIRM),
    runController: new RunController(),
    selectedMode: mode,
    playerName: '出荷係',
    activeMode: null,
    activeRunConfig: null,
    currentPlayId: null,
    difficulty: 'normal',
    pendingStart: null,
    engine: null,
    meta: null,
    view: [], target: [], exiting: [], particles: [], preview: null,
    inputLocked: true,
    renderer: { calls: 0, render() { this.calls += 1; } },
    _configurePlayingMode() {},
    _fit() {},
    _setHomeMessage(text, kind) { this.homeMessage = { text, kind }; },
    newBoard(difficulty, seed, playId) {
      this.meta = { difficulty, seed };
      this.engine = new FakeEngine();
      this.view = [{ x: 0, y: 0 }];
      this.target = [{ x: 0, y: 0 }];
      this.exiting = [false];
      this.pendingStart = { playId };
    },
  };
  const installed = installCountdownFlow(game, {
    documentRef,
    requestFrame: (callback) => { frames.push(callback); },
    schedule: scheduler.schedule,
    cancelSchedule: scheduler.cancel,
    now: () => 777,
  });
  assert.equal(installed, true);
  return { game, scheduler, documentRef, frames };
}

test('盤面をreadyで準備し、STARTまで時計と入力を開始しない', () => {
  const { game, scheduler, frames, documentRef } = createHarness();
  assert.equal(game._prepareSelectedMode(), true);
  assert.equal(game.appController.state, APP_STATES.COUNTDOWN);
  assert.equal(game.runController.status, 'prepared');
  assert.equal(game.engine.status, 'ready');
  assert.equal(game.inputLocked, true);
  assert.equal(game.pendingStart, null);
  assert.equal(documentRef.getElementById('countdownValue').textContent, '3');

  scheduler.flushAll();
  assert.equal(frames.length, 1);
  assert.equal(game.engine.status, 'ready');
  frames.shift()(5000);

  assert.equal(game.appController.state, APP_STATES.PLAYING);
  assert.equal(game.runController.status, 'playing');
  assert.equal(game.engine.status, 'playing');
  assert.equal(game.runController.snapshot().startedAt, 5000);
  assert.equal(game.engine.startedAt, 5000);
  assert.equal(game.inputLocked, false);
  assert.equal(game.renderer.calls, 1);
});

test('カウントダウン中の中止で古いタイマーが開始しない', () => {
  const { game, scheduler, frames, documentRef } = createHarness(GAME_MODES.ENDLESS);
  game._prepareSelectedMode();
  documentRef.getElementById('countdownCancel').click();
  scheduler.flushAll();
  assert.equal(frames.length, 0);
  assert.equal(game.appController.state, APP_STATES.HOME);
  assert.equal(game.runController.status, 'invalidated');
  assert.equal(game.engine, null);
});

test('本日の出荷は画面が隠れた時に試行を無効化する', () => {
  const { game, scheduler, frames, documentRef } = createHarness(GAME_MODES.DAILY);
  game._prepareSelectedMode();
  documentRef.hidden = true;
  documentRef.dispatch('visibilitychange');
  scheduler.flushAll();
  assert.equal(frames.length, 0);
  assert.equal(game.appController.state, APP_STATES.HOME);
  assert.equal(game.runController.status, 'invalidated');
  assert.match(game.homeMessage.text, /無効/);
});

test('エンドレスは画面非表示だけでは試行を無効化しない', () => {
  const { game, documentRef } = createHarness(GAME_MODES.ENDLESS);
  game._prepareSelectedMode();
  documentRef.hidden = true;
  documentRef.dispatch('visibilitychange');
  assert.equal(game.appController.state, APP_STATES.COUNTDOWN);
  assert.equal(game.runController.status, 'prepared');
});
