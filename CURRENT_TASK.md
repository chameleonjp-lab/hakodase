# CURRENT_TASK: G-01 Git基準整理

## 目的

HAKODASE v2の正式な統合・リリース基準を`main`へ一本化し、以後のPull Requestが古い作業ブランチを基準にしない状態を作る。

## 開始時の確認

- GitHub既定ブランチ表示: `claude/hakodase-puzzle-mvp-82p4qs`
- 最新統合コミット: `c031eb089b9291880ff2e958e38c3f1e9a79de48`
- 開始時の`main`: `4ea756d848bcb8b137c9491a381eeecae1c17bc8`
- `main`は最新統合地点より6コミット遅れていた。
- 最新統合地点は`main`の直系履歴上にあり、fast-forward可能だった。

## 実施内容

- `main`を履歴を書き換えず、`c031eb089b9291880ff2e958e38c3f1e9a79de48`へfast-forwardした。
- 正式な統合・リリース基準を`main`と定めた。
- 今後のPull Requestはbaseを明示的に`main`とする。
- Git基準、Pull Request、保護、リリース、ロールバック方針を`docs/GIT_BRANCH_POLICY_v2.md`へ記録した。
- 各工程の現在状態を`docs/COMPLETION_STATUS_v2.md`へ分離した。
- `DECISION_LOG.md`と`CLAUDE.md`へ基準ブランチ方針を反映する。

## 作業ブランチ

```text
agent/hakodase-git-baseline-v2
```

このブランチは最新の`main`から作成した。

## 対象

- Git基準とブランチ方針
- 現在作業の更新
- 完成状況の更新方法
- 今後のPull Request base
- リリース線とロールバック方法

## 対象外

- P2-01のアプリ状態機械
- ゲームコードと画面
- Supabase、SQL、Codeberg Pages
- GitHub既定ブランチ設定の変更
- GitHubブランチ保護設定の変更
- 過去の作業ブランチ削除

## 確認できていない設定

GitHub連携から、次のリポジトリ設定は変更・確認できていない。

- 既定ブランチを`main`へ変更したこと
- `main`のブランチ保護設定

設定確認前も、すべてのPull Requestでbaseを明示的に`main`へ指定する。

## 完了条件

- [x] `main`が最新統合コミットと一致する。
- [x] 正式な統合・リリース基準が`main`と文書化される。
- [x] 今後のPull Request baseが`main`へ固定される。
- [x] リリース線とロールバック方法が文書化される。
- [x] 状態更新用文書が追加される。
- [ ] GitHub既定ブランチ設定が`main`であることを設定画面で確認する。
- [ ] `main`の保護設定を設定画面で確認する。

## 次に行う作業

G-01文書の統合後、最新の`main`からP2-01専用ブランチを作る。

```text
P2-01: アプリ状態機械と1プレイ管理
```

P2-01では、画面状態、`playId`相当の世代識別、結果確定の一回性、古いタイマー・イベントの無効化を実装する。ホーム画面全体、名前、カウントダウン表示、正式結果画面は後続Pull Requestへ分ける。
