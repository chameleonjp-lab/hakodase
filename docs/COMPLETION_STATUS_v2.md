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
| G-01 | Git基準整理 | 実施済み・設定確認待ち | `main`を最新統合コミット`c031eb089b9291880ff2e958e38c3f1e9a79de48`へfast-forward。正式なPR baseを`main`に固定。GitHub既定ブランチと保護設定の画面確認が残る |
| P2-01 | アプリ状態機械 | 次に着手 | G-01文書の統合後、最新`main`から開始する |

## G-01で確定したこと

- 正式な統合・リリース基準は`main`。
- 今後のPull Requestは、すべてbaseを明示的に`main`とする。
- 作業ブランチは毎回最新の`main`から作る。
- 前の作業ブランチを次の作業の基準として使わない。
- `main`への直接push、force push、自動マージを行わない。
- リリースタグと公開版は`main`上の検証済みコミットから作る。
- ロールバックは履歴の書き換えではなく、revert用Pull Requestを基本とする。

詳細は[Git基準・ブランチ運用方針](GIT_BRANCH_POLICY_v2.md)を参照する。

## 設定画面で残る確認

GitHub連携では、次のリポジトリ設定を変更・確認できなかった。

1. 既定ブランチが`main`になっていること。
2. `main`へPull Request必須、force push禁止などの保護が設定されていること。

設定が未完了でも、各Pull Requestのbaseを明示的に`main`へ指定して作業する。

## 次の作業

次は`P2-01 アプリ状態機械`である。

一目的:

> 画面状態と1プレイの状態遷移を一元化し、不正な状態遷移、二重結果、古いタイマーやイベントの混入を防ぐ。

主な成果物候補:

```text
src/app/app-controller.js
src/app/run-controller.js
src/app/app-state.js
test/app-state.test.js
test/run-controller.test.js
```

P2-01では、ホーム画面の完成、名前入力、カウントダウン表示、正式結果画面、Supabase、盤面生成第2世代を同時に実装しない。

## 次工程の開始条件

- G-01の文書Pull Requestが`main`へ統合されている。
- P2-01ブランチを最新`main`から作る。
- P2-01のPull Request baseを`main`へ明示する。
- Phase 1の59テストを開始前基準として維持する。
