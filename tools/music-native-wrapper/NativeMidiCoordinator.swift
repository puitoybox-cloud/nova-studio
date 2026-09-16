import Foundation
import WebKit

/// Small composition root shared by the future macOS and iPadOS wrappers.
final class NativeMidiCoordinator {
    private let webBridge: MusicStudioWebMidiBridge
    private lazy var midiBridge = CoreMidiInputBridge { [weak self] bytes in
        self?.webBridge.sendNoteMessage(bytes)
    }

    init(webView: WKWebView, platform: String) {
        self.webBridge = MusicStudioWebMidiBridge(webView: webView)
        self.webBridge.installCapabilityMetadata(platform: platform)
    }

    @discardableResult
    func start() -> OSStatus {
        midiBridge.start()
    }

    func stop() {
        midiBridge.stop()
    }
}
