# HAKODASE P3-05 試遊候補パック

## 状態

このファイルは人間試遊前の候補一覧です。候補はまだ公式問題ではありません。

```text
schemaVersion: hakodase.review-pack/1
packVersion: p3-05-review-pack/1.0.0
generatorVersion: route-catalog/3.0.0
candidateCount: 66
optimalSwipes: 20-29
usesLanes: 5
proofModes: {"components":61,"global":5}
```

## profile別

| profile | 箱 | 色 | 厳密最短 | 候補数 |
| --- | ---: | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 | 12 |
| `b09c3` | 9 | 3 | 21 | 12 |
| `b10c4` | 10 | 4 | 24 | 12 |
| `b11c4` | 11 | 4 | 25 | 12 |
| `b12c5` | 12 | 5 | 28 | 8 |
| `b13c5` | 13 | 5 | 29 | 5 |
| `b14c6` | 14 | 6 | 28 | 5 |

## 出力

```text
review-pack.json
playtest-records.json
playtest-sheet.csv
summary.md
```

各候補には、盤面データ、厳密最短、代表解法、生成版、ルール版、boardHash、structureHash、自動品質指標を含めています。

人間の試遊結果は`playtest-records.json`または`playtest-sheet.csv`へ記録します。`accept`には少なくとも1回のクリア、評価5項目、採用理由が必要です。
