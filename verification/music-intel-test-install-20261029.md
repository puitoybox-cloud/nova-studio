# Intel Mac 検証版の導入・保存復元確認
基準日: 2026-10-29 JST。対象: Intel Mac / macOS 13以降 / NOVA Testアカウント。

## このアプリ
PR #535 (140007ee187abf3ef9eadfaf373c9148051888b1) を含む検証版。
CI専用JavaScript実行フックを含まない通常ビルドをZIPに保存する。
Python、ONNX runtime、モデル、Sinsy、辞書、歌唱音声、Web音源と各種noticeを同梱。
Stem Separation / Audio-to-MIDI等の別Audio Helper全依存の同梱完了は意味しない。
Developer ID署名・公証は未対応。正式配布版ではない。
依存ライセンスの正式配布要件（NumPy同梱GCC/LGPL等）は未完了。
CIの自動保存復元試験は別のCIフック有効ビルドで実施し、配布する通常ビルドでは
実アプリ起動・保存API準備・終了・内蔵AI生成を検証する。
通常ビルドの手動保存復元、物理Macでの動作成功は未確認。

## 取得と確認
1. 指定されたActions実行ページを開く。成功したintel-mac-generationジョブを確認する。
2. Artifactsの music-studio-intel-test-app-<HEAD> をダウンロードし、外側のZIPを展開する。
3. 内側の Music-Studio-Intel-Test-<HEAD>.zip、package-archive-sha256.txt、
   package-archive-bytes.txt、test-app-candidate.jsonを確認する。
4. Terminalでこのフォルダへ移動し、shasum -a 256 -c package-archive-sha256.txt を実行。
   OKでなければ起動しない。manifestのbuildRevisionも対象HEADと照合する。
5. 内側のZIPを展開する。アプリをNOVA Testのホーム配下の専用フォルダ
   （例: ~/Applications/NOVA-Intel-Test-20261029/）へ移動する。
   /Applicationsの既存アプリを置換せず、普段の制作アカウントへインストールしない。
   Artifactsは7日間保持。取得期限後は同じブランチの再ビルドが必要。

## 起動
1. NOVA Testアカウントで、既存Music Studioとその生成エンジンを終了する。
   ポート127.0.0.1:8765を使用するため、同時起動しない。
2. FinderでMusic Studio.appを開く。
3. 未確認の開発元として拒否された場合は、入手元とSHAを確認したうえで
   システム設定 > プライバシーとセキュリティの「このまま開く」が表示されれば使用する。
   表示されない、「破損」等の別エラーの場合はメッセージを記録して停止する。
   Gatekeeper全体を無効化しない。署名・公証の成功は主張しない。
4. 初回に画面が開かない場合は既存アプリを削除せず、エラー画面を記録する。

## 保存・完全終了・再起動
1. 新規テスト曲を作成し、区別できる名前を付け、数音入力して再生する。
2. Saveを実行し、保存完了を待つ。制作中の実作品は読み込まない。
3. Music Studio > 終了（Command-Q）で完全終了する。ウインドウを閉じるだけで終えない。
4. アクティビティモニタで、この検証版のアプリと内蔵エンジンが終了したことを確認する。
   Logic ProやNOVA Mix AUを終了・削除しない。
5. 同じ検証版を再起動し、Projectsから曲を開く。名前・音符・再生を照合する。
6. 音符を1つ変更して再保存し、完全終了・再起動後に変更が残ることを確認する。

## Full WAV Archive復元
1. コピー可能なテストWAVを曲へ取り込み、再生を確認して保存する。
2. Full WAV Archiveで完全バックアップを新しいファイルへ書き出す。
   メタデータのみのJSONを完全バックアップとして使用しない。
3. 復元先の既存作品がないことを確認する。安全な独立保存領域をUIから選べない場合、
   元の曲を削除せず停止する。必要なら別の空のmacOSテストアカウントで実施する。
4. Full WAV Archiveを復元し、WAV再生、MIDI、制作履歴、設定を元と照合する。
5. 復元した曲を再編集・再保存し、完全終了・再起動後に再度確認する。
6. 結果、使用HEAD、macOS、各手順の成功/失敗、エラーを記録する。
   実機電源断・強制終了試験はこの通常保存試験と別で、成功扱いにしない。

既存作品、普段の保存領域、Logic Pro、NOVA Mix AUは変更しない。
