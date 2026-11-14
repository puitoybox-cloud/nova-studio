# MIDI履歴だけの更新を自動バックアップへ収録

確認日: 2026-10-29 JST。起点: PR #533 / a89c58a572adf87b258794839463ef6d9f1edbad。GitHub APIでDraft、未Merge、対象12 workflow successを再確認。

原因: backupSignatureはprojectId/revision/updatedAtと設定updatedAtだけを判定し、MIDI読み込み・書き出し履歴の単独変更をunchangedとしていた。さらに音声依存がない場合、両履歴を収録しないmetadata-only JSONしか保存していなかった。

修正: 既存readArchiveMidiHistoriesで永続化済みの両履歴を読み、全フィールドをsignatureへ含める。UIの履歴キャッシュには依存しない。音声がなくても履歴があれば既存createLongWavArchive/putAutoBackupへ接続する。生成後も履歴一致を確認し、読込み失敗・生成中の履歴変更では保存も旧コピー整理も開始しない。新コピーのstrict IndexedDB transaction完了後にのみ既存の保持数整理を実行する。DB version/store/keyPath、手動JSON形式、旧Archive読込みは変更しない。旧signatureは次回期限到達時に一度更新される。Cache marker 1.4.207。

追加回帰5件: 音声なし・UI未更新でのexport/import履歴単独更新と同ID内容更新、quota abort後の再Openで旧Archive完全一致、生成中履歴変更による公開拒否、履歴read失敗で旧コピー保持、自動Full Archiveから別保存領域へproject/MIDI/制作履歴/設定/両MIDI履歴/WAV bytesの一致。復元先IDは既存仕様通り再割当される。修正後5件成功、元の#533 productionコードでは4件失敗し欠落を再現。

既存の実ブラウザcheckpoint recovery試験も、手動Archive生成から履歴だけ更新後の自動Archive生成へ変更し、復元先の両履歴・制作履歴・過去WAVを検証する。ローカルChromium未導入のため実ブラウザ結果はGitHub CIで確認する。

No.22/23はC維持。既存正式判定A=0/B=0/C=30を昇格しない。本作業は全30機能の再監査ではない。物理Mac強制終了・電源断、別Mac配布受入、Cloud Sync、未知の旧依存ファイルは未確認。通常の手動metadata-only JSONは両MIDI履歴を収録しない。履歴付き自動ArchiveはIndexedDB必須で、memory fallbackでは作成成功と扱わない。自動バックアップの作成間隔は変更しない。PR #510/#527〜#533/mainは変更せず、新独立Draftのみ。Ready/Merge/Force pushは行わない。
