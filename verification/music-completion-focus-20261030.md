# 正式30機能のproduction照合・残作業 — 2026-10-30 JST

結論：全要件を満たしたと認定できる機能は0/30。30件とも未完成（部分実装あり、または要件未確認）。実装量0%という意味ではない。販売可能品質の完成を証明する一般作品の聴取・配信・対象実機受入は未完。完成率は算出しない。

基準：PR #537 HEAD `ce44d72e74e1463ed2f002a580ec55be00b90ebe`。開始時GitHub検索ではこれが最新PR、Draft・未Merge。7ワークフローすべてsuccess。既存マスターは2026-10-04の棚卸しなので、後続productionと2026-10-28の残件台帳をコード・テストの入口に照合した。本表は当該マスターの30件が対象。元PDFは今回再読していない。表のコード存在は完成証明ではなく、自動テストと物理受入を分離する。旧文書のD（未確認）をそのまま現状に転記しない。

| No. | 機能（全行未完成） | 現行productionで確認した実装 | 残要件・必要な検証 | コード/検証入口 |
|---|---|---|---|---|
| 1 | MIDI・Track編集 | editor / coordinated Track・範囲編集、Undo/Redo | 全Track操作の受入表、全曲移調とコード整合 | music-studio-editor.js; tests/music-studio-whole-song-transpose.test.js |
| 2 | MIDI録音 | MIDI入力、Count-in、Tempo map、Stop保存 | 実鍵盤の再接続・入力遅延、native権限と再起動 | music-studio-midi-input.js; tests/music-studio-dynamic-track-recording.test.js |
| 3 | 曲構造・音楽情報 | Tempo/Key/拍子map、構成候補、MIDI解析 | 音声由来BPM/Key/Scale/拍子/セクション品質 | music-studio-structure-info.js; tests/music-studio-structure-info.test.js |
| 4 | AI新曲スタート | 候補UI、ローカルONNX生成と保存経路 | 文章/歌詞→構成・編成全体、既定生成の無音問題と品質 | music-studio-ai-composition.js; tools/music-local-generation/model_runtime.py; tests/music-studio-local-model.test.js |
| 5 | Music Studio AI制作アシスタント | japaneseEditPlan等の限定日本語操作、安全Preview | 自由会話の理解・複数作業計画・完成までの支援 | music-studio-ai-workflow.js; music-studio-ai-assistant-panel.js |
| 6 | AI安全編集・変更管理 | Family Preview/Apply、保護、履歴、Undo/Redo | 音楽・音声・歌詞を横断する特定変更Undoと競合受入 | music-studio-ai-family-apply.js; tests/music-studio-ai-family-apply.test.js |
| 7 | AI作曲・曲展開 | 続き/全曲構成候補、モデル生成の入口 | 全Section・指定時間・部分再生成の音楽品質受入 | music-studio-ai-composition.js: wholeSongPlan; tests/music-studio-whole-song.test.js |
| 8 | AIアレンジ支援 | 単一/複数Track候補、ensemble/ドラム、採用 | 全曲複数Sectionモデル生成・演奏表現・音色品質 | music-studio-ai-composition.js: bindEnsemble; tests/music-studio-midi-remake.test.js |
| 9 | AIコード支援 | MIDIコード分析とVoicing/ensemble候補 | 実音声コード解析、追従補正と別案品質 | music-studio-ai-composition.js: analyzeChords/performanceVoicing |
| 10 | AI歌詞・メロディ制作 | 歌詞と音符割付、読み、譜面出力・保持 | 歌詞本文生成/修正、アクセント、固定条件付き再生成 | music-studio.js: editSavedLyrics/lyricsScoreXML; tests/music-studio-score-vocal-return.test.js |
| 11 | AI仮歌・対話修正 | Sinsy仮歌、小節範囲生成・部分置換 | 試聴中の自然言語部分修正・日本語歌唱品質 | music-studio.js: generateLocalScoreVocalRange; tools/music-local-generation/model_runtime.py |
| 12 | ボーカル録音 | PCM録音、Pause/Resume、Cycle Take、保存 | 録音途中の強制終了復旧、実マイク遅延・長時間受入 | music-studio.js: vocalStart/vocalSave; tests/music-studio-vocal-recording.test.js |
| 13 | ボーカル編集 | Pitch/Timing/長さ、Breath、Comp、非破壊置換 | Vibrato等を含む全補正品質と長い作品での受入 | music-studio.js: vocalProcessPCM/vocalCompRender; tests/music-studio-vocal-correction-comp.test.js |
| 14 | ボーカル生成・Harmony | harmonyPreview/harmonyToneのローカル処理 | 歌声Harmony/Double/Chorus品質、本人声モデル/許諾 | music-studio.js: harmonyPreview/harmonyTone |
| 15 | ボーカル完成チェック | 歌声分析、音域・音高・Timing関連の候補 | 仮歌/Take比較→録り直し/補正判断の完成フロー | music-studio.js: vocalAnalyze/vocalAnalysisForm |
| 16 | Stem Separation | Audio Pipeline→ローカル処理、分離音声資産保持 | 一般作品品質、Demucsを含む配布runtimeと移行受入 | music-studio-audio-pipeline.js; tests/music-studio-audio-pipeline.test.js |
| 17 | Audio-to-MIDI | 実変換経路、MIDI取込・範囲修正 | 配布runtime、信頼度/比較/単音和音精度の全要件 | music-studio-audio-pipeline.js; music-studio-scoped-midi-repair.js |
| 18 | AIミックス支援 | 実測Gain/EQ/Compression/空間候補、Long Mix版、auto-finish UI/CLI | 曲全体の音楽的品質、全形式/音源の統合受入 | music-studio.js: longMixAnalyze/longMixVersionSave; music-studio-auto-finish.js; tools/nova-au/auto-finish.py |
| 19 | AIマスタリング | LUFS/Peak、複数Master、長時間render・採用 | 測定規格適合と一般楽曲での仕上がり品質 | music-studio.js: longMasterWorkspaceState/finalMeasuredWav; tools/nova-au/auto-finish.py |
| 20 | Logic Pro往復連携 | Type1 MIDI往復、音声/Stem再取込、差分表示、Logic音源割当候補 | 実Logic往復の対応・差分管理と単独アプリ受入 | music-studio.js: logicMidiDifference/logicImportStemReturns; tests/music-studio-logic-pro.test.js |
| 21 | 最終書出し・配信パッケージ | MIDI音声化、Master/Instrumental/Stem/MIDI出力とmanifest | 配信前チェック全項目、音源/依存物の再配布条件と音質 | music-studio.js: midiRenderStems/finalZip/finalDeliveryValidate; tests/music-studio-final-export.test.js |
| 22 | 保存・曲バージョン管理 | strict IndexedDB保存、Checkpoint、範囲合成・競合拒否 | 独立した可聴A/B比較、依存する範囲合成の残条件、強制終了受入 | music-studio.js: versionRangeCompose/versionCompare; tests/music-song-checkpoints.test.js |
| 23 | バックアップ・復旧・移行 | 完全Archive、checksum/依存検査、履歴再結合、add-only原子復元、自動Backup。今回安全コピー失敗の阻止 | Cloud Sync、識別不能な旧依存、更新/別Mac/電源断の受入 | music-studio.js: restoreBackup/createLongWavArchive/restoreLongWavArchive; tests/music-studio-long-wav-storage.test.js |
| 24 | Music Studio診断・安全修復 | MIDI安全修復、依存検査・binary再選択 | 製品全体の性能原因診断→軽量化・安全修復 | music-studio-scoped-midi-repair.js; music-studio.js: recoverMissingBinary |
| 25 | AI実行環境・作品保護 | ローカル生成runtime、外部送信設定、単独Intelアプリ梱包 | Intel/Apple Silicon全処理の配布閉包、署名・公証、再配布許諾 | tools/music-local-generation/model-lock.json; tools/music-native; music-studio.js: normalizeSettings |
| 26 | AI料金管理 | 設定・部分編集Provider入口はある。料金管理の完成実装は確認できない | 料金事前表示/予約/月額上限/失敗取消/使用量台帳、Provider条件確定 | music-studio.js: editorRunPartialEditProvider; music-studio-ai-workflow.js |
| 27 | AIモデル管理・互換性 | 固定ONNX/Sinsyのバージョン固定と既存成果保存 | Provider/モデル交換・旧モデル・更新前品質互換試験 | tools/music-local-generation/model-lock.json; music-studio-generation-adapter.js（保存世代adapterでありModel交換ではない） |
| 28 | スマートUI | 作業別UI、お気に入り、限定語による画面案内、単独Menu修正 | 自由な自然言語ルーティング、全編集状態・touch/a11yの統合受入 | music-studio.js: normalizeWorkspace/resolveWorkRequest; nova-menu.js; tests/music-studio-workspace.test.js |
| 29 | 素材・テンプレートライブラリ | 曲複製・音源ライブラリは存在。専用素材制作フローの完成は確認できない | 曲/部分素材保存、Key/BPM追従、文章検索 | music-studio.js: duplicateProject; music-studio-instruments.js（専用素材フローと区別） |
| 30 | 完成版・制作履歴管理 | 完成Checkpoint固定・検索・別曲fork、Session/日次/自動編集の時系列保存 | 特殊保存経路の記録網羅、配布版の全操作・移行受入 | music-studio.js: finishedVersions/productionHistoryView/versionTimeline; tests/music-song-checkpoints.test.js |

