# HAKODASE アーキテクチャ

ゲームロジックと描画を分離し、将来 Three.js/WebGL へ無痛で移行できることを最優先にした設計。

---

## レイヤー構成

```
                 ┌─────────────────────────────┐
   入力          │ PointerInput                │  画面座標 → グリッド操作
                 └──────────────┬──────────────┘
                                │ tryMove(index, dir)
                 ┌──────────────▼──────────────┐
   ロジック      │ GameEngine                  │  進行状態・手数・タイマー・クリア
                 │   ├ rules.js  (純粋関数)     │
                 │   ├ generator.js (seed→盤面) │
                 │   │    └ solver.js (BFS)     │
                 │   └ rng.js   (決定論乱数)    │
                 └──────────────┬──────────────┘
                                │ frameState（読み取り専用スナップショット）
                 ┌──────────────▼──────────────┐
   描画          │ Renderer interface          │  init/resize/render/destroy
                 │   └ CanvasRenderer (2D)      │  （将来 ThreeRenderer に差し替え）
                 └─────────────────────────────┘

   付帯サービス: RankingService (localStorage / 将来オンライン), HUD (DOM)
```

データの流れは常に一方向: **入力 → ロジック → frameState → 描画**。描画はゲーム状態を書き換えない。

## 依存ルール（必須）

- **GameEngine / rules / generator / solver / rng は DOM・Canvas に一切依存しない。** Node だけで import・テストできる。
- 描画は frameState（プレーンなスナップショット）を受け取って描くだけ。
- 入力は画面座標→グリッド操作への変換役。ロジックや描画を持たない。
- ランキング保存は GameEngine に直結せず、RankingService として分離。

## ゲームロジック（game-engine-agent 設計）

### 盤面モデル

- 静的盤面 `board`（terrain）は不変: width/height・walls・oneway・gates・goals・blocks(初期)・cycle。
- 動的状態は `positions`（各ブロックの現在セル）と `moveCount` のみ。これにより探索（solver）と進行（engine）が同じ純粋関数を共有できる。

### 1 手の定義

- 1 手 = 1 ブロックが上下左右いずれかに 1 マス移動。
- 手数はソルバーと完全一致（ロジックもソルバーも同じ `rules.legalMove` / `applyMove` を使用）。

### 一方通行床

- `oneway` に向きを持つセル。ブロックがそのセル上にいるとき、合法手はその向きのみ。
- ソルバーも同じ制約で展開するため、最短手数が現実のプレイと一致する。

### 開閉ゲート

- 状態は手数のみで決まる純粋関数: `open(moveCount) = ((moveCount + phase) % period) < openFor`。
- 閉じたゲートセルには進入不可。
- 探索状態に `moveCount % cycle`（全 period の最小公倍数）を含めるため、BFS は有限・正確。

### ランダム生成と 20 手保証

- seed 付き決定論。マンハッタン距離総和（= 最短手数の下界）を ≥22 にして 20 手以上を保証。
- ソルバーで解の存在・最短手数を厳密化。
- 最大試行回数・探索上限で無限ループを禁止。失敗時は検証済みフォールバック盤面。

### Solver

- 状態をシリアライズ（位置＋手数 mod cycle）し BFS。
- 訪問ノード数・深さの上限を持つ。
- shortestSolutionMoves を返す。

## 描画（rendering-performance-agent 設計）

### Renderer interface

```js
init(canvas, options)   // context 取得・DPR 準備
resize(viewport)        // CSS/内部解像度・セルサイズ算出
render(frameState)      // frameState を読んで描くだけ
destroy()               // 後始末
```

### CanvasRenderer

- 角丸矩形コンテナ＋影＋線形グラデーション＋ハイライト＋色記号。
- 一方通行矢印、開閉ゲート（スライドシャッター）、搬出口、点灯演出。
- クリア時パーティクル（画像なし、Canvas の粒）。
- devicePixelRatio 対応、requestAnimationFrame、毎フレームのレイアウト発生を避ける。

## 入力（mobile-input-agent 設計）

- Pointer Events で統一（タッチ/マウス共通）。`touch-action: none`、pointer capture。
- pointerdown 即選択で遅延を抑え、指追従でドラッグ、pointerup で 1 手確定＆整数セルへスナップ。

## サービス

- `RankingService`（抽象）→ `LocalRankingService`（localStorage、storage 注入可能）。将来 `RemoteRankingService` を同 interface で追加可能。
- `HUD` は DOM 更新のみ（毎フレームではなくイベント時に更新）。

## 推奨構成からの変更点・理由

- 推奨どおりのファイル構成を踏襲。大きな変更なし。
- `rules.js` を独立させ、engine と solver が同一の純粋ルールを共有する形にした（手数の一致と二重実装の回避のため）。
- 生成の 20 手保証を「マンハッタン距離総和の下界」に基づく方式にした。BFS だけに頼ると重く・不安定なため、下界で確実性を、ソルバーで厳密値を担保する二段構えにした。

## 将来拡張

- ThreeRenderer 追加（render の中身だけ実装、interface 不変）。
- 複数マスブロック（block.w/h を実描画・ルールに反映）。
- RemoteRankingService（オンラインランキング）。
- 生成/探索の Web Worker 化（コアは純粋関数なので移植容易）。
