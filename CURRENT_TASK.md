# CURRENT_TASK: P3-05A 試遊候補パックと手動評価契約

## 目的

P3-03Rで自動条件を通過した66構造を、人が遊ぶ前の候補証拠として固定する。

盤面、厳密最短、代表解法、版、hash、自動品質指標と、人間が記入する試遊記録を分離し、P3-05の手動評価を開始できる状態にする。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `45d735cc472a0fc1b3f1fbf146e40807e75c5cc3`
- 基準内容: Pull Request #19統合後のP3-03R完了地点
- 作業ブランチ: `agent/hakodase-p3-05-review-pack`
- Pull Request base: `main`
- Pull Request: #20

## 今回の一目的

```text
66構造の決定論的な試遊候補パックと、手動評価の保存・検証契約を作る。
```

P3-05Aでは、実際の人間試遊、正式採用30問の確定、公開ゲームへの接続を行わない。

## 実装対象

```text
src/core/p3-05-review-pack.js
src/core/p3-05-playtest-record.js
scripts/p3-05-build-review-pack.mjs
test/p3-05-review-pack.test.js
test/p3-05-playtest-record.test.js
.github/workflows/p3-05-review-pack.yml
docs/review/P3_05_REVIEW_PACK.json
docs/review/P3_05_PLAYTEST_RECORDS.json
docs/review/P3_05_PLAYTEST_SHEET.csv
docs/review/P3_05_REVIEW_PACK_SUMMARY.md
docs/P3_05_REVIEW_PACK.md
docs/decisions/P3_05_REVIEW_CONTRACT_DECISION.md
package.json
CURRENT_TASK.md
docs/COMPLETION_STATUS_v2.md
```

レビュー候補データはCodeberg公開対象の`src/`へ置かず、開発・試遊用の`docs/review/`へ固定する。

## 候補の固定方法

各テンプレートに次の固定seedを使う。

```text
p3-05-review-v1:<templateId>
```

`templateId`も明示するため、別構造へ置き換わらない。

レビューID:

```text
review-<templateId>-<boardHash先頭12桁>
```

盤面内容が変わる場合、古いレビューIDと試遊結果を使い回さない。

## 候補数

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

```text
最短操作数: 20〜29
一方通行床を含む候補: 5
proofMode components: 61
proofMode global: 5
```

## 候補証拠

各候補へ次を保存する。

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

処理時間は実行環境で変わるため固定証拠へ含めない。

## 手動試遊記録

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

評価項目:

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

`accept`完了には、試遊者・環境・日時・1回以上のクリア・5項目評価・採用理由が必要である。

厳密最短より少ない人間記録は不整合として拒否する。

## 生成コマンド

```bash
npm run build:p3-05-review-pack -- \
  --out-dir review-output/p3-05 \
  --require-count 66
```

生成物:

```text
review-pack.json
playtest-records.json
playtest-sheet.csv
summary.md
review-output.log
```

リポジトリ正本:

```text
docs/review/P3_05_REVIEW_PACK.json
docs/review/P3_05_PLAYTEST_RECORDS.json
docs/review/P3_05_PLAYTEST_SHEET.csv
docs/review/P3_05_REVIEW_PACK_SUMMARY.md
```

候補パックJSONは機械読取用の1行JSONとして保存し、盤面内容は省略しないまま差分行数を抑える。

## 自動検証結果

P3-05 Review Pack workflow:

```text
Run: 30266443413
Build 66-candidate review pack: success
```

Artifact:

```text
name: hakodase-p3-05-review-pack-1
id: 8652982976
digest: sha256:42704e877a107cf9618151c6a0a432659a75bc2256baaea16ef4cf25623aec69
```

通常CI:

```text
Run: 30266443573
Node tests and diff check: success
Browser gate: success
Node tests: 207
pass: 207
fail: 0
skipped: 0
```

確認した内容:

- 66候補を生成する。
- profile配分が`12 / 12 / 12 / 12 / 8 / 5 / 5`である。
- `reviewId`、`templateId`、`puzzleId`、`boardHash`、`structureHash`が重複しない。
- 全候補が厳密証明を持つ。
- 全候補が20〜35操作である。
- 全候補の初期直行箱が0件である。
- 同じ条件で同じ候補パックを返す。
- 証拠改ざんを検出する。
- 手動記録の候補不一致と不正値を検出する。
- WebKit 320×568、WebKit 390×844、Chromium 1280×720を通過する。

## 完了条件

- [x] 66候補パック生成処理を実装した。
- [x] 候補証拠の契約を固定した。
- [x] 手動試遊記録の契約を固定した。
- [x] JSON、CSV、Markdown生成処理を実装した。
- [x] 専用GitHub Actionsを追加した。
- [x] Node Gateが成功した。
- [x] Browser Gateが成功した。
- [x] Review Pack workflowが成功した。
- [x] 正本候補データをリポジトリへ固定した。
- [x] 空の手動記録JSONとCSVをリポジトリへ固定した。
- [ ] 人間レビューが完了する。

## 対象外

```text
P3-05B 試遊レビュー画面
人間による66候補の試遊
P3-05C 30問以上の正式問題集
P3-06 本日の出荷
Supabaseランキング
Codeberg公開内容の変更
```

## 次工程

Pull Request #20のレビュー・統合後:

```text
P3-05B: 固定候補を実機で試遊するレビュー導線
P3-05C: 試遊結果から公式問題集を確定
```
