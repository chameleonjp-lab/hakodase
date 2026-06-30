// 進行状態を持つ GameEngine。手数・タイマー・クリア判定を管理する。
// DOM・Canvas に一切依存しない（rules.js の純粋関数のみ使用）。

import { legalMove, applyMove, isCleared, isBlockOnGoal, legalMovesFor } from './rules.js';

export class GameEngine {
  /**
   * @param {object} board 静的盤面（blocks に初期位置）
   * @param {object} [meta] { seed, difficulty, shortestSolutionMoves }
   */
  constructor(board, meta = {}) {
    this.board = board;
    this.meta = meta;
    this.reset();
  }

  reset() {
    this.positions = this.board.blocks.map((b) => ({ x: b.x, y: b.y }));
    this.moveCount = 0;
    this.selectedIndex = -1;
    this.startedAt = null; // 最初の操作で開始
    this.clearedAt = null;
  }

  /** 経過ミリ秒（未開始なら 0、クリア後は確定値） */
  elapsedMs(now = Date.now()) {
    if (this.startedAt == null) return 0;
    if (this.clearedAt != null) return this.clearedAt - this.startedAt;
    return now - this.startedAt;
  }

  isCleared() {
    return isCleared(this.board, this.positions);
  }

  /** 指定セルにいるブロック番号（無ければ -1） */
  blockAt(x, y) {
    for (let i = 0; i < this.positions.length; i++) {
      if (this.positions[i].x === x && this.positions[i].y === y) return i;
    }
    return -1;
  }

  select(index) {
    this.selectedIndex = index;
  }
  deselect() {
    this.selectedIndex = -1;
  }

  /** あるブロックが対応ゴール上か */
  isBlockSatisfied(index) {
    return isBlockOnGoal(this.board, this.positions, index);
  }

  legalMovesFor(index) {
    return legalMovesFor(this.board, this.positions, this.moveCount, index);
  }

  /**
   * index のブロックを dir に 1 マス動かす。
   * @returns {{ moved: boolean, cleared: boolean }}
   */
  tryMove(index, dir, now = Date.now()) {
    if (this.clearedAt != null) return { moved: false, cleared: true };
    if (!legalMove(this.board, this.positions, this.moveCount, index, dir)) {
      return { moved: false, cleared: false };
    }
    // 最初の操作でタイマー開始。
    if (this.startedAt == null) this.startedAt = now;

    const next = applyMove(this.board, this.positions, this.moveCount, index, dir);
    this.positions = next.positions;
    this.moveCount = next.moveCount;

    const cleared = this.isCleared();
    if (cleared && this.clearedAt == null) {
      this.clearedAt = now;
    }
    return { moved: true, cleared };
  }

  /**
   * 描画用スナップショット（読み取り専用想定）。
   */
  getFrameState() {
    return {
      board: this.board,
      positions: this.positions,
      moveCount: this.moveCount,
      selectedIndex: this.selectedIndex,
      cleared: this.clearedAt != null,
      satisfied: this.positions.map((_, i) => this.isBlockSatisfied(i)),
    };
  }
}
