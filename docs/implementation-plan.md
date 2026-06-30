# HAKODASE 実装計画書

要件仕様書（docs/requirements.md）を満たすための実装計画。ビルド不要・外部依存なし・Node 標準テストを前提とする。

---

## 1. 実装順序

1. `src/core/rng.js` — seed 付き決定論 RNG。
2. `src/core/rules.js` — 盤面の純粋ルール関数（移動可否・適用・ゴール判定・ゲート/一方通行）。
3. `src/core/solver.js` — 幅優先探索で最短手数（上限つき）。
4. `src/core/generator.js` — seed から盤面生成、20手保証、フォールバック。
5. `src/core/engine.js` — 進行状態を持つ GameEngine（手数・タイマー・クリア）。
6. `src/services/ranking.js` — RankingService interface ＋ localStorage 実装。
7. `test/*.test.js` — 上記コアのテスト（`node --test`）。
8. `src/render/renderer.js` — Renderer interface。
9. `src/render/canvas-renderer.js` — Canvas2D 実装。
10. `src/input/pointer-input.js` — Pointer Events 入力。
11. `src/ui/hud.js` — DOM HUD 更新。
12. `src/main.js`・`index.html`・`styles/main.css` — 統合。
13. `scripts/dev-server.mjs` — 静的サーバ。
14. ドキュメント・README・CLAUDE.md 仕上げ。

コア（1〜6）を先に完成・テストしてから UI（8〜13）を組む。

## 2. ファイル構成

```
index.html
styles/main.css
src/
  main.js                  統合・ゲームループ
  core/
    rng.js                 決定論 RNG (mulberry32)
    rules.js               純粋ルール（移動/ゲート/一方通行/ゴール）
    solver.js              BFS 最短手数（上限つき）
    generator.js           seed→盤面、20手保証、フォールバック
    engine.js              進行状態・手数・タイマー・クリア
  render/
    renderer.js            Renderer interface（抽象基底）
    canvas-renderer.js     Canvas2D 実装
  input/
    pointer-input.js       Pointer Events → グリッド操作
  ui/
    hud.js                 タイマー/手数/ランキング等の DOM 更新
  services/
    ranking.js             RankingService interface ＋ Local 実装
scripts/dev-server.mjs     依存なし静的サーバ
test/*.test.js             Node 標準テスト
docs/{requirements,implementation-plan,architecture}.md
README.md
CLAUDE.md
```

理由・例外は docs/architecture.md に記載。

## 3. データ構造

静的盤面（terrain, 不変）:
```js
board = {
  width, height,
  walls: Set<"x,y">,
  oneway: Map<"x,y", "up"|"down"|"left"|"right">,
  gates: Array<{ x, y, period, phase, openFor }>,
  goals: Array<{ x, y, color }>,
  blocks: Array<{ id, x, y, w, h, color }>, // 初期位置つき定義
  cycle, // 全ゲート period の最小公倍数（ゲート無しなら 1）
}
```

動的状態（探索・進行で変化）:
```js
positions = Array<{ x, y }>  // board.blocks と同じ順
moveCount = number
```

GameEngine 内部状態:
```js
{ board, positions, moveCount, startedAt, clearedAt, selectedIndex, history }
```

## 4. 盤面生成の手順（generator.js）

1. `rng = makeRng(seed)`。
2. 難易度設定（色数・サイズ・ギミック量・min20 か）を取得。
3. 試行ループ（最大 `MAX_ATTEMPTS` 回、seed を派生させる）:
   1. 空グリッドを作り、内部に壁を少数置く。
   2. 各色について搬出口（goal）とコンテナ（block）を配置。重複セル禁止、コンテナは自分の goal 上に置かない。
   3. 一方通行床・ゲートを少数配置（解を壊しすぎない位置）。
   4. min20 難易度では「Σ マンハッタン距離 ≥ 22」を満たすよう再配置を試みる（下界保証）。
   5. `solver.solve(board)` で解の存在と最短手数を取得。
   6. 解ける、かつ（min20 でなければ常に / min20 なら shortest ≥ 20）なら採用して返す。
4. 全試行失敗時は `getFallbackBoard(difficulty)`（検証済み）を返す。
5. 戻り値: `{ board, seed, difficulty, shortestSolutionMoves, fromFallback }`。

無限ループ禁止: ループ・探索ともに必ず上限を持つ。

## 5. ソルバーの手順（solver.js）