## 残作業量と日程の算定限界

実装速度の実績、品質の合格曲集合・合格基準、Cloud Sync/有料Provider/本人声の採用条件、Apple Siliconの検証環境が確定していない。したがって全体の残人日、推定日数、暦日の完成予定は**確認できません**。未実装や技術選定待ちを「テストだけで数日」と換算しない。下表は実装・受入の作業束であり、人日見積や完了保証ではない。各束の終了条件を満たしてから、測定した処理時間・修正量を使って再見積する。

| 優先 | 作業束・対象 | 確認できた残作業量/終了条件 |
|---|---|---|
| 1 | 保存・完全復旧 22/23/30 | 今回1経路の不具合を修正、4 fault/移行テストと実ブラウザ受入を追加。可聴A/B、特殊保存網羅、旧依存/更新/別保存先受入が残る。Cloud Syncは独立の未実装機能。 |
| 2 | 音楽整合・安全編集 1/3/6/9 | 全曲Transpose/コード・保護範囲、領域横断Undo・競合、音声由来解析を閉じる。 |
| 3 | 実生成・中核AI 4/5/7/8/10/11 | 既定生成の無音/品質、文章理解、複数作業計画、歌詞/アクセント、部分再生成の統合。 |
| 4 | 音声制作 12–17 | 録音中断のdurable復旧、歌声補正/比較・Harmony、分離/変換の一般作品精度と配布runtime。 |
| 5 | 曲完成と受渡し 18–21 | 代表曲で音質比較、計測適合、出力・Logic往復と配信前チェック。単なるテスト音のPASSでは終了しない。 |
| 6 | 製品運用 24/28/29/30 | 全体診断、素材保存・Key/BPM/検索、UI全状態、履歴網羅の実装/受入。 |
| 7 | 実行/外部方式 23/25–27 | 同期先/暗号化/競合/Offline、有料料金台帳、モデル交換・互換、配布許諾/署名。方式未確定は工数上限不明。 |
| 最終 | 対象実機一括受入 | 機能がそろってからIntel+鍵盤/マイク/Logic、iPad、対象Apple Silicon、別端末復元をまとめて実施。失敗修正分は未計測。 |

