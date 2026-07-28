# P3-05B 実機試遊レビュー画面

## 1. 目的

P3-05Aで固定した66候補を、iPhoneなどの実機から順番に遊び、手動評価を端末内へ記録できるようにする。

自動検査を通った候補を、そのまま公式問題へ昇格しない。人間が次を確認する。

- 面白さ。
- 状況の分かりやすさ。
- 難しさ。
- 他候補との違い。
- 失敗への納得感。
- 実機での操作性と表示。
- 確認した詰み方や迷いやすい手順。

## 2. 公開場所

```text
https://chameleonjp.codeberg.page/hakodase/review.html
```

`review.html`には`noindex,nofollow`を指定する。通常ゲームのホームからはリンクしない。

開発者用の試遊導線であり、一般向けの正式機能ではない。

## 3. 候補データ

正本:

```text
docs/review/P3_05_REVIEW_PACK.json
```

Codeberg Pages公開時は、この1ファイルだけを次へコピーする。

```text
docs/review/P3_05_REVIEW_PACK.json
```

手動記録の正本テンプレートやCSVは公開しない。

候補パックには66件すべての次を含む。

```text
reviewId
templateId
profileId
puzzleId
boardHash
structureHash
schemaVersion
rulesVersion
generatorVersion
optimalSwipes
boardData
representativeSolution
proof
quality
```

## 4. 試遊ランタイム

レビュー画面は固定済み`boardData`を読み、次の既存実装を使う。

```text
GameEngine
CanvasRenderer
PointerInput
boardDataV2ToRuntime
```

レビュー画面では次を行わない。

```text
候補生成
厳密ソルバー
1001件監査
ランキング送信
公式問題IDの発行
```

候補を切り替えるたびに固定盤面を読み直す。盤面の内容はseedから再生成しない。

## 5. 候補の選択

- 66件を固定順で表示する。
- 箱数・色数のprofileで絞り込める。
- 前後の候補へ移動できる。
- 次の`pending`候補へ移動できる。
- URLの`candidate`検索パラメータへ現在の`reviewId`を保存する。

例:

```text
review.html?candidate=review-b10c4-t03-xxxxxxxxxxxx
```

## 6. 試行の記録

「試遊開始」または「やりなおす」を押した時に`attemptCount`を1回増やす。

クリア時に次を自動記録する。

```text
clearCount
bestTimeMs
bestSwipeCount
playedAt
```

undoはタイマーを戻さない。候補を途中で切り替えた場合も、開始済み試行は`attemptCount`に残す。

## 7. 手動評価

評価項目:

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

`accept`を完了扱いにする条件はP3-05A契約を維持する。

- 試遊者、端末、ブラウザ、試遊日時。
- 1回以上の試行。
- 1回以上のクリア。
- ベストタイムとベスト操作数。
- 5項目すべての評価。
- 採用理由。

厳密最短より少ない操作数を記録した場合は不整合として扱う。

## 8. 端末内保存

保存先:

```text
hakodase.p3-05.review-records.v1
hakodase.p3-05.review-identity.v1
```

候補記録と試遊者情報を分ける。

候補パック版が変わった場合、古い候補記録を自動適用しない。`reviewId`、`puzzleId`、`boardHash`などが候補と一致する記録だけを復元する。

保存領域が使えない場合も、その画面では試遊できる。保存失敗を成功として表示しない。

## 9. JSON入出力

記録セット:

```text
schemaVersion: hakodase.playtest-record-set/1
packVersion
generatorVersion
exportedAt
records
```

書き出し順:

1. Web ShareでJSONファイルを共有。
2. クリップボードへJSON全文をコピー。
3. 選択可能なテキスト欄へ表示。

読み込み時は次を拒否する。

- JSONとして不正。
- schemaVersion不一致。
- packVersion不一致。
- 未知のreviewId。
- reviewId重複。
- 候補識別子不一致。
- P3-05A記録契約に違反する値。

## 10. 進捗表示

表示する集計:

```text
complete / 66
accept
revise
reject
pending
```

`complete`は、判断が`pending`以外で、P3-05Aの必須入力を満たした記録だけを数える。

`accept`が30件以上でも、この画面だけで公式問題集を自動確定しない。P3-05Cで重複感、難易度配分、実機結果を再確認する。

## 11. 自動検査

Node:

- 保存記録の再照合。
- 試行とクリアの更新。
- accept完了条件。
- 厳密最短を下回る記録の拒否。
- JSON取込の版・候補・重複検査。
- 端末保存と試遊者情報の分離。

Browser:

- `review.html`が66候補を読み込む。
- profile絞り込み。
- 10箱・4色・最短24操作の候補を開始できる。
- 評価を保存して再読み込み後も維持する。
- 320×568を含む対象画面で横スクロールがない。
- page errorがない。

## 12. P3-05B完了条件

- [x] 66候補の選択と進捗表示。
- [x] 固定盤面の実機試遊。
- [x] 試行・クリア・ベスト記録。
- [x] 5項目評価と4判断。
- [x] 端末内保存。
- [x] JSON入出力。
- [x] Codeberg Pagesへのレビュー画面配備定義。
- [ ] Node Gateが成功する。
- [ ] Browser Gateが成功する。
- [ ] Codeberg公開後にiPhone 17 Proで開ける。
- [ ] 人間による66候補の評価が完了する。

## 13. 次工程

```text
P3-05C: 試遊結果から30問以上の公式問題集を確定
```

P3-05Cでは、端末から書き出した記録JSONを正本記録へ反映し、採用理由、不採用理由、既知の詰み、難易度配分、正式puzzleIdを確定する。
