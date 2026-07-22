# P3-02 厳密ソルバーv2

## 1. 目的

8〜14箱・3〜6色・同色複数箱を含む盤面データv2について、1スライドを1コストとする厳密最短操作数と再生可能な解法列を求める。

P3-02では次を固定する。

- 厳密探索アルゴリズム
- 同色箱の交換対称性を使った状態圧縮
- 決定論的な解法選択
- ノード数、状態数、最大frontier、処理時間の計測
- 深さ、ノード、状態数、時間、中断の上限
- 解法列の再生検証
- `expectedOptimalSwipes`との一致検査

このソルバーは開発時・候補検査時専用であり、公開ゲームの開始処理、描画ループ、1操作ごとの処理から呼ばない。

---

## 2. 対象ルール

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
```

対応:

- 1×1箱
- 壁
- 同色搬出口
- 一方通行レーン
- 同色複数箱
- 7×9の公式候補

未対応:

- 出荷シャッター
- 時間や手数位相によって変化する盤面
- 255セル以上の盤面

未対応要素を黙って無視せず、探索前に例外として拒否する。

---

## 3. 正確性

探索は深さ順の幅優先探索を使用する。

```text
1スライド = 1コスト
```

深さ`d`の全状態を、深さ`d+1`より先に処理する。最初に発見したクリア状態の深さを厳密最短操作数とする。

ノード上限、状態数上限、時間上限、深さ上限、中断で停止した場合は、`optimalSwipes`を返さない。

```text
solved: false
exact: false
optimalSwipes: null
reason: maxNodes | maxStates | timeout | maxDepth | aborted
```

探索空間を完全に調べて解が存在しない場合だけ、`reason: exhausted`かつ`exact: true`とする。

---

## 4. 状態表現

7×9盤面は63セルなので、各箱の状態を1byteで保持する。

```text
0〜62: 盤面セル
255: 退場済み
```

探索queueでは、箱数と同じ長さの`Uint8Array`を使用する。

盤面の静的情報は探索開始時に次へ変換する。

- 壁: `Uint8Array`
- レーン: `Int8Array`
- 色: `Uint8Array`
- 占有表: 再利用する`Int16Array`
- 色ごとの搬出口lookup

---

## 5. 同色箱の交換対称性

`slide-exit/1`では、同じ色の箱は次の規則上の性質を共有する。

- 形状がすべて1×1
- 同じ搬出口を使用する
- 箱IDは移動判定へ影響しない
- 個別能力を持たない

そのため、同色箱AとBの位置だけを交換した状態は、将来の可解性と最短残り操作数が等しい。

状態keyでは、色ごとに箱位置を数値昇順へ並べる。

```text
color 0 positions sorted
color 1 positions sorted
...
```

探索queueには最初に到達した実際の箱ID配置を保持する。keyだけを交換対称化するため、復元される解法列は元の箱IDで再生できる。

この圧縮は、箱IDや同色箱ごとの能力がゲーム規則へ影響する版では使用してはいけない。その場合は`rulesVersion`を更新し、対称性圧縮を再検討する。

---

## 6. 決定論

同じ盤面、同じoptionでは同じ解法列を返す。

固定順:

1. P3-01の正規化で箱をID順に並べる。
2. 箱indexを昇順に調べる。
3. 方向を`up, down, left, right`の順に調べる。
4. 同じ正規化状態へ複数経路が到達した場合、最初の経路だけを残す。

返す各操作:

```text
blockIndex
blockId
color
from { x, y }
direction
steps
exit
```

---

## 7. 下界と枝刈り

最大深さを超えることが確定した状態だけを除外する。

各残存箱について:

- 現在位置が対応搬出口の行または列に一致: 最低1操作
- 一致しない: 位置合わせと退場で最低2操作

これらを合計した値を下界とする。

この下界は壁や他箱による追加操作を数えないため、実際の残り操作数を超えない。したがって、

```text
depth + lowerBound > maxDepth
```

の状態を除外しても、`maxDepth`以内の解を失わない。

---

## 8. 公開API

```text
solveRuntimeBoardExactV2(runtimeBoard, options)
solveBoardDataV2(boardData, options)
canonicalStateKeyV2(runtimeBoard, positions, options)
verifyExactSolutionV2(runtimeBoard, solution)
validateExpectedOptimalSwipesV2(boardData, options)
```

### solve結果

```text
solved
exact
optimalSwipes
solution
reason
durationMs
nodesExpanded
movesGenerated
uniqueStates
frontierPeak
lowerBound
symmetryReduced
```

### 既定上限

```text
maxNodes: 2,000,000
maxStates: 2,000,000
maxDepth: 40
timeoutMs: 10,000
timeCheckInterval: 1,024
```

候補検査スクリプトは目的に応じて上限を明示する。上限を上げてCIや端末を不安定にしない。

---

## 9. 解法再生

`verifyExactSolutionV2()`は解法列を初期状態から再生する。

検査:

- `blockId`が存在する
- 既に退場済みでない
- `from`が現在位置と一致する
- 移動方向が合法
- `steps`が再計算結果と一致する
- `exit`が再計算結果と一致する
- 最終状態が全箱退場である

保存した解法列や候補報告は、採用前に再生検証する。

---

## 10. P3-02 fixture

次の容量fixtureを自動試験へ追加する。

```text
8箱 / 3色 / 同色複数箱
11箱 / 4色 / 同色複数箱
14箱 / 6色 / 同色複数箱
```

fixtureは一方通行レーンで各箱の合法手を限定し、厳密最短値が箱数と一致する検証専用盤面とする。

これらはソルバーの容量、決定性、同色処理を検証するためのものであり、面白さや公式問題品質を示すものではない。

P3-03以降で生成された20〜35操作候補について、同じソルバーで厳密値を計算する。

---

## 11. 完了条件

- [x] 1スライド1コストの厳密幅優先探索を実装した。
- [x] 同色箱の交換対称性を状態keyへ適用した。
- [x] 決定論的な解法列を返す。
- [x] 解法列の再生検証を実装した。
- [x] `expectedOptimalSwipes`との一致を報告する。
- [x] ノード、状態、時間、深さ、中断の停止理由を返す。
- [x] 上限停止時に最短値を捏造しない。
- [x] 8箱、11箱、14箱fixtureを追加した。
- [ ] GitHub ActionsのNode Gateが成功する。
- [ ] Browser Gateが成功する。
- [ ] 人間レビューが完了する。

---

## 12. 次工程

```text
P3-03: 8〜14箱・3〜6色・同色複数箱の生成器v2
```

P3-03ではソルバーを候補検査に使用し、厳密最短20〜35操作へ到達した盤面だけを次工程へ渡す。ソルバー上限へ到達した候補は不採用とし、推定最短値を保存しない。
