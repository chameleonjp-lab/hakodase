// P3-05B 試遊レビュー画面の端末内保存と入出力。
// DOMやCanvasへ依存せず、候補パックとP3-05Aの記録契約だけを扱う。

import {
  createEmptyP305PlaytestRecord,
  summarizeP305PlaytestRecords,
  validateP305PlaytestRecord,
} from '../core/p3-05-playtest-record.js';

export const P3_05_REVIEW_STORAGE_KEY = 'hakodase.p3-05.review-records.v1';
export const P3_05_REVIEW_IDENTITY_KEY = 'hakodase.p3-05.review-identity.v1';
export const P3_05_RECORD_SET_SCHEMA = 'hakodase.playtest-record-set/1';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength = 5000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function integerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function isoNow(now = Date.now()) {
  const date = new Date(now);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function normalizeRatings(ratings = {}) {
  const output = {};
  for (const field of ['enjoyment', 'clarity', 'difficulty', 'distinctiveness', 'fairness']) {
    const number = Number(ratings[field]);
    output[field] = Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
  }
  return output;
}

function recordMap(records) {
  const map = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.reviewId || map.has(record.reviewId)) continue;
    map.set(record.reviewId, record);
  }
  return map;
}

export function createDefaultReviewIdentity({ userAgent = '', platform = '' } = {}) {
  const ua = String(userAgent || '');
  const device = /iPad/i.test(ua)
    ? 'iPad'
    : /iPhone/i.test(ua)
      ? 'iPhone'
      : /Android/i.test(ua)
        ? 'Android'
        : cleanText(platform, 120) || '不明な端末';
  const browser = /CriOS/i.test(ua)
    ? 'Chrome iOS'
    : /FxiOS/i.test(ua)
      ? 'Firefox iOS'
      : /Safari/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua)
        ? 'Safari'
        : /Chrome|Chromium/i.test(ua)
          ? 'Chrome'
          : '不明なブラウザ';
  return { reviewer: '', device, browser };
}

export function normalizeReviewIdentity(identity = {}) {
  return Object.freeze({
    reviewer: cleanText(identity.reviewer, 80),
    device: cleanText(identity.device, 120),
    browser: cleanText(identity.browser, 120),
  });
}

export function reconcileP305ReviewRecords(pack, storedSet = null) {
  if (!pack || !Array.isArray(pack.candidates)) throw new TypeError('pack.candidates is required');
  const storedRecords = storedSet?.packVersion === pack.packVersion
    && storedSet?.schemaVersion === P3_05_RECORD_SET_SCHEMA
    ? recordMap(storedSet.records)
    : new Map();

  return pack.candidates.map((candidate) => {
    const existing = storedRecords.get(candidate.reviewId);
    if (existing) {
      const validation = validateP305PlaytestRecord(existing, candidate);
      if (validation.valid) return clone(existing);
    }
    return clone(createEmptyP305PlaytestRecord(candidate));
  });
}

export function beginP305Attempt(record, identity, now = Date.now()) {
  const next = clone(record);
  const normalizedIdentity = normalizeReviewIdentity(identity);
  next.reviewer = normalizedIdentity.reviewer;
  next.device = normalizedIdentity.device;
  next.browser = normalizedIdentity.browser;
  next.playedAt = isoNow(now);
  next.attemptCount = Math.max(0, Number(next.attemptCount) || 0) + 1;
  return next;
}

export function completeP305Attempt(record, { timeMs, swipeCount } = {}) {
  const next = clone(record);
  const time = integerOrNull(timeMs);
  const swipes = integerOrNull(swipeCount);
  if (time == null || swipes == null) throw new TypeError('timeMs and swipeCount must be non-negative integers');
  next.clearCount = Math.min(
    Math.max(0, Number(next.attemptCount) || 0),
    Math.max(0, Number(next.clearCount) || 0) + 1,
  );
  if (next.bestTimeMs == null || time < next.bestTimeMs) next.bestTimeMs = time;
  if (next.bestSwipeCount == null || swipes < next.bestSwipeCount) next.bestSwipeCount = swipes;
  return next;
}

