// 統合とゲームループ。各モジュールを配線する。
// データの流れ: 入力 → GameEngine → frameState → CanvasRenderer（一方向）。

import { generateBoard, DIFFICULTIES } from './core/generator.js';
import { GameEngine } from './core/engine.js';
import { CanvasRenderer } from './render/canvas-renderer.js';
import { PointerInput } from './input/pointer-input.js';
import { HUD } from './ui/hud.js';
import { LocalRankingService } from './services/ranking.js';
import { PALETTE } from './core/palette.js';
import { gateForBlock, gateOpeningCell } from './core/rules.js';

const EASING = 0.32;
const GRAVITY = 9;

class Game {
  constructor() {
    this.canvas = document.getElementById('board');
    this.renderer = new CanvasRenderer().init(this.canvas);
    this.ranking = new LocalRankingService();
    this.hud = new HUD({
      time: document.getElementById('time'),
      moves: document.getElementById('moves'),
      target: document.getElementById('target'),
      message: document.getElementById('message'),
      ranking: document.getElementById('ranking'),
      difficulty: document.getElementById('difficulty'),
      seed: document.getElementById('seed'),
    });

    this.difficulty = 'normal';
    this.engine = null;
    this.meta = null;
    this.view = [];     // 表示用 float セル座標（null=退場アニメ完了）
    this.target = [];   // 目標セル座標（退場時はゲート開口=盤外）
    this.exiting = [];  // 退場アニメ中フラグ
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.preview = null;
    this.particles = [];
    this.lastTs = 0;
    this.savedThisRound = false;

    this._setupControls();
    this._setupInput();
    this._setupResize();

    this.newBoard(this.difficulty);
    requestAnimationFrame((t) => this._loop(t));

    if (typeof window !== 'undefined') window.hakodase = this;
  }

