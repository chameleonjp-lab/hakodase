// GameEngineとRunControllerを同じ単調時刻で開始する小さな取引。

export function startPreparedRun({ engine, runController, playId, now }) {
  if (!engine || !runController) return Object.freeze({ accepted: false, reason: 'missing-controller' });
  if (!Number.isFinite(now) || now < 0) return Object.freeze({ accepted: false, reason: 'invalid-time' });
  if (engine.status !== 'ready') return Object.freeze({ accepted: false, reason: 'engine-not-ready' });
  if (!runController.isCurrent(playId)) return Object.freeze({ accepted: false, reason: 'stale-play' });
  if (runController.status !== 'prepared') return Object.freeze({ accepted: false, reason: 'run-not-prepared' });

  const engineStarted = engine.start(now);
  if (!engineStarted) return Object.freeze({ accepted: false, reason: 'engine-start-failed' });

  const runStarted = runController.start(playId, now);
  if (!runStarted.accepted) {
    engine.reset();
    return Object.freeze({ accepted: false, reason: 'run-start-failed', detail: runStarted.reason });
  }

  return Object.freeze({ accepted: true, playId, startedAt: now });
}