今回Mac操作は依頼しない。次のローカルproduction候補はNo.22の可聴Checkpoint A/BとNo.12/23の録音途中復旧。先に既存render/録音保存単位を確認し、再実装を避けて範囲を確定する。

## 今回のproduction修正

`restoreBackup(..., {safetyCopy:true})`は`exportBackup(true)`の失敗を無視していた。現曲に長時間WAVがあると安全コピーは拒否されるが、設定を置換する復元は続行できた。また履歴のみの現状態ではmetadata JSONしか保護されなかった。

永続MIDI両履歴を読み、曲（Checkpoint/履歴を含む）にbinaryまたはMIDI履歴がある場合は既存`exportLongWavArchive`をawaitする。完全保存/書き出しが失敗したら復元transactionを開始しない。await後のCancel/Repository/Input世代検査を再実行する。長時間WAVがない場合も既存JSON安全コピーの失敗を拒否する。Schema/store/Archive形式、既存作品、既存PR・mainは変更しない。Cache marker 1.4.209。

ダウンロードの開始要求はOSでの保存完了の証明ではない。UI経由の復元は安全コピー付きだが、明示的な`safetyCopy:false`を指定する内部呼出しの契約は維持する。ブラウザ不在のheadless APIでは既存export契約どおりBlobを返すだけであり、ディスク保存とは主張しない。

## 検証の記録

新規4ケース：安全Archiveの別repository復元でWAV/履歴保持、欠落WAVで旧設定保持、Archiveダウンロード失敗で旧設定保持、作成中Cancelでzero-write。起点コードはWAV保護/欠落WAV拒否の2ケースで実害を再現。書出失敗テストは起点でもJSON書出エラーとして拒否するが、新コードでは完全Archive側の失敗を検証する。Cancelは既存契約の回帰。

追加の関連回帰100件は成功。ローカル実ブラウザはChromium実行ファイル不在で起動不可。追加した実IndexedDB/安全Archive検証はGitHub CIで実行する。GitHub CIはこの独立ブランチの最終HEADで確認しPRに結果を追記する。電源断・物理Macの受入は未実施。
