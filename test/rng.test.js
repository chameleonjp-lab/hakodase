import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, hashSeed } from '../src/core/rng.js';

test('同じ seed なら同じ数列を返す', () => {
  const a = makeRng('hakodase');
  const b = makeRng('hakodase');
  const seqA = Array.from({ length: 20 }, () => a.next());
  const seqB = Array.from({ length: 20 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('異なる seed なら異なる数列になる', () => {
  const a = makeRng('seed-1');
  const b = makeRng('seed-2');
  const seqA = Array.from({ length: 20 }, () => a.next());
  const seqB = Array.from({ length: 20 }, () => b.next());
  assert.notDeepEqual(seqA, seqB);
});

test('next は [0,1) の範囲に収まる', () => {
  const r = makeRng(42);
  for (let i = 0; i < 1000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('int(n) は [0,n) の整数を返す', () => {
  const r = makeRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(6);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 6);
  }
});

test('数値 seed と文字列 seed は別 hash', () => {
  assert.notEqual(hashSeed(123), hashSeed('123'));
});
