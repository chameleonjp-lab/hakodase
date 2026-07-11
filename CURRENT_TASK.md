# CURRENT_TASK: HAKODASE v2 仕様契約の確定

## 目的
HAKODASE v2のゲーム仕様、競技条件、スマホ操作、性能、ランキング、公開方針を文書で確定し、後続実装が別仕様へ逸脱しない状態を作る。

## 対象
- v2契約文書の新規作成
- 既存文書のうち、旧MVP仕様とv2契約の関係が分かる導線の更新

## 対象外
- ゲームコード、画面、盤面生成、Supabase通信、SQL、Three.js/WebGLの実装
- 既存UIの変更
- `main` への直接コミット、直接push、直接マージ

## 開始時情報
- 開始時ブランチ: `work`
- 開始時コミット: `4ea756d848bcb8b137c9491a381eeecae1c17bc8`
- 基準コミット候補との差: 開始時HEADが基準コミット候補と一致
- ローカルに `main` ブランチなし
- `origin/main` なし
- `git remote -v` は空で、リモート未設定
- 開始時の未コミット差分: なし

## 作業ブランチ
- `fix/hakodase-contract-v2`

## 変更対象
### 新規
- `CURRENT_TASK.md`
- `DECISION_LOG.md`
- `docs/EXPERIENCE_CONTRACT_v2.md`
- `docs/GAME_CONTRACT_v2.md`
- `docs/SCORE_RANKING_CONTRACT_v2.md`
- `docs/MOBILE_TOUCH_CONTRACT_v2.md`
- `docs/PERFORMANCE_BUDGET_v2.md`
- `docs/ORIGINALITY_v2.md`
- `docs/REVIEW_CHECKLIST_v2.md`

### 更新
- `README.md`
- `CLAUDE.md`
- `docs/requirements.md`
- `docs/implementation-plan.md`
- `docs/architecture.md`

## 完了条件
- v2契約が上記文書に記録されている
- 既存文書からv2正本へ辿れる
- 旧MVP仕様とv2契約の違いが明示されている
- `git diff --check` と `npm test` を実行している
- Markdown相対リンク、用語、未確認事項を確認している
- 作業ブランチにコミットしている

## 残課題
- Phase 1以降で実装をv2契約へ合わせる
- Supabaseの現行RPC、テーブル、問題ID対応をPhase 4で確認する
- GAME_SLUG、公開URL、実験場URL、名前最大文字数を確認する
- 実機検証をPhase 6で行う
