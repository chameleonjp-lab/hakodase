# CURRENT_TASK: P3-01 盤面データv2・版管理

## 目的

Phase 3の生成器、厳密ソルバー、品質指標、大量候補検査、公式問題集、ランキングが同じ盤面内容を扱えるよう、JSON保存可能な正式データ契約を固定する。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `b580415232c146531a10fd7537e76c5f37e6530a`
- 作業ブランチ: `agent/hakodase-p3-01-board-data-v2`
- Pull Request base: `main`
- Pull Request: #15

## 今回の一目的

```text
盤面データv2、意味検証、正規化、boardHash、現行Engine変換を確定する。
```

P3-01では盤面を生成せず、厳密ソルバーの大規模対応、1000件検査、公式問題集も実施しない。

## 実装対象

```text
src/core/board-hash.js
src/core/board-data-v2.js
docs/schema/hakodase-board-v2.schema.json
docs/P3_01_BOARD_DATA_V2.md
docs/decisions/P3_01_BOARD_DATA_V2_DECISION.md
test/board-hash.test.js
test/board-data-v2.test.js
```

関連進捗文書も同じPull Requestで同期する。

## 正式データ

必須フィールド:

```text
schemaVersion
rulesVersion
generatorVersion
puzzleId
boardHash
width / height
blocks
walls
gates
lanes
shutters
expectedOptimalSwipes
```

正式な版:

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
boardHash: sha256:<64桁hex>
```

## official profile

次を検査する。

```text
盤面: 7×9
箱: 8〜14個
色: 3〜6色
同色複数箱: 必須
厳密最短記録: 20〜35操作
```

`expectedOptimalSwipes`が実際の厳密最短と一致することはP3-02で検査する。

## boardHash

SHA-256の対象:

```text
schemaVersion
rulesVersion
width / height
blocks
walls
gates
lanes
shutters
```

対象外:

```text
generatorVersion
puzzleId
boardHash
expectedOptimalSwipes
```

配列順、オブジェクトkey順、JSON空白だけでは変化させない。

## 同色複数箱

- 箱は一意な文字列`id`を持つ。
- `color`は0〜5。
- 同じ色の複数箱を許可する。
- 使用色ごとに搬出口をちょうど1件必要とする。
- 現行Engine形式へ変換しても同色箱を保持する。

## レーンとシャッター

- レーンは現行`oneway`へ変換する。
- シャッターは保存・構造検査だけ定義する。
- 現行Engineへ未接続のシャッターを黙って無視せず、変換時に例外とする。

## 自動検証

GitHub Actions Run #27:

```text
Node tests and diff check: success
Browser gate: success
```

確認結果:

- Node全168件成功。
- `git diff --check`成功。
- SHA-256既知ベクトル成功。
- board data v2の局所12件成功。
- 320×568 WebKit成功。
- 390×844 WebKit成功。
- 1280×720 Chromium成功。
- Browser evidence artifact保存成功。

P3-01追加検査:

- 正規化JSONの決定性。
- 8箱・3色・同色複数箱のofficial fixture。
- 配列順を変えても同じ`boardHash`。
- 出自と最短値だけを変えても同じ`boardHash`。
- 盤面座標を変えると異なる`boardHash`。
- hash改ざんの拒否。
- official profileの箱数・色数・20〜35操作。
- 箱、壁、搬出口の重複拒否。
- レーンの現行Engine変換。
- 未対応シャッターの拒否。
- JSON round-trip。

## 完了条件

- [x] 盤面データv2を実装した。
- [x] JSON Schemaを追加した。
- [x] `boardHash`を同期SHA-256で実装した。
- [x] structural/official profileを分離した。
- [x] 同色複数箱を受理した。
- [x] 現行Engineとの変換境界を実装した。
- [x] リポジトリ全Nodeテスト168件が成功した。
- [x] Browser Gateが成功した。
- [ ] 人間レビューが完了する。

## 対象外

```text
P3-02 厳密ソルバー拡張
P3-03 生成器v2
P3-04 品質指標と1000件検査
P3-05 試遊済み公式問題集
P3-06 本日の出荷
Supabaseランキング
出荷シャッターの実行規則
```

## 次工程

Pull Request #15の人間レビュー・統合後、最新`main`から次を開始する。

```text
P3-02: 8〜14箱・同色複数箱の厳密ソルバー
```
