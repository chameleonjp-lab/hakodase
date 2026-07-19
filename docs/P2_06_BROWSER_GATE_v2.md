# P2-06 Phase 1・2 統合ブラウザ検証Gate

## 位置づけ

P2-06は新機能の実装工程ではない。Phase 1とPhase 2で追加した中核、画面、入力、時計、結果、共有を、実ブラウザと継続実行可能なCIでまとめて検証するGateである。

P2-06を通過するまで、Phase 3の盤面データv2、生成器v2、公式問題集の本実装を開始しない。

## 基準

- 正式基準ブランチ: `main`
- 基準コミット: `65ee7c857759c87e586a7d0e93b27dc47bfa91c1`
- 基準内容: Pull Request #10を統合したP2-05完了地点
- 作業ブランチ: `agent/hakodase-p2-06-browser-gate`
- Pull Request base: `main`

## 一目的

> Phase 1・2の主要フローを320×568、390×844、PCで再現可能に検査し、コンソールエラー、横スクロール、入力中断、二重結果、再挑戦、リタイアの回帰を公開前に検出する。

## 自動検証環境

### Node

- Node.js 24
- `npm ci`
- `git diff --check`
- `npm test`

### ブラウザ

Playwright Testを開発依存として使用し、ゲームの実行時依存には含めない。

| project | engine | viewport | 主目的 |
| --- | --- | --- | --- |
| `mobile-320-webkit` | WebKit | 320×568 | iPhone SE級の最小幅、縦スクロール、safe area前提 |
| `mobile-390-webkit` | WebKit | 390×844 | 標準的なiPhone幅、タッチ、入力中断、確認パネル |
| `desktop-chromium` | Chromium | 1280×720 | PC表示、マウス系ブラウザ、横幅拡大時のレイアウト |

自動試験は実機Safariそのものではない。WebKitの合格を、iPhone実機確認済みとは扱わない。

## 自動試験項目

1. ホームが表示され、主要ボタンと実験場導線が存在する。
2. 各viewportで横スクロールが発生しない。
3. `home → nameConfirm → countdown → playing`が一度ずつ進む。
4. START前はプレイ画面を表示せず、タイムが0.00秒である。
5. START後だけ盤面と時計が動く。
6. 結果は一つの`playId`につき一度だけ表示される。
7. 結果へタイム、操作、移動、undo、問題識別情報を表示する。
8. 結果共有が使えない環境で、選択可能テキストへ退避する。
9. 同じ問題の再挑戦で新しい`playId`を発行し、カウントダウンを通る。
10. `pointercancel`と`lostpointercapture`で操作を確定しない。
11. リタイアは確認前に終端化せず、確定後も結果画面を作らない。
12. 本日の出荷はページ非表示で無効化される。
13. `console.error`と未処理のページ例外が0件である。

## 証拠

GitHub Actionsは次を14日間保持する。

- Playwright HTML report
- 失敗時のtrace
- 失敗時のvideo
- 失敗時のscreenshot
- 各projectのホーム画面・結果画面スクリーンショット

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

### iPad Pro 2018

- 縦向きと横向きで主要画面を確認する。
- Canvasが過度に拡大せず、盤面と操作が同時に理解できる。
- 画面回転中のポインター操作が確定されない。

## Gate判定

### 自動Gate合格

- Node jobが成功する。
- Browser jobが3projectすべて成功する。
- コンソールエラー0。
- 横スクロール0。
- 失敗テスト、flaky test、予期しないskipがない。

### P2-06完全合格

自動Gateに加えて、対象実機の手動チェック結果を記録し、BLOCKERとMUSTが0件であること。

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

自動Gateと手動実機Gateが完了した後、最新`main`からP3-01「盤面データv2・版管理」を開始する。
