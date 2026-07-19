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
- [P2_03_COUNTDOWN_CLOCK_v2.md](P2_03_COUNTDOWN_CLOCK_v2.md)
- [P2_04_PLAY_CONTROLS_v2.md](P2_04_PLAY_CONTROLS_v2.md)

旧MVPの説明と矛盾する場合は、v2正本を優先する。

## 設計原則

1. ゲームルールはDOM、Canvas、保存、通信へ依存させない。
2. 画面状態と1プレイ状態を分ける。
3. 名前やモードの規則と、端末保存を分ける。
4. カウントダウンと開始取引を、画面描画から分けて検査できるようにする。
5. undo・リタイア・詰みの条件をDOMから分けて検査できるようにする。
6. 非同期処理は画面世代、カウントダウンtoken、または`playId`を確認してから作用させる。
7. 描画は状態を受け取るだけで、ゲーム状態を書き換えない。
8. ランキング保存をGameEngineへ直結させない。
9. Canvas2Dを正式な基本版として残す。

## レイヤー構成

```text
index.html / styles/main.css / styles/p2-04.css
画面要素、カウントダウン、START、プレイ操作、見た目
        │
        ▼
src/main.js
既存DOM配線、ゲームループ、Canvas統合
        │
        ├── src/p2-03-bootstrap.js
        │   Game生成後にカウントダウン・時計を接続
        │
        ├── src/p2-04-bootstrap.js
        │   P2-03接続後にundo・リタイア・詰みを接続
        │
        ├── src/app/
        │   ├── app-state.js
        │   │   画面状態と許可遷移
        │   ├── app-controller.js
        │   │   画面状態、version、購読
        │   ├── run-controller.js
        │   │   playId、開始、クリア、リタイア、無効化、一回性
        │   ├── countdown-controller.js
        │   │   3・2・1・START、世代token、取消
        │   ├── start-run.js
        │   │   GameEngineとRunControllerの同一時刻開始
        │   ├── visibility-policy.js
        │   │   厳格時計のページ非表示無効化条件
        │   ├── play-actions.js
        │   │   現在プレイのundo・リタイア前提条件
        │   ├── modes.js
        │   │   daily / endless / practice、strictClock
        │   └── player-name.js
        │       名前の正規化、20文字制限、入力検査
        │
        ├── src/ui/
        │   ├── hud.js
        │   ├── countdown-flow.js
        │   │   カウントダウン、開始、画面非表示監視
        │   └── play-flow.js
        │       残り箱、undo、リタイア確認、詰みのDOM統合
        │
        ├── src/services/
        │   ├── player-name-store.js
        │   │   プレイヤー名の端末内保存
        │   └── ranking.js
        │       端末内記録。Phase 4でRemoteRankingService追加
        │
        ├── src/core/
        │   ├── engine.js
        │   │   盤面、位置、操作数、距離、undo、時計、クリア
        │   ├── play-status.js
        │   │   残り箱、合法操作列挙、合法操作0件の詰み
        │   ├── rules.js
        │   ├── solver.js
        │   ├── generator.js
        │   └── rng.js
        │
        ├── src/input/
        │   └── pointer-input.js
        │       画面座標から操作要求への変換
        │
        └── src/render/
            ├── animation.js
            ├── renderer.js
            └── canvas-renderer.js
```

## 依存ルール

### 純粋な`src/app/`

次はDOM、Canvas、localStorage、Supabaseを参照しない。

```text
app-state.js
app-controller.js
run-controller.js
countdown-controller.js
start-run.js
visibility-policy.js
play-actions.js
modes.js
player-name.js
```

- GameEngineの内部実装へ依存しない。
- `start-run.js`は公開された`status`、`start()`、`reset()`だけを利用する。
- `play-actions.js`は公開された`status`、`canUndo()`、`undo()`、位置と計数値を利用する。
- 時刻、画面状態、対象`playId`は呼び出し側から受け取る。
- 結果データを保持できるが、保存や送信を実行しない。

### `src/core/play-status.js`

