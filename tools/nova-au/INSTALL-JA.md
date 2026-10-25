# NOVA Mix AU 開発用導入・復旧手順

確認日: 2026-10-25 JST。自動インストールは行わない。

## 対応条件と確認範囲

識別情報は `aufx / NvMx / NvSt`、bundle ID は
`studio.nova.audio.NovaMix`、AUv2・Intel x86_64。最低OS宣言とビルド対象は
macOS 12.0。最低OSでの実行成功を意味しない。署名は開発用ad-hocであり、
Developer ID署名・公証・一般販売配布の完了を意味しない。

| 項目 | 状態 |
|---|---|
| ティアのLogic Pro / macOSの正確なバージョン | 未確認。Logic Proについて / このMacについてで記録する |
| Logic 10.x、11.x、12.xごとの本AUロード・UI・保存互換 | 未検証。AUv2対応という一般仕様から本AUの成功を推定しない |
| Intel AUビルド・auval・単独AudioComponentホスト | 当該HEADのIntel CIの成功と成果物で確認する |
| Logic内部Mastering Assistant / 他社AU操作 | 未対応。製品・版・公開IDの確認とホスト側の明示的設定が必要 |
| 全曲処理runtime | 同梱固定Python 3.12.15 / FFmpeg 7.1.1のみ。欠落時停止。自己完結の実証は当該HEADのIntel CI結果で確認 |

Apple一次資料（上記日付に確認）:
- https://support.apple.com/en-euro/122179 : 64-bit要件、導入場所、再認識とPlug-in Manager。
- https://support.apple.com/en-gb/111899 : 当該ページ掲載のLogic要件はmacOS Sonoma 14.4以降。すべての旧版の要件ではない。
- https://support.apple.com/en-mo/109503 : Logicリリースノート。版ごとの修正を確認する資料であり、本AUの互換認定ではない。
- https://developer.apple.com/documentation/audiotoolbox/audio-unit-v2-c-api
- https://ffmpeg.org/legal.html : FFmpegのビルド構成に応じたライセンス条件。

## 1. 導入前の読み取り確認とステージング

Logicを終了する。元のLogicプロジェクトは開かず、Finderでプロジェクトと外部音声を
別フォルダへコピーしておく。コピーしたプロジェクトだけを検証に使う。
Python/FFmpegの導入、ダウンロード、Apple署名情報の使用をこの手順では行わない。
同梱Runtimeが欠落している候補は使用しない。

配布ZIPを新規フォルダに展開し、同じフォルダにあるprepare-install.pyを実行する。
出力先はまだ存在しない、Components以外のフォルダを指定する。

```sh
./NovaMix.component/Contents/Resources/Runtime/Python/bin/python3.12 -I -B prepare-install.py /絶対パス/NovaMix.component /絶対パス/NOVA-AU-review-kit
```

このツールは次を行う。

- x86_64、コード署名整合性、AU識別情報、最低OS宣言を確認。
- ユーザー用・システム用Componentsを読み取り、同じ識別情報や名前のAUを検出。
- 既存AUの版、ファイルごとのSHA256と実行属性をpreflight.jsonに記録。
- 新規キットへコピーし、コピー元・先を再照合。既存AUやLogic環境は変更しない。

`manualInstallationAllowed: false`、`scanErrors`、`INCOMPLETE`のいずれかがあれば
導入しない。名前を変えただけの同一AUも競合として扱う。
既存AUがある場合、Logicを終了した状態で既存bundle全体をComponentsの外へ
手動で移し、preflight.jsonとともに保管する。元のパスを記録し、再度新しい出力先で
preflightを実行する。既存AUに新しいAUを上書きしない。

## 2. ユーザーによる導入と認識確認

成功したキットのNovaMix.componentをFinderで
`~/Library/Audio/Plug-Ins/Components/`へコピーする。
同名ファイルの置換を求められたらキャンセルする。管理者権限やシステム用配置は不要。
OSのセキュリティ警告を回避するためにGatekeeperの無効化や隔離属性の一括削除をしない。
起動が拒否された場合は署名・配布方式の未完了として止める。

