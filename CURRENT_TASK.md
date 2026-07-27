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
- Pull Request: 作成前

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
docs/reports/P3_04_AUDIT_1001_SUMMARY.md
package.json
.gitignore
CURRENT_TASK.md
docs/COMPLETION_STATUS_v2.md
```

監査summaryは専用job成功後に追加する。

## 品質指標

### 初期状態

```text
initialLegalActionCount
initialMovableBlockCount
initialDirectExitActionCount
initialDirectExitBlockCount
initialOccupancyRate
```

初期直行箱が1件以上ある候補はhard rejectとする。

### 代表最短解法上の分岐

```text
branchingByStep
solutionAverageBranching
solutionMaxBranching
solutionDecisionStepCount
solutionForcedStepCount
solutionDecisionStepRate
solutionForcedStepRate
```

P3-02が返した決定論的な代表最短解法を再生し、各手の直前に全合法操作を数える。

### 誤手・即時詰み

```text
offRouteAlternativeCount
offRouteAlternativeRate
immediateDeadEndAlternativeCount
immediateDeadEndAlternativeRate
```

代表手以外の合法操作を1手だけ適用し、未退場箱が残るのに直後の合法操作が0件となるものを即時詰みと数える。

数手先まで含む完全な詰み率ではない。

### 壁利用

```text
activeWallCount
solutionUsedWallCount
wallUtilizationRate
stopHistogram
```

壁ではないセルへ隣接する壁をactive wallとし、代表解法で箱を実際に停止させた一意な壁の割合を求める。

### 反復と偏り

```text
sameBlockRepeatRate
maxSameBlockRun
directionHistogram
colorHistogram
dominantDirectionRate
dominantColorRate
```

## 重複識別

### boardHash

盤面データv2の正式内容識別子。色、ID、反転が違えば別内容になる。

### structureHash

監査用の補助識別子。

次を正規化する。

```text
箱IDと搬出口IDを除外
搬出口位置順に色番号を振り直す
同色箱を座標順へ並べる
identity / mirrorX / mirrorY / rotate180の最小形を選ぶ
```

`structureHash`はランキングや公開問題IDには使用しない。

## 暫定screening

### hard reject

```text
no-initial-legal-action
initial-direct-exit
```

### review flag

```text
low-initial-branching
low-decision-density
low-wall-utilization
high-same-block-repeat
high-direction-bias
high-color-bias
```

判定:

```text
candidate
review
reject
```

rejectやreviewが多くても監査処理の失敗とはしない。問題を正しく発見して報告することがP3-04の目的である。

## 1001件監査

```bash
npm run audit:p3-04 -- \
  --count 1001 \
  --seed-prefix p3-04-audit-v1 \
  --out-dir audit-output/p3-04
```

profileを順番に選ぶ。

出力:

```text
audit.json
candidates.csv
summary.md
audit-output.log
```

専用workflow:

```text
.github/workflows/p3-04-candidate-audit.yml
```

- 通常のNode・Browser Gateから分離する。
- timeoutは60分。
- artifactは30日保持する。
- workflow summaryへMarkdown結果を表示する。

## 自動検証

通常CIで確認する。

- 品質指標の型と値域。
- 初期直行箱の検出。
- 左右・上下反転と色置換を同じ`structureHash`として扱うこと。
- P3-03実候補の代表解法を最後まで再生できること。
- 1001件loopを軽量依存注入で完走できること。
- `boardHash`重複と構造同型重複を別集計すること。
- 既存Node・Browser Gateを壊さないこと。

専用audit jobで確認する。

- 実際のP3-03生成器を1001回実行する。
- 全候補をP3-02厳密ソルバーへ通す。
- 1001行のCSVとJSONを保存する。
- profile別集計を保存する。
- 生成失敗、hard reject、review flag、重複を理由別に集計する。

## 完了条件

- [x] 初手分岐と初期直行箱を計測する。
- [x] 代表解法上の分岐を計測する。
- [x] 即時詰み代替率を計測する。
- [x] 壁利用率を計測する。
- [x] 反復、色、方向偏りを計測する。
- [x] `structureHash`を実装する。
- [x] 1001件監査CLIを実装する。
- [x] 専用GitHub Actionsを実装する。
- [ ] リポジトリ全Nodeテストが成功する。
- [ ] Browser Gateが成功する。
- [ ] 1001件監査jobが成功する。
- [ ] 監査summaryをGitHub文書へ固定する。
- [ ] P3-03補修の要否を判断する。
- [ ] 人間レビューが完了する。

## 対象外

```text
P3-05 人間試遊と公式問題集
P3-06 本日の出荷
Supabaseランキング
Codeberg公開内容の変更
公開ゲームでの実行時ソルバー
出荷シャッター
Three.js / WebGL
```

## 次工程

監査で生成器の構造上の不足が確認された場合:

```text
P3-03R: 生成器v2補修
```

監査でP3-05へ渡せる候補が確認された場合:

```text
P3-05: 人間試遊と公式問題集
```
