# CURRENT_TASK: P3-03R 生成器v3補修

## 目的

P3-04の1001件監査で確認した次のBLOCKERを解消する。

```text
初期直行箱: 572 / 1001件
hard rule通過後の一意structureHash: 3件
```

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `f5695b08863ba8c3319b9fb3a5c93f9c7e1aa04f`
- 基準内容: Pull Request #18統合後のP3-04完了地点
- 作業ブランチ: `agent/hakodase-p3-03r-generator-v3`
- Pull Request base: `main`
- Pull Request: #19
- 実装head: `02f63ff31ab925d7c5180cdab5a243973687bfaa`

## 今回の一目的

```text
全profileの初期直行箱を0にし、66件の独立構造を持つ生成器v3を実装し、1001件再監査へ合格する。
```

P3-05の人間試遊、公式問題集、公開ゲームへの接続、Supabaseランキングは今回実施しない。

## 生成版

```text
旧: route-scaffold/2.0.0
新: route-catalog/3.0.0
```

## 実装対象

```text
src/core/generator-v3-catalog.js
src/core/generator-v3-proof.js
src/core/generator-v2.js
src/core/candidate-audit-v2.js
scripts/p3-04-candidate-audit.mjs
test/generator-v3-catalog.test.js
test/candidate-audit-v2.test.js
.github/workflows/p3-04-candidate-audit.yml
docs/P3_03R_GENERATOR_V3.md
docs/decisions/P3_03R_GENERATOR_V3_DECISION.md
docs/reports/P3_03R_AUDIT_1001_SUMMARY.md
CURRENT_TASK.md
docs/COMPLETION_STATUS_v2.md
```

一時的なpayloadファイルと適用workflowはすべて削除済みである。

## 基礎構造

| profile | 箱 | 色 | 最短 | 構造数 |
| --- | ---: | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 | 12 |
| `b09c3` | 9 | 3 | 21 | 12 |
| `b10c4` | 10 | 4 | 24 | 12 |
| `b11c4` | 11 | 4 | 25 | 12 |
| `b12c5` | 12 | 5 | 28 | 8 |
| `b13c5` | 13 | 5 | 29 | 5 |
| `b14c6` | 14 | 6 | 28 | 5 |

```text
合計構造: 66
全profile: 5構造以上
```

## 厳密証明

61構造は経路間に重複・隣接がなく、独立成分ごとにP3-02で厳密証明する。

`b14c6`の5構造は経路間に隣接があるため、盤面全体をP3-02で探索する。

```text
proofMode: components | global
```

`b14c6`全体探索:

```text
optimalSwipes: 28
nodesExpanded: 539,959
```

反転と色置換後は、解法の座標、方向、色を同じ変換で写像し、変換後盤面で再生する。

## 1001件再監査

GitHub Actions audit run:

```text
30262286810
```

Artifact:

```text
name: hakodase-p3-03r-audit-1
id: 8651376790
digest: sha256:a055bd834fa7cf41e6775c6c1c18e269797d4979e53798d40957bb94801e40ea
```

結果:

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

profile別の一意構造:

```text
b08c3: 12
b09c3: 12
b10c4: 12
b11c4: 12
b12c5: 8
b13c5: 5
b14c6: 5
```

## 自動Gate

GitHub Actions CI run:

```text
30262286867
```

結果:

```text
Node tests and diff check: success
Browser gate: success
Node tests: 199
pass: 199
fail: 0
skipped: 0
```

ブラウザ対象:

```text
WebKit 320×568
WebKit 390×844
Chromium 1280×720
```

## 受け入れ条件

- [x] 1001件を検査した。
- [x] 生成失敗0件。
- [x] hard reject 0件。
- [x] 全profileで初期直行箱0件。
- [x] hard rule通過後の一意構造60件以上。実測66件。
- [x] 各profileで一意構造5件以上。
- [x] 全件の厳密最短が20〜35操作。実測20〜29操作。
- [x] 同一seedの決定性を維持した。
- [x] 未検証フォールバックを追加していない。
- [x] Node・Browser Gateが成功した。
- [ ] 人間レビューが完了する。

## 正本文書

```text
docs/P3_03R_GENERATOR_V3.md
docs/decisions/P3_03R_GENERATOR_V3_DECISION.md
docs/reports/P3_03R_AUDIT_1001_SUMMARY.md
```

## 公開版との関係

Codeberg公開版、現行`generator.js`、本日の出荷、公式ランキングは変更していない。

生成器v3と厳密ソルバーは開発時だけ使用する。公開ブラウザで1001件監査や厳密探索を実行しない。

## 次工程

Pull Request #19の人間レビュー・統合後、最新`main`から開始する。

```text
P3-05: 人間試遊と公式問題集
```

66構造を母集団として試遊し、30問以上の正式問題集を目標に採否理由を記録する。
