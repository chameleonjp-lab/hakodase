# P2-05 正式結果画面・再挑戦・共有 設計

## 位置づけ

この文書はHAKODASE v2のP2-05で実装する、クリア結果の一回表示、端末内初回・ベスト、再挑戦、共有、ホーム・実験場導線の契約を記録する。

P2-05ではSupabase、公式問題集、正式な`puzzleId`、盤面生成第2世代、独自ギミックを実装しない。

## 一目的

> 現在の`playId`で確定したクリア結果を一度だけ結果画面へ表示し、次の行動を安全に選べるようにする。

## 結果へ進む条件

結果画面へ進めるのは、次をすべて満たす場合だけとする。

```text
AppController.state === playing
RunController.isCurrent(playId) === true
RunController.status === cleared
GameEngine.status === cleared
同じplayIdの結果を未表示
```

`processingPlayIds`、`pendingPlayId`、`shownPlayIds`相当の世代管理で、クリア処理の連打、遅延演出、古いPromiseによる二重遷移を防ぐ。

クリアタイムは`GameEngine.finalElapsedMs`またはRunControllerへ固定済みの`timeMs`を使用する。結果表示の待ち時間とクリア演出時間を加算しない。

リタイアとページ非表示による無効化はクリア結果として扱わず、記録を作成しない。

## 結果表示

結果画面へ最低限表示するもの:

```text
モード名
プレイヤー名
クリアタイム
swipeCount
距離 distanceCells
戻した回数 undoCount
optimalSwipes
optimalSwipesとの差
問題識別情報
端末内初回
端末内ベスト
端末内保存状態
オンライン送信状態欄
```

### 最短表示

- `meta.exact === true`の場合は「最短」と表示する。
- 厳密性が確認できない場合は「目安」と表示する。
- 実操作数が厳密最短より小さい場合は、記録を称賛表示せず整合性確認を促す。
- `optimalSwipes`がない場合は`—`を表示する。

### 問題識別情報

判断順:

1. 正式な`puzzleId`がある場合は問題IDを表示する。
2. P2-05時点ではseedを表示する。
3. どちらもない場合は問題情報なしと表示する。

`official: true`、`preview: false`、正式`puzzleId`ありの全条件を満たすまで、公式結果とは扱わない。

## 端末内初回・ベスト

P2-05の端末内集計は、次の条件が同じ記録だけを対象にする。

```text
mode
difficulty
seed
```

- 初回は最も古い`clearedAt`。
- ベストは`timeMs`昇順。
- 同タイムは`swipeCount`昇順。
- さらに同じ場合は`clearedAt`昇順。
- エンドレスだけを端末内保存・集計対象とする。
- 練習と本日の出荷プレビューは「記録対象外」と表示する。
- 旧v1記録とモード不明のlegacy記録を混ぜない。

サーバー上の初回・ベストはPhase 4で実際のRPCを確認してから実装する。

## 再挑戦

### 同じ問題を再挑戦

- 現在のseedを使用する。
- `RunController.prepare()`で新しい`playId`を発行する。
- `result → countdown`へ遷移する。
- P2-03の`3 → 2 → 1 → START`を必ず通る。
- 前回結果の遅延処理や共有結果を新しいプレイへ作用させない。

Phase 3で正式問題集へ移行した後は、seedだけでなく`puzzleId`と版情報を再挑戦契約へ含める。

### 新しい盤面

エンドレスだけ「新しい盤面へ」を表示する。新しいseedを発行し、新しい`playId`とカウントダウンで開始する。

本日の出荷と練習では、P2-05時点で次問題ボタンを表示しない。

## 共有

共有の試行順:

1. Web Share API。
2. Web Shareの技術的失敗時にClipboard API。
3. Clipboardも失敗または非対応の場合に選択可能なテキスト領域。

Web Shareを利用者がキャンセルした`AbortError`は、失敗やClipboard移行として扱わない。

共有文へ含めるもの:

```text
HAKODASE / ハコダセ
モード
クリアタイム
操作数
正式問題ならpuzzleId
それ以外はseed
undoCountが1以上なら戻した回数
現在のページURL
```

公開URLが未確定の間は固定URLを推測せず、現在のページURLからフラグメントを除いた値を使用する。

共有が失敗または取消になっても、結果画面、再挑戦、ホーム導線は使用できる。

## ホームと実験場

### ホーム

`result → home`遷移後、次を破棄する。

```text
engine
meta
view / target / exiting
particles
選択・プレビュー
currentPlayId
activeMode
activeRunConfig
resultModel
```

RunControllerの終端スナップショットは新しい`prepare()`が発行されるまで保持できるが、画面から古い盤面へ操作できてはいけない。

### 実験場

ホームと同じ実験場URLを使用する。P2-05では未確定のゲーム公開URLを新たに固定しない。

## 通信状態欄

Phase 4でオンライン送信状態を接続できる表示領域を用意する。

P2-05時点の表示:

- 本日の出荷プレビュー: 暫定問題のため送信しない。
- エンドレス・練習: オンライン送信対象外。
- 将来の正式本日の出荷: 未接続（Phase 4）。

通信を実装済みとは表示しない。

## 責務分離

```text
src/app/result-model.js
結果の正規化、表示値、最短差、共有本文。純粋関数。

src/services/share-result.js
Web Share、Clipboard、手動コピー用全文のフォールバック。

src/services/ranking.js
同一条件の端末内初回・ベスト集計。

src/ui/result-flow.js
既存クリア処理、AppController、RunController、結果DOMの統合。

src/p2-05-bootstrap.js
P2-04の後に結果画面統合を一度だけ導入。
```

## スマートフォン対応

- 320px幅では結果指標を横3列の最小表示とし、必要なら文字を縮小する。
- 主要ボタンは44 CSSピクセル以上を維持する。
- 結果画面は縦スクロールで全項目へ到達できる。
- 共有文の手動コピー領域は選択可能にする。
- 横スクロールを発生させない。
- safe areaの既存方針を維持する。

## テスト

### 結果モデル

- 時間、操作、距離、undo、問題情報を固定する。
- 最短と目安を区別する。
- 正式問題IDがある時だけ公式結果とする。
- 共有文へ必要情報を含める。

### 端末内記録

- 初回は最古日時。
- ベストはタイム・操作・日時順。
- モード、難易度、seedが違う記録を混ぜない。

### 共有

- Web Share成功時はClipboardを使わない。
- 利用者キャンセル時はClipboardへ移らない。
- 技術的失敗時はClipboardへ移る。
- すべて使えない時は選択可能全文を返す。

### DOM統合

- 結果遷移は同じ`playId`で一度だけ。
- 古い`playId`は結果を開かない。
- 同じseedの再挑戦が`countdown`へ進む。
- ホーム遷移で盤面参照を破棄する。
- 共有APIがない場合に選択可能テキストを表示する。

## 完了判定

統合可能と判断するには次を満たす必要がある。

1. 既存テストとP2-05対象テストがすべて合格する。
2. クリア結果が一度だけ表示される。
3. 結果の時間がクリア演出で増えない。
4. 同じ問題の再挑戦が新しい`playId`とカウントダウンを使う。
5. 異なるseedの端末内記録を初回・ベストへ混ぜない。
6. 共有取消と失敗で結果画面を失わない。
7. 320×568で結果と主要ボタンを操作できる。
8. Supabase未接続を接続済みと表示しない。
9. P2-06の統合ブラウザ検証を完了済みと主張しない。

## ロールバック

問題がある場合はPull Requestを統合しない。統合後に問題が見つかった場合は、このPull Requestをrevertし、`main`の履歴をforce pushしない。
