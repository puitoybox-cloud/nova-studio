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
