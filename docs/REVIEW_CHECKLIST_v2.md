# HAKODASE v2 レビュー・チェックリスト

## Phase 1: 現行コードの正しさ
- [ ] `swipeCount` と `distanceCells` が分離されている。
- [ ] 競技タイマーが `performance.now()` 基準になっている。
- [ ] GOと同時に外部からタイマーを開始できる。
- [ ] `pointercancel` と `lostpointercapture` で操作を破棄する。
- [ ] アニメ中入力制御がある。
- [ ] アニメが経過時間型である。
- [ ] 箱と出口の記号が対応している。
- [ ] ソルバーが `optimalSwipes` を扱える。
- [ ] 戻す履歴の土台がある。

## Phase 2: 画面遷移とモード
- [ ] `home`、`nameConfirm`、`countdown`、`playing`、`result` がある。
- [ ] `rules`、`ranking` が補助状態として扱われる。
- [ ] 練習、本日の出荷、エンドレスが混ざらない。
- [ ] シェアと実験場導線がある。

## Phase 3: 盤面生成第2世代
- [ ] 複数箱、複数同色箱に対応する。
- [ ] `optimalSwipes` 20〜35の検証済み問題集がある。
- [ ] `puzzleId`、`rulesVersion`、`generatorVersion`、`boardHash` がある。
- [ ] 1000件以上の候補検査を行う。

## Phase 4: Supabase
- [ ] 現行RPCと表を確認している。
- [ ] 正式なslugとURLを確認している。
- [ ] 初回記録とベスト記録を分けられる。
- [ ] 1プレイ1送信を保証する。
- [ ] 同じ問題だけのランキングになっている。
- [ ] RLSとPublishable keyの範囲を確認している。
- [ ] 通信失敗で結果を失わない。

## Phase 5: 独自ギミック
- [ ] 出荷レーンが矢印方向だけ通す。
- [ ] 出荷シャッターが `swipeCount` で開閉する。
- [ ] 次状態表示がある。
- [ ] チュートリアルで説明される。
- [ ] ソルバーと生成へ反映されている。

## Phase 6: 公開判定
- [ ] ブラウザ自動テストに合格する。
- [ ] 実機テストに合格する。
- [ ] 性能測定に合格する。
- [ ] Codeberg Pages公開手順が確認済みである。
- [ ] 実験場トップと詳細ランキングの導線が確認済みである。
- [ ] Supabase `public.games` の設定が確認済みである。
- [ ] シェア文言が確認済みである。
- [ ] 公開版をタグ、ZIP名、`CLIENT_VERSION`、`rulesVersion`、`generatorVersion`で識別できる。

## 公開受け入れ条件
- [ ] v2契約に反する仕様がない。
- [ ] 実機未確認の端末を保証済みと書いていない。
- [ ] Supabaseの未確認事項を確認済みと書いていない。
- [ ] secret key、service role key、管理用トークンを含まない。
- [ ] 推測SQLをリポジトリへ追加していない。
- [ ] Three.js/WebGLを今回の実装対象として扱っていない。
