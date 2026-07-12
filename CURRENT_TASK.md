# CURRENT_TASK: HAKODASE Phase 1 現行コードの正しさ

## 目的
旧MVPの中核コードをHAKODASE v2 Phase 1契約へ合わせ、操作数・移動距離・競技時計・入力中断・経過時間型アニメーション・最短操作ソルバー・undo履歴の土台を実装する。

## 基準ブランチとコミット
- 基準ブランチ: `work`（リモート未設定のためローカルHEADを採用）
- 基準コミット: `825779445558eb1228bf44c13b70abdd7db5d901`
- 作業ブランチ: `codex/hakodase-phase1-correctness`

## 対象
- `src/core/` の指標、時計、undo、ソルバー、旧MVP生成メタデータ
- Pointer Eventsの中断処理
- Canvas表示の出口記号、経過時間型アニメーション、入力ロック
- HUD表示とローカルランキングv2保存キー
- Phase 1に対応するNode標準テスト

## 対象外
ホーム画面、名前入力、3・2・1カウントダウン、正式な結果画面、3モード分離、公式日替わり問題、盤面生成第2世代、箱8〜14個、同色複数箱、Supabase、SQL、オンラインランキング、出荷レーン/シャッター生成、Three.js/WebGL、Web Worker、TypeScript化、新依存は実装しない。

## 変更ファイル
- `src/core/engine.js`, `src/core/solver.js`, `src/core/generator.js`
- `src/input/pointer-input.js`
- `src/render/animation.js`, `src/render/canvas-renderer.js`
- `src/main.js`, `src/ui/hud.js`, `src/services/ranking.js`
- `test/engine.test.js`, `test/solver.test.js`, `test/generator.test.js`, `test/ranking.test.js`, `test/input.test.js`, `test/hud.test.js`, `test/animation.test.js`
- `README.md`, `docs/requirements.md`, `docs/implementation-plan.md`, `docs/architecture.md`, `docs/REVIEW_CHECKLIST_v2.md`, `DECISION_LOG.md`, `CURRENT_TASK.md`

## 検証
- `npm test`: 59件合格
- `git diff --check`: 合格
- 静的検索で旧用語・互換箇所を確認
- ブラウザ実機確認: 未実施

## 残課題
- 現行旧MVP生成の `optimalSwipes` は箱数程度で、v2公式条件の20操作以上ではない。
- Phase 2でホーム/モード/3・2・1/正式結果/undoボタンを実装する。
- Phase 3で検証済み問題集と盤面生成第2世代を実装する。
- Phase 4以降でSupabaseの問題ID対応を確認する。

## Phase 2へ引き継ぐ内容
現行画面では盤面描画後に `engine.start(performance.now())` 相当を呼ぶ暫定開始にしている。Phase 2ではGO表示と同じ開始処理へ置き換える。
