# CURRENT_TASK: P3-05B 実機試遊レビュー画面

## 目的

P3-05Aで固定した66候補を、iPhoneなどの実機から順番に遊び、評価・採否・試行結果を端末内へ記録できるようにする。

自動条件を通過した候補を公式問題へ自動昇格せず、人間が面白さ、分かりやすさ、難しさ、違い、納得感を確認する。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `8c480130750089f1d520f8a99fc646bde7dc7cac`
- 基準内容: Pull Request #21統合後、通常プレイ10箱化完了地点
- 作業ブランチ: `agent/hakodase-p3-05b-review-ui`
- Pull Request base: `main`
- Pull Request: 作成前

## 今回の一目的

```text
固定した66候補を実機で遊び、P3-05A契約に沿った評価記録を保存・共有できるレビュー画面を作る。
```

## 実装対象

```text
review.html
styles/review.css
src/review/review-app.js
src/review/review-game.js
src/review/review-store.js

test/review-store.test.js
test/browser/p3-05b-review.spec.js

.github/workflows/deploy-codeberg-pages.yml
docs/P3_05B_REVIEW_UI.md
docs/decisions/P3_05B_REVIEW_UI_DECISION.md
CURRENT_TASK.md
docs/COMPLETION_STATUS_v2.md
README.md
```

## 公開場所

```text
https://chameleonjp.codeberg.page/hakodase/review.html
```

一般向けホームからはリンクしない。`noindex,nofollow`を指定する。

## 候補データ

```text
docs/review/P3_05_REVIEW_PACK.json
```

Codeberg Pagesへは、レビュー画面とこの候補パックだけを追加配備する。

次は配備しない。

```text
docs/review/P3_05_PLAYTEST_RECORDS.json
docs/review/P3_05_PLAYTEST_SHEET.csv
```

## 試遊ランタイム

固定済み`boardData`を次へ渡す。

```text
boardDataV2ToRuntime
GameEngine
CanvasRenderer
PointerInput
```

レビュー画面では次を実行しない。

```text
候補生成
厳密ソルバー
1001件監査
ランキング送信
公式ID発行
```

## 候補操作

- 66候補を固定順で表示する。
- profileで絞り込む。
- 前後へ移動する。
- 次の`pending`候補へ移動する。
- URLの`candidate`へ現在候補を保存する。

## 自動試遊記録

「試遊開始」または「やりなおす」で次を更新する。

```text
attemptCount
playedAt
reviewer
device
browser
```

クリア時に次を更新する。

```text
clearCount
bestTimeMs
bestSwipeCount
```

undoはタイマーを戻さない。

## 手動評価

```text
enjoyment
clarity
difficulty
distinctiveness
fairness
```

各1〜5。

判断:

```text
pending
accept
revise
reject
```

`accept`完了には1回以上のクリア、5項目評価、試遊者・環境・日時、採用理由が必要である。

## 端末内保存

```text
hakodase.p3-05.review-records.v1
hakodase.p3-05.review-identity.v1
```

packVersionや候補識別子が一致しない記録は復元しない。

保存領域が使えない場合も試遊自体は継続できる。保存成功を偽らない。

## JSON入出力

書き出し順:

```text
Web ShareのJSONファイル
Clipboard
選択可能なテキスト
```

取込時に次を検査する。

```text
schemaVersion
packVersion
reviewId
候補識別子
重複候補
記録値
```

## 自動検証

Node:

- 空記録の再照合。
- 試行とクリアの更新。
- accept完了条件。
- 厳密最短未満の記録拒否。
- JSON取込の版・候補・重複検査。
- 記録と試遊者情報の保存分離。

Browser:

- 66候補を読み込む。
- b10c4を選ぶと10箱・4色・最短24操作。
- 試遊を開始できる。
- 評価を保存し再読込後も維持する。
- 320×568を含む対象画面で横スクロールがない。
- page errorがない。

## 完了条件

- [x] 候補選択と進捗表示を実装した。
- [x] 固定盤面を遊ぶランタイムを実装した。
- [x] 試行・クリア・ベスト記録を実装した。
- [x] 5項目評価と4判断を実装した。
- [x] localStorage保存を実装した。
- [x] JSON入出力を実装した。
- [x] Codeberg配備定義を更新した。
- [ ] Node Gateが成功する。
- [ ] Browser Gateが成功する。
- [ ] Codeberg公開後にiPhone 17 Proで開ける。
- [ ] 66候補の人間レビューが完了する。

## 対象外

```text
P3-05C 公式問題集の確定
正式puzzleId
P3-06 本日の出荷への正式接続
Supabaseランキング
レビュー記録の自動GitHub push
代表解法の自動再生を人間試遊として扱うこと
```

## 次工程

P3-05B統合・公開後、iPhone 17 Proからレビュー画面を開き、66候補を順番に評価する。

評価JSONを回収後:

```text
P3-05C: 30問以上の公式問題集を確定
```
