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
    description: '10箱・4色、厳密最短24操作の検証済み試作問題です。正式ランキングへの接続は試遊後に行います。',
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
    description: 'seedで選ばれる10箱・4色、初期直行0箱、厳密最短24操作の検証済み試作問題です。',
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
    description: '練習だけは2箱の短い盤面で基本操作を確認します。通常プレイは10箱です。',
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
