# NOVA Mix AU Intel自己完結候補（2026-10-25）

`package-runtime.py BUNDLE FRESH_WORK` はIntel macOS上で実ファイルを取得・構築する。
配布物はNovaMix.component内のResources/RuntimeにPython、標準ライブラリ、
拡張モジュール、FFmpeg/FFprobe、共有dylib、対応ソース、ライセンス文書を持つ。
実行時のダウンロード・Homebrew・システムPythonへのフォールバックはない。
既存Music Studioのモデルや重いPython wheelsは追加しない。

Pythonは既存Mac配布実装と同じAstralビルド3.12.15（20261021）、アーカイブ
SHA-256 `14dd4aea2051903a788519ca56328c3f9932fb505a57400d81fea4abe2870fc7`。
FFmpegは公式Gitミラーn7.1.1のコミット
`db69d06eeeab4f46da15030a80d539efb4503ca8`。タグが変わると構築を拒否する。
構成はPCM WAV読み取りとebur128計測に限定し、network/GPL/nonfree/version3と
外部ライブラリ自動検出を無効化する。音声処理は従来のNOVA C++エンジンが行う。
FFprobeは同梱・実行検証するが、現在の本番WAV読取経路は独自のRIFF検証を使う。

Runtime/inventory.jsonに個々の実ファイルのSHA-256・サイズ・相対パス・
symlink先を記録する。NoticesにはPython配布元メタデータと宣言ライセンス原文、
FFmpegソースアーカイブ・COPYING.LGPLv2.1・LICENSE.md・CREDITS・実buildconfを保持。
Mach-Oの非Apple依存は配布物内へ閉じ、実行時に変更しない。
AUは署名と全同梱ファイルをworkerで照合した後、固定パスだけを起動する。
PATHは/nonexistent。音声Render callbackから起動しない。

共有FFmpegはNOVAへ静的リンクしない。対応ソースと構築設定を同時に提供し、
利用者がFFmpeg共有ライブラリを再構築できる構成を保つ。変更版は新しい配布物として
inventory再生成・再署名が必要。元の未変更配布物を保持してロールバックする。
販売時の同一配布場所でのソース公開、About表示・EULA・リバースエンジニアリング条項、
Developer ID署名・Hardened Runtime・公証・商用ライセンス最終審査は別の未完了要件。
これはad-hoc開発候補であり、販売許可や公証成功を表さない。
公式根拠: https://ffmpeg.org/legal.html （確認2026-10-25）。
Pythonビルド形式: https://docs.astral.sh/python-build-standalone/distributions/

導入はINSTALL-JA.mdの衝突検査・バックアップ・手動承認手順に従う。
自動インストールしない。AU ID・v1/v2状態形式と既存DSPは維持する。
LogicプロジェクトとMusic Studioのバックアップは別に保存する。
比較WAVは承認した外部フォルダに生成し、元WAV・不採用候補を残す。
大きな音声はAU状態やMusic Studio JSONへ埋め込まない。

別Macへは.component全体を移す。macOS12以上・Intel x86_64が構築対象。
macOS12実動作、利用者の正確なLogic/macOS版、実音源・録音声の音質は実機確認待ち。
保存requestはエンジン/音声/設定のハッシュと絶対パスに束縛されるため、移動後に
パスが変わったrequestを無条件に再開しない。元成果を保存し、新しい作業フォルダで
元WAVを再解析する。AU状態の音質設定はホスト保存・復元経路を維持する。

自己完結の成功は、Intel CIの実runtime構築、隔離PATH、移動後起動、全曲行列、
AU view操作、欠落/破損/版違い拒否、実dyld参照の結果が揃った場合だけ判定する。
既存Linuxや外部Python/FFmpegの成功は代用しない。
