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
| G-01 | Git基準整理 | 文書統合済み・設定確認待ち | Pull Request #4。正式PR baseは`main`。既定ブランチと保護設定確認が残る |
| P2-01 | アプリ状態機械 | 統合済み・自動Gate合格 | Pull Request #5 |
| P2-02 | ホーム・名前・モード | 統合済み・自動Gate合格 | Pull Request #6。実機キーボード確認が残る |
| P2-03 | カウントダウン・公式時計 | 統合済み・自動Gate合格 | Pull Request #7 |
| P2-04 | プレイ画面・undo・リタイア・詰み | 統合済み・自動Gate合格 | Pull Request #8。実機操作確認が残る。#9は重複close |
| P2-05 | 結果・再挑戦・共有 | 統合済み・自動Gate合格 | Pull Request #10 |
| P2-06 | Phase 1・2統合ブラウザGate | 自動Gate合格・実機継続 | Pull Request #11。iPhone実機で生成器BLOCKERを検出 |
| P2-06-B1 | 非自明盤面暫定修正 | 統合済み・暫定 | Pull Request #14。4操作固定を8〜12操作の試作盤面へ置換。正式Phase 3ではない |
| P3-01 | 盤面データv2・版管理 | 実装済み・CI/レビュー待ち | JSON契約、意味検証、SHA-256 boardHash、Engine変換、公式profileを実装 |
| P3-02 | 厳密ソルバー拡張 | 未着手 | P3-01統合後に開始。8〜14箱・同色複数箱の性能と正しさ |
| P3-03 | 生成器v2 | 未着手 | 8〜14箱、3〜6色、20〜35操作の候補生成 |
| P3-04 | 品質指標・1000件検査 | 未着手 | 初手分岐、直行箱、壁利用率、誤手・詰み指標を出力 |
| P3-05 | 試遊済み公式問題集 | 未着手 | 自動条件を通した候補を人間試遊し採否記録を残す |
| P3-06 | 本日の出荷 | 未着手 | 検証済み問題集から決定論的に選択 |

## P3-01で追加した契約

### 盤面データ

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
generatorVersion
puzzleId
boardHash: sha256:<64桁hex>
width / height
blocks
walls
gates
lanes
shutters
expectedOptimalSwipes
```

### official profile

```text
7×9
8〜14箱
3〜6色
同色複数箱
expectedOptimalSwipes 20〜35
```

profileは外形条件を検査する。厳密最短値との一致証明はP3-02で行う。

### boardHash

盤面の挙動と初期状態を正規化し、同期SHA-256で識別する。

含める:

```text
schemaVersion / rulesVersion
width / height
blocks / walls / gates / lanes / shutters
```

含めない:

```text
generatorVersion
puzzleId
expectedOptimalSwipes
```

配列順やJSON空白だけではhashを変えない。盤面座標、ID、色、出口、壁、レーン、シャッター、rulesVersionが変わればhashを変える。

### 同色複数箱

- 箱ごとに一意な文字列IDを持つ。
- 同じ色の複数箱を許可する。
- 使用色ごとに搬出口をちょうど1件必要とする。
- 現行Engine形式への変換後も同色箱を保持する。

### 将来ギミック

- lanesは現行`oneway`へ変換可能。
- shuttersは保存・検証だけ定義。
- 現行Engineが未対応のshuttersを黙って無視せず変換時に拒否する。

## P3-01のテスト

局所再現環境:

```text
board data v2 / board hash: 12件成功
```

確認内容:

- SHA-256既知ベクトル。
- 正規化JSONの決定性。
- 8箱・3色・同色複数箱fixture。
- 配列順を変えても同じboardHash。
- provenanceと最短値だけを変えても同じboardHash。
- 座標変更で異なるboardHash。
- 改ざんhashの拒否。
- official profile条件。
- 箱、壁、出口の重複拒否。
- lanesのEngine変換。
- shuttersの明示拒否。
- JSON round-trip。

リポジトリ全体のNode・Browser GateはPull Request作成後に確認する。

## 4操作BLOCKERとの関係

Pull Request #14は公開中の明白な破綻を止める暫定修正である。

```text
4箱
厳密最短8〜12操作
基礎盤面5件
```

P3-01はこの試作盤面を公式問題へ昇格させない。正式問題はP3-02〜P3-05を通過した8〜14箱・20〜35操作の盤面だけとする。

## 残る手動実機Gate

- iPhone 17 Proで複数seedを試遊し、退避・順序判断・箱同士の利用を確認する。
- undo、リタイア、詰み案内を実操作する。
- iPhone SE級、iPhone 11 Pro、iPad Pro 2018を確認する。
- ソフトウェアキーボード、画面ロック、アプリ切替、Web Share、safe area、画面回転を確認する。

## 設定画面で残る確認

1. GitHubの既定ブランチを`main`へ変更する。
2. `main`へPull Request必須、force push禁止などの保護を設定する。

各Pull Requestのbaseは明示的に`main`へ指定する。

## 次の作業

P3-01のNode・Browser Gateとレビューを完了した後、最新`main`から開始する。

```text
P3-02: 8〜14箱・同色複数箱の厳密ソルバー拡張
```
