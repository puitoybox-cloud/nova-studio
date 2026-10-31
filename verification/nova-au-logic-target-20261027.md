# Logic input confirmation and explicit attenuation — 2026-10-27 JST

Base: Draft #516, 0d6d04e9d8056579d61539d96a3a2d92e2cc8abc. #510 and all prior branches remain unchanged.

User-reported physical results: Intel iMac 2020 / macOS 26.7.1 / Logic 12.3, #510 passes signature, auval, discovery, insertion, native Japanese UI, piano playback and bypass. Candidate creation with 音量を6dB下げて stopped at -10851. Approved Gain changes are not physically verified.

Source findings: NovaMix::command bind rejects empty project/Track IDs. Every following command requires a confirmed matching binding. parseAudioCommand rejects the numeric attenuation request; Control::propose also lacked numeric attenuation. These are independent deterministic blockers. Which guard fired first on the user's machine cannot be established without its snapshot. SDK constant equality with -10851 is asserted in the native build; no OS fault is inferred from the number. View::send appended errors only to the rendered report; the 1-second update replaced that report.

Changes: explicit bind with both IDs empty and no handoff creates instance-scoped nova-local: / input: identity, with no claim to Music Studio or automatic Logic discovery. Partial IDs still reject. Existing handoff bindings retain explicit IDs. Track, Bus and Stereo Out all support this stereo AU-input route; no upstream instrument isolation or third-party control. Source is explicitly user-confirmed, not discovered.

Full-string numeric attenuation accepts >0..24 dB only. Existing Gain + requested delta must fit -24..+6 dB; impossible exact requests reject rather than clamp. A/B/C use 1/3, 2/3, full requested attenuation. Only Gain changes; existing EQ, compressor and bypass values are retained. Proposal does not measure audio or alter settings. Existing instance/baseline/ABA/approval/Undo/state contracts apply. Safety-stopped output cannot be released by attenuation preview. Unknown composite/boost/negative/zero commands reject. Last command summary persists over refresh; bounded timestamped command diagnostics are copied as JSON via explicit 診断をコピー. No render-thread logging or network use.

## Physical recheck after verified build is available

Retain the #510 archive and existing Logic project; test a project copy. Do not install both versions or bypass OS protection. Use only the newly verified CI artifact after its exact commit/build/auval checks pass. Existing INSTALL-JA.md governs backup, signature, SHA256 and replacement/rollback; no system or vendor AU changes.

1. Start with low monitor volume, NOVA Gain 0.00 dB and no automation. Select Stereo Out and describe the actual input; leave both Music Studio IDs blank when no handoff exists. Click 対象を確認. Check confirmed=true, stereo-out and the local identity. This confirms this instance only.
2. Enter 音量を6dB下げて, create candidates. Expect A -2, B -4, C -6 dB; current Gain remains 0.00. Capture/analysis is not required for explicit numeric attenuation.
3. Approve C. Expect Gain -6.00 and audible attenuation. Existing bypass state is retained: if bypassed, switch on deliberately before evaluating sound. Undo restores prior Gain. No increase beyond the prior level is requested by this command.
4. Repeat at Track and Bus with actual routing manually verified. No claim that this discovers channel identity.
5. Save a project copy, quit/reopen, verify parameters; reconfirm target before new proposals. Test bypass and Undo, automation invalidation and rejected composite commands. Never treat CI audio as physical Logic acceptance.
6. On failure, copy diagnostics; retain code, status, binding, current values, instruction and time. Review IDs/source text before sharing. No automatic external transmission.

Local and exact-head CI results are recorded in the Draft PR; pending is not success. No full 30-feature completion claim.
