# CURRENT_TASK: P3-02 厳密ソルバーv2

## 目的

P3-01の盤面データv2を入力として、8〜14箱・3〜6色・同色複数箱を含む盤面の厳密最短操作数と再生可能な解法列を求める。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `ad3e2b285aa2da6e42d425ff32ff7a768f0e8f8c`
- 基準内容: Pull Request #15統合後のP3-01完了地点
- 作業ブランチ: `agent/hakodase-p3-02-exact-solver`
- Pull Request base: `main`
- Pull Request: #16

## 今回の一目的

```text
同色箱の交換対称性を圧縮した厳密幅優先探索を実装し、最短操作数、解法列、計測値、停止理由を確定する。
```

P3-02では盤面生成、品質採点、1000件検査、公式問題集、公開ゲームへの接続を行わない。

## 実装対象

```text
src/core/exact-solver-v2.js
test/exact-solver-v2.test.js
test/exact-solver-v2-rules-parity.test.js
docs/P3_02_EXACT_SOLVER_V2.md
docs/decisions/P3_02_EXACT_SOLVER_V2_DECISION.md
CURRENT_TASK.md
docs/COMPLETION_STATUS_v2.md
```

## 探索契約

```text
1スライド = 1コスト
探索順 = 幅優先
箱順 = P3-01正規化後のID順
方向順 = up, down, left, right
```

最初に発見したクリア状態の深さを厳密最短操作数とする。

## 同色箱の状態圧縮

`slide-exit/1`では同色箱のIDが移動規則へ影響しない。

状態keyは色ごとに箱位置を並べ替えて作成する。

```text
同色箱Aがセル10、Bがセル20
同色箱Aがセル20、Bがセル10
→ 同じ状態key
```

探索queueには実際の箱ID配置を保持するため、返す解法列は`blockId`で再生できる。

## 状態表現

7×9盤面の63セルを1byteで表現する。

```text
0〜62: 盤面セル
255: 退場済み
```

静的情報:

```text
walls: Uint8Array
lanes: Int8Array
colors: Uint8Array
occupancy: Int16Arrayを再利用
gate lookup: color・出口方向別
```

## 安全な下界

残存箱ごとに次を加算する。

```text
搬出口の行・列に一致: 最低1操作
一致しない: 最低2操作
```

`depth + lowerBound > maxDepth`だけを枝刈りする。この下界は実際の残り操作数を超えない。

## 返却値

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

各解法操作:

```text
blockIndex
blockId
color
from { x, y }
direction
steps
exit
```

## 上限と停止理由

既定値:

```text
maxNodes: 2,000,000
maxStates: 2,000,000
maxDepth: 40
timeoutMs: 10,000
timeCheckInterval: 1,024
```

停止理由:

```text
solved
exhausted
maxNodes
maxStates
maxDepth
timeout
aborted
```

上限停止時は次を厳守する。

```text
solved: false
exact: false
optimalSwipes: null
```

推定値を厳密最短として保存しない。

## 解法再生と正本ルール照合

`verifyExactSolutionV2()`で箱ID、開始位置、合法方向、移動マス、退場フラグ、最終全箱退場を検査する。

さらに、ソルバーが返した解法を既存の正本`rules.js`の`applySlide()`でも再生する差分試験を追加した。

確認対象:

- 一方通行レーン。
- 他箱による停止。
- 壁による停止。
- 搬出口からの退場。
- 移動マス数と退場フラグ。

## 容量fixture

```text
8箱 / 3色
11箱 / 4色
14箱 / 6色
```

すべて同色複数箱を含む。fixtureはソルバー容量確認用であり、公式問題や面白さの証拠ではない。

局所再現結果:

```text
8箱: 厳密8操作 / 約48状態
11箱: 厳密11操作 / 約192状態
14箱: 厳密14操作 / 約1,296状態
```

## 自動検証

GitHub Actions Run #32:

```text
Node tests and diff check: success
Browser gate: success
```

確認結果:

- Node全182件成功。
- 失敗0、skip 0。
- `git diff --check`成功。
- P3-02本体テスト12件成功。
- 正本`rules.js`との差分試験2件成功。
- 8箱、11箱、14箱fixture成功。
- 同一盤面の決定的解法を確認。
- 上限停止時に`optimalSwipes: null`を確認。
- 320×568 WebKit成功。
- 390×844 WebKit成功。
- 1280×720 Chromium成功。
- Browser evidence artifact保存成功。

## 完了条件

- [x] 厳密幅優先探索を実装した。
- [x] 同色箱の交換対称性を状態keyへ適用した。
- [x] 決定論的な解法列を返す。
- [x] 解法再生検証を実装した。
- [x] 既存`rules.js`との差分試験を追加した。
- [x] `expectedOptimalSwipes`との一致を報告する。
- [x] ノード・状態・深さ・時間・中断上限を実装した。
- [x] 上限停止時に最短値を返さない。
- [x] 8箱・11箱・14箱fixtureを追加した。
- [x] リポジトリ全Nodeテスト182件が成功した。
- [x] Browser Gateが成功した。
- [ ] 人間レビューが完了する。

## 対象外

```text
P3-03 8〜14箱・3〜6色・20〜35操作の生成器v2
P3-04 初手分岐、直行箱、壁利用率、誤手・詰み指標
1000件以上の候補検査
P3-05 試遊済み公式問題集
P3-06 本日の出荷
Supabaseランキング
出荷シャッターの探索
```

## 次工程

Pull Request #16の人間レビュー・統合後、最新`main`から開始する。

```text
P3-03: 8〜14箱・3〜6色・同色複数箱の生成器v2
```
