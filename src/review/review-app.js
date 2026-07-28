// P3-05B 試遊レビュー画面。
// 66件の固定候補を1件ずつ遊び、端末内へ手動評価を保存・入出力する。

import {
  summarizeP305PlaytestRecords,
  validateP305PlaytestRecord,
} from '../core/p3-05-playtest-record.js';
import { P305ReviewGame } from './review-game.js';
import {
  P305ReviewStorage,
  beginP305Attempt,
  completeP305Attempt,
  createDefaultReviewIdentity,
  createP305RecordSet,
  normalizeReviewIdentity,
  parseP305RecordSet,
  patchP305ReviewRecord,
  reconcileP305ReviewRecords,
} from './review-store.js';

const PACK_URL = './docs/review/P3_05_REVIEW_PACK.json';
const DECISION_LABEL = Object.freeze({
  pending: '保留',
  accept: '採用',
  revise: '修正',
  reject: '不採用',
});

const byId = (id) => document.getElementById(id);
const elements = Object.fromEntries([
  'reviewLoading', 'reviewFatal', 'reviewApp',
  'progressComplete', 'progressTotal', 'progressBar', 'progressAccept', 'progressRevise', 'progressReject', 'progressPending',
  'nextPending', 'profileFilter', 'candidateSelect', 'previousCandidate', 'nextCandidate',
  'candidatePosition', 'candidateDecisionBadge', 'candidateTemplate', 'candidateProfile', 'candidateOptimal', 'candidateLanes', 'candidateReviewId',
  'reviewBoard', 'playStatus', 'reviewTime', 'reviewSwipes', 'reviewRemaining', 'reviewUndoCount',
  'reviewStart', 'reviewUndo', 'reviewRestart', 'playMessage',
  'recordValidity', 'recordAttempts', 'recordClears', 'recordBestTime', 'recordBestSwipes',
  'reviewForm', 'reviewerName', 'reviewDevice', 'reviewBrowser', 'reviewDecision', 'decisionReason', 'knownDeadlocks', 'reviewNotes', 'recordMessage',
  'exportRecords', 'importRecords', 'clearRecords', 'exportFallback', 'dataMessage',
].map((id) => [id, byId(id)]));

let pack = null;
let records = [];
let currentCandidate = null;
let currentIndex = -1;
let storage = null;
let identity = null;
let game = null;
let lastStateSignature = '';

function formatTime(timeMs) {
  return `${(Math.max(0, Number(timeMs) || 0) / 1000).toFixed(2)}秒`;
}

