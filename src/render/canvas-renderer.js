// Canvas2D 実装。Renderer interface を満たす。画像・外部素材は一切使わない。
// 角丸矩形・影・グラデーション・ハイライト・一方通行矢印・開閉ゲート・パーティクル・点灯演出を描く。

import { Renderer } from './renderer.js';
import { PALETTE } from '../core/palette.js';
import { gateOpen, onewayDirAt, key } from '../core/rules.js';

export class CanvasRenderer extends Renderer {
  init(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = options.devicePixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    this.cssWidth = canvas.clientWidth || 320;
    this.cssHeight = canvas.clientHeight || 320;
    this._layout = null;
    this._layoutKey = '';
    return this;
  }

  resize(viewport) {
    this.cssWidth = viewport.cssWidth;
    this.cssHeight = viewport.cssHeight;
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = this.cssWidth + 'px';
    this.canvas.style.height = this.cssHeight + 'px';
    this._layoutKey = ''; // 再計算を促す
  }

  _computeLayout(board) {
    const k = `${this.cssWidth}x${this.cssHeight}:${board.width}x${board.height}`;
    if (this._layoutKey === k && this._layout) return this._layout;
    const pad = 8;
    const availW = this.cssWidth - pad * 2;
    const availH = this.cssHeight - pad * 2;
    const cell = Math.max(8, Math.floor(Math.min(availW / board.width, availH / board.height)));
    const gridW = cell * board.width;
    const gridH = cell * board.height;
    const originX = Math.floor((this.cssWidth - gridW) / 2);
    const originY = Math.floor((this.cssHeight - gridH) / 2);
    this._layout = { cell, originX, originY, gridW, gridH };
    this._layoutKey = k;
    return this._layout;
  }

  clientToCell(clientX, clientY) {
    if (!this._layout) return null;
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left - this._layout.originX;
    const py = clientY - rect.top - this._layout.originY;
    const cx = Math.floor(px / this._layout.cell);
    const cy = Math.floor(py / this._layout.cell);
    if (cx < 0 || cy < 0) return null;
    if (this._board && (cx >= this._board.width || cy >= this._board.height)) return null;
    return { x: cx, y: cy };
  }

  getLayout() {
    return this._layout;
  }

  render(frameState) {
    const { board } = frameState;
    this._board = board; // clientToCell の境界判定用
    const ctx = this.ctx;
    const L = this._computeLayout(board);

    // 物理ピクセルに合わせてスケール（DPR）。
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    this._drawBackground(ctx);
    this._drawGrid(ctx, board, L);
    this._drawOneways(ctx, board, L);
    this._drawGoals(ctx, board, frameState, L);
    this._drawGates(ctx, board, frameState, L, frameState.moveCount);
    this._drawBlocks(ctx, board, frameState, L);
    if (frameState.particles && frameState.particles.length) {
      this._drawParticles(ctx, frameState.particles, L);
    }
  }

