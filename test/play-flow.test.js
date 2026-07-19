import test from 'node:test';
import assert from 'node:assert/strict';
import { AppController } from '../src/app/app-controller.js';
import { APP_STATES } from '../src/app/app-state.js';
import { RunController, RUN_STATUS } from '../src/app/run-controller.js';
import { GameEngine } from '../src/core/engine.js';
import { installPlayFlow } from '../src/ui/play-flow.js';

class FakeElement {
  constructor() {
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.listeners = new Map();
    this.classList = {
      values: new Set(),
      toggle: (name, on) => (on ? this.classList.values.add(name) : this.classList.values.delete(name)),
    };
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((value) => value !== fn));
  }
  dispatch(type, extra = {}) {
    const event = { preventDefault() {}, stopImmediatePropagation() {}, ...extra };
    for (const fn of this.listeners.get(type) || []) fn(event);
  }
  focus() { this.focused = true; }
}

function makeElements() {
  return Object.fromEntries([
    'screenPlaying', 'remaining', 'undo', 'retry', 'new', 'playHome',
    'deadlockPanel', 'retirePanel', 'retireCancel', 'retireConfirm',
  ].map((id) => [id, new FakeElement()]));
}

function fakeDocument() {
  return {
    body: { dataset: {} },
    listeners: new Map(),
    addEventListener(type, fn) { this.listeners.set(type, fn); },
    removeEventListener(type) { this.listeners.delete(type); },
  };
}

function board({ deadlocked = false } = {}) {
  return {
    width: deadlocked ? 1 : 3,
    height: 1,
    walls: new Set(),
    oneway: new Map(),
    gates: [],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
  };
}

function makeGame(options = {}) {
  const appController = new AppController(APP_STATES.PLAYING);
  const runController = new RunController();
  const prepared = runController.prepare({ mode: 'endless' });
  const engine = new GameEngine(board(options));
  engine.start(10);
  runController.start(prepared.run.playId, 10);
  return {
    appController,
    runController,
    currentPlayId: prepared.run.playId,
    engine,
    view: [{ x: 0, y: 0 }],
    target: [{ x: 0, y: 0 }],
    exiting: [false],
    particles: [{}],
    dragIndex: -1,
    dragOffset: { x: 0, y: 0 },
    preview: null,
    inputLocked: false,
    hud: {
      setStats(swipeCount, distanceCells) { this.stats = [swipeCount, distanceCells]; },
      message(text, kind) { this.last = [text, kind]; },
    },
    _updateAnimations() { this.inputLocked = false; },
    _leavePlay() { this.left = true; this.appController.transition(APP_STATES.HOME); },
    _setHomeMessage(text, kind) { this.homeMessage = [text, kind]; },
  };
}

test('undoで表示位置を論理位置へ同期し時計は変更しない', () => {
  const game = makeGame();
  const elements = makeElements();
  installPlayFlow(game, { documentRef: fakeDocument(), elements });
  game.engine.tryMove(0, 'right', 20);
  game.view = [{ x: 2, y: 0 }];
  game._updateAnimations(0.016);
  elements.undo.dispatch('click');
  assert.equal(game.engine.startedAt, 10);
  assert.deepEqual(game.view, [{ x: 0, y: 0 }]);
  assert.deepEqual(game.hud.stats, [0, 0]);
  assert.equal(game.engine.undoCount, 1);
});

test('合法操作0件を詰みとして表示しundoがなければ無効にする', () => {
  const game = makeGame({ deadlocked: true });
  const elements = makeElements();
  installPlayFlow(game, { documentRef: fakeDocument(), elements });
  game._updateAnimations(0.016);
  assert.equal(elements.deadlockPanel.hidden, false);
  assert.equal(game.inputLocked, true);
  assert.equal(elements.undo.disabled, true);
});

test('リタイア確認後にrunをretiredへしてホームへ戻す', () => {
  const game = makeGame();
  const elements = makeElements();
  installPlayFlow(game, { documentRef: fakeDocument(), elements, now: () => 250 });
  elements.playHome.dispatch('click');
  assert.equal(elements.retirePanel.hidden, false);
  elements.retireConfirm.dispatch('click');
  assert.equal(game.runController.status, RUN_STATUS.RETIRED);
  assert.equal(game.left, true);
  assert.deepEqual(game.homeMessage, ['リタイアしました。記録は保存されません。', 'info']);
});

test('リタイア確認を閉じるとプレイを継続する', () => {
  const game = makeGame();
  const elements = makeElements();
  installPlayFlow(game, { documentRef: fakeDocument(), elements });
  elements.playHome.dispatch('click');
  elements.retireCancel.dispatch('click');
  assert.equal(elements.retirePanel.hidden, true);
  assert.equal(game.runController.status, RUN_STATUS.PLAYING);
  assert.equal(Boolean(game.left), false);
});
