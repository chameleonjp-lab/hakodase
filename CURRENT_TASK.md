# CURRENT_TASK: P3-04 品質指標と1001件候補監査

## 目的

P3-03生成器が返す8〜14箱・3〜6色・厳密最短20〜35操作の候補を、最短操作数だけで公式問題候補へ進めない。

初手分岐、初期直行箱、壁利用、誤手・即時詰み、反復、色・方向偏り、重複を数値化し、1001件の再現可能な監査証拠を残す。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `f2367c37851b6a956844d06d40bcec497838aac6`
- 基準内容: Pull Request #17統合後のP3-03完了地点
- 作業ブランチ: `agent/hakodase-p3-04-quality-audit`
- Pull Request base: `main`
- Pull Request: #18
- 監査対象head: `8bac149a2f1af133e8836d0a768e01efb0f71674`

## 今回の一目的

```text
P3-03候補の品質指標と構造重複を実装し、1001件監査をGitHub Actionsで完走して結果を固定する。
```

P3-04では人間試遊、公式問題集、公開ゲームへの接続、Supabaseランキングを実装しない。

## 実装対象

```text
src/core/quality-metrics-v2.js
src/core/candidate-audit-v2.js
scripts/p3-04-candidate-audit.mjs
test/quality-metrics-v2.test.js
test/candidate-audit-v2.test.js
.github/workflows/p3-04-candidate-audit.yml
docs/P3_04_QUALITY_AUDIT_V2.md
docs/decisions/P3_04_QUALITY_AUDIT_V2_DECISION.md
docs/decisions/P3_04_AUDIT_RESULT_DECISION.md
docs/reports/P3_04_AUDIT_1001_SUMMARY.md
package.json
.gitignore
CURRENT_TASK.md
docs/COMPLETION_STATUS_v2.md
```

## 品質指標

```text
initialLegalActionCount
initialMovableBlockCount
initialDirectExitActionCount
initialDirectExitBlockCount
initialOccupancyRate
branchingByStep
solutionDecisionStepRate
solutionForcedStepRate
offRouteAlternativeCount
immediateDeadEndAlternativeRate
wallUtilizationRate
sameBlockRepeatRate
maxSameBlockRun
dominantDirectionRate
dominantColorRate
```

誤手・詰み指標は、代表手以外を1手だけ適用し、直後に合法手0件となる割合である。完全な詰み率とは扱わない。

## 重複識別

### `boardHash`

盤面データv2の正式内容識別子。

### `structureHash`

監査用の補助識別子。次を正規化する。

```text
箱IDと搬出口IDを除外
搬出口位置順で色番号を振り直す
同色箱を座標順へ並べる
identity / mirrorX / mirrorY / rotate180を同一視
```

ランキングや公開問題IDには使用しない。

## 1001件監査

GitHub Actions Run:

```text
30236109244
```

Artifact:

```text
hakodase-p3-04-audit-1
ID: 8642009680
digest: sha256:e4e8693941557e1aacea173d0b9b26bf6e74b73ba06503c4f4bdad8c4859ffb9
```

実行結果:

```text
1001 candidate quality audit: success
requested: 1001
inspected: 1001
generated: 1001
failed: 0
durationMs: 1,431,425
```

全体集計:

```text
candidate: 429
review: 0
reject: 572
unique boardHash: 656
unique structureHash: 27
boardHash unique ratio: 65.53%
structure unique ratio: 2.70%
```

## 発見したBLOCKER

### 1. 初期直行箱

572件が`initial-direct-exit`でhard rejectになった。

```text
b09c3: 初期直行箱1個 / 全143件
b11c4: 初期直行箱1個 / 全143件
b13c5: 初期直行箱1個 / 全143件
b14c6: 初期直行箱2個 / 全143件
```

seedの偶発不良ではなくprofile構造の問題である。

### 2. 構造の種類不足

hard ruleを通過した429件に限定すると、一意`structureHash`は3件だけだった。

```text
b08c3: 143件 → 1構造
b10c4: 143件 → 1構造
b12c5: 143件 → 1構造
```

色置換、箱ID、反転で`boardHash`は増えているが、遊び方の基礎構造は増えていない。

## その他の監査値

```text
初手合法操作 平均: 4.286
判断手率 平均: 90.85%
壁利用率 平均: 16.77%
即時詰み代替率 平均: 0.00%
同箱連続率 平均: 35.78%
最大方向偏り 平均: 38.85%
最大色偏り 平均: 45.52%
ソルバーノード 平均: 106,487.857
ソルバー時間 平均: 1,427.558ms
```

即時詰み0%は、数手後の詰みがないことを意味しない。

## 最終自動Gate

GitHub Actions Run `30237792287`:

```text
Node tests and diff check: success
Browser gate: success
Node tests: 194
pass: 194
fail: 0
skipped: 0
```

文書だけの後続同期では、専用1001件監査を再計算しない判定を追加した。監査ランタイムの対象ファイルが変わった時だけ再実行する。

## 正本報告

```text
docs/reports/P3_04_AUDIT_1001_SUMMARY.md
docs/decisions/P3_04_AUDIT_RESULT_DECISION.md
```

## 判定

```text
P3-04監査処理: 合格
P3-03候補品質: 不合格
P3-05への移行: 禁止
次工程: P3-03R
```

## P3-03R暫定条件

```text
1001件生成完走
全profileで初期直行箱0
hard rule通過候補の一意structureHash 60件以上
各profileで一意structureHash 5件以上
全件厳密最短20〜35操作
同一seedの決定性維持
未検証フォールバック禁止
```

## 完了条件

- [x] 初手分岐と初期直行箱を計測した。
- [x] 代表解法上の分岐を計測した。
- [x] 即時詰み代替率を計測した。
- [x] 壁利用率を計測した。
- [x] 反復、色、方向偏りを計測した。
- [x] `structureHash`を実装した。
- [x] 1001件監査CLIを実装した。
- [x] 専用GitHub Actionsを実装した。
- [x] Node・Browser Gateが成功した。
- [x] 1001件監査jobが成功した。
- [x] 監査summaryをGitHub文書へ固定した。
- [x] P3-03補修が必要と判断した。
- [x] 最終文書同期後のNode・Browser Gateが成功した。
- [ ] 人間レビューが完了する。

## 対象外

```text
P3-03R生成器補修の実装
P3-05 人間試遊と公式問題集
P3-06 本日の出荷
Supabaseランキング
Codeberg公開内容の変更
公開ゲームでの実行時ソルバー
出荷シャッター
Three.js / WebGL
```

## 次工程

Pull Request #18のレビュー・統合後、最新`main`から開始する。

```text
P3-03R: 生成器v2補修
```
