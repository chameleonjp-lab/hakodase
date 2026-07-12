// Pointer Events による入力処理。pointerupのみ確定し、cancel/capture喪失は破棄する。

export class PointerInput {
  constructor(element, mapper, handlers) {
    this.el = element;
    this.mapper = mapper;
    this.handlers = handlers;
    this.activeId = null;
    this.index = -1;
    this.startX = 0;
    this.startY = 0;
    this.releasingId = null;
    this.el.style.touchAction = 'none';
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onCancel = this._onCancel.bind(this);
    this._onLost = this._onLost.bind(this);
    this.el.addEventListener('pointerdown', this._onDown);
    this.el.addEventListener('pointermove', this._onMove);
    this.el.addEventListener('pointerup', this._onUp);
    this.el.addEventListener('pointercancel', this._onCancel);
    this.el.addEventListener('lostpointercapture', this._onLost);
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
      try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    } else if (this.handlers.onTapEmpty) this.handlers.onTapEmpty();
  }

  _onMove(e) {
    if (e.pointerId !== this.activeId || this.index < 0) return;
    e.preventDefault();
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    if (this.handlers.onDragMove) this.handlers.onDragMove(this.index, dx, dy);
  }

  _resetActive() {
    const idx = this.index;
    this.activeId = null;
    this.index = -1;
    this.startX = 0;
    this.startY = 0;
    return idx;
  }

  _onUp(e) {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const idx = this.index;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const dir = this._dominantDir(dx, dy);
    this.releasingId = e.pointerId;
    this._resetActive();
    try { this.el.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
    this.releasingId = null;
    if (idx >= 0 && dir && this.handlers.onRelease) this.handlers.onRelease(idx, dir);
    else if (idx >= 0 && this.handlers.onCancel) this.handlers.onCancel(idx);
  }

  _onCancel(e) {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const idx = this._resetActive();
    if (idx >= 0 && this.handlers.onCancel) this.handlers.onCancel(idx);
  }

  _onLost(e) {
    if (e.pointerId === this.releasingId) return;
    if (e.pointerId !== this.activeId) return;
    const idx = this._resetActive();
    if (idx >= 0 && this.handlers.onCancel) this.handlers.onCancel(idx);
  }

  _dominantDir(dx, dy) {
    const layout = this.mapper.getLayout ? this.mapper.getLayout() : null;
    const cell = layout ? layout.cell : 40;
    const threshold = Math.max(6, cell * 0.22);
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < threshold && ay < threshold) return null;
    if (ax >= ay) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  destroy() {
    this.el.removeEventListener('pointerdown', this._onDown);
    this.el.removeEventListener('pointermove', this._onMove);
    this.el.removeEventListener('pointerup', this._onUp);
    this.el.removeEventListener('pointercancel', this._onCancel);
    this.el.removeEventListener('lostpointercapture', this._onLost);
  }
}
