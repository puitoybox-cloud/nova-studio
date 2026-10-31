# Opt-in local real generation

Implemented and measured on Linux CPU, 2026-10-16. This is a local development host, **not** the signed macOS distribution, Safari/iPad service, or a remotely callable provider. Existing hosted Music Studio remains usable without this host. No cloud inference API is called.

## Set up

Python 3.12+, a C/C++ compiler, make, ~2 GB download/disk headroom plus build/runtime memory are required. Use a dedicated virtual environment. Install `requirements.txt`, then explicitly run:

```sh
python tools/music-local-generation/prepare.py /absolute/new/nova-generation-assets
python tools/music-local-generation/serve.py --weights /absolute/new/nova-generation-assets/weights --sinsy /absolute/new/nova-generation-assets/runtime/bin/sinsy --dictionary /absolute/new/nova-generation-assets/runtime/dic --voice /absolute/new/nova-generation-assets/hts_voice_nitech_jp_song070_f001-0.90/nitech_jp_song070_f001.htsvoice
```

Open the printed 127.0.0.1 URL. In AI Assistant → Candidates, expand **AI model（実モデル作曲・端末内）**. Generation uses 64 model events per candidate, seeds 72/73/74 by default or the seed field, CPUExecutionProvider and a fixed tokenizer. The model's note events are constrained to one melodic track/channel; output notes are clipped to the selected range. This is actual autoregressive ONNX inference followed by range clipping, not rule-based composition. Generated notes use the project tempo and existing Preview/Listen/edit/partial Apply/Undo/save/reopen/backup route. Musical quality and exact key compliance are not certified.

For singing, save a Lyrics/Notes assignment, expand it, and choose **Sinsy（端末内で歌声生成・取り込み）**. The current exported MusicXML is passed to the actual Sinsy executable, then its WAV is imported through existing score-zero alignment, Vocal editing, Mix publication and archive routes. A changed score/project during inference rejects the result. The engine is **HMM-based Sinsy 0.92**, not DNN/NNSVS and not an AI voice clone. NIT SONG070 F001 is a published Japanese singing voice. The existing manual WAV form remains available. A one-note Music Studio export was synthesized and round-tripped; arbitrary tempo-map/tie/reading compatibility and vocal quality require further acceptance.

The server binds only 127.0.0.1. Host, Origin and an unpredictable same-origin request token gate mutations. It exposes no CORS, provider endpoint, command input or model download route. Generation is serialized. XML entities/DOCTYPE, oversized scores and overlong output are rejected. Runtime weights and voice bytes are checked against committed SHA-256 locks. Setup uses fresh destinations and verified upstream archives. Static serving stays in the repository and excludes hidden paths. This host is not a general-purpose file server or packaged containment boundary.

## Fixed sources and licenses (checked 2026-10-16)

- SkyTNT code: https://github.com/SkyTNT/midi-model at `f504d5cb58f769ab0f2909c679238f6621034573`, Apache-2.0. Vendored tokenizer is retained; CPU generator adapts upstream inference, removes the progress display and constrains track output. Full license in `vendor/SkyTNT-LICENSE`.
- Model: https://huggingface.co/skytnt/midi-model-tv2o-medium at `0f8f265d4330f4e46527ac2313200254c5757f5f`; publisher's model card explicitly declares Apache-2.0. Two ONNX graphs plus config are fixed in `model-lock.json`. No pickle/checkpoint execution or remote code loading. Base 821,713,887 bytes; token 116,661,381 bytes.
- Sinsy 0.92: https://sinsy.sourceforge.net/readme_sinsy.php, Modified BSD. Commercial use/distribution is expressly permitted subject to notice and non-endorsement conditions.
- HTS engine API 1.10: BSD-style terms, full archive COPYING retained.
- Voice 0.90: https://sinsy.sourceforge.net/readme_hts_voice_nitech_jp_song070_f001.php, **CC BY 3.0**, Nagoya Institute of Technology, Department of Computer Science (2009–2013). Attribution and terms must accompany reuse/distribution. Full COPYING and README are retained. This license does not erase other applicable rights or establish rights to all training compositions/output.
- ONNX Runtime, NumPy, Pillow are explicit development dependencies. Dependency/binary notice closure, macOS loader compatibility, signing/notarization, production asset admission and complete redistribution assembly remain unverified; this setup does not mark any native-wrapper asset slot approved.

