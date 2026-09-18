import Foundation
import WebKit

/// Small composition root shared by the future macOS and iPadOS wrappers.
final class NativeMidiCoordinator {
    private let webBridge: MusicStudioWebMidiBridge
    private let diagnostics: NativeMidiDiagnostics
    private lazy var midiBridge = CoreMidiInputBridge(diagnostics: diagnostics) { [weak self] bytes in
        self?.diagnostics.markMessage("D", status: "PASS", bytes: bytes, detail: Self.messageSummary(bytes))
        self?.webBridge.sendNoteMessage(bytes)
    }

    init(webView: WKWebView, platform: String, diagnostics: NativeMidiDiagnostics) {
        self.diagnostics = diagnostics
        self.webBridge = MusicStudioWebMidiBridge(webView: webView, diagnostics: diagnostics)
        self.webBridge.installCapabilityMetadata(platform: platform)
    }

    @discardableResult
    func start() -> OSStatus {
        midiBridge.start()
    }

    func stop() {
        midiBridge.stop()
    }

    private static func messageSummary(_ bytes: [UInt8]) -> String {
        guard bytes.count == 3 else { return "invalid message" }
        return "[\(bytes[0]), \(bytes[1]), \(bytes[2])]"
    }
}
