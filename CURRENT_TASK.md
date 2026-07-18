# CURRENT_TASK: P2-01 アプリ状態機械と1プレイ管理

## 目的

画面状態と1プレイの状態遷移を純粋なモジュールへ分離し、不正な画面遷移、二重結果、古いタイマー・Promise・イベントの混入を防ぐ基礎を作る。

## 基準

- 正式な基準ブランチ: `main`
- 基準コミット: Pull Request #4統合後の最新`main`
- 作業ブランチ: `agent/hakodase-p2-01-state-machine`
- Pull Request base: `main`

## 今回の一目的

```text
AppControllerとRunControllerを追加し、画面状態とplayId世代管理をNode標準テストで検証できるようにする。
```

## 実装対象

### 新規コード

```text
src/app/app-state.js
src/app/app-controller.js
src/app/run-controller.js
```

### 新規テスト

```text
test/app-state.test.js
test/run-controller.test.js
```

### 文書

```text
docs/P2_01_STATE_MACHINE_v2.md
CURRENT_TASK.md
DECISION_LOG.md
docs/COMPLETION_STATUS_v2.md
docs/REVIEW_CHECKLIST_v2.md
docs/architecture.md
```

## 実装内容

### AppController

- `home`、`nameConfirm`、`countdown`、`playing`、`result`、`rules`、`ranking`を定義する。
- 許可された遷移だけを受け付ける。
- 成功した遷移ごとに`version`を進める。
- 古い画面世代を`isCurrent(version)`で識別できる。
- 購読解除と`destroy()`でイベントを残さない。

### RunController

- `prepare()`ごとに単調増加する`playId`を発行する。
- `prepared`、`playing`、`cleared`、`retired`、`invalidated`を管理する。
- 古い`playId`による開始、完了、リタイア、無効化を拒否する。
- 一つのプレイの結果を一度だけ確定する。
- `runIfCurrent()`で古い非同期処理を現在のプレイへ作用させない。
- 外部へ返す設定と結果を複製し、外部変更で内部状態を壊さない。

## 対象外

- 現行`src/main.js`への本接続
- ホーム画面と名前入力
- カウントダウン表示
- undo・リタイアの画面ボタン
- 正式結果画面
- Supabase、SQL、オンラインランキング
- 盤面生成第2世代
- 出荷レーン、出荷シャッター
- Three.js/WebGL

本接続はP2-02〜P2-05で、画面単位に行う。

## 検証

- 追加した`app-state`、`AppController`、`RunController`の14件のNodeテストは、同じコードを再現したローカル環境ですべて合格した。
- GitHub公開URLへ接続できない環境のため、リポジトリ全体の`npm test`は未実施。
- 既存59件と追加14件の一括合格は、Pull RequestのCIまたは別の実行環境で確認が必要。
- ブラウザ・実機確認は未実施。

## 完了条件

- [x] 全画面状態と許可遷移を純粋関数で定義する。
- [x] AppControllerが禁止遷移と古い画面世代を拒否できる。
- [x] RunControllerがplayIdを発行し、古いプレイを拒否できる。
- [x] クリア、リタイア、無効化を一度だけ確定できる。
- [x] 古い非同期処理を現在プレイへ作用させないAPIがある。
- [x] 新規モジュールがDOM、Canvas、Supabaseへ依存しない。
- [x] 新規単体テスト14件が個別に合格する。
- [ ] 既存59件と追加14件を合わせた`npm test`が合格する。
- [ ] `git diff --check`相当の差分確認が合格する。
- [ ] Pull Requestレビューで仕様との一致を確認する。

## 次に行う作業

P2-01統合後、最新`main`から次を開始する。

```text
P2-02: ホーム・名前確認・3モード選択
```

P2-02でAppControllerを実際のDOM画面へ接続し、名前確認からプレイ準備までを実装する。カウントダウンと正式時計の接続はP2-03へ分ける。
