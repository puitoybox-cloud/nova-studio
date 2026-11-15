# Stem自動Mix→A/B/C Mastering 実装検証（2026-10-27 JST）

開始点: Draft #517 / 0fe7a735503f350bc2761ae37016d13ab4752d92。開始時GitHub確認: open/draft、HEAD一致。workflow 40456046568 / 40456046625ともcompleted/success。新規checkoutの作業ツリーclean。#510・main・既存ブランチ変更なし。

## 実装

新規`tools/nova-au/auto-finish.py`で2〜16本の確認済み整列Stemを受け付ける。明示role/idを測定、RMS役割バランスを±6dB以内で調整、既存測定提案のEQ/Compressorを既存native DSPで個別適用、静的headroomを付けて合算し既存section-aware全曲Masteringへ接続。3帯域の粗い重なりも記録するが、知覚的マスキングに基づく自動EQとは主張しない。

全入力hash、各処理結果、DSP、測定、8比較WAV、承認コピー、Undo履歴を維持。日本語3種類を受け付け、未対応指示を開始前拒否。会話モデル未搭載、modelInference:false、hostApplied:false。外部通信なし。候補時には元音源・Logic・AU設定を変更しない。

Intel配布buildへ追加scriptを同梱し、既存runtime inventoryの必須リストも一致させた。新Linux/contained Intel CI受入テストを追加。配布実行では同梱Python/engine/FFmpegのみ許可。手順は`tools/nova-au/AUTO-FINISH-JA.md`。

## 実際に通過した経路

開発用8秒WAV 3本（vocal/piano/bass）→個別測定→Gain/EQ/Dynamics→Mix→区間保護Mastering→original/A/B/Cおよび音量一致版→Bを明示承認→adopted.wavのhash一致→Undo→保存済みmanifest再読込。中断→resume成功。入力hash不変。破損した処理済みファイルはresume拒否。

バランス指示: vocal +6dB / piano -6dB / bass 0dB。EQ/Compも作用するため、処理後RMS差はバランスGain単独の値とは異なる。上限で到達しない役割差を無理に埋めない。

|候補|LUFS-I|True Peak推定 dBTP|音量一致 LUFS-I|
|---|---:|---:|---:|
|A|-16.546|-7.332|-21.621|
|B|-16.836|-8.180|-21.621|
|C|-15.889|-7.265|-21.621|

全候補clippedSamples=0。3候補WAVのhashは相互に異なる。独立FFmpeg測定の天井確認は既存Masteringエンジンにより必須。測定原本: `nova-auto-finish-20261027.json`。上記は開発用合成Stemのみで、実曲の聴感・プロ品質合格ではない。

## ローカル確認

- node --test: 2644/2644 pass、fail/cancel/skip=0。
- 既存追跡JS262本のnode --check成功。
- Python構文、git diff --check成功。
- native Quality（EQ、圧縮量、attack/release、ステレオlink、安定性）、Portable DSP、Analysis回帰成功。
- auto-finish.py実音声統合試験成功。承認なし拒否、承認コピー、Undo、改変拒否、中断再開を含む。
- 新Intelビルド・AU回帰・CIは未実行。既存#517のCI成功を新変更の結果として扱わない。

## 未完・制限

GUIからのStem入力・実行・試聴・承認の統合は未実装。現時点はローカルCLI。Logic他Track・市販プラグインの自動操作、会話型生成AI、知覚的マスキング調整、Stemの時間ずれ補正、長時間複数Stemの新経路受入、物理Intel Mac/Logicの聴感検証は未完。未処理dry-mixとMastering候補の音量一致比較は未実装（既存のoriginalは処理済みMix）。

会話モデル調査: 既存AU/whole-song/アシスタントはローカル固定処理で、モデル推論runtimeへの接続は確認できない。端末内モデルの配布・実行検証または明示許可された外部サービス接続が別途必要。今回はどちらも実施していない。

## 公開状態と次の実機操作

GitHub pushは自動承認審査が「送信先と今回のpayloadの明示承認を確認できない」として拒否。迂回なし。変更はローカルcommit済み。新Draft PR作成・新HEADのCIは未実行。

push承認後、新Draft作成とIntel/既存AU CI完了が先。通過後に#510とLogic projectを保護して、複製projectから同じ始点・終点で実曲Stemを書き出し、role/整列確認→新経路生成→A/B/C音量一致試聴→候補承認→完成WAVをLogicへ読み込み→保存/再Open/Undoを確認。専門知識を要しないGUI制作経路の完成とはまだ判定しない。
