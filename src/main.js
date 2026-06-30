// 統合とゲームループ。各モジュールを配線する。
// データの流れ: 入力 → GameEngine → frameState → CanvasRenderer（一方向）。

import { generateBoard, DIFFICULTIES } from './core/generator.js';
import { GameEngine } from './core/engine.js';
import { CanvasRenderer } from './render/canvas-renderer.js';
import { PointerInput } from './input/pointer-input.js';
import { HUD } from './ui/hud.js';
import { LocalRankingService } from './services/ranking.js';
import { PALETTE } from './core/palette.js';

const EASING = 0.35;
const GRAVITY = 9; // パーティクル用（cell/sec^2）

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
    this.view = []; // 表示用の float セル座標
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.particles = [];
    this.lastTs = 0;
    this.savedThisRound = false;

    this._setupControls();
    this._setupInput();
    this._setupResize();

    this.newBoard(this.difficulty);
    requestAnimationFrame((t) => this._loop(t));

    // デバッグ/動作確認用にインスタンスを公開（無害な参照のみ）。
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
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        await this.ranking.clearScores();
        await this._refreshRanking();
      });
    }
    const seedForm = document.getElementById('seedForm');
    if (seedForm) {
      seedForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = document.getElementById('seedInput').value.trim();
        if (v) this.newBoard(this.difficulty, v);
      });
    }
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
        }
        return idx;
      },
      onDragMove: (index, dxPx, dyPx) => {
        const L = this.renderer.getLayout();
        if (!L) return;
        const ax = Math.abs(dxPx);
        const ay = Math.abs(dyPx);
        // 主軸方向にだけ最大0.85セルまで追従。
        if (ax >= ay) {
          this.dragOffset = { x: clamp(dxPx / L.cell, -0.85, 0.85), y: 0 };
        } else {
          this.dragOffset = { x: 0, y: clamp(dyPx / L.cell, -0.85, 0.85) };
        }
      },
      onRelease: (index, dir) => {
        this.dragOffset = { x: 0, y: 0 };
        this.dragIndex = -1;
        if (dir) {
          const res = this.engine.tryMove(index, dir);
          this.hud.setMoves(this.engine.moveCount);
          if (res.cleared) this._onClear();
        }
        this.engine.deselect();
      },
      onTapEmpty: () => {
        if (this.engine) this.engine.deselect();
      },
    });
  }

  _setupResize() {
    const fit = () => {
      const wrap = this.canvas.parentElement;
      const cssW = wrap.clientWidth;
      // 盤面はできるだけ正方形に。高さは画面に合わせて上限。
      const cssH = Math.min(cssW, Math.max(220, window.innerHeight * 0.6));
      this.renderer.resize({ cssWidth: cssW, cssHeight: cssH });
    };
    fit();
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(fit);
      this._ro.observe(this.canvas.parentElement);
    }
    window.addEventListener('resize', fit);
  }

  newBoard(difficulty, seed) {
    const s = seed != null ? seed : randomSeed();
    this.meta = generateBoard({ seed: s, difficulty });
    this.engine = new GameEngine(this.meta.board, this.meta);
    this._resetView(true);
    this.particles = [];
    this.savedThisRound = false;
    this.hud.setMoves(0);
    this.hud.setTime(0);
    this.hud.setTarget(this.meta.shortestSolutionMoves, this.meta.exact);
    this.hud.setSeed(this.meta.seed);
    const cfg = DIFFICULTIES[difficulty];
    this.hud.message(
      cfg.ranking ? 'ドラッグで箱を同色の搬出口へ。最短20手以上の出題です。' : 'ドラッグで箱を同色の搬出口へ。',
      'info'
    );
    this._refreshRanking();
  }

  retry() {
    if (!this.engine) return;
    this.engine.reset();
    this._resetView(true);
    this.particles = [];
    this.savedThisRound = false;
    this.hud.setMoves(0);
    this.hud.setTime(0);
    this.hud.message('やりなおし。タイマーは最初の操作で再スタートします。', 'info');
  }

  _resetView() {
    this.view = this.engine.positions.map((p) => ({ x: p.x, y: p.y }));
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
  }

  async _onClear() {
    const timeMs = this.engine.elapsedMs();
    this.hud.message(`クリア！ ${(timeMs / 1000).toFixed(2)}秒 / ${this.engine.moveCount}手`, 'success');
    this._spawnParticles();
    if (!this.savedThisRound) {
      this.savedThisRound = true;
      const clearedAt = new Date().toISOString();
      await this.ranking.saveScore({
        seed: this.meta.seed,
        difficulty: this.meta.difficulty,
        timeMs,
        moves: this.engine.moveCount,
        clearedAt,
      });
      await this._refreshRanking(clearedAt);
    }
  }

  async _refreshRanking(highlightAt) {
    const scores = await this.ranking.listScores({ difficulty: this.difficulty, limit: 10 });
    this.hud.renderRanking(scores, { highlightAt });
  }

  _spawnParticles() {
    const board = this.engine.board;
    const count = 90;
    for (let i = 0; i < count; i++) {
      const color = PALETTE[i % Math.max(2, board.blocks.length)];
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
    // 表示位置のイージング。
    const pos = this.engine.positions;
    for (let i = 0; i < pos.length; i++) {
      if (!this.view[i]) this.view[i] = { x: pos[i].x, y: pos[i].y };
      if (i === this.dragIndex) {
        // ドラッグ中はイージングせず指追従。
        this.view[i].x = pos[i].x + this.dragOffset.x;
        this.view[i].y = pos[i].y + this.dragOffset.y;
      } else {
        this.view[i].x += (pos[i].x - this.view[i].x) * EASING;
        this.view[i].y += (pos[i].y - this.view[i].y) * EASING;
        if (Math.abs(this.view[i].x - pos[i].x) < 0.001) this.view[i].x = pos[i].x;
        if (Math.abs(this.view[i].y - pos[i].y) < 0.001) this.view[i].y = pos[i].y;
      }
    }
    // パーティクル。
    if (this.particles.length) {
      for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += GRAVITY * dt;
        p.life -= dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
    }
  }

  _loop(ts) {
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;

    if (this.engine) {
      this._updateAnimations(dt);
      if (this.engine.startedAt != null) {
        this.hud.setTime(this.engine.elapsedMs());
      }
      const fs = this.engine.getFrameState();
      fs.viewPositions = this.view;
      fs.particles = this.particles;
      this.renderer.render(fs);
    }
    requestAnimationFrame((t) => this._loop(t));
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 8);
}

window.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-new
  new Game();
});