## Verification

`node scripts/music-local-real-generation.js` requires `NOVA_MODEL_WEIGHTS`, `NOVA_SINSY`, `NOVA_SINSY_DICTIONARY`, `NOVA_SINSY_VOICE`, and a Python environment with the requirements. It starts the real host, drives existing app APIs with real CPU inference, partial MIDI application/save, real MusicXML→Sinsy WAV import and byte-identical full archive restore. It rejects a foreign Origin. This opt-in check never replaces missing models with fixtures. Browser/physical-device acceptance is separate.

## Prepared runtime launcher and paired iPad transport (2026-10-17)

After explicit setup, `python tools/music-local-generation/launch.py /absolute/assets --check`
checks the fixed model/voice hashes, CPU provider, required directories and executable launch.
Remove `--check` to start. Ctrl-C or SIGTERM stops the host and its owned synthesis process
group. No automatic installation, administrator access, background login service or signed app
is implied. Use an Intel-native Python environment on Intel Mac; this change has not been run
on physical macOS. Missing libraries, wrong CPU binaries and missing assets fail before serving.

For an optional private LAN connection, supply all three arguments:

```sh
python tools/music-local-generation/launch.py /absolute/assets \
  --lan-ip 192.168.1.20 --tls-cert /absolute/server.pem --tls-key /absolute/server-key.pem
```

The certificate must cover that IP and be trusted on the iPad. Certificate provisioning and
trust installation are not performed here. Use the HTTPS URL printed by the Mac and enter
the separate pairing code shown in its terminal. Never put the code in the URL. Only one
browser session is paired at a time; re-pairing revokes it. Sessions expire after eight hours;
restarting the host invalidates all sessions and rotates credentials. Five pairing attempts
per minute per client are allowed. Host/Origin/request-token checks remain in force; no CORS,
public bind, plaintext LAN endpoint or external inference service is enabled.

The served iPad browser sends composition/score requests to the **Mac host**, where ONNX/Sinsy
run. MIDI editing, listening, Vocal editing and local IndexedDB saving remain browser tasks.
The iPad does not run Sinsy or the Python ONNX runtime. Mac and iPad browser storage are separate:
transfer existing work with the full backup/archive workflow. The host has to remain running;
connection/asset failures preserve the current project and are reported in the existing UI.
An HTTPS socket test is not physical Safari acceptance or a signed redistribution approval.

Remaining distribution work: pinned Python/dependency wheels and their notices, complete
Mach-O loader/architecture closure, production asset admission, reproducible Intel bundle,
Developer ID signing/notarization, certificate provisioning, Safari LAN permissions, listening
quality and full-feature acceptance. Existing upstream notice files and asset licenses remain
required; pairing does not change their terms.

The `intel-mac-generation` CI job explicitly requires Darwin/x86_64, builds the fixed
Sinsy/HTS sources, validates launcher prerequisites and executes real model/voice generation
through Studio. It is separate from the unsigned Swift wrapper build and physical-device
acceptance. PyPI CPython 3.12 metadata checked 2026-10-17 lists ONNX Runtime 1.23.2
`macosx_13_0_x86_64`, NumPy 2.5.4 `macosx_10_13_x86_64` and Pillow 12.3.0
`macosx_10_13_x86_64` wheels. This runtime therefore requires macOS 13+ on Intel; earlier
macOS compatibility is not established. See https://pypi.org/pypi/onnxruntime/1.23.2/json .

Sinsy 0.92 is locally modified during preparation: `lib/util/Configurations.cpp`, `MacronTable.cpp` and `PhonemeTable.cpp` use
`std::make_pair` with deduced types for current Apple libc++ compatibility.
Preparation verifies the upstream archive and exact patch context before modification;
`notices/Sinsy-local-modifications.txt` records the change alongside upstream terms.

