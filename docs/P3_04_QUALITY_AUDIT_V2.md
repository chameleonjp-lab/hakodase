# P3-04 品質指標と1000件以上の候補検査

## 1. 目的

P3-03生成器が返す候補を、厳密最短操作数だけで公式問題候補へ進めない。

P3-04では、盤面を考える必要があるか、壁と箱が実際に制約として働くか、単調な反復や初期直行が残っていないかを数値化し、1000件以上の監査記録を残す。

この工程で行うこと:

- 初手分岐数。
- 初期状態から直行退場できる箱数。
- 代表最短解法で使われる壁の割合。
- 代表手以外の代替手と、直後に合法手0件となる即時詰み指標。
- 同じ箱を連続して動かす割合。
- 色と方向の偏り。
- `boardHash`重複。
- 色番号、箱ID、反転を除いた構造同型重複。
- 1001件の候補監査。

人が遊んだ時の面白さはP3-05で確認する。P3-04の自動結果だけで公式問題へ昇格しない。

---

## 2. 対象

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
generatorVersion: route-scaffold/2.0.0
```

対象profile:

| profile | 箱 | 色 | 厳密最短 |
| --- | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 |
| `b09c3` | 9 | 3 | 21 |
| `b10c4` | 10 | 4 | 24 |
| `b11c4` | 11 | 4 | 25 |
| `b12c5` | 12 | 5 | 28 |
| `b13c5` | 13 | 5 | 29 |
| `b14c6` | 14 | 6 | 26 |

監査はprofileを順番に選び、1001件を検査する。同じseed prefix、候補数、生成版、ルール版では同じseed列を使用する。

---

## 3. 初期状態の指標

### initialLegalActionCount

初期状態で実行可能な`箱 × 方向`の総数。

同じ箱が2方向へ動ける場合は2件と数える。

### initialMovableBlockCount

初期状態で1方向以上へ動ける箱の数。

### initialDirectExitActionCount

初手で即座に搬出口から退場する操作の数。

### initialDirectExitBlockCount

初手で即座に退場できる箱の数。同じ箱が複数方向から退場できても1箱と数える。

P3-04のhard ruleでは、初期直行箱を0件とする。1件以上あれば`initial-direct-exit`でrejectする。

### initialOccupancyRate

```text
箱数 / 壁ではない盤面セル数
```

盤面全体ではなく、実際に使えるセルに対する占有率を示す。

---

## 4. 代表最短解法上の分岐

P3-02が返した決定論的な代表最短解法を初期状態から再生する。

各手の直前に全合法操作を数える。

- `branchingByStep`: 各手の合法操作数。
- `solutionAverageBranching`: 解法全体の平均合法操作数。
- `solutionMaxBranching`: 最大合法操作数。
- `solutionDecisionStepCount`: 合法操作が2件以上ある手数。
- `solutionForcedStepCount`: 合法操作が1件だけの手数。
- `solutionDecisionStepRate`: 判断手数 / 最短操作数。
- `solutionForcedStepRate`: 強制手数 / 最短操作数。

代表解法が1本であることと、最短解が1通りであることは同じではない。P3-04は全最短解法数を数えない。

---

## 5. 誤手・詰み指標

代表最短解法の各状態で、代表手以外の合法操作を1手だけ適用する。

- `offRouteAlternativeCount`: 代表手以外の合法操作総数。
- `offRouteAlternativeRate`: 全合法操作に占める代表手以外の割合。
- `immediateDeadEndAlternativeCount`: 代替手の直後、未退場箱が残るのに合法操作が0件となる数。
- `immediateDeadEndAlternativeRate`: 即時詰み数 / 代替手総数。

これは1手先だけを見る軽量指標である。数手後に詰む操作、最短から外れるが解ける操作、別の最短解法へ入る操作は区別しない。

完全な詰み率と呼ばず、`即時詰み代替率`として扱う。

---

## 6. 壁利用率

壁のうち、壁ではないセルへ上下左右で隣接するものを`active wall`とする。

代表最短解法で箱が停止した直後、その進行方向の次セルが壁なら、その壁を使用済みと数える。

```text
wallUtilizationRate = 代表解法で使った一意な壁 / active wall
```

同じ壁へ複数回停止しても1件と数える。

追加で停止理由を集計する。

```text
exit
wall
block
lane
edge
unknown
```

壁利用率は代表解法上の値であり、代替手の制約として有効な壁までは数えない。

---

## 7. 反復と偏り

### sameBlockRepeatRate

隣り合う2操作で同じ箱を動かした回数を、比較可能な操作間数で割る。

### maxSameBlockRun

同じ箱を連続して動かした最大回数。

### dominantDirectionRate

最も多い方向の操作数を、最短操作数で割る。

### dominantColorRate

最も多く操作した色の操作数を、最短操作数で割る。

方向と色の偏りは、盤面変換によって見かけ上変わる場合がある。候補の単調さを探すreview指標として使い、単独ではhard rejectにしない。

---

## 8. structureHash

`boardHash`は色番号、箱ID、盤面反転が変われば別内容として扱う。大量監査では、見た目だけ違う同型問題を別構造として数えない補助識別子が必要である。

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

出荷シャッターはP3-04時点で未対応のため、含む盤面はstructureHash計算前に拒否する。

`structureHash`はランキング識別子ではない。公式運用では引き続き`puzzleId`と`boardHash`を使用する。

---

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

閾値はP3-04監査結果を読むための暫定値である。監査結果を見ずに公式採用条件として固定しない。

---

## 10. 1001件監査

実行コマンド:

```bash
npm run audit:p3-04 -- \
  --count 1001 \
  --seed-prefix p3-04-audit-v1 \
  --out-dir audit-output/p3-04
```

各候補はP3-03生成器を通るため、P3-02の厳密解、20〜35操作、解法再生、盤面データv2 `official`検証を毎回通過する。

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

通常のNode・Browser Gateとは分離し、最大60分の専用jobとする。結果は30日保持するartifactへ保存する。

---

## 11. 監査の成功条件

処理成功:

- 1001件を最後まで検査する。
- 生成成功数と生成失敗数の合計が1001件になる。
- 途中例外で報告を失わない。
- JSON、CSV、Markdownを保存する。
- `boardHash`と`structureHash`の重複を別々に集計する。
- profile別集計を残す。

品質合格とは別である。rejectやreviewが多くても、正しく発見して報告できれば監査処理自体は成功とする。

---

## 12. P3-04完了条件

- [x] 初手分岐と初期直行箱を計測する。
- [x] 代表解法上の分岐を計測する。
- [x] 即時詰み代替率を計測する。
- [x] 壁利用率を計測する。
- [x] 反復、色、方向の偏りを計測する。
- [x] `structureHash`を実装する。
- [x] 1001件監査CLIを実装する。
- [x] 専用GitHub Actionsを実装する。
- [ ] Node・Browser Gateが成功する。
- [ ] 1001件監査jobが成功する。
- [ ] 監査summaryをGitHub文書へ固定する。
- [ ] 監査結果からP3-03補修の要否を判断する。
- [ ] 人間レビューが完了する。

---

## 13. 次工程

監査結果に構造上のBLOCKERがある場合:

```text
P3-03R: 生成器v2補修
```

候補群がP3-05へ渡せる場合:

```text
P3-05: 人間試遊と公式問題集
```

P3-04完了前に公開中のゲームへP3-03候補を接続しない。
