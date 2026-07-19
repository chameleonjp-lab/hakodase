import test from 'node:test';
import assert from 'node:assert/strict';
import { shareResult } from '../src/services/share-result.js';

test('Web Shareが成功したらclipboardを使わない', async () => {
  let copied = 0;
  const result = await shareResult({ text:'x', url:'u', navigatorRef:{ share:async()=>{}, clipboard:{writeText:async()=>{copied++;}} } });
  assert.equal(result.method, 'web-share');
  assert.equal(copied, 0);
});

test('利用者キャンセルをエラーやclipboard fallbackにしない', async () => {
  let copied = 0;
  const error = new Error('cancel'); error.name = 'AbortError';
  const result = await shareResult({ text:'x', navigatorRef:{ share:async()=>{throw error;}, clipboard:{writeText:async()=>{copied++;}} } });
  assert.equal(result.status, 'cancelled');
  assert.equal(copied, 0);
});

test('Web Share失敗後にclipboardへフォールバックする', async () => {
  let value = '';
  const result = await shareResult({ text:'記録', url:'https://example.test/', navigatorRef:{ share:async()=>{throw new Error('fail');}, clipboard:{writeText:async(text)=>{value=text;}} } });
  assert.equal(result.method, 'clipboard');
  assert.equal(value, '記録\nhttps://example.test/');
});

test('すべて利用不能なら選択可能テキスト用の全文を返す', async () => {
  const result = await shareResult({ text:'記録', url:'u', navigatorRef:{} });
  assert.equal(result.status, 'fallback');
  assert.equal(result.fullText, '記録\nu');
});
