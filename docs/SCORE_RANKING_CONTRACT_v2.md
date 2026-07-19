# HAKODASE v2 スコア・ランキング契約

## 正本との関係
モードと公式問題の正本は [GAME_CONTRACT_v2.md](GAME_CONTRACT_v2.md)。この文書はスコア、ランキング、Supabase連携の契約を定める。

## スコア定義
```text
スコア名: クリアタイム
良い記録: 小さい値
保存値: 1/100秒の整数
表示: 秒、小数2桁
score_order: asc
score_scale: 100
score_decimals: 2
```

例:

```text
12.34秒 → 1234
```

公式順位の主条件はクリアタイムとする。`distanceCells` は統計や調整用であり、公式順位の主条件には使わない。

## 公式対象
Supabase送信対象は「本日の出荷」の公式競技クリア時だけとする。練習、エンドレス、リタイア、無効化された試行は送らない。

公式ランキングでは、同じ `puzzleId` の検証済み問題だけを比較する。同じ問題であることを確認できない記録を同じ順位へ混ぜない。

## 送信タイミング
- 結果確定前に送らない。
- 1プレイにつき1回だけ送る。
- 結果画面を先に表示し、通信失敗で結果を失わせない。
- 送信中、成功、失敗、未設定を表示する。
- `playId` などで前回通信が次回プレイへ混ざらないようにする。

## P2-05の端末内初回・ベスト

P2-05では、エンドレスの端末内記録だけについて初回とベストを結果画面へ表示する。

集計条件:

```text
mode
difficulty
seed
```

- 初回は対象記録の中で最も古い`clearedAt`。
- ベストは`timeMs`昇順。
- 同タイムは`swipeCount`昇順。
- さらに同じ場合は`clearedAt`昇順。
- 異なるseed、難易度、モードを混ぜない。
- モード未保存のlegacy記録を混ぜない。
- 練習と本日の出荷プレビューは端末内初回・ベストの対象外と表示する。

これは端末単体の参考表示であり、公式の初回記録、ベスト記録、順位ではない。

## 公式の初回記録とベスト記録
本日の出荷では初回記録とベスト記録を扱う。集計方法はSupabase側RPCの実仕様をPhase 4で確認してから実装する。

端末内集計を、そのまま公式初回・ベストとして送信または表示してはいけない。

## 共通RPCの現行想定
現行想定のRPC名は次の通り。ただし、今回Supabase定義を実際に確認していないため「確認済み」とは扱わない。

```text
submit_score
get_first_try_ranking
get_best_score_ranking
get_game_play_stats
```

`submit_score` の現行想定引数:

```text
p_display_name
p_game_slug
p_score
p_client_version
```

## Supabase安全条件
- Publishable keyだけをブラウザで使用できる。
- secret key、service role key、管理用トークンは使用禁止。
- `public.game_scores` へブラウザから直接INSERTせず、確認済みの共通RPCを使う。
- Supabase側の入力検査とアクセス制御を公開条件にする。
- ユーザーのPublishable key、Supabase URL、秘密情報を作業報告へ再掲しない。

## 未確定事項と扱い
現行の共通RPCが `puzzleId` や `challenge_id` を扱えるかは未確認。勝手にRPCやSQLを作り替えない。

扱いの順序:
1. Phase 4で現在のテーブルとRPCを確認する。
2. 同じ問題IDだけを比較できるか確認する。
3. 現行基盤で問題IDを分けられない場合、初回公開の公式競技は1つの固定問題に限定する案を暫定案とする。
4. 日替わり問題のためにDB変更が必要なら、別作業としてSQL案をチャットへ提示し、ユーザー承認後に適用する。
5. 推測したSQLを今回リポジトリへ追加しない。

## TBD
- `GAME_SLUG`: TBD
- Codeberg Pages公開URL: TBD
- カメレオンJPの実験場URL: TBD
- Supabaseの問題ID対応: 未確認
