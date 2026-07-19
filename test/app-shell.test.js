import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('ホーム・名前確認・カウントダウン・プレイ・ルール・記録の画面を持つ', () => {
  for (const state of ['home', 'nameConfirm', 'countdown', 'playing', 'rules', 'ranking']) {
    assert.match(html, new RegExp(`data-screen=["']${state}["']`));
  }
});

test('3モードの選択肢を一度ずつ持つ', () => {
  for (const mode of ['daily', 'endless', 'practice']) {
    assert.equal((html.match(new RegExp(`data-mode=["']${mode}["']`, 'g')) || []).length, 1);
  }
});

test('名前入力はnickname補完とエンター完了を持つ', () => {
  assert.match(html, /id="playerNameInput"/);
  assert.match(html, /autocomplete="nickname"/);
  assert.match(html, /enterkeyhint="done"/);
});

test('ホームの共通導線を持つ', () => {
  for (const id of ['homeStart', 'homeRules', 'homeShare', 'homeLab']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('カウントダウンとSTART表示に必要な要素を持つ', () => {
  for (const id of ['countdownMode', 'countdownValue', 'countdownHint', 'countdownCancel', 'startFlash']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /aria-live="assertive"/);
});

test('main.jsが取得する全IDをindex.htmlが持つ', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const ids = [...main.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
  assert.ok(ids.length > 0);
  for (const id of new Set(ids)) assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
});
