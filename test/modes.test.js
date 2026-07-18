import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_MODES, getGameMode, isGameMode, listGameModes } from '../src/app/modes.js';

test('3モードを固定順で返す', () => {
  assert.deepEqual(listGameModes().map((mode) => mode.id), [GAME_MODES.DAILY, GAME_MODES.ENDLESS, GAME_MODES.PRACTICE]);
});

test('未知のモードを拒否する', () => {
  assert.equal(isGameMode('unknown'), false);
  assert.equal(getGameMode('unknown'), null);
});

test('モード定義を外部から変更できない', () => {
  const daily = getGameMode(GAME_MODES.DAILY);
  assert.equal(Object.isFrozen(daily), true);
  assert.throws(() => { daily.label = '変更'; }, TypeError);
});

test('本日の出荷だけが厳格時計を使う', () => {
  assert.equal(getGameMode(GAME_MODES.DAILY).strictClock, true);
  assert.equal(getGameMode(GAME_MODES.ENDLESS).strictClock, false);
  assert.equal(getGameMode(GAME_MODES.PRACTICE).strictClock, false);
});
