// Pointer Events による入力処理。画面座標 → グリッド操作への変換に徹する。
// ゲームロジック・描画は持たない。タッチ/マウス共通。指追従とタッチ遅延の抑制を重視。

export class PointerInput {
  /**
   * @param {HTMLElement} element 入力対象（canvas）
   * @param {object} mapper clientToCell(clientX,clientY) と getLayout() を持つ（Renderer）
   * @param {object} handlers { pickBlockAt(cell), onDragMove(index,dxPx,dyPx), onRelease(index,dir), onTapEmpty() }
   */
  constructor(element, mapper, handlers) {
    this.el = element;
    this.mapper = mapper;
    this.handlers = handlers;
    this.activeId = null;
    this.index = -1;
    this.startX = 0;
    this.startY = 0;

    // タッチ遅延・スクロール干渉を避ける。
    this.el.style.touchAction = 'none';

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);

    this.el.addEventListener('pointerdown', this._onDown);
    this.el.addEventListener('pointermove', this._onMove);
    this.el.addEventListener('pointerup', this._onUp);
    this.el.addEventListener('pointercancel', this._onUp);
  }

  _onDown(e) {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    const cell = this.mapper.clientToCell(e.clientX, e.clientY);
    const idx = cell ? this.handlers.pickBlockAt(cell) : -1;
    this.index = idx;
    if (idx >= 0) {
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch (_) {
        /* 一部環境では無視 */
      }
    } else if (this.handlers.onTapEmpty) {
      this.handlers.onTapEmpty();
    }
  }

  _onMove(e) {
    if (e.pointerId !== this.activeId || this.index < 0) return;
    e.preventDefault();
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    if (this.handlers.onDragMove) this.handlers.onDragMove(this.index, dx, dy);
  }

  _onUp(e) {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const idx = this.index;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const dir = this._dominantDir(dx, dy);
    this.activeId = null;
    this.index = -1;
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* noop */
    }
    if (idx >= 0 && this.handlers.onRelease) this.handlers.onRelease(idx, dir);
  }

  _dominantDir(dx, dy) {
    const layout = this.mapper.getLayout ? this.mapper.getLayout() : null;
    const cell = layout ? layout.cell : 40;
    const threshold = Math.max(10, cell * 0.28);
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax < threshold && ay < threshold) return null; // タップ扱い
    if (ax >= ay) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  destroy() {
    this.el.removeEventListener('pointerdown', this._onDown);
    this.el.removeEventListener('pointermove', this._onMove);
    this.el.removeEventListener('pointerup', this._onUp);
    this.el.removeEventListener('pointercancel', this._onUp);
  }
}
