import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/core/engine.js';
import { RunController, RUN_STATUS } from '../src/app/run-controller.js';
import { canUndoCurrentRun, retireCurrentRun, undoCurrentRun } from '../src/app/play-actions.js';

function simpleBoard() {
  return {
    width: 3,
    height: 1,
    walls: new Set(),
    oneway: new Map(),
    gates: [],
    blocks: [{ id: 0, x: 0, y: 0, w: 1, h: 1, color: 0 }],
  };
}

function startedPair() {
  const engine = new GameEngine(simpleBoard());
  const runController = new RunController();
  const prepared = runController.prepare({ mode: 'endless' });
  engine.start(100);
  runController.start(prepared.run.playId, 100);
  return { engine, runController, playId: prepared.run.playId };
}

test('現在のplayingプレイで履歴がある時だけundo可能', () => {
  const context = startedPair();
  assert.equal(canUndoCurrentRun(context), false);
  context.engine.tryMove(0, 'right', 150);
  assert.equal(canUndoCurrentRun(context), true);
  assert.equal(canUndoCurrentRun({ ...context, playId: context.playId + 1 }), false);
});

test('undoは操作数と距離を戻すが開始時刻を変えない', () => {
  const context = startedPair();
  context.engine.tryMove(0, 'right', 150);
  const result = undoCurrentRun(context);
  assert.equal(result.accepted, true);
  assert.equal(context.engine.startedAt, 100);
  assert.equal(context.engine.swipeCount, 0);
  assert.equal(context.engine.distanceCells, 0);
  assert.equal(context.engine.undoCount, 1);
  assert.deepEqual(context.engine.positions, [{ x: 0, y: 0 }]);
});

test('古いプレイと履歴なしundoを拒否する', () => {
  const context = startedPair();
  assert.equal(undoCurrentRun({ ...context, playId: context.playId + 1 }).reason, 'stale-play');
  assert.equal(undoCurrentRun(context).reason, 'no-history');
});

test('リタイアは現在のplayingプレイを一度だけ終端化する', () => {
  const context = startedPair();
  const first = retireCurrentRun({ runController: context.runController, playId: context.playId, now: 250 });
  assert.equal(first.accepted, true);
  assert.equal(context.runController.status, RUN_STATUS.RETIRED);
  assert.equal(retireCurrentRun({ runController: context.runController, playId: context.playId, now: 300 }).reason, 'invalid-status');
});
