# CURRENT_TASK: P2-04 プレイ画面・undo・リタイア・詰み

## 目的

プレイ中に必要な情報と操作だけを表示し、現在の`playId`に対してGameEngineのundo、リタイア、合法操作0件の詰み案内を安全に接続する。

## 基準

- 正式な基準ブランチ: `main`
- 基準コミット: `24cdb7d4571b98397d18fc0828b17b4e3f4054e9`
- 基準内容: Pull Request #7統合後のP2-03完了地点
- 作業ブランチ: `agent/hakodase-p2-04-play-controls`
- Pull Request base: `main`

## 今回の一目的

```text
残り箱、undo、リタイア確認、合法操作0件の詰み案内をプレイ画面へ接続する。
```

## 実装対象

### 新規コード

```text
src/core/play-status.js
src/app/play-actions.js
src/ui/play-flow.js
src/p2-04-bootstrap.js
styles/p2-04.css
```

### 既存コード・画面

```text
src/core/engine.js
index.html
```

### テスト

```text
test/play-status.test.js
test/play-actions.test.js
test/play-flow.test.js
test/engine.test.js
test/app-shell.test.js
test/app-boundaries.test.js
```

### 文書

```text
docs/P2_04_PLAY_CONTROLS_v2.md
CURRENT_TASK.md
DECISION_LOG.md
docs/COMPLETION_STATUS_v2.md
docs/REVIEW_CHECKLIST_v2.md
docs/architecture.md
README.md
```

## 実装内容

### プレイHUD

- タイム、操作と移動マス、残り箱を主要表示とする。
- `optimalSwipes`は「問題の目安」として補助表示へ移す。
- `GameEngine`から`remainingBlocks`と`canUndo`を読み取れるようにする。

### undo

- 現在の`playId`かつ両Controllerがplayingの時だけ実行する。
- 履歴がない時はボタンを無効にする。
- 通常アニメーション中はボタンを無効にする。
- 詰み案内中は、履歴があればundoできる。
- 箱位置、`swipeCount`、`distanceCells`を戻す。
- `undoCount`を増やす。
- タイマーは戻さない。
- undo後は表示位置を論理位置へ正確に合わせ、退場演出と選択状態を消す。

### リタイア

- プレイ中の「ホームへ」をリタイアへ置き換える。
- 確認パネルを表示し、確認中もタイマーを進める。
- 確定時は`RunController.retire()`を一度だけ成功させる。
- リタイア記録を保存せずホームへ戻す。
- クリア後はP2-05までの暫定として同じボタンを「ホームへ」に変える。

### 詰み

- `playing`で残り箱があり、合法スライドが0件の時だけ検出する。
- Canvas入力を止める。
- undo、やりなおし、リタイアを選べる状態を保つ。
- 自動的にリタイアや無効化をしない。
- 完全な将来詰み探索は行わない。

### 責務分離

- 残り箱と詰み判定は`src/core/play-status.js`へ置く。
- undoとリタイアの前提条件は`src/app/play-actions.js`へ置く。
- DOM統合は`src/ui/play-flow.js`へ置く。
- `src/p2-04-bootstrap.js`がP2-03接続後に一度だけ導入する。

## 対象外

- 正式結果画面。
- 結果共有。
- 初回記録とベスト記録表示。
- 公式問題集、`puzzleId`、日替わり選出。
- Supabase、SQL、オンラインランキング。
- 盤面生成第2世代。
- 将来解けない状態の完全探索。
- undo専用アニメーション。
- 出荷レーン、出荷シャッター。
- Three.js/WebGL。

## 検証

- P2-04の純粋判定・操作・DOM統合に関する新規13件は、同じコードを再現したNode環境で全件合格した。
- 搬出済み箱のundo復元と、リタイア時に記録保存を呼ばない回帰テストを含む。
- 実際の`rules.js`、`GameEngine`、`RunController`を使うリポジトリ追加テストを作成した。
- GitHubリポジトリ全体を取得できない環境のため、既存テストを含む`npm test`は未実施。
- 実ブラウザ、320×568、iPhone、iPadは未確認。

## 完了条件

- [x] 残り箱数を主要HUDへ表示する。
- [x] `GameEngine.canUndo()`を追加する。
- [x] 現在のプレイだけがundoできる。
- [x] undoが操作数と距離を戻し、時計を戻さない。
- [x] 搬出済み箱のundo後に表示位置を復元する。
- [x] undo後に表示位置を論理位置へ同期する。
- [x] リタイア確認を追加する。
- [x] リタイアを`retired`として一度だけ確定する。
- [x] リタイア記録を保存しない。
- [x] 合法操作0件の詰みを検出する。
- [x] 詰み時にundo・やりなおし・リタイアを残す。
- [x] P2-04の単体テストと画面契約テストを追加する。
- [ ] リポジトリ全体の`npm test`が合格する。
- [ ] `git diff --check`相当の差分確認が合格する。
- [ ] 実ブラウザでundo、リタイア、詰みを確認する。
- [ ] 320×568で主要HUDと確認パネルを確認する。
- [ ] iPhone・iPad実機で確認する。

## 次に行う作業

P2-04統合後、最新`main`から次を開始する。

```text
P2-05: 正式結果画面・再挑戦・共有
```

P2-05では、クリア・リタイア・無効化の結果表示、同じ問題の再挑戦、モード別の次の行動、結果共有、ホームと実験場への導線を実装する。Supabaseと公式問題集はまだ接続しない。
