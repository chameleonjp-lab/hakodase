# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は、各作業単位の現在状態を更新する進捗表である。

仕様と完了条件は各v2契約文書と`COMPLETION_PLAN_v2.md`を優先する。

最終更新日: 2026年7月20日

## 現在地

| ID | 作業 | 状態 | 根拠・残件 |
| --- | --- | --- | --- |
| Phase 0 | v2仕様契約 | 完了 | Pull Request #1で統合済み |
| Phase 1 | 中核コードの正しさ | 自動Gate合格・実機待ち | Pull Request #2で統合済み。P2-06でNode全150件とブラウザ回帰を再検証 |
| G-01 | Git基準整理 | 文書統合済み・設定確認待ち | Pull Request #4で統合済み。正式なPR baseは`main`。既定ブランチと保護設定の画面確認が残る |
| P2-01 | アプリ状態機械 | 統合済み・自動Gate合格 | Pull Request #5で統合済み。状態遷移と`playId`をNode・ブラウザで再検証 |
| P2-02 | ホーム・名前・モード | 統合済み・自動Gate合格 | Pull Request #6で統合済み。320×568、390×844、PCで主要導線を検証。実機キーボード確認が残る |
| P2-03 | カウントダウン・公式時計 | 統合済み・自動Gate合格 | Pull Request #7で統合済み。P2-06でbootstrap順序とtimer receiverの不具合を修正 |
| P2-04 | プレイ画面・undo・リタイア・詰み | 統合済み・自動Gate合格 | Pull Request #8で統合済み。#9は重複のため未マージでclose。実機操作確認が残る |
| P2-05 | 結果・再挑戦・共有 | 統合済み・自動Gate合格 | Pull Request #10で統合済み。P2-06で結果、再挑戦、共有フォールバックをブラウザ検証 |
| P2-06 | Phase 1・2統合ブラウザGate | 自動Gate合格・手動実機待ち | Pull Request #11。GitHub Actions Run #14でNode・Browserの両job成功。iPhone・iPad実機Gateが残る |
| P3-01 | 盤面データv2・版管理 | 未着手 | P2-06の手動実機Gate完了後に開始する |

## P2-06自動Gateの結果

### GitHub Actions

```text
Run #14
Node tests and diff check: success
Browser gate: success
```

- Node.js 24で`npm ci`、`git diff --check`、Nodeテスト150件が成功した。
- Playwright 1.61.1で3つのbrowser projectが成功した。
- 対象viewportは320×568、390×844、1280×720。
- 横スクロール、`console.error`、未処理ページ例外を検出しなかった。
- ホームと結果のスクリーンショットを3project分保存し、320×568を含め主要表示の横切れがないことを確認した。
- モバイル専用ケースは代表WebKit projectだけで実行し、他projectでは意図的にskipする。

### 自動ブラウザで確認した主要フロー

```text
home
→ nameConfirm
→ countdown
→ playing
→ result
→ countdown（同じ問題の再挑戦）
```

確認内容:

- START前の盤面非表示と0.00秒。
- START後の盤面公開と時計開始。
- 残り箱表示。
- 結果のタイム、操作、移動、undo、問題識別情報。
- 結果の一回表示。
- 同じ問題の再挑戦で新しい`playId`を発行。
- 共有非対応時の選択可能テキスト。
- `pointercancel`と`lostpointercapture`で操作を確定しない。
- リタイアは確認後だけ確定し、結果画面を作らない。
- 本日の出荷のページ非表示無効化。

## P2-06で発見・修正した不具合

### Phase bootstrapの起動順依存

P2-03・04・05のmodule scriptが`Game`生成前に実行されると、統合が接続されない場合があった。

対応:

- 即時導入を試す。
- 未準備なら`DOMContentLoaded`と`load`で再試行する。
- installer側の二重導入防止を維持する。

### カウントダウンが3で停止

ブラウザ標準タイマー関数へ不正なreceiverが渡る経路を修正し、receiver-neutralなclosureを使用した。Node回帰テストも追加した。

### 再挑戦時の旧HUD残留

結果からカウントダウンへ戻る瞬間に前回タイムが残る問題を修正した。新しい試行準備時に入力をロックし、タイム、操作、移動、undoを0へ戻す。

## 残る手動実機Gate

自動WebKitの成功は、iPhone・iPad実機確認済みを意味しない。

- iPhone SE級、iPhone 11 Pro、iPhone 17 Pro。
- iPad Pro 2018の縦向き・横向き。
- Safariのソフトウェアキーボードと名前確定後の`blur()`。
- 画面ロック、アプリ切替時の本日の出荷無効化。
- Web Share共有シートと利用者キャンセル。
- safe area、ピンチ、ダブルタップ、長押し、画面回転。
- 実操作でのundo、リタイア、詰み案内の負担と分かりやすさ。

## 設定画面で残る確認

1. GitHubの既定ブランチが`main`になっていること。
2. `main`へPull Request必須、force push禁止などの保護が設定されていること。

各Pull Requestのbaseは明示的に`main`へ指定する。

## 次の作業

Pull Request #11を統合しても、手動実機Gateを完了するまではP2-06を完全完了としない。

手動実機Gate完了後に開始する工程:

```text
P3-01: 盤面データv2・版管理
```

Phase 3の本実装を先行させない。
