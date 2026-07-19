import test from 'node:test';
import assert from 'node:assert/strict';
import { installPlayingControls } from '../src/ui/playing-controls.js';

class FakeElement {
  constructor() {
    this.hidden = true;
    this.disabled = false;
    this.textContent = '';
    this.listeners = new Map();
    this.focused = false;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  click() { for (const listener of [...(this.listeners.get('click') || [])]) listener({}); }
  focus() { this.focused = true; }
}

function createFixture({ hasLegalMove = true, canUndo = true } = {}) {
  const ids = ['remaining', 'undoCount', 'undoButton', 'retry', 'playHome', 'retireConfirm', 'retireContinue', 'retireConfirmButton', 'stuckPanel', 'stuckUndo', 'stuckRetry', 'stuckRetire'];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  const documentRef = { getElementById(id) { return elements[id] || null; } };
  const listeners = new Set();
  const appController = {
    state: 'playing',
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const runController = {
    status: 'playing', retired: 0,
    isPlaying(playId) { return playId === 1 && this.status === 'playing'; },
    isCurrent(playId) { return playId === 1; },
    retire(playId) {
      if (!this.isPlaying(playId)) return { accepted: false };
      this.status = 'retired';
      this.retired += 1;
      return { accepted: true };
    },
  };
  let legal = hasLegalMove;
  const engine = {
    status: 'playing',
    remainingCount: 2,
    undoCount: 0,
    history: canUndo ? [{}] : [],
    canUndo,
    board: { blocks: [{}, {}] },
    positions: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    hasAnyLegalMove() { return legal; },
    undo() {
      if (!this.canUndo) return { undone: false };
      this.history = [];
      this.canUndo = false;
      this.undoCount += 1;
      legal = true;
      return { undone: true };
    },
    deselect() {},
  };
  const messages = [];
  const game = {
    engine,
    appController,
    runController,
    currentPlayId: 1,
    inputLocked: false,
    view: [], target: [], exiting: [], particles: [], dragIndex: -1, dragOffset: {}, preview: null,
    hud: {
      els: {},
      setRemaining(value, total) { this.remaining = [value, total]; },
      setUndoCount(value) { this.undo = value; },
      setStats(swipes, distance) { this.stats = [swipes, distance]; },
      message(text, kind) { messages.push([text, kind]); },
    },
    _updateAnimations() {},
    _configurePlayingMode() {},
    _leavePlay() { this.left = (this.left || 0) + 1; },
    _setHomeMessage(text, kind) { this.homeMessage = [text, kind]; },
    retry() { this.retried = (this.retried || 0) + 1; },
  };
  return { game, elements, documentRef, messages };
}

test('undoで論理位置と表示位置を同期し、タイマーを戻さない案内を出す', () => {
  const { game, elements, documentRef, messages } = createFixture();
  assert.equal(installPlayingControls(game, { documentRef, now: () => 100 }), true);
  assert.equal(elements.undoButton.disabled, false);
  elements.undoButton.click();
  assert.equal(game.engine.undoCount, 1);
  assert.deepEqual(game.view, game.engine.positions);
  assert.match(messages.at(-1)[0], /タイマーは進み続けます/);
});

test('リタイアは確認後に一度だけ終端化してホームへ戻る', () => {
  const { game, elements, documentRef } = createFixture();
  installPlayingControls(game, { documentRef, now: () => 200 });
  assert.equal(game._leavePlay(), true);
  assert.equal(elements.retireConfirm.hidden, false);
  assert.equal(game.runController.retired, 0);
  elements.retireConfirmButton.click();
  assert.equal(game.runController.retired, 1);
  assert.equal(game.left, 1);
  assert.match(game.homeMessage[0], /記録されません/);
});

test('合法手0件で詰み案内を出し、詰み画面からundoできる', () => {
  const { game, elements, documentRef } = createFixture({ hasLegalMove: false, canUndo: true });
  installPlayingControls(game, { documentRef });
  assert.equal(elements.stuckPanel.hidden, false);
  assert.equal(game.inputLocked, true);
  elements.stuckUndo.click();
  assert.equal(elements.stuckPanel.hidden, true);
  assert.equal(game.engine.undoCount, 1);
  assert.equal(game.inputLocked, false);
});

test('destroyでイベントとラッパーを解除する', () => {
  const { game, documentRef } = createFixture();
  const original = game._leavePlay;
  installPlayingControls(game, { documentRef });
  assert.notEqual(game._leavePlay, original);
  game.destroyPlayingControls();
  assert.equal(game._leavePlay, original);
  assert.equal(game.__p204Installed, false);
});
