# Macなし要件の今回の照合

確認日：2026-10-31 JST。基準：PR #552 / 8bc4ae9ac2a8d49e326b3760588137197fbfba63。

今回のproduction実装：MS24-A02（全体性能の観測と原因候補）、MS24-A03（診断後の表示限定軽量化）、MS28-A03（各制作画面からの日本語案内）。性能数値からCPU使用率や音質を推定しない。短縮ラベルは幅計測を省略し、通常表示へ戻せる。設定・曲・音声・Undoは書き換えない。再起動は通常表示。

## 既存実装の検証不足20件

台帳の受入文言と既存テストの対応候補を整理した。production入口はmusic-studio.js / music-studio-editor.js。20件すべてについて全受入条件の精査・証明を完了したとは扱わない。個別テストの存在は全受入の証拠ではない。今回は20件ともopenを維持し、完了数へ加算しない。以下は残る証拠の範囲であり、既存処理の欠陥認定ではない。

| ID | 受入要件 | 関連する既存テスト | 全受入として未確認の範囲 |
|---|---|---|---|
| MS02-A03 | テンポ拍子変化録音の再保存往復 | tests/music-studio-recording-tempo-map.test.js / tests/music-studio-vocal-recording.test.js / tests/music-studio-dynamic-track-recording.test.js / tests/music-studio-meter-map.test.js | 可変テンポ・拍子録音の全保存入口での再保存一致 |
| MS06-A02 | 音声の特定変更Undoと競合拒否 | tests/music-studio-pcm-mix.test.js / tests/music-studio-lyrics-note-assignment.test.js / tests/music-studio-ai-midi-lyrics-score.test.js / tests/music-studio-pcm-proposals.test.js / tests/music-studio-ai-lyrics-reference-integration.test.js | 対象変更だけのUndo・競合・領域横断の永続再開 |
| MS06-A03 | 歌詞の特定変更Undoと競合拒否 | tests/music-studio-pcm-mix.test.js / tests/music-studio-lyrics-note-assignment.test.js / tests/music-studio-ai-midi-lyrics-score.test.js / tests/music-studio-pcm-proposals.test.js / tests/music-studio-ai-lyrics-reference-integration.test.js | 対象変更だけのUndo・競合・領域横断の永続再開 |
| MS06-A04 | 領域横断変更の永続再開 | tests/music-studio-pcm-mix.test.js / tests/music-studio-lyrics-note-assignment.test.js / tests/music-studio-ai-midi-lyrics-score.test.js / tests/music-studio-pcm-proposals.test.js / tests/music-studio-ai-lyrics-reference-integration.test.js | 対象変更だけのUndo・競合・領域横断の永続再開 |
| MS12-A02 | 長時間録音中断からの全保存経路の復旧検証 | tests/music-studio-vocal-recording.test.js / tests/music-vocal-input-refresh-race.test.js / tests/music-vocal-input-refresh-preserve.test.js | 長時間/中断/Punch/Cycle/歌詞同期の複合状態での再開 |
| MS12-A03 | PunchとCycleの保存再開 | tests/music-studio-vocal-recording.test.js / tests/music-vocal-input-refresh-race.test.js / tests/music-vocal-input-refresh-preserve.test.js | 長時間/中断/Punch/Cycle/歌詞同期の複合状態での再開 |
| MS12-A04 | 歌詞スクロール同期 | tests/music-studio-vocal-recording.test.js / tests/music-vocal-input-refresh-race.test.js / tests/music-vocal-input-refresh-preserve.test.js | 長時間/中断/Punch/Cycle/歌詞同期の複合状態での再開 |
| MS13-A04 | 波形歌詞音符同期の保存再開 | tests/music-studio-vocal-recording.test.js | 波形・歌詞・音符の同時同期状態の保存再開 |
| MS18-A02 | 全素材形式の曲全体Mix統合 | tests/music-studio-pcm-mix.test.js / tests/music-mix-versions.test.js / tests/music-studio-auto-finish.test.js | 全素材形式の混在Mixを通した受入 |
| MS19-A02 | LUFS計測の規格参照fixture拡張 | tests/music-studio-long-wav-storage.test.js / tests/music-studio-harmony-mastering.test.js | 規格参照fixtureの拡張とtrue peak/clippingの境界全体 |
| MS19-A03 | true peakとclipping検査 | tests/music-studio-long-wav-storage.test.js / tests/music-studio-harmony-mastering.test.js | 規格参照fixtureの拡張とtrue peak/clippingの境界全体 |
| MS22-A02 | Checkpoint可聴A/Bの統合 | tests/music-song-checkpoints.test.js / tests/music-studio-disposable-durable-recovery.test.js | 可聴A/B・依存範囲・全保存入口の強制終了を組み合わせた受入 |
| MS22-A03 | 依存範囲合成の全条件受入 | tests/music-song-checkpoints.test.js / tests/music-studio-disposable-durable-recovery.test.js | 可聴A/B・依存範囲・全保存入口の強制終了を組み合わせた受入 |
| MS22-A04 | 全保存入口の強制終了再開検証 | tests/music-song-checkpoints.test.js / tests/music-studio-disposable-durable-recovery.test.js | 可聴A/B・依存範囲・全保存入口の強制終了を組み合わせた受入 |
| MS24-A04 | 修復同意とtransaction再開 | tests/music-production-tools.test.js / tests/music-studio-disposable-durable-recovery.test.js | 修復同意・transaction中断再開の全対象照合 |
| MS28-A02 | 全編集状態での作業別UI遷移 | tests/music-production-tabs.test.js / tests/music-studio-workspace.test.js | 全編集状態の遷移・キーボード/a11yのブラウザ実行証拠 |
| MS28-A04 | キーボード操作とa11y自動検証 | tests/music-production-tabs.test.js / tests/music-studio-workspace.test.js | 全編集状態の遷移・キーボード/a11yのブラウザ実行証拠 |
| MS30-A02 | 特殊保存入口の制作履歴網羅 | tests/music-song-checkpoints.test.js | 特殊保存入口・完成固定・Session移行の全条件照合 |
| MS30-A03 | 完成版の全変更入口での固定 | tests/music-song-checkpoints.test.js | 特殊保存入口・完成固定・Session移行の全条件照合 |
| MS30-A04 | Session日次時系列の移行受入 | tests/music-song-checkpoints.test.js | 特殊保存入口・完成固定・Session移行の全条件照合 |