- 状態 = `serialize(positions, moveCount % board.cycle)`（位置はブロック順）。
- 初期状態（moveCount=0）から BFS。
- 各状態で、全ブロック × 4 方向の合法手（rules.legalMove）を展開。手ごとに moveCount+1。
- ゴール判定: 全ブロックが同色 goal 上（rules.isCleared）。
- 上限: 訪問ノード数 `maxNodes` と探索深さ `maxDepth`。超過時は `{ solved:false, reason:"limit" }`。
- 戻り値: `{ solved, moves, reason }`（moves = shortestSolutionMoves）。

## 6. Canvas 描画の手順（canvas-renderer.js）

- `init(canvas, options)`: 2D context 取得、DPR 対応。
- `resize(viewport)`: CSS サイズと内部解像度（×DPR）を設定。セルサイズを盤面に合わせて算出。
- `render(frameState)`: 背景 → 床/壁 → 一方通行矢印 → 搬出口 → ゲート → コンテナ（角丸/影/グラデ/ハイライト/記号）→ パーティクル の順に描く。frameState は読むだけ。
- アニメーション: ブロックの表示位置は frameState の補間値を使用（ロジック座標は整数）。
- `destroy()`: 参照解放。
- 60fps: パスの再生成を最小化、影は限定的に使用、レイアウトを発生させない。

## 7. 入力処理の手順（pointer-input.js）

- canvas に `touch-action: none`、`pointerdown/move/up` を登録。
- pointerdown: 画面座標→グリッド座標へ変換し、その位置のブロックを選択、pointer capture。
- pointermove: ドラッグ量から表示オフセットを与える（指追従）。
- pointerup: 主方向と距離からグリッド移動を 1 手だけ要求（`engine.tryMove(index, dir)`）。合法なら新セルへ、非合法なら元へスナップ。
- 変換のみ担当。ロジック・描画は持たない。コールバックで main へ通知。

## 8. ランキング保存の手順（ranking.js）

- `RankingService`（抽象）: `saveScore(score)` / `listScores(filter)` / `clearScores()`。
- `LocalRankingService(storage = localStorage)`: JSON 配列を 1 キーに保存。
- saveScore: `{ seed, difficulty, timeMs, moves, clearedAt }` を追加し timeMs 昇順で保存。
- listScores(filter): difficulty 等でフィルタして昇順で返す。
- テスト用にフェイクストレージ（get/set/removeItem を持つ Map ラッパ）を注入可能にする。

## 9. テスト計画

`test/` に Node 標準（`node:test`/`node:assert`）で:
- `rng.test.js`: 同 seed で同列、異 seed で別列、範囲。
- `rules.test.js`: 基本移動、壁/枠/他ブロックでブロック、一方通行床の制限、ゲート閉で進入不可・開で可。
- `solver.test.js`: 既知の小盤面で最短手数一致、解なしの検出、上限超過。
- `generator.test.js`: 同 seed 再現、ランキング難易度で shortest ≥ 20、フォールバックも ≥ 20・解ける。
- `ranking.test.js`: 保存→読み出し、昇順、フィルタ、クリア。

`npm test` = `node --test test/`。

## 10. リスクと対策

| リスク | 対策 |
| --- | --- |
| BFS が大盤面で爆発 | 盤面 5×5〜6×6、壁/一方通行で分岐削減、maxNodes/maxDepth 上限、超過時は seed 再試行 |
| 20手生成が不安定 | マンハッタン距離総和の下界で保証、ダメなら検証済みフォールバック |
| 無限ループ | 生成・探索ともに上限必須 |
| 停止位置のズレ | 論理は整数グリッド、アニメ終了時に整数セルへスナップ |
| タッチ遅延 | Pointer Events＋touch-action:none＋pointer capture、pointerdown 即反応 |
| 色覚配慮 | 色＋記号を併記 |
| 描画とロジックの結合 | frameState を介した一方向、Renderer interface |

## 11. 将来 Three.js/WebGL へ移行する手順

1. `renderer.js` の interface（init/resize/render/destroy）はそのまま維持。
2. `ThreeRenderer` を新規作成し同 interface を実装（DOM/WebGL canvas を生成）。
3. `main.js` の renderer 生成箇所だけ差し替える（`new CanvasRenderer()` → `new ThreeRenderer()`）。
4. frameState の形式は不変なので GameEngine/入力/生成/ソルバーは変更不要。
5. パーティクルやアニメも frameState 由来なので、表現だけ Three 側で再実装する。
