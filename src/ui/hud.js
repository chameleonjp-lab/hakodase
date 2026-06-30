// HUD: タイマー・手数・メッセージ・ランキング表示の DOM 更新のみ担当。
// 毎フレームではなくイベント時/必要時に更新する（レイアウト再計算を避ける）。

/** ミリ秒を「12.34秒」形式へ。 */
export function formatTime(ms) {
  return (ms / 1000).toFixed(2) + '秒';
}

export class HUD {
  /**
   * @param {object} els { time, moves, target, message, ranking, difficulty, seed }
   */
  constructor(els) {
    this.els = els;
    this._lastTimeText = '';
  }

  setTime(ms) {
    const t = formatTime(ms);
    if (t !== this._lastTimeText) {
      this.els.time.textContent = t;
      this._lastTimeText = t;
    }
  }

  setMoves(n) {
    this.els.moves.textContent = String(n);
  }

  setTarget(moves, exact) {
    if (!this.els.target) return;
    this.els.target.textContent = exact ? `最短${moves}手` : `最短${moves}手以上`;
  }

  setSeed(seed, difficultyLabel) {
    if (this.els.seed) this.els.seed.textContent = `seed: ${seed}`;
    if (this.els.difficulty) this.els.difficulty.value = '';
  }

  message(text, kind = 'info') {
    if (!this.els.message) return;
    this.els.message.textContent = text || '';
    this.els.message.dataset.kind = kind;
  }

  /**
   * ランキングを描画。
   * @param {Array} scores
   * @param {object} [opts] { highlightAt: ISO string }
   */
  renderRanking(scores, opts = {}) {
    const root = this.els.ranking;
    if (!root) return;
    root.innerHTML = '';
    if (!scores.length) {
      const li = document.createElement('li');
      li.className = 'rank-empty';
      li.textContent = 'まだ記録がありません';
      root.appendChild(li);
      return;
    }
    scores.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'rank-row';
      if (opts.highlightAt && s.clearedAt === opts.highlightAt) li.classList.add('rank-new');
      const rank = document.createElement('span');
      rank.className = 'rank-pos';
      rank.textContent = `${i + 1}`;
      const time = document.createElement('span');
      time.className = 'rank-time';
      time.textContent = formatTime(s.timeMs);
      const meta = document.createElement('span');
      meta.className = 'rank-meta';
      meta.textContent = `${s.moves}手`;
      li.append(rank, time, meta);
      root.appendChild(li);
    });
  }
}
