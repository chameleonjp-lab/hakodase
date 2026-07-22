# P3-01 盤面データv2・版管理

## 1. 目的

HAKODASEの生成器、厳密ソルバー、大量候補検査、公式問題集、ランキングを、同じJSON保存可能な盤面データへ統一する。

P3-01では次を固定する。

- 盤面データの必須フィールド
- schema、rules、generatorの版
- `puzzleId`と`boardHash`の役割分離
- 8〜14箱、3〜6色、同色複数箱を検査する公式profile
- JSON配列順に依存しない正規化
- SHA-256による盤面内容の識別
- 現行GameEngine形式との明示的な変換境界
- 将来の出荷レーンとシャッターを保存できる構造

この作業だけでは生成器、ソルバー性能、1000件検査、公式問題集を完成扱いにしない。

---

## 2. 正式な版

```text
schemaVersion: hakodase.board/2
rulesVersion: slide-exit/1
boardHash: sha256:<64桁の小文字16進数>
```

### schemaVersion

JSONのフィールド構造と型を識別する。

必須フィールドの削除、型変更、意味の互換性を失う構造変更ではschemaVersionを上げる。

### rulesVersion

盤面を同じ操作列で解釈した時の挙動を識別する。

次の変更ではrulesVersionを上げる。

- スライド停止条件
- 退場条件
- 同色出口判定
- レーンまたはシャッターの動作
- 1操作の数え方
- 同じ状態から得られる次状態

### generatorVersion

盤面を作った生成規則を識別する。

同じ盤面内容でgeneratorVersionだけが異なっても、`boardHash`は変えない。

---

## 3. データ形

```json
{
  "schemaVersion": "hakodase.board/2",
  "rulesVersion": "slide-exit/1",
  "generatorVersion": "generator-v2.0.0",
  "puzzleId": "official-2026-001",
  "boardHash": "sha256:...",
  "width": 7,
  "height": 9,
  "blocks": [
    { "id": "b01", "x": 0, "y": 0, "w": 1, "h": 1, "color": 0 },
    { "id": "b02", "x": 2, "y": 0, "w": 1, "h": 1, "color": 0 }
  ],
  "walls": [
    { "x": 1, "y": 1 }
  ],
  "gates": [
    { "id": "g0", "side": "bottom", "line": 0, "color": 0 }
  ],
  "lanes": [],
  "shutters": [],
  "expectedOptimalSwipes": 24
}
```

JSON Schema:

```text
docs/schema/hakodase-board-v2.schema.json
```

JSON Schemaは単純な型と必須項目を検査する。座標重複、色と出口の対応、公式候補条件、`boardHash`整合などは`validateBoardDataV2()`が検査する。

---

## 4. 箱と色

現在の`rulesVersion`では、すべて1×1箱とする。

```text
w = 1
h = 1
color = 0〜5
```

同色の複数箱を正式に許可する。箱は配列indexではなく一意な`id`を持つ。

同じ色の箱は同じ色の搬出口を共有する。使用色ごとに搬出口をちょうど1件必要とする。

公式profileでは次を必須とする。

```text
盤面: 7×9
箱: 8〜14個
色: 3〜6色
同色複数箱: 少なくとも1組
expectedOptimalSwipes: 20〜35
```

箱数が8以上、使用可能色が最大6色なので、正しい公式候補には必ず同色複数箱が含まれる。

---

## 5. 搬出口

搬出口は次で識別する。

```text
id
side: left | right | top | bottom
line
color
```

同じ外周位置へ複数の搬出口を重ねない。

`line`の範囲:

- left/right: `0 <= line < height`
- top/bottom: `0 <= line < width`

未使用色の搬出口を置かない。

---

## 6. 壁、レーン、シャッター

### walls

JSONでは`{x,y}`配列として保存する。

次を禁止する。

- 盤面外
- 重複
- 箱初期位置との重複

### lanes

```text
id
x
y
direction: up | down | left | right
```

現行Engineの`oneway`へ変換できる。壁との重複と同じセルへの複数レーンを禁止する。

### shutters

```text
id
x
y
axis: horizontal | vertical
period: 2〜60
openPhases: 0以上period未満の一意な整数配列
```

P3-01では保存・検証だけを定義する。現行GameEngineはシャッターをまだ実行できない。

`boardDataV2ToRuntime()`は、シャッターを黙って無視せず既定で例外にする。Phase 5でEngine、Solver、Rendererが同じ規則へ対応した後に公開盤面へ使用する。

---

## 7. boardHash

`boardHash`は次の正規化payloadへSHA-256を適用する。

