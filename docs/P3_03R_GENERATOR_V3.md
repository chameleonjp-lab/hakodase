# P3-03R 生成器v3

## 1. 目的

P3-04の1001件監査で判明した次の問題を解消する。

```text
初期直行箱: 572 / 1001件
hard rule通過後の一意structureHash: 3件
```

P3-03Rは、8〜14箱・3〜6色・同色複数箱・厳密最短20〜35操作という外形を維持しながら、初期直行をなくし、反転と色置換だけではない独立構造を十分に増やす。

生成した盤面はまだ公式問題ではない。P3-05の人間試遊を通過した盤面だけを公式問題集へ採用する。

## 2. 生成版

```text
generatorVersion: route-catalog/3.0.0
rulesVersion: slide-exit/1
schemaVersion: hakodase.board/2
```

旧版:

```text
route-scaffold/2.0.0
```

経路テンプレート、profileの最短値、選択規則、証明方法が互換性なく変わるため、生成版を更新する。

## 3. 基礎構造カタログ

`src/core/generator-v3-catalog.js`へ、厳密検証対象となる66件の基礎構造を固定する。

| profile | 箱 | 色 | 最短 | テンプレート数 |
| --- | ---: | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 | 12 |
| `b09c3` | 9 | 3 | 21 | 12 |
| `b10c4` | 10 | 4 | 24 | 12 |
| `b11c4` | 11 | 4 | 25 | 12 |
| `b12c5` | 12 | 5 | 28 | 8 |
| `b13c5` | 13 | 5 | 29 | 5 |
| `b14c6` | 14 | 6 | 28 | 5 |

合計:

```text
66テンプレート
各profile 5件以上
```

テンプレートは次を持つ。

```text
id
profileId
counts
expectedOptimalSwipes
routes
route.path
route.gate
route.lanes
```

カタログは圧縮文字列として保存するが、実行時に座標、搬出口、一方通行床へ復元する。圧縮はファイルサイズを減らすためだけに使い、意味を変更しない。

## 4. seedによる決定

同じ次の条件では同じ結果を返す。

```text
seed
profile条件
templateId条件
generatorVersion
rulesVersion
solver上限
```

seedから次を決める。

1. profile。
2. profile内のテンプレート。
3. `identity / mirrorX / mirrorY / rotate180`。
4. 色置換。

反転と色置換は1つの構造を別構造として数えない。P3-04の`structureHash`で同型を除外する。

## 5. 初期直行の禁止

全テンプレートは次を満たす。

```text
initialDirectExitBlockCount = 0
```

生成後に直行箱を見つけて捨て続ける方式ではない。テンプレートの初期配置そのものが直行を作らない。

1001件再監査でも、全profile・全seedで初期直行箱0を確認した。

## 6. 盤面作成

テンプレートを選択した後、次の順で盤面を作る。

1. 経路座標を盤面変換する。
2. 経路開始側へ箱を配置する。
3. 経路終端へ同色搬出口を配置する。
4. 一方通行床を同じ変換で写像する。
5. 経路に含まれないセルを壁にする。
6. 盤面データv2 `structural` profileで確定する。
7. `boardHash`から候補`puzzleId`を作る。
8. 厳密証明済み解法を変換後盤面へ写像する。
9. 解法を実際に再生する。
10. `expectedOptimalSwipes`を設定する。
11. `official` profileで再検証する。

一つでも失敗した候補は返さない。

## 7. 厳密最短の証明

### 7.1 幾何的に分離されたテンプレート

経路間でセルの重複も上下左右の隣接もないテンプレートは、各経路が独立している。

各経路をP3-02厳密ソルバーで解き、各成分の最短操作数を合計する。

```text
全体最短 = 独立成分の厳密最短の総和
```

61テンプレートがこの方式を使う。

### 7.2 経路間に隣接を持つテンプレート

経路間に隣接セルがある場合、独立成分として扱わない。

`b14c6`の5テンプレートは盤面全体を1つの状態空間としてP3-02厳密ソルバーへ渡す。

```text
proofMode: global
optimalSwipes: 28
nodesExpanded: 539,959
```

