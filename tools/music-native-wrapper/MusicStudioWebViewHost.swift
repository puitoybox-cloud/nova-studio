import Foundation
import WebKit

public final class MusicStudioWebViewHost: NSObject, WKNavigationDelegate {
    public let webView: WKWebView
    public let configuration: MusicStudioAppConfiguration
    private var midiCoordinator: NativeMidiCoordinator?
    private let midiDiagnostics: NativeMidiDiagnostics
    private let platform: String

    public init(configuration: MusicStudioAppConfiguration, platform: String) {
        self.configuration = configuration
        self.platform = platform

        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.websiteDataStore = .default()
        webConfiguration.defaultWebpagePreferences.allowsContentJavaScript = true
        webConfiguration.userContentController.addUserScript(
            WKUserScript(
                source: MusicStudioWebMidiBridge.nativeWebMidiShimSource,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        webConfiguration.userContentController.addUserScript(
            WKUserScript(
                source: MusicStudioWebMidiBridge.diagnosticPanelSource,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        self.webView = WKWebView(frame: .zero, configuration: webConfiguration)
        self.midiDiagnostics = NativeMidiDiagnostics(webView: self.webView)

        super.init()
        webView.navigationDelegate = self
    }

    public func start() {
        guard configuration.allows(configuration.startURL) else { return }

        let coordinator = NativeMidiCoordinator(webView: webView, platform: platform, diagnostics: midiDiagnostics)
        midiCoordinator = coordinator
        _ = coordinator.start()
        webView.load(URLRequest(url: configuration.startURL))
    }

    public func stop() {
        midiCoordinator?.stop()
        midiCoordinator = nil
        webView.stopLoading()
    }

    public func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(configuration.allows(url) ? .allow : .cancel)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let url = webView.url, configuration.allows(url) else { return }
        #if os(iOS)
        let platformName = "ipad"
        #else
        let platformName = "mac"
        #endif
        MusicStudioWebMidiBridge(webView: webView, diagnostics: midiDiagnostics).installCapabilityMetadata(platform: platformName)
        midiDiagnostics.replay()
    }
}
