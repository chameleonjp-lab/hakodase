// HAKODASE v2 統合。P2-02ではホーム・名前確認・3モード選択をDOMへ接続する。
// カウントダウンと正式なSTART時計はP2-03で置き換えるため、現在は準備状態を同期的に通過する暫定接続。

import { generateBoard } from './core/generator.js';
import { GameEngine } from './core/engine.js';
import { CanvasRenderer } from './render/canvas-renderer.js';
import { PointerInput } from './input/pointer-input.js';
import { HUD } from './ui/hud.js';
import { LocalRankingService } from './services/ranking.js';
import { PlayerNameStore } from './services/player-name-store.js';
import { PALETTE } from './core/palette.js';
import { gateForBlock, gateOpeningCell } from './core/rules.js';
import { approachPoint, pointReached, clampDt } from './render/animation.js';
import { APP_STATES } from './app/app-state.js';
import { AppController } from './app/app-controller.js';
import { RUN_STATUS, RunController } from './app/run-controller.js';
import { GAME_MODES, getGameMode, isGameMode } from './app/modes.js';
import {
  PLAYER_NAME_MAX_CHARACTERS,
  limitPlayerNameInput,
  validatePlayerName,
} from './app/player-name.js';

const GRAVITY = 9;
const LAB_URL = 'https://chameleonjp.codeberg.page/chameleonjp_lab/';

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
      difficulty: null,
      seed: document.getElementById('seed'),
    });

    this.appController = new AppController(APP_STATES.HOME);
    this.runController = new RunController();
    this.nameStore = new PlayerNameStore();
    this.playerName = this.nameStore.load();
    this.selectedMode = GAME_MODES.DAILY;
    this.activeMode = null;
    this.activeRunConfig = null;
    this.currentPlayId = null;

    this.difficulty = 'normal';
    this.engine = null;
    this.meta = null;
    this.view = [];
    this.target = [];
    this.exiting = [];
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.preview = null;
    this.particles = [];
    this.lastTs = 0;
    this.inputLocked = true;
    this.pendingStart = null;

    this._cacheAppElements();
    this._setupAppShell();
    this._setupControls();
    this._setupInput();
    this._setupResize();
    this._renderAppState(this.appController.state);
    this._selectMode(this.selectedMode);
    this._updateIdentity();

    requestAnimationFrame((t) => this._loop(t));
    if (typeof window !== 'undefined') window.hakodase = this;
  }

  _cacheAppElements() {
    this.screens = [...document.querySelectorAll('[data-screen]')];
    this.modeButtons = [...document.querySelectorAll('[data-mode]')];
    this.playerBadge = document.getElementById('playerBadge');
    this.savedNameLabel = document.getElementById('savedNameLabel');
    this.modeSummary = document.getElementById('modeSummary');
    this.homeMessage = document.getElementById('homeMessage');
    this.nameForm = document.getElementById('nameForm');
    this.nameInput = document.getElementById('playerNameInput');
    this.nameError = document.getElementById('nameError');
    this.nameModeLabel = document.getElementById('nameModeLabel');
    this.runPlayer = document.getElementById('runPlayer');
    this.runMode = document.getElementById('runMode');
    this.newButton = document.getElementById('new');
    this.seedForm = document.getElementById('seedForm');
  }

  _setupAppShell() {
    this.appController.subscribe((event) => this._renderAppState(event.state));

    for (const button of this.modeButtons) {
      button.addEventListener('click', () => this._selectMode(button.dataset.mode));
    }

    document.getElementById('homeStart').addEventListener('click', () => {
      this.nameInput.value = this.playerName;
      this.nameError.textContent = '';
      this.nameModeLabel.textContent = getGameMode(this.selectedMode)?.label || '';
      this.appController.transition(APP_STATES.NAME_CONFIRM, { mode: this.selectedMode });
    });

    document.getElementById('homeRules').addEventListener('click', () => {
      this.appController.transition(APP_STATES.RULES);
    });

    document.getElementById('homeRanking').addEventListener('click', async () => {
      await this._refreshRanking();
      this.appController.transition(APP_STATES.RANKING);
    });

    document.getElementById('homeShare').addEventListener('click', () => this._shareHome());
    document.getElementById('homeLab').href = LAB_URL;
    document.getElementById('nameBack').addEventListener('click', () => this.appController.transition(APP_STATES.HOME));
    document.getElementById('rulesBack').addEventListener('click', () => this.appController.transition(APP_STATES.HOME));
    document.getElementById('rankingBack').addEventListener('click', () => this.appController.transition(APP_STATES.HOME));
    document.getElementById('playHome').addEventListener('click', () => this._leavePlay());

    this.nameInput.addEventListener('input', () => {
      const limited = limitPlayerNameInput(this.nameInput.value, PLAYER_NAME_MAX_CHARACTERS);
      if (limited !== this.nameInput.value) this.nameInput.value = limited;
      this.nameError.textContent = '';
    });

    this.nameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const checked = validatePlayerName(this.nameInput.value);
      if (!checked.valid) {
        this.nameError.textContent = checked.reason === 'too-long'
          ? `${PLAYER_NAME_MAX_CHARACTERS}文字以内にしてください。`
          : 'プレイヤー名を入力してください。';
        this.nameInput.focus();
        return;
      }

      const saved = this.nameStore.save(checked.name);
      this.playerName = saved.name;
      this.nameInput.value = saved.name;
      this.nameInput.blur();
      this._updateIdentity();
      if (!saved.persisted) this._setHomeMessage('名前を端末へ保存できませんでした。このプレイ中は使用できます。', 'error');
      this._prepareSelectedMode();
    });
  }

  _renderAppState(state) {
    document.body.dataset.appState = state;
    for (const screen of this.screens) screen.hidden = screen.dataset.screen !== state;

    if (state === APP_STATES.NAME_CONFIRM) {
      const version = this.appController.version;
      requestAnimationFrame(() => {
        if (this.appController.isCurrent(version)) {
          this.nameInput.focus({ preventScroll: true });
          this.nameInput.setSelectionRange(this.nameInput.value.length, this.nameInput.value.length);
        }
      });
    }

    if (state === APP_STATES.PLAYING) requestAnimationFrame(() => this._fit());
  }

  _selectMode(mode) {
    if (!isGameMode(mode)) return false;
    this.selectedMode = mode;
    const definition = getGameMode(mode);
    for (const button of this.modeButtons) {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
    }
    this.modeSummary.textContent = definition.description;
    return true;
  }

  _updateIdentity() {
    const hasName = Boolean(this.playerName);
    this.playerBadge.hidden = !hasName;
    this.playerBadge.textContent = hasName ? `プレイヤー: ${this.playerName}` : '';
    this.savedNameLabel.textContent = hasName ? `保存名: ${this.playerName}` : '名前は開始前に確認';
  }

  _prepareSelectedMode(seedOverride = null) {
    const definition = getGameMode(this.selectedMode);
    if (!definition || !this.playerName) return false;

    const seed = seedOverride ?? definition.previewSeed ?? randomSeed();
    const config = {
      mode: definition.id,
      playerName: this.playerName,
      difficulty: definition.difficulty,
      seed,
      official: false,
      preview: true,
    };
    const prepared = this.runController.prepare(config);
    if (!prepared.accepted) return false;

    this.currentPlayId = prepared.run.playId;
    this.activeMode = definition.id;
    this.activeRunConfig = config;
    this.difficulty = definition.difficulty;

    const toCountdown = this.appController.transition(APP_STATES.COUNTDOWN, { mode: definition.id, playId: this.currentPlayId });
    if (!toCountdown.accepted) return false;

    // P2-03で3・2・1・STARTへ置き換える暫定接続。画面を先にplayingへ切り替え、初回描画後に開始する。
    const toPlaying = this.appController.transition(APP_STATES.PLAYING, { mode: definition.id, playId: this.currentPlayId, temporaryBridge: true });
    if (!toPlaying.accepted) return false;

    this._configurePlayingMode(definition);
    this.newBoard(definition.difficulty, seed, this.currentPlayId);
    return true;
  }

  _configurePlayingMode(definition) {
    this.runPlayer.textContent = `プレイヤー: ${this.playerName}`;
    this.runMode.textContent = definition.id === GAME_MODES.DAILY
      ? `${definition.label}（暫定・記録対象外）`
      : definition.label;
    this.newButton.hidden = definition.id !== GAME_MODES.ENDLESS;
    this.seedForm.hidden = definition.id !== GAME_MODES.ENDLESS;
  }

  async _shareHome() {
    const text = 'HAKODASE｜箱を滑らせ、同じ印の搬出口からすべて出荷する短時間パズル。';
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: 'HAKODASE / ハコダセ', text, url });
        this._setHomeMessage('共有画面を開きました。', 'success');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        this._setHomeMessage('ゲーム情報をコピーしました。', 'success');
        return;
      }
      this._setHomeMessage('このブラウザでは共有機能を使えません。', 'error');
    } catch (error) {
      if (error?.name !== 'AbortError') this._setHomeMessage('共有できませんでした。', 'error');
    }
  }

  _setHomeMessage(text, kind = 'info') {
    this.homeMessage.textContent = text || '';
    this.homeMessage.dataset.kind = kind;
  }

  _leavePlay() {
    if (this.currentPlayId != null && this.runController.isCurrent(this.currentPlayId)) {
      if (this.runController.status === RUN_STATUS.PLAYING || this.runController.status === RUN_STATUS.PREPARED) {
        this.runController.invalidate(this.currentPlayId, 'left-preview', performance.now());
      }
    }
    this.pendingStart = null;
    this.inputLocked = true;
    this.engine = null;
    this.meta = null;
    this.view = [];
    this.target = [];
    this.exiting = [];
    this.particles = [];
    this.appController.transition(APP_STATES.HOME, { reason: 'left-preview' });
  }

  _setupControls() {
    document.getElementById('retry').addEventListener('click', () => this.retry());
    this.newButton.addEventListener('click', () => {
      if (this.activeMode === GAME_MODES.ENDLESS) this._restartActiveRun(randomSeed());
    });

    const clearButton = document.getElementById('clearRanking');
    clearButton.addEventListener('click', async () => {
      await this.ranking.clearScores();
      await this._refreshRanking();
    });

    this.seedForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.activeMode !== GAME_MODES.ENDLESS) return;
      const value = document.getElementById('seedInput').value.trim();
      if (value) this._restartActiveRun(value);
    });
  }

  _restartActiveRun(seed) {
    if (!this.activeRunConfig || this.appController.state !== APP_STATES.PLAYING) return false;
    const config = { ...this.activeRunConfig, seed };
    const prepared = this.runController.prepare(config);
    if (!prepared.accepted) return false;
    this.currentPlayId = prepared.run.playId;
    this.activeRunConfig = config;
    this.newBoard(config.difficulty, seed, this.currentPlayId);
    return true;
  }

  _setupInput() {
    this.input = new PointerInput(this.canvas, this.renderer, {
      pickBlockAt: (cell) => {
        if (!this.engine || this.inputLocked) return -1;
        if (this.appController.state !== APP_STATES.PLAYING) return -1;
        if (!this.runController.isPlaying(this.currentPlayId) || this.engine.status !== 'playing') return -1;
        const index = this.engine.blockAt(cell.x, cell.y);
        if (index >= 0) {
          this.engine.select(index);
          this.dragIndex = index;
          this.dragOffset = { x: 0, y: 0 };
          this.preview = null;
        }
        return index;
      },
      onDragMove: (index, dxPx, dyPx) => {
        const layout = this.renderer.getLayout();
        if (!layout) return;
        const ax = Math.abs(dxPx);
        const ay = Math.abs(dyPx);
        const dir = ax >= ay ? (dxPx > 0 ? 'right' : 'left') : (dyPx > 0 ? 'down' : 'up');
        if (ax >= ay) this.dragOffset = { x: clamp(dxPx / layout.cell, -0.6, 0.6), y: 0 };
        else this.dragOffset = { x: 0, y: clamp(dyPx / layout.cell, -0.6, 0.6) };
        const threshold = Math.max(6, layout.cell * 0.18);
        if (ax < threshold && ay < threshold) { this.preview = null; return; }
        const result = this.engine.previewSlide(index, dir);
        if (!result.legal) { this.preview = null; return; }
        const block = this.engine.board.blocks[index];
        if (result.exit) {
          const gate = gateForBlock(this.engine.board, index);
          this.preview = { color: block.color, dir, exit: true, opening: gateOpeningCell(this.engine.board, gate) };
        } else {
          this.preview = { color: block.color, dir, exit: false, x: result.x, y: result.y };
        }
      },
      onRelease: (index, dir) => {
        this.dragOffset = { x: 0, y: 0 };
        this.dragIndex = -1;
        this.preview = null;
        if (dir && this.runController.isPlaying(this.currentPlayId)) {
          const result = this.engine.tryMove(index, dir, performance.now());
          if (result.moved) {
            this.hud.setStats(this.engine.swipeCount, this.engine.distanceCells);
            this.inputLocked = true;
            if (result.exit) this._onExit(index);
            if (result.cleared) this._onClear();
          }
        }
        this.engine?.deselect();
      },
      onCancel: () => {
        this.dragOffset = { x: 0, y: 0 };
        this.dragIndex = -1;
        this.preview = null;
        this.engine?.deselect();
      },
      onTapEmpty: () => this.engine?.deselect(),
    });
  }

  _setupResize() {
    this._fit = () => {
      if (!this.engine || this.appController.state !== APP_STATES.PLAYING) return;
      const wrap = this.canvas.parentElement;
      const maxWidth = wrap.clientWidth;
      if (!maxWidth) return;
      const aspect = this.engine.board.height / this.engine.board.width;
      let cssWidth = maxWidth;
      let cssHeight = Math.round(cssWidth * aspect);
      const maxHeight = Math.round((window.innerHeight || 700) * 0.72);
      if (cssHeight > maxHeight) {
        cssHeight = maxHeight;
        cssWidth = Math.round(cssHeight / aspect);
      }
      this.renderer.resize({ cssWidth, cssHeight });
    };

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._fit());
      this._resizeObserver.observe(this.canvas.parentElement);
    }
    window.addEventListener('resize', () => this._fit());
  }

  newBoard(difficulty, seed, playId) {
    this.meta = generateBoard({ seed, difficulty });
    this.engine = new GameEngine(this.meta.board, this.meta);
    this._resetView();
    this.particles = [];
    this.hud.setStats(0, 0);
    this.hud.setTime(0);
    this.hud.setTarget(this.meta.optimalSwipes, this.meta.exact);
    this.hud.setSeed(this.meta.seed);
    const mode = getGameMode(this.activeMode);
    const note = mode?.id === GAME_MODES.DAILY ? '現在は暫定問題で、公式ランキング対象外です。' : '';
    this.hud.message(`箱をドラッグして同じ記号の搬出口から出そう。${note}`, 'info');
    this.pendingStart = { playId };
    this.inputLocked = true;
    requestAnimationFrame(() => this._fit());
  }

  retry() {
    if (!this.meta) return;
    this._restartActiveRun(this.meta.seed);
  }

  _resetView() {
    this.view = this.engine.positions.map((position) => ({ x: position.x, y: position.y }));
    this.target = this.engine.positions.map((position) => ({ x: position.x, y: position.y }));
    this.exiting = this.engine.positions.map(() => false);
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.preview = null;
  }

  _onExit(index) {
    const gate = gateForBlock(this.engine.board, index);
    const opening = gateOpeningCell(this.engine.board, gate);
    this.target[index] = { x: opening.x, y: opening.y };
    this.exiting[index] = true;
    this._spawnBurst(opening.x, opening.y, this.engine.board.blocks[index].color, 16);
  }

  async _onClear() {
    const playId = this.currentPlayId;
    const timeMs = this.engine.elapsedMs(performance.now());
    const result = {
      timeMs,
      swipeCount: this.engine.swipeCount,
      distanceCells: this.engine.distanceCells,
      seed: this.meta.seed,
      difficulty: this.meta.difficulty,
      mode: this.activeMode,
    };
    const settled = this.runController.complete(playId, result, performance.now());
    if (!settled.accepted) return;

    const mode = getGameMode(this.activeMode);
    this.hud.message(`クリア！ ${(timeMs / 1000).toFixed(2)}秒 / ${result.swipeCount}操作 / 移動${result.distanceCells}マス`, 'success');
    this._spawnParticles();

    if (!mode?.rankingEnabled) return;
    const clearedAt = new Date().toISOString();
    try {
      await this.ranking.saveScore({ ...result, clearedAt });
      this.runController.runIfCurrent(playId, () => this._refreshRanking(clearedAt));
    } catch (_) {
      this.runController.runIfCurrent(playId, () => this.hud.message('クリアしましたが、端末内記録を保存できませんでした。', 'error'));
    }
  }

  async _refreshRanking(highlightAt) {
    const scores = await this.ranking.listScores({ mode: GAME_MODES.ENDLESS, difficulty: 'normal', limit: 10 });
    this.hud.renderRanking(scores, { highlightAt });
  }

  _spawnBurst(cx, cy, colorIndex, count) {
    const color = PALETTE[colorIndex % PALETTE.length];
    for (let i = 0; i < count; i++) {
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

  _spawnParticles() {
    const board = this.engine.board;
    for (let i = 0; i < 90; i++) {
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
    const positions = this.engine.positions;
    for (let i = 0; i < this.view.length; i++) {
      if (this.view[i] === null) continue;
      if (!this.exiting[i] && positions[i]) this.target[i] = { x: positions[i].x, y: positions[i].y };

      let targetX = this.target[i].x;
      let targetY = this.target[i].y;
      if (i === this.dragIndex && !this.exiting[i]) {
        targetX += this.dragOffset.x;
        targetY += this.dragOffset.y;
      }

      this.view[i] = approachPoint(this.view[i], { x: targetX, y: targetY }, dt);
      if (this.exiting[i] && pointReached(this.view[i], this.target[i], 0.01)) {
        this.view[i] = null;
        this.exiting[i] = false;
        this.inputLocked = this.exiting.some(Boolean);
      }
    }

    if (!this.exiting.some(Boolean) && this.engine.status === 'playing') {
      const animating = this.view.some((position, index) => position && this.target[index] && !pointReached(position, this.target[index], 0.01));
      if (!animating) this.inputLocked = false;
    }

    if (this.particles.length) {
      for (const particle of this.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += GRAVITY * dt;
        particle.life -= dt;
      }
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }
  }

  _startPendingRun(ts) {
    const pending = this.pendingStart;
    if (!pending || !this.engine) return;
    if (!this.runController.isCurrent(pending.playId) || this.runController.status !== RUN_STATUS.PREPARED) {
      this.pendingStart = null;
      return;
    }

    const engineStarted = this.engine.start(ts);
    const runStarted = this.runController.start(pending.playId, ts);
    this.pendingStart = null;
    if (engineStarted && runStarted.accepted) {
      this.inputLocked = false;
      return;
    }

    this.engine.reset();
    if (runStarted.accepted) this.runController.invalidate(pending.playId, 'start-mismatch', ts);
    this.inputLocked = true;
    this.hud.message('開始処理に失敗しました。ホームからやりなおしてください。', 'error');
  }

  _loop(ts) {
    const dt = this.lastTs ? clampDt((ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;
    if (this.appController.state === APP_STATES.PLAYING && this.engine) {
      this._updateAnimations(dt);
      if (this.engine.startedAt != null) this.hud.setTime(this.engine.elapsedMs(ts));
      const frameState = this.engine.getFrameState();
      frameState.viewPositions = this.view;
      frameState.particles = this.particles;
      frameState.preview = this.preview;
      this.renderer.render(frameState);
      this._startPendingRun(ts);
    }
    requestAnimationFrame((time) => this._loop(time));
  }
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 8);
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
