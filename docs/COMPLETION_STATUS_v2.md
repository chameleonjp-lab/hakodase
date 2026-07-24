# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は、各作業単位の現在状態を更新する進捗表である。

仕様と完了条件は各v2契約文書と`COMPLETION_PLAN_v2.md`を優先する。

最終更新日: 2026年7月22日

## 現在地

| ID | 作業 | 状態 | 根拠・残件 |
| --- | --- | --- | --- |
| Phase 0 | v2仕様契約 | 完了 | Pull Request #1で統合済み |
| Phase 1 | 中核コードの正しさ | 自動Gate合格・実機待ち | Pull Request #2。P2-06でNode・ブラウザ回帰を再検証 |
| G-01 | Git基準整理 | 文書統合済み・設定確認待ち | Pull Request #4。正式PR baseは`main` |
| P2-01 | アプリ状態機械 | 統合済み・自動Gate合格 | Pull Request #5 |
| P2-02 | ホーム・名前・モード | 統合済み・自動Gate合格 | Pull Request #6。実機キーボード確認が残る |
| P2-03 | カウントダウン・公式時計 | 統合済み・自動Gate合格 | Pull Request #7 |
| P2-04 | プレイ画面・undo・リタイア・詰み | 統合済み・自動Gate合格 | Pull Request #8。実機操作確認が残る。#9は重複close |
| P2-05 | 結果・再挑戦・共有 | 統合済み・自動Gate合格 | Pull Request #10 |
| P2-06 | Phase 1・2統合ブラウザGate | 自動Gate合格・実機継続 | Pull Request #11 |
| P2-06-B1 | 非自明盤面暫定修正 | 統合済み・暫定 | Pull Request #14。4操作固定を8〜12操作の試作盤面へ置換 |
| P3-01 | 盤面データv2・版管理 | 統合済み・自動Gate合格 | Pull Request #15。JSON契約、意味検証、SHA-256 boardHash、Engine変換、official profile |
| P3-02 | 厳密ソルバーv2 | 実装済み・自動Gate合格・レビュー待ち | Pull Request #16。Node全182件と3環境Browser Gate成功。人間レビューが残る |
| P3-03 | 生成器v2 | 未着手 | 8〜14箱、3〜6色、20〜35操作の候補生成 |
| P3-04 | 品質指標・1000件検査 | 未着手 | 初手分岐、直行箱、壁利用率、誤手・詰み指標を出力 |
| P3-05 | 試遊済み公式問題集 | 未着手 | 自動条件を通した候補を人間試遊し採否記録を残す |
| P3-06 | 本日の出荷 | 未着手 | 検証済み問題集から決定論的に選択 |

## P3-01完了地点

正式データ:

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
generatorVersion
puzzleId
boardHash: sha256:<64桁hex>
width / height
blocks / walls / gates / lanes / shutters
expectedOptimalSwipes
```

official profile:

```text
7×9
8〜14箱
3〜6色
同色複数箱
expectedOptimalSwipes 20〜35
```

`boardHash`は盤面の挙動と初期状態を正規化したSHA-256で識別する。配列順、JSON空白、生成版、問題名、記録された最短値だけでは変化しない。

## P3-02で追加した厳密ソルバー

### 探索

```text
1スライド = 1コスト
深さ順の幅優先探索
箱順 = 正規化済みID順
方向順 = up, down, left, right
```

最初に発見したクリア状態の深さを厳密最短操作数とする。

### 同色箱の交換圧縮

同じ色の箱は現行`slide-exit/1`で個別能力を持たず、同じ搬出口を共有する。

状態keyでは色ごとの位置を数値昇順へ並べ、同色箱のIDだけが交換された状態を重複として除外する。探索queueには実際の箱ID配置を残すため、返却解法は`blockId`で再生できる。

### 状態表現

```text
0〜62: 7×9盤面のセル
255: 退場済み
```

箱位置を`Uint8Array`、壁を`Uint8Array`、レーンを`Int8Array`、占有表を再利用`Int16Array`で保持する。

### 安全な下界

各残存箱について、搬出口の行・列に一致していれば最低1操作、不一致なら最低2操作として合計する。

```text
depth + lowerBound > maxDepth
```

だけを枝刈りする。

### 結果と停止理由

返却値:

```text
solved / exact / optimalSwipes / solution / reason
durationMs / nodesExpanded / movesGenerated
uniqueStates / frontierPeak / lowerBound / symmetryReduced
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

