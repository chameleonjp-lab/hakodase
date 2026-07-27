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
| P3-03 | 生成器v2 | 統合済み・自動Gate合格・品質BLOCKER | Pull Request #17。厳密20〜35操作は達成したがP3-04で初期直行・構造不足を確認 |
| P3-04 | 品質指標・1001件監査 | 自動Gate合格・レビュー待ち | Pull Request #18。1001件完走、Node全194件、3環境Browser Gate成功。P3-03Rが必要 |
| P3-03R | 生成器v2補修 | 未着手 | 初期直行箱0、構造数増加、再監査が必要 |
| P3-05 | 試遊済み公式問題集 | 進行禁止 | P3-03Rと再監査が終わるまで開始しない |
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

## P3-02 完了内容

- 1スライド1コストの厳密幅優先探索。
- 同色箱の交換対称性を使う状態圧縮。
- 決定論的な解法列。
- 解法再生と既存`rules.js`との差分試験。
- ノード、状態、深さ、時間、中断の上限。
- 上限停止時は`optimalSwipes: null`。

## P3-03 完了内容と限界

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

厳密最短、解法再生、盤面データv2、同一seed決定性は自動Gateで確認済みである。

ただし、P3-04で次を確認した。

- 4profileが初期直行箱を必ず持つ。
- hard rule通過候補の構造が3種類しかない。
- 反転と色置換で見かけ上の件数が増えている。

したがってP3-03候補を公式問題へ昇格しない。

## P3-04 実装内容

### 品質指標

```text
初手合法操作
初期可動箱
初期直行箱
代表解法上の分岐と判断手率
代表手以外の代替手
即時詰み代替率
壁利用率
同箱反復
方向偏り
色偏り
```

### 重複識別

- `boardHash`: 盤面データv2の正式内容識別子。
- `structureHash`: 色番号、箱ID、左右・上下反転、180度回転を正規化した監査用識別子。

### 監査基盤

```text
src/core/quality-metrics-v2.js
src/core/candidate-audit-v2.js
scripts/p3-04-candidate-audit.mjs
.github/workflows/p3-04-candidate-audit.yml
```

出力:

```text
audit.json
candidates.csv
summary.md
audit-output.log
```

## 1001件監査結果

GitHub Actions Run:

```text
30236109244
```

Artifact:

```text
hakodase-p3-04-audit-1
ID: 8642009680
digest: sha256:e4e8693941557e1aacea173d0b9b26bf6e74b73ba06503c4f4bdad8c4859ffb9
```

処理結果:

```text
requested: 1001
inspected: 1001
generated: 1001
failed: 0
duration: 約23分51秒
```

品質結果:

```text
candidate: 429
review: 0
reject: 572
unique boardHash: 656
unique structureHash: 27
```

reject理由:

```text
initial-direct-exit: 572
```

profile別の初期直行箱:

```text
b08c3: 0
b09c3: 1
b10c4: 0
b11c4: 1
b12c5: 0
b13c5: 1
b14c6: 2
```

hard rule通過429件の一意`structureHash`:

```text
3
```

正本報告:

```text
docs/reports/P3_04_AUDIT_1001_SUMMARY.md
docs/decisions/P3_04_AUDIT_RESULT_DECISION.md
```

## P3-04自動Gate

1001件専用監査:

```text
Run: 30236109244
1001 candidate quality audit: success
```

最終Node・Browser Gate:

```text
Run: 30237792287
Node tests and diff check: success
Browser gate: success
Node tests: 194
pass: 194
fail: 0
skipped: 0
```

文書だけの後続同期では、1001件監査の再計算を省略する判定を追加した。監査ランタイムの対象ファイルが変わった場合は再実行する。

## P3-04判定

```text
監査処理: 合格
P3-03候補品質: 不合格
P3-05への移行: 禁止
次工程: P3-03R
```

## P3-03R暫定受け入れ条件

```text
1001件生成完走
全profileで初期直行箱0
hard rule通過候補の一意structureHash 60件以上
各profileで一意structureHash 5件以上
全件厳密最短20〜35操作
同一seedの決定性維持
未検証フォールバック禁止
```

60構造は、P3-05で30問以上を人間試遊・選別するための最低2倍の候補数として置く暫定値である。

## 公開版との関係

現在Codebergで遊べる盤面はPull Request #14の4箱・8〜12操作の暫定版である。

P3-03R、再監査、P3-05が完了するまで、P3-03候補を公開中の`generator.js`、本日の出荷、公式ランキングへ接続しない。

## 残る実機・設定確認

- iPhone 17 Proで複数seedを試遊する。
- undo、リタイア、詰み案内を実操作する。
- iPhone SE級、iPhone 11 Pro、iPad Pro 2018を確認する。
- ソフトウェアキーボード、画面ロック、アプリ切替、Web Share、safe area、画面回転を確認する。
- GitHubの既定ブランチを`main`へ変更する。
- `main`のforce push禁止とPull Request必須を確認する。

## 次の作業

Pull Request #18のレビュー・統合後、最新`main`から開始する。

```text
P3-03R: 生成器v2補修
```
