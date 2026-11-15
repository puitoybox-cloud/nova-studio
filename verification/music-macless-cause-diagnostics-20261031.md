# 原因別性能計測・受入照合

確認日：2026-10-31 JST。基準：PR #553 / 74aef13a454ad3352ce5e82b2dc385d1dcca524f。

## Production変更

- `music-studio.js`: renderRouteのHTML構築、再描画呼出、音符ラベル幅測定/更新、音源準備とノート予約を個別に実測。各直近64回以内の件数、平均、最大、直近、例外件数をセッション内だけに保持。例外は再throw。
- `music-studio-audio.js`: 実際のOfflineAudioContext.startRenderingを通常/streamの両方で計測。成功/失敗を区別。非同期完了までの経過時間でありCPU使用率ではない。
- 診断画面で上記、16msタイマー超過、既存AudioContextの状態/遅延、プロジェクト/DOM量を区別。未実行と非対応は未観測と明示。診断はAudioContextを新規作成せず、再生も開始しない。render 16.67ms、layout 16.67ms、scheduling 10msは暫定の診断目安で品質の合格閾値ではない。
- renderとDOM再描画/レイアウトは重なるため合算不可。原因候補と確定原因を区別し、CPU/GPU/実音声dropout/聴感品質は未確認のまま。非前面タイマー制限を表示。原本・音声・MIDI・Undo・設定へ計測結果を書かない。
- `music-studio-ai-workflow.js`: 非同期ローカル生成中に依頼文/対象/元データが変更・置換・重複した場合、古い結果を候補公開する前に拒否。既存のPartial Edit/料金0記録/取消・Undo経路を維持。新モデル、辞書、外部API、声庫を採用しない。
- host/standaloneのキャッシュキー更新。

## 受入範囲

MS24-A02のみ新規verified。原因別の実処理計測、未観測/限界表示、失敗・競合拒否、データ無変更が受入範囲。物理機器での性能・音質はMS24-B01でopen。要件ID/受入文言/依存関係/分類/分母は変更なし。A 52/135、残83、38.52%。残件：実装必要0、検証不足20、判断依存63。B 30/C 18は全open。

以下の20項目は既存コード/受入テストの対応を再確認。全体回帰成功は各広い要件の全条件完了を意味しない。今回は既存テストにある保存/復旧の成功と、前回記録された未確認部分を区別して、20項目すべてopenを維持する。ブラウザ・強制終了複合条件・規格参照一式の新しい実行証拠は未取得。

| ID | 受入要件 | 照合対象と未確認部分 |
|---|---|---|
| MS02-A03 | テンポ拍子変化録音の再保存往復 | tests/music-studio-recording-tempo-map.test.js / tests/music-studio-vocal-recording.test.js / tests/music-studio-dynamic-track-recording.test.js / tests/music-studio-meter-map.test.js; 未確認: 可変テンポ・拍子録音の全保存入口での再保存一致 |
| MS06-A02 | 音声の特定変更Undoと競合拒否 | tests/music-studio-pcm-mix.test.js / tests/music-studio-lyrics-note-assignment.test.js / tests/music-studio-ai-midi-lyrics-score.test.js / tests/music-studio-pcm-proposals.test.js / tests/music-studio-ai-lyrics-reference-integration.test.js; 未確認: 対象変更だけのUndo・競合・領域横断の永続再開 |
| MS06-A03 | 歌詞の特定変更Undoと競合拒否 | tests/music-studio-pcm-mix.test.js / tests/music-studio-lyrics-note-assignment.test.js / tests/music-studio-ai-midi-lyrics-score.test.js / tests/music-studio-pcm-proposals.test.js / tests/music-studio-ai-lyrics-reference-integration.test.js; 未確認: 対象変更だけのUndo・競合・領域横断の永続再開 |
| MS06-A04 | 領域横断変更の永続再開 | tests/music-studio-pcm-mix.test.js / tests/music-studio-lyrics-note-assignment.test.js / tests/music-studio-ai-midi-lyrics-score.test.js / tests/music-studio-pcm-proposals.test.js / tests/music-studio-ai-lyrics-reference-integration.test.js; 未確認: 対象変更だけのUndo・競合・領域横断の永続再開 |
| MS12-A02 | 長時間録音中断からの全保存経路の復旧検証 | tests/music-studio-vocal-recording.test.js / tests/music-vocal-input-refresh-race.test.js / tests/music-vocal-input-refresh-preserve.test.js; 未確認: 長時間/中断/Punch/Cycle/歌詞同期の複合状態での再開 |
| MS12-A03 | PunchとCycleの保存再開 | tests/music-studio-vocal-recording.test.js / tests/music-vocal-input-refresh-race.test.js / tests/music-vocal-input-refresh-preserve.test.js; 未確認: 長時間/中断/Punch/Cycle/歌詞同期の複合状態での再開 |
| MS12-A04 | 歌詞スクロール同期 | tests/music-studio-vocal-recording.test.js / tests/music-vocal-input-refresh-race.test.js / tests/music-vocal-input-refresh-preserve.test.js; 未確認: 長時間/中断/Punch/Cycle/歌詞同期の複合状態での再開 |
| MS13-A04 | 波形歌詞音符同期の保存再開 | tests/music-studio-vocal-recording.test.js; 未確認: 波形・歌詞・音符の同時同期状態の保存再開 |
| MS18-A02 | 全素材形式の曲全体Mix統合 | tests/music-studio-pcm-mix.test.js / tests/music-mix-versions.test.js / tests/music-studio-auto-finish.test.js; 未確認: 全素材形式の混在Mixを通した受入 |
| MS19-A02 | LUFS計測の規格参照fixture拡張 | tests/music-studio-long-wav-storage.test.js / tests/music-studio-harmony-mastering.test.js; 未確認: 規格参照fixtureの拡張とtrue peak/clippingの境界全体 |
| MS19-A03 | true peakとclipping検査 | tests/music-studio-long-wav-storage.test.js / tests/music-studio-harmony-mastering.test.js; 未確認: 規格参照fixtureの拡張とtrue peak/clippingの境界全体 |
| MS22-A02 | Checkpoint可聴A/Bの統合 | tests/music-song-checkpoints.test.js / tests/music-studio-disposable-durable-recovery.test.js; 未確認: 可聴A/B・依存範囲・全保存入口の強制終了を組み合わせた受入 |
| MS22-A03 | 依存範囲合成の全条件受入 | tests/music-song-checkpoints.test.js / tests/music-studio-disposable-durable-recovery.test.js; 未確認: 可聴A/B・依存範囲・全保存入口の強制終了を組み合わせた受入 |
| MS22-A04 | 全保存入口の強制終了再開検証 | tests/music-song-checkpoints.test.js / tests/music-studio-disposable-durable-recovery.test.js; 未確認: 可聴A/B・依存範囲・全保存入口の強制終了を組み合わせた受入 |
| MS24-A04 | 修復同意とtransaction再開 | tests/music-production-tools.test.js / tests/music-studio-disposable-durable-recovery.test.js; 未確認: 修復同意・transaction中断再開の全対象照合 |
| MS28-A02 | 全編集状態での作業別UI遷移 | tests/music-production-tabs.test.js / tests/music-studio-workspace.test.js; 未確認: 全編集状態の遷移・キーボード/a11yのブラウザ実行証拠 |
| MS28-A04 | キーボード操作とa11y自動検証 | tests/music-production-tabs.test.js / tests/music-studio-workspace.test.js; 未確認: 全編集状態の遷移・キーボード/a11yのブラウザ実行証拠 |
| MS30-A02 | 特殊保存入口の制作履歴網羅 | tests/music-song-checkpoints.test.js; 未確認: 特殊保存入口・完成固定・Session移行の全条件照合 |
| MS30-A03 | 完成版の全変更入口での固定 | tests/music-song-checkpoints.test.js; 未確認: 特殊保存入口・完成固定・Session移行の全条件照合 |
| MS30-A04 | Session日次時系列の移行受入 | tests/music-song-checkpoints.test.js; 未確認: 特殊保存入口・完成固定・Session移行の全条件照合 |

