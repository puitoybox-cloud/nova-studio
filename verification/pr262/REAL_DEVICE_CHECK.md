# PR #262 real-device checklist

The `PRODUCT_HEAD.txt` in the browser artifact identifies the checked-out product commit. The browser ZIP contains the whole tracked site at that commit. The Mac `.app` ZIPs contain launchers, not the PR web assets: both open the production GitHub Pages Music Studio URL. The Mac wrapper adds native MIDI input through WKWebView. The Audio Helper runs a local service on `127.0.0.1:8766`; it requires Python 3 and first-run pip installation of the packages in `requirements.txt`. These package downloads are setup dependencies, not song uploads. The Helper app is ad-hoc signed and is not notarized, and macOS can block it. Do not bypass Gatekeeper for this artifact. Use the inspectable source package below for testing.

## Mac / Chrome (Intel)

1. Download the **PR262-Browser-Exact-Head** artifact for the final commit from this workflow's Actions run. Unzip the Actions artifact, then unzip the contained `PR262-Browser-Exact-Head.zip`. Open `verification/pr262/START_PR262_PREVIEW.command` in the extracted folder. If macOS prevents running a downloaded script, inspect it first and use Terminal `bash verification/pr262/START_PR262_PREVIEW.command` from that folder.
2. Open the printed `VERIFICATION_URL` in Chrome and compare its complete hash with the PR head. The preview binds only to Mac loopback `127.0.0.1:8765`; it does not expose files on the LAN. It uses browser storage under that origin, separate from the published site. Create a **new synthetic test project** there; do not import a backup or the original song.
3. Separately download the exact-head **PR262-Local-Audio-Helper-Source** artifact from the Mac Helper Actions run. Unzip both layers, compare `PRODUCT_HEAD.txt`, review `README.md`, and run its standalone `START_AUDIO_PIPELINE.command` with Terminal `bash` as documented. Check `http://127.0.0.1:8766/health` and require `localOnly: true`; the health endpoint does not prove ML dependencies can convert a song. Stay on the Chrome `127.0.0.1:8765` PR preview. To stop the Helper, use the package's standalone `STOP_AUDIO_PIPELINE.command` with Terminal `bash`. Never kill a process by guessed PID.
4. Import a locally generated short synthetic WAV. Check progress or failure text, six named stems **if all six actually yield notes**, Track Review, exact Track ID editing, Save/Reopen, scoped repair Preview/Cancel/Apply/Undo, single and combined MIDI export, then import exported MIDI into Logic Pro and re-export/reimport it into a second test project. Record missing stems as a result, not an automatic failure if the fixture is silent in those stems. Verify original and test projects are distinct.
5. Stop the browser preview with `verification/pr262/STOP_PR262_PREVIEW.command`. Stop the Helper separately. Check Chrome Console error and warning entries and note which operation caused each.

## Audio accuracy check for the September 25 fixture

On the same exact-head Mac / Chrome preview, import `PR262_synthetic_melody_test.wav` into a new test project. In the combined MIDI export, inspect **Vocals (E1)** specifically: its six notes should have MIDI pitches `60, 64, 67, 72, 67, 60` (C4, E4, G4, C5, G4, C4), approximately 0.75 seconds apart. Listen to E1 in isolation and confirm that E4 is not F4 and sustained notes are not split. The other five stems are separate transcription results; their combined note count is not the melody accuracy measure. Record the exact product hash, E1 pitches, E1 count, and Console warnings/errors. Do not alter an existing saved song or backup.
Use Browser Preview and local source Helper artifacts labeled with the **same final product HEAD**; an artifact built before the audio accuracy fix cannot verify this result.
Begin the Mac check after the exact-head Browser Preview and Helper source packaging workflows both succeed for that HEAD.

## M1 iPad / Safari

Open the published HTTPS Music Studio URL in Safari, create a separate test project, rotate to landscape, inspect header and piano roll width, touch select/drag/resize, Save/Reopen, and check Safari Web Inspector via a Mac if available. This checks the **published site**, whose commit must be recorded separately; it is not an exact-head PR #262 check. Mac loopback cannot be reached from iPad and an untrusted LAN HTTP origin is not a substitute for an HTTPS preview. Audio Helper runs on the Mac only and its loopback endpoint cannot be used by the iPad.

The native iPad CI target builds for simulator with `CODE_SIGNING_ALLOWED=NO`. No signed iPad installable artifact or provisioning profile is produced. Physical installation requires a Mac with Xcode, an Apple development team identity and device provisioning/signing, plus the device connected/trusted (or an approved distribution route). Signing credentials and a physical iPad are not available in CI; native physical-device behavior is unverified.

## Evidence to capture

For each terminal/browser: date, device and browser version, product or published site hash, fixture name, screenshots of six tracks and UI, export file names, Logic Pro round trip result, Console errors/warnings, and whether copied project survives reopening. Keep original project and backup unchanged.
