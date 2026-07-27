// HAKODASE P3-05 手動試遊記録の契約。
// 自動検査の候補証拠と、人間が実際に遊んだ評価を分離して保存する。

export const P3_05_PLAYTEST_RECORD_SCHEMA = 'hakodase.playtest-record/1';
export const P3_05_PLAYTEST_DECISIONS = Object.freeze(['pending', 'accept', 'reject', 'revise']);
export const P3_05_RATING_FIELDS = Object.freeze([
  'enjoyment',
  'clarity',
  'difficulty',
  'distinctiveness',
  'fairness',
]);

function freezeDeep(value) {
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    return Object.freeze(value);
  }
  return value;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || value.length < 20) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRating(value) {
  return value == null || (Number.isInteger(value) && value >= 1 && value <= 5);
}

function nonNegativeIntegerOrNull(value) {
  return value == null || (Number.isInteger(value) && value >= 0);
}

export function createEmptyP305PlaytestRecord(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new TypeError('candidate is required');
  return freezeDeep({
    schemaVersion: P3_05_PLAYTEST_RECORD_SCHEMA,
    reviewId: candidate.reviewId,
    puzzleId: candidate.puzzleId,
    boardHash: candidate.boardHash,
    templateId: candidate.templateId,
    profileId: candidate.profileId,
    reviewer: '',
    device: '',
    browser: '',
    playedAt: null,
    attemptCount: 0,
    clearCount: 0,
    bestTimeMs: null,
    bestSwipeCount: null,
    ratings: {
      enjoyment: null,
      clarity: null,
      difficulty: null,
      distinctiveness: null,
      fairness: null,
    },
    knownDeadlocks: [],
    notes: '',
    decision: 'pending',
    decisionReason: '',
  });
}

export function validateP305PlaytestRecord(record, candidate = null) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return Object.freeze({ valid: false, complete: false, errors: Object.freeze(['invalid-root']) });
  }

  if (record.schemaVersion !== P3_05_PLAYTEST_RECORD_SCHEMA) errors.push('unsupported-schema-version');
  for (const field of ['reviewId', 'puzzleId', 'boardHash', 'templateId', 'profileId']) {
    if (typeof record[field] !== 'string' || !record[field]) errors.push(`missing-${field}`);
    if (candidate && record[field] !== candidate[field]) errors.push(`${field}-mismatch`);
  }

  if (typeof record.reviewer !== 'string') errors.push('invalid-reviewer');
  if (typeof record.device !== 'string') errors.push('invalid-device');
  if (typeof record.browser !== 'string') errors.push('invalid-browser');
  if (record.playedAt != null && !isIsoDate(record.playedAt)) errors.push('invalid-played-at');
  if (!Number.isInteger(record.attemptCount) || record.attemptCount < 0) errors.push('invalid-attempt-count');
  if (!Number.isInteger(record.clearCount) || record.clearCount < 0 || record.clearCount > record.attemptCount) {
    errors.push('invalid-clear-count');
  }
  if (!nonNegativeIntegerOrNull(record.bestTimeMs)) errors.push('invalid-best-time');
  if (!nonNegativeIntegerOrNull(record.bestSwipeCount)) errors.push('invalid-best-swipe-count');
  if (candidate && Number.isInteger(record.bestSwipeCount) && record.bestSwipeCount < candidate.optimalSwipes) {
    errors.push('best-swipes-below-exact-optimum');
  }

  if (!record.ratings || typeof record.ratings !== 'object' || Array.isArray(record.ratings)) {
    errors.push('invalid-ratings');
  } else {
    for (const field of P3_05_RATING_FIELDS) {
      if (!isRating(record.ratings[field])) errors.push(`invalid-rating-${field}`);
    }
  }

  if (!Array.isArray(record.knownDeadlocks)
      || record.knownDeadlocks.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    errors.push('invalid-known-deadlocks');
  }
  if (typeof record.notes !== 'string') errors.push('invalid-notes');
  if (!P3_05_PLAYTEST_DECISIONS.includes(record.decision)) errors.push('invalid-decision');
  if (typeof record.decisionReason !== 'string') errors.push('invalid-decision-reason');

  const ratingsComplete = record.ratings
    && P3_05_RATING_FIELDS.every((field) => Number.isInteger(record.ratings[field]));
  const identityComplete = Boolean(record.reviewer.trim() && record.device.trim() && record.browser.trim() && isIsoDate(record.playedAt));
  const decisionComplete = record.decision !== 'pending' && Boolean(record.decisionReason.trim());
  const attemptComplete = Number.isInteger(record.attemptCount) && record.attemptCount >= 1;
  const acceptedComplete = record.decision !== 'accept'
    || (record.clearCount >= 1
      && Number.isInteger(record.bestTimeMs)
      && Number.isInteger(record.bestSwipeCount));
  const complete = errors.length === 0
    && identityComplete
    && attemptComplete
    && ratingsComplete
    && decisionComplete
    && acceptedComplete;

  return Object.freeze({
    valid: errors.length === 0,
    complete,
    errors: Object.freeze(errors),
  });
}

export function summarizeP305PlaytestRecords(pack, records) {
  if (!pack || !Array.isArray(pack.candidates)) throw new TypeError('pack.candidates is required');
  if (!Array.isArray(records)) throw new TypeError('records must be an array');

  const candidateByReviewId = new Map(pack.candidates.map((candidate) => [candidate.reviewId, candidate]));
  const result = { pending: 0, accept: 0, reject: 0, revise: 0, invalid: 0, complete: 0 };
  const seen = new Set();

  for (const record of records) {
    if (seen.has(record?.reviewId)) {
      result.invalid++;
      continue;
    }
    seen.add(record?.reviewId);
    const candidate = candidateByReviewId.get(record?.reviewId);
    const validation = validateP305PlaytestRecord(record, candidate ?? null);
    if (!candidate || !validation.valid) {
      result.invalid++;
      continue;
    }
    result[record.decision]++;
    if (validation.complete) result.complete++;
  }

  result.missing = Math.max(0, pack.candidates.length - seen.size);
  result.readyForOfficialSelection = result.accept >= 30 && result.invalid === 0;
  return Object.freeze(result);
}