- DOM、Canvas、時計、保存、通信へ依存しない。
- `rules.js`の`legalMovesFor()`を使い、GameEngineと同じ合法操作を判定する。
- 残り箱、合法スライド数、可動箱数、合法操作0件の詰みだけを返す。
- 将来解けない状態の完全探索は行わない。

### `src/ui/countdown-flow.js`

- DOM、GameEngine、RunController、AppControllerをつなぐP2-03の統合層。
- 盤面ルールを実装しない。
- `CountdownController`、`startPreparedRun()`、`shouldInvalidateOnHidden()`の契約を利用する。
- 古いタイマーと古い`playId`を現在試行へ作用させない。
- P2-02までの`pendingStart`開始を実行時に無効化する。

### `src/ui/play-flow.js`

- DOM、GameEngine、RunController、AppControllerをつなぐP2-04の統合層。
- 盤面の合法操作を独自実装せず、`analyzePlayState()`を利用する。
- undoとリタイアの前提条件を独自実装せず、`play-actions.js`を利用する。
- 現在の`playId`だけへ操作を作用させる。
- undo後の論理位置とCanvas表示位置を同期する。
- リタイア確認、詰み案内、ボタンの有効・無効を管理する。
- 合法操作列挙は盤面状態が変わった時だけ更新し、毎描画フレームで再探索しない。

### `src/app/player-name.js`

- 名前の正規化、文字数制限、検査だけを行う。
- DOMとlocalStorageを参照しない。
- 絵文字を原則1文字として数えるため、コードポイント単位で扱う。

### `src/services/player-name-store.js`

- 名前の保存と読み出しだけを行う。
- 検査は`app/player-name.js`へ委ねる。
- localStorageが使えない場合はページ内メモリへ退避する。
- メモリ退避を永続保存済みとは報告しない。
- 保存失敗を理由に、妥当な名前のプレイ開始を止めない。

### `src/core/`

- DOM、Canvas、localStorage、通信へ依存しない。
- GameEngineとSolverは同じルール関数を使う。
- `swipeCount`と`distanceCells`を混同しない。
- 時計は外部から渡す単調時刻を利用する。

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
- リタイア、無効化、練習、本日の出荷プレビューは保存しない。

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

P2-03で、再挑戦に必要な`playing → countdown`を追加した。

成功した遷移ごとに`AppController.version`を進める。画面に属する遅延処理は開始時のversionを保持し、完了時に現在世代か確認する。

## 1プレイ状態

```text
prepared
playing
cleared
retired
invalidated
```

`RunController.prepare()`ごとに新しい`playId`を発行する。名前確定、やりなおし、新しいエンドレス盤面、seed指定は、すべて別の`playId`を持つ。

`cleared`、`retired`、`invalidated`は終端状態であり、一つのプレイを二重に確定しない。

## P2-03の開始処理

### 準備

```text
nameConfirmまたはplaying
→ RunController.prepare(config)
→ 新しいplayId
→ countdownへ遷移
→ 盤面データとGameEngineをreadyで準備
→ CountdownController.start()
```

盤面データは生成済みでも、`playing`画面はSTARTまで隠す。

### カウントダウン

```text
3
→ 2
→ 1
→ START
```

- 開始ごとにtokenを発行する。
- 古いtokenのタイマーは表示も開始も行わない。
- 中止、再挑戦、ホーム移動でtokenを失効させる。

### START取引

```text
requestAnimationFrame(frameTime)
→ 画面version、playId、tokenを確認
→ countdownからplayingへ遷移
→ 盤面サイズを調整
→ 最初の盤面フレームを描画
→ GameEngine.start(frameTime)
→ RunController.start(playId, frameTime)
→ 成功時だけ入力ロック解除
```

開始の正本は`src/app/start-run.js`の`startPreparedRun()`である。

- 二重開始しない。
- GameEngineとRunControllerへ別の時刻を渡さない。
- RunController開始が失敗した場合はGameEngineを`ready`へ戻す。
- 開始失敗時は操作を許可せずホームへ戻す。

