# CLAUDE.md — HAKODASE 開発ルール

このリポジトリで Claude Code が作業するときに守るルール。

# v2契約の優先

このリポジトリの後続作業では、v2仕様の正本として次を優先する。既存の旧MVP説明と矛盾する場合は、コード変更前にv2契約を確認し、勝手に別仕様へ変えない。

- `docs/GAME_CONTRACT_v2.md`
- `docs/SCORE_RANKING_CONTRACT_v2.md`
- `docs/MOBILE_TOUCH_CONTRACT_v2.md`
- `docs/PERFORMANCE_BUDGET_v2.md`
- `docs/EXPERIENCE_CONTRACT_v2.md`
- `docs/ORIGINALITY_v2.md`
- `docs/REVIEW_CHECKLIST_v2.md`

重要な変更点: 旧MVPの「手数」は通過マス数だったが、v2では `swipeCount` と `distanceCells` を分ける。公式問題の最低20手は `optimalSwipes >= 20` を意味する。公式ランキングは同じ `puzzleId` の検証済み問題だけを比較する。Supabaseの問題ID対応は未確認なので推測SQLを作らない。

## プロジェクト概要

倉庫の色分け出荷をテーマにした、ブラウザ向け短時間タイムアタック型 色ブロック整理パズル。
ビルド不要・外部依存ゼロの静的サイト（HTML / CSS / バニラ JS, ES Modules）。

## ゲーム中核（スライド＆退場モデル）

「Block Out! - Color Sort Puzzle」にインスパイアされた、独自実装の順序パズル。コピーはしない。
- ブロックはドラッグ方向へ **壁・他ブロック・盤端に当たるまで一気にスライド** する。
- 各ブロックを **自分と同じ色の「出口ゲート（盤の縁）」から盤外へ退場** させると達成。全部退場でクリア。
- 出す順序が要（先に動かすと他を塞ぐ）。タイムアタックで競う。

## 最重要の設計原則

1. **ゲームロジックは描画に依存させない。** `src/core/` は DOM・Canvas を import しない。Node 単体でテストできる状態を保つ。
2. **描画は frameState を受け取って描くだけ。** ゲーム状態を書き換えない。`Renderer` インターフェース（init/resize/render/destroy/clientToCell）を壊さない。新しい描画（Three.js 等）は `Renderer` を実装して追加する。
3. **入力は画面座標→グリッド操作への変換役に徹する。** ロジック・描画を持たない。
4. **ランキングは `RankingService` で分離する。** GameEngine に保存処理を直結しない。
5. **Solver と Generator を分離する。** 生成は逆生成で常に可解にし、`quickSolvable`（十分条件）で再確認する。

## 守るべき仕様

- 旧MVP実装では 1 手 = 1 スライドで通過したマス数（退場の1歩も含む）。v2実装では `swipeCount`（操作数）と `distanceCells`（通過マス数）を分ける。
- 論理座標は必ず整数グリッド。アニメーション終了時は整数セル（退場はゲート開口）へ正確にスナップ。
- 出口ゲートは盤の縁（side: left/right/top/bottom, line, color）。同色のみ通過＝退場できる。
- v2公式問題は `optimalSwipes >= 20` を条件にし、同じ `puzzleId` の検証済み問題だけを公式ランキングで比較する。
- 生成は無限ループ禁止。試行回数に上限を持つ。失敗時は検証済みフォールバック盤面へ。逆生成（ゲートから滑り込ませて配置）で常に可解を保つ。
- ランキング盤面は縦長 7×9 を基本にする。
- 外部画像・外部音声・既存ゲーム名・似すぎた UI 文言・流用素材を使わない。視覚はすべて Canvas 自前描画。
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

- main へ直接コミット、直接push、直接マージしない。作業ブランチ運用に従う。
- 破壊的コマンド（`git reset --hard` / `git clean -fd` / `rm -rf` / force push）は使わない。
- 既存ファイルは内容を確認してから変更する。意図せず消さない。

## ドキュメント

- 仕様変更時は `docs/requirements.md` / `docs/implementation-plan.md` / `docs/architecture.md` を更新する。
- 構成を変えたら理由を `docs/architecture.md` に書く。
