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

Actions成果物からNOVA-Mix-Intel-development.tar.gzを取り出し、
新規フォルダに展開する（実行権限を保持）。生ZIPの.componentを直接使わない。
同じフォルダにあるprepare-install.pyを実行する。
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

## 2026-10-27 最初の実機確認（準備日 2026-10-25 JST）

上記の導入前確認を完了した後、最初は空のLogicプロジェクトで行う。
既存の制作プロジェクトを最初の認識試験に使わない。

1. 「このMacについて」「Logic Proについて」のバージョンを記録。
2. preflight.jsonのruntimeVerification.hashesAndPermissionsVerifiedがtrue、
   manualInstallationAllowedがtrueであることを確認。競合・読取不能・破損は停止。
3. 手動配置後、auvalとPlug-in ManagerでNOVA: Mixの認識を確認。
4. ステレオ音声を1つ読み込み、小音量で再生。NOVA → Mixを挿入。
5. Gainを0から-6 dBへ変更し、音量変化と値の読み戻しを確認。0へ戻し、
   Bypassを切り替えて再生が続くことを確認。ここまでが最初の認識・再生・設定変更試験。
6. 別名保存→Logic完全終了→再Open。設定と音声が戻ることを確認。
7. 上記成功後のみ、コピーした曲でA/B/C・承認・Undo・2インスタンス・全曲処理へ進む。

所要時間はユーザーのOS・Logic・再認識状況に依存し、現時点で確認できません。
実機結果は「成功／失敗／未実施」と、対象パッケージのSHA256とともに記録する。
CIのAudioComponent成功を物理Logic成功として記入しない。

### 認識できない場合の切り分け

| 観測結果 | 次の確認 |
|---|---|
| preflightが失敗 | ハッシュ・実行権限・署名・重複AUの診断内容を確認。配置を進めない |
| auval一覧にNvMx/NvStがない | 配置先とIntel構成を確認。Logic終了後に再起動し、本AUだけ再スキャン |
| auvalが失敗／タイムアウト | 診断ログを採取し停止。強制的に有効化しない |
| auval成功、Logicで未認識 | Logic版・Plug-in Managerの状態を記録。CI成功から互換性を推定しない |
| OSが起動を拒否 | ad-hoc署名・公証未完了の制約。警告を迂回せず停止 |
| 認識するが無音 | 元音声、Track入出力、Bypass、Gain、Stereo構成を確認。元データは変更しない |

展開フォルダから以下で新しい診断フォルダを作成できる。

```sh
./NovaMix.component/Contents/Resources/Runtime/Python/bin/python3.12 -I -B collect-diagnostics.py /絶対パス/NOVA-AU-diagnostics-新規
```

macOS版・CPU・auval一覧・auval検証・NOVAに絞った直近10分のRegistrarログを採取する。
各コマンドは120秒で打ち切り、失敗・タイムアウトもdiagnostics.jsonへ記録する。
インストール、プロセス終了、キャッシュ削除、隔離解除、設定変更は行わない。
ローカルパスを含む可能性があるため、共有前に内容を確認する。
診断用Python自体がOSに拒否された場合も迂回せず、表示されたメッセージを記録する。

復旧は上記「4. 元の環境へ戻す」に従う。Logic終了→今回のAUを退避→旧AUを元パスへ戻す。
元プロジェクト・音声・比較音声・バックアップを削除しない。

### 2026-10-25更新：全曲処理と10月27日の確認

新しい全曲処理では、試行DSPはファイルへ書かずに同じfloat32結果を計測する。
原音・A/B/Cと各LUFS一致版の8本のWAVをすべて検証した後だけ、再生成可能な中間PCMを整理する。
採用版・未採用候補・履歴は残る。manifestのretiredIntermediatesは整理した中間データのハッシュ記録であり、復元に必要なファイル一覧ではない。
整理中に停止した場合も完了WAVと履歴を保持し、同一音声・設定・runtimeから再開すると残りの整理を行う。
ハッシュが変わった中間ファイルは削除せず停止する。旧パッケージで作った作業フォルダを新パッケージで強制再開しない。
旧結果は元パッケージと一緒に保存し、新解析は別フォルダで行う。

10月27日は上記の認識・低音量再生・停止再開・Bypass・保存終了再Openに加え、
Gain/EQ/Compressorの急変更とAutomation、2インスタンスの独立動作、44.1/48/96kHzとバッファ変更を曲のコピーで確認する。
全曲処理では8本の比較WAV、採用→Undo→再Open、実際の録音ボーカルと選択した楽器での聴感、
Logicから再書き出した音声のLUFS・True Peakを確認する。合成母音のCI成功は録音ボーカルの品質保証ではない。
今回の高速化は音声結果を維持する変更であり、音質改善やOversampling Limiterの実装を意味しない。
Developer ID署名・公証・商用配布レビューは引き続き未完了。

全曲FFTのHann窓は同じ係数を解析開始時に事前計算する。True Peak FIRの係数・加算順序、EQ・Compressor・Limiterの設定は変更しない。性能比較では工程内の記録時間に加えて、起動・ハッシュ確認・中間整理を含む外部計測の総時間とCPU時間を区別する。
