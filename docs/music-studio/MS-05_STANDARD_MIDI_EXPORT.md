# MS-05 Standard MIDI File Type 1書き出し・検証基盤

## 状態と境界

MS-05はティア確認待ち。外部MIDIライブラリを追加せず、`Uint8Array`、`TextEncoder`、`Blob`、Object URLだけでSMF Type 1を生成する。`music-studio-midi.js`はDOMと保存領域に依存しない純粋API、`music-studio.js`は確認画面・download・履歴を担当する。

既存`music-studio-project` Version 1は変更しない。`midiData`があるprojectだけ読み取り、存在しない既存projectへ補完保存や強制移行をしない。JSONと履歴へbinaryを含めない。Nova Studio `novaStudio_v01`、Dream Architect Studio、`aiMusicHelperProject`の領域は変更しない。

## 既存構造の調査結果

- 単体HTMLとhost routeが同じJS／CSSを利用し、Nova共通navはMusic Studio routeだけ非表示。
- 正本はIndexedDB `music-studio-projects`。既存`projects`、`settings`、`autoBackups`を維持し、Version 4でmetadata専用`midiExportHistory`を非破壊追加。
- Version 1 projectの`midiAssets`、`audioAssets`、`fileReferences`、`integrations.logicPro`と既存JSON／backup境界を維持。
- MS-03の`renderFileName`を再利用し、全token、NFKC、危険文字、fallback、20〜200文字制限を一元処理。
- MS-04の拡張子・16 MB・`MThd`先頭検査を、全chunk境界、VLQ、Type、PPQ、event、End of Track、末尾検査へ拡張。

## データモデルと検証

```json
{"version":1,"ppq":480,"tempo":120,"timeSignature":{"numerator":4,"denominator":4},"tracks":[{"id":"piano","name":"Piano","channel":1,"program":0,"muted":false,"notes":[{"id":"n1","pitch":60,"startTick":0,"durationTicks":480,"velocity":100}]}]}
```

channelはmodelで1〜16、status byteでは0〜15。pitch／programは0〜127、velocityは1〜127、tickは0〜`0x0fffffff`、durationは1以上。最大100,000 notes、10,000超は警告。muted／空trackは出力せず、note 0件なら拒否する。

## SMF Type 1仕様

- `MThd`長6、format 1、track数はtempo track＋演奏track、divisionは24〜32767 PPQ。
- 各`MTrk`はbody実byte長をbig-endianで記録し、必ず`FF 2F 00`で終了。
- delta timeは最大4 byte VLQ。writerはRunning Statusを使わず、inspectorはRunning Statusも解析。
- tempo trackはTrack Name、Set Tempo、Time Signature、End of Track。BPMは`round(60,000,000 / BPM)`。
- 拍子分母は1、2、4、8、16、32、meta値は`log2(denominator)`。4/4、3/4、6/8、5/4、7/8を検証。
- note trackはUTF-8 Track Name、任意Program Change、Note On、Note Off、End of Track。同tickはNote Off、Program Change、Note On順。
- Type 0設定は既存互換表示のみ。MS-05正式書き出しはType 1。Control ChangeとKey Signatureは後続候補。

## 書き出し・再検査・履歴

確認画面はproject、曲名、BPM、拍子、PPQ、Type、track／note数、track名、channel、filename、警告、errorを表示する。error時はbuttonを無効化し、`midiExporting`で二重clickを拒否。生成直後に独立parserでheader、chunk長、Type、track数、PPQ、VLQ、data範囲、End of Track、file末尾、Note On／Off数を検査し、失敗時はdownloadしない。

成功時だけ`audio/midi` BlobをdownloadしObject URLを解放する。履歴は日時、project、format、Type、PPQ、BPM、拍子、track／note数、filename、size、warning、version、検査結果だけを保存。履歴保存失敗は生成済みfileを壊さない。

## Test data・端末・性能

test入口は既存projectを上書きせず新規projectを作る。120 BPM、4/4、PPQ 480、Piano C4〜C5、Bass C2、計10 notes。Macを正式なLogic Pro受け渡し対象とする。iPad／iPhoneも生成を禁止せずFilesへ保存してMacへ移す案内を表示。1440、1024、820、390 pxを対象に2 columnから1 columnへ変化し、390 pxではbuttonと情報listを縦配置する。`aria-live`、disabled理由、focus-visible、reduced motionを維持。

同期処理で十分小さいためWeb Workerは追加しない。10,000件超を警告、100,000件超を拒否、再読込は16 MBまで。外部送信・API・課金・secret保存・Logic起動／直接操作・`.logicx`編集はない。

## Logic Pro実機確認

1. Music Studioを開く。
2. test MIDI projectを作成して開く。
3. Logic Pro X連携を開く。
4. BPM、拍子、PPQ、track名、channel、filenameを確認する。
5. MIDIを書き出す。
6. downloadされた`.mid`をFinder／Filesで確認する。
7. Logic Proを利用者自身で開く。
8. 新規または既存projectへMIDIを読み込む。
9. tempo、拍子、tempo＋2演奏track、track名を確認する。
10. Piano scaleとBassを再生確認する。
11. 音源を割り当てLogic projectを保存する。
12. 差異があればLogic画面とMusic Studio履歴をスクリーンショットで記録する。

## 既知の制限・販売

MIDI Composer、piano roll、AI作曲、MusicXML、advanced import、Logic固有region／plugin／automation再現、Logic Pro実機確認は未実装。外部dependency、外部fixture、sample MIDIは追加せず、test MIDIは自前生成のため第三者licenseは発生しない。
