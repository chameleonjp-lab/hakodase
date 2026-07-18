# P2-01 アプリ状態機械・1プレイ管理設計

## 位置づけ

この文書は、HAKODASE v2 の Phase 2 最初の作業単位 `P2-01` の設計と境界を記録する。

今回追加するのは、画面状態と1プレイの世代を安全に管理する純粋なモジュールである。ホーム、名前入力、カウントダウン表示、正式結果画面は後続作業で接続する。

## 目的

- 許可された画面遷移だけを通す。
- 画面遷移ごとに世代番号を進め、古い画面イベントを識別できるようにする。
- 各プレイへ一意な `playId` を割り当てる。
- 古いタイマー、Promise、イベント、通信結果が現在のプレイへ作用しないようにする。
- クリア、リタイア、無効化の結果を1回だけ確定する。
- DOM、Canvas、Supabaseへ依存せず、Node標準テストで検証できるようにする。

## 追加モジュール

```text
src/app/app-state.js
src/app/app-controller.js
src/app/run-controller.js
```

## AppController

### 状態

```text
home
nameConfirm
countdown
playing
result
rules
ranking
```

### 許可遷移

```text
home        -> nameConfirm | rules | ranking
nameConfirm -> home | countdown
countdown   -> home | playing
playing     -> home | result
result      -> home | countdown | ranking
rules       -> home
ranking     -> home | result
```

同じ状態への遷移、未知状態、表にない遷移は拒否する。

### 世代番号

成功した画面遷移ごとに `version` を1増やす。非同期処理は開始時の `version` を保持し、完了時に `isCurrent(version)` を確認できる。

拒否された遷移では世代を進めない。

### 購読

`subscribe(listener)` で成功した遷移だけを通知する。購読者の例外は状態本体へ伝播させない。画面離脱時は購読解除し、アプリ破棄時は全購読を解除する。

## RunController

### 状態

```text
prepared
playing
cleared
retired
invalidated
```

`cleared`、`retired`、`invalidated` は終端状態である。

### playId

`prepare(config)` を呼ぶたびに単調増加する `playId` を発行する。新しいプレイを準備すると、それ以前の `playId` は現在のプレイではなくなる。

古い `playId` を使った開始、結果確定、リタイア、無効化は拒否する。

### 開始

`start(playId, now)` は、現在の `prepared` プレイだけを `playing` へ変える。二重開始は拒否し、最初の開始時刻を保持する。

`now` は `performance.now()` 系の単調時刻を受け取る。

### 結果確定

```text
complete(playId, result, now)
retire(playId, reason, now)
invalidate(playId, reason, now)
```

一つのプレイは、上記のいずれか一つで一度だけ終端化できる。終端後の追加確定は `already-settled` として拒否する。

### 古い非同期処理の防御

`runIfCurrent(playId, effect)` は、指定した `playId` が現在のプレイである場合だけ作用を実行する。

後続のランキング送信、共有、遅延タイマー、アニメーション完了通知は、現在の `playId` を確認してから画面へ作用する。

### スナップショット

外部へ返す設定と結果は複製し、返却値側の変更で内部状態を書き換えられないようにする。

## 後続画面への接続規則

### P2-02

- `AppController` をホーム、名前確認、モード選択へ接続する。
- 名前確認からカウントダウンへ進む時に `RunController.prepare()` を呼ぶ。

### P2-03

- GOと同じ処理で `RunController.start(playId, now)` と `GameEngine.start(now)` を呼ぶ。
- カウントダウンのタイマーは、保持した画面 `version` と `playId` が現在か確認する。
- 公式プレイでページが隠れた場合は `invalidate()` を呼ぶ。

### P2-04

- 箱入力を許可する条件を、`AppController.state === 'playing'`、`RunController.isPlaying(playId)`、`GameEngine.status === 'playing'` の一致とする。
- undo、リタイア、詰み表示は現在の `playId` だけへ作用させる。

### P2-05

- クリア時は `complete()` が成功した場合だけ結果画面へ遷移する。
- 結果保存や共有の非同期完了は `runIfCurrent()` で守る。
- 結果画面から再挑戦する時は、新しい `playId` を発行する。

## 今回の対象外

- 現行 `src/main.js` への本接続
- DOM画面切替
- ホームと名前入力
- カウントダウン表示
- undoボタン
- リタイアボタン
- 正式結果画面
- Supabase通信
- 盤面生成第2世代
- 出荷レーン、出荷シャッター
- Three.js/WebGL

画面へ中途半端に接続せず、後続作業で状態単位に接続する。

## テスト項目

### AppController

- 全状態を識別できる。
- 許可遷移だけ成功する。
- 禁止遷移、同一状態、未知状態を拒否する。
- 成功時だけ `version` が増える。
- 古い `version` を現在と判定しない。
- 購読解除と破棄が機能する。
- 購読者の例外で状態を壊さない。

### RunController

- `prepare()` ごとに `playId` が増える。
- 古いプレイの開始と結果確定を拒否する。
- 二重開始を拒否する。
- クリア結果を1回だけ確定する。
- リタイアと無効化を終端状態として扱う。
- 古い非同期処理を `runIfCurrent()` で拒否する。
- 外部スナップショットの変更で内部状態を変えられない。
- 購読解除と破棄が機能する。

## 検証状況

- 追加した14件のNodeテストを、同じソースとテスト内容を再現したローカル環境で実行し、全件合格した。
- GitHub公開URLへ接続できない環境だったため、リポジトリ全体の `npm test` はこの作業環境から実行できていない。
- Pull Request上のCI、または別の実行環境で既存59件と追加14件をまとめて実行する必要がある。
- ブラウザと実機は未確認。

## 完了判定

P2-01を統合可能と判断するには、次を満たす必要がある。

1. 既存59件と追加14件がすべて合格する。
2. `git diff --check` が合格する。
3. `src/app/` がDOM、Canvas、Supabaseへ依存していない。
4. 禁止遷移、古い `playId`、二重結果をテストで拒否できる。
5. P2-02以降の画面、Supabase、生成器を同梱していない。

## ロールバック

この作業は新規モジュールと文書追加が中心であり、現行画面へ接続しない。問題がある場合はPull Requestを統合しない。統合後に問題が見つかった場合は、このPull Requestをrevertする。
