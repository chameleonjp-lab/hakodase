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
- [P2_04_PLAYING_CONTROLS_v2.md](P2_04_PLAYING_CONTROLS_v2.md)
- [P2_05_RESULT_SHARE_v2.md](P2_05_RESULT_SHARE_v2.md)

旧MVPの説明と矛盾する場合は、v2正本を優先する。

## 設計原則

1. ゲームルールはDOM、Canvas、保存、通信へ依存させない。
2. 画面状態、プレイ状態、描画状態を分ける。
3. 成功した画面遷移、カウントダウンtoken、`playId`で古い非同期処理を拒否する。
4. 結果データの正規化とDOM表示を分ける。
5. 共有APIや保存失敗で結果画面を失わせない。
6. Rendererは状態を読み取るだけで、ゲーム状態を書き換えない。
7. ランキング保存と送信をGameEngineへ直結させない。
8. Canvas2Dを正式な基本版として残す。
9. Phaseごとのbootstrapは読み込み順と一回導入をテストする。

## レイヤー構成

```text
index.html
styles/main.css
styles/p2-04.css
styles/p2-05.css
画面構造、スマートフォン向け表示
        │
        ▼
src/main.js
旧MVPから継続するGame統合、Canvasループ、基本DOM配線
        │
        ├── src/p2-03-bootstrap.js
        │   3・2・1・STARTと厳格時計
        │
        ├── src/p2-04-bootstrap.js
        │   undo、リタイア、詰み
        │
        └── src/p2-05-bootstrap.js
            結果画面、再挑戦、共有
```

bootstrapは次の順で読み込む。

```text
main.js
→ p2-03-bootstrap.js
→ p2-04-bootstrap.js
→ p2-05-bootstrap.js
```

後段は前段の公開されたGameメソッドを包む。直接読み込み順を逆転させない。

## `src/app/`

DOM、Canvas、localStorage、Supabaseへ依存しない純粋なアプリ規則を置く。

```text
app-state.js
画面状態と許可遷移

app-controller.js
画面状態、version、購読

run-controller.js
playId、prepared / playing / cleared / retired / invalidated、一回確定

countdown-controller.js
3・2・1・START、token、取消

start-run.js
GameEngineとRunControllerの同一時刻開始

visibility-policy.js
厳格時計のページ非表示無効化条件

modes.js
daily / endless / practice、strictClock、記録対象

player-name.js
名前の正規化と検査

play-control-policy.js
undo、再挑戦、リタイア、詰み表示の可否

result-model.js
結果の正規化、最短差、問題表示、共有本文
```

`result-model.js`は保存処理を実行しない。端末内記録の集計結果を受け取り、表示用の不変モデルへ変換する。

## `src/core/`

```text
engine.js
盤面位置、操作数、距離、undo、時計、クリア、残り箱、合法手

rules.js
スライドルール、出口、壁、一方通行

solver.js
最短操作・診断用距離

generator.js / rng.js
seed付き現行生成
```

規則:

- DOM、Canvas、保存、通信を参照しない。
- GameEngineとSolverは同じルール関数を使う。
- `swipeCount`と`distanceCells`を混同しない。
- 時計は外部から渡す単調時刻を使う。
- undoは時間を戻さない。
- 公式問題生成の重い探索を毎フレーム実行しない。

## `src/ui/`

```text
hud.js
タイム、操作、距離、残り、undo回数、メッセージ

countdown-flow.js
カウントダウン、開始取引、厳格時計の中断監視、resultからの再挑戦

playing-controls.js
undo、リタイア確認、詰み案内、表示位置同期

result-flow.js
クリア処理、結果表示、再挑戦、共有、ホーム導線
```

UI統合層は盤面ルールを再実装しない。GameEngine、AppController、RunController、純粋app関数の公開契約を利用する。

## `src/services/`

```text
player-name-store.js
プレイヤー名の端末内保存

ranking.js
エンドレスの端末内記録、同一条件の初回・ベスト

share-result.js
Web Share、Clipboard、選択可能全文のフォールバック
```

### 端末内ランキング

保存条件と集計条件を分けない。

```text
mode
difficulty
seed
```

