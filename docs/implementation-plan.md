# v2契約への移行メモ

この`実装計画書`には旧MVP仕様が含まれる。HAKODASE v2の正本は次の文書である。旧MVP説明と矛盾する場合は、v2契約を優先し、後続Phaseで実装を合わせる。

- [GAME_CONTRACT_v2.md](GAME_CONTRACT_v2.md)
- [SCORE_RANKING_CONTRACT_v2.md](SCORE_RANKING_CONTRACT_v2.md)
- [MOBILE_TOUCH_CONTRACT_v2.md](MOBILE_TOUCH_CONTRACT_v2.md)
- [PERFORMANCE_BUDGET_v2.md](PERFORMANCE_BUDGET_v2.md)
- [EXPERIENCE_CONTRACT_v2.md](EXPERIENCE_CONTRACT_v2.md)
- [ORIGINALITY_v2.md](ORIGINALITY_v2.md)
- [REVIEW_CHECKLIST_v2.md](REVIEW_CHECKLIST_v2.md)

主な差分: 旧MVPの「手数」は通過マス数だったが、v2では `swipeCount` と `distanceCells` を分ける。公式問題の最低20手は `optimalSwipes >= 20` を意味する。公式ランキングは同じ `puzzleId` の検証済み問題だけを比較する。Three.js/WebGL、Supabase、SQL、出荷レーン、出荷シャッターは今回実装しない。

---

# HAKODASE 実装計画書

要件仕様書（docs/requirements.md）を満たすための実装計画。ビルド不要・外部依存なし・Node 標準テスト。
中核は「スライド＆退場」モデル（Block Out! 系にインスパイアした独自実装）。

---

## 1. 実装順序

1. `src/core/rng.js` — seed 付き決定論 RNG。
2. `src/core/rules.js` — 純粋ルール（スライド計算・退場・壁・一方通行・下界）。
3. `src/core/solver.js` — ダイクストラ最短手数＋`quickSolvable`（軽量可解判定）。
4. `src/core/generator.js` — 逆生成で常に可解な盤面・20手保証・フォールバック。
5. `src/core/engine.js` — 進行状態（手数=通過マス数・退場・タイマー・クリア）。
6. `src/services/ranking.js` — RankingService interface ＋ localStorage 実装。
7. `test/*.test.js` — コアのテスト。
8. `src/render/renderer.js` / `canvas-renderer.js` — Renderer interface と Canvas2D 実装。
9. `src/input/pointer-input.js` — Pointer Events 入力。
10. `src/ui/hud.js` / `src/main.js` / `index.html` / `styles/main.css` — 統合。
11. `scripts/dev-server.mjs` — 依存なし静的サーバ。

## 2. ファイル構成

推奨構成どおり（理由・例外は docs/architecture.md）。`rules.js` を独立させ engine と solver で共有。

## 3. データ構造

静的盤面 `board`:
```js
{ width, height,
  walls: Set<"x,y">,
  oneway: Map<"x,y","up"|"down"|"left"|"right">, // 生成では未使用
  gates: Array<{ side:'left'|'right'|'top'|'bottom', line:number, color:number }>,
  blocks: Array<{ id, x, y, w, h, color }> }
```
動的状態: `positions: Array<{x,y}|null>`（null=退場）, `moveCount`（通過マス数）。

## 4. 盤面生成の手順（generator.js, 逆生成）

1. `rng = makeRng(seed ^ attempt)`。
2. 壁を配置。
3. 各色 c について（c=0..colors-1）:
   1. 未使用の縁（side|line）をランダムに選ぶ。
   2. そのゲートから盤内へ向かうセル列を手前から辿り、壁/既配置に当たるまでの「到達可能セル」を集める。
   3. 退場距離を稼ぐため奥寄り優先＋ランダムで停止セルを決め、ブロックとゲートを確定。
4. min20 難易度は「Σ マンハッタン距離（ブロック→同色ゲート開口）≥ 22」でなければ再試行。
5. `quickSolvable` で可解性を再確認（十分条件）。
6. 採用。`shortestSolutionMoves = Σ マンハッタン`（一直線配置なので厳密）。
7. 最大試行回数超過時は `getFallbackBoard`（独立レーン）。無限ループ禁止。

逆生成が常に可解な理由: 後に入れたブロックほど挿入時の通路が空。よって「後に入れた順＝先に出す順」で必ず全部退場できる。

## 5. ソルバーの手順（solver.js）

