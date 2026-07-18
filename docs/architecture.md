# HAKODASE v2 アーキテクチャ

## 正本との関係

この文書は実装構造を説明する。ゲーム仕様と品質条件は次を正本とする。

- [GAME_CONTRACT_v2.md](GAME_CONTRACT_v2.md)
- [SCORE_RANKING_CONTRACT_v2.md](SCORE_RANKING_CONTRACT_v2.md)
- [MOBILE_TOUCH_CONTRACT_v2.md](MOBILE_TOUCH_CONTRACT_v2.md)
- [PERFORMANCE_BUDGET_v2.md](PERFORMANCE_BUDGET_v2.md)
- [EXPERIENCE_CONTRACT_v2.md](EXPERIENCE_CONTRACT_v2.md)
- [P2_01_STATE_MACHINE_v2.md](P2_01_STATE_MACHINE_v2.md)

旧MVPの説明と矛盾する場合は、v2正本を優先する。

## 設計原則

1. ゲームルールはDOM、Canvas、通信へ依存させない。
2. 画面状態と1プレイ状態を分ける。
3. 非同期処理は画面世代または`playId`を確認してから作用させる。
4. 描画は状態を受け取るだけで、ゲーム状態を書き換えない。
5. ランキング保存をGameEngineへ直結させない。
6. Canvas2Dを正式な基本版として残す。

## レイヤー構成

```text
AppController
画面状態と許可遷移
        │
        ├── RunController
        │   playId、開始、クリア、リタイア、無効化、結果の一回性
        │
        ├── GameEngine
        │   盤面、箱位置、swipeCount、distanceCells、undo、クリア判定
        │       ├── rules.js
        │       ├── solver.js
        │       ├── generator.js
        │       └── rng.js
        │
        ├── PointerInput
        │   画面座標から操作要求への変換
        │
        ├── Animation / Renderer
        │   表示位置、入力ロック、Canvas2D描画、演出
        │
        ├── HUD / Screens
        │   DOM表示。P2-02以降で状態ごとに接続
        │
        └── RankingService
            localStorage。Phase 4でRemoteRankingService追加
```

## 依存ルール

### `src/app/`

- DOM、Canvas、localStorage、Supabaseを参照しない。
- `AppController`はGameEngineの内部を知らない。
- `RunController`は結果データを保持できるが、ランキング送信を行わない。

### `src/core/`

- DOM、Canvasへ依存しない。
- GameEngineとSolverは同じルール関数を使う。
- `swipeCount`と`distanceCells`を混同しない。

### `src/render/`

- `frameState`を読み取る。
- 論理位置を変更しない。
- Canvas2D版を残し、将来のThreeRendererは同じゲーム状態を利用する。

### `src/input/`

- Pointer Eventsを操作要求へ変換する。
- `pointercancel`と`lostpointercapture`では操作を確定しない。
- 画面状態や結果保存を直接変更しない。

### `src/services/`

- 保存と通信を分離する。
- 古い通信結果は`playId`確認後にUIへ反映する。

## 画面状態

P2-01で次を定義する。

```text
home
nameConfirm
countdown
playing
result
rules
ranking
```

許可遷移は`src/app/app-state.js`を唯一の正しい表とする。

成功した遷移ごとに`AppController.version`を進める。画面タイマーや遅延処理は開始時のversionを保持し、完了時に現在世代か確認する。

## 1プレイ状態

P2-01で次を定義する。

```text
prepared
playing
cleared
retired
invalidated
```

`RunController.prepare()`ごとに新しい`playId`を発行する。古い`playId`のイベントは現在プレイへ作用できない。

`cleared`、`retired`、`invalidated`は終端状態であり、一つのプレイを二重に確定しない。

## GameEngine

GameEngineは次を管理する。

```text
positions
swipeCount
distanceCells
undoCount
status
startedAt
finalElapsedMs
history
```

- 1回の有効スライドで`swipeCount`を1増やす。
- 通過したマス数を`distanceCells`へ加える。
- 競技経過時間は外部から渡す単調時刻で測る。
- undoは箱位置、操作数、距離を戻すが、経過時間を戻さない。

## P2-01と現行画面の境界

P2-01では状態管理モジュールと単体テストを追加するが、現行`src/main.js`へ本接続しない。

理由は、ホーム、名前、カウントダウン、プレイ、結果のDOMをまだ持たない状態で接続すると、一時的な遷移や例外処理が残り、後続作業で再び壊すためである。

接続は次の順で行う。

```text
P2-02: home / nameConfirm / 3モード選択
P2-03: countdown / GO / 公式時計 / visibility無効化
P2-04: playing / undo / リタイア / 詰み
P2-05: result / 再挑戦 / 共有 / 導線
```

## 非同期処理の規則

- 画面に属する遅延処理は`AppController.version`を確認する。
- プレイに属する処理は`RunController.playId`を確認する。
- ランキング、共有、アニメーション完了、カウントダウンは古い世代なら結果を捨てる。
- 結果確定はRunControllerが成功した場合だけ行う。
- `destroy()`または購読解除でイベントを残さない。

## 描画と入力

- PointerInputは選択、ドラッグ、確定、取消を通知する。
- Animationは経過時間で表示位置を目標へ近づける。
- CanvasRendererは角丸箱、影、グラデーション、記号、出口、パーティクルを描く。
- アニメ中入力は表示完了までロックする。
- 論理座標は整数セルで保持し、表示位置だけを補間する。

## 盤面生成とソルバー

Phase 1時点の生成は旧MVP型であり、公式条件`optimalSwipes >= 20`を満たさない。

Phase 3で次を追加する。

- 複数箱と同色複数箱
- 盤面データv2
- `puzzleId`、`rulesVersion`、`generatorVersion`、`boardHash`
- 厳密な最短操作ソルバー
- 1000件以上の候補検査
- 検証済み公式問題集

## Three.js / WebGL

Three.jsはPhase 6より前の必須作業にしない。

将来追加する場合も、次が必要である。

- カメラと光源
- 立体物の生成と再利用
- ヒット判定
- サイズ変更
- 高解像度負荷制御
- 資源破棄
- WebGLコンテキスト消失と復帰
- Canvas2Dへのフォールバック

Renderer生成箇所を一行変えるだけで完成するとは扱わない。