## ページ非表示

`src/app/visibility-policy.js`は、次の時だけ無効化を要求する。

```text
strictClock === true
かつ appState が countdown または playing
かつ runStatus が prepared または playing
```

現在は本日の出荷だけ`strictClock: true`である。

- 本日の出荷はページ非表示で`invalidated`へ変え、ホームへ戻す。
- P2-03時点では暫定問題かつ記録対象外である。
- エンドレスと練習はページ非表示だけでは無効にしない。
- エンドレスと練習の一時停止時計は未実装で、非表示時間も経過時間へ含まれる。

## GameEngine

GameEngineは次を管理する。

```text
positions
swipeCount
distanceCells
undoCount
remainingBlocks
canUndo
status
startedAt
finalElapsedMs
history
```

- 1回の有効スライドで`swipeCount`を1増やす。
- 通過したマス数を`distanceCells`へ加える。
- 競技経過時間は外部から渡す単調時刻で測る。
- undoは箱位置、操作数、距離を戻すが、経過時間を戻さない。
- `remainingBlocks`は退場していない箱を数える。
- `canUndo()`は`playing`かつ履歴ありの時だけtrueを返す。

## P2-04のプレイ操作

### 残り箱

```text
positionsのnullではない要素数
```

HUDと`frameState`へ読み取り値を渡す。START前は`—`とし、クリア時は`0箱`になる。

### undo

```text
現在playId
かつ RunController playing
かつ GameEngine playing
かつ historyあり
→ GameEngine.undo()
→ 表示位置を論理位置へ同期
→ HUDと詰み状態を更新
```

- タイマー開始時刻と経過時間を戻さない。
- 通常の移動アニメーション中は実行しない。
- 詰み中は履歴があれば実行できる。
- 退場中フラグ、選択、プレビュー、粒子を解除する。

### リタイア

```text
リタイア操作
→ 確認パネル
→ 現在playIdを確認
→ RunController.retire()
→ プレイ表示を片づける
→ home
```

- 確認中も時計を進める。
- ローカル記録とオンライン記録へ送らない。
- 誤タップを避けるため、確認なしで終端化しない。
- P2-05まで、クリア後の同じ位置は暫定的なホーム導線になる。

### 詰み

```text
GameEngine playing
かつ remainingBlocks > 0
かつ legalSlideCount === 0
```

- Canvas入力を止める。
- undo、やりなおし、リタイアを残す。
- 自動的に終端状態へ変えない。
- 時計を止めない。
- 将来解けない状態の完全探索は行わない。

## 非同期処理の規則

- 画面に属する処理は`AppController.version`を確認する。
- カウントダウンに属する処理はtokenを確認する。
- プレイに属する処理は`RunController.playId`を確認する。
- ランキング、共有、アニメーション完了は古い世代なら結果を捨てる。
- 結果確定はRunControllerが成功した場合だけ行う。
- `destroy()`または購読解除でイベントを残さない。

## 描画と入力

- PointerInputは選択、ドラッグ、確定、取消を通知する。
- `playing`画面かつ現在の`playId`がplayingの時だけ箱入力を許可する。
- START取引が終わるまで入力をロックする。
- 通常移動アニメーション中は入力をロックする。
- リタイア確認中と詰み中はCanvas入力をロックする。
- Animationは経過時間で表示位置を目標へ近づける。
- CanvasRendererは角丸箱、影、グラデーション、記号、出口、パーティクルを描く。
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
- 複雑な詰みを減らす事前検証

## 後続の画面接続

```text
P2-05: result / 再挑戦 / 共有 / 導線
P2-06: Phase 1・2の実ブラウザ基準試験
```

## Three.js / WebGL

Three.jsはPhase 6より前の必須作業にしない。

将来追加する場合も、カメラ、光源、立体物管理、ヒット判定、サイズ変更、高解像度負荷制御、資源破棄、WebGLコンテキスト消失と復帰、Canvas2Dフォールバックが必要である。

Renderer生成箇所を一行変えるだけで完成するとは扱わない。
