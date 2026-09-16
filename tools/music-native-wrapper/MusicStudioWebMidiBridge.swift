import Foundation
import WebKit

/// Delivers validated native MIDI bytes into Music Studio's existing Web MIDI
/// path without exposing an arbitrary native-to-web command surface.
final class MusicStudioWebMidiBridge {
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    /// Installs a narrow Web MIDI compatibility shim before Music Studio's
    /// scripts execute. Existing editor code can keep using
    /// `navigator.requestMIDIAccess()` while Core MIDI remains the real device
    /// transport inside the native app.
    static let nativeWebMidiShimSource = #"""
    (() => {
      if (typeof navigator.requestMIDIAccess === 'function') return;

      const listeners = new Set();
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

      function dispatch(payload) {
        const data = Array.from(payload?.data || []);
        if (data.length !== 3) return { accepted: false, reason: 'invalid-message' };
        const status = Number(data[0]);
        const command = status & 0xf0;
        if (!Number.isInteger(status) || (command !== 0x80 && command !== 0x90)) {
          return { accepted: false, reason: 'invalid-message' };
        }
        if (data.slice(1).some(value => !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 127)) {
          return { accepted: false, reason: 'invalid-message' };
        }

        const event = {
          data: Uint8Array.from(data.map(Number)),
          timeStamp: performance.now(),
          target: input,
          currentTarget: input
        };
        if (typeof input.onmidimessage === 'function') input.onmidimessage(event);
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
            guard let webView = self?.webView else { return }
            webView.callAsyncJavaScript(
                "return window.NovaMusicNativeMidiShim?.dispatch(payload) ?? window.MusicStudioMidiInput?.receiveNativeMessage(payload) ?? { accepted: false, reason: 'bridge-unavailable' };",
                arguments: ["payload": payload],
                in: nil,
                in: .page
            ) { _ in
                // Delivery errors are intentionally contained here. The native
                // wrapper must not mutate project state directly.
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
