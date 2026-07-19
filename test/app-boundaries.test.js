import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pureAppFiles = [
  '../src/app/app-state.js',
  '../src/app/app-controller.js',
  '../src/app/run-controller.js',
  '../src/app/countdown-controller.js',
  '../src/app/start-run.js',
  '../src/app/visibility-policy.js',
  '../src/app/modes.js',
  '../src/app/player-name.js',
  '../src/app/play-control-policy.js',
  '../src/app/result-model.js',
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

test('P2-03統合は専用モジュールで開始取引と中断監視を接続する', () => {
  const flow = readFileSync(new URL('../src/ui/countdown-flow.js', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../src/p2-03-bootstrap.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(flow, /CountdownController/);
  assert.match(flow, /startPreparedRun/);
  assert.match(flow, /shouldInvalidateOnHidden/);
  assert.match(flow, /visibilitychange/);
  assert.match(flow, /_startPendingRun\s*=\s*function disableLegacyPendingStart/);
  assert.match(bootstrap, /installCountdownFlow/);
  assert.match(html, /src="src\/p2-03-bootstrap\.js"/);
});

test('P2-04統合は専用モジュールでundo・リタイア・詰みを接続する', () => {
  const flow = readFileSync(new URL('../src/ui/playing-controls.js', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../src/p2-04-bootstrap.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(flow, /derivePlayControlState/);
  assert.match(flow, /engine\.undo\(\)/);
  assert.match(flow, /runController\.retire/);
  assert.match(flow, /hasAnyLegalMove/);
  assert.match(bootstrap, /installPlayingControls/);
  assert.match(html, /src="src\/p2-04-bootstrap\.js"/);
});

test('P2-05統合は結果モデル・共有サービス・結果画面を責務分離する', () => {
  const flow = readFileSync(new URL('../src/ui/result-flow.js', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../src/app/result-model.js', import.meta.url), 'utf8');
  const share = readFileSync(new URL('../src/services/share-result.js', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../src/p2-05-bootstrap.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(flow, /createClearResultModel/);
  assert.match(flow, /shareResult/);
  assert.match(flow, /game\._onClear\s*=\s*async function onClearP205/);
  assert.match(flow, /shownPlayIds/);
  assert.match(model, /buildResultShareText/);
  assert.match(share, /navigatorRef\?\.share/);
  assert.match(share, /clipboard/);
  assert.match(bootstrap, /installResultFlow/);
  assert.match(html, /src="src\/p2-05-bootstrap\.js"/);
});
