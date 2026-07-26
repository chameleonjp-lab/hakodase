// 画面状態を一元管理する純粋コントローラー。DOM・Canvas・通信へ依存しない。

import { APP_STATES, allowedTransitionsFrom, canTransition, isAppState } from './app-state.js';

function freezeEvent(event) {
  return Object.freeze({ ...event });
}

export class AppController {
  constructor(initialState = APP_STATES.HOME) {
    if (!isAppState(initialState)) throw new TypeError(`Unknown app state: ${initialState}`);
    this._state = initialState;
    this._version = 0;
    this._destroyed = false;
    this._listeners = new Set();
  }

  get state() { return this._state; }
  get version() { return this._version; }
  get destroyed() { return this._destroyed; }

  snapshot() {
    return Object.freeze({
      state: this._state,
      version: this._version,
      destroyed: this._destroyed,
      allowed: Object.freeze(allowedTransitionsFrom(this._state)),
    });
  }

  isCurrent(version) {
    return !this._destroyed && version === this._version;
  }

  canTransition(nextState) {
    return !this._destroyed && canTransition(this._state, nextState);
  }

  transition(nextState, context = null) {
    if (this._destroyed) return freezeEvent({ accepted: false, reason: 'destroyed', state: this._state, version: this._version });
    if (!isAppState(nextState)) return freezeEvent({ accepted: false, reason: 'unknown-state', state: this._state, version: this._version });
    if (nextState === this._state) return freezeEvent({ accepted: false, reason: 'same-state', state: this._state, version: this._version });
    if (!canTransition(this._state, nextState)) {
      return freezeEvent({ accepted: false, reason: 'forbidden-transition', state: this._state, requested: nextState, version: this._version });
    }

    const previous = this._state;
    this._state = nextState;
    this._version += 1;
    const event = freezeEvent({ accepted: true, previous, state: nextState, version: this._version, context });
    for (const listener of [...this._listeners]) {
      try { listener(event); } catch (_) { /* listener failure must not corrupt state */ }
    }
    return event;
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
    this._version += 1;
    this._listeners.clear();
    return true;
  }
}
