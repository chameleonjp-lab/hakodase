# CURRENT_TASK: P2-02 ホーム・名前確認・3モード選択

## 目的

`AppController`を実際のDOMへ接続し、ホームで選んだモードと確認済みプレイヤー名を`RunController.prepare()`へ安全に渡す。

## 基準

- 正式な基準ブランチ: `main`
- 基準コミット: Pull Request #5統合後の最新`main`
- 作業ブランチ: `agent/hakodase-p2-02-home-name-modes`
- Pull Request base: `main`

## 今回の一目的

```text
ホーム、名前確認、練習・本日の出荷・エンドレスの選択を実装し、既存ゲーム画面へ暫定接続する。
```

## 実装対象

### 新規コード

```text
src/app/modes.js
src/app/player-name.js
```

### 画面・統合

```text
index.html
styles/main.css
src/main.js
src/services/ranking.js
```

### テスト

```text
test/modes.test.js
test/player-name.test.js
test/app-shell.test.js
test/ranking.test.js
```

### 文書

```text
docs/P2_02_HOME_NAME_MODES_v2.md
CURRENT_TASK.md
DECISION_LOG.md
docs/COMPLETION_STATUS_v2.md
docs/REVIEW_CHECKLIST_v2.md
README.md
```

## 実装内容

### ホーム

- 一文説明を表示する。
- 本日の出荷、エンドレス、練習を選べる。
- 保存済みのプレイヤー名を表示する。
- スタート、遊び方、端末内記録、ゲームシェア、実験場への導線を持つ。

### 名前確認

- 前後空白を除去する。
- 空文字を拒否する。
- 最大20文字とする。
- 絵文字と記号を許可する。
- 確定後に`blur()`する。
- 端末内へ保存し、保存できない場合もプレイ自体は続けられる。

### 3モード

- `daily`は固定暫定seedを使い、「暫定・記録対象外」と表示する。
- `endless`は現行のseed付きランダム盤面を使い、端末内記録だけ保存する。
- `practice`は現行練習難易度と固定暫定seedを使い、記録対象外とする。
- 公式問題、`puzzleId`、Supabaseはまだ接続しない。

### 状態管理

- 画面表示は`AppController`の状態へ従う。
- 名前確定時に`RunController.prepare()`で`playId`を発行する。
- 再挑戦と新しい盤面でも新しい`playId`を発行する。
- P2-03までの暫定として、`countdown`を同期的に通過して`playing`へ進む。

### 端末内記録

- 新規記録へ`mode`を保存する。
- エンドレスだけ保存・表示する。
- モード情報がない旧v2記録は`legacy`扱いとし、エンドレスへ混ぜない。

## 対象外

- 3・2・1・STARTと正式なGO時計
- 公式問題集、`puzzleId`、日替わり選出
- undo・リタイアの正式UI
- 正式結果画面
- Supabase、SQL、オンラインランキング
- 盤面生成第2世代
- 出荷レーン、出荷シャッター
- Three.js/WebGL

## 検証

- モード、名前、HTML契約、記録分離の対象テスト21件は、同じコードを再現したローカル環境で合格した。
- `node --check src/main.js`相当の構文確認は合格した。
- GitHub公開URLへ接続できない環境のため、リポジトリ全体の`npm test`は未実施。
- ブラウザ・実機確認は未実施。

## 完了条件

- [x] ホームと名前確認画面がDOMへ追加される。
- [x] 3モードを選択できる。
- [x] 名前の空文字、空白、20文字、絵文字を検査できる。
- [x] 保存済み名前を再利用できる。
- [x] 保存失敗でも有効名でプレイ準備できる。
- [x] 選択モードと名前を`RunController.prepare()`へ渡す。
- [x] 再挑戦と新規盤面で新しい`playId`を発行する。
- [x] エンドレスだけ端末内記録へ保存する。
- [x] 旧モード不明記録をエンドレスへ混ぜない。
- [ ] リポジトリ全体の`npm test`が合格する。
- [ ] 実ブラウザで主要画面遷移を確認する。
- [ ] 320px幅で横スクロールがないことを確認する。
- [ ] iPhone・iPad実機で確認する。

## 次に行う作業

P2-02統合後、最新`main`から次を開始する。

```text
P2-03: 3・2・1・STARTと公式時計
```

P2-03では、現在の同期的な`countdown`通過を廃止し、盤面を隠したカウントダウン、GOと盤面表示と両Controllerの開始同期、公式モードの`visibilitychange`無効化を実装する。
