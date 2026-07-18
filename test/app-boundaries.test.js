import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pureAppFiles = [
  '../src/app/app-state.js',
  '../src/app/app-controller.js',
  '../src/app/run-controller.js',
  '../src/app/modes.js',
  '../src/app/player-name.js',
];

test('純粋なappモジュールはDOM・Canvas・保存・Supabaseへ依存しない', () => {
  for (const relativePath of pureAppFiles) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    for (const forbidden of ['document.', 'window.', 'localStorage', 'sessionStorage', 'getContext(', 'supabase']) {
      assert.equal(source.includes(forbidden), false, `${relativePath} contains ${forbidden}`);
    }
  }
});

test('mainはプレイヤー名保存をservices層から読み込む', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /PlayerNameStore[^;]*from ['"]\.\/services\/player-name-store\.js['"]/s);
  assert.doesNotMatch(source, /PlayerNameStore[^;]*from ['"]\.\/app\/player-name\.js['"]/s);
});
