# MS-04 Logic Pro X連携 調査・設計

## 結論

Version 1の採用方式は、Music StudioがStandard MIDI File（SMF）Type 1をブラウザ内で生成し、利用者がLogic Proへ手動で読み込むファイル受け渡しとする。Logic Proから戻すときも利用者がSMFを書き出し、Music Studioが検証・解析結果を確認表示した後、元プロジェクトを変えず取り込みコピーへ保存する。音声はWAV／AIFF／CAFの外部参照メタデータだけを管理する。

MS-04ではMIDI生成・本解析・永続履歴を実装していない。専用ルート、設定表示、無データ時の無出力案内、ファイル選択、拡張子・16 MB上限・`MThd`ヘッダー確認、音声の一時参照、手順表示までを実装した。Logic Proの起動、直接操作、`.logicx`の読み書き、Apple非公開形式の推測は行わない。

## 根拠と公式資料

AppleのLogic Proユーザガイドは、SMF Type 0／1の読み込み・オープン・書き出しに対応し、MIDIイベントの時刻とchannel、track名、marker名と位置、tempo変更を保持すると説明する。Type 0は1 track、Type 1は複数trackを持てる。Logic Proから複数regionを選択して書き出す通常手順はType 1である。

- [Standard MIDI files in Logic Pro for Mac](https://support.apple.com/guide/logicpro/standard-midi-files-lgcpdf6a3851/mac)
- [Export MIDI regions as MIDI files](https://support.apple.com/guide/logicpro/lgcp77376cad/mac)
- [Import MusicXML files](https://support.apple.com/guide/logicpro/lgcp67fa6594/mac)
- [Export a score as MusicXML](https://support.apple.com/guide/logicpro/lgcpbd38ba48/mac)
- [Recording preferences (AIFF/BWF/CAF)](https://support.apple.com/guide/logicpro/lgcp411dd5c8/mac)
- [Use audio file tempo information](https://support.apple.com/guide/logicpro/lgcp31b25732/mac)

SMFのバイナリ構造はMIDI Associationの仕様を実装時の正本とし、ライブラリを採用する場合は依存コードと配布物のライセンスをMS-00C台帳で再確認する。現段階はライブラリを追加していない。

## 既存実装調査

- ホームのLogic Pro Xカードは従来 `music-studio/logic-pro` の共通準備中ページへ遷移していた。MS-04で同じrouteを専用画面へ接続した。
- `music-studio-settings` Version 1はIndexedDB `music-studio-projects` Version 3の `settings/current` が正本。`getMidiSettings()`／`getLogicProSettings()`は防御的コピーを返す。
- MIDI設定はType、PPQ、channel、track名、tempo、拍子、空track、quantize、velocityを保持する。Logic Pro設定は手動file export、MIDI優先、audio external reference、手順表示を許可し、自動起動・直接操作は正規化時に必ずfalseとなる。
- `music-studio-project` Version 1 (`schemaVersion: 1.0`) は `midiAssets`、`audioAssets`、`fileReferences`、`integrations.logicPro` の拡張点を既に持つ。JSON出力とbackupは外部fileを `requiresReselection` としbinaryを埋め込まない。
- project正本は `projects` store、設定は `settings` store、自動backupは `autoBackups` store。Nova Studio `novaStudio_v01`、Dream Architect共有領域、`aiMusicHelperProject`には触れない。
- ダウンロードはBlob/Object URLと一時`a[download]`、読み込みは`input[type=file]`と`File.text()`。ブラウザは利用者が選んだFileの名前・MIME・size・内容を当該セッションで読めるが、通常は絶対pathを得られず、再読込後に同じFileオブジェクトを復元できない。
- ファイル名は `{projectName}`、`{songTitle}`、`{type}`、`{date}`、`{time}`、`{version}` の一元templateをNFKC・危険文字除去・長さ制限付きで展開する。
- テストはNode標準test runnerとVMで純粋API・HTML・分離境界を確認する。package managerや外部ライブラリはない。
- MS-00A〜Cは単体配布可能なroute／CSS／保存領域分離、Version 1 contract、ライセンス台帳を定義。MS-03は設定とbackupの正本を追加。アプリ版は `APP_VERSION` で一元管理する。

## 形式・情報の評価

| 形式・情報 | ブラウザ生成 | Logic Pro | 維持／制限 | Version 1判断 |
| --- | --- | --- | --- | --- |
| SMF Type 0 | ArrayBufferで可能。実装またはlibrary要 | 読込・書出可 | 全channelを1 trackへ集約。region区分は保持しない | 読込対応、単一track用途のみ |
| SMF Type 1 | ArrayBufferで可能。実装またはlibrary要 | 読込・書出可 | 複数track、event時刻・channel、track名、marker、tempoを運べる。region構造やLogic音源は保持しない | 推奨 |
| WAV / AIFF | Web Audio等で生成可能だが本格renderは別作業 | 読込可 | PCM音声。note、track構造、plugin、mix編集性は失う | 外部参照のみ |
| CAF | browserでの汎用encode／再生互換性が低い | 読込・録音可、長時間向け | container内codec差に注意 | 外部参照のみ |
| MusicXML | XML生成は可能、schema検証が必要 | scoreとしてimport/export可 | 記譜情報に強いがDAW固有region、plugin、automationの完全往復ではない | 後続候補 |
| JSON / text | 標準APIだけで可 | 演奏データとして直接import不可 | 人が読むmanifest、補足、Music Studio backupに有効 | 補助資料のみ |
| tempo / 拍子 | SMF meta eventとして可 | tempoは公式に保持。拍子はimport後確認必須 | import方法（open／playhead import）でproject反映を確認する | 出力option、受入test必須 |
| marker / track名 | SMF meta eventとして可 | 公式に保持 | 文字encoding・同名・位置丸めを確認 | 任意出力 |
| note / channel / velocity | SMF channel eventで可 | 読込可 | 音源割当と鳴り方はLogic側設定に依存 | 対応対象 |
| program / control change | SMF eventで可 | MIDI eventとして運べる | Logic instrument/plugin状態そのものは再現しない | 後続解析対象 |
| lyric meta event | SMF meta eventで可 | MIDIはlyric dataを含み得る | 表示位置・encoding・歌詞機能へのmappingを受入確認 | option候補 |
| chord | 標準SMFに完全な共通chord contractなし | noteやtextとしては渡せる | Logic chord track等の固有意味の完全往復を保証しない | JSON補助／後続調査 |
| loop | MIDI noteの反復を実体化可能 | export前にregion化が必要 | alias、region loop、cycle等DAW構造は失う | 実体化後のみ |

SMF writerはWeb標準だけで実装可能でMacネイティブ化は不要だが、可変長数量、running status、meta event順序、delta time、track length計算に厳密性が必要である。本格実装は後続作業でfixtureと他実装による相互運用testを行う。外部libraryは必須ではない。採用時は商用利用・改変・notice・source配布義務を確認する。Intel Macでもbrowserの標準Blob/File/ArrayBufferで動作し、CPU architecture固有binaryへ依存しない。

## 採用・不採用・端末別範囲

採用：Type 1優先のSMF手動往復、画面内手順、音声外部参照。Type 0は設定互換と単一track用途で残す。

今回不採用：Logic直接操作、自動起動、`.logicx`直接編集、AppleScript／Accessibility automation、MusicXML生成、audio render、外部AI・cloud送信、完全なround trip。無断操作、OS権限、画面変更、非公開format、plugin/音源差による破損と誤期待を避けるためである。

将来Mac native版：利用者が明示選択したdirectoryのsecurity-scoped bookmark、再認可、sandbox entitlement、file coordination、optionalなLogic起動案内を検討できる。Accessibility automationは原則採用せず、必要性とApp Store配布条件を別途審査する。

- Mac browser：MIDI download/import、audio一時参照、Logic Pro for Macへの手動手順。将来full機能対象。
- iPad：MIDI downloadとFiles選択は可能。Macへ移す案内を主とし、端末名だけで機能を強制遮断しない。
- iPhone：設定・履歴・簡易download確認。Logic Pro for Macを直接操作できると表示しない。

## 将来データ契約（Version 1を今は変更しない）

既存projectを強制移行しない。必要になった時点で `integrations.logicPro` の要素またはVersion 2 extensionとして次を追加し、不足時は画面用defaultで補完する。

```json
{
  "integrationVersion": 1,
  "exportMode": "manual-file",
  "lastExportedAt": null,
  "lastImportedAt": null,
  "preferredFormat": "smf",
  "midiType": 1,
  "ppq": 480,
  "includeTempo": true,
  "includeTimeSignature": true,
  "includeTrackNames": true,
  "includeMarkers": true,
  "includeLyrics": false,
  "audioReferenceMode": "external",
  "instructionsShown": false,
  "exportHistory": [],
  "importHistory": []
}
```

`fileReferences`候補は `id`, `kind`, `displayName`, `relativeName`, `mimeType`, `size`, `createdAt`, `updatedAt`, `source`, optional `checksum`, `missing`, `userNote`。本体、absolute path、File object、秘密情報は入れない。checksumは同一性候補でありpath復元に使わない。参照切れでもprojectを開き、`missing: true`と再指定導線を表示する。

履歴候補はID、日時、project ID/name、export/import、format、filename、track数、BPM、拍子、result、warnings、user memoだけ。binaryは保存しない。個別削除と確認付き全削除を用意し、履歴保存失敗を本体処理の失敗にしない。

## 取り込み・error境界

正式importは (1) File選択、(2) size/extension/header/chunk長検証、(3) resource上限付きparse、(4) tempo・拍子・note・channel・track名のpreview、(5) 利用者確認、(6) 元projectを変えずcopy作成、の順とする。MS-04は(1)〜header検証までである。

cancelはno-op。未対応・破損・過大fileは日本語で拒否し、既存projectを変更しない。IndexedDB、download、必要API失敗は画面内errorとし白画面にしない。Logic Pro未導入やmobileでも案内画面は開け、アプリ存在をbrowserから断定しない。

大容量audioをIndexedDBやbackup JSONへ保存するとquota、複製、memory、backup時間、個人data持出しの問題がある。browser reload後は再選択、Mac nativeは利用者認可の再取得、iPad/iPhoneはFiles pickerによる再選択とする。

## 販売・配布

現実装は外部dependency、sample MIDI/audio、Apple assetを追加していない。Logic Pro名称は対応先の説明であり、Apple製品同梱や提携を意味しない。商用版にwriter/parserを入れる前に仕様・library license・notice・特許／商標表示・sandbox・privacy説明を台帳へ記録する。Intel Macはbrowser標準APIの範囲で対象にできるが、将来native dependencyはUniversal 2または個別architecture確認が必要である。

## 次の正式作業

正式ロードマップ上の次作業は **MS-05：Standard MIDI File生成・検証基盤**。Type 1最小writer、tempo／拍子／track名、file naming、相互運用fixture、無data無出力を実装し、高度Composerとは分離する。
