// Canvas2D 実装。Renderer interface を満たす。画像・外部素材は一切使わない。
// 角丸矩形ブロック・影・グラデ・ハイライト・リベット・縁の同色出口ゲート・スライドプレビュー・パーティクル。

import { Renderer } from './renderer.js';
import { PALETTE } from '../core/palette.js';
import { onewayDirAt, key } from '../core/rules.js';

const MARGIN = 24; // ゲート表示のための外周マージン(px)

export class CanvasRenderer extends Renderer {
  init(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = options.devicePixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    this.cssWidth = canvas.clientWidth || 320;
    this.cssHeight = canvas.clientHeight || 320;
    this._layout = null;
    this._layoutKey = '';
    this._board = null;
    return this;
  }

  resize(viewport) {
    this.cssWidth = viewport.cssWidth;
    this.cssHeight = viewport.cssHeight;
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = this.cssWidth + 'px';
    this.canvas.style.height = this.cssHeight + 'px';
    this._layoutKey = '';
  }

  _computeLayout(board) {
    const k = `${this.cssWidth}x${this.cssHeight}:${board.width}x${board.height}`;
    if (this._layoutKey === k && this._layout) return this._layout;
    const availW = this.cssWidth - MARGIN * 2;
    const availH = this.cssHeight - MARGIN * 2;
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

  getLayout() { return this._layout; }

  render(frameState) {
    const { board } = frameState;
    this._board = board;
    const ctx = this.ctx;
    const L = this._computeLayout(board);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    this._drawBackground(ctx);
    this._drawGrid(ctx, board, L);
    this._drawOneways(ctx, board, L);
    this._drawGates(ctx, board, L);
    if (frameState.preview) this._drawPreview(ctx, board, frameState.preview, L);
    this._drawBlocks(ctx, board, frameState, L);
    if (frameState.particles && frameState.particles.length) this._drawParticles(ctx, frameState.particles, L);
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
    // 倉庫の床。外枠を一段濃く。
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
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.strokeRect(L.originX + 1, L.originY + 1, L.gridW - 2, L.gridH - 2);

    if (board.walls) {
      for (const wk of board.walls) {
        const [x, y] = wk.split(',').map(Number);
        const r = this._cellRect(L, x, y);
        ctx.fillStyle = '#39414e';
        ctx.fillRect(r.px + 2, r.py + 2, r.s - 4, r.s - 4);
        // ハッチで「資材ラック/障害物」感。
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        for (let o = -r.s; o < r.s; o += 6) {
          ctx.beginPath();
          ctx.moveTo(r.px + 2 + Math.max(0, o), r.py + 2 + Math.max(0, -o));
          ctx.lineTo(r.px + 2 + Math.min(r.s - 4, r.s - 4 + o), r.py + 2 + Math.min(r.s - 4, r.s - 4 - o));
          ctx.stroke();
        }
      }
    }
  }

  _drawOneways(ctx, board, L) {
    if (!board.oneway || board.oneway.size === 0) return;
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const dir = onewayDirAt(board, x, y);
        if (!dir) continue;
        const r = this._cellRect(L, x, y);
        ctx.fillStyle = 'rgba(90,200,250,0.10)';
        ctx.fillRect(r.px + 1, r.py + 1, r.s - 2, r.s - 2);
        this._drawArrow(ctx, r.px + r.s / 2, r.py + r.s / 2, r.s * 0.26, dir, 'rgba(120,210,255,0.9)');
      }
    }
  }

  _drawArrow(ctx, cx, cy, len, dir, color) {
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const ex = cx + v[0] * len, ey = cy + v[1] * len;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, len * 0.25);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - v[0] * len, cy - v[1] * len);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const a = len * 0.5;
    const perp = [-v[1], v[0]];
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - v[0] * a + perp[0] * a * 0.6, ey - v[1] * a + perp[1] * a * 0.6);
    ctx.lineTo(ex - v[0] * a - perp[0] * a * 0.6, ey - v[1] * a - perp[1] * a * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  // 縁の同色出口ゲート（搬出口）。色＋記号＋外向き矢印で「ここから出す」を示す。
  _drawGates(ctx, board, L) {
    if (!board.gates) return;
    const t = Math.max(4, L.cell * 0.16); // ゲートの厚み
    for (const gate of board.gates) {
      const color = PALETTE[gate.color % PALETTE.length];
      let bx, by, bw, bh, ax, ay, adir, sx, sy;
      if (gate.side === 'left') {
        bx = L.originX - t; by = L.originY + gate.line * L.cell + 2; bw = t; bh = L.cell - 4;
        ax = L.originX - t - 5; ay = by + bh / 2; adir = 'left';
        sx = L.originX - t - 5; sy = ay;
      } else if (gate.side === 'right') {
        bx = L.originX + L.gridW; by = L.originY + gate.line * L.cell + 2; bw = t; bh = L.cell - 4;
        ax = bx + t + 5; ay = by + bh / 2; adir = 'right';
        sx = bx + t + 5; sy = ay;
      } else if (gate.side === 'top') {
        bx = L.originX + gate.line * L.cell + 2; by = L.originY - t; bw = L.cell - 4; bh = t;
        ax = bx + bw / 2; ay = L.originY - t - 5; adir = 'up';
        sx = ax; sy = ay;
      } else {
        bx = L.originX + gate.line * L.cell + 2; by = L.originY + L.gridH; bw = L.cell - 4; bh = t;
        ax = bx + bw / 2; ay = by + t + 5; adir = 'down';
        sx = ax; sy = ay;
      }
      // 開口バー（発光）。
      ctx.save();
      ctx.shadowColor = color.hex;
      ctx.shadowBlur = L.cell * 0.25;
      ctx.fillStyle = color.hex;
      this._roundRectPath(ctx, bx, by, bw, bh, Math.min(bw, bh) * 0.4);
      ctx.fill();
      ctx.restore();
      // 外向き矢印（小）。
      this._drawArrow(ctx, ax, ay, Math.max(3, t * 0.5), adir, color.hex);
      // 箱と同じ記号を矢印から少しずらして描く。色だけに頼らない。
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.font = `bold ${Math.floor(Math.min(MARGIN, L.cell) * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let tx = sx, ty = sy;
      if (gate.side === 'left') tx -= Math.max(7, t);
      else if (gate.side === 'right') tx += Math.max(7, t);
      else if (gate.side === 'top') ty -= Math.max(7, t);
      else ty += Math.max(7, t);
      ctx.strokeText(color.symbol, tx, ty);
      ctx.fillText(color.symbol, tx, ty);
    }
  }

  _drawPreview(ctx, board, preview, L) {
    const color = PALETTE[preview.color % PALETTE.length];
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = Math.max(2, L.cell * 0.06);
    ctx.strokeStyle = this._lighten(color.hex, 0.35);
    if (preview.exit) {
      // 退場プレビュー: ゲート方向の縁を強調。
      const oc = preview.opening;
      const cx = L.originX + (oc.x + 0.5) * L.cell;
      const cy = L.originY + (oc.y + 0.5) * L.cell;
      ctx.globalAlpha = 0.9;
      this._drawArrow(ctx, cx, cy, L.cell * 0.3, preview.dir, this._lighten(color.hex, 0.4));
    } else {
      const r = this._cellRect(L, preview.x, preview.y);
      const inset = r.s * 0.12;
      this._roundRectPath(ctx, r.px + inset, r.py + inset, r.s - inset * 2, r.s - inset * 2, r.s * 0.2);
      ctx.stroke();
    }
    ctx.restore();
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
      const p = positions[i];
      if (!p) continue; // 退場済み
      const block = board.blocks[i];
      const color = PALETTE[block.color % PALETTE.length];
      const px = L.originX + p.x * L.cell;
      const py = L.originY + p.y * L.cell;
      const inset = L.cell * 0.08;
      const x = px + inset, y = py + inset, s = L.cell - inset * 2;
      const selected = frameState.selectedIndex === i;
      const rad = s * 0.22;
      const baseHex = color.hex;

      // 接地影。
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = L.cell * (selected ? 0.26 : 0.2);
      ctx.shadowOffsetY = L.cell * 0.09;
      ctx.fillStyle = 'rgba(0,0,0,0.001)';
      this._roundRectPath(ctx, x, y, s, s, rad);
      ctx.fill();
      ctx.restore();

      // 外殻（厚み）。
      const shell = ctx.createLinearGradient(x, y, x + s, y + s);
      shell.addColorStop(0, this._shade(baseHex, 0.06));
      shell.addColorStop(1, this._shade(baseHex, -0.34));
      ctx.fillStyle = shell;
      this._roundRectPath(ctx, x, y, s, s, rad);
      ctx.fill();

      // 上面（フタ）。
      const topGrad = ctx.createLinearGradient(x, y, x, y + s * 0.5);
      topGrad.addColorStop(0, this._shade(baseHex, selected ? 0.5 : 0.36));
      topGrad.addColorStop(1, this._shade(baseHex, selected ? 0.16 : 0.06));
      ctx.fillStyle = topGrad;
      this._roundRectPath(ctx, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.84, rad * 0.82);
      ctx.fill();

      // 中央パネル。
      const panelGrad = ctx.createLinearGradient(x, y + s * 0.18, x, y + s * 0.9);
      panelGrad.addColorStop(0, this._shade(baseHex, 0.2));
      panelGrad.addColorStop(1, this._shade(baseHex, -0.16));
      ctx.fillStyle = panelGrad;
      this._roundRectPath(ctx, x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, rad * 0.6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = Math.max(1, s * 0.015);
      this._roundRectPath(ctx, x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, rad * 0.6);
      ctx.stroke();

      // 光沢。
      const hl = ctx.createLinearGradient(x, y + s * 0.06, x, y + s * 0.4);
      hl.addColorStop(0, 'rgba(255,255,255,0.5)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      this._roundRectPath(ctx, x + s * 0.12, y + s * 0.09, s * 0.76, s * 0.32, rad * 0.55);
      ctx.fill();

      // 四隅リベット。
      const rv = s * 0.052, off = s * 0.15;
      for (const [cx, cy] of [
        [x + off, y + off], [x + s - off, y + off],
        [x + off, y + s - off], [x + s - off, y + s - off],
      ]) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath(); ctx.arc(cx, cy, rv, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(cx - rv * 0.3, cy - rv * 0.3, rv * 0.42, 0, Math.PI * 2); ctx.fill();
      }

      // 縁取り。
      ctx.strokeStyle = this._shade(baseHex, -0.5);
      ctx.lineWidth = Math.max(1, s * 0.02);
      this._roundRectPath(ctx, x, y, s, s, rad);
      ctx.stroke();

      // 記号（エンボス）。
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.floor(s * 0.42)}px system-ui, sans-serif`;
      const sxm = x + s / 2, sym = y + s / 2 + s * 0.01;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(color.symbol, sxm, sym + s * 0.02);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fillText(color.symbol, sxm, sym);

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

  _shade(hex, amt) { return this._lighten(hex, amt); }

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

  destroy() { this.ctx = null; this.canvas = null; }
}