上限停止時は`optimalSwipes: null`とし、推定値を厳密値として保存しない。

### 解法再生と正本ルール照合

`verifyExactSolutionV2()`は、箱ID、開始位置、合法方向、移動マス、退場、最終クリアを再計算する。

`validateExpectedOptimalSwipesV2()`は盤面データの記録値と実測厳密値の一致を返す。

ソルバーのtyped-array規則が既存`rules.js`からずれないよう、返却解法を正本`applySlide()`でも再生する差分試験を追加した。

照合対象:

- 一方通行レーン。
- 他箱による停止。
- 壁による停止。
- 搬出口退場。
- 移動マス数と退場フラグ。

## P3-02容量fixture

```text
8箱 / 3色 / 同色複数箱
11箱 / 4色 / 同色複数箱
14箱 / 6色 / 同色複数箱
```

局所再現結果:

```text
8箱: 8操作 / 約48状態
11箱: 11操作 / 約192状態
14箱: 14操作 / 約1,296状態
```

これらは容量と正しさのfixtureであり、20〜35操作の公式問題や面白さの証拠ではない。

## P3-02自動Gate

GitHub Actions Run #32:

```text
Node tests and diff check: success
Browser gate: success
```

- Node全182件成功。
- 失敗0、skip 0。
- `git diff --check`成功。
- P3-02本体テスト12件成功。
- 既存`rules.js`との差分試験2件成功。
- 8箱、11箱、14箱fixture成功。
- 同一盤面で同じ解法列と探索件数を確認。
- `maxNodes`、`maxDepth`、`timeout`、`AbortSignal`停止を確認。
- 上限停止時に`optimalSwipes: null`を確認。
- 改ざん解法の再生拒否を確認。
- 320×568 WebKit成功。
- 390×844 WebKit成功。
- 1280×720 Chromium成功。
- Browser evidence artifact保存成功。

## P3-02で残る確認

- 人間レビュー。
- Pull Request #16の統合。

## 正式問題までの残作業

```text
P3-03
8〜14箱
3〜6色
同色複数箱
厳密最短20〜35操作の候補生成

P3-04
初手分岐数
直行可能箱数
壁利用率
誤手・詰み指標
1000件以上の候補検査

P3-05
人間による試遊
採用・不採用理由
代表解法
既知の詰み方
正式問題集
```

## 4操作BLOCKERとの関係

Pull Request #14の4箱・8〜12操作盤面は暫定公開版である。

P3-02はその試作盤面を公式問題へ昇格させない。正式問題はP3-03〜P3-05を通過し、盤面データv2、厳密最短、品質指標、1000件検査、人間試遊の証拠を持つものだけとする。

## 残る実機・設定確認

- iPhone 17 Proで複数seedを試遊する。
- undo、リタイア、詰み案内を実操作する。
- iPhone SE級、iPhone 11 Pro、iPad Pro 2018を確認する。
- ソフトウェアキーボード、画面ロック、アプリ切替、Web Share、safe area、画面回転を確認する。
- GitHubの既定ブランチを`main`へ変更する。
- `main`のforce push禁止とPull Request必須を確認する。

## 次の作業

Pull Request #16の人間レビュー・統合後、最新`main`から開始する。

```text
P3-03: 8〜14箱・3〜6色・同色複数箱の生成器v2
```