- `solve(board)`: 状態＝各ブロック位置（退場は 'E'）。スライド適用のコスト（通過マス数）で**ダイクストラ**。全退場で最短手数を返す。ノード/コスト上限あり（小盤面の厳密値・テスト用）。
- `quickSolvable(board)`: 同色ゲートへ真っ直ぐ出せるブロックを貪欲に退場させ続ける軽量判定（探索なし）。逆生成盤面は必ずこの形の解を持つ。
- 多ブロックの全探索は状態爆発するため、生成検証は `quickSolvable` を用い、`solve` は主にテスト・小盤面用。

## 6. Canvas 描画の手順（canvas-renderer.js）

- `init`/`resize`: DPR 対応、外周マージンを確保（縁の出口ゲート描画用）。盤面アスペクトは main がフィット（7×9 など）。
- `render(frameState)`: 背景 → 床/壁 → 一方通行（あれば）→ 出口ゲート → 着地プレビュー → ブロック → パーティクル。状態は読むだけ。
- ブロックの表示位置は frameState.viewPositions（main が補間）。退場は null。

## 7. 入力処理の手順（pointer-input.js）

- `touch-action:none`、pointerdown で選択＋capture、pointermove で指追従＆着地プレビュー、pointerup で主方向→1スライド要求。変換のみ担当。

## 8. ランキング保存の手順（ranking.js）

- `RankingService`（抽象）→ `LocalRankingService(storage=localStorage)`。
- save: `{seed,difficulty,timeMs,moves,clearedAt}` を追加し「タイム→手数→達成時刻」で整列。list(filter)/clear。テストはフェイクストレージ注入。

## 9. テスト計画

- `rng`: 同 seed 再現・範囲。
- `rules`: スライド（壁/他ブロック/盤端で停止）、同色ゲート退場、色違い不可、一方通行、下界、isCleared。
- `solver`: 一直線の最短手数、順序が必要な盤面、`quickSolvable` 真偽、デッドロック検出、上限。
- `generator`: 同 seed 再現、ランキングは20手以上＆可解＆7×9、各ブロックに同色ゲート、フォールバック可解＆20手以上。
- `engine`: タイマー開始、手数=通過マス数、退場/クリア、クリア後固定、reset、blockAt。
- `ranking`: 保存/読み出し、整列、タイブレーク、フィルタ、limit、クリア。

## 10. リスクと対策

| リスク | 対策 |
| --- | --- |
| 多ブロックのスライド全探索が爆発 | 生成は探索でなく逆生成＋`quickSolvable`。`solve` は小盤面/テスト用 |
| 20手生成が不安定 | 逆生成＋マンハッタン下界 ≥22。失敗時は検証済みフォールバック |
| 無限ループ | 生成の試行上限・ソルバーのノード/コスト上限 |
| 詰み（アンドゥ無し） | 生成は常に可解。一方通行は生成で未使用。やりなおしで再挑戦 |
| 停止位置のズレ | 論理は整数グリッド、退場はゲート開口へスナップ |
| タッチ遅延 | Pointer Events＋touch-action:none＋capture |

## 11. 将来 Three.js/WebGL へ移行する手順

1. `renderer.js` の interface（init/resize/render/destroy/clientToCell）を維持。
2. `ThreeRenderer` を新規作成し同 interface を実装。
3. `frameState` 形式を保ちながら統合する。ただし3D化にはカメラ、光源、立体物管理、ヒット判定、画面サイズ変更、高解像度負荷、資源破棄、WebGLコンテキスト消失と復帰が必要であり、一行差し替えだけで完成とは扱わない。

## Phase 1 実装メモ（2026-07-12）
- 現行画面はまだ旧MVP型だが、中核指標はv2契約に合わせて `swipeCount`（操作）と `distanceCells`（移動マス）へ分離した。
- 旧MVPの距離条件は `shortestDistanceCells` として残し、v2公式難易度の `optimalSwipes >= 20` とは混同しない。現行ランダム盤面はPhase 3の検証済み公式問題ではない。
- 競技経過時間は `GameEngine.start(now)` と単調時刻注入で扱う。現行画面ではPhase 2までの暫定として、初回描画フレーム内で開始する。
- ローカルランキングは `hakodase.ranking.v2` を使い、旧v1距離記録を新操作記録へ混ぜない。
- Supabase、SQL、Three.js/WebGL、出荷レーン、出荷シャッター、Phase 2画面状態は未実装。
