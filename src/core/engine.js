// 進行状態を持つ GameEngine。手数（通過マス数）・タイマー・退場・クリア判定を管理する。
// DOM・Canvas に一切依存しない（rules.js の純粋関数のみ使用）。

import { computeSlide, applySlide, isCleared, legalMovesFor } from './rules.js';

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

  elapsedMs(now = Date.now()) {
    if (this.startedAt == null) return 0;
    if (this.clearedAt != null) return this.clearedAt - this.startedAt;
    return now - this.startedAt;
  }

  isCleared() {
    return isCleared(this.positions);
  }

  /** 指定セルにいる（退場していない）ブロック番号（無ければ -1） */
  blockAt(x, y) {
    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i];
      if (p && p.x === x && p.y === y) return i;
    }
    return -1;
  }

  select(index) { this.selectedIndex = index; }
  deselect() { this.selectedIndex = -1; }

  legalMovesFor(index) {
    return legalMovesFor(this.board, this.positions, index);
  }

  /** スライド結果を覗き見る（アニメーション用。状態は変えない）。 */
  previewSlide(index, dir) {
    return computeSlide(this.board, this.positions, index, dir);
  }

  /**
   * index のブロックを dir にスライドする。
   * @returns {{ moved:boolean, steps:number, exit:boolean, cleared:boolean }}
   */
  tryMove(index, dir, now = Date.now()) {
    if (this.clearedAt != null) return { moved: false, steps: 0, exit: false, cleared: true };
    const applied = applySlide(this.board, this.positions, index, dir);
    if (!applied) return { moved: false, steps: 0, exit: false, cleared: false };

    if (this.startedAt == null) this.startedAt = now;
    this.positions = applied.positions;
    this.moveCount += applied.steps;

    const cleared = this.isCleared();
    if (cleared && this.clearedAt == null) this.clearedAt = now;
    return { moved: true, steps: applied.steps, exit: applied.exit, cleared };
  }

  /** 描画用スナップショット（読み取り専用想定）。 */
  getFrameState() {
    return {
      board: this.board,
      positions: this.positions,
      moveCount: this.moveCount,
      selectedIndex: this.selectedIndex,
      cleared: this.clearedAt != null,
    };
  }
}