export function patchP305ReviewRecord(record, patch = {}) {
  const next = clone(record);
  if (patch.identity) {
    const identity = normalizeReviewIdentity(patch.identity);
    next.reviewer = identity.reviewer;
    next.device = identity.device;
    next.browser = identity.browser;
  }
  if (patch.ratings) next.ratings = normalizeRatings(patch.ratings);
  if (patch.decision != null) next.decision = String(patch.decision);
  if (patch.decisionReason != null) next.decisionReason = cleanText(patch.decisionReason, 3000);
  if (patch.notes != null) next.notes = cleanText(patch.notes, 10000);
  if (patch.knownDeadlocks != null) {
    const values = Array.isArray(patch.knownDeadlocks)
      ? patch.knownDeadlocks
      : String(patch.knownDeadlocks).split(/\r?\n/);
    next.knownDeadlocks = values.map((entry) => cleanText(entry, 1000)).filter(Boolean).slice(0, 50);
  }
  return next;
}

export function createP305RecordSet(pack, records, exportedAt = Date.now()) {
  if (!pack?.packVersion) throw new TypeError('pack.packVersion is required');
  return {
    schemaVersion: P3_05_RECORD_SET_SCHEMA,
    packVersion: pack.packVersion,
    generatorVersion: pack.generatorVersion,
    exportedAt: isoNow(exportedAt),
    records: clone(records),
  };
}

export function parseP305RecordSet(text, pack) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (_) {
    return Object.freeze({ valid: false, errors: Object.freeze(['invalid-json']), records: null });
  }
  if (parsed?.schemaVersion !== P3_05_RECORD_SET_SCHEMA) {
    return Object.freeze({ valid: false, errors: Object.freeze(['unsupported-schema-version']), records: null });
  }
  if (parsed?.packVersion !== pack?.packVersion) {
    return Object.freeze({ valid: false, errors: Object.freeze(['pack-version-mismatch']), records: null });
  }
  if (!Array.isArray(parsed.records)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['invalid-records']), records: null });
  }

  const candidateById = new Map(pack.candidates.map((candidate) => [candidate.reviewId, candidate]));
  const seen = new Set();
  const errors = [];
  for (const record of parsed.records) {
    if (!record?.reviewId || seen.has(record.reviewId)) {
      errors.push('duplicate-or-missing-review-id');
      continue;
    }
    seen.add(record.reviewId);
    const candidate = candidateById.get(record.reviewId);
    if (!candidate) {
      errors.push(`unknown-review-id:${record.reviewId}`);
      continue;
    }
    const validation = validateP305PlaytestRecord(record, candidate);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `${record.reviewId}:${error}`));
  }
  if (errors.length) return Object.freeze({ valid: false, errors: Object.freeze(errors), records: null });
  return Object.freeze({
    valid: true,
    errors: Object.freeze([]),
    records: Object.freeze(reconcileP305ReviewRecords(pack, parsed)),
  });
}

export function summarizeP305ReviewProgress(pack, records) {
  return summarizeP305PlaytestRecords(pack, records);
}

export class P305ReviewStorage {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  loadRecordSet(pack) {
    try {
      const raw = this.storage?.getItem?.(P3_05_REVIEW_STORAGE_KEY);
      return reconcileP305ReviewRecords(pack, raw ? JSON.parse(raw) : null);
    } catch (_) {
      return reconcileP305ReviewRecords(pack, null);
    }
  }

  saveRecordSet(pack, records) {
    const value = createP305RecordSet(pack, records);
    this.storage?.setItem?.(P3_05_REVIEW_STORAGE_KEY, JSON.stringify(value));
    return value;
  }

  loadIdentity(defaultIdentity = {}) {
    try {
      const raw = this.storage?.getItem?.(P3_05_REVIEW_IDENTITY_KEY);
      return normalizeReviewIdentity(raw ? JSON.parse(raw) : defaultIdentity);
    } catch (_) {
      return normalizeReviewIdentity(defaultIdentity);
    }
  }

  saveIdentity(identity) {
    const value = normalizeReviewIdentity(identity);
    this.storage?.setItem?.(P3_05_REVIEW_IDENTITY_KEY, JSON.stringify(value));
    return value;
  }

  clear() {
    this.storage?.removeItem?.(P3_05_REVIEW_STORAGE_KEY);
  }
}
