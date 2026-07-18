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
| ホーム・名前確認・3モード | P2-02で実装中 |
| 3・2・1・START | 未実装 |
| 正式結果画面 | 未実装 |
| 公式問題集 | 未実装 |
| Supabaseランキング | 未実装 |
| 出荷レーン・シャッター | 未実装 |
| ブラウザ・実機・公開確認 | 未実施 |

現在の「本日の出荷」は固定暫定seedによるプレビューです。検証済み公式問題と`puzzleId`が未実装のため、公式記録や端末内記録へ保存しません。

エンドレスだけが、現行のseed付きランダム盤面と端末内記録を利用します。練習は現行の短い盤面を使い、記録対象外です。

詳しい現在地は[完成状況](docs/COMPLETION_STATUS_v2.md)、完成までの工程は[完成計画](docs/COMPLETION_PLAN_v2.md)を参照してください。

## 画面の流れ

P2-02時点では、次を実装しています。

```text
home
→ nameConfirm
→ countdownを暫定的に通過
→ playing
```

ホームでは、本日の出荷、エンドレス、練習を選びます。スタート後に、保存済みのプレイヤー名を確認または入力します。

プレイヤー名は次の条件です。

```text
最大20文字
前後空白を除去
空文字不可
絵文字・記号を許可
端末内へ保存
```

正式な3・2・1・STARTはP2-03、undo・リタイアはP2-04、正式結果画面はP2-05で追加します。

## 起動方法

Node.jsがあれば、追加パッケージなしで起動できます。

```bash
npm run dev
```

表示されたURLをブラウザで開いてください。既定値は次です。

```text
http://localhost:5173/
```

ES Modulesを使うため、`index.html`をファイルとして直接開かず、ローカルサーバー経由で開いてください。

ポートを変える例:

```bash
PORT=8080 npm run dev
```

## テスト

Node標準のテストランナーを使います。

```bash
npm test
```

主な検査対象:

- seedの再現性
- スライド・退場・壁
- 操作数と移動距離
- 最短操作ソルバー
- undo履歴
- Pointer Eventsの中断
- 経過時間型アニメーション
- 状態遷移と`playId`
- プレイヤー名
- 3モード
- 端末内記録のモード分離
- HTMLとJavaScriptの要素ID契約

P2-02の対象テストは再現したローカル環境で合格していますが、リポジトリ全体の`npm test`、実ブラウザ、iPhone・iPad実機は未確認です。

## 遊び方

1. 箱を上下左右へドラッグします。
2. 箱は壁、他の箱、盤端などで止まるまで滑ります。
3. 箱と同じ色・記号の搬出口から盤外へ出します。
4. すべての箱を出せばクリアです。

現行盤面は旧MVP生成です。v2公式問題の条件である`20 <= optimalSwipes <= 35`は、Phase 3の検証済み問題集で実現します。

## ディレクトリ構成

```text
index.html
styles/
  main.css
src/
  main.js
  app/
    app-state.js
    app-controller.js
    run-controller.js
    modes.js
    player-name.js
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
    ranking.js
  ui/
    hud.js
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

## オリジナリティ

止まるまで滑る抽象的なパズルの仕組みを参考にしつつ、テーマ、用語、絵、盤面生成、画面、演出は独自に作ります。既存作品の名称、面データ、素材、文章を流用しません。

## ライセンス

MIT
