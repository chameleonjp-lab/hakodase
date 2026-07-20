# CURRENT_TASK: P2-06 Phase 1・2 統合ブラウザ検証Gate

## 目的

Phase 1・2の中核、画面、入力、時計、結果、共有を、継続実行可能なNode・実ブラウザ試験で検証し、Phase 3へ進む前の回帰防止Gateを作る。

## 基準

- 正式な基準ブランチ: `main`
- 基準コミット: `65ee7c857759c87e586a7d0e93b27dc47bfa91c1`
- 基準内容: Pull Request #10統合後のP2-05完了地点
- 作業ブランチ: `agent/hakodase-p2-06-browser-gate`
- Pull Request: #11
- Pull Request base: `main`

## 今回の一目的

```text
全Nodeテストと320×568・390×844・PCのブラウザ試験をCIで再現し、Phase 1・2の主要フローをGate化する。
```

## 実装対象

### 検証基盤

```text
package.json
package-lock.json
playwright.config.js
.github/workflows/ci.yml
.gitignore
```

### ブラウザ試験

```text
test/browser/phase2-gate.spec.js
```

### 検証で修正した実装

```text
src/p2-03-bootstrap.js
src/p2-04-bootstrap.js
src/p2-05-bootstrap.js
src/app/countdown-controller.js
src/ui/countdown-flow.js
test/countdown-controller.test.js
```

### 文書

```text
docs/P2_06_BROWSER_GATE_v2.md
CURRENT_TASK.md
DECISION_LOG.md
docs/COMPLETION_STATUS_v2.md
docs/REVIEW_CHECKLIST_v2.md
README.md
```

## 自動試験環境

```text
mobile-320-webkit: 320×568 / WebKit / touch
mobile-390-webkit: 390×844 / WebKit / touch
desktop-chromium: 1280×720 / Chromium
```

Playwrightは開発・CI専用依存とする。公開ゲームの実行時依存には追加しない。

## 自動検証項目

- ホーム画面と共通導線。
- 横スクロールがないこと。
- P2-03・04・05のbootstrapが実ブラウザで接続されること。
- `home → nameConfirm → countdown → playing`。
- START前の盤面非表示と0.00秒。
- START後の盤面公開と時計開始。
- 結果の一回表示。
- 結果のタイム、操作、距離、undo、問題識別情報。
- 同じ問題の再挑戦と新しい`playId`。
- 再挑戦のカウントダウン開始時にHUDが0へ戻ること。
- 共有非対応時の選択可能テキスト。
- `pointercancel`と`lostpointercapture`で操作を確定しないこと。
- リタイア確認と、リタイア時に結果を作らないこと。
- 本日の出荷のページ非表示無効化。
- `console.error`と未処理ページ例外が0件であること。

## GitHub Actions

### Node tests and diff check

- Node.js 24。
- `npm ci`。
- Pull Request全差分の`git diff --check`。
- `npm test`。
- Node出力をartifactとして保存する。

### Browser gate

- ChromiumとWebKitを固定版Playwrightで導入。
- `npm run test:browser`。
- HTML report、trace、video、screenshotを成果物として保存する。

## 検証で発見・修正した不具合

### 1. Phase bootstrapの起動順依存

独立したmodule scriptが`Game`生成前に実行されると、P2-03・04・05の統合が一度失敗したまま再試行されなかった。

修正:

- 即時インストールを試す。
- 未準備なら`DOMContentLoaded`と`load`で再試行する。
- 各installerの二重導入防止を維持する。

### 2. カウントダウンが3で停止

注入したブラウザ標準`setTimeout`をControllerのメソッドとして呼び、receiverが漏れていた。

修正:

- スケジューラと取消関数をreceiver-neutralなclosureで保持する。
- receiver依存関数を使うNode回帰テストを追加する。

### 3. 結果から再挑戦した時の旧タイム残留

`result → countdown`の遷移通知時に、前回結果のタイムが一瞬残っていた。

修正:

- 新しい試行の準備前に入力をロックする。
- タイム、操作、移動、undo表示を0へ戻してから`countdown`へ遷移する。

## 自動Gate結果

GitHub Actions Run #14で次が成功した。

```text
Node tests and diff check: success
Browser gate: success
```

- Nodeテスト150件が合格した。
- `git diff --check`が合格した。
- 3つのブラウザprojectが合格した。
- 320×568、390×844、1280×720で横スクロールを検出しなかった。
- console errorと未処理ページ例外を検出しなかった。
- 320×568を含むホーム・結果スクリーンショットを確認した。
- モバイル代表試験だけを対象外projectでskipする設計であり、予期しないskipはない。

## 手動実機Gate

自動WebKitの合格を、iPhone実機確認済みとは扱わない。

残る手動確認:

- iPhone SE級、iPhone 11 Pro、iPhone 17 Pro。
- iPad Pro 2018の縦・横向き。
- Safariのソフトウェアキーボードと`blur()`。
- 画面ロック、アプリ切替。
- Web Share共有シートと取消。
- safe area、ダブルタップ、ピンチ、長押し、画面回転。

## 対象外

- 盤面データv2。
- 生成器v2と公式問題集。
- `puzzleId`と日替わり選出。
- Supabase、SQL、オンラインランキング。
- 出荷レーン、出荷シャッター。
- Three.js/WebGL。
- Codeberg公開。

## 検証状況

- [x] Playwright設定を追加した。
- [x] 3環境のブラウザ試験を追加した。
- [x] GitHub ActionsへNode・browser jobを追加した。
- [x] 失敗時の証拠保存を追加した。
- [x] GitHub ActionsのNode jobが合格した。
- [x] GitHub ActionsのBrowser jobが合格した。
- [x] 自動retryで救済された失敗がないことを確認した。
- [x] ブラウザ試験のホーム・結果スクリーンショットを確認した。
- [ ] iPhone・iPad実機Gateを完了する。

## 統合禁止条件

- NodeまたはBrowser jobが失敗する。
- 横スクロールを検出する。
- コンソールエラーまたはページ例外を検出する。
- START前に盤面や時計が進む。
- 入力中断で操作が確定する。
- 結果、リタイア、再挑戦が二重に処理される。
- 実機未確認なのに対応済みと記載する。

## 次に行う作業

Pull Request #11統合後も、P2-06は「自動Gate合格・手動実機Gate待ち」とする。

手動実機Gateを完了した後、最新`main`から次へ進む。

```text
P3-01: 盤面データv2・版管理
```
