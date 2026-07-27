# P3-04 品質指標と1001件候補監査

## 1. 目的

P3-03生成器が返す候補を、厳密最短操作数だけで公式問題候補へ進めない。

P3-04では次を数値化し、1001件の監査証拠を残す。

- 初手分岐数。
- 初期状態から直行退場できる箱数。
- 代表最短解法で使われる壁の割合。
- 代表手以外の代替手と、直後に合法手0件となる即時詰み指標。
- 同じ箱を連続して動かす割合。
- 色と方向の偏り。
- `boardHash`重複。
- 色番号、箱ID、反転を除いた構造同型重複。

人が遊んだ時の面白さはP3-05で確認する。P3-04の自動結果だけで公式問題へ昇格しない。

## 2. 対象

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
generatorVersion: route-scaffold/2.0.0
```

| profile | 箱 | 色 | 厳密最短 |
| --- | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 |
| `b09c3` | 9 | 3 | 21 |
| `b10c4` | 10 | 4 | 24 |
| `b11c4` | 11 | 4 | 25 |
| `b12c5` | 12 | 5 | 28 |
| `b13c5` | 13 | 5 | 29 |
| `b14c6` | 14 | 6 | 26 |

監査はprofileを順番に選び、同じseed prefixから1001件を検査する。

## 3. 初期状態の指標

### `initialLegalActionCount`

初期状態で実行可能な`箱 × 方向`の総数。同じ箱が2方向へ動ける場合は2件と数える。

### `initialMovableBlockCount`

初期状態で1方向以上へ動ける箱の数。

### `initialDirectExitActionCount`

初手で即座に搬出口から退場する操作の数。

### `initialDirectExitBlockCount`

初手で即座に退場できる箱の数。同じ箱が複数方向から退場できても1箱と数える。

P3-04のhard ruleでは初期直行箱を0件とする。1件以上あれば`initial-direct-exit`でrejectする。

### `initialOccupancyRate`

```text
箱数 / 壁ではない盤面セル数
```

## 4. 代表最短解法上の分岐

P3-02が返した決定論的な代表最短解法を再生し、各手の直前に全合法操作を数える。

```text
branchingByStep
solutionAverageBranching
solutionMaxBranching
solutionDecisionStepCount
solutionForcedStepCount
solutionDecisionStepRate
solutionForcedStepRate
```

代表解法が1本であることと、最短解が1通りであることは同じではない。P3-04は全最短解法数を数えない。

## 5. 誤手・詰み指標

代表最短解法の各状態で、代表手以外の合法操作を1手だけ適用する。

```text
offRouteAlternativeCount
offRouteAlternativeRate
immediateDeadEndAlternativeCount
immediateDeadEndAlternativeRate
```

`immediateDeadEndAlternativeRate`は、代替手の直後、未退場箱が残るのに合法操作が0件となる割合である。

これは1手先だけを見る軽量指標であり、数手後の詰み、別の最短解法、最短から外れるが解ける操作は区別しない。完全な詰み率とは呼ばない。

## 6. 壁利用率

壁ではないセルへ上下左右で隣接する壁を`active wall`とする。

代表最短解法で箱が停止した直後、その進行方向の次セルが壁なら、その壁を使用済みと数える。

```text
wallUtilizationRate = 代表解法で使った一意な壁 / active wall
```

停止理由も集計する。

```text
exit
wall
block
lane
edge
unknown
```

## 7. 反復と偏り

```text
sameBlockRepeatRate
maxSameBlockRun
directionHistogram
colorHistogram
dominantDirectionRate
dominantColorRate
```

方向と色の偏りはreview指標として使い、単独ではhard rejectにしない。

## 8. `structureHash`

`boardHash`は色番号、箱ID、盤面反転が変われば別内容になる。大量監査では、見た目だけ違う同型問題を別構造として数えない補助識別子が必要である。

`structureHash`では次を正規化する。

- 箱IDと搬出口IDを除外。
- 搬出口の位置順で色番号を0から振り直す。
- 同色箱を座標順へ並べる。
- `identity`、左右反転、上下反転、180度回転の4形を比較する。
- 辞書順で最小の正規化JSONをSHA-256へ入力する。

含めるもの:

```text
rulesVersion
width / height
箱位置・形状・正規化色
壁
搬出口
一方通行レーン
```

出荷シャッターを含む盤面はP3-04時点では拒否する。

`structureHash`はランキング識別子ではない。公開運用では`puzzleId`と`boardHash`を使う。

## 9. 暫定screening

### hard reject

```text
初期合法操作が0件
初期直行箱が1件以上
```

### review flag

```text
初期合法操作が2件未満
判断手率が25%未満
壁利用率が5%未満
同じ箱の連続率が55%超
一方向の偏りが70%超
一色の偏りが70%超
```

判定:

- `candidate`: hard rejectもreview flagもない。
- `review`: hard rejectはないがreview flagがある。
- `reject`: hard rejectがある。

閾値はP3-04監査用の暫定値であり、P3-05の最終採用条件ではない。

## 10. 1001件監査

実行コマンド:

```bash
npm run audit:p3-04 -- \
  --count 1001 \
  --seed-prefix p3-04-audit-v1 \
  --out-dir audit-output/p3-04
