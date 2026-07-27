# P3-03R 1001件再監査結果

- 実施日: 2026年7月27日
- 対象Pull Request: #19
- 対象head: `02f63ff31ab925d7c5180cdab5a243973687bfaa`
- Generator: `route-catalog/3.0.0`
- GitHub Actions audit run: `30262286810`
- Artifact: `hakodase-p3-03r-audit-1`
- Artifact ID: `8651376790`
- Artifact digest: `sha256:a055bd834fa7cf41e6775c6c1c18e269797d4979e53798d40957bb94801e40ea`

## 1. 結論

P3-04監査で判明した次の2件を解消した。

```text
旧版の初期直行箱: 572 / 1001件
旧版のhard rule通過後の一意structureHash: 3件
```

再監査結果:

```text
生成成功: 1001 / 1001件
生成失敗: 0件
candidate: 1001件
review: 0件
reject: 0件
初期直行箱: 全件0
hard rule通過後の一意structureHash: 66件
各profileの一意structureHash: 5〜12件
受け入れ判定: passed
```

P3-03Rの自動受け入れ条件をすべて満たした。

ただし、候補はまだ公式問題ではない。P3-05で人間が実際に遊び、面白さ、似た問題、操作時の見やすさ、誤手からの回復、実機での負荷を確認する。

## 2. 実行条件

```text
auditVersion: candidate-quality-audit/1.0.0
generatorVersion: route-catalog/3.0.0
seedPrefix: p3-04-audit-v1
requested: 1001
inspected: 1001
durationMs: 22,418
```

各候補は次を通過した。

- 盤面データv2の構造検査。
- SHA-256 `boardHash`生成。
- P3-02厳密最短証明。
- 最短操作数20〜35の範囲確認。
- 解法列の再生検証。
- 盤面データv2 `official` profile検査。
- P3-04品質指標。
- P3-03R受け入れ条件。

## 3. 全体結果

| 指標 | 結果 |
| --- | ---: |
| 検査件数 | 1001 |
| 生成成功 | 1001 |
| 生成失敗 | 0 |
| `candidate` | 1001 |
| `review` | 0 |
| `reject` | 0 |
| hard rule通過 | 1001 |
| 一意`boardHash` | 912 |
| `boardHash`重複 | 89 |
| `boardHash`一意率 | 91.11% |
| 一意`structureHash` | 66 |
| hard rule通過後の一意`structureHash` | 66 |
| 最短操作数 | 20〜29 |
| 初期直行箱 | 全件0 |
| 初手合法操作 平均 | 4.286 |
| 判断手率 平均 | 90.66% |
| 壁利用率 平均 | 11.32% |
| 即時詰み代替率 平均 | 0.00% |
| 同箱連続率 平均 | 39.97% |
| 最大方向偏り 平均 | 39.28% |
| 最大色偏り 平均 | 40.60% |

## 4. profile別結果

| profile | 箱 | 色 | 最短 | 試行 | 成功 | reject | 一意構造 | 一意board |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 | 143 | 143 | 0 | 12 | 114 |
| `b09c3` | 9 | 3 | 21 | 143 | 143 | 0 | 12 | 112 |
| `b10c4` | 10 | 4 | 24 | 143 | 143 | 0 | 12 | 130 |
| `b11c4` | 11 | 4 | 25 | 143 | 143 | 0 | 12 | 136 |
| `b12c5` | 12 | 5 | 28 | 143 | 143 | 0 | 8 | 139 |
| `b13c5` | 13 | 5 | 29 | 143 | 143 | 0 | 5 | 139 |
| `b14c6` | 14 | 6 | 28 | 143 | 143 | 0 | 5 | 142 |

全profileで次を満たした。

```text
initialDirectExitBlockCount = 0
eligibleUniqueStructureHashes >= 5
```

## 5. 旧版との比較

| 指標 | `route-scaffold/2.0.0` | `route-catalog/3.0.0` |
| --- | ---: | ---: |
| 生成成功 | 1001 | 1001 |
| reject | 572 | 0 |
| 初期直行箱を含む候補 | 572 | 0 |
| hard rule通過候補 | 429 | 1001 |
| hard rule通過後の一意構造 | 3 | 66 |
| 全体の一意boardHash | 656 | 912 |
| P3-03R受け入れ | 不合格 | 合格 |

新版は初期直行をなくし、色置換や反転だけではない66件の基礎構造を持つ。

## 6. 厳密証明

全テンプレートはP3-02の厳密ソルバーで証明する。

- 幾何的に分離された61テンプレートは、独立した経路ごとの厳密解を合成する。
- 経路間に隣接セルを持つ`b14c6`の5テンプレートは、盤面全体を単一状態空間として厳密探索する。

`b14c6`全体探索の計測値:

```text
optimalSwipes: 28
nodesExpanded: 539,959
uniqueStates: 539,969前後
```

分離できない盤面を経路ごとの推定値だけで採用しない。

全候補のソルバー計測:

```text
nodesExpanded min: 51
nodesExpanded max: 539,959
nodesExpanded mean: 77,204.461
durationMs min: 0.571
durationMs max: 4,242.963
durationMs mean: 593.332
```

## 7. 自動Gate

GitHub Actions CI run `30262286867`:

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

1001件監査run `30262286810`:

```text
1001 candidate P3-03R acceptance audit: success
acceptance.passed: true
acceptance.failures: []
```

## 8. 受け入れ条件との照合

| 条件 | 結果 |
| --- | --- |
| 1001件を検査する | 合格: 1001件 |
| 生成失敗0 | 合格: 0件 |
| hard reject 0 | 合格: 0件 |
| 通過後の一意構造60件以上 | 合格: 66件 |
| 各profileで一意構造5件以上 | 合格: 5〜12件 |
| 全件20〜35操作 | 合格: 20〜29操作 |
| 同一seedで同一結果 | 自動テスト合格 |
| 未検証フォールバック禁止 | 維持 |

## 9. 残る制限

- `immediateDeadEndAlternativeRate`は1手先の即時詰みだけを測る。数手後の詰みは未評価。
- 66構造は機械的に異なるが、体感として十分に異なるかは未確認。
- `candidate`は公式採用を意味しない。
- 公開ゲームでは生成器や厳密ソルバーを実行しない。
- Codeberg公開版はこのPull Requestでは変更しない。

## 10. 判定

```text
P3-03R実装: 自動Gate合格
1001件再監査: 合格
P3-04のBLOCKER: 解消
次工程: P3-05 人間試遊と公式問題集
```

P3-05では66構造を母集団として試遊し、30問以上の正式問題集を目標に採否を記録する。
