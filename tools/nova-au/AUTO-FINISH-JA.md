# Stemから自動Mix・Mastering（2026-10-27）

`auto-finish.py`は明示した2〜16本のWAVを個別処理し、Mix→既存全曲Mastering→A/B/C完成WAVを生成するローカル補助ツールです。会話モデルは未搭載です。外部通信は行いません。Music StudioのExport画面は`auto-finish-server.py`を通じてStem転送、実行、進捗、停止・再開、A/B/C試聴、承認・Undo、完成WAV保存まで接続します。ヘルパー自体のアプリ起動時自動launchは未接続です。

配布componentのresourceからローカルヘルパーを開始する例（workspaceは新規出力専用directory）:

```bash
"$RES/Runtime/Python/bin/python3.12" -I -B "$RES/auto-finish-server.py" \
  --workspace /absolute/new-auto-finish-workspaces \
  --scripts "$RES" --engine "$BIN/nova-whole-song" \
  --ffmpeg "$RES/Runtime/FFmpeg/bin/ffmpeg"
```

ヘルパーは`127.0.0.1:8767`だけで待受し、許可したローカル画面originと起動ごとのtokenを要求します。入力WAVはsession別の作業領域へcopyし、元ファイルを変更しません。完成WAVは候補の明示承認後だけ取得できます。

Logicから同じ開始位置・長さ・サンプルレートでStemを書き出し、役割と位置の一致を確認してください。PCM16/24/32、float32、mono/stereo、44.1/48/96kHzを受け付けます。時間ずれ・サンプルレート変換・Stem分離は自動補正しません。複数本の同じ役割も固有idで扱えます。

リクエストJSON（pathは実際の絶対パスへ変更）：

```json
{
  "projectId": "my-song",
  "audioVersion": "v1",
  "sourceKind": "logic-render",
  "alignmentConfirmed": true,
  "instruction": "この曲をきれいに仕上げて",
  "stems": [
    {"id": "voice-1", "role": "vocal", "path": "/absolute/vocal.wav"},
    {"id": "piano-1", "role": "piano", "path": "/absolute/piano.wav"}
  ]
}
```

対応role: vocal / piano / strings / bass / drums。
対応指示: 「この曲をきれいに仕上げて」「この曲を自然に仕上げて」「全体の音を自然に整えて」。未対応指示は開始前に拒否します。

配布componentのContents/ResourcesをRES、Contents/MacOSをBINとして：

```bash
"$RES/Runtime/Python/bin/python3.12" -I -B "$RES/auto-finish.py" /absolute/request.json \
  --engine "$BIN/nova-whole-song" --ffmpeg "$RES/Runtime/FFmpeg/bin/ffmpeg" \
  --output /absolute/new-finish
```

開発環境ではPython3.9以上・コンパイルした既存engine/section meter・FFmpegが必要です。配布版では同梱実行ファイル以外を拒否します。中断後は同一コマンドに`--resume`を追加。入力・設定・engine・処理済みファイルのhash不一致時は停止します。

- 原Stemは読み取り専用。`dry-mix.wav`に未処理合算、`mix.wav`に個別処理後の合算を保存。
- バランスは各StemのRMSと役割の相対目安を使い、各±6dB以内。EQ/Compressorは既存測定ベース提案をDSPへ適用。crest 6dB未満は追加Compressorを無効化。合算時は静的headroomを確保。
- 周波数の重なりは全曲の粗い3帯域比較のみ。知覚的マスキングの判定・時間別の自動住み分けは未実装。
- `mastering/original.wav`は**個別処理後Mix**。A/B/CはそのMixに対する異なるMastering。原Stemとの同義ではありません。
- `mastering/*-lufs-matched.wav`はoriginal/A/B/Cの比較用。未処理合算との音量一致は未実装。
- `auto-finish.json`と`mastering/manifest.json`へStem処理、候補設定、前後測定、hashを保存。
- `auto-finish.json`の`progress`は、計測・個別処理・合算・Mastering・完了の段階と、各段階で処理済みの単位数を記録します。Mastering中の細かな割合や、中断・エラーの状態通知は未対応です。Music Studioの画面からこの記録を読む接続も未実装です。

A/B/Cを音量一致ファイルで試聴後、選んだ候補のみ承認して完成WAVを作成：

```bash
"$RES/Runtime/Python/bin/python3.12" -I -B "$RES/select-whole-song.py" /absolute/new-finish/mastering \
  --project my-song --track auto-finish-stereo --version v1 \
  --source-wav /absolute/new-finish/mix.wav --choice B --approve
```

`mastering/adopted.wav`が完成WAVです。`--choice undo --approve`で採用状態を戻します。既に書き出したコピーは保持され、採用なしなら非アクティブとなります。元Stem、候補、Logicプロジェクト、AU設定を変更しません。

専門家の聴感による調整や、実曲・ユーザー実機での合格は未確認です。合成音声試験をプロ品質の証明としません。自然な音量差の保持は既存区間ガードを利用し、目標LUFSへ無理に到達させません。True Peakは推定＋FFmpeg独立測定で検証します。

会話型モデル接続は今回は実装していません。生成AIの認証・端末内モデルの選定と実行検証が必要です。現在の処理を生成AIとは表示しません。市販プラグインや他のLogic Trackの設定を自動操作する機能もありません。
