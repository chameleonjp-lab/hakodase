# CLAUDE.md — HAKODASE 開発ルール

このリポジトリで Claude Code が作業するときに守るルール。

## プロジェクト概要

倉庫の色分け出荷をテーマにした、ブラウザ向け短時間タイムアタック型 色ブロック整理パズル。
ビルド不要・外部依存ゼロの静的サイト（HTML / CSS / バニラ JS, ES Modules）。

## 最重要の設計原則

1. **ゲームロジックは描画に依存させない。** `src/core/` は DOM・Canvas を import しない。Node 単体でテストできる状態を保つ。
2. **描画は frameState を受け取って描くだけ。** ゲーム状態を書き換えない。`Renderer` インターフェース（init/resize/render/destroy/clientToCell）を壊さない。新しい描画（Three.js 等）は `Renderer` を実装して追加する。
3. **入力は画面座標→グリッド操作への変換役に徹する。** ロジック・描画を持たない。
4. **ランキングは `RankingService` で分離する。** GameEngine に保存処理を直結しない。
5. **Solver と Generator を分離する。** 生成は検証（solver もしくはマンハッタン下界）を通す。

## 守るべき仕様

- 1 手 = 論理上の 1 マス移動。手数の数え方はソルバーと一致させる。
- 論理座標は必ず整数グリッド。アニメーション終了時は整数セルへ正確にスナップ。
- ゲート状態は手数のみで決まる純粋関数（`((moveCount+phase)%period)<openFor`）に保つ。
- ランキング対象（標準以上）の盤面は最短20手以上を保証する。マンハッタン距離総和（最短手数の下界）≥20 を崩さない。
- 生成は無限ループ禁止。試行回数・探索ともに上限を持つ。失敗時は検証済みフォールバック盤面へ。
- 外部画像・外部音声・既存ゲーム名・似すぎた UI 文言を使わない。視覚はすべて Canvas 自前描画。
- 色だけに頼らず記号を併記する（色覚配慮）。

## パフォーマンス

- requestAnimationFrame を使い、60fps を目標にする。
- 毎フレームで重い探索・DOM 更新・CSS レイアウト再計算を起こさない。
- Canvas は devicePixelRatio に対応させる。
- 重い生成・探索は将来 Web Worker に移せる構造（純粋関数）を保つ。

## テスト

- 追加・変更したコア機能には必ず `test/*.test.js`（`node --test`, Node 標準のみ）を足す。
- 外部依存を入れない。localStorage 依存はフェイクストレージを注入してテストする。
- 変更後は `npm test` が緑であることを確認してからコミットする。

## コミット

- main ブランチで作業する（この環境ではハーネスの指定ブランチ運用に従う）。
- 破壊的コマンド（`git reset --hard` / `git clean -fd` / `rm -rf` / force push）は使わない。
- 既存ファイルは内容を確認してから変更する。意図せず消さない。

## ドキュメント

- 仕様変更時は `docs/requirements.md` / `docs/implementation-plan.md` / `docs/architecture.md` を更新する。
- 構成を変えたら理由を `docs/architecture.md` に書く。
