# P2-06 Phase 1・2 統合ブラウザ検証Gate

## 位置づけ

P2-06は新機能の実装工程ではない。Phase 1とPhase 2で追加した中核、画面、入力、時計、結果、共有を、実ブラウザと継続実行可能なCIでまとめて検証するGateである。

P2-06を完全通過するまで、Phase 3の盤面データv2、生成器v2、公式問題集の本実装を開始しない。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `65ee7c857759c87e586a7d0e93b27dc47bfa91c1`
- 基準内容: Pull Request #10を統合したP2-05完了地点
- 作業ブランチ: `agent/hakodase-p2-06-browser-gate`
- Pull Request: #11
- Pull Request base: `main`

## 一目的

> Phase 1・2の主要フローを320×568、390×844、PCで再現可能に検査し、コンソールエラー、横スクロール、入力中断、二重結果、再挑戦、リタイアの回帰を公開前に検出する。

## 自動検証環境

### Node

- Node.js 24
- `npm ci`
- `git diff --check`
- `npm test`
- Node試験出力をartifactへ保存

### ブラウザ

Playwright Test 1.61.1を開発依存として使用し、ゲームの実行時依存には含めない。

| project | engine | viewport | 主目的 |
| --- | --- | --- | --- |
| `mobile-320-webkit` | WebKit | 320×568 | iPhone SE級の最小幅、縦スクロール、safe area前提 |
| `mobile-390-webkit` | WebKit | 390×844 | 標準的なiPhone幅、タッチ、入力中断、確認パネル |
| `desktop-chromium` | Chromium | 1280×720 | PC表示、マウス系ブラウザ、横幅拡大時のレイアウト |

自動試験は実機Safariそのものではない。WebKitの合格を、iPhone実機確認済みとは扱わない。

## 自動試験項目

1. ホームが表示され、主要ボタンと実験場導線が存在する。
2. P2-03・04・05のbootstrapが実ブラウザで接続される。
3. 各viewportで横スクロールが発生しない。
4. `home → nameConfirm → countdown → playing`が一度ずつ進む。
5. START前はプレイ画面を表示せず、タイムが0.00秒である。
6. START後だけ盤面と時計が動く。
7. 結果は一つの`playId`につき一度だけ表示される。
8. 結果へタイム、操作、移動、undo、問題識別情報を表示する。
9. 結果共有が使えない環境で、選択可能テキストへ退避する。
10. 同じ問題の再挑戦で新しい`playId`を発行し、カウントダウンを通る。
11. 再挑戦のカウントダウン開始時に前回のHUD値を残さない。
12. `pointercancel`と`lostpointercapture`で操作を確定しない。
13. リタイアは確認前に終端化せず、確定後も結果画面を作らない。
14. 本日の出荷はページ非表示で無効化される。
15. `console.error`と未処理のページ例外が0件である。

## 自動Gate実績

GitHub Actions Run #14で次が成功した。

```text
Node tests and diff check: success
Browser gate: success
```

- Nodeテスト150件が合格した。
- `git diff --check`が合格した。
- 3つのbrowser projectが合格した。
- 横スクロールを検出しなかった。
- `console.error`と未処理ページ例外を検出しなかった。
- 自動retryで救済された失敗はなかった。
- モバイル代表ケースだけを他projectで意図的にskipし、予期しないskipはなかった。

## 証拠

GitHub Actionsは次を14日間保持する。

- Playwright HTML report
- 失敗時のtrace
- 失敗時のvideo
- 失敗時のscreenshot
- 各projectのホーム画面・結果画面スクリーンショット
- Node試験出力

Run #14のbrowser evidenceを確認し、320×568、390×844、1280×720のホームと結果画面に横切れや主要ボタン欠落がないことを確認した。

## 検証で発見・修正した不具合

### Phase bootstrapの起動順依存

独立したmodule scriptの評価順によって、P2-03・04・05のinstallerが`Game`生成前に一度失敗し、正式カウントダウン、プレイ操作、結果画面が接続されない場合があった。

対応:

- 即時導入を試す。
- 未準備なら`DOMContentLoaded`と`load`で再試行する。
- 各installerは二重導入を拒否する。
- ブラウザ試験で3つの導入済みflagを確認する。

### カウントダウンのtimer receiver

注入したブラウザ標準`setTimeout`をControllerのメソッドとして呼ぶと、不正なreceiverが渡り、3で停止する場合があった。

対応:

- scheduleとcancelをreceiver-neutralなclosureで保持する。
- receiver-sensitive関数を使ったNode回帰テストを追加する。

### 再挑戦時の旧HUD値

結果から同じ問題を再挑戦すると、`result → countdown`の遷移通知時に前回のタイムが一瞬残っていた。

対応:

- 新しい試行の準備開始時に入力をロックする。
- タイム、操作、移動、undo表示を0へ戻してから`countdown`へ遷移する。

## 手動実機Gate

次は自動WebKitだけでは完了扱いにしない。

### iPhone SE級・iPhone 11 Pro・iPhone 17 Pro

- Safariでホームから結果まで操作する。
- ソフトウェアキーボード表示後に横ずれしない。
- 名前確定後にキーボードが閉じる。
- ピンチズーム、ダブルタップ拡大、長押し選択がゲームを壊さない。
- 画面ロック、アプリ切替で本日の出荷が無効になる。
- Web Shareの共有シートを開ける。
- 共有をキャンセルしても結果画面へ戻れる。
- safe areaにボタンが隠れない。
- undo、リタイア、詰み案内の負担と分かりやすさを確認する。

### iPad Pro 2018

- 縦向きと横向きで主要画面を確認する。
- Canvasが過度に拡大せず、盤面と操作が同時に理解できる。
- 画面回転中のポインター操作が確定されない。

## Gate判定

### 自動Gate

**合格。**

- Node job成功。
- Browser job成功。
- コンソールエラー0。
- 横スクロール0。
- 予期しないskip、retry救済、失敗テストなし。

### P2-06完全合格

**未完了。**

自動Gateに加えて、対象実機の手動チェック結果を記録し、BLOCKERとMUSTが0件になる必要がある。

### 統合禁止

- Nodeまたはbrowser jobが失敗。
- 同じ操作で再現するコンソールエラー。
- 320pxで主要ボタンが押せない。
- START前に盤面または時計が進む。
- `pointercancel`または`lostpointercapture`で移動が確定する。
- クリア、リタイア、再挑戦が二重に終端化する。
- 共有失敗で結果画面が操作不能になる。
- 実機未確認なのに実機対応済みと記載する。

## 対象外

- 盤面生成第2世代。
- 公式問題集と`puzzleId`。
- SupabaseとSQL。
- オンラインランキング。
- 出荷レーン、出荷シャッター。
- Three.js/WebGL。
- 公開URL確定とCodeberg配備。

## 次工程

Pull Request #11統合後も、対象実機の手動Gateが完了するまではP3-01を開始しない。

完全合格後、最新`main`からP3-01「盤面データv2・版管理」を開始する。
