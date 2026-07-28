// P3-05B専用の試遊ランタイム。
// 固定候補をGameEngine・CanvasRenderer・PointerInputで遊べるようにする。
// 候補生成、厳密探索、ランキング送信は行わない。

import { boardDataV2ToRuntime } from '../core/board-data-v2.js';
import { GameEngine } from '../core/engine.js';
import { PALETTE } from '../core/palette.js';
import { gateForBlock, gateOpeningCell } from '../core/rules.js';
import { PointerInput } from '../input/pointer-input.js';
import { approachPoint, clampDt, pointReached } from '../render/animation.js';
import { CanvasRenderer } from '../render/canvas-renderer.js';

const GRAVITY = 9;

function copyPosition(position) {
  return position ? { x: position.x, y: position.y } : null;
}

export class P305ReviewGame {
  constructor({
    canvas,
    onState = () => {},
    onClear = () => {},
    onError = () => {},
    now = () => performance.now(),
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (id) => cancelAnimationFrame(id),
  } = {}) {
    if (!canvas) throw new TypeError('canvas is required');
    this.canvas = canvas;
    this.onState = onState;
    this.onClear = onClear;
    this.onError = onError;
    this.now = now;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;

    this.renderer = new CanvasRenderer().init(canvas);
    this.candidate = null;
    this.engine = null;
    this.view = [];
    this.target = [];
    this.exiting = [];
    this.particles = [];
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.preview = null;
    this.inputLocked = true;
    this.lastFrameAt = 0;
    this.frameId = null;
    this.clearReported = false;

    this.input = new PointerInput(canvas, this.renderer, {
      pickBlockAt: (cell) => this._pickBlockAt(cell),
      onDragMove: (index, dxPx, dyPx) => this._onDragMove(index, dxPx, dyPx),
      onRelease: (index, direction) => this._onRelease(index, direction),
      onCancel: () => this._cancelDrag(),
      onTapEmpty: () => this.engine?.deselect(),
    });

    this._loop = this._loop.bind(this);
    this.frameId = this.requestFrame(this._loop);
  }

  loadCandidate(candidate) {
    if (!candidate?.boardData) throw new TypeError('candidate.boardData is required');
    const board = boardDataV2ToRuntime(candidate.boardData);
    this.candidate = candidate;
    this.engine = new GameEngine(board, {
      optimalSwipes: candidate.optimalSwipes,
      reviewId: candidate.reviewId,
    });
    this.clearReported = false;
    this.inputLocked = true;
    this._syncView();
    this.particles = [];
    this.preview = null;
    this.fit();
    this._emitState();
    return this.snapshot();
  }

  start() {
    if (!this.engine) return false;
    this.engine.reset();
    this._syncView();
    this.particles = [];
    this.preview = null;
    this.clearReported = false;
    const started = this.engine.start(this.now());
    this.inputLocked = !started;
    this._emitState();
    return started;
  }

  restart() {
    return this.start();
  }

  undo() {
    if (!this.engine || this.inputLocked || !this.engine.canUndo) return false;
    const result = this.engine.undo();
    if (!result.undone) return false;
    this._syncView();
    this._emitState();
    return true;
  }

  fit() {
    if (!this.engine) return false;
    const wrap = this.canvas.parentElement;
    const maxWidth = Math.max(240, wrap?.clientWidth || this.canvas.clientWidth || 320);
    const aspect = this.engine.board.height / this.engine.board.width;
    let cssWidth = maxWidth;
    let cssHeight = Math.round(cssWidth * aspect);
    const maxHeight = Math.max(320, Math.round((globalThis.innerHeight || 700) * 0.62));
    if (cssHeight > maxHeight) {
      cssHeight = maxHeight;
      cssWidth = Math.round(cssHeight / aspect);
    }
    this.renderer.resize({ cssWidth, cssHeight });
    return true;
  }

  snapshot() {
    return Object.freeze({
      reviewId: this.candidate?.reviewId ?? null,
      profileId: this.candidate?.profileId ?? null,
      templateId: this.candidate?.templateId ?? null,
      blockCount: this.engine?.board?.blocks?.length ?? 0,
      colorCount: this.engine ? new Set(this.engine.board.blocks.map((block) => block.color)).size : 0,
      optimalSwipes: this.candidate?.optimalSwipes ?? null,
      status: this.engine?.status ?? 'empty',
      timeMs: this.engine?.elapsedMs(this.now()) ?? 0,
      swipeCount: this.engine?.swipeCount ?? 0,
      distanceCells: this.engine?.distanceCells ?? 0,
      undoCount: this.engine?.undoCount ?? 0,
      remainingCount: this.engine?.remainingCount ?? 0,
      canUndo: Boolean(this.engine?.canUndo && !this.inputLocked),
      inputLocked: this.inputLocked,
      cleared: this.engine?.status === 'cleared',
    });
  }

  destroy() {
    this.input?.destroy();
    if (this.frameId != null) this.cancelFrame(this.frameId);
    this.frameId = null;
    this.engine = null;
    this.candidate = null;
  }

  _syncView() {
    const positions = this.engine?.positions ?? [];
    this.view = positions.map(copyPosition);
    this.target = positions.map(copyPosition);
    this.exiting = positions.map(() => false);
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.preview = null;
    this.engine?.deselect();
  }

  _pickBlockAt(cell) {
    if (!this.engine || this.inputLocked || this.engine.status !== 'playing') return -1;
    const index = this.engine.blockAt(cell.x, cell.y);
    if (index >= 0) {
      this.engine.select(index);
      this.dragIndex = index;
      this.dragOffset = { x: 0, y: 0 };
      this.preview = null;
    }
    return index;
  }

