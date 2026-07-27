# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は、各作業単位の現在状態を更新する進捗表である。

仕様と完了条件は各v2契約文書と`COMPLETION_PLAN_v2.md`を優先する。

最終更新日: 2026年7月27日

## 現在地

| ID | 作業 | 状態 | 根拠・残件 |
| --- | --- | --- | --- |
| Phase 0 | v2仕様契約 | 完了 | Pull Request #1 |
| Phase 1 | 中核コードの正しさ | 自動Gate合格・実機待ち | Pull Request #2、P2-06で再検証 |
| G-01 | Git基準整理 | 文書統合済み・設定確認待ち | Pull Request #4。正式PR baseは`main` |
| P2-01 | アプリ状態機械 | 統合済み・自動Gate合格 | Pull Request #5 |
| P2-02 | ホーム・名前・モード | 統合済み・自動Gate合格 | Pull Request #6。実機キーボード確認が残る |
| P2-03 | カウントダウン・公式時計 | 統合済み・自動Gate合格 | Pull Request #7 |
| P2-04 | プレイ画面・undo・リタイア・詰み | 統合済み・自動Gate合格 | Pull Request #8。#9は重複close |
| P2-05 | 結果・再挑戦・共有 | 統合済み・自動Gate合格 | Pull Request #10 |
| P2-06 | Phase 1・2統合ブラウザGate | 自動Gate合格・実機継続 | Pull Request #11 |
| P2-06-B1 | 非自明盤面暫定修正 | 統合済み・暫定 | Pull Request #14。4箱8〜12操作の試作盤面 |
| P3-01 | 盤面データv2・版管理 | 統合済み・自動Gate合格 | Pull Request #15 |
| P3-02 | 厳密ソルバーv2 | 統合済み・自動Gate合格 | Pull Request #16。Node全182件、3環境Browser Gate成功 |
| P3-03 | 生成器v2 | 統合済み・自動Gate合格 | Pull Request #17。8〜14箱、3〜6色、厳密20〜35操作を証明 |
| P3-04 | 品質指標・1001件監査 | 実装中 | 指標、structureHash、監査CLI、専用workflowを追加。CI・1001件結果待ち |
| P3-05 | 試遊済み公式問題集 | 未着手 | 自動条件通過候補を人間試遊し採否を記録 |
| P3-06 | 本日の出荷 | 未着手 | 検証済み問題集から決定論的に選択 |

## P3-01 完了内容

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

`official` profile:

```text
7×9
8〜14箱
3〜6色
同色複数箱
expectedOptimalSwipes 20〜35
```

盤面の挙動と初期状態を正規化し、SHA-256 `boardHash`で識別する。

## P3-02 完了内容

- 1スライド1コストの厳密幅優先探索。
- 同色箱の交換対称性を使う状態圧縮。
- 決定論的な解法列。
- 解法再生と既存`rules.js`との差分試験。
- ノード、状態、深さ、時間、中断の上限。
- 上限停止時は`optimalSwipes: null`。
- 8箱、11箱、14箱fixture。

GitHub Actions:

```text
Node tests and diff check: success
Browser gate: success
Node全182件、失敗0、skip 0
```

## P3-03 完了内容

生成版:

```text
route-scaffold/2.0.0
```

| profile | 箱 | 色 | 厳密最短 |
| --- | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 |
| `b09c3` | 9 | 3 | 21 |
| `b10c4` | 10 | 4 | 24 |
| `b11c4` | 11 | 4 | 25 |
| `b12c5` | 12 | 5 | 28 |
| `b13c5` | 13 | 5 | 29 |
| `b14c6` | 14 | 6 | 26 |

候補ごとに盤面データv2、SHA-256 `boardHash`、P3-02厳密解、20〜35操作、解法再生、`official` profileを検査する。

Pull Request #17の最終Gate:

```text
Node tests and diff check: success
Browser gate: success
Node全189件、失敗0、skip 0
```

P3-03候補はまだ公式問題ではない。scaffold、全体反転、色置換だけでは構造上同じ問題になる場合があり、14箱profileには初期直行箱が存在しうる。

## P3-04 実装内容

### 品質指標

```text
initialLegalActionCount
initialMovableBlockCount
initialDirectExitActionCount
initialDirectExitBlockCount
initialOccupancyRate
branchingByStep
solutionDecisionStepRate
solutionForcedStepRate
offRouteAlternativeCount
immediateDeadEndAlternativeRate
wallUtilizationRate
sameBlockRepeatRate
maxSameBlockRun
dominantDirectionRate
dominantColorRate
```

### 誤手・詰みの範囲

代表最短解法の各状態で代表手以外を1手だけ適用し、未退場箱が残るのに直後の合法操作が0件となるものを`即時詰み`と数える。

数手後の詰み、別の最短解法、最短ではないが解ける手までは区別しない。

### structureHash

`boardHash`とは別に、監査用の構造識別子を追加する。

正規化:

```text
箱IDと搬出口IDを除外
搬出口位置順で色番号を振り直す
同色箱を座標順へ並べる
左右反転・上下反転・180度回転を同一視
```

`structureHash`はランキングや公開問題IDに使用しない。

### 暫定screening

hard reject:

```text
no-initial-legal-action
initial-direct-exit
```

review flag:

```text
low-initial-branching
low-decision-density
low-wall-utilization
high-same-block-repeat
high-direction-bias
high-color-bias
```

判定は`candidate / review / reject`とする。閾値は1001件結果を見るための暫定値であり、P3-05採用条件としてまだ確定しない。

### 1001件監査

```bash
npm run audit:p3-04 -- \
  --count 1001 \
  --seed-prefix p3-04-audit-v1 \
  --out-dir audit-output/p3-04
```

出力:

```text
audit.json
candidates.csv
summary.md
audit-output.log
```

専用workflow:

```text
.github/workflows/p3-04-candidate-audit.yml
```

- 通常のNode・Browser Gateから分離。
- timeout 60分。
- artifact 30日保持。
- rejectやreviewの多さではjobを失敗させない。
- 1001件を最後まで処理し、証拠を保存できたかを処理成功条件とする。

## P3-04で残る確認

- リポジトリ全Nodeテスト。
- `git diff --check`。
- 320×568 WebKit。
- 390×844 WebKit。
- 1280×720 Chromium。
- 1001件専用audit job。
- audit artifactのJSON・CSV・Markdown。
- summaryのGitHub文書化。
- P3-03生成器補修の要否判断。
- 人間レビュー。

## 公開版との関係

現在Codebergで遊べる盤面はPull Request #14の4箱・8〜12操作の暫定版である。

P3-04は公開中の`generator.js`、試作盤面バンク、UIへ接続しない。正式問題はP3-04とP3-05を通過後、P3-06で本日の出荷へ接続する。

## 残る実機・設定確認

- iPhone 17 Proで複数seedを試遊する。
- undo、リタイア、詰み案内を実操作する。
- iPhone SE級、iPhone 11 Pro、iPad Pro 2018を確認する。
- ソフトウェアキーボード、画面ロック、アプリ切替、Web Share、safe area、画面回転を確認する。
- GitHubの既定ブランチを`main`へ変更する。
- `main`のforce push禁止とPull Request必須を確認する。

## 次の作業

1001件監査で構造上のBLOCKERが見つかった場合:

```text
P3-03R: 生成器v2補修
```

監査でP3-05へ渡せる候補が確認された場合:

```text
P3-05: 人間試遊と公式問題集
```