含めるもの:

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

含めないもの:

```text
generatorVersion
puzzleId
boardHash
expectedOptimalSwipes
```

理由:

- `boardHash`は盤面の挙動と初期状態を識別する。
- 出自、公開名、厳密最短値の記録だけが変わっても盤面内容は同じである。
- `expectedOptimalSwipes`が誤って修正された場合に、同じ盤面を別盤面として扱わない。

正規化順:

- blocks: `id`
- walls: `y`, `x`
- gates: `color`, `side`, `line`, `id`
- lanes: `id`
- shutters: `id`
- shutterの`openPhases`: 数値昇順
- オブジェクトkey: 辞書順

配列の保存順や空白差だけでは`boardHash`を変えない。

盤面座標、箱ID、色、出口、壁、レーン、シャッター、rulesVersionが変われば`boardHash`を変える。

---

## 8. puzzleId

`puzzleId`は公開・ランキング・運用上の不変識別子である。

```text
1〜64文字
先頭は英数字
使用可能: 英数字 . _ -
```

規則:

- 同じ`puzzleId`で盤面内容を上書きしない。
- 盤面内容が変わった場合は新しい`puzzleId`を発行する。
- 同じ盤面が別名で重複登録された場合、`boardHash`で検出する。
- ランキングは`puzzleId`とrulesVersionが同じ記録だけを比較する。

---

## 9. 検証profile

### structural

保存可能か、現行ルールとして解釈可能かを検査する。

主な検査:

- 必須版
- ID形式と一意性
- 整数座標と盤面内判定
- 箱、壁、出口の重複
- 使用色ごとの出口数
- 未使用色の出口
- レーン、シャッターの構造
- `boardHash`整合

### official

structuralに加えて、正式候補の外形条件を検査する。

```text
7×9
8〜14箱
3〜6色
同色複数箱
20〜35最短操作
```

`official` profileは`expectedOptimalSwipes`の値域を検査するが、その値が厳密解と一致することまでは証明しない。P3-02の厳密ソルバーで一致を確認する。

---

## 10. 公開API

```text
canonicalBoardPayload(input)
computeBoardHash(input)
normalizeBoardDataV2(input)
validateBoardDataV2(input, options)
materializeBoardDataV2(draft, options)
assertValidBoardDataV2(input, options)
boardDataV2ToRuntime(input, options)
createBoardDataV2FromRuntime(runtimeBoard, metadata, options)
```

### materializeBoardDataV2

ハッシュ未設定の編集用draftを検証し、正規化済み`boardHash`を付け、再帰的にfreezeした正式データを返す。

### boardDataV2ToRuntime

JSON配列を現行形式へ変換する。

```text
walls -> Set("x,y")
lanes -> Map("x,y", direction)
```

### createBoardDataV2FromRuntime

旧盤面や生成器出力をv2へ移行するための境界である。移行後は必ず意味検証と`boardHash`生成を行う。

---

## 11. 破壊的変更とランキング保護

- schema構造の非互換変更ではschemaVersionを上げる。
- ゲーム挙動の非互換変更ではrulesVersionを上げる。
- 生成方法だけの変更ではgeneratorVersionを上げる。
- 既存`puzzleId`の盤面内容を書き換えない。
- 同じ`puzzleId`で異なる`boardHash`を検出した場合は公開・送信を拒否する。
- 公式問題集はJSON読込後に毎回hashを再計算し、保存値と一致しない問題を隔離する。

---

## 12. P3-01の完了条件

- [x] JSON保存可能な盤面データv2を定義した。
- [x] schema/rules/generator版を分離した。
- [x] 同色複数箱を受理する。
- [x] 公式profileで8〜14箱、3〜6色、20〜35操作を検査する。
- [x] 配列順に依存しない正規化を定義した。
- [x] 同期SHA-256 `boardHash`を実装した。
- [x] hash対象・対象外を固定した。
- [x] 現行Engine形式との往復変換を実装した。
- [x] 未対応シャッターを黙って無視しない。
- [x] JSON Schemaを追加した。
- [ ] GitHub ActionsのNode・Browser Gateが成功する。
- [ ] 人間レビューが完了する。

---

## 13. 次工程

```text
P3-02: 8〜14箱・同色複数箱に対応する厳密ソルバーの性能・正しさ
```

P3-02では次を扱う。

- 厳密最短操作数
- 解法列
- 決定論的な解法選択
- ノード数、時間、終了理由
- 同色複数箱を含む8〜14箱fixture
- 状態表現の圧縮
- 実行時ではなく開発時・候補検査時だけソルバーを使用する境界
