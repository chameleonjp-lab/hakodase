# HAKODASE / ハコダセ

箱を滑らせ、順番と倉庫設備を読み、同じ印の搬出口からすべて出荷する短時間パズルです。

- HTML / CSS / バニラJavaScriptの静的サイト
- ビルド不要・ゲーム実行時の外部依存なし
- iPhone SE級の横幅320pxを優先
- Canvas2D描画
- ゲームロジックと描画を分離
- 将来Three.js/WebGLを追加できる構造を維持

## 現在の開発状態

HAKODASE v2は段階的に実装しています。

| 工程 | 状態 |
| --- | --- |
| v2仕様契約 | 完了 |
| 中核コードの正しさ | 統合済み・自動Gate合格 |
| 状態機械とプレイ世代 | 統合済み・自動Gate合格 |
| ホーム・名前確認・3モード | 統合済み・自動Gate合格 |
| 3・2・1・STARTと厳格時計 | 統合済み・自動Gate合格 |
| プレイ画面のundo・リタイア・詰み | 統合済み・自動Gate合格 |
| 正式結果画面・再挑戦・共有 | 統合済み・自動Gate合格 |
| Phase 1・2統合ブラウザGate | 自動Gate合格・手動実機継続中 |
| 4操作盤面BLOCKER | Pull Request #14で暫定修正・レビュー待ち |
| 公式問題集 | 未実装 |
| Supabaseランキング | 未実装 |
| 出荷レーン・シャッター | 未実装 |

Pull Request #11で、Node試験、`git diff --check`、320×568 WebKit、390×844 WebKit、1280×720 Chromiumの自動Gateを追加しました。

Codeberg Pages公開版のiPhone試遊で、旧normal生成器が4箱・最短4操作の盤面を作ることを確認しました。原因は、各箱を最初から対応出口と一直線へ配置する生成方式です。壁を増やすだけでは直らないため、Pull Request #14ではnormalを検証済み試作盤面バンクへ切り替えています。

## 現在の盤面

### 本日の出荷

- 固定seedで同じ試作問題を表示
- 厳格時計
- ページ非表示で試行無効
- 正式問題集とSupabaseが未実装のため記録対象外
- 現在は厳密最短8〜12操作の試作盤面を使用

### エンドレス

- seedで検証済み試作盤面を決定論的に選択
- 基礎盤面5件
- 左右反転、上下反転、180度回転、色置換を使用
- 初期状態から出口へ直行できる箱は0件
- 厳密最短8〜12操作
- 同じseedの再挑戦と新しい盤面
- 端末内記録、同一seedの初回・ベスト
- 公式総合ランキングへ混ぜない

### 練習

- 短い旧MVP互換盤面
- 端末内・オンラインとも記録対象外
- 正式チュートリアルはPhase 5で追加

## 暫定盤面の制限

現在の試作盤面バンクは、公開中の「4箱を4回動かすだけ」という破綻を止めるための暫定修正です。

正式なPhase 3条件は未達です。

```text
盤面: 7×9
箱: 8〜14個
色: 3〜6色
公式候補: 厳密最短20〜35操作
1000件以上の候補検査
人による試遊済み公式問題集
```

基礎盤面5件の反転や色置換を、正式な問題数として数えません。

## 画面の流れ

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

## 起動方法

ゲームのローカル起動には追加パッケージは不要です。

```bash
npm run dev
```

既定URL:

```text
http://localhost:5173/
```

ES Modulesを使うため、`index.html`をファイルとして直接開かず、ローカルサーバー経由で開いてください。

## Nodeテスト

```bash
npm ci
npm test
```

Nodeテストは`test/*.test.js`だけを対象とし、Playwright specと混在させません。

Pull Request #14のGitHub Actions Run #22では、既存試験を含むNode全156件が成功しました。試作基礎盤面5件は、開発時に現行の厳密ソルバーで8、8、9、10、12操作と再検証します。プレイ開始時にはソルバーを実行しません。

## ブラウザテスト

```bash
npm ci
npx playwright install chromium webkit
npm run test:browser
```

対象project:

```text
mobile-320-webkit
mobile-390-webkit
desktop-chromium
```

主な検査対象:

- 横スクロール
- Phase bootstrapの実ブラウザ接続
- ホーム、名前、カウントダウン、プレイ、結果
- START前の盤面非表示と0.00秒
- START後の時計開始
- `pointercancel`と`lostpointercapture`
- リタイア確認
- 結果の一回表示と古い結果の拒否
- 同じ問題の再挑戦
- 共有不能時の手動コピー
- 本日の出荷のページ非表示無効化
- console errorとpage error

Pull Request #14のRun #22ではNode・Browserの両Gateが成功しています。ただし、自動WebKitの成功をiPhone実機確認済みとは扱いません。

## Codeberg Pages

GitHubの`main`更新時に、次だけをCodebergの`pages`ブランチへ自動配備します。

```text
index.html
styles/
src/
```

公開中のゲームは`main`へマージされた内容です。Pull Request上の変更は、マージされるまでCodebergへ出ません。

## ディレクトリ構成

```text
.github/workflows/
index.html
styles/
src/
  main.js
  p2-03-bootstrap.js
  p2-04-bootstrap.js
  p2-05-bootstrap.js
  app/
  core/
  input/
  render/
  services/
  ui/
scripts/
test/
  browser/
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
- [完成状況](docs/COMPLETION_STATUS_v2.md)
- [完成計画](docs/COMPLETION_PLAN_v2.md)

## 次の工程

Pull Request #14をCodebergへ公開後、iPhoneで複数seedを再試遊し、パズル判断が生まれたかを確認します。そのBLOCKER解消後にP3-01「盤面データv2・版管理」を開始します。

## オリジナリティ

止まるまで滑る抽象的なパズルの仕組みを参考にしつつ、テーマ、用語、絵、盤面生成、画面、演出は独自に作ります。既存作品の名称、面データ、素材、文章を流用しません。

## ライセンス

MIT
