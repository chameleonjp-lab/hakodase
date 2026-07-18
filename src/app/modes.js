// HAKODASE v2 の開始前モード定義。DOM・Canvas・通信へ依存しない。

export const GAME_MODES = Object.freeze({
  DAILY: 'daily',
  ENDLESS: 'endless',
  PRACTICE: 'practice',
});

const DEFINITIONS = Object.freeze({
  [GAME_MODES.DAILY]: Object.freeze({
    id: GAME_MODES.DAILY,
    label: '本日の出荷',
    shortLabel: '本日',
    description: '全員が同じ問題で競う公式モード。公式問題はPhase 3で接続します。',
    difficulty: 'normal',
    previewSeed: 'daily-preview-v1',
    official: true,
    strictClock: true,
    rankingEnabled: false,
  }),
  [GAME_MODES.ENDLESS]: Object.freeze({
    id: GAME_MODES.ENDLESS,
    label: 'エンドレス',
    shortLabel: '無限',
    description: 'seed付きの盤面を繰り返し遊ぶ練習向けモードです。',
    difficulty: 'normal',
    previewSeed: null,
    official: false,
    strictClock: false,
    rankingEnabled: true,
  }),
  [GAME_MODES.PRACTICE]: Object.freeze({
    id: GAME_MODES.PRACTICE,
    label: '練習',
    shortLabel: '練習',
    description: '短い盤面で基本操作を確認します。チュートリアルはPhase 5で追加します。',
    difficulty: 'practice',
    previewSeed: 'practice-preview-v1',
    official: false,
    strictClock: false,
    rankingEnabled: false,
  }),
});

export function isGameMode(value) {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, value);
}

export function getGameMode(value) {
  return isGameMode(value) ? DEFINITIONS[value] : null;
}

export function listGameModes() {
  return [DEFINITIONS[GAME_MODES.DAILY], DEFINITIONS[GAME_MODES.ENDLESS], DEFINITIONS[GAME_MODES.PRACTICE]];
}
