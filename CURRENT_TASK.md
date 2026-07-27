# CURRENT_TASK: P3-03 生成器v2

## 目的

P3-01盤面データv2とP3-02厳密ソルバーを使い、8〜14箱・3〜6色・同色複数箱・厳密最短20〜35操作の候補盤面をseedから決定論的に作る。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `00e71c639144674869db2d722bc5404af9992dc6`
- 基準内容: Pull Request #16統合後のP3-02完了地点
- 作業ブランチ: `agent/hakodase-p3-03-generator-v2`
- Pull Request base: `main`
- Pull Request: 作成前

## 今回の一目的

```text
上限付きの候補生成器を実装し、全profileをP3-02で厳密に20〜35操作と証明する。
```

P3-03では品質採点、1000件検査、公式問題集、公開ゲームへの接続を行わない。

## 実装対象

```text
src/core/generator-v2.js
test/generator-v2.test.js
docs/P3_03_GENERATOR_V2.md
docs/decisions/P3_03_GENERATOR_V2_DECISION.md
CURRENT_TASK.md
docs/COMPLETION_STATUS_v2.md
```

## generatorVersion

```text
route-scaffold/2.0.0
```

## 生成外形

```text
盤面: 7×9
箱: 8〜14個
色: 3〜6色
同色複数箱: 必須
厳密最短: 20〜35操作
```

## profile

| profile | 箱 | 色 | 期待厳密最短 |
| --- | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 |
| `b09c3` | 9 | 3 | 21 |
| `b10c4` | 10 | 4 | 24 |
| `b11c4` | 11 | 4 | 25 |
| `b12c5` | 12 | 5 | 28 |
| `b13c5` | 13 | 5 | 29 |
| `b14c6` | 14 | 6 | 26 |

上表にない箱数・色数の組合せを推測で作らず、`unsupported-profile`を返す。

## 生成方式

完全な自由配置ではなく、壁で分離した折れ曲がり経路scaffoldを使用する。

seedから次を決める。

```text
profile
同型経路間の箱数配分
identity / mirrorX / mirrorY / rotate180
色置換
```

経路外セルは壁にする。すべての箱、壁、搬出口を盤面データv2へ変換する。

## 厳密採用手順

1. `structural` profileでdraftを確定する。
2. `boardHash`を計算する。
3. 候補`puzzleId`をprofileとhashから作る。
4. P3-02で厳密最短と解法列を求める。
5. 20〜35操作か検査する。
6. profile期待値と一致するか検査する。
7. 解法列を再生し、全箱退場を確認する。
8. `expectedOptimalSwipes`を設定する。
9. `official` profileで再検証する。
10. 全条件を満たした候補だけ返す。

## 上限

```text
maxAttempts: 16
maxNodes: 600,000
maxStates: 600,000
maxDepth: 35
timeoutMs: 15,000
```

上限到達時は盤面も厳密値も返さない。

```text
success: false
boardData: null
solution: []
```

検証されていないフォールバックを生成しない。

## 公開API

```text
generateCandidateBoardV2(options)
listGeneratorV2Profiles()
GENERATOR_V2_VERSION
GENERATOR_V2_TARGET
GENERATOR_V2_DEFAULTS
GENERATOR_V2_PROFILES
```

成功時は盤面データ、解法列、ソルバー計測値、変換内容を返す。

## 自動検証

追加テスト:

- profile一覧が8〜14箱を1箱刻みで覆う。
- 色数3〜6を覆う。
- 全profileに同色複数箱がある。
- 全profileをP3-02で厳密に解く。
- 全profileが20〜35操作である。
- `official` profileとhash検査に合格する。
- 解法列を再生できる。
- 同じseedで同じ盤面・解法・variantを返す。
- seed変化でvariantと盤面内容を変えられる。
- 未対応profileを推測生成しない。
- solver上限到達時に候補を返さない。

## 完了条件

- [x] 生成器v2を実装した。
- [x] 箱数8〜14を1箱刻みで覆った。
- [x] 色数3〜6を覆った。
- [x] 同色複数箱を全profileに含めた。
- [x] seed付き変換を実装した。
- [x] P3-02厳密ソルバーを採用条件へ接続した。
- [x] 20〜35操作以外を拒否する。
- [x] 解法再生失敗を拒否する。
- [x] `official` profile不合格を拒否する。
- [x] 上限停止時に候補を返さない。
- [ ] リポジトリ全Nodeテストが成功する。
- [ ] Browser Gateが成功する。
- [ ] 人間レビューが完了する。

## 既知の制限

- scaffold方式であり、完全自由配置ではない。
- 反転と色置換は構造上同じ問題になる場合がある。
- 初手分岐、直行箱、壁利用率、誤手、詰み、反復、偏りはまだ採否へ使わない。
- 14箱profileには初期直行箱が存在しうる。
- 1000件での採用率と重複率は未確認。
- 人間試遊は未実施。
- 公開中の試作盤面バンクは変更しない。

## 対象外

```text
P3-04 品質指標と1000件以上の候補検査
P3-05 試遊済み公式問題集
P3-06 本日の出荷
Supabaseランキング
Codeberg公開内容の変更
出荷シャッター
Three.js / WebGL
```

## 次工程

P3-03の自動Gateと人間レビュー完了後、最新`main`から開始する。

```text
P3-04: 初手分岐・直行箱・壁利用率・誤手/詰み指標と1000件検査
```
