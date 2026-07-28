# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は現在の進捗と次のGateを示す。

最終更新日: 2026年7月27日

## 現在地

| ID | 作業 | 状態 | 根拠・残件 |
| --- | --- | --- | --- |
| Phase 0 | v2仕様契約 | 完了 | Pull Request #1 |
| Phase 1 | 中核コードの正しさ | 自動Gate合格・実機待ち | Pull Request #2、P2-06で再検証 |
| G-01 | Git基準整理 | 文書統合済み・設定確認待ち | Pull Request #4。正式PR baseは`main` |
| P2-01 | アプリ状態機械 | 統合済み・自動Gate合格 | Pull Request #5 |
| P2-02 | ホーム・名前・モード | 統合済み・自動Gate合格 | Pull Request #6。実機キーボード確認が残る |
| P2-03 | カウントダウン・公式時計 | 統合済み・自動Gate合格 | Pull Request #7 |
| P2-04 | プレイ画面・undo・リタイア・詰み | 統合済み・自動Gate合格 | Pull Request #8。#9は重複close |
| P2-05 | 結果・再挑戦・共有 | 統合済み・自動Gate合格 | Pull Request #10 |
| P2-06 | Phase 1・2統合ブラウザGate | 自動Gate合格・実機継続 | Pull Request #11 |
| P2-06-B1 | 非自明盤面暫定修正 | 統合済み・暫定 | Pull Request #14。公開中は4箱8〜12操作の試作盤面 |
| P3-01 | 盤面データv2・版管理 | 統合済み・自動Gate合格 | Pull Request #15 |
| P3-02 | 厳密ソルバーv2 | 統合済み・自動Gate合格 | Pull Request #16 |
| P3-03 | 旧生成器v2 | 統合済み・品質不合格 | Pull Request #17。P3-04で初期直行・構造不足を確認 |
| P3-04 | 品質指標・1001件監査 | 統合済み | Pull Request #18。旧生成器のBLOCKERを数値化 |
| P3-03R | 生成器v3補修 | 統合済み・自動Gate合格 | Pull Request #19。66構造、直行箱0、1001件再監査合格 |
| P3-05A | 試遊候補パック・評価契約 | 自動Gate合格・レビュー待ち | Pull Request #20。66候補と空の試遊記録JSON/CSVを固定 |
| P3-05B | 試遊レビュー導線 | 未着手 | 固定候補を実機で順番に遊ぶ導線 |
| P3-05C | 試遊済み公式問題集 | 未着手 | 30問以上を目標に採否と正式IDを確定 |
| P3-06 | 本日の出荷 | 未着手 | 試遊済み問題集から決定論的に選択する |
| Phase 4 | Supabaseランキング | 未着手 | 実物RPC・表・権限の監査から開始する |
| Phase 5 | 独自ギミック | 未着手 | レーン・シャッターをルール版変更として扱う |
| Phase 6 | 品質保証・正式公開 | 未着手 | 実機、長時間、アクセシビリティ、公開整合を確認する |

## P3-03R完了内容

生成版:

```text
route-catalog/3.0.0
```

| profile | 箱 | 色 | 厳密最短 | 構造数 |
| --- | ---: | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 | 12 |
| `b09c3` | 9 | 3 | 21 | 12 |
| `b10c4` | 10 | 4 | 24 | 12 |
| `b11c4` | 11 | 4 | 25 | 12 |
| `b12c5` | 12 | 5 | 28 | 8 |
| `b13c5` | 13 | 5 | 29 | 5 |
| `b14c6` | 14 | 6 | 28 | 5 |

```text
合計: 66構造
各profile: 5構造以上
```

1001件再監査:

```text
requested: 1001
inspected: 1001
generated: 1001
generation failures: 0
candidate: 1001
review: 0
reject: 0
initial direct exit blocks: 0
unique boardHash: 912
eligible unique structureHash: 66
optimal swipes: 20〜29
acceptance.passed: true
```

正本:

```text
docs/P3_03R_GENERATOR_V3.md
docs/decisions/P3_03R_GENERATOR_V3_DECISION.md
docs/reports/P3_03R_AUDIT_1001_SUMMARY.md
```

## P3-05A 完了内容

### 候補固定

66テンプレートを、次の固定seedと明示`templateId`で1候補ずつ生成する。

```text
p3-05-review-v1:<templateId>
```

レビューID:

```text
review-<templateId>-<boardHash先頭12桁>
```

盤面内容が変わった場合、古い試遊評価を使い回さない。

### 候補数と証明方式

```text
candidateCount: 66
optimalSwipes: 20〜29
usesLanes: 5
proofMode components: 61
proofMode global: 5
```

profile配分:

```text
12 / 12 / 12 / 12 / 8 / 5 / 5
```

### 候補証拠

```text
reviewId
reviewStatus
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

### 手動試遊記録

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

評価:

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

`accept`完了には、1回以上のクリア、全評価項目、採用理由が必要である。

### 正本ファイル

```text
docs/review/P3_05_REVIEW_PACK.json
docs/review/P3_05_PLAYTEST_RECORDS.json
docs/review/P3_05_PLAYTEST_SHEET.csv
docs/review/P3_05_REVIEW_PACK_SUMMARY.md
```

候補パックは公開対象の`src/`へ置かず、開発・試遊用の`docs/review/`へ固定した。

### Review Pack workflow

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

### Node・Browser Gate

```text
Run: 30266443573
Node tests and diff check: success
Browser gate: success
Node tests: 207
pass: 207
fail: 0
skipped: 0
```

ブラウザ対象:

```text
WebKit 320×568
WebKit 390×844
Chromium 1280×720
```

### P3-05A Gate判定

- [x] 66候補を生成した。
- [x] profile配分を維持した。
- [x] `reviewId`、`templateId`、`puzzleId`、`boardHash`、`structureHash`の重複0。
- [x] 全候補で厳密証明、20〜35操作、初期直行箱0を確認した。
- [x] 同じ条件で同じ候補パックを再生成した。
- [x] 候補hash改ざんを検出した。
- [x] 手動試遊記録の候補不一致と不正値を検出した。
- [x] Node Gate、Browser Gate、Review Pack workflowが成功した。
- [x] 正本候補JSONと空の記録JSON/CSVを同じPull Requestへ固定した。
- [ ] 人間レビューが完了する。

## P3-05Aで未実施

```text
人間による試遊
レビュー画面
accept / reject / reviseの実記録
30問以上の公式問題集
正式puzzleId
本日の出荷
Supabaseランキング
Codeberg公開内容の変更
```

## 公開版との関係

現在Codebergで遊べる盤面はPull Request #14の暫定版である。

P3-05Aは公開中の`generator.js`、本日の出荷、エンドレス、公式ランキングへ接続しない。生成器v3と厳密ソルバーは開発時だけ使用する。

## 次の作業

Pull Request #20のレビュー・統合後:

```text
P3-05B: 固定候補を実機で試遊するレビュー導線
P3-05C: 試遊結果から30問以上の公式問題集を確定
```