  _drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.cssHeight);
    g.addColorStop(0, '#11151c');
    g.addColorStop(1, '#0b0e13');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  _cellRect(L, x, y) {
    return { px: L.originX + x * L.cell, py: L.originY + y * L.cell, s: L.cell };
  }

  _drawGrid(ctx, board, L) {
    // 盤面ベース。
    ctx.fillStyle = '#1b212b';
    ctx.fillRect(L.originX, L.originY, L.gridW, L.gridH);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= board.width; x++) {
      ctx.beginPath();
      ctx.moveTo(L.originX + x * L.cell + 0.5, L.originY);
      ctx.lineTo(L.originX + x * L.cell + 0.5, L.originY + L.gridH);
      ctx.stroke();
    }
    for (let y = 0; y <= board.height; y++) {
      ctx.beginPath();
      ctx.moveTo(L.originX, L.originY + y * L.cell + 0.5);
      ctx.lineTo(L.originX + L.gridW, L.originY + y * L.cell + 0.5);
      ctx.stroke();
    }
    // 壁。
    if (board.walls) {
      ctx.fillStyle = '#39414e';
      for (const wk of board.walls) {
        const [x, y] = wk.split(',').map(Number);
        const r = this._cellRect(L, x, y);
        ctx.fillRect(r.px + 2, r.py + 2, r.s - 4, r.s - 4);
      }
    }
  }

  _drawOneways(ctx, board, L) {
    if (!board.oneway) return;
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const dir = onewayDirAt(board, x, y);
        if (!dir) continue;
        const r = this._cellRect(L, x, y);
        ctx.fillStyle = 'rgba(90,200,250,0.10)';
        ctx.fillRect(r.px + 1, r.py + 1, r.s - 2, r.s - 2);
        this._drawArrow(ctx, r.px + r.s / 2, r.py + r.s / 2, r.s * 0.28, dir, 'rgba(120,210,255,0.9)');
      }
    }
  }

  _drawArrow(ctx, cx, cy, len, dir, color) {
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const ex = cx + v[0] * len;
    const ey = cy + v[1] * len;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, len * 0.25);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - v[0] * len, cy - v[1] * len);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // 矢じり。
    const a = len * 0.5;
    const perp = [-v[1], v[0]];
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - v[0] * a + perp[0] * a * 0.6, ey - v[1] * a + perp[1] * a * 0.6);
    ctx.lineTo(ex - v[0] * a - perp[0] * a * 0.6, ey - v[1] * a - perp[1] * a * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  _drawGoals(ctx, board, frameState, L) {
    for (const goal of board.goals) {
      const color = PALETTE[goal.color % PALETTE.length];
      const r = this._cellRect(L, goal.x, goal.y);
      const inset = r.s * 0.12;
      // 点灯: 対応ブロックが乗っていれば光らせる。
      const lit = this._goalSatisfied(board, frameState, goal);
      ctx.save();
      if (lit) {
        ctx.shadowColor = color.hex;
        ctx.shadowBlur = r.s * 0.5;
      }
      ctx.lineWidth = Math.max(2, r.s * 0.06);
      ctx.strokeStyle = color.hex;
      ctx.setLineDash([r.s * 0.18, r.s * 0.12]);
      this._roundRectPath(ctx, r.px + inset, r.py + inset, r.s - inset * 2, r.s - inset * 2, r.s * 0.18);
      ctx.stroke();
      ctx.restore();
      // 記号（薄め）。
      ctx.fillStyle = lit ? color.hex : 'rgba(255,255,255,0.35)';
      ctx.font = `${Math.floor(r.s * 0.34)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(color.symbol, r.px + r.s / 2, r.py + r.s / 2 + 1);
    }
  }

  _goalSatisfied(board, frameState, goal) {
    const pos = frameState.viewPositions || frameState.positions;
    for (let i = 0; i < board.blocks.length; i++) {
      if (board.blocks[i].color !== goal.color) continue;
      const p = pos[i];
      if (Math.round(p.x) === goal.x && Math.round(p.y) === goal.y) return true;
    }
    return false;
  }

  _drawGates(ctx, board, frameState, L, moveCount) {
    if (!board.gates) return;
    for (const gate of board.gates) {
      const r = this._cellRect(L, gate.x, gate.y);
      const open = gateOpen(gate, moveCount);
      // 枠。
      ctx.fillStyle = 'rgba(20,24,30,0.9)';
      ctx.fillRect(r.px + 1, r.py + 1, r.s - 2, r.s - 2);
      ctx.strokeStyle = open ? 'rgba(120,230,160,0.9)' : 'rgba(240,150,90,0.95)';
      ctx.lineWidth = Math.max(2, r.s * 0.06);
      ctx.strokeRect(r.px + 2, r.py + 2, r.s - 4, r.s - 4);
      // シャッター（閉=全面、開=上下に退避）。
      const slatColor = open ? 'rgba(120,230,160,0.35)' : 'rgba(240,150,90,0.85)';
      ctx.fillStyle = slatColor;
      const cover = open ? r.s * 0.16 : r.s * 0.5;
      ctx.fillRect(r.px + 3, r.py + 3, r.s - 6, cover - 3);
      ctx.fillRect(r.px + 3, r.py + r.s - cover, r.s - 6, cover - 3);
      // スリット線。
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      for (let yy = r.py + 6; yy < r.py + cover; yy += 4) {
        ctx.beginPath();
        ctx.moveTo(r.px + 4, yy);
        ctx.lineTo(r.px + r.s - 4, yy);
        ctx.stroke();
      }
    }
  }

  _roundRectPath(ctx, x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _drawBlocks(ctx, board, frameState, L) {
    const positions = frameState.viewPositions || frameState.positions;
    for (let i = 0; i < board.blocks.length; i++) {
      const block = board.blocks[i];
      const color = PALETTE[block.color % PALETTE.length];
      const p = positions[i];
      const px = L.originX + p.x * L.cell;
      const py = L.originY + p.y * L.cell;
      const inset = L.cell * 0.08;
      const x = px + inset;
      const y = py + inset;
      const s = L.cell - inset * 2;
      const selected = frameState.selectedIndex === i;
      const satisfied = frameState.satisfied ? frameState.satisfied[i] : false;

      const rad = s * 0.22;
      const base = color.hex;

      // 接地影（やわらかい落ち影）。
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = L.cell * (selected ? 0.26 : 0.2);
      ctx.shadowOffsetY = L.cell * 0.09;
      ctx.fillStyle = 'rgba(0,0,0,0.001)'; // 影だけ落とすためのダミー塗り
      this._roundRectPath(ctx, x, y, s, s, rad);
      ctx.fill();
      ctx.restore();

      // 箱の外殻（側面の厚みを表す濃いめのベース）。斜め光のグラデ。
      const shell = ctx.createLinearGradient(x, y, x + s, y + s);
      shell.addColorStop(0, this._shade(base, 0.06));
      shell.addColorStop(1, this._shade(base, -0.34));
      ctx.fillStyle = shell;
      this._roundRectPath(ctx, x, y, s, s, rad);
      ctx.fill();

      // 上面（フタ）の面取り。外殻より一段明るい台形上部で立体感を出す。
      const topH = s * 0.5;
      const topGrad = ctx.createLinearGradient(x, y, x, y + topH);
      topGrad.addColorStop(0, this._shade(base, selected ? 0.5 : 0.36));
      topGrad.addColorStop(1, this._shade(base, selected ? 0.16 : 0.06));
      ctx.fillStyle = topGrad;
      this._roundRectPath(ctx, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.84, rad * 0.82);
      ctx.fill();

      // 中央パネル（記号の台座）。わずかにくぼませる。
      const panelGrad = ctx.createLinearGradient(x, y + s * 0.18, x, y + s * 0.9);
      panelGrad.addColorStop(0, this._shade(base, 0.2));
      panelGrad.addColorStop(1, this._shade(base, -0.16));
      ctx.fillStyle = panelGrad;
      this._roundRectPath(ctx, x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, rad * 0.6);
      ctx.fill();
      // パネルの内側ライン（彫り込み感）。
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = Math.max(1, s * 0.015);
      this._roundRectPath(ctx, x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, rad * 0.6);
      ctx.stroke();

      // 上部の光沢ハイライト。
      const hl = ctx.createLinearGradient(x, y + s * 0.06, x, y + s * 0.4);
      hl.addColorStop(0, 'rgba(255,255,255,0.5)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      this._roundRectPath(ctx, x + s * 0.12, y + s * 0.09, s * 0.76, s * 0.32, rad * 0.55);
      ctx.fill();

      // 四隅のリベット（コンテナらしさ）。
      const rv = s * 0.052;
      const off = s * 0.15;
      for (const [rx, ry] of [
        [x + off, y + off],
        [x + s - off, y + off],
        [x + off, y + s - off],
        [x + s - off, y + s - off],
      ]) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.arc(rx, ry, rv, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(rx - rv * 0.3, ry - rv * 0.3, rv * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      // 縁取り（淡い背景でも箱が締まって見える）。
      ctx.strokeStyle = this._shade(base, -0.5);
      ctx.lineWidth = Math.max(1, s * 0.02);
      this._roundRectPath(ctx, x, y, s, s, rad);
      ctx.stroke();

      // 記号（エンボス: 下に暗い影、本体は明るく）。
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.floor(s * 0.42)}px system-ui, sans-serif`;
      const symX = x + s / 2;
      const symY = y + s / 2 + s * 0.01;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(color.symbol, symX, symY + s * 0.02);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fillText(color.symbol, symX, symY);

      // 出荷済みの発光リング。
      if (satisfied) {
        ctx.save();
        ctx.shadowColor = base;
        ctx.shadowBlur = L.cell * 0.45;
        ctx.strokeStyle = this._shade(base, 0.55);
        ctx.lineWidth = Math.max(2, s * 0.06);
        this._roundRectPath(ctx, x + 1, y + 1, s - 2, s - 2, rad);
        ctx.stroke();
        ctx.restore();
      }

      // 選択中の白リング。
      if (selected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = Math.max(2, s * 0.055);
        this._roundRectPath(ctx, x - s * 0.01, y - s * 0.01, s * 1.02, s * 1.02, rad);
        ctx.stroke();
      }
    }
  }

  _drawParticles(ctx, particles, L) {
    for (const pt of particles) {
      if (pt.life <= 0) continue;
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      const px = L.originX + pt.x * L.cell;
      const py = L.originY + pt.y * L.cell;
      const size = Math.max(1.5, pt.size * L.cell);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // hex を amt 分だけ明/暗に。amt>0 で明るく、<0 で暗く。_lighten のエイリアス。
  _shade(hex, amt) {
    return this._lighten(hex, amt);
  }

  // hex を amt 分だけ明/暗に。amt>0 で明るく、<0 で暗く。
  _lighten(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substring(0, 2), 16);
    let g = parseInt(c.substring(2, 4), 16);
    let b = parseInt(c.substring(4, 6), 16);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  destroy() {
    this.ctx = null;
    this.canvas = null;
  }
}
