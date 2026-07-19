// 3・2・1・STARTを世代付きで進める純粋コントローラー。DOM・時計APIへ直接依存しない。

export const COUNTDOWN_STEPS = Object.freeze(['3', '2', '1', 'START']);
export const DEFAULT_COUNTDOWN_STEP_MS = 900;

function defaultSchedule(callback, delayMs) {
  return setTimeout(callback, delayMs);
}

function defaultCancel(timerId) {
  clearTimeout(timerId);
}

function safeCall(callback, ...args) {
  if (typeof callback !== 'function') return;
  try { callback(...args); } catch (_) { /* 表示側の例外で進行を壊さない */ }
}

export class CountdownController {
  constructor({
    stepMs = DEFAULT_COUNTDOWN_STEP_MS,
    schedule = defaultSchedule,
    cancelSchedule = defaultCancel,
  } = {}) {
    if (!Number.isFinite(stepMs) || stepMs <= 0) throw new TypeError('stepMs must be a positive number');
    if (typeof schedule !== 'function' || typeof cancelSchedule !== 'function') {
      throw new TypeError('schedule and cancelSchedule must be functions');
    }
    this.stepMs = stepMs;
    this._schedule = schedule;
    this._cancelSchedule = cancelSchedule;
    this._generation = 0;
    this._timerId = null;
    this._active = false;
    this._destroyed = false;
    this._index = -1;
    this._callbacks = null;
  }

  get active() { return this._active; }
  get token() { return this._generation; }
  get destroyed() { return this._destroyed; }
  get currentStep() { return this._active && this._index >= 0 ? COUNTDOWN_STEPS[this._index] : null; }

  snapshot() {
    return Object.freeze({
      active: this._active,
      token: this._generation,
      step: this.currentStep,
      destroyed: this._destroyed,
    });
  }

  start({ onStep, onStart, onCancel } = {}) {
    if (this._destroyed) return Object.freeze({ accepted: false, reason: 'destroyed', token: this._generation });
    if (typeof onStart !== 'function') throw new TypeError('onStart must be a function');

    if (this._active) this.cancel('replaced');
    this._generation += 1;
    this._active = true;
    this._index = 0;
    this._callbacks = { onStep, onStart, onCancel };
    const token = this._generation;
    this._emitCurrent(token);
    return Object.freeze({ accepted: true, token });
  }

  isCurrent(token) {
    return !this._destroyed && this._active && token === this._generation;
  }

  cancel(reason = 'cancelled') {
    if (!this._active) return false;
    const token = this._generation;
    const callbacks = this._callbacks;
    if (this._timerId != null) this._cancelSchedule(this._timerId);
    this._timerId = null;
    this._active = false;
    this._index = -1;
    this._callbacks = null;
    this._generation += 1;
    safeCall(callbacks?.onCancel, Object.freeze({ token, reason: String(reason || 'cancelled') }));
    return true;
  }

  destroy() {
    if (this._destroyed) return false;
    this.cancel('destroyed');
    this._destroyed = true;
    this._generation += 1;
    return true;
  }

  _emitCurrent(token) {
    if (!this.isCurrent(token)) return;
    const step = COUNTDOWN_STEPS[this._index];
    const callbacks = this._callbacks;
    safeCall(callbacks?.onStep, step, this._index, token);

    if (step === 'START') {
      this._active = false;
      this._timerId = null;
      this._index = -1;
      this._callbacks = null;
      safeCall(callbacks?.onStart, token);
      return;
    }

    this._timerId = this._schedule(() => {
      if (!this.isCurrent(token)) return;
      this._timerId = null;
      this._index += 1;
      this._emitCurrent(token);
    }, this.stepMs);
  }
}