## Macの起動設定と診断（2026-10-17）

準備済みの資材を使う場合、`launch.example.json`を同じフォルダの`launch.json`へ
コピーし、`assets`を資材の絶対パスへ変更します。専用Python環境をこのフォルダの
`.venv`に置くと、`Start-Music-Engine.command`をFinderから開いて起動できます。
それ以外はPATHの`python3`を使います。初回のPython導入・依存導入・モデル準備は
READMEのSet upが必要です。このファイルは署名済みアプリではありません。
macOSがブロックした場合のGatekeeper回避や管理者操作は自動実行しません。

起動前にPython/macOS、固定依存バージョン、CPU provider、全モデルのSHA256、
歌声音源、Sinsy実行、LAN/TLS設定、待受IP/ポートをまとめて診断します。
失敗項目と日本語の対処をJSONで出力し、ひとつでも失敗するとサーバーを起動しません。
`--check`でも同じ診断のみ実行できます。ポート確認後に別プロセスが取得した場合は
実起動時のbindが最終判定です。診断は実推論、署名、端末の信頼設定の認定ではありません。

### iPad接続用の証明書を明示生成

Macの現在のプライベートIPv4を確認してから、リポジトリの外の新しい保存先を指定します。
既存ファイルは上書きしません。外部通信、端末への信頼登録、管理者操作は行いません。

```sh
python tools/music-local-generation/prepare_tls.py /absolute/private/nova-tls --lan-ip 192.168.1.20
```

`ca.pem`が端末へ渡す公開CA証明書です。Macに表示されたSHA256指紋を照合してから、
自分のMac/iPadでこのCAの信頼設定を明示的に行ってください。
**`ca-key.pem`と`server-key.pem`はMacの非公開フォルダで保管し、iPadへ渡さないでください。**
端末での信頼設定完了は自動確認できません。`TRUST.txt`にも指紋と注意を保存します。

LAN用の`launch.json`例：

```json
{
  "assets": "/absolute/path/nova-generation-assets",
  "port": 8766,
  "lan_ip": "192.168.1.20",
  "tls_cert": "/absolute/private/nova-tls/server.pem",
  "tls_key": "/absolute/private/nova-tls/server-key.pem"
}
```

設定内の相対パスは設定ファイルの場所から解決します。未知の設定項目は拒否します。
起動前に証明書と秘密鍵の一致、IP SAN、有効期間を確認します。サーバー証明書は30日、
CAは365日です。IP変更や期限切れでは新しいフォルダへ再生成して設定と信頼を更新してください。
証明書エラーはペアリング前に起きるため、ブラウザ内の機能では修復できません。
警告を無視して接続せず、Macの起動診断、IPと証明書、端末の信頼設定を確認してください。
接続拒否はIP/ポート/起動状態を確認し、ペアリング失効はMacに表示中のコードで再接続します。
再起動・別ブラウザでの再ペアリングでは旧セッションは使えません。

### Sequential whole-song runtime reuse (2026-10-19)

The host retains at most one SHA-256-verified ONNX base/token session pair.
Unchanged local model files reuse those sessions across bar requests. Seeds,
prompts, sampling generators, token KV buffers and candidate results are fresh
for every request. File inode/device/size/mtime/ctime or manifest changes invalidate
the cache and require full hash verification; failure never falls back to stale
sessions. Restart the host to release the retained model memory. Cancellation is
checked before reuse and between session loads, but cannot interrupt one ONNX
session construction or one running inference call.

Each successful compose response includes `performance`: `sessionReused`,
`loadSeconds` (including request validation), `elapsedSeconds` (through MIDI
serialization), actual base/token `onnxCalls`, and summed raw `midiBytes`.
Counts measure ONNX invocations, not output notes. Timing excludes HTTP transfer
and checkpoint/backup serialization. These measurements do not assert a speedup,
peak memory, eight-minute completion or musical quality.
