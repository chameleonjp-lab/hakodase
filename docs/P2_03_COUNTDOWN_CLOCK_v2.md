# P2-03 3・2・1・STARTと公式時計 設計

## 位置づけ

この文書は、HAKODASE v2の`P2-03`で実装するカウントダウン、盤面公開、開始時刻の同期、画面非表示時の扱いを記録する。

P2-03では正式結果画面、undo・リタイアの正式UI、Supabase、公式問題集を実装しない。本日の出荷は引き続き暫定問題かつ記録対象外だが、将来の公式競技と同じ厳格な開始時計を先に検証する。

## 一目的

> 盤面を先に見せず3・2・1・STARTを表示し、START、盤面公開、`RunController.start()`、`GameEngine.start()`を同じ描画フレームの一回の開始処理で行う。

## カウントダウン

表示順は次とする。

```text
3
2
1
START
```

- 1段階の既定時間は900ミリ秒。
- `CountdownController`はDOMやブラウザ時計へ直接依存しない。
- タイマー関数を外から渡せるため、実時間待ちなしでテストできる。
- 開始ごとに世代tokenを発行する。
- 中止、再挑戦、新しい盤面、ホーム移動で古いtokenを無効にする。
- 古いタイマーが後から発火してもSTART処理を行わない。
- 表示側の例外でカウントダウン本体を壊さない。

## 盤面の非表示

盤面は`playing`画面の中に置き、カウントダウン中は`countdown`画面だけを表示する。

盤面データはカウントダウン前に生成できるが、CanvasはSTARTまで画面へ表示しない。これにより、問題を見てから計時前に考える時間を持てない。

## START開始取引

START時は、次を同じ`requestAnimationFrame`コールバック内で行う。

```text
1. 画面世代、playId、カウントダウンtokenを再確認
2. countdown → playingへ遷移
3. 盤面サイズを合わせ、最初の盤面フレームを描画
4. 同じframeTimeでGameEngine.start(frameTime)
5. 同じframeTimeでRunController.start(playId, frameTime)
6. 両方が成功した場合だけ入力ロックを解除
7. 盤面上へ短いSTART表示を出す
```

開始の正本は`startPreparedRun()`とする。

- GameEngineが`ready`でない場合は開始しない。
- RunControllerが現在の`playId`の`prepared`でない場合は開始しない。
- 不正な時刻は拒否する。
- GameEngine開始後にRunController開始が失敗した場合、GameEngineを`ready`へ戻す。
- 二重STARTで開始時刻を上書きしない。

## 旧暫定開始の扱い

P2-02までの`pendingStart`による初回描画後の自動開始は、P2-03統合モジュールが実行時に無効化する。

P2-03は既存の大きな`src/main.js`を全面書換えせず、`src/ui/countdown-flow.js`を後段で接続する。入口は`src/p2-03-bootstrap.js`である。

この分離により、既存ゲームロジックを保持しながら、開始処理を一か所へ限定する。後続の画面統合作業で`src/main.js`を整理する場合も、`CountdownController`と`startPreparedRun()`の契約は維持する。

## 再挑戦と新しい盤面

`playing → countdown`を許可する。

- やりなおしは同じseedで新しい`playId`を発行する。
- エンドレスの新しい盤面は新しいseedと新しい`playId`を発行する。
- seed指定も新しい`playId`を発行する。
- 以前のpreparedまたはplaying試行を`invalidated`へ変える。
- 新しい盤面も必ずカウントダウンを通る。
- 古いカウントダウン、START表示、タイマーは新しい試行へ作用しない。

## モード別時計

### 本日の出荷

- `strictClock: true`。
- P2-03時点では暫定問題であり、公式記録へ保存しない。
- カウントダウン中とプレイ中にページが隠れた場合、試行を`invalidated`へ変える。
- ホームへ戻し、無効になった理由を表示する。
- 再表示後に古いカウントダウンや開始処理を続けない。

### エンドレス・練習

- `strictClock: false`。
- ページが隠れただけでは試行を無効化しない。
- 公式記録へ混ぜない。
- 一時停止機能は今回実装しないため、プレイ中の非表示時間は経過時間へ含まれる。

## START表示

START時、盤面上に短い表示を重ねる。

- 表示時間は450ミリ秒。
- ポインター操作を遮らない。
- 古い表示タイマーが新しいSTART表示を消さないよう、再開始時に以前のタイマーを解除する。
- `prefers-reduced-motion`ではアニメーション時間を短くする既存方針を維持する。

## 追加モジュール

```text
src/app/countdown-controller.js
src/app/start-run.js
src/app/visibility-policy.js
src/ui/countdown-flow.js
src/p2-03-bootstrap.js
```

## 追加・更新するテスト

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

検査内容:

- 3・2・1・STARTの順序と一回性。
- 中止後の古いタイマー無効化。
- 新しい世代による古いカウントダウンの置換。
- GameEngineとRunControllerの同一時刻開始。
- 二重開始と古い`playId`の拒否。
- 開始片側失敗時の巻き戻し。
- 本日の出荷だけの画面非表示無効化。
- STARTまでGameEngineが`ready`で入力ロックされること。
- DOM上のカウントダウン要素とSTART表示。
- P2-03統合が純粋app層をDOM依存にしないこと。

## 今回の対象外

- 正式結果画面。
- undo・リタイア・詰みの正式UI。
- 公式問題集、`puzzleId`、日替わり選出。
- Supabase、SQL、オンラインランキング。
- エンドレスと練習の一時停止時計。
- 盤面生成第2世代。
- 出荷レーン、出荷シャッター。
- Three.js/WebGL。

## 検証状況

- P2-03の純粋制御、DOM契約、境界、統合に関する対象テスト35件は、同じコードを再現したNode環境ですべて合格した。
- `countdown-flow.js`と`p2-03-bootstrap.js`の構文確認は合格した。
- この実行環境ではGitHubリポジトリ全体を取得できず、既存テストを含む`npm test`は未実施。
- 実ブラウザ、320×568、iPhone、iPadは未確認。

## 完了判定

統合可能と判断するには次を満たす必要がある。

1. 既存テストとP2-03対象テストが同じリポジトリ上ですべて合格する。
2. 3・2・1・STARTが1回ずつ表示される。
3. START前に盤面が見えず、時間が0のままである。
4. START時に盤面表示と両Controllerの時計が同じ一回の処理で始まる。
5. 二重開始、古いタイマー、古い`playId`が現在試行へ作用しない。
6. 本日の出荷はページ非表示で無効になる。
7. 再挑戦と新規盤面が再びカウントダウンを通る。
8. 320px幅でカウントダウンと中止ボタンが見切れない。
9. P2-04以降の機能を実装済みと主張しない。

## ロールバック

問題がある場合はPull Requestを統合しない。統合後に問題が見つかった場合は、このPull Requestをrevertし、`main`の履歴をforce pushしない。