```sh
/usr/bin/auval -a
/usr/bin/auval -v aufx NvMx NvSt
```

認識一覧と終了コード、AU VALIDATION SUCCEEDEDの結果を保存する。
auval成功はLogic実機成功ではない。
Logicを起動し、設定（旧版では環境設定）→Plug-in ManagerでNOVA: Mixを確認する。
必要ならこのプラグインだけを選択して再スキャンする。
見つからない場合はAppleの手順に従って再起動する。全AUキャッシュや設定は削除しない。

## 3. コピーしたLogicプロジェクトでの検証

音量を下げた状態で、次の対象を1つずつ試す。

1. ステレオTrackのAudio FX → Audio Units → NOVA → Mix。
2. Busを受けるステレオAuxのAudio FX。
3. Stereo OutのAudio FX。

元プロジェクトと異なる名前・場所のコピーであることを毎回確認する。
実際の楽器・プリセット・録音ボーカルと対象Track/Bus/Stereo Outを記録する。
AUで曲・Track・役割・入力元を明示し、同名Trackや別AUインスタンスを混同しない。

確認事項:

- ネイティブUIの表示、文字欠け、サイズ、日本語IMEの入力・確定・候補選択。
- 再生→停止→再開、ホストバイパス、急なクリックや過大音量の有無。
- 全曲WAVはNOVA処理前/バイパス状態で書き出したものかを確認。
- 全曲解析→日本語指示→A/B/C試聴→設定差の確認→明示承認。
- 全17パラメータの適用後読み戻し。Automation Read/Touch/Latch/Writeとの競合。
- 処理後を別WAVに書き出して再測定。処理済みWAVを処理前と偽って再適用しない。
- Undo、再調整、別名保存、Logic完全終了→再起動→コピーの再Open。
- 再Open後は曲・Track・AUを再確認。復元した古い承認を再使用しない。
- 2つのAUで対象・出力先・キャンセル・履歴が分離されること。
- Logicのプロジェクトコピーと音声フォルダをバックアップする。
  Music StudioのバックアップだけではLogicプロジェクトを復元できない。

全曲Masteringの追加Gain・5ms sample-lookahead・静的TP補正はリアルタイムAUに
適用されない。`shared-process`はAU本体と同じDSPのみを通す別経路であり、
Mastering完成WAVと同じ音とは表示しない。AUにはlookaheadを追加していないため
新たなホスト遅延補正は不要。True Peak推定とリミッターは別であり、
オーバーサンプリングTrue Peak Limiter完成とは判定しない。

## 4. 元の環境へ戻す

Logicを完全終了する。今回配置したAUのファイルハッシュがキットのpreflight.jsonと
一致することを確認する。異なる場合は別更新の可能性があるため勝手に移動しない。
今回のAUを削除せず、Components外の新しい保管フォルダへ移す。
既存AUを退避していた場合は元パスが空であることと退避時ハッシュを確認して戻す。
Logicを再起動し、元のプロジェクトのコピーで認識を確認する。
今回の検証用コピー、WAV、A/B/C、履歴、旧AUはそのまま保管する。

## 配布runtimeと残る要件

詳細はCONTAINED-RUNTIME-JA.md。Music Studioアプリと同じPython配布元を再利用するが、
アプリの実行ファイルやユーザーのインストール済み依存は参照しない。
AU専用の最小構成を同梱し、control queueで署名・全ファイルのハッシュを検証して起動する。
署名順序は各Mach-O/dylib/拡張モジュール→外側AU。現在はad-hoc開発署名のみ。
販売用Developer ID、Hardened RuntimeでのLogic内子プロセス実行・library validation、
公証・Gatekeeperと最低OSの実機確認、商用配布条項の最終審査は未完了。
Appleの認証情報を使用しない。既存AUを自動上書きしない。
