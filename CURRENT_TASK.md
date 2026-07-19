# CURRENT_TASK: P2-03 3・2・1・STARTと公式時計

## 目的

盤面を先に見せず3・2・1・STARTを表示し、START、盤面公開、`RunController.start()`、`GameEngine.start()`を同じ描画フレームの一回の開始処理で行う。

## 基準

- 正式な基準ブランチ: `main`
- 基準コミット: `86173f9ffc13a82ad0bfdd0b2a75766ca712141f`
- 基準内容: Pull Request #6統合後のP2-02完了地点
- 作業ブランチ: `agent/hakodase-p2-03-countdown-clock`
- Pull Request base: `main`

## 今回の一目的

```text
3・2・1・START、盤面の事前非表示、両Controllerの同一時刻開始、本日の出荷の画面非表示無効化を実装する。
```

## 実装対象

### 新規コード

```text
src/app/countdown-controller.js
src/app/start-run.js
src/app/visibility-policy.js
src/ui/countdown-flow.js
src/p2-03-bootstrap.js
```

### 画面・既存定義

```text
index.html
styles/main.css
src/app/app-state.js
src/app/modes.js
```

### テスト

```text
test/countdown-controller.test.js
test/start-run.test.js
test/visibility-policy.test.js
test/countdown-flow.test.js
test/app-state.test.js
test/modes.test.js
test/app-shell.test.js
test/app-boundaries.test.js
```

### 文書

```text
docs/P2_03_COUNTDOWN_CLOCK_v2.md
CURRENT_TASK.md
DECISION_LOG.md
docs/COMPLETION_STATUS_v2.md
docs/REVIEW_CHECKLIST_v2.md
docs/architecture.md
README.md
```

## 実装内容

### カウントダウン

- `3 → 2 → 1 → START`を900ミリ秒間隔で進める。
- 世代tokenで古いタイマーを無効にする。
- 中止、再挑戦、新しい盤面、ホーム移動でカウントダウンを解除する。
- 盤面は`playing`画面に置き、STARTまで表示しない。

### 開始同期

- START時の一つの`requestAnimationFrame`内で`countdown → playing`へ遷移する。
- 最初の盤面フレームを描画する。
- 同じ`frameTime`を`GameEngine.start()`と`RunController.start()`へ渡す。
- 両方が成功した時だけ入力ロックを解除する。
- 二重開始、古い`playId`、不正な時刻を拒否する。
- 開始の片側だけ失敗した場合は操作可能にせずホームへ戻す。

### 再挑戦

- `playing → countdown`を許可する。
- やりなおし、新しい盤面、seed指定は新しい`playId`を発行する。
- 以前の試行を`invalidated`へ変える。
- すべての再開始がカウントダウンを通る。

### 厳格時計

- 本日の出荷だけ`strictClock: true`とする。
- カウントダウン中またはプレイ中にページが隠れた場合、試行を無効にしてホームへ戻す。
- P2-03時点の本日の出荷は暫定問題かつ記録対象外のままにする。
- エンドレスと練習は画面非表示だけでは無効にしない。

### 統合境界

- 純粋制御は`src/app/`へ置く。
- DOM統合は`src/ui/countdown-flow.js`へ置く。
- `src/p2-03-bootstrap.js`が既存ゲーム起動後に一度だけ接続する。
- P2-02までの`pendingStart`開始は実行時に無効化する。

## 対象外

- 正式結果画面。
- undo・リタイア・詰みの正式UI。
- 公式問題集、`puzzleId`、日替わり選出。
- Supabase、SQL、オンラインランキング。
- 盤面生成第2世代。
- 出荷レーン、出荷シャッター。
- Three.js/WebGL。
- エンドレスと練習の一時停止時計。

## 検証

- P2-03の純粋制御、DOM契約、境界、統合に関する対象テスト35件は、同じコードを再現したNode環境で全件合格した。
- `countdown-flow.js`と`p2-03-bootstrap.js`の構文確認は合格した。
- GitHubリポジトリ全体を取得できない環境のため、既存テストを含む`npm test`は未実施。
- 実ブラウザ、320×568、iPhone、iPadは未確認。

## 完了条件

- [x] 3・2・1・STARTの純粋制御を追加する。
- [x] 古いタイマーを世代tokenで拒否する。
- [x] STARTまでGameEngineとRunControllerを開始しない。
- [x] 同じ単調時刻で両Controllerを開始する。
- [x] 二重開始と古い`playId`を拒否する。
- [x] 再挑戦と新規盤面をカウントダウンへ戻す。
- [x] 本日の出荷をページ非表示で無効化する。
- [x] START表示と盤面公開のDOMを追加する。
- [x] P2-03対象テスト35件を再現環境で合格させる。
- [ ] リポジトリ全体の`npm test`が合格する。
- [ ] 実ブラウザでカウントダウンと開始を確認する。
- [ ] 320×568で表示を確認する。
- [ ] iPhone・iPad実機で確認する。

## 次に行う作業

P2-03統合後、最新`main`から次を開始する。

```text
P2-04: プレイ画面・undo・リタイア・詰み
```

P2-04では、プレイ中に必要な情報と操作だけを表示し、GameEngineのundo、リタイア、合法操作0件の詰み案内を接続する。正式結果画面はP2-05へ分ける。
