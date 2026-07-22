# HAKODASE v2 完成状況

## この文書の役割

`COMPLETION_PLAN_v2.md`は完成までの固定計画を示す。この文書は、各作業単位の現在状態を更新する進捗表である。

仕様と完了条件は各v2契約文書と`COMPLETION_PLAN_v2.md`を優先する。

最終更新日: 2026年7月22日

## 現在地

| ID | 作業 | 状態 | 根拠・残件 |
| --- | --- | --- | --- |
| Phase 0 | v2仕様契約 | 完了 | Pull Request #1で統合済み |
| Phase 1 | 中核コードの正しさ | 自動Gate合格・実機待ち | Pull Request #2で統合済み。P2-06でNode・ブラウザ回帰を再検証 |
| G-01 | Git基準整理 | 文書統合済み・設定確認待ち | Pull Request #4。正式PR baseは`main`。GitHub既定ブランチと保護設定確認が残る |
| P2-01 | アプリ状態機械 | 統合済み・自動Gate合格 | Pull Request #5。状態遷移と`playId`を再検証 |
| P2-02 | ホーム・名前・モード | 統合済み・自動Gate合格 | Pull Request #6。320×568、390×844、PCで主要導線を検証。実機キーボード確認が残る |
| P2-03 | カウントダウン・公式時計 | 統合済み・自動Gate合格 | Pull Request #7。P2-06でbootstrap順序とtimer receiverを修正 |
| P2-04 | プレイ画面・undo・リタイア・詰み | 統合済み・自動Gate合格 | Pull Request #8。実機操作確認が残る。#9は重複のためclose |
| P2-05 | 結果・再挑戦・共有 | 統合済み・自動Gate合格 | Pull Request #10。結果、再挑戦、共有フォールバックをブラウザ検証 |
| P2-06 | Phase 1・2統合ブラウザGate | 自動Gate合格・手動実機BLOCKER修正中 | Pull Request #11で自動Gate合格。iPhone実機で4操作盤面を確認し、Pull Request #14で修正中 |
| P2-06-B1 | 非自明盤面暫定修正 | 実装済み・レビュー待ち | 初期直行箱0件、厳密最短8〜12操作の試作盤面5件。Node・Browser Gate成功 |
| P3-01 | 盤面データv2・版管理 | 未着手 | #14公開後の実機再試遊でBLOCKER解消を確認してから開始 |

## 手動実機Gateで見つかったBLOCKER

### 症状

Codeberg Pages公開版のエンドレスをiPhone 17 Proで試遊したところ、標準盤面が4箱・最短4操作だった。

各箱を対応出口の方向へ1回ずつ動かすだけでクリアでき、壁は解法の順序や退避を要求していなかった。

### 原因

旧MVP生成器は可解性を保証するため、各箱を対応出口から盤内へ一直線に逆挿入していた。

```text
4色
= 4箱
= 各箱1回で退場
= 最短4操作
```

距離下界や壁数の条件はあったが、最短操作数の下限と箱同士の依存関係を検査していなかった。

## Pull Request #14の暫定修正

### 試作盤面バンク

- 基礎盤面5件。
- 7×9、4箱。
- 厳密最短操作数: 8、8、9、10、12。
- 初期状態から出口へ直行できる箱: 0件。
- 現行の厳密ソルバーで開発時に再検証。
- プレイ開始時にはソルバーを実行しない。

### seedによる変化

seedから次を決定論的に選ぶ。

- 基礎盤面。
- 左右反転。
- 上下反転。
- 180度回転。
- 色置換。

同じseedは同じ盤面と`puzzleId`を返す。

### 自動Gate

GitHub Actions Run #22:

```text
Node tests and diff check: success
Browser gate: success
```

- Node全156件成功。
- `git diff --check`成功。
- 320×568 WebKit成功。
- 390×844 WebKit成功。
- 1280×720 Chromium成功。
- 基礎盤面5件の厳密最短値が期待値と一致。
- 初期直行箱0件を確認。
- normalフォールバックも旧4操作盤面へ戻らない。

## 暫定修正で未達の条件

Pull Request #14をPhase 3完了とは扱わない。

```text
箱8〜14個
色3〜6色
厳密最短20〜35操作
1000件以上の候補検査
正式なschemaVersion / rulesVersion / generatorVersion
正規化boardHash
正式puzzleId
人による試遊済み公式問題集
```

基礎構造が5件しかないため、反転・色置換による見た目の変化を公式問題数として数えない。

## 残る手動実機Gate

- Pull Request #14をCodebergへ公開後、iPhone 17 Proで複数seedを試遊する。
- 8〜12操作の過程に、退避、順序判断、箱同士の利用があるか確認する。
- undo、リタイア、詰み案内を実操作する。
- iPhone SE級、iPhone 11 Pro、iPad Pro 2018も確認する。
- ソフトウェアキーボード、画面ロック、アプリ切替、Web Share、safe area、画面回転を確認する。

## 設定画面で残る確認

1. GitHubの既定ブランチを`main`へ変更する。
2. `main`へPull Request必須、force push禁止などの保護を設定する。

各Pull Requestのbaseは明示的に`main`へ指定する。

## 次の作業

1. Pull Request #14をレビューして統合する。
2. Codeberg Pages自動配備を確認する。
3. iPhoneで複数seedを再試遊する。
4. BLOCKER解消後、P3-01「盤面データv2・版管理」を開始する。
