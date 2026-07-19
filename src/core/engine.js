// 進行状態を持つ GameEngine。操作数・移動距離・タイマー・退場・クリア判定を管理する。
// DOM・Canvas に一切依存しない（rules.js の純粋関数のみ使用）。

import { computeSlide, applySlide, isCleared, legalMovesFor } from './rules.js';

const DEFAULT_HISTORY_LIMIT = 500;

function sanitizeNow(now) {
  return Number.isFinite(now) && now >= 0 ? now : 0;
}

export class GameEngine {
  constructor(board, meta = {}) {
    this.board = board;
    this.meta = meta;
    this.historyLimit = meta.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    this.reset();
  }

  reset() {
    this.positions = this.board.blocks.map((b) => ({ x: b.x, y: b.y }));
    this.swipeCount = 0;
    this.distanceCells = 0;
    this.undoCount = 0;
    this.selectedIndex = -1;
    this.status = 'ready';
    this.startedAt = null;
    this.clearedAt = null;
    this.finalElapsedMs = null;
    this.history = [];
  }

  /** @deprecated v2ではdistanceCellsを使用する。内部コードでは使わない。 */
  get moveCount() { return this.distanceCells; }

  get remainingCount() {
    let count = 0;
    for (const position of this.positions) if (position) count += 1;
    return count;
  }

  get canUndo() {
    return this.status === 'playing' && this.history.length > 0;
  }

  start(now = 0) {
    if (this.status !== 'ready') return false;
    this.startedAt = sanitizeNow(now);
    this.status = 'playing';
    return true;
  }

  elapsedMs(now = 0) {
    if (this.status === 'ready' || this.startedAt == null) return 0;
    if (this.status === 'cleared') return this.finalElapsedMs ?? 0;
    const elapsed = sanitizeNow(now) - this.startedAt;
    return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
  }

  isCleared() { return isCleared(this.positions); }

  hasAnyLegalMove() {
    if (this.status !== 'playing') return false;
    for (let index = 0; index < this.positions.length; index += 1) {
      if (this.positions[index] && legalMovesFor(this.board, this.positions, index).length > 0) return true;
    }
    return false;
  }

  blockAt(x, y) {
    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i];
      if (p && p.x === x && p.y === y) return i;
    }
    return -1;
  }

  select(index) { this.selectedIndex = index; }
  deselect() { this.selectedIndex = -1; }
  legalMovesFor(index) { return legalMovesFor(this.board, this.positions, index); }
  previewSlide(index, dir) { return computeSlide(this.board, this.positions, index, dir); }

  _pushHistory() {
    this.history.push({
      positions: this.positions.map((p) => (p ? { x: p.x, y: p.y } : null)),
      swipeCount: this.swipeCount,
      distanceCells: this.distanceCells,
      status: this.status,
    });
    if (this.history.length > this.historyLimit) this.history.shift();
  }

  tryMove(index, dir, now = 0) {
    if (this.status === 'cleared') return { moved: false, steps: 0, exit: false, cleared: true };
    if (this.status !== 'playing') return { moved: false, steps: 0, exit: false, cleared: false };
    const applied = applySlide(this.board, this.positions, index, dir);
    if (!applied) return { moved: false, steps: 0, exit: false, cleared: false };

    this._pushHistory();
    this.positions = applied.positions;
    this.swipeCount += 1;
    this.distanceCells += applied.steps;

    const cleared = this.isCleared();
    if (cleared) {
      this.clearedAt = sanitizeNow(now);
      this.finalElapsedMs = this.elapsedMs(this.clearedAt);
      this.status = 'cleared';
    }
    return { moved: true, steps: applied.steps, exit: applied.exit, cleared };
  }

  undo() {
    if (this.status !== 'playing' || this.history.length === 0) {
      return { undone: false };
    }
    const prev = this.history.pop();
    this.positions = prev.positions.map((p) => (p ? { x: p.x, y: p.y } : null));
    this.swipeCount = prev.swipeCount;
    this.distanceCells = prev.distanceCells;
    this.status = 'playing';
    this.undoCount += 1;
    this.selectedIndex = -1;
    return { undone: true };
  }

  getFrameState() {
    return {
      board: this.board,
      positions: this.positions,
      swipeCount: this.swipeCount,
      distanceCells: this.distanceCells,
      undoCount: this.undoCount,
      remainingCount: this.remainingCount,
      canUndo: this.canUndo,
      status: this.status,
      selectedIndex: this.selectedIndex,
      cleared: this.status === 'cleared',
    };
  }
}
