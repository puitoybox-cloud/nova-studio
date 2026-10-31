import Foundation
import WebKit

/// Small composition root shared by the future macOS and iPadOS wrappers.
final class NativeMidiCoordinator {
    private let webBridge: MusicStudioWebMidiBridge
    private let availabilityLock = NSLock()
    private var latestAvailability = false
    private lazy var midiBridge = CoreMidiInputBridge(onMessage: { [weak self] bytes in
        self?.webBridge.sendNoteMessage(bytes)
    }, onSourceAvailability: { [weak self] available in
        self?.rememberAvailability(available)
    })

    init(webView: WKWebView, platform: String) {
        self.webBridge = MusicStudioWebMidiBridge(webView: webView)
        self.webBridge.installCapabilityMetadata(platform: platform)
    }

    @discardableResult
    func start() -> OSStatus {
        midiBridge.start()
    }

    private func rememberAvailability(_ available: Bool) {
        availabilityLock.lock()
        latestAvailability = available
        availabilityLock.unlock()
        webBridge.setSourceAvailable(available)
    }

    func resyncPageAvailability() {
        availabilityLock.lock()
        let available = latestAvailability
        availabilityLock.unlock()
        webBridge.setSourceAvailable(available)
    }

    func stop() {
        midiBridge.stop()
    }
}