function setMessage(element, text, kind = 'info') {
  element.textContent = text || '';
  element.dataset.kind = kind;
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function recordFor(candidate = currentCandidate) {
  return candidate ? records.find((record) => record.reviewId === candidate.reviewId) ?? null : null;
}

function replaceRecord(nextRecord) {
  const index = records.findIndex((record) => record.reviewId === nextRecord.reviewId);
  if (index < 0) return false;
  records[index] = nextRecord;
  try {
    storage.saveRecordSet(pack, records);
  } catch (_) {
    setMessage(elements.dataMessage, '端末内へ保存できません。JSONを共有して退避してください。', 'warning');
  }
  return true;
}

function readIdentityForm() {
  return normalizeReviewIdentity({
    reviewer: elements.reviewerName.value,
    device: elements.reviewDevice.value,
    browser: elements.reviewBrowser.value,
  });
}

function saveIdentityForm() {
  identity = readIdentityForm();
  try { storage.saveIdentity(identity); } catch (_) { /* 現在の画面では継続できる */ }
  return identity;
}

function ratingsFromForm() {
  return Object.fromEntries([...document.querySelectorAll('[data-rating]')].map((select) => [
    select.dataset.rating,
    select.value === '' ? null : Number(select.value),
  ]));
}

function writeRatings(ratings = {}) {
  for (const select of document.querySelectorAll('[data-rating]')) {
    select.value = ratings[select.dataset.rating] == null ? '' : String(ratings[select.dataset.rating]);
  }
}

function filterCandidates() {
  const profileId = elements.profileFilter.value;
  return pack.candidates.filter((candidate) => profileId === 'all' || candidate.profileId === profileId);
}

function updateCandidateSelect() {
  const filtered = filterCandidates();
  elements.candidateSelect.replaceChildren(...filtered.map((candidate) => {
    const option = document.createElement('option');
    const record = recordFor(candidate);
    option.value = candidate.reviewId;
    option.textContent = `${candidate.templateId}｜${DECISION_LABEL[record?.decision] ?? '保留'}｜最短${candidate.optimalSwipes}`;
    return option;
  }));
  if (filtered.some((candidate) => candidate.reviewId === currentCandidate?.reviewId)) {
    elements.candidateSelect.value = currentCandidate.reviewId;
  }
  return filtered;
}

function renderProgress() {
  const summary = summarizeP305PlaytestRecords(pack, records);
  elements.progressComplete.textContent = String(summary.complete);
  elements.progressTotal.textContent = String(pack.candidateCount);
  elements.progressAccept.textContent = String(summary.accept);
  elements.progressRevise.textContent = String(summary.revise);
  elements.progressReject.textContent = String(summary.reject);
  elements.progressPending.textContent = String(summary.pending);
  elements.progressBar.style.width = `${Math.min(100, summary.complete / Math.max(1, pack.candidateCount) * 100)}%`;
  elements.nextPending.disabled = summary.pending === 0;
  updateCandidateSelect();
}

function renderRecord() {
  const record = recordFor();
  if (!record || !currentCandidate) return;
  const fallbackIdentity = identity ?? { reviewer: '', device: '', browser: '' };
  elements.reviewerName.value = record.reviewer || fallbackIdentity.reviewer;
  elements.reviewDevice.value = record.device || fallbackIdentity.device;
  elements.reviewBrowser.value = record.browser || fallbackIdentity.browser;
  elements.reviewDecision.value = record.decision;
  elements.decisionReason.value = record.decisionReason;
  elements.knownDeadlocks.value = record.knownDeadlocks.join('\n');
  elements.reviewNotes.value = record.notes;
  writeRatings(record.ratings);

  elements.recordAttempts.textContent = String(record.attemptCount);
  elements.recordClears.textContent = String(record.clearCount);
  elements.recordBestTime.textContent = record.bestTimeMs == null ? '—' : formatTime(record.bestTimeMs);
  elements.recordBestSwipes.textContent = record.bestSwipeCount == null ? '—' : `${record.bestSwipeCount}操作`;

  const validation = validateP305PlaytestRecord(record, currentCandidate);
  elements.recordValidity.dataset.validity = validation.valid ? (validation.complete ? 'complete' : 'draft') : 'invalid';
  elements.recordValidity.textContent = validation.valid ? (validation.complete ? '評価完了' : '入力途中') : '不整合';
  elements.candidateDecisionBadge.dataset.decision = record.decision;
  elements.candidateDecisionBadge.textContent = DECISION_LABEL[record.decision] ?? record.decision;
}

function renderCandidateMeta() {
  if (!currentCandidate) return;
  currentIndex = pack.candidates.findIndex((candidate) => candidate.reviewId === currentCandidate.reviewId);
  const board = currentCandidate.boardData;
  elements.candidatePosition.textContent = `${currentIndex + 1} / ${pack.candidateCount}`;
  elements.candidateTemplate.textContent = currentCandidate.templateId;
  elements.candidateProfile.textContent = `${board.blocks.length}箱 / ${new Set(board.blocks.map((block) => block.color)).size}色 / ${currentCandidate.profileId}`;
  elements.candidateOptimal.textContent = `${currentCandidate.optimalSwipes}操作`;
  elements.candidateLanes.textContent = board.lanes?.length ? `${board.lanes.length}マス` : 'なし';
  elements.candidateReviewId.textContent = currentCandidate.reviewId;
  elements.candidateSelect.value = currentCandidate.reviewId;
  elements.previousCandidate.disabled = currentIndex <= 0;
  elements.nextCandidate.disabled = currentIndex >= pack.candidates.length - 1;
  document.title = `${currentCandidate.templateId}｜HAKODASE 試遊レビュー`;
}

function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set('candidate', currentCandidate.reviewId);
  history.replaceState(null, '', url);
}

function selectCandidate(reviewId, { updateHistory = true } = {}) {
  const candidate = pack.candidates.find((entry) => entry.reviewId === reviewId);
  if (!candidate) return false;
  currentCandidate = candidate;
  lastStateSignature = '';
  game.loadCandidate(candidate);
  renderCandidateMeta();
  renderRecord();
  renderProgress();
  setMessage(elements.playMessage, '「試遊開始」を押すと試行回数を1回加算します。', 'info');
  setMessage(elements.recordMessage, '', 'info');
  if (updateHistory) updateUrl();
  return true;
}