  _setupControls() {
    const sel = document.getElementById('difficulty');
    for (const key of Object.keys(DIFFICULTIES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = DIFFICULTIES[key].label;
      if (key === this.difficulty) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      this.difficulty = sel.value;
      this.newBoard(this.difficulty);
    });
    document.getElementById('retry').addEventListener('click', () => this.retry());
    document.getElementById('new').addEventListener('click', () => this.newBoard(this.difficulty));
    const clearBtn = document.getElementById('clearRanking');
    if (clearBtn) clearBtn.addEventListener('click', async () => { await this.ranking.clearScores(); await this._refreshRanking(); });
    const seedForm = document.getElementById('seedForm');
    if (seedForm) seedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = document.getElementById('seedInput').value.trim();
      if (v) this.newBoard(this.difficulty, v);
    });
  }

  _setupInput() {
    this.input = new PointerInput(this.canvas, this.renderer, {
      pickBlockAt: (cell) => {
        if (!this.engine || this.engine.clearedAt != null) return -1;
        const idx = this.engine.blockAt(cell.x, cell.y);
        if (idx >= 0) {
          this.engine.select(idx);
          this.dragIndex = idx;
          this.dragOffset = { x: 0, y: 0 };
          this.preview = null;
        }
        return idx;
      },
      onDragMove: (index, dxPx, dyPx) => {
        const L = this.renderer.getLayout();
        if (!L) return;
        const ax = Math.abs(dxPx), ay = Math.abs(dyPx);
        const dir = ax >= ay ? (dxPx > 0 ? 'right' : 'left') : (dyPx > 0 ? 'down' : 'up');
        // 指追従の小ナッジ（主軸のみ）。
        if (ax >= ay) this.dragOffset = { x: clamp(dxPx / L.cell, -0.6, 0.6), y: 0 };
        else this.dragOffset = { x: 0, y: clamp(dyPx / L.cell, -0.6, 0.6) };
        // 着地プレビュー。
        const thr = Math.max(6, L.cell * 0.18);
        if (ax < thr && ay < thr) { this.preview = null; return; }
        const r = this.engine.previewSlide(index, dir);
        if (!r.legal) { this.preview = null; return; }
        const block = this.engine.board.blocks[index];
        if (r.exit) {
          const gate = gateForBlock(this.engine.board, index);
          this.preview = { color: block.color, dir, exit: true, opening: gateOpeningCell(this.engine.board, gate) };
        } else {
          this.preview = { color: block.color, dir, exit: false, x: r.x, y: r.y };
        }
      },
      onRelease: (index, dir) => {
        this.dragOffset = { x: 0, y: 0 };
        this.dragIndex = -1;
        this.preview = null;
        if (dir) {
          const res = this.engine.tryMove(index, dir);
          if (res.moved) {
            this.hud.setMoves(this.engine.moveCount);
            if (res.exit) this._onExit(index);
            if (res.cleared) this._onClear();
          }
        }
        this.engine.deselect();
      },
      onTapEmpty: () => { if (this.engine) this.engine.deselect(); },
    });
  }

  _setupResize() {
    this._fit = () => {
      const wrap = this.canvas.parentElement;
      const maxW = wrap.clientWidth;
      const board = this.engine ? this.engine.board : null;
      const aspect = board ? board.height / board.width : 1.2;
      let cssW = maxW;
      let cssH = Math.round(cssW * aspect);
      const maxH = Math.round((window.innerHeight || 700) * 0.72);
      if (cssH > maxH) { cssH = maxH; cssW = Math.round(cssH / aspect); }
      this.renderer.resize({ cssWidth: cssW, cssHeight: cssH });
    };
    this._fit();
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._fit());
      this._ro.observe(this.canvas.parentElement);
    }
    window.addEventListener('resize', () => this._fit());
  }

  newBoard(difficulty, seed) {
    const s = seed != null ? seed : randomSeed();
    this.meta = generateBoard({ seed: s, difficulty });
    this.engine = new GameEngine(this.meta.board, this.meta);
    this._resetView();
    this.particles = [];
    this.savedThisRound = false;
    if (this._fit) this._fit(); // 盤面アスペクトに合わせて再フィット
    this.hud.setMoves(0);
    this.hud.setTime(0);
    this.hud.setTarget(this.meta.shortestSolutionMoves, this.meta.exact);
    this.hud.setSeed(this.meta.seed);
    this.hud.message('箱をドラッグ → 壁まで滑る。同じ色（記号）の搬出口から出そう。', 'info');
    this._refreshRanking();
  }

  retry() {
    if (!this.engine) return;
    this.engine.reset();
    this._resetView();
    this.particles = [];
    this.savedThisRound = false;
    this.hud.setMoves(0);
    this.hud.setTime(0);
    this.hud.message('やりなおし。タイマーは最初の操作で再スタートします。', 'info');
  }

  _resetView() {
    this.view = this.engine.positions.map((p) => ({ x: p.x, y: p.y }));
    this.target = this.engine.positions.map((p) => ({ x: p.x, y: p.y }));
    this.exiting = this.engine.positions.map(() => false);
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.preview = null;
  }

  _onExit(index) {
    // 退場アニメ: ゲート開口（盤外）へ滑らせてから消す。
    const gate = gateForBlock(this.engine.board, index);
    const open = gateOpeningCell(this.engine.board, gate);
    this.target[index] = { x: open.x, y: open.y };
    this.exiting[index] = true;
    this._spawnBurst(open.x, open.y, this.engine.board.blocks[index].color, 16);
  }

  async _onClear() {
    const timeMs = this.engine.elapsedMs();
    this.hud.message(`クリア！ ${(timeMs / 1000).toFixed(2)}秒 / ${this.engine.moveCount}手`, 'success');
    this._spawnParticles();
    if (!this.savedThisRound) {
      this.savedThisRound = true;
      const clearedAt = new Date().toISOString();
      await this.ranking.saveScore({
        seed: this.meta.seed, difficulty: this.meta.difficulty,
        timeMs, moves: this.engine.moveCount, clearedAt,
      });
      await this._refreshRanking(clearedAt);
    }
  }

  async _refreshRanking(highlightAt) {
    const scores = await this.ranking.listScores({ difficulty: this.difficulty, limit: 10 });
    this.hud.renderRanking(scores, { highlightAt });
  }

  _spawnBurst(cx, cy, colorIndex, count) {
    const color = PALETTE[colorIndex % PALETTE.length];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      this.particles.push({
        x: cx + 0.5, y: cy + 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
        size: 0.03 + Math.random() * 0.04, color: color.hex,
      });
    }
  }

  _spawnParticles() {
    const board = this.engine.board;
    for (let i = 0; i < 90; i++) {
      const color = PALETTE[i % Math.max(2, board.blocks.length)];
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: board.width / 2, y: board.height / 2,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
        life: 0.8 + Math.random() * 0.8, maxLife: 1.6,
        size: 0.04 + Math.random() * 0.05, color: color.hex,
      });
    }
  }

  _updateAnimations(dt) {
    const pos = this.engine.positions;
    for (let i = 0; i < this.view.length; i++) {
      if (this.view[i] === null) continue;
      // 目標: 退場中はゲート開口、通常は論理位置。
      if (!this.exiting[i] && pos[i]) this.target[i] = { x: pos[i].x, y: pos[i].y };

      let tx = this.target[i].x, ty = this.target[i].y;
      if (i === this.dragIndex && !this.exiting[i]) { tx += this.dragOffset.x; ty += this.dragOffset.y; }

      this.view[i].x += (tx - this.view[i].x) * EASING;
      this.view[i].y += (ty - this.view[i].y) * EASING;
      if (Math.abs(this.view[i].x - tx) < 0.01) this.view[i].x = tx;
      if (Math.abs(this.view[i].y - ty) < 0.01) this.view[i].y = ty;

      if (this.exiting[i] && Math.abs(this.view[i].x - this.target[i].x) < 0.05 && Math.abs(this.view[i].y - this.target[i].y) < 0.05) {
        this.view[i] = null; // 退場アニメ完了
      }
    }
    if (this.particles.length) {
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAVITY * dt; p.life -= dt; }
      this.particles = this.particles.filter((p) => p.life > 0);
    }
  }

  _loop(ts) {
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;
    if (this.engine) {
      this._updateAnimations(dt);
      if (this.engine.startedAt != null) this.hud.setTime(this.engine.elapsedMs());
      const fs = this.engine.getFrameState();
      fs.viewPositions = this.view;
      fs.particles = this.particles;
      fs.preview = this.preview;
      this.renderer.render(fs);
    }
    requestAnimationFrame((t) => this._loop(t));
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randomSeed() { return Math.random().toString(36).slice(2, 8); }

window.addEventListener('DOMContentLoaded', () => { new Game(); });
