# Music generation startup continuation — 2026-10-17 JST

Baseline PR #444 exact 3aa6ccc8dcea7a9a40407952693ebffc31495bcd, main 552d56eafddfd192970c09f7d6278696cf8775c3. Start connector read: all 189 Draft PR HEAD/base/mergeability/commit counts and exact-head workflow runs, no errors; separate two non-Draft open PRs #10/#35 remain conflicting. Search required overlapping date partitions because topn is capped at 100. Start data is in music-launch-start-20261017.json. Parent exact-head seven workflows SUCCESS, distinct from eleven individual job checks reported by the user. No newer open Draft checkpoint found.

Production changes:
- Foreground Mac .command launcher uses the adjacent dedicated .venv Python when available, with a reusable JSON config; no dynamic shell commands, auto-installation or trust changes.
- Offline aggregate diagnostics gate startup on Python/macOS, pinned dependency versions, CPU provider, asset containment, fixed model/voice hashes, real Sinsy executable launch, valid LAN/TLS parameters and available listening address. All failures include Japanese remedies. Missing dependencies/assets report together rather than raising the first traceback.
- Explicit private-CA and IP SAN server certificate generation outside the web repository, protected private-key modes and no existing-directory replacement. CA fingerprint and trust instructions saved. No download or remote API. Keys never served. Certificate chain, key pairing, IP and dates checked; device trust remains unverified.
- Pairing entry and mismatch/throttling errors now show compact Japanese/English instructions. Existing Host/Origin/token, revocation, cookie expiry and serialization boundaries preserved.

Local checks: all Node 2368 PASS, zero fail/skip; JS node --check; Python compile; bash syntax; base diff whitespace. Four startup regressions and three real HTTPS transport tests PASS. Actual OpenSSL-issued local certificate chain/key/IP, private permissions, no overwrite, missing assets with occupied port, relative config resolution and unknown config rejection tested. Fixed-weight actual inference and four Chrome sizes are provided by the exact-head real-generation CI, not replaced by mocks. Local runtime assets/onnxruntime are absent; local real inference is not claimed.

Not completed: signed/notarized Intel distribution, automatic first installation, actual iPad CA trust/LAN permission/Safari acceptance, key/style/range-conditioned model quality, arbitrary Japanese singing compatibility and quality, full iPad editing layout and remaining 30-function production closure. No 20–30 independent features or percentage completion claimed. No device acceptance claimed. Conservatively inherit No.1–30 C (A0/B0/C30); this is not a fresh full-function audit.

Ready/Merge/Auto Merge/Force push/Live Provider API/previous PR changes/user-data deletion: none.
