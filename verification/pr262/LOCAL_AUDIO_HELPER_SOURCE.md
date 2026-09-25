# Local Audio Helper source verification

This archive contains only inspectable project files, not a signed macOS application. It is the safe fallback while no Developer ID signing and Apple notarization are configured for the app artifact. `PRODUCT_HEAD.txt` identifies the exact checkout; compare it with the Browser Preview marker and PR head before testing.

From Terminal, after reading `START_AUDIO_PIPELINE.command`, `STOP_AUDIO_PIPELINE.command`, `requirements.txt`, and `server.py`, run `bash /path/to/PR262-Local-Audio-Helper-Source/START_AUDIO_PIPELINE.command`. Use the actual extracted path. This calls Python 3 on your Mac, creates `.venv` alongside the source, downloads dependencies from Python package indexes on first run, starts a server bound to `127.0.0.1:8766`, and keeps a local PID/log. It does not ask you to change macOS security settings or launch an app's internal executable. Package downloads and compatibility with your Intel Mac's installed Python/macOS version remain unverified until setup runs on that Mac.

Check `http://127.0.0.1:8766/health` for `localOnly: true`, then return to the **PR Browser Preview** at `http://127.0.0.1:8765/music-studio.html` in Chrome. The health response only verifies the running service; actual six-stem conversion requires a synthetic audio fixture. End by running `bash /path/to/PR262-Local-Audio-Helper-Source/STOP_AUDIO_PIPELINE.command` from Terminal. This script checks the saved PID and listening process before sending a stop signal. Do not move or delete the extracted folder between start and stop.

No original song or backup is needed. Keep the test project separate. If dependency installation fails, retain the full Terminal output and `audio-pipeline.log` from this folder; do not assume the conversion passed.
