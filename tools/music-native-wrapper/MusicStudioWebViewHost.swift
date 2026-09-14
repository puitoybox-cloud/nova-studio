import Foundation
import WebKit

public final class MusicStudioWebViewHost: NSObject, WKNavigationDelegate {
    public let webView: WKWebView
    public let configuration: MusicStudioAppConfiguration
    private var midiCoordinator: NativeMidiCoordinator?
    private let platform: String

    public init(configuration: MusicStudioAppConfiguration, platform: String) {
        self.configuration = configuration
        self.platform = platform

        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.websiteDataStore = .default()
        webConfiguration.defaultWebpagePreferences.allowsContentJavaScript = true
        self.webView = WKWebView(frame: .zero, configuration: webConfiguration)

        super.init()
        webView.navigationDelegate = self
    }

    public func start() {
        let coordinator = NativeMidiCoordinator(webView: webView, platform: platform)
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
        MusicStudioWebMidiBridge(webView: webView).installCapabilityMetadata(platform: platformName)
    }
}
