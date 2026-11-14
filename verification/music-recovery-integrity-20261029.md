# 保存・復旧の安全性改善 — 2026-10-29 JST

起点: PR #531 / 1eee14598fd7bda07ded231f7cd24b7e26dc8922。
確認時、Draft・未Merge、対象HEADの12ワークフローがすべてsuccess。

## 確認した問題とproduction修正

- `putAutoBackup`だけがArchive Blobをそのまま保存していた。長時間WAV保存と同じ1 MiB単位の読み取り・所有Blob化を適用し、読み取り完了後にstrict IndexedDB transactionへ渡す。大容量は所有Blob partsを合成する。保存応答は引き続きtransaction complete後。
- Blob sliceの読み取りが宣言サイズより短い場合を共通バイナリ保存経路で拒否する。失敗時は既存バックアップへ書き込まない。
- Full WAV Archiveの作成はチェックサムを検査していたが、実WAVのframes/sampleRate/channelsを照合していなかった。Restoreと同じストリーム復号検証を作成時にも実施し、復元不能なArchiveの公開を防ぐ。
- キャッシュ識別子1.4.205。DB version/store/schema、旧バイナリ読取、JSON/Archive形式は変更なし。

## 回帰テスト

追加4件: バックアップ保存前の所有化、読み取り失敗時の既存保持、短い読み取り時の既存保持、認証済みWAVとフレーム情報の不一致拒否。
キャッシュ期待値を更新。既存のquota/cancel/conflict、依存ファイル欠落・破損、add-only復元、再Open、Undo/Redoと音声同一性テストを継続。

## 判定と残件

No.22・23は改善したがCを維持する。正式30機能のA=0 / B=0 / C=30という既存判定を昇格しない。
物理強制終了・電源断、別Mac配布確認は未実施。Cloud Sync方針、識別情報のない旧依存ファイルの完全移行は残る。
Pagehideで開始する非同期書込の完了保証はできず、制御された終了は既存のawait prepareForShutdown契約を使う。
Archive作成にはストリーム復号走査が追加されるため、長い音声では検証時間が増える。
