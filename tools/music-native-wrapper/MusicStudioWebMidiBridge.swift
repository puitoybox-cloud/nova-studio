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
      let sourceAvailable = false;
      let explicitlyClosed = false;
      let lastTimestamp = 0;
      const heldNotes = new Map();
      const stateListeners = new Set();
      const portStateListeners = new Set();
      const input = {
        id: 'nova-native-core-midi',
        manufacturer: 'Apple Core MIDI',
        name: 'Core MIDI (Native)',
        type: 'input',
        state: 'disconnected',
        connection: 'closed',
        onmidimessage: null,
        onstatechange: null,
        addEventListener(type, handler) {
          if (type === 'midimessage' && typeof handler === 'function') listeners.add(handler);
          if (type === 'statechange' && typeof handler === 'function') portStateListeners.add(handler);
        },
        removeEventListener(type, handler) {
          if (type === 'midimessage') listeners.delete(handler);
          if (type === 'statechange') portStateListeners.delete(handler);
        },
        open() {
          if (!sourceAvailable) return Promise.reject(new Error('MIDI input disconnected'));
          explicitlyClosed = false;
          this.connection = 'open';
          return Promise.resolve(this);
        },
        close() {
          // Block reentrant MIDI delivery before notifying handlers of note-offs.
          // Those handlers may synchronously invoke dispatch() or close() again.
          explicitlyClosed = true;
          this.connection = 'closed';
          releaseHeldNotes();
          return Promise.resolve(this);
        }
      };

      const access = {
        inputs: new Map([[input.id, input]]),
        outputs: new Map(),
        onstatechange: null,
        addEventListener(type, handler) {
          if (type === 'statechange' && typeof handler === 'function') stateListeners.add(handler);
        },
        removeEventListener(type, handler) {
          if (type === 'statechange') stateListeners.delete(handler);
        },
        sysexEnabled: false
      };

      function pageTimestamp() {
        const now = Number(globalThis.performance?.now?.());
        if (Number.isFinite(now) && now >= lastTimestamp) lastTimestamp = now;
        return lastTimestamp;
      }

      function releaseHeldNotes() {
        // Clear before callbacks: a MIDI handler may synchronously call close().
        const notes = Array.from(heldNotes.values());
        heldNotes.clear();
        for (const note of notes) {
          const event = { data: Uint8Array.from([0x80 | note.channel, note.pitch, 0]), timeStamp: pageTimestamp(), target: input, currentTarget: input };
          const onMessage = input.onmidimessage;
          const recipients = Array.from(listeners);
          if (typeof onMessage === 'function') onMessage(event);
          for (const listener of recipients) listener(event);
        }
      }

      function setSourceAvailable(available) {
        const next = available === true;
        if (next === sourceAvailable) return;
        sourceAvailable = next;
        // Reject reentrant note delivery before notifying listeners of unplug.
        input.state = next ? 'connected' : 'disconnected';
        input.connection = next && !explicitlyClosed ? 'open' : 'closed';
        if (!next) {
          releaseHeldNotes();
        }
        const event = { port: input, target: access, currentTarget: access };
        if (typeof access.onstatechange === 'function') access.onstatechange(event);
        for (const listener of Array.from(stateListeners)) listener(event);
        const portEvent = { port: input, target: input, currentTarget: input };
        if (typeof input.onstatechange === 'function') input.onstatechange(portEvent);
        for (const listener of Array.from(portStateListeners)) listener(portEvent);
      }

      function dispatch(payload) {
        if (!sourceAvailable || input.connection !== 'open') return { accepted: false, reason: 'midi-disconnected' };
        const raw = payload?.data;
        if (!Array.isArray(raw) && !(raw instanceof Uint8Array)) return { accepted: false, reason: 'invalid-message' };
        const data = Array.from(raw);
        if (data.length !== 3) return { accepted: false, reason: 'invalid-message' };
        if (data.some((value, index) => typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > (index === 0 ? 255 : 127))) {
          return { accepted: false, reason: 'invalid-message' };
        }
        const status = Number(data[0]);
        const command = status & 0xf0;
        if (command !== 0x80 && command !== 0x90) {
          return { accepted: false, reason: 'invalid-message' };
        }

        const channel = status & 0x0f;
        const pitch = Number(data[1]);
        const key = channel + ':' + pitch;
        if (command === 0x90 && Number(data[2]) > 0) heldNotes.set(key, { channel, pitch });
        else heldNotes.delete(key);
        const event = {
          data: Uint8Array.from(data.map(Number)),
          timeStamp: pageTimestamp(),
          target: input,
          currentTarget: input
        };
        // Snapshot callbacks before delivery: handlers may close/disconnect the
        // port, remove listeners or add listeners during this very event.
        const onMessage = input.onmidimessage;
        const recipients = Array.from(listeners);
        if (typeof onMessage === 'function') onMessage(event);
        for (const listener of recipients) listener(event);
        return { accepted: true };
      }

      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        value: async (options = {}) => {
          if (options?.sysex === true) throw new Error('Native MIDI SysEx is not supported');
          return access;
        }
      });

      window.NovaMusicNativeMidiShim = { access, input, dispatch, setSourceAvailable };
    })();
    """#

    func setSourceAvailable(_ available: Bool) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.callAsyncJavaScript(
                "return window.NovaMusicNativeMidiShim?.setSourceAvailable(available) ?? null;",
                arguments: ["available": available], in: nil, in: .page
            ) { _ in }
        }
    }

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
