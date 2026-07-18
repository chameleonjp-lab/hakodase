# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は、各作業単位の現在状態を更新するための進捗表である。

仕様と完了条件は各v2契約文書と`COMPLETION_PLAN_v2.md`を優先する。

最終更新日: 2026年7月18日

## 現在地

| ID | 作業 | 状態 | 根拠・残件 |
| --- | --- | --- | --- |
| Phase 0 | v2仕様契約 | 完了 | Pull Request #1で統合済み |
| Phase 1 | 中核コードの正しさ | コード完了 | Pull Request #2で統合済み。Node標準テスト59件合格。ブラウザ・実機未確認 |
| G-01 | Git基準整理 | 文書統合済み・設定確認待ち | Pull Request #4で統合済み。正式なPR baseを`main`に固定。GitHub既定ブランチと保護設定の画面確認が残る |
| P2-01 | アプリ状態機械 | 実装済み・レビュー待ち | `AppController`、`RunController`、状態遷移表、追加テスト、設計文書を作成。リポジトリ全体のテストとブラウザ接続は未確認 |
| P2-02 | ホーム・名前・モード | 未着手 | P2-01統合後、最新`main`から開始する |

## P2-01で実装したこと

### 画面状態

```text
home
nameConfirm
countdown
playing
result
rules
ranking
```

- 許可遷移を`src/app/app-state.js`へ固定した。
- `AppController`が禁止遷移、同一状態、未知状態を拒否する。
- 成功遷移ごとに`version`を進め、古い画面世代を判定できる。
- 購読解除と`destroy()`でイベントを残さない。

### 1プレイ管理

```text
prepared
playing
cleared
retired
invalidated
```

- `RunController.prepare()`ごとに単調増加する`playId`を発行する。
- 古い`playId`による開始、完了、リタイア、無効化を拒否する。
- 一つのプレイを一度だけ終端化する。
- `runIfCurrent()`で古いPromise、タイマー、通信結果を現在プレイへ作用させない。
- 外部へ返す設定と結果を複製し、外部変更から内部状態を守る。

詳細は[P2-01状態機械設計](P2_01_STATE_MACHINE_v2.md)を参照する。

## P2-01の検証状況

- 新規モジュールを再現したローカル環境でNodeの構文と基本動作を確認した。
- GitHub公開URLへ接続できない環境だったため、リポジトリ全体の`npm test`は未実施。
- 既存59件と追加テストの一括合格が統合条件として残る。
- 現行`src/main.js`への本接続、ブラウザ確認、実機確認は未実施。

## 設定画面で残る確認

GitHub連携では、次のリポジトリ設定は変更・確認できていない。

1. 既定ブランチが`main`になっていること。
2. `main`へPull Request必須、force push禁止などの保護が設定されていること。

設定が未完了でも、各Pull Requestのbaseを明示的に`main`へ指定して作業する。

## 次の作業

P2-01のPull Request統合後、次は`P2-02 ホーム・名前確認・3モード選択`である。

一目的:

> AppControllerを実際のDOMへ接続し、名前確認と練習・本日の出荷・エンドレスの選択を安全にプレイ準備へ渡す。

P2-02ではカウントダウンの表示と正式なGO時計、正式結果画面、Supabase、盤面生成第2世代を同時に実装しない。

## 次工程の開始条件

- P2-01の全テストが合格している。
- P2-01のDraft Pull Requestがレビュー後に`main`へ統合されている。
- P2-02ブランチを最新`main`から作る。
- P2-02のPull Request baseを`main`へ明示する。
