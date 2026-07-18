# HAKODASE v2 アーキテクチャ

## 正本との関係

この文書は実装構造を説明する。ゲーム仕様と品質条件は次を正本とする。

- [GAME_CONTRACT_v2.md](GAME_CONTRACT_v2.md)
- [SCORE_RANKING_CONTRACT_v2.md](SCORE_RANKING_CONTRACT_v2.md)
- [MOBILE_TOUCH_CONTRACT_v2.md](MOBILE_TOUCH_CONTRACT_v2.md)
- [PERFORMANCE_BUDGET_v2.md](PERFORMANCE_BUDGET_v2.md)
- [EXPERIENCE_CONTRACT_v2.md](EXPERIENCE_CONTRACT_v2.md)
- [P2_01_STATE_MACHINE_v2.md](P2_01_STATE_MACHINE_v2.md)
- [P2_02_HOME_NAME_MODES_v2.md](P2_02_HOME_NAME_MODES_v2.md)

旧MVPの説明と矛盾する場合は、v2正本を優先する。

## 設計原則

1. ゲームルールはDOM、Canvas、保存、通信へ依存させない。
2. 画面状態と1プレイ状態を分ける。
3. 名前やモードの規則と、端末保存を分ける。
4. 非同期処理は画面世代または`playId`を確認してから作用させる。
5. 描画は状態を受け取るだけで、ゲーム状態を書き換えない。
6. ランキング保存をGameEngineへ直結させない。
7. Canvas2Dを正式な基本版として残す。

## レイヤー構成

```text
index.html / styles/main.css
画面要素と見た目
        │
        ▼
src/main.js
DOM配線、各層の統合、requestAnimationFrame
        │
        ├── src/app/
        │   ├── app-state.js
        │   │   画面状態と許可遷移
        │   ├── app-controller.js
        │   │   画面状態、version、購読
        │   ├── run-controller.js
        │   │   playId、開始、クリア、リタイア、無効化、一回性
        │   ├── modes.js
        │   │   daily / endless / practiceの規則
        │   └── player-name.js
        │       名前の正規化、20文字制限、入力検査
        │
        ├── src/services/
        │   ├── player-name-store.js
        │   │   プレイヤー名の端末内保存
        │   └── ranking.js
        │       端末内記録。Phase 4でRemoteRankingServiceを追加
        │
        ├── src/core/
        │   ├── engine.js
        │   │   盤面、位置、操作数、距離、undo、クリア
        │   ├── rules.js
        │   ├── solver.js
        │   ├── generator.js
        │   └── rng.js
        │
        ├── src/input/
        │   └── pointer-input.js
        │       画面座標から操作要求への変換
        │
        ├── src/render/
        │   ├── animation.js
        │   ├── renderer.js
        │   └── canvas-renderer.js
        │
        └── src/ui/
            └── hud.js
```

## 依存ルール

### `src/app/app-state.js`、`app-controller.js`、`run-controller.js`

- DOM、Canvas、localStorage、Supabaseを参照しない。
- GameEngineの内部を知らない。
- 結果データを保持できるが、保存や送信を実行しない。

### `src/app/modes.js`

- 3モードの識別子と開始設定の既定値だけを持つ。
- 盤面生成やランキング保存を直接実行しない。
- 呼び出し側が定義を変更できないよう、公開定義を固定する。

### `src/app/player-name.js`

- 名前の正規化、文字数制限、検査だけを行う。
- DOMとlocalStorageを参照しない。
- 絵文字を原則1文字として数えるため、コードポイント単位で扱う。

### `src/services/player-name-store.js`

- 名前の保存と読み出しだけを行う。
- 検査は`app/player-name.js`へ委ねる。
- localStorageが使えない場合は、現在のページ内だけで使えるメモリ保存へ退避する。
- 保存失敗を理由に、妥当な名前のプレイ開始を止めない。

### `src/core/`

- DOM、Canvas、localStorage、通信へ依存しない。
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

### `src/services/ranking.js`

- 端末内記録の保存と取得を担当する。
- P2-02以降の記録へ`mode`を保存する。
- モード情報がない旧v2記録は`legacy`とし、エンドレス一覧へ混ぜない。
- 保存領域の読み取りや消去が失敗しても、アプリ全体を停止させない。

## 画面状態

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

## P2-02の画面接続

P2-02では、次を実際のDOMへ接続する。

```text
home
nameConfirm
rules
ranking
playing
```

名前確定時の流れ:

```text
home
→ nameConfirm
→ PlayerNameStore.save()
→ RunController.prepare(config)
→ countdown
→ playing
```

P2-02の`countdown`は同期的に通過する暫定接続である。正式な3・2・1・START、盤面の事前非表示、開始時計の同期はP2-03で置き換える。

## モード別の暫定接続

### daily

- 固定暫定seed。
- `official: false`、`preview: true`として準備する。
- 「暫定・記録対象外」と表示する。
- 公式問題と端末内記録へ保存しない。

### endless

- 現行のseed付きランダム盤面。
- 新しい盤面とseed指定を使える。
- 端末内記録へ`mode: 'endless'`を付けて保存する。

### practice

- 現行の練習難易度と固定暫定seed。
- 記録対象外。
- チュートリアルはPhase 5で追加する。

## 1プレイ状態

```text
prepared
playing
cleared
retired
invalidated
```

`RunController.prepare()`ごとに新しい`playId`を発行する。名前確定、再挑戦、新しいエンドレス盤面は、すべて別の`playId`を持つ。

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

## 開始処理の暫定状態

P2-02では、プレイ画面を表示し、最初の描画フレーム後に同じ時刻で次を呼ぶ。

```text
GameEngine.start(ts)
RunController.start(playId, ts)
```

この処理は旧MVPより開始の一回性を高めるが、公式競技の完成形ではない。P2-03でSTART表示と盤面表示と開始処理を一つへまとめる。

開始の片方だけが成功した場合は、ゲームを操作可能にせず、現在プレイを無効化して再挑戦を案内する。

## 非同期処理の規則

- 画面に属する遅延処理は`AppController.version`を確認する。
- プレイに属する処理は`RunController.playId`を確認する。
- ランキング、共有、アニメーション完了、カウントダウンは古い世代なら結果を捨てる。
- 結果確定はRunControllerが成功した場合だけ行う。
- 画面を離れたプレイは必要に応じて`invalidated`へ変える。
- `destroy()`または購読解除でイベントを残さない。

## 描画と入力

- PointerInputは選択、ドラッグ、確定、取消を通知する。
- `playing`画面かつ現在の`playId`がplayingの時だけ箱入力を許可する。
- Animationは経過時間で表示位置を目標へ近づける。
- CanvasRendererは角丸箱、影、グラデーション、記号、出口、パーティクルを描く。
- アニメ中入力は表示完了までロックする。
- 論理座標は整数セルで保持し、表示位置だけを補間する。

## 盤面生成とソルバー

Phase 2時点の生成は旧MVP型であり、公式条件`optimalSwipes >= 20`を満たさない。

Phase 3で次を追加する。

- 複数箱と同色複数箱
- 盤面データv2
- `puzzleId`、`rulesVersion`、`generatorVersion`、`boardHash`
- 厳密な最短操作ソルバー
- 1000件以上の候補検査
- 検証済み公式問題集

## Three.js / WebGL

Three.jsはPhase 6より前の必須作業にしない。

将来追加する場合も、カメラ、光源、立体物管理、ヒット判定、サイズ変更、高解像度負荷制御、資源破棄、WebGLコンテキスト消失と復帰、Canvas2Dフォールバックが必要である。

Renderer生成箇所を一行変えるだけで完成するとは扱わない。
