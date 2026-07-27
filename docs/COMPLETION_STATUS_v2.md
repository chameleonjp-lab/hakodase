# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は現在の進捗と次のGateを示す。

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
| P2-06-B1 | 非自明盤面暫定修正 | 統合済み・暫定 | Pull Request #14。公開中は4箱8〜12操作の試作盤面 |
| P3-01 | 盤面データv2・版管理 | 統合済み・自動Gate合格 | Pull Request #15 |
| P3-02 | 厳密ソルバーv2 | 統合済み・自動Gate合格 | Pull Request #16 |
| P3-03 | 生成器v2 | 統合済み・品質不合格 | Pull Request #17。P3-04で初期直行・構造不足を確認 |
| P3-04 | 品質指標・1001件監査 | 統合済み | Pull Request #18。旧生成器のBLOCKERを数値化 |
| P3-03R | 生成器v3補修 | 自動Gate合格・レビュー待ち | Pull Request #19。66構造、直行箱0、1001件再監査合格 |
| P3-05 | 試遊済み公式問題集 | 未着手 | #19統合後、66構造を人間試遊する |
| P3-06 | 本日の出荷 | 未着手 | 試遊済み問題集から決定論的に選択する |
| Phase 4 | Supabaseランキング | 未着手 | 実物RPC・表・権限の監査から開始する |
| Phase 5 | 独自ギミック | 未着手 | レーン・シャッターをルール版変更として扱う |
| Phase 6 | 品質保証・正式公開 | 未着手 | 実機、長時間、アクセシビリティ、公開整合を確認する |

## P3-01 盤面データv2

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
boardHash: sha256:<64桁hex>
7×9
8〜14箱
3〜6色
同色複数箱
expectedOptimalSwipes: 20〜35
```

盤面内容を正規化した`boardHash`で識別する。問題名、生成版、記録された最短値だけではhashを変えない。

## P3-02 厳密ソルバー

- 1スライド1コストの幅優先探索。
- 同色箱の交換対称性を圧縮。
- 決定論的な解法列。
- 解法再生と正本`rules.js`との差分試験。
- ノード、状態、深さ、時間、中断の上限。
- 上限停止時は`optimalSwipes: null`。

## P3-03旧生成器の監査結果

旧生成版:

```text
route-scaffold/2.0.0
```

Pull Request #18の1001件監査:

```text
生成成功: 1001
reject: 572
初期直行箱を含む候補: 572
hard rule通過候補: 429
hard rule通過後の一意structureHash: 3
```

この結果により、P3-05へ進まずP3-03Rを実施した。

## P3-03R 生成器v3

生成版:

```text
route-catalog/3.0.0
```

profileと基礎構造:

| profile | 箱 | 色 | 厳密最短 | 構造数 |
| --- | ---: | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 | 12 |
| `b09c3` | 9 | 3 | 21 | 12 |
| `b10c4` | 10 | 4 | 24 | 12 |
| `b11c4` | 11 | 4 | 25 | 12 |
| `b12c5` | 12 | 5 | 28 | 8 |
| `b13c5` | 13 | 5 | 29 | 5 |
| `b14c6` | 14 | 6 | 28 | 5 |

```text
合計: 66構造
各profile: 5構造以上
```

seedからテンプレート、盤面反転、色置換を決定する。反転・色置換だけの違いは`structureHash`で同型として扱う。

## 厳密証明の扱い

- 61構造は経路が幾何的に分離されており、独立成分ごとの厳密最短を合成する。
- `b14c6`の5構造は経路間に隣接があるため、盤面全体を厳密探索する。
- 分離できない盤面へ成分合成を適用しない。
- 反転・色置換後の解法を実際に再生する。

`b14c6`全体探索:

```text
optimalSwipes: 28
nodesExpanded: 539,959
```

## P3-03R 1001件再監査

Audit run:

```text
30262286810
```

Artifact:

```text
hakodase-p3-03r-audit-1
ID: 8651376790
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
12 / 12 / 12 / 12 / 8 / 5 / 5
```

旧版との比較:

| 指標 | 旧版 | v3 |
| --- | ---: | ---: |
| reject | 572 | 0 |
| 初期直行箱を含む候補 | 572 | 0 |
| hard rule通過後の一意構造 | 3 | 66 |
| 一意boardHash | 656 | 912 |

## P3-03R 自動Gate

CI run:

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

対象:

```text
WebKit 320×568
WebKit 390×844
Chromium 1280×720
```

## P3-03Rの判定

```text
実装: 自動Gate合格
初期直行BLOCKER: 解消
構造不足BLOCKER: 解消
1001件受け入れ条件: 合格
人間レビュー: 未完了
```

正本文書:

```text
docs/P3_03R_GENERATOR_V3.md
docs/decisions/P3_03R_GENERATOR_V3_DECISION.md
docs/reports/P3_03R_AUDIT_1001_SUMMARY.md
```

## P3-05開始条件

Pull Request #19をレビューし、`main`へ統合した後に開始する。

P3-05では次を行う。

- 66構造を人間が試遊する。
- 似た問題をまとめ、見た目だけ違う問題を除外する。
- 面白さ、考える必要、誤手の納得感、回復可能性を記録する。
- 代表解法、既知の詰み、採用・不採用理由を残す。
- 30問以上の正式問題集を目標にする。
- 正式`puzzleId`を発行する。

## 公開版との関係

現在Codebergで遊べる盤面はPull Request #14の暫定版である。

P3-03Rは公開中の`generator.js`、本日の出荷、エンドレス、公式ランキングへ接続していない。公開ゲーム開始時に生成器v3や厳密ソルバーを実行しない。

## 残る実機・設定確認

- iPhone 17 Proでの実操作。
- iPhone SE級、iPhone 11 Pro、iPad Pro 2018。
- undo、リタイア、詰み案内。
- ソフトウェアキーボード、画面ロック、アプリ切替。
- Web Share、safe area、画面回転、ズーム抑止。
- GitHubの既定ブランチを`main`へ変更する。
- `main`のforce push禁止とPull Request必須を確認する。

## 次の作業

```text
P3-05: 人間試遊と公式問題集
```
