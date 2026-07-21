# MS-06 Standard MIDI File読み込み・解析・安全な再編集基盤

## 状態と安全境界

MS-06はティア確認待ち。Logic Proから利用者が書き出したStandard MIDI FileをMusic Studio内だけで解析し、保存前プレビューを経て、新規projectまたは現在projectの複製へ保存する。既存projectへの直接上書き、元MIDIの変更、Logicの起動・操作、外部送信は行わない。

`music-studio-midi-parser.js`はDOM・IndexedDB・MS-05 writerから独立した純粋解析層である。MS-05の`inspectMidiBytes`は生成後検査として残し、同じ誤りを相互に正常判定しない。外部依存、外部fixture、ライセンス不明素材は追加していない。

## 既存実装の調査結果

- `music-studio-project` schemaVersion `1.0`を維持し、存在しない拡張fieldを強制補完・移行しない。
- IndexedDB `music-studio-projects`の既存storeを維持し、Version 5でmetadata専用`midiImportHistory`を非破壊追加した。
- `fileReferences`、`integrations.logicPro`、JSON／backupの「binaryを含めない」境界を維持した。
- MS-05 writerは生成と生成後inspection、MS-06 parserはVLQ decodeと全event解析を別実装で担当する。
- Nova Studio、Dream Architect Studio、`aiMusicHelperProject`の保存領域は変更しない。

## 対応SMFと検証

- Type 0：単一track内のtempo、拍子、演奏、channel eventを解析し、元formatとsource track番号を保持する。
- Type 1：tempo track、複数演奏track、track名、channel別eventを解析する。
- Type 2、未知format、SMPTE division：日本語errorで安全に拒否する。
- `MThd`、header長、track数、division、`MTrk`、宣言長、chunk境界、End of Track、末尾byteを検査する。
- VLQは0〜`0x0fffffff`、最大4 byte。途中切れ・過剰継続を拒否し、無限loopと範囲外accessを防ぐ。
- Running Statusはtrack内だけで保持し、Meta／SysExでclearする。先行statusなしは拒否する。
- 16 MB超は拒否、4 MB超と50,000 event超は警告、1 track 250,000 event超は拒否する。

## Eventと正規化

Sequence Number、Text、Copyright、Track／Instrument Name、Lyric、Marker、Cue、Channel Prefix、End of Track、Set Tempo、SMPTE Offset、Time Signature、Key Signature、Sequencer Specificと未知metaの種類・長さを解析する。文字列はUTF-8優先、不正byteはreplacement表示、byte数と警告を保持し、表示文字列は4,096文字に制限する。

Note On／Off、velocity 0 Note On、Poly Pressure、Control Change、Program Change、Channel Pressure、Pitch Bendを解析する。同音重複はqueueで対応し、channel・pitch単位にnoteを組み立てる。孤立Note Off、長さ0、未完了Note Onは警告し、未完了noteを勝手に生成しない。

Program Changeは0始まり値、1始まり表示候補、General MIDI候補名を保持するがLogicの実音源を断定しない。channel 10はドラム候補。Bank Select、Modulation、Volume、Pan、Expression、Sustain、All Notes Offとその他CCはtick・channel・controller・valueを保持する。SysEx等は高度編集未対応として概要を保持する。

Tempoはtick、microseconds per quarter、BPMのmapへ、拍子はtick、分子、分母、metronome clocks、32分音符数のmapへする。eventなしは警告つき120 BPM／4/4候補。複数変更はmapへ保持し、Version 1の単一値には初期値を設定する。

## Preview・保存・履歴

保存前にfile名、容量、Type、PPQ、全／演奏track数、event／note数、初期BPM・拍子と変更数、総tick、推定時間、歌詞・marker、各trackのchannel、音域、velocity、Program、CC、ドラム候補、警告、保存可否を表示する。

保存方法は「新規」「現在projectを複製」「解析のみ」「cancel」。直接上書きはない。`midiData`へversion、sourceFormat、PPQ、tempo／map、拍子／map、key候補、track、note、Program、CC、Pitch Bend候補、unsupported summary、warningを保持する。`importSource`は名前、容量、MIME、日時、source application候補、元format／track数だけで、file本体、絶対path、secretを含めない。

`midiImportHistory`には日時、file metadata、Type、PPQ、track／note、BPM、拍子、保存先、mode、warning数、app versionだけを保存する。履歴保存失敗は保存済みprojectを破壊しない。

## 往復・性能・端末

自前生成fixtureでType 0/1、Running Status、tempo／拍子変更、日本語、不正UTF-8、Program、CC、Sustain、channel 10、SysEx、空track、Note Off不足、壊れたheader／track長、途中切れ、Type 2、SMPTEを検証する。MS-05のPiano／Bass、PPQ 480、120 BPM、4/4、channel 1／2、10 notesを解析し、Version 1へ保存候補化して再生成・再解析する往復testで主要情報を確認する。

5,000 notesの同期解析は実用時間内。安全上限を設けたため今回はWeb Workerを追加せず、実運用で長時間blockingが確認された場合にworker化する。

1440、1024、820、390 pxを対象とし、900 px以下で連携gridを1列化、600 px以下でactionを全幅化する。file label、`aria-live`、table header、文字status、focus-visible、reduced motionを維持する。MacをLogic往復の推奨環境、iPad／iPhoneはFiles選択・新規保存・再書き出し対象とし、端末判定で禁止しない。

## 既知の制限・販売

未対応：Type 2、SMPTE division、Logic project直接読込／操作、音源・plugin・audio復元、完全automation、高度MIDI編集、SysEx編集、piano roll、MusicXML、AI作曲、cloud、課金、外部解析。Control Change等は解析・保持するが現行writerはnote／Program中心のため全情報の再出力は保証しない。第三者code／fixtureを追加していないため追加license obligationはない。

次の正式作業：MS-07｜MIDI Composerホーム・骨組み。
