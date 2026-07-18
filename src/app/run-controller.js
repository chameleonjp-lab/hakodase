// 1プレイの世代識別と一回だけの結果確定を管理する純粋コントローラー。
// 古いタイマー・Promise・イベントは playId が一致しなければ現在のプレイへ作用できない。

export const RUN_STATUS = Object.freeze({
  PREPARED: 'prepared',
  PLAYING: 'playing',
  CLEARED: 'cleared',
  RETIRED: 'retired',
  INVALIDATED: 'invalidated',
});

const TERMINAL = new Set([RUN_STATUS.CLEARED, RUN_STATUS.RETIRED, RUN_STATUS.INVALIDATED]);

function safeNow(now) {
  return Number.isFinite(now) && now >= 0 ? now : 0;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = cloneValue(child);
    return out;
  }
  return value;
}

function freezeSnapshot(run) {
  if (!run) return null;
  return Object.freeze({
    playId: run.playId,
    status: run.status,
    config: Object.freeze(cloneValue(run.config)),
    startedAt: run.startedAt,
    settledAt: run.settledAt,
    result: run.result == null ? null : Object.freeze(cloneValue(run.result)),
    reason: run.reason,
  });
}

function rejected(reason, run = null) {
  return Object.freeze({ accepted: false, reason, run: freezeSnapshot(run) });
}

export class RunController {
  constructor() {
    this._sequence = 0;
    this._current = null;
    this._destroyed = false;
    this._listeners = new Set();
  }

  get destroyed() { return this._destroyed; }
  get playId() { return this._current?.playId ?? null; }
  get status() { return this._current?.status ?? null; }

  snapshot() {
    return freezeSnapshot(this._current);
  }

  isCurrent(playId) {
    return !this._destroyed && this._current?.playId === playId;
  }

  isPlaying(playId = this.playId) {
    return this.isCurrent(playId) && this._current.status === RUN_STATUS.PLAYING;
  }

  prepare(config = {}) {
    if (this._destroyed) return rejected('destroyed');
    const previous = this._current;
    this._sequence += 1;
    this._current = {
      playId: this._sequence,
      status: RUN_STATUS.PREPARED,
      config: cloneValue(config),
      startedAt: null,
      settledAt: null,
      result: null,
      reason: null,
    };
    const event = Object.freeze({
      accepted: true,
      type: 'prepared',
      run: freezeSnapshot(this._current),
      supersededPlayId: previous && !TERMINAL.has(previous.status) ? previous.playId : null,
    });
    this._emit(event);
    return event;
  }

  start(playId, now = 0) {
    const check = this._checkCurrent(playId);
    if (check) return check;
    if (this._current.status !== RUN_STATUS.PREPARED) return rejected('invalid-status', this._current);
    this._current.status = RUN_STATUS.PLAYING;
    this._current.startedAt = safeNow(now);
    return this._accepted('started');
  }

  complete(playId, result = {}, now = 0) {
    return this._settle(playId, RUN_STATUS.CLEARED, result, null, now);
  }

  retire(playId, reason = 'retired', now = 0) {
    return this._settle(playId, RUN_STATUS.RETIRED, null, String(reason || 'retired'), now, true);
  }

  invalidate(playId, reason = 'invalidated', now = 0) {
    return this._settle(playId, RUN_STATUS.INVALIDATED, null, String(reason || 'invalidated'), now, true);
  }

  runIfCurrent(playId, effect) {
    if (typeof effect !== 'function') throw new TypeError('effect must be a function');
    if (!this.isCurrent(playId)) return false;
    effect(freezeSnapshot(this._current));
    return true;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    if (this._destroyed) return () => {};
    this._listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this._listeners.delete(listener);
    };
  }

  destroy() {
    if (this._destroyed) return false;
    this._destroyed = true;
    this._sequence += 1;
    this._current = null;
    this._listeners.clear();
    return true;
  }

  _checkCurrent(playId) {
    if (this._destroyed) return rejected('destroyed');
    if (!this._current || this._current.playId !== playId) return rejected('stale-play');
    if (TERMINAL.has(this._current.status)) return rejected('already-settled', this._current);
    return null;
  }

  _settle(playId, status, result, reason, now, allowPrepared = false) {
    const check = this._checkCurrent(playId);
    if (check) return check;
    const valid = this._current.status === RUN_STATUS.PLAYING || (allowPrepared && this._current.status === RUN_STATUS.PREPARED);
    if (!valid) return rejected('invalid-status', this._current);
    this._current.status = status;
    this._current.settledAt = safeNow(now);
    this._current.result = result == null ? null : cloneValue(result);
    this._current.reason = reason;
    return this._accepted(status);
  }

  _accepted(type) {
    const event = Object.freeze({ accepted: true, type, run: freezeSnapshot(this._current) });
    this._emit(event);
    return event;
  }

  _emit(event) {
    for (const listener of [...this._listeners]) {
      try { listener(event); } catch (_) { /* listener failure must not corrupt run state */ }
    }
  }
}
