// HUD: タイマー・操作数・移動距離・メッセージ・ランキング表示の DOM 更新のみ担当。

export function formatTime(ms) {
  return (ms / 1000).toFixed(2) + '秒';
}

export class HUD {
  constructor(els) { this.els = els; this._lastTimeText = ''; }

  setTime(ms) {
    const t = formatTime(ms);
    if (t !== this._lastTimeText) { this.els.time.textContent = t; this._lastTimeText = t; }
  }

  setStats(swipeCount, distanceCells = 0) {
    this.els.moves.textContent = `${swipeCount}操作 / 移動${distanceCells}マス`;
  }

  setTarget(optimalSwipes, exact) {
    if (!this.els.target) return;
    if (!Number.isFinite(optimalSwipes) || optimalSwipes < 0) this.els.target.textContent = '最短—';
    else this.els.target.textContent = exact ? `最短${optimalSwipes}操作` : `最短${optimalSwipes}操作以上`;
  }

  setSeed(seed) { if (this.els.seed) this.els.seed.textContent = `seed: ${seed}`; }

  message(text, kind = 'info') {
    if (!this.els.message) return;
    this.els.message.textContent = text || '';
    this.els.message.dataset.kind = kind;
  }

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
      const rank = document.createElement('span'); rank.className = 'rank-pos'; rank.textContent = `${i + 1}`;
      const time = document.createElement('span'); time.className = 'rank-time'; time.textContent = formatTime(s.timeMs);
      const meta = document.createElement('span'); meta.className = 'rank-meta'; meta.textContent = `${s.swipeCount}操作 / 移動${s.distanceCells}マス`;
      li.append(rank, time, meta); root.appendChild(li);
    });
  }
}