## 判断依存の再調査

依存A 63件 / C 18件はopenを維持。モデル名すら一切分からないという意味ではない。確認できた既存資料を以下のように区別する。

| 既存資料 | 確認できた情報 | 未解消の範囲 |
|---|---|---|
| tools/music-local-generation/model-lock.json | skytnt/midi-model-tv2o-medium、revision 0f8f265d4330f4e46527ac2313200254c5757f5f、ONNX 2本とconfigのSHA-256/サイズ、license欄Apache-2.0 | C04の日本語文章理解/作曲品質閾値/全配布物の承認証拠は別。lock存在を全受入としない |
| tools/music-local-generation/vendor/SkyTNT-LICENSE | 同梱文面Apache License 2.0 | モデルの動作品質・Mac配布・全依存物の同梱確認は代替しない |
| tools/music-local-generation/vendor/NIT-SONG070-COPYING / Sinsy-COPYING / HTS-engine-COPYING | 声素材・エンジンの個別の既存文面が存在。NIT同梱文面はCC Attribution 3.0 | C11の最終声庫選定/配布物closure/日本語発音品質は未解消 |
| docs/music-studio/EXACT_BACKEND_CANDIDATES_20261006.md | Basic Pitch/Demucs固定版の候補と一次出典を記録済み。資料自体が採用済みmanifestではないと明示 | 実モデル全体の配布/品質基準、実行receiptの不足は別問題 |
| docs/music-studio/MS-00C_LICENSE_REGISTER.md | 旧台帳の最終更新は2026-07-20 | この旧台帳だけで現在全て不明/許可済みのいずれも断定しない |

今回、外部の新しい許諾取得やモデル選定は行っていない。63件を一律に不可能とは扱わず、版固定/素材文面/実行契約/品質評価/配布承認に分けて次回の照合対象を明確化。詳細な依存対応はdocs/music-studio/MACLESS_DECISIONS_20261031.mdが正本。

## 検証

関連の原因別診断/音声/AI suiteは81件成功。cache/入口は82件成功。新規性能4ケースは未変更#553で失敗、新実装で成功。AI変更/置換拒否は新規1ケース内の4異常系で検証し、未変更#553でも失敗を確認。全体の最終結果は2,783件成功・失敗/取消/skip 0、268.847秒。source/runtime hashと成功ケース名をmusic-macless-node-summary.jsonへ記録済み。Python helper 22件成功。

次の優先作業：MS19-A02/A03の独立規格参照fixture、MS24-A04の全修復transaction受入、MS28-A02/A04の編集状態別ブラウザ/a11y。実機30件は今回実行していない。