function renderGameState(state) {
  const signature = [state.status, Math.floor(state.timeMs / 20), state.swipeCount, state.remainingCount, state.undoCount, state.inputLocked].join('|');
  if (signature === lastStateSignature) return;
  lastStateSignature = signature;
  elements.reviewTime.textContent = formatTime(state.timeMs);
  elements.reviewSwipes.textContent = String(state.swipeCount);
  elements.reviewRemaining.textContent = state.blockCount ? `${state.remainingCount} / ${state.blockCount}` : '—';
  elements.reviewUndoCount.textContent = String(state.undoCount);
  elements.reviewUndo.disabled = !state.canUndo;
  elements.reviewRestart.disabled = state.status === 'empty' || state.status === 'ready';
  elements.reviewStart.textContent = state.status === 'ready' ? '試遊開始' : state.cleared ? 'もう一度試遊' : '新しい試行を開始';
  elements.playStatus.textContent = state.cleared ? 'クリア' : state.status === 'playing' ? '試遊中' : '開始前';
}

function beginAttempt() {
  const record = recordFor();
  if (!record) return false;
  const currentIdentity = saveIdentityForm();
  const nextRecord = beginP305Attempt(record, currentIdentity, Date.now());
  replaceRecord(nextRecord);
  const started = game.start();
  renderRecord();
  renderProgress();
  if (started) setMessage(elements.playMessage, `試行${nextRecord.attemptCount}回目を開始しました。`, 'info');
  return started;
}

function handleClear(result) {
  const record = recordFor();
  if (!record || result.reviewId !== currentCandidate.reviewId) return;
  try {
    const nextRecord = completeP305Attempt(record, result);
    replaceRecord(nextRecord);
    renderRecord();
    renderProgress();
    const delta = result.swipeCount - currentCandidate.optimalSwipes;
    setMessage(
      elements.playMessage,
      `クリア：${formatTime(result.timeMs)} / ${result.swipeCount}操作${delta === 0 ? '（厳密最短）' : `（最短より+${delta}）`}`,
      'success',
    );
  } catch (error) {
    setMessage(elements.playMessage, `クリア記録を保存できませんでした：${error.message}`, 'error');
  }
}

function saveReviewForm(event) {
  event?.preventDefault();
  const record = recordFor();
  if (!record) return;
  const currentIdentity = saveIdentityForm();
  const nextRecord = patchP305ReviewRecord(record, {
    identity: currentIdentity,
    ratings: ratingsFromForm(),
    decision: elements.reviewDecision.value,
    decisionReason: elements.decisionReason.value,
    knownDeadlocks: elements.knownDeadlocks.value,
    notes: elements.reviewNotes.value,
  });
  replaceRecord(nextRecord);
  const validation = validateP305PlaytestRecord(nextRecord, currentCandidate);
  renderRecord();
  renderProgress();
  if (!validation.valid) {
    setMessage(elements.recordMessage, `記録に不整合があります：${validation.errors.join(' / ')}`, 'error');
  } else if (validation.complete) {
    setMessage(elements.recordMessage, '評価を完了として保存しました。', 'success');
  } else if (nextRecord.decision !== 'pending') {
    setMessage(elements.recordMessage, '保存しましたが、試遊環境・評価・理由・試行結果の不足があります。', 'warning');
  } else {
    setMessage(elements.recordMessage, '入力途中の内容を保存しました。', 'info');
  }
}

function navigate(delta) {
  const index = Math.max(0, Math.min(pack.candidates.length - 1, currentIndex + delta));
  return selectCandidate(pack.candidates[index].reviewId);
}

function nextPendingCandidate() {
  for (let offset = 1; offset <= pack.candidates.length; offset++) {
    const candidate = pack.candidates[(currentIndex + offset) % pack.candidates.length];
    if (recordFor(candidate)?.decision === 'pending') return selectCandidate(candidate.reviewId);
  }
  return false;
}

async function exportRecords() {
  const data = createP305RecordSet(pack, records);
  const text = `${JSON.stringify(data, null, 2)}\n`;
  const fileName = `hakodase-p3-05-review-${new Date().toISOString().slice(0, 10)}.json`;
  elements.exportFallback.hidden = true;
  elements.exportFallback.value = '';
  try {
    const file = new File([text], fileName, { type: 'application/json' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'HAKODASE P3-05 試遊記録', files: [file] });
      setMessage(elements.dataMessage, '記録JSONの共有画面を開きました。', 'success');
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setMessage(elements.dataMessage, '記録JSONをクリップボードへコピーしました。', 'success');
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      setMessage(elements.dataMessage, '共有をキャンセルしました。', 'info');
      return;
    }
  }
  elements.exportFallback.hidden = false;
  elements.exportFallback.value = text;
  elements.exportFallback.focus({ preventScroll: true });
  elements.exportFallback.select();
  setMessage(elements.dataMessage, '共有できないため、JSONを選択できる形で表示しました。', 'warning');
}

