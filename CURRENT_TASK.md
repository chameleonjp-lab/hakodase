# CURRENT_TASK: P2-05 正式結果画面・再挑戦・共有

## 目的

クリア結果を現在の`playId`に対して一度だけ確定・表示し、同じ問題の再挑戦、モードに応じた次の行動、共有、ホーム、実験場への導線を安全に提供する。

## 基準

- 正式な基準ブランチ: `main`
- 基準コミット: `e9971071f1417029bb990de12cf54dadc7734454`
- 基準内容: Pull Request #8統合後のP2-04完了地点
- 作業ブランチ: `agent/hakodase-p2-05-result-share`
- Pull Request base: `main`

## 今回の一目的

```text
クリア結果をresult画面へ一度だけ表示し、再挑戦、エンドレスの次問題、共有、ホーム、実験場導線を接続する。
```

## 実装対象

### 純粋モデル・サービス

```text
src/app/result-model.js
src/services/share-result.js
src/services/ranking.js
```

### DOM統合

```text
src/ui/result-flow.js
src/p2-05-bootstrap.js
src/ui/countdown-flow.js
index.html
styles/p2-05.css
```

### テスト

```text
test/result-model.test.js
test/share-result.test.js
test/result-flow.test.js
test/ranking.test.js
test/countdown-flow.test.js
test/app-shell.test.js
test/app-boundaries.test.js
```

### 文書

```text
docs/P2_05_RESULT_SHARE_v2.md
CURRENT_TASK.md
DECISION_LOG.md
docs/COMPLETION_STATUS_v2.md
docs/REVIEW_CHECKLIST_v2.md
docs/architecture.md
README.md
```

## 実装内容

### 結果の一回性

- クリア後の`RunController.status === cleared`を確認してから結果へ遷移する。
- `playId`、処理中集合、表示済み集合で二重結果を防ぐ。
- 古いクリア処理や遅延演出が、新しいプレイの結果画面を開かない。
- クリア時刻はGameEngineが固定した値を使用し、結果演出時間を含めない。
- リタイアと無効化は結果記録を作らず、従来どおり理由を示してホームへ戻す。

### 結果表示

- クリアタイム。
- `swipeCount`。
- `distanceCells`。
- `undoCount`。
- `optimalSwipes`と、その差。
- モード名。
- `puzzleId`がある場合は問題ID、現在はseed。
- 同じモード・難易度・seedの端末内初回・ベスト。
- 端末内保存状態。
- Phase 4用のオンライン送信状態欄。

旧MVP盤面の`optimalSwipes`が厳密でない場合は「目安」と表示し、公式最短と誤認させない。

### 再挑戦と次の行動

- 「同じ問題を再挑戦」は同じseedで新しい`playId`を発行する。
- 再挑戦もP2-03の`3・2・1・START`を必ず通る。
- エンドレスだけ「新しい盤面へ」を表示する。
- 本日の出荷プレビューと練習では次問題ボタンを表示しない。
- ホームへ戻る時は盤面、演出、現在プレイ参照を破棄する。

### 共有

1. Web Shareを試す。
2. 利用者キャンセルはエラー扱いにしない。
3. Web Shareの技術的失敗時はClipboardを試す。
4. Clipboardも使えない場合は選択可能な共有文を表示する。
5. 共有失敗や取消後も結果画面を利用できる。

共有文にはゲーム名、記録、操作数、現在の問題識別情報、現在のページURLを含める。公開URL未確定のため、仮URLを固定しない。

### 端末内初回・ベスト

- 集計条件は`mode + difficulty + seed`とする。
- 初回は最古の`clearedAt`。
- ベストはタイム昇順、同タイムは操作数昇順、さらに達成日時昇順。
- 本日の出荷プレビューと練習は記録対象外と表示する。

## 対象外

- Supabase、SQL、オンラインランキング送信。
- 公式問題集、正式`puzzleId`、日替わり選出。
- サーバー初回・ベスト・順位。
- 盤面生成第2世代。
- 出荷レーン、出荷シャッター。
- Three.js/WebGL。
- Phase 1・2の全ブラウザ／実機Gate。

## 検証

- 結果モデル、共有フォールバック、結果DOM統合、端末内集計に関する対象テストを追加する。
- 同じ問題の再挑戦が`result → countdown`を通ることを検査する。
- GitHubリポジトリ全体の`npm test`、`git diff --check`、実ブラウザ、320×568、iPhone、iPadはPull Request作成前後に確認可能な範囲を明記する。

## 完了条件

- [x] `result`画面へ結果の全指標を表示できる。
- [x] 一つの`playId`で結果画面を一度だけ開く。
- [x] 古い`playId`の遅延結果を拒否する。
- [x] 同じ問題を新しい`playId`で再挑戦できる。
- [x] 再挑戦がカウントダウンを通る。
- [x] エンドレスだけ新しい盤面へ進める。
- [x] 同じ条件の端末内初回・ベストを集計する。
- [x] Web Share、Clipboard、選択可能テキストの順にフォールバックする。
- [x] 共有取消をエラー扱いにしない。
- [x] ホームと実験場への導線を持つ。
- [ ] リポジトリ全体の`npm test`が合格する。
- [ ] `git diff --check`が合格する。
- [ ] 実ブラウザで結果、再挑戦、共有を確認する。
- [ ] 320×568で結果画面の主要情報とボタンを確認する。
- [ ] iPhone・iPad実機で確認する。

## 次に行う作業

P2-05統合後は、新機能を追加する前に次を開始する。

```text
P2-06: Phase 1・2 統合ブラウザ検証Gate
```

P2-06では全Nodeテスト、主要状態遷移、320×568、390×844、PC、コンソールエラー、公式中断無効化、undo・リタイア・再挑戦・共有の競合をまとめて検証する。