```

出力:

```text
audit.json
candidates.csv
summary.md
audit-output.log
```

専用GitHub Actions:

```text
.github/workflows/p3-04-candidate-audit.yml
```

通常のNode・Browser Gateとは分離し、最大60分とする。結果は30日保持するartifactへ保存する。

## 11. 実行結果

GitHub Actions Run `30236109244`:

```text
1001 candidate quality audit: success
requested: 1001
inspected: 1001
generated: 1001
failed: 0
durationMs: 1,431,425
```

全体:

```text
candidate: 429
review: 0
reject: 572
unique boardHash: 656
unique structureHash: 27
```

hard reject:

```text
initial-direct-exit: 572
```

初期直行箱:

```text
b08c3: 0
b09c3: 1
b10c4: 0
b11c4: 1
b12c5: 0
b13c5: 1
b14c6: 2
```

hard ruleを通った429件に限定すると、一意`structureHash`は3件だけだった。

詳細は次を正本とする。

```text
docs/reports/P3_04_AUDIT_1001_SUMMARY.md
docs/decisions/P3_04_AUDIT_RESULT_DECISION.md
```

## 12. 判定

```text
P3-04監査処理: 合格
P3-03候補品質: 不合格
P3-05への移行: 禁止
次工程: P3-03R
```

P3-03Rでは、全profileの初期直行箱を0件にし、反転・色置換ではない独立構造を増やす。

暫定受け入れ条件:

```text
1001件生成完走
全profileで初期直行箱0
hard rule通過候補の一意structureHash 60件以上
各profileで一意structureHash 5件以上
全件厳密最短20〜35操作
```

## 13. P3-04完了条件

- [x] 初手分岐と初期直行箱を計測した。
- [x] 代表解法上の分岐を計測した。
- [x] 即時詰み代替率を計測した。
- [x] 壁利用率を計測した。
- [x] 反復、色、方向の偏りを計測した。
- [x] `structureHash`を実装した。
- [x] 1001件監査CLIを実装した。
- [x] 専用GitHub Actionsを実装した。
- [x] Node・Browser Gateが成功した。
- [x] 1001件監査jobが成功した。
- [x] 監査summaryをGitHub文書へ固定した。
- [x] 監査結果からP3-03補修が必要と判断した。
- [ ] 人間レビューが完了する。

## 14. 次工程

```text
P3-03R: 生成器v2補修
```

P3-03Rと再監査、P3-05の人間試遊が終わるまで、P3-03候補を公開中のゲームへ接続しない。