async function importRecords(file) {
  if (!file) return;
  const text = await file.text();
  const parsed = parseP305RecordSet(text, pack);
  if (!parsed.valid) {
    setMessage(elements.dataMessage, `読み込めません：${parsed.errors.slice(0, 5).join(' / ')}`, 'error');
    return;
  }
  records = parsed.records.map((record) => JSON.parse(JSON.stringify(record)));
  storage.saveRecordSet(pack, records);
  renderProgress();
  renderRecord();
  setMessage(elements.dataMessage, '記録JSONを読み込みました。', 'success');
}

function clearRecords() {
  if (!confirm('この端末に保存した66候補の試遊記録をすべて消しますか？')) return;
  storage.clear();
  records = reconcileP305ReviewRecords(pack, null);
  renderProgress();
  renderRecord();
  setMessage(elements.dataMessage, '端末内の試遊記録を消しました。', 'success');
}

function installEvents() {
  elements.profileFilter.addEventListener('change', () => {
    const filtered = updateCandidateSelect();
    if (filtered.length && !filtered.some((candidate) => candidate.reviewId === currentCandidate.reviewId)) {
      selectCandidate(filtered[0].reviewId);
    }
  });
  elements.candidateSelect.addEventListener('change', () => selectCandidate(elements.candidateSelect.value));
  elements.previousCandidate.addEventListener('click', () => navigate(-1));
  elements.nextCandidate.addEventListener('click', () => navigate(1));
  elements.nextPending.addEventListener('click', nextPendingCandidate);
  elements.reviewStart.addEventListener('click', beginAttempt);
  elements.reviewRestart.addEventListener('click', beginAttempt);
  elements.reviewUndo.addEventListener('click', () => {
    if (game.undo()) setMessage(elements.playMessage, '1操作戻しました。タイマーは戻りません。', 'info');
  });
  elements.reviewForm.addEventListener('submit', saveReviewForm);
  elements.exportRecords.addEventListener('click', exportRecords);
  elements.importRecords.addEventListener('change', async () => {
    try { await importRecords(elements.importRecords.files?.[0]); }
    catch (error) { setMessage(elements.dataMessage, `読み込みに失敗しました：${error.message}`, 'error'); }
    elements.importRecords.value = '';
  });
  elements.clearRecords.addEventListener('click', clearRecords);
  addEventListener('resize', () => game.fit());
}

async function loadPack() {
  const response = await fetch(PACK_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`候補データを取得できません（HTTP ${response.status}）`);
  const value = await response.json();
  if (!value || value.schemaVersion !== 'hakodase.review-pack/1' || value.candidateCount !== 66 || !Array.isArray(value.candidates)) {
    throw new Error('候補データの形式または件数が一致しません。');
  }
  return value;
}

async function boot() {
  try {
    pack = await loadPack();
    storage = new P305ReviewStorage(safeLocalStorage());
    identity = storage.loadIdentity(createDefaultReviewIdentity({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    }));
    records = storage.loadRecordSet(pack);

    for (const profile of pack.profiles) {
      const option = document.createElement('option');
      option.value = profile.profileId;
      option.textContent = `${profile.boxCount}箱 / ${profile.colorCount}色（${profile.candidateCount}件）`;
      elements.profileFilter.append(option);
    }

    game = new P305ReviewGame({
      canvas: elements.reviewBoard,
      onState: renderGameState,
      onClear: handleClear,
      onError: (error) => setMessage(elements.playMessage, error?.message || '試遊処理でエラーが発生しました。', 'error'),
    });
    installEvents();
    renderProgress();

    const requestedId = new URL(location.href).searchParams.get('candidate');
    const first = pack.candidates.find((candidate) => candidate.reviewId === requestedId) ?? pack.candidates[0];
    selectCandidate(first.reviewId, { updateHistory: requestedId !== first.reviewId });

    elements.reviewLoading.hidden = true;
    elements.reviewApp.hidden = false;
    game.fit();

    globalThis.hakodaseReview = Object.freeze({
      get pack() { return pack; },
      get records() { return records.map((record) => JSON.parse(JSON.stringify(record))); },
      snapshot: () => game.snapshot(),
      selectReviewId: (reviewId) => selectCandidate(reviewId),
      start: () => beginAttempt(),
      exportRecordSet: () => createP305RecordSet(pack, records),
      summary: () => summarizeP305PlaytestRecords(pack, records),
    });
  } catch (error) {
    elements.reviewLoading.hidden = true;
    elements.reviewFatal.hidden = false;
    elements.reviewFatal.textContent = `試遊レビューを開始できません：${error.message}`;
    console.error(error);
  }
}

boot();
