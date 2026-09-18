import Foundation
import WebKit

/// Verification-only, in-memory status relay used by the PR #248 diagnostic
/// artifact. It exposes no command surface and never persists or transmits data.
final class NativeMidiDiagnostics {
    private weak var webView: WKWebView?
    private let lock = NSLock()
    private var stages: [String: [String: Any]] = [:]
    private var messageCounts: [String: [String: Int]] = [:]
    private var lastMessage = "Waiting for a physical MIDI note"

    init(webView: WKWebView) {
        self.webView = webView
    }

    func mark(_ stage: String, status: String, detail: String = "", increment: Bool = false) {
        lock.lock()
        var value = stages[stage] ?? ["status": "WAIT", "detail": "", "count": 0]
        value["status"] = status
        if !detail.isEmpty { value["detail"] = detail }
        if increment { value["count"] = (value["count"] as? Int ?? 0) + 1 }
        stages[stage] = value
        let snapshot = makeSnapshot()
        lock.unlock()
        publish(snapshot)
    }

    func note(_ bytes: [UInt8]) {
        guard bytes.count == 3 else { return }
        let command = bytes[0] & 0xF0
        let kind = command == 0x80 || (command == 0x90 && bytes[2] == 0) ? "Note Off" : "Note On"
        lock.lock()
        lastMessage = "\(kind) / pitch \(bytes[1]) / velocity \(bytes[2])"
        let snapshot = makeSnapshot()
        lock.unlock()
        publish(snapshot)
    }

    func markMessage(_ stage: String, status: String, bytes: [UInt8], detail: String) {
        guard bytes.count == 3 else { return }
        let command = bytes[0] & 0xF0
        let kind = command == 0x80 || (command == 0x90 && bytes[2] == 0) ? "Note Off" : "Note On"
        lock.lock()
        var counts = messageCounts[stage] ?? ["Note On": 0, "Note Off": 0]
        counts[kind, default: 0] += 1
        messageCounts[stage] = counts
        stages[stage] = [
            "status": status,
            "detail": "\(detail) / Note On \(counts["Note On", default: 0]) / Note Off \(counts["Note Off", default: 0])",
            "count": counts.values.reduce(0, +)
        ]
        let snapshot = makeSnapshot()
        lock.unlock()
        publish(snapshot)
    }

    func replay() {
        lock.lock()
        let snapshot = makeSnapshot()
        lock.unlock()
        publish(snapshot)
    }

    private func makeSnapshot() -> [String: Any] {
        ["stages": stages, "lastMessage": lastMessage]
    }

    private func publish(_ snapshot: [String: Any]) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.callAsyncJavaScript(
                "window.NovaNativeMidiDiagnostics?.update(snapshot); return true;",
                arguments: ["snapshot": snapshot],
                in: nil,
                in: .page
            ) { _ in }
        }
    }
}

/// Delivers validated native MIDI bytes into Music Studio's existing Web MIDI
/// path without exposing an arbitrary native-to-web command surface.
final class MusicStudioWebMidiBridge {
    private weak var webView: WKWebView?
    private let diagnostics: NativeMidiDiagnostics

    init(webView: WKWebView, diagnostics: NativeMidiDiagnostics) {
        self.webView = webView
        self.diagnostics = diagnostics
    }