  _onDragMove(index, dxPx, dyPx) {
    if (!this.engine || this.inputLocked || this.engine.status !== 'playing') return;
    const layout = this.renderer.getLayout();
    if (!layout) return;
    const ax = Math.abs(dxPx);
    const ay = Math.abs(dyPx);
    const direction = ax >= ay ? (dxPx > 0 ? 'right' : 'left') : (dyPx > 0 ? 'down' : 'up');
    if (ax >= ay) this.dragOffset = { x: Math.max(-0.6, Math.min(0.6, dxPx / layout.cell)), y: 0 };
    else this.dragOffset = { x: 0, y: Math.max(-0.6, Math.min(0.6, dyPx / layout.cell)) };
    const threshold = Math.max(6, layout.cell * 0.18);
    if (ax < threshold && ay < threshold) {
      this.preview = null;
      return;
    }
    const result = this.engine.previewSlide(index, direction);
    if (!result.legal) {
      this.preview = null;
      return;
    }
    const block = this.engine.board.blocks[index];
    if (result.exit) {
      const gate = gateForBlock(this.engine.board, index);
      this.preview = {
        color: block.color,
        dir: direction,
        exit: true,
        opening: gateOpeningCell(this.engine.board, gate),
      };
    } else {
      this.preview = {
        color: block.color,
        dir: direction,
        exit: false,
        x: result.x,
        y: result.y,
      };
    }
  }

  _onRelease(index, direction) {
    this.dragOffset = { x: 0, y: 0 };
    this.dragIndex = -1;
    this.preview = null;
    if (!this.engine || this.inputLocked || this.engine.status !== 'playing') {
      this.engine?.deselect();
      return;
    }
    const result = this.engine.tryMove(index, direction, this.now());
    if (result.moved) {
      this.inputLocked = true;
      if (result.exit) this._beginExit(index);
      if (result.cleared) this._reportClear();
      this._emitState();
    }
    this.engine.deselect();
  }

  _cancelDrag() {
    this.dragOffset = { x: 0, y: 0 };
    this.dragIndex = -1;
    this.preview = null;
    this.engine?.deselect();
  }

  _beginExit(index) {
    const gate = gateForBlock(this.engine.board, index);
    const opening = gateOpeningCell(this.engine.board, gate);
    this.target[index] = { x: opening.x, y: opening.y };
    this.exiting[index] = true;
    this._spawnBurst(opening.x, opening.y, this.engine.board.blocks[index].color, 14);
  }

  _reportClear() {
    if (this.clearReported || !this.engine || this.engine.status !== 'cleared') return;
    this.clearReported = true;
    this._spawnClearParticles();
    const result = Object.freeze({
      reviewId: this.candidate.reviewId,
      timeMs: Math.round(this.engine.finalElapsedMs ?? 0),
      swipeCount: this.engine.swipeCount,
      distanceCells: this.engine.distanceCells,
      undoCount: this.engine.undoCount,
    });
    try {
      this.onClear(result);
    } catch (error) {
      this.onError(error);
    }
  }

  _spawnBurst(cx, cy, colorIndex, count) {
    const color = PALETTE[colorIndex % PALETTE.length];
    for (let index = 0; index < count; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.particles.push({
        x: cx + 0.5,
        y: cy + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 0.03 + Math.random() * 0.04,
        color: color.hex,
      });
    }
  }

  _spawnClearParticles() {
    const board = this.engine.board;
    for (let index = 0; index < 72; index++) {
      const color = PALETTE[index % PALETTE.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: board.width / 2,
        y: board.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life: 0.8 + Math.random() * 0.8,
        maxLife: 1.6,
        size: 0.04 + Math.random() * 0.05,
        color: color.hex,
      });
    }
  }

  _updateAnimations(dt) {
    if (!this.engine) return;
    const positions = this.engine.positions;
    for (let index = 0; index < this.view.length; index++) {
      if (this.view[index] === null) continue;
      if (!this.exiting[index] && positions[index]) this.target[index] = copyPosition(positions[index]);
      let targetX = this.target[index]?.x ?? this.view[index].x;
      let targetY = this.target[index]?.y ?? this.view[index].y;
      if (index === this.dragIndex && !this.exiting[index]) {
        targetX += this.dragOffset.x;
        targetY += this.dragOffset.y;
      }
      this.view[index] = approachPoint(this.view[index], { x: targetX, y: targetY }, dt);
      if (this.exiting[index] && pointReached(this.view[index], this.target[index], 0.01)) {
        this.view[index] = null;
        this.exiting[index] = false;
      }
    }

    if (!this.exiting.some(Boolean) && this.engine.status === 'playing') {
      const animating = this.view.some((position, index) => (
        position && this.target[index] && !pointReached(position, this.target[index], 0.01)
      ));
      if (!animating) this.inputLocked = false;
    }

    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += GRAVITY * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  _emitState() {
    try {
      this.onState(this.snapshot());
    } catch (error) {
      this.onError(error);
    }
  }

  _loop(timestamp) {
    const dt = this.lastFrameAt ? clampDt((timestamp - this.lastFrameAt) / 1000) : 0;
    this.lastFrameAt = timestamp;
    if (this.engine) {
      this._updateAnimations(dt);
      const frameState = this.engine.getFrameState();
      frameState.viewPositions = this.view;
      frameState.particles = this.particles;
      frameState.preview = this.preview;
      this.renderer.render(frameState);
      this._emitState();
    }
    this.frameId = this.requestFrame(this._loop);
  }
}
