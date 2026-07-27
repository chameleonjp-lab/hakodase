# P3-03 生成器v2

## 1. 目的

盤面データv2とP3-02厳密ソルバーを使い、次の外形条件を満たす候補盤面をseedから決定論的に生成する。

```text
盤面: 7×9
箱: 8〜14個
色: 3〜6色
同色複数箱: 必須
厳密最短: 20〜35操作
```

P3-03で生成した盤面は「候補」であり、まだ公式問題ではない。P3-04の品質指標・1000件以上の大量検査と、P3-05の人間試遊を通過した盤面だけを公式問題集へ入れる。

---

## 2. 生成方式

P3-03は、制御不能な完全ランダム配置を採用しない。

最初に、壁で分離した折れ曲がり経路を持つ経路scaffoldを選ぶ。箱は各経路の開始側へ並べ、同色の搬出口を経路終端へ置く。

その後、seedから次を決める。

- 箱数・色数profile。
- 同じ形の経路間での箱数配分。
- 盤面全体の左右反転、上下反転、180度回転。
- 色の置換。

最後にP3-02厳密ソルバーで最短操作数を再計算し、20〜35操作であること、保存した解法を再生できること、盤面データv2の`official` profileを通ることを確認する。

この順序により、同じseedは同じ盤面・解法・`boardHash`を返し、上限内で証明できなかった候補を採用しない。

---

## 3. generatorVersion

```text
generatorVersion: route-scaffold/2.0.0
```

生成規則、profile、経路scaffold、変換規則、候補採用条件を互換性なく変える場合は`generatorVersion`を更新する。

生成版だけが変わり盤面内容が同じ場合、`boardHash`は変えない。

---

## 4. profile

P3-03では箱数8〜14を1箱刻みで覆う。

| profile | 箱 | 色 | 厳密最短 |
| --- | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 |
| `b09c3` | 9 | 3 | 21 |
| `b10c4` | 10 | 4 | 24 |
| `b11c4` | 11 | 4 | 25 |
| `b12c5` | 12 | 5 | 28 |
| `b13c5` | 13 | 5 | 29 |
| `b14c6` | 14 | 6 | 26 |

すべてのprofileに同色箱が複数存在する。

P3-03は上表の検証済み組合せだけを受理する。たとえば14箱・3色のように表へない組合せを推測で作らず、`unsupported-profile`を返す。

組合せの追加は、新しいscaffold、厳密解、性能記録を伴う別変更とする。

---

## 5. 候補作成手順

`generateCandidateBoardV2(options)`は次の順で処理する。

1. seedを32bit値へ変換する。
2. `profileId`、`boxCount`、`colorCount`条件に合うprofileを選ぶ。
3. 試行番号から派生seedを作る。
4. 経路ごとの箱数、盤面変換、色置換を決める。
5. 経路以外の全セルを壁として盤面draftを作る。
6. `structural` profileで盤面データv2へ確定し、`boardHash`を作る。
7. `boardHash`から候補`puzzleId`を作る。
8. P3-02ソルバーで厳密最短と解法列を求める。
9. 解法列を別途再生し、全箱退場を確認する。
10. 最短20〜35操作かつprofile期待値と一致することを確認する。
11. `expectedOptimalSwipes`を設定し、`official` profileで再検証する。
12. 合格候補だけを返す。

`puzzleId`例:

```text
cand-b10c4-<boardHash先頭20桁>
```

同じ盤面内容なら同じ候補IDになる。正式問題集へ採用する際は、P3-05で運用用の正式`puzzleId`を発行する。

---

## 6. 公開API

```text
generateCandidateBoardV2(options)
listGeneratorV2Profiles()
GENERATOR_V2_VERSION
GENERATOR_V2_TARGET
GENERATOR_V2_DEFAULTS
GENERATOR_V2_PROFILES
```

### options

```text
seed
profileId
boxCount
colorCount
maxAttempts
solver
```

### 成功結果

```text
success: true
reason: generated
seed
attempts
boardData
solution
solver
variant
failures
```

`variant`には、profile、盤面変換、経路ごとの箱数、色置換、派生seedを残す。

### 失敗結果

```text
success: false
reason
seed
attempts
failures
boardData: null
solution: []
```

---

## 7. 上限

既定値:

```text
maxAttempts: 16
solver.maxNodes: 600,000
solver.maxStates: 600,000
solver.maxDepth: 35
solver.timeoutMs: 15,000
```

各試行には上限がある。上限到達、時間切れ、深さ超過、未解決の場合、その候補へ厳密値を記録しない。

全試行が失敗した場合は、検証されていないフォールバックを作らず、理由付き失敗を返す。

公開ゲーム開始時にこの生成器と厳密ソルバーを実行してはいけない。P3-05で事前生成した問題集をP3-06から読み込む。

---

## 8. 生成の再現性

同じ次の条件では同じ結果を返す。

```text
seed
profile条件
generatorVersion
rulesVersion
solver上限
```

固定順:

- profile一覧順。
- 盤面変換一覧順。
- seed付き擬似乱数。
- P3-02の箱ID順と方向順。

`Date.now()`をseed省略時の入口として許可するが、保存・報告・再検査する候補ではseedを必ず記録する。

---

## 9. 現段階の限界

P3-03は完全な自由配置生成器ではなく、経路scaffoldをseedで変換する安全な候補生成器である。

未検証事項:

- 初手分岐数が適切か。
- 初期状態から直行できる箱が多すぎないか。
- 壁が実際の解法へ使われているか。
- 誤手が詰みへつながる割合。
- 同じ操作の反復率。
- 色・方向の偏り。
- 1000件以上での`boardHash`重複率。
- 人が遊んで考える価値があるか。

14箱profileでは、経路容量を使うため初期状態から直接退場できる箱が存在しうる。このため、最短操作数だけを根拠に採用してはいけない。

これらはP3-04で数値化し、P3-05で試遊する。

---

## 10. P3-03の対象外

- 公開中エンドレスへの接続。
- 本日の出荷への接続。
- 端末内ランキング条件の変更。
- Supabase、SQL、オンラインランキング。
- 品質点による採否。
- 1000件以上の候補検査。
- 公式問題集。
- 出荷シャッター。
- Three.js/WebGL。

公開中の試作盤面バンクは、このPull Requestでは変更しない。

---

## 11. 完了条件

- [x] 箱数8〜14を1箱刻みで覆うprofileを定義した。
- [x] 色数3〜6を覆った。
- [x] 全profileに同色複数箱を含めた。
- [x] seedで箱配分・盤面変換・色置換を決定した。
- [x] 同じseedで同じ盤面と解法を返す。
- [x] P3-02で厳密最短を再計算する。
- [x] 20〜35操作以外を採用しない。
- [x] 解法再生に失敗した候補を採用しない。
- [x] `official` profileに通る盤面データv2だけを返す。
- [x] 上限停止時に候補盤面を返さない。
- [ ] GitHub ActionsのNode Gateが成功する。
- [ ] Browser Gateが成功する。
- [ ] 人間レビューが完了する。

---

## 12. 次工程

```text
P3-04: 品質指標・1000件以上の候補検査
```

P3-04では、初手分岐数、直行可能箱数、壁利用率、誤手・詰み指標、反復率、偏り、重複を計測し、採用・不採用理由を機械可読な報告として保存する。