    static let diagnosticPanelSource = #"""
    (() => {
      const labels = {
        A: 'A Core MIDI source connected', B: 'B Core MIDI callback received',
        C: 'C UMP Note decoded', D: 'D Coordinator received',
        E: 'E Swift → JavaScript completed', F: 'F Shim dispatch received',
        G: 'G onmidimessage delivered'
      };
      const state = { stages: {}, lastMessage: 'Waiting for a physical MIDI note' };
      function ensurePanel() {
        if (document.getElementById('nova-native-midi-diagnostics')) return;
        if (!document.body) return void setTimeout(ensurePanel, 0);
        const panel = document.createElement('aside');
        panel.id = 'nova-native-midi-diagnostics';
        panel.setAttribute('aria-label', 'Native MIDI Diagnostics');
        panel.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;width:360px;max-height:70vh;overflow:auto;padding:12px;border:1px solid #64748b;border-radius:10px;background:rgba(2,6,23,.96);color:#e2e8f0;font:12px/1.35 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.4)';
        document.body.appendChild(panel);
        render();
      }
      function render() {
        const panel = document.getElementById('nova-native-midi-diagnostics');
        if (!panel) return;
        const rows = Object.entries(labels).map(([key, label]) => {
          const item = state.stages[key] || { status: 'WAIT', detail: '', count: 0 };
          const color = item.status === 'PASS' ? '#4ade80' : item.status === 'FAIL' || item.status === 'DECODE REJECT' ? '#fb7185' : '#facc15';
          const count = Number(item.count) ? ` · count ${Number(item.count)}` : '';
          return `<div style="padding:5px 0;border-top:1px solid #1e293b"><div><b>${label}</b> <strong style="color:${color}">${item.status}</strong>${count}</div>${item.detail ? `<div style="color:#94a3b8;overflow-wrap:anywhere">${String(item.detail).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</div>` : ''}</div>`;
        }).join('');
        panel.innerHTML = `<div style="font-size:14px;font-weight:800;margin-bottom:6px">Native MIDI Diagnostics</div>${rows}<div style="padding-top:7px;color:#cbd5e1"><b>Last message:</b> ${state.lastMessage}</div>`;
      }
      function update(snapshot) {
        if (snapshot?.stages) Object.assign(state.stages, snapshot.stages);
        if (snapshot?.lastMessage) state.lastMessage = String(snapshot.lastMessage);
        ensurePanel(); render();
      }
      window.NovaNativeMidiDiagnostics = { update };
      ensurePanel();
    })();
    """#

    /// Installs a narrow Web MIDI compatibility shim before Music Studio's
    /// scripts execute. Existing editor code can keep using
    /// `navigator.requestMIDIAccess()` while Core MIDI remains the real device
    /// transport inside the native app.
    static let nativeWebMidiShimSource = #"""
    (() => {
      if (typeof navigator.requestMIDIAccess === 'function') return;

      const listeners = new Set();
      let lastTimestamp = 0;
      const input = {
        id: 'nova-native-core-midi',
        manufacturer: 'Apple Core MIDI',
        name: 'Core MIDI (Native)',
        type: 'input',
        state: 'connected',
        connection: 'open',
        onmidimessage: null,
        addEventListener(type, handler) {
          if (type === 'midimessage' && typeof handler === 'function') listeners.add(handler);
        },
        removeEventListener(type, handler) {
          if (type === 'midimessage') listeners.delete(handler);
        },
        open() {
          this.connection = 'open';
          return Promise.resolve(this);
        },
        close() {
          this.connection = 'closed';
          return Promise.resolve(this);
        }
      };

      const access = {
        inputs: new Map([[input.id, input]]),
        outputs: new Map(),
        onstatechange: null,
        sysexEnabled: false
      };

      function pageTimestamp() {
        const now = Number(globalThis.performance?.now?.());
        if (Number.isFinite(now) && now >= lastTimestamp) lastTimestamp = now;
        return lastTimestamp;
      }

      function dispatch(payload) {
        const data = Array.from(payload?.data || []);
        const kind = data[0] === 0x80 || (data[0] === 0x90 && data[2] === 0) ? 'Note Off' : 'Note On';
        function diagnosticCount(stage, detail) {
          const counts = window.__novaMidiDiagnosticCounts ||= {};
          const value = counts[stage] ||= { 'Note On': 0, 'Note Off': 0 };
          value[kind]++;
          window.NovaNativeMidiDiagnostics?.update({ stages: { [stage]: { status: 'PASS', detail: `${detail} / Note On ${value['Note On']} / Note Off ${value['Note Off']}`, count: value['Note On'] + value['Note Off'] } } });
        }
        diagnosticCount('F', 'dispatch entered');
        if (data.length !== 3) return { accepted: false, reason: 'invalid-message' };
        if (data.some((value, index) => !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > (index === 0 ? 255 : 127))) {
          return { accepted: false, reason: 'invalid-message' };
        }
        const status = Number(data[0]);
        const command = status & 0xf0;
        if (command !== 0x80 && command !== 0x90) {
          return { accepted: false, reason: 'invalid-message' };
        }

        const event = {
          data: Uint8Array.from(data.map(Number)),
          timeStamp: pageTimestamp(),
          target: input,
          currentTarget: input
        };
        if (typeof input.onmidimessage === 'function') {
          input.onmidimessage(event);
          diagnosticCount('G', 'existing handler returned');
        }
        for (const listener of listeners) listener(event);
        return { accepted: true };
      }

      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        value: async () => access
      });

      window.NovaMusicNativeMidiShim = { access, input, dispatch };
    })();
    """#

    func sendNoteMessage(_ bytes: [UInt8]) {
        guard bytes.count == 3 else { return }
        let status = bytes[0]
        let command = status & 0xF0
        guard command == 0x80 || command == 0x90 else { return }
        guard bytes[1] <= 127, bytes[2] <= 127 else { return }

        let payload: [String: Any] = [
            "data": bytes.map(Int.init)
        ]

        DispatchQueue.main.async { [weak self] in
            guard let self, let webView = self.webView else { return }
            let diagnostics = self.diagnostics
            webView.callAsyncJavaScript(
                "return window.NovaMusicNativeMidiShim?.dispatch(payload) ?? window.MusicStudioMidiInput?.receiveNativeMessage(payload) ?? { accepted: false, reason: 'bridge-unavailable' };",
                arguments: ["payload": payload],
                in: nil,
                in: .page
            ) { [weak diagnostics] result in
                switch result {
                case .success:
                    diagnostics?.markMessage("E", status: "PASS", bytes: bytes, detail: "callAsyncJavaScript completed")
                case .failure(let error):
                    diagnostics?.mark("E", status: "FAIL", detail: String(describing: type(of: error)))
                }
            }
        }
    }

    /// Injects only capability metadata. MIDI data itself flows through the
    /// compatibility shim above, with the PR #243 ingress retained as fallback.
    func installCapabilityMetadata(platform: String, version: String = "2") {
        let metadata: [String: Any] = [
            "isAvailable": true,
            "platform": platform,
            "version": version
        ]

        DispatchQueue.main.async { [weak self] in
            self?.webView?.callAsyncJavaScript(
                "window.NovaMusicNativeMidi = metadata; return true;",
                arguments: ["metadata": metadata],
                in: nil,
                in: .page
            ) { _ in }
        }
    }
}
