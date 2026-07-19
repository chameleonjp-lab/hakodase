// undoとリタイアの実行条件をまとめる純粋な操作関数。
// DOM、Canvas、保存、通信へ依存しない。

import { RUN_STATUS } from './run-controller.js';
import { analyzePlayState } from '../core/play-status.js';

function rejected(reason) {
  return Object.freeze({ accepted: false, reason });
}

export function canUndoCurrentRun({ engine, runController, playId }) {
  if (!engine || !runController || playId == null) return false;
  if (!runController.isPlaying(playId) || engine.status !== 'playing') return false;
  return typeof engine.canUndo === 'function'
    ? engine.canUndo()
    : Array.isArray(engine.history) && engine.history.length > 0;
}

export function undoCurrentRun({ engine, runController, playId }) {
  if (!engine || !runController || playId == null) return rejected('missing-context');
  if (!runController.isCurrent(playId)) return rejected('stale-play');
  if (!runController.isPlaying(playId) || engine.status !== 'playing') return rejected('invalid-status');
  if (!canUndoCurrentRun({ engine, runController, playId })) return rejected('no-history');

  const result = engine.undo();
  if (!result?.undone) return rejected('undo-rejected');

  return Object.freeze({
    accepted: true,
    reason: null,
    swipeCount: engine.swipeCount,
    distanceCells: engine.distanceCells,
    undoCount: engine.undoCount,
    analysis: analyzePlayState(engine.board, engine.positions, engine.status),
  });
}

export function retireCurrentRun({ runController, playId, now = 0, reason = 'player-retired' }) {
  if (!runController || playId == null) return rejected('missing-context');
  if (!runController.isCurrent(playId)) return rejected('stale-play');
  if (runController.status !== RUN_STATUS.PLAYING) return rejected('invalid-status');
  const result = runController.retire(playId, reason, now);
  return result?.accepted
    ? Object.freeze({ accepted: true, reason: null, run: result.run })
    : rejected(result?.reason || 'retire-rejected');
}