分離できない盤面へ成分合成を適用しない。

### 7.3 反転・色置換

反転と色置換はルール上の同型変換である。

基礎盤面で厳密に証明した解法の座標、方向、色を同じ変換で写像し、変換後盤面で再生する。

再生失敗時は候補を拒否する。

## 8. 証明キャッシュ

同じテンプレートの基礎証明を、1回の監査処理中で再利用する。

キャッシュするもの:

```text
厳密最短操作数
代表解法
solver計測値
proofMode
```

キャッシュキーはテンプレートIDである。生成版が変わる場合は実行プロセスを分けるか、明示的にキャッシュを消去する。

公開ブラウザでは証明処理もキャッシュ処理も実行しない。

## 9. 公開API

既存の開発APIとの互換性を保つ。

```text
generateCandidateBoardV2(options)
listGeneratorV2Profiles()
GENERATOR_V2_VERSION
```

v3追加API:

```text
GENERATOR_V3_VERSION
listGeneratorV3Templates(profileId?)
clearGeneratorV3ProofCache()
```

`generateCandidateBoardV2`の追加option:

```text
templateId
```

未登録`templateId`は推測生成せず、次を返す。

```text
success: false
reason: unsupported-template
boardData: null
solution: []
```

## 10. 成功結果

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

`variant`:

```text
profileId
templateId
transform
colorPermutation
derivedSeed
usesLanes
```

`solver`へ次を追加する。

```text
proofSource: catalog-template
proofTemplateId
proofReused
proofTransformInvariant
proofMode: components | global
decomposed
componentCount
```

## 11. 失敗と上限

既定上限:

```text
maxAttempts: 16
solver.maxNodes: 600,000
solver.maxStates: 600,000
solver.maxDepth: 35
solver.timeoutMs: 15,000
```

上限到達時は次を厳守する。

```text
success: false
boardData: null
solution: []
```

推定値を厳密最短として保存しない。未検証フォールバックを作らない。

## 12. P3-03R監査条件

1001件監査は次を必須とする。

```text
inspectedCandidateCount >= 1001
generationFailureCount = 0
rejectCount = 0
eligibleUniqueStructureHashCount >= 60
各profileのeligibleUniqueStructureHashes >= 5
```

CLI:

```bash
npm run audit:p3-04 -- \
  --count 1001 \
  --seed-prefix p3-04-audit-v1 \
  --out-dir audit-output/p3-03r \
  --require-p3-03r
```

条件不合格時は終了コードを非0にする。

## 13. 自動検証

Nodeテスト:

- カタログ総数66件。
- 各profileのテンプレート数。
- 全66件の厳密最短20〜35操作。
- 全66件の初期直行箱0。
- 全66件の一意`structureHash`。
- 解法再生。
- 同じseedとtemplateの決定性。
- 証明キャッシュ。
- 未登録templateの拒否。
- P3-03R受け入れ条件。

GitHub Actions:

```text
Node tests and diff check: 199件成功
Browser gate: 成功
1001 candidate P3-03R acceptance audit: 成功
```

## 14. 対象外

- P3-05の人間試遊。
- 正式問題IDの発行。
- 本日の出荷への接続。
- エンドレスへの接続。
- Supabaseランキング。
- 公開ゲーム開始時の生成やソルバー実行。
- Codeberg公開内容の変更。
- 出荷シャッター。

## 15. 完了条件

- [x] 初期直行箱を全profileで0にした。
- [x] 独立構造を66件用意した。
- [x] 各profileで5件以上の構造を用意した。
- [x] 全テンプレートへ厳密最短を証明した。
- [x] 分離できないテンプレートを盤面全体で厳密探索した。
- [x] 全解法を変換後盤面で再生した。
- [x] 同一seed決定性を維持した。
- [x] 未検証フォールバックを禁止した。
- [x] 1001件監査に合格した。
- [x] Node・Browser Gateに合格した。
- [ ] 人間レビューが完了する。

## 16. 次工程

```text
P3-05: 人間試遊と公式問題集
```

P3-05では66構造を母集団として試遊し、30問以上の正式問題集を目標に採否を記録する。