## 判断依存63件

台帳のdependsOnとMACLESS_DECISIONS_20261031.mdを再照合。C判断18件、依存A 63件を維持。選定・版固定・配布許諾・品質閾値の確定証拠は確認できません。今回の日本語案内はローカルの許可リストから画面候補を示す共通処理で、生成モデルの意味理解が完成したとは扱わない。性能診断と表示限定軽量化もモデル選定に依存しない。外部有料APIを呼び出していない。

要件追加・削除・受入文言変更なし。A=135、B=30、C=18。Bは全件open。物理Mac・聴感品質の認定は行っていない。

次：MS19の規格参照fixture、MS28の編集状態ごとの遷移・a11y、MS24の修復transaction受入。C依存項目は判断の根拠がそろうまで全受入の完了認定をしない。

完了認定はMS24-A03とMS28-A03の2件に限定する。MS24-A02はプロジェクト/DOM/遅延の診断を実装したが、描画・音声スケジューリング等の原因別計測の範囲が不足するためopen。原因別計測の追加実装が必要なため、分類は「実装が必要」を維持する。A完了51/135、残84、37.78%。残件は追加実装が必要1件・既存実装の検証不足20件・判断依存63件。

検証：全Node suite 2778件成功、失敗/取消/skip 0、364.829秒。Auto-Finish Python helper 22件成功。関連/保存遷移18件、cache入口82件成功。今回の新規4ケースは未変更#552で失敗し、新実装で成功。

ローカルのブラウザ検証はChromium実行ファイルがなく実行できなかった。GitHub CIのvocal-layout結果で確認する。物理Macの確認ではない。

先行実装HEAD eab4047aa44025ac10e9be6419148fc1e82edd74 のGitHub CIでもNode 2,778件・helper 22件が成功。run 41187359418 / job 124496881858の失敗は、古い証拠のapp.js SHA-256不一致だった。今回の最終実行記録でsource/runtime hashを更新し、台帳validatorを再通過。最終HEADのCI結果は別途確認する。
