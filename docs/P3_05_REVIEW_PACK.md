# P3-05A 試遊候補パックと手動評価契約

## 1. 目的

P3-03Rで自動条件を通過した66構造を、そのまま公式問題として扱わない。

P3-05Aでは、人が実際に遊ぶ前の候補証拠を固定し、盤面内容と評価記録が混ざらない形で試遊作業を開始できるようにする。

この工程で行うこと:

- 66構造から固定seedで66候補を作る。
- 各候補の盤面、厳密最短、代表解法、版、hash、自動品質指標を保存する。
- 人間の試遊記録に必要な項目を固定する。
- JSON、CSV、Markdownのレビュー資料を生成する。
- 同じコードから同じ候補資料を再生成できることを自動検査する。

この工程では、候補を公式問題集へ昇格しない。

## 2. 対象

```text
generatorVersion: route-catalog/3.0.0
rulesVersion: slide-exit/1
schemaVersion: hakodase.board/2
reviewPackVersion: p3-05-review-pack/1.0.0
```

対象はP3-03Rの66基礎構造すべてとする。

| profile | 候補数 |
| --- | ---: |
| `b08c3` | 12 |
| `b09c3` | 12 |
| `b10c4` | 12 |
| `b11c4` | 12 |
| `b12c5` | 8 |
| `b13c5` | 5 |
| `b14c6` | 5 |
| 合計 | 66 |

## 3. 候補の固定方法

各テンプレートについて、次のseedを使用する。

```text
p3-05-review-v1:<templateId>
```

さらに`templateId`を明示して生成するため、別テンプレートへ置き換わらない。

候補IDは次の要素から作る。

```text
review-<templateId>-<boardHash先頭12桁>
```

盤面内容が変わって`boardHash`が変わる場合、同じレビューIDを使い回さない。

## 4. 候補へ保存する証拠

各候補には次を保存する。

```text
reviewId
reviewStatus: unreviewed
templateId
profileId
seed
puzzleId
boardHash
structureHash
schemaVersion
rulesVersion
generatorVersion
optimalSwipes
variant
boardData
representativeSolution
proof
quality
```

`proof`:

```text
exact
reason
optimalSwipes
nodesExpanded
uniqueStates
frontierPeak
proofSource
proofTemplateId
proofMode
proofTransformInvariant
```

`quality`:

```text
initialLegalActionCount
initialMovableBlockCount
initialDirectExitBlockCount
solutionAverageBranching
solutionMaxBranching
solutionDecisionStepRate
wallUtilizationRate
immediateDeadEndAlternativeRate
sameBlockRepeatRate
maxSameBlockRun
dominantDirectionRate
dominantColorRate
```

処理時間は環境で変わるため、固定候補証拠へ保存しない。

## 5. 手動試遊記録

自動証拠とは別に、次の記録を候補ごとに残す。

```text
reviewer
device
browser
playedAt
attemptCount
clearCount
bestTimeMs
bestSwipeCount
ratings
knownDeadlocks
notes
decision
decisionReason
```

評価は1〜5の整数とする。

```text
enjoyment
clarity
difficulty
distinctiveness
fairness
```

判断:

```text
pending
accept
reject
revise
```

`accept`を完了扱いにするには、少なくとも次が必要である。

- 試遊者、端末、ブラウザ、試遊日時。
- 1回以上の試行。
- 1回以上のクリア。
- ベストタイムとベスト操作数。
- 5項目すべての評価。
- 採用理由。

人が記録した操作数が厳密最短を下回る場合は、盤面、解法、記録のいずれかに不整合があるため拒否する。

## 6. 生成物

コマンド:

```bash
npm run build:p3-05-review-pack -- \
  --out-dir review-output/p3-05 \
  --require-count 66
```

出力:

```text
review-pack.json
playtest-records.json
playtest-sheet.csv
summary.md
review-output.log
```

### `review-pack.json`

盤面、厳密解、自動証拠を持つ正本候補データ。

### `playtest-records.json`

全候補の空の手動試遊記録。

### `playtest-sheet.csv`

表計算ソフトで記入できる同内容のシート。

### `summary.md`

候補数とprofile配分を読みやすく表示する。

## 7. 自動検査

通常CIで次を確認する。

- 66候補を作れる。
- profile配分が`12 / 12 / 12 / 12 / 8 / 5 / 5`である。
- `reviewId`、`templateId`、`puzzleId`、`boardHash`、`structureHash`が重複しない。
- 全候補が厳密証明を持つ。
- 全候補の最短操作数が20〜35である。
- 全候補の初期直行箱が0件である。
- 同じ条件で同じ候補パックを返す。
- 候補hashの改ざんを検出する。
- 手動試遊記録の候補不一致や不正値を検出する。

専用workflow:

```text
.github/workflows/p3-05-review-pack.yml
```

候補資料を生成し、30日保持するartifactへ保存する。

リポジトリへ固定候補ファイルを追加した後は、毎回の生成結果とバイト単位で一致することを検査する。

## 8. P3-05A完了条件

- [x] 決定論的な66候補パック生成処理を実装する。
- [x] 候補証拠の項目を固定する。
- [x] 手動試遊記録の項目と検証規則を固定する。
- [x] JSON、CSV、Markdown生成処理を実装する。
- [x] 専用GitHub Actionsを追加する。
- [ ] Node Gateが成功する。
- [ ] Browser Gateが成功する。
- [ ] Review Pack workflowが成功する。
- [ ] 生成した正本候補データと空の記録シートを同じPull Requestへ固定する。
- [ ] 人間レビューが完了する。

## 9. 対象外

```text
候補を実際に遊ぶレビュー画面
人間による66候補の試遊
30問以上の正式採用
公式puzzleIdの発行
本日の出荷への接続
Supabaseランキング
Codeberg公開内容の変更
```

## 10. 次工程

P3-05A統合後:

```text
P3-05B: 固定候補を実機で試遊するレビュー導線
P3-05C: 試遊結果から30問以上の公式問題集を確定
```

自動条件だけでP3-05Cへ進まない。
