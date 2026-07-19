# HAKODASE / ハコダセ

箱を滑らせ、順番と倉庫設備を読み、同じ印の搬出口からすべて出荷する短時間パズルです。

- HTML / CSS / バニラJavaScriptの静的サイト
- ビルド不要・実行時の外部依存なし
- iPhone SE級の横幅320pxを優先
- Canvas2D描画
- ゲームロジックと描画を分離
- 将来Three.js/WebGLを追加できる構造を維持

## 現在の開発状態

HAKODASE v2は段階的に実装しています。

| 工程 | 状態 |
| --- | --- |
| v2仕様契約 | 完了 |
| 中核コードの正しさ | コード完了 |
| 状態機械とプレイ世代 | 統合済み |
| ホーム・名前確認・3モード | 統合済み |
| 3・2・1・STARTと厳格時計 | 統合済み |
| プレイ画面のundo・リタイア・詰み | 統合済み |
| 正式結果画面・再挑戦・共有 | P2-05で実装・レビュー待ち |
| Phase 1・2統合ブラウザGate | 未実施 |
| 公式問題集 | 未実装 |
| Supabaseランキング | 未実装 |
| 出荷レーン・シャッター | 未実装 |
| 実機・公開確認 | 未実施 |

現在の「本日の出荷」は固定暫定seedによるプレビューです。検証済み公式問題と`puzzleId`が未実装のため、公式記録や端末内記録へ保存しません。ただし、将来の公式競技と同じ厳格時計を使い、カウントダウン中またはプレイ中にページが隠れた試行は無効にします。

エンドレスだけが現行のseed付き盤面と端末内記録を利用します。練習は記録対象外です。

詳しい現在地は[完成状況](docs/COMPLETION_STATUS_v2.md)、完成までの工程は[完成計画](docs/COMPLETION_PLAN_v2.md)を参照してください。

## 画面の流れ

P2-05時点では次を実装しています。

```text
home
→ nameConfirm
→ countdown（3・2・1・START）
→ playing
→ result
```

結果画面には次を表示します。

```text
クリアタイム
操作数
移動マス
戻した回数
最短または目安との差
モード
問題IDまたはseed
端末内初回・ベスト
保存状態
オンライン送信状態欄
```

同じ問題の再挑戦は新しい`playId`を発行し、再びカウントダウンを通ります。エンドレスでは新しい盤面へ進めます。

結果共有はWeb Shareを優先し、技術的失敗時はClipboard、さらに失敗時は選択可能な共有文を表示します。共有をキャンセルまたは失敗しても結果画面は維持されます。

## モード

### 本日の出荷

- 固定暫定問題。
- 厳格時計。
- ページ非表示で試行無効。
- 公式問題集とSupabaseが未実装のため記録対象外。

### エンドレス

- seed付きランダム盤面。
- 同じseedの再挑戦と新しい盤面。
- 端末内記録、同一seedの初回・ベスト。
- 公式総合ランキングへ混ぜない。

### 練習

- 固定された短い暫定問題。
- 端末内・オンラインとも記録対象外。
- 正式チュートリアルはPhase 5で追加。

## プレイヤー名

```text
最大20文字
前後空白を除去
空文字不可
絵文字・記号を許可
端末内へ保存
```

保存領域が利用できなくても、有効な名前なら現在のプレイに使用できます。

## プレイ操作

- 箱を上下左右へドラッグすると、止まる場所まで滑ります。
- 同じ色・記号の搬出口から盤外へ出します。
- 全箱を出すとクリアです。
- undoは箱位置、操作数、移動マスを戻しますが、タイマーは戻しません。
- リタイアは確認後に確定し、記録しません。
- 残り箱があり合法操作が0件の場合、戻す・やりなおし・リタイアを案内します。

現行盤面は旧MVP生成です。v2公式条件`20 <= optimalSwipes <= 35`はPhase 3の検証済み問題集で実現します。

## 起動方法

Node.jsがあれば、追加パッケージなしで起動できます。

```bash
npm run dev
```

既定URL:

```text
http://localhost:5173/
```

ES Modulesを使うため、`index.html`をファイルとして直接開かずローカルサーバー経由で開いてください。

## テスト

```bash
npm test
```

主な検査対象:

- seedの再現性と盤面ルール
- 操作数、移動距離、最短操作
- Pointer Events中断と経過時間型アニメーション
- 画面状態、`playId`、カウントダウンtoken
- プレイヤー名と3モード
- undo、リタイア、詰み
- 結果の一回表示と古い結果の拒否
- 同一条件の端末内初回・ベスト
- Web Share、Clipboard、手動コピー
- HTML要素とPhase bootstrap順
- app、ui、services、coreの境界

P2-05対象18件は再現したNode環境で合格しています。既存テストを含むリポジトリ全体の`npm test`、`git diff --check`、実ブラウザ、320×568、390×844、PC、iPhone・iPad実機は未確認です。

## ディレクトリ構成

```text
index.html
styles/
  main.css
  p2-04.css
  p2-05.css
src/
  main.js
  p2-03-bootstrap.js
  p2-04-bootstrap.js
  p2-05-bootstrap.js
  app/
    app-state.js
    app-controller.js
    run-controller.js
    countdown-controller.js
    start-run.js
    visibility-policy.js
    modes.js
    player-name.js
    play-control-policy.js
    result-model.js
  core/
    rng.js
    rules.js
    solver.js
    generator.js
    engine.js
    palette.js
  input/
    pointer-input.js
  render/
    renderer.js
    canvas-renderer.js
    animation.js
  services/
    player-name-store.js
    ranking.js
    share-result.js
  ui/
    hud.js
    countdown-flow.js
    playing-controls.js
    result-flow.js
scripts/
  dev-server.mjs
test/
docs/
```

## v2正本

- [ゲーム契約](docs/GAME_CONTRACT_v2.md)
- [体験契約](docs/EXPERIENCE_CONTRACT_v2.md)
- [スコア・ランキング契約](docs/SCORE_RANKING_CONTRACT_v2.md)
- [モバイル・タッチ契約](docs/MOBILE_TOUCH_CONTRACT_v2.md)
- [性能契約](docs/PERFORMANCE_BUDGET_v2.md)
- [オリジナリティ記録](docs/ORIGINALITY_v2.md)
- [レビュー・チェックリスト](docs/REVIEW_CHECKLIST_v2.md)
- [P2-01 状態機械設計](docs/P2_01_STATE_MACHINE_v2.md)
- [P2-02 ホーム・名前・モード設計](docs/P2_02_HOME_NAME_MODES_v2.md)
- [P2-03 カウントダウン・時計設計](docs/P2_03_COUNTDOWN_CLOCK_v2.md)
- [P2-04 プレイ操作設計](docs/P2_04_PLAYING_CONTROLS_v2.md)
- [P2-05 結果・共有設計](docs/P2_05_RESULT_SHARE_v2.md)

## 次の工程

P2-05統合後はP2-06でPhase 1・2の統合ブラウザ検証を行います。P2-06を通過するまでPhase 3の盤面生成第2世代を開始しません。

## オリジナリティ

止まるまで滑る抽象的なパズルの仕組みを参考にしつつ、テーマ、用語、絵、盤面生成、画面、演出は独自に作ります。既存作品の名称、面データ、素材、文章を流用しません。

## ライセンス

MIT
