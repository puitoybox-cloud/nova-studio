# 完全復旧の履歴保存 — 2026-10-29 JST

起点: PR #532 / 3540c071105ab9df4f4c6830576262077b53503d。GitHub APIでDraft・未Merge、12 workflow successを確認。

## 原因とproduction変更

Full WAV Archiveはprojects/settings/entriesのみを収録し、別IndexedDBストアのMIDI書出・取込履歴を移行しなかった。任意のmidiHistoriesフィールドを追加し、両履歴を収録する。書出し前後の履歴一致を検査し、変更時は公開しない。

復元時は履歴の形とID重複を検査し、履歴IDとprojectIdを新しい復元先に再割当する。削除済み曲の履歴は独立した新IDにまとめ、既存曲に誤結合しない。未知の履歴フィールドは保持する。projects・WAV/依存本体・設定・両履歴は同じstrict transactionでadd-only保存し、一部書込みの失敗では全体をabortする。DB version/store/keyPathと既存JSON形式は変更なし。履歴フィールドのない旧Archiveは空履歴として受理する。旧アプリによる新Archiveの読込みでは新履歴は復元されない。Cache marker 1.4.206。

## 検証

追加4テスト: 別ストレージ移行と新repository再読込・同一IDと繰返し復元、履歴書込失敗による全体rollback、旧Archiveと不正履歴拒否、書出中履歴変更拒否。起点コードでは4件中3件が失敗し、修正コードでは4件成功。既存のbyte一致・MIDI・checkpoint・依存欠落・破損・quota・中断・Undo/Redo検証も継続。実ブラウザCIにも両履歴の復元先IDと内容照合を追加。

ローカル実ブラウザテストはPlaywrightのChromium実行ファイル不在により起動不可。GitHubの実ブラウザCIで検証する。テスト用fsync backendのプロセス終了試験とproduction IndexedDB試験を区別し、物理電源断の保証と扱わない。

## 判定・残件

No.22/23はC維持。正式30機能は既存判定A=0/B=0/C=30を昇格しない。本作業は全30機能を再評価するものではない。物理Mac強制終了・電源断・別Mac配布受入、Cloud Sync、未認証の旧依存ファイル移行は未完。通常のmetadata-only JSONは両MIDI履歴を収録しないため、履歴を含む移行にはFull WAV Archiveを使う。自動バックアップの履歴だけの変更による生成判定は今回の範囲外。
