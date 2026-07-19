# CURRENT_TASK: P2-04 プレイ画面・undo・リタイア・詰み

## 目的

プレイ中に必要な情報と操作だけを表示し、現在の`playId`へundo、リタイア、合法操作0件の詰み処理を安全に接続する。

## 基準

- 正式な基準ブランチ: `main`
- 基準コミット: `24cdb7d4571b98397d18fc0828b17b4e3f4054e9`
- 基準内容: Pull Request #7統合後のP2-03完了地点
- 作業ブランチ: `agent/hakodase-p2-04-playing-controls`
- Pull Request base: `main`

## 今回の一目的

```text
残り箱数、undo、リタイア確認、合法操作0件の詰み案内をプレイ画面へ実装する。
```

## 実装対象

### 中核

```text
src/core/engine.js
src/app/play-control-policy.js
```

### DOM統合

```text
src/ui/hud.js
src/ui/playing-controls.js
src/p2-04-bootstrap.js
index.html
styles/p2-04.css
```

### テスト

```text
test/engine.test.js
test/hud.test.js
test/play-control-policy.test.js
test/playing-controls.test.js
test/app-shell.test.js
test/app-boundaries.test.js
```

### 文書

```text
docs/P2_04_PLAYING_CONTROLS_v2.md
CURRENT_TASK.md
DECISION_LOG.md
docs/COMPLETION_STATUS_v2.md
docs/REVIEW_CHECKLIST_v2.md
```

## 実装内容

### 残り箱数

- `GameEngine.remainingCount`を追加する。
- 退場していない`positions`の数を正本とする。
- プレイ画面へ「残り」を常時表示する。

### undo

- `GameEngine.canUndo`を追加する。
- 履歴があり、プレイ中で、入力ロック中でない時だけ通常ボタンを有効にする。
- undo後は論理位置と表示位置を即時同期する。
- タイマーは戻さない。
- `undoCount`を画面へ表示する。

### リタイア

- 画面内の確認パネルを表示する。
- 確認前に試行を終端化しない。
- 確認後に`RunController.retire()`を一度だけ呼ぶ。
- リタイア記録を保存せずホームへ戻す。

### 詰み

- `GameEngine.hasAnyLegalMove()`を追加する。
- 残り箱があり、合法操作が0件の時だけ詰み案内を表示する。
- 戻す、やりなおし、リタイアを選べる。
- 完全な将来手順の解なし探索は行わない。

### 統合境界

- 純粋な操作可否は`src/app/play-control-policy.js`へ置く。
- DOM統合は`src/ui/playing-controls.js`へ置く。
- P2-03の後に`src/p2-04-bootstrap.js`から一度だけ接続する。
- 既存の大きな`src/main.js`は全面変更しない。

## 対象外

- 正式結果画面。
- 結果シェア。
- 初回・ベスト・順位表示。
- Supabase、SQL、オンラインランキング。
- 公式問題集、`puzzleId`、日替わり選出。
- 盤面生成第2世代。
- 完全な解なし探索。
- 出荷レーン、出荷シャッター。
- Three.js/WebGL。

## 検証

- GameEngine、操作方針、HUD、HTML、DOM統合のP2-04対象17件は、同じコードを再現したNode環境で全件合格した。
- 新規モジュールの構文確認は合格した。
- GitHubリポジトリ全体を取得できない環境のため、既存テストを含む`npm test`は未実施。
- 実ブラウザ、320×568、iPhone、iPadは未確認。

## 完了条件

- [x] 残り箱数をGameEngineから取得できる。
- [x] undo可能状態をGameEngineから取得できる。
- [x] 合法操作0件を軽量判定できる。
- [x] タイム、操作、残りをプレイ中に表示する。
- [x] undo後に表示位置と論理位置を同期する。
- [x] undoでタイマーを戻さない。
- [x] リタイア確認前に終端化しない。
- [x] リタイア確認後に記録なしでホームへ戻る。
- [x] 詰み案内から戻す、やりなおし、リタイアを選べる。
- [x] P2-04対象17件が再現環境で合格する。
- [ ] リポジトリ全体の`npm test`が合格する。
- [ ] 実ブラウザでundo、リタイア、詰みを確認する。
- [ ] 320×568で主要操作と確認パネルを確認する。
- [ ] iPhone・iPad実機で確認する。

## 次に行う作業

P2-04統合後、最新`main`から次を開始する。

```text
P2-05: 正式結果画面・再挑戦・共有・導線
```

P2-05では、クリア結果を一度だけ確定して結果画面へ移し、同じ問題の再挑戦、ホーム、共有、実験場導線を実装する。SupabaseはPhase 4へ分ける。
