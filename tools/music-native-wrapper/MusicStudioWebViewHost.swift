import Foundation
import WebKit

public final class MusicStudioWebViewHost: NSObject, WKNavigationDelegate {
    public let webView: WKWebView
    public let configuration: MusicStudioAppConfiguration
    public private(set) var lifecycleState = "PREPARING"
    private var midiCoordinator: NativeMidiCoordinator?
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
        if let handoff = configuration.localHandoffJSON {
            webConfiguration.websiteDataStore = .nonPersistent()
            webConfiguration.userContentController.addUserScript(WKUserScript(
                source: "window.__NOVA_LOCAL_HANDOFF = " + handoff + ";",
                injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        self.webView = WKWebView(frame: .zero, configuration: webConfiguration)

        super.init()
        webView.navigationDelegate = self
    }

    public func start() {
        guard lifecycleState == "PREPARING", configuration.allows(configuration.startURL) else { lifecycleState = "FAILED"; return }
        lifecycleState = "SERVER_READY"

        let coordinator = NativeMidiCoordinator(webView: webView, platform: platform)
        midiCoordinator = coordinator
        _ = coordinator.start()
        webView.load(URLRequest(url: configuration.startURL))
    }

    public func stop() {
        webView.evaluateJavaScript("window.MusicStudioAudioPipeline?.stopLocal(window.__NOVA_LOCAL_HANDOFF)", completionHandler: nil)
        lifecycleState = "STOPPED"
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

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        stop(); lifecycleState = "FAILED"
    }
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        stop(); lifecycleState = "FAILED"
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let url = webView.url, configuration.allows(url) else { lifecycleState = "FAILED"; stop(); return }
        lifecycleState = "BROWSER_READY"
        #if os(iOS)
        let platformName = "ipad"
        #else
        let platformName = "mac"
        #endif
        MusicStudioWebMidiBridge(webView: webView).installCapabilityMetadata(platform: platformName)
    }
}
