# v2契約への移行メモ

この`アーキテクチャ`には旧MVP仕様が含まれる。HAKODASE v2の正本は次の文書である。旧MVP説明と矛盾する場合は、v2契約を優先し、後続Phaseで実装を合わせる。

- [GAME_CONTRACT_v2.md](GAME_CONTRACT_v2.md)
- [SCORE_RANKING_CONTRACT_v2.md](SCORE_RANKING_CONTRACT_v2.md)
- [MOBILE_TOUCH_CONTRACT_v2.md](MOBILE_TOUCH_CONTRACT_v2.md)
- [PERFORMANCE_BUDGET_v2.md](PERFORMANCE_BUDGET_v2.md)
- [EXPERIENCE_CONTRACT_v2.md](EXPERIENCE_CONTRACT_v2.md)
- [ORIGINALITY_v2.md](ORIGINALITY_v2.md)
- [REVIEW_CHECKLIST_v2.md](REVIEW_CHECKLIST_v2.md)

主な差分: 旧MVPの「手数」は通過マス数だったが、v2では `swipeCount` と `distanceCells` を分ける。公式問題の最低20手は `optimalSwipes >= 20` を意味する。公式ランキングは同じ `puzzleId` の検証済み問題だけを比較する。Three.js/WebGL、Supabase、SQL、出荷レーン、出荷シャッターは今回実装しない。

---

# HAKODASE アーキテクチャ

ゲームロジックと描画を分離し、将来 Three.js/WebGL を追加しやすくする設計。v2ではCanvas2Dを正式な基本版として残し、Three.js/WebGL化は別作業とする。
中核は「スライド＆退場」モデル（Block Out! 系にインスパイアした独自実装）。

---

## レイヤー構成

```
   入力   PointerInput            画面座標 → グリッド操作（ドラッグ方向）
              │ tryMove(index, dir)
   ロジック GameEngine            進行状態・手数（通過マス数）・退場・タイマー・クリア
              │  ├ rules.js   (純粋: スライド計算 / 退場 / 壁 / 一方通行)
              │  ├ generator.js (seed→盤面, 逆生成で常に可解)
              │  │    └ solver.js (Dijkstra最短 / quickSolvable)
              │  └ rng.js    (決定論乱数)
              │ frameState（読み取り専用スナップショット）
   描画    Renderer interface     init/resize/render/destroy/clientToCell
              └ CanvasRenderer    （将来 ThreeRenderer に差し替え）

   付帯: RankingService (localStorage / 将来オンライン), HUD (DOM)
```

データの流れは常に一方向: **入力 → ロジック → frameState → 描画**。描画は状態を書き換えない。

## 依存ルール（必須）

- **GameEngine / rules / generator / solver / rng は DOM・Canvas に一切依存しない。** Node だけで import・テストできる。
- 描画は frameState を受け取って描くだけ。入力は画面座標→グリッド操作への変換役。
- ランキング保存は RankingService として GameEngine から分離。

## ゲームロジック（スライド＆退場）

### 盤面モデル

静的盤面 `board`（不変）:
```js
{ width, height,
  walls: Set<"x,y">,
  oneway: Map<"x,y", dir>,          // MVP の生成では未使用（ルールは実装済み）
  gates: Array<{ side, line, color }>, // 縁の出口ゲート（同色のみ退場可）
  blocks: Array<{ id, x, y, w, h, color }> }
```
動的状態: `positions: Array<{x,y}|null>`（null=退場）, `moveCount`（通過マス数の総和）。

### スライド（1 手）

- ドラッグ方向へ、壁・他ブロック・盤端に当たるまで 1 マスずつ連続移動（`computeSlide`）。
- 盤端に達したとき、その縁に**同色ゲートがあれば退場**（`exit`）、無ければ停止。
- 手数 = 通過マス数（退場の1歩を含む）。GameEngine と Solver は同じ `rules` を使い手数が一致。

### 出口ゲート

- `side/line/color` で縁を指定。`gateForExit(x,y,dir)` が横切るゲートを判定、`gateOpeningCell` が盤外開口を返す。

### ランダム生成と 20 手保証（逆生成）

- 各ブロックを自分のゲートから盤内へ滑り込ませて配置 → その逆順が必ず成立する正解手順＝**常に可解**（探索不要）。
- 一直線配置のため **最短手数 = 各ブロック→同色ゲート開口のマンハッタン距離総和**（厳密）。これを ≥22 にして「20手以上」を保証。
- `quickSolvable`（同色ゲートへ真っ直ぐ出せる箱を貪欲に退場）で十分条件を再確認。
- 最大試行回数で無限ループ禁止。失敗時は検証済みフォールバック（独立レーン）。

### Solver

- スライドのコストが可変（通過マス数）なので **ダイクストラ**で最短手数を求める（小盤面の厳密値・テスト用）。ノード/コスト上限あり。
- `quickSolvable` は探索なしの軽量可解判定（生成検証・テスト用）。
- 注: 多ブロックの全探索は状態爆発するため、生成は探索ではなく**逆生成**で可解性を担保する（重要な設計判断）。

## 描画 / 入力 / サービス

- CanvasRenderer: 角丸＋面取り＋影＋グラデ＋ハイライト＋リベット＋記号、縁の色付き出口ゲート、着地プレビュー、退場/クリアのパーティクル。DPR 対応、rAF、毎フレームのレイアウト発生を回避。
- PointerInput: Pointer Events 統一、`touch-action:none`、pointer capture、ドラッグ方向→1スライド要求。
- RankingService（抽象）→ LocalRankingService（localStorage, storage 注入可能）。将来 RemoteRankingService を同 interface で追加可能。HUD は DOM 更新のみ。

## 推奨構成からの変更点・理由

- ファイル構成は推奨どおり。`rules.js` を独立させ engine と solver が同一の純粋ルールを共有（手数一致・二重実装回避）。
- **中核を「同色ゴールに乗せる 1マス移動」から「壁まで滑って同色ゲートから退場」へ変更**（着想元に寄せる依頼による）。盤面サイズはタイムアタック向けに縦長 7×9。
- **生成を探索（forward BFS）から逆生成へ変更**。多ブロックのスライド全探索は状態爆発で非現実的なため、構成で可解性と最短手数を担保する方式にした。
- 一方通行床のルールは残置（テスト済み）だが、アンドゥの無いタイムアタックで詰みを生まないよう**生成では未使用**。可動ゲート（開閉シャッター）は中核がゲート＝出口になったため MVP では廃止し、将来の追加ギミック（エレベーター/生成器等）扱いとした。

## 将来拡張

- ThreeRenderer 追加（render の中身だけ実装、interface 不変）。
- 複数マスブロック（w/h を実描画・ルールに反映）。
- アンドゥ＋一方通行/可動ギミックの生成導入。
- RemoteRankingService（オンライン）。生成/探索の Web Worker 化（コアは純粋関数）。
