import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBoard, getFallbackBoard, DIFFICULTIES } from '../src/core/generator.js';
import { solve } from '../src/core/solver.js';
import { manhattanLowerBound } from '../src/core/rules.js';

function posOf(board) {
  return board.blocks.map((b) => ({ x: b.x, y: b.y }));
}

test('同じ seed・難易度なら同じ盤面が生成される', () => {
  const a = generateBoard({ seed: 'hako-123', difficulty: 'normal' });
  const b = generateBoard({ seed: 'hako-123', difficulty: 'normal' });
  assert.deepEqual(a.board.blocks, b.board.blocks);
  assert.deepEqual(a.board.goals, b.board.goals);
  assert.deepEqual(a.board.walls, b.board.walls);
  assert.deepEqual(a.board.oneway, b.board.oneway);
  assert.deepEqual(a.board.gates, b.board.gates);
  assert.equal(a.shortestSolutionMoves, b.shortestSolutionMoves);
  assert.equal(a.fromFallback, b.fromFallback);
});

test('異なる seed なら（多くの場合）異なる盤面になる', () => {
  const a = generateBoard({ seed: 'seedA', difficulty: 'normal' });
  const b = generateBoard({ seed: 'seedB', difficulty: 'normal' });
  assert.notDeepEqual(a.board.blocks, b.board.blocks);
});

test('ランキング対象の難易度は最短20手以上を保証する（マンハッタン下界）', () => {
  for (const diff of ['normal', 'hard', 'expert']) {
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const r = generateBoard({ seed, difficulty: diff });
      // 報告値が 20 以上。
      assert.ok(
        r.shortestSolutionMoves >= 20,
        `${diff}/${seed}: moves=${r.shortestSolutionMoves} fallback=${r.fromFallback}`
      );
      // 報告値が真の最短手数の下界(マンハッタン総和)を下回らない＝20手保証の根拠。
      assert.ok(manhattanLowerBound(r.board, posOf(r.board)) >= 20, `${diff}/${seed} 下界不足`);
    }
  }
});

test('ランキング盤面は開放グリッド（壁・一方通行なし）でゲートを持つ', () => {
  const r = generateBoard({ seed: 'gates', difficulty: 'hard' });
  assert.equal(r.board.walls.size, 0);
  assert.equal(r.board.oneway.size, 0);
  assert.ok(r.board.gates.length >= 1);
});

test('BFS検証難易度(練習)の生成盤面は実際に解ける', () => {
  for (const seed of ['p1', 'p2', 'p3']) {
    const r = generateBoard({ seed, difficulty: 'practice' });
    const s = solve(r.board);
    assert.equal(s.solved, true, `practice/${seed} 解けない`);
    if (r.exact) assert.equal(s.moves, r.shortestSolutionMoves);
  }
});

test('フォールバック盤面は最短20手以上（min20難易度）かつ縦移動で厳密に可解', () => {
  for (const diff of ['normal', 'hard', 'expert']) {
    const board = getFallbackBoard(diff);
    const lb = manhattanLowerBound(board, posOf(board));
    assert.ok(lb >= 20, `${diff} fallback lb=${lb}`);
    // 各色が独立した縦一列＝相互干渉ゼロ。最短は下界と一致（構成上厳密）。
    assert.equal(board.walls.size, 0);
    assert.equal(board.oneway.size, 0);
    // 縦移動のみで各ブロックがゴール列に一致していることを確認。
    for (let c = 0; c < board.blocks.length; c++) {
      assert.equal(board.blocks[c].x, board.goals[c].x, '同一列でない');
    }
  }
});

test('練習難易度は解ける盤面を返す（20手制約なし）', () => {
  const r = generateBoard({ seed: 'practice-seed', difficulty: 'practice' });
  const s = solve(r.board);
  assert.equal(s.solved, true);
});

test('ブロックは初期状態で自分のゴール上にいない', () => {
  const r = generateBoard({ seed: 'no-precleared', difficulty: 'normal' });
  assert.ok(manhattanLowerBound(r.board, posOf(r.board)) > 0);
});

test('難易度定義の色数は 2〜6 の範囲', () => {
  for (const k of Object.keys(DIFFICULTIES)) {
    const c = DIFFICULTIES[k].colors;
    assert.ok(c >= 2 && c <= 6, `${k}: ${c}`);
  }
});