- 初回は最古の`clearedAt`。
- ベストはタイム、操作数、達成日時の順。
- legacyや異なるseedを混ぜない。
- Phase 4のサーバー初回・ベストとは別物である。

### 共有

`share-result.js`はDOMを操作しない。API結果と手動コピー用全文を返し、結果画面の表示判断は`result-flow.js`が行う。

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

主要フロー:

```text
home
→ nameConfirm
→ countdown
→ playing
→ result
```

再挑戦:

```text
result
→ countdown
→ playing
```

成功した遷移ごとに`AppController.version`を進める。

## 1プレイ状態

```text
prepared
playing
cleared
retired
invalidated
```

- `RunController.prepare()`ごとに新しい`playId`を発行する。
- `cleared`、`retired`、`invalidated`は終端状態である。
- 一つのプレイを二重に確定しない。
- 古いPromise、タイマー、共有結果、演出完了は現在の`playId`へ作用させない。

## P2-03 開始取引

```text
prepare(config)
→ 新しいplayId
→ countdown
→ 盤面をreadyで準備
→ 3・2・1・START
→ 同じrequestAnimationFrame時刻で
   GameEngine.start(frameTime)
   RunController.start(playId, frameTime)
→ 成功時だけ入力許可
```

本日の出荷は`strictClock: true`で、countdownまたはplaying中にページが隠れた場合は無効化する。

## P2-04 プレイ操作

- 主要表示はタイム、操作、残り箱。
- undoは現在の`playId`、playing、履歴あり、入力非ロック時だけ。
- undo後は論理位置とCanvas表示位置を同期する。
- リタイアは画面内で二段階確認する。
- 詰みは「残り箱あり・合法手0件」の軽量判定とする。
- 合法手探索は論理状態が変化した時だけ再実行する。

## P2-05 結果取引

```text
GameEngineがcleared
→ 既存_onClearがRunController.completeを一度実行
→ 端末内記録を保存
→ playIdとcleared状態を再確認
→ 表示モデルを固定
→ 短いクリア演出待ち
→ playingからresultへ一度だけ遷移
```

結果取引の防御:

- 処理中`playId`。
- 表示待ち`playId`。
- 表示済み`playId`。
- 現在の`game.currentPlayId`。
- `RunController.isCurrent(playId)`。
- `RunController.status === cleared`。
- `AppController.state === playing`。

結果表示後の共有処理は`playId`を保持し、共有完了時に同じ結果画面か確認してからメッセージを更新する。

ホームへ戻る場合はGameEngine、盤面描画参照、現在プレイ設定、結果モデルを破棄する。

## 描画と入力

- PointerInputは選択、ドラッグ、確定、取消を通知する。
- `playing`画面かつ現在の`playId`がplayingの時だけ箱入力を許可する。
- START取引、移動アニメーション、確認パネル、詰み、結果画面では入力をロックする。
- アニメーションは経過時間型。
- 論理座標は整数セルで保持し、表示位置だけ補間する。

## Phase 3以降

Phase 2時点の生成は旧MVP型であり、公式条件`20 <= optimalSwipes <= 35`を保証しない。

Phase 3で追加するもの:

- 盤面データv2。
- 複数箱・同色複数箱。
- `puzzleId`、`rulesVersion`、`generatorVersion`、`boardHash`。
- 厳密最短操作ソルバー。
- 1000件以上の候補検査。
- 検証済み公式問題集。

Phase 4で追加するもの:

- 実物確認済みSupabase RPC。
- 本日の出荷の1プレイ1送信。
- サーバー初回・ベスト・順位。
- 通信状態をP2-05結果画面へ接続。

## 次のGate

P2-05統合後はP2-06で、Phase 1・2のNodeテストと実ブラウザ統合検証を行う。P2-06を通過するまでPhase 3の本実装を開始しない。

## Three.js / WebGL

Three.jsはPhase 6より前の必須作業にしない。

将来追加する場合も、カメラ、光源、立体物管理、ヒット判定、サイズ変更、高解像度負荷制御、資源破棄、WebGLコンテキスト消失・復帰、Canvas2Dフォールバックが必要である。
