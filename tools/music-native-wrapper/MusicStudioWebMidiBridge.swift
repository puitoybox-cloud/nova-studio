import Foundation
import WebKit

/// Delivers validated native MIDI bytes into the narrow JavaScript ingress
/// created by PR #243. No arbitrary native-to-web command surface is exposed.
final class MusicStudioWebMidiBridge {
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
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
                "return window.MusicStudioMidiInput?.receiveNativeMessage(payload) ?? { accepted: false, reason: 'bridge-unavailable' };",
                arguments: ["payload": payload],
                in: nil,
                in: .page
            ) { _ in
                // Delivery errors are intentionally contained here. The native
                // wrapper must not mutate project state directly.
            }
        }
    }

    /// Injects only capability metadata. MIDI data itself flows through
    /// `receiveNativeMessage` above.
    func installCapabilityMetadata(platform: String, version: String = "1") {
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
