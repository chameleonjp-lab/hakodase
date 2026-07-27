# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は、各作業単位の現在状態を更新する進捗表である。

仕様と完了条件は各v2契約文書と`COMPLETION_PLAN_v2.md`を優先する。

最終更新日: 2026年7月24日

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
| P3-03 | 生成器v2 | 実装済み・CI/レビュー待ち | 8〜14箱、3〜6色、同色複数箱、厳密20〜35操作の候補生成器 |
| P3-04 | 品質指標・1000件検査 | 未着手 | 初手分岐、直行箱、壁利用率、誤手・詰み、反復、偏り、重複 |
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

## P3-03 生成器v2

### 生成版

```text
route-scaffold/2.0.0
```

### profile

| profile | 箱 | 色 | 厳密最短 |
| --- | ---: | ---: | ---: |
| `b08c3` | 8 | 3 | 20 |
| `b09c3` | 9 | 3 | 21 |
| `b10c4` | 10 | 4 | 24 |
| `b11c4` | 11 | 4 | 25 |
| `b12c5` | 12 | 5 | 28 |
| `b13c5` | 13 | 5 | 29 |
| `b14c6` | 14 | 6 | 26 |

箱数8〜14を1箱刻みで覆い、色数3〜6と同色複数箱を含む。

### 生成方式

完全な自由配置ではなく、壁で分離した折れ曲がり経路scaffoldを使用する。

seedから次を決める。

- profile。
- 同型経路間の箱数配分。
- 左右反転、上下反転、180度回転。
- 色置換。

候補ごとに次を実行する。

1. 盤面データv2 `structural`検証。
2. `boardHash`生成。
3. P3-02厳密ソルバー。
4. 最短20〜35操作の確認。
5. profile期待値との一致。
6. 解法再生。
7. `official` profile再検証。

一つでも失敗した候補は返さない。

### 既定上限

```text
maxAttempts: 16
maxNodes: 600,000
maxStates: 600,000
maxDepth: 35
timeoutMs: 15,000
```

上限到達時は盤面、解法、厳密値を返さない。未検証フォールバックを生成しない。

### 再現性

同じseed、profile条件、生成版、ルール版、ソルバー上限では、同じ盤面、`boardHash`、解法、探索件数を返す。

候補`puzzleId`はprofileと`boardHash`から作る。正式採用時はP3-05で運用用IDを発行する。

## P3-03の自動テスト予定

- profileが8〜14箱を覆う。
- 色数3〜6を覆う。
- 全profileに同色複数箱がある。
- 全profileの厳密最短が20〜35操作。
- 全profileが盤面データv2 `official`検証に合格する。
- 全解法を再生できる。
- 同じseedで同じ盤面と解法を返す。
- seed変化でvariantを変えられる。
- 未対応profileを推測生成しない。
- solver上限時に候補を返さない。

## P3-03の限界

P3-03の候補は公式問題ではない。

未確認:

- 初手分岐数。
- 初期直行可能箱数。
- 壁利用率。
- 誤手と詰み。
- 同一操作の反復率。
- 色と方向の偏り。
- 1000件以上での採用率。
- `boardHash`重複率。
- 人が遊んだ時の面白さ。

scaffold、全体反転、色置換だけでは構造上同じ問題になる場合がある。14箱profileには初期直行箱が存在しうる。

P3-04で数値化し、P3-05で人間試遊するまで公式問題へ昇格しない。

## 公開版との関係

現在Codebergで遊べる盤面はPull Request #14の4箱・8〜12操作の暫定版である。

P3-03は公開中の`generator.js`、試作盤面バンク、UIへ接続しない。公開ゲーム開始時に厳密ソルバーを動かさない。

正式問題はP3-04とP3-05を通過後、P3-06で本日の出荷へ接続する。

## 残る実機・設定確認

- iPhone 17 Proで複数seedを試遊する。
- undo、リタイア、詰み案内を実操作する。
- iPhone SE級、iPhone 11 Pro、iPad Pro 2018を確認する。
- ソフトウェアキーボード、画面ロック、アプリ切替、Web Share、safe area、画面回転を確認する。
- GitHubの既定ブランチを`main`へ変更する。
- `main`のforce push禁止とPull Request必須を確認する。

## 次の作業

P3-03のNode・Browser Gateと人間レビュー完了後、最新`main`から開始する。

```text
P3-04: 品質指標と1000件以上の候補検査
```
