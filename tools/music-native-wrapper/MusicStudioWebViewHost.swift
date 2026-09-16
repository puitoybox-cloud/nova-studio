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
        webConfiguration.userContentController.addUserScript(WKUserScript(source: MusicStudioWebMidiBridge.nativeWebMidiShimSource, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        self.webView = WKWebView(frame: .zero, configuration: webConfiguration)
        super.init()
        webView.navigationDelegate = self
#if os(iOS)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.contentInset = .zero
        webView.scrollView.scrollIndicatorInsets = .zero
#endif
    }

    public func start() {
        let coordinator = NativeMidiCoordinator(webView: webView, platform: platform)
        midiCoordinator = coordinator
        _ = coordinator.start()
        let host = configuration.startURL.host?.lowercased()
        if host == "raw.githubusercontent.com" || host == "cdn.jsdelivr.net" {
            URLSession.shared.dataTask(with: configuration.startURL) { [weak self] data, _, error in
                guard let self, error == nil, let data, let html = String(data: data, encoding: .utf8) else { return }
                var components = URLComponents(url: self.configuration.startURL, resolvingAgainstBaseURL: false)
                components?.query = nil
                let cleanURL = components?.url ?? self.configuration.startURL
                let baseURL = cleanURL.deletingLastPathComponent().appendingPathComponent("")
                DispatchQueue.main.async { self.webView.loadHTMLString(html, baseURL: baseURL) }
            }.resume()
            return
        }
        webView.load(URLRequest(url: configuration.startURL))
    }

    public func stop() { midiCoordinator?.stop(); midiCoordinator = nil; webView.stopLoading() }

    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        decisionHandler(configuration.allows(url) ? .allow : .cancel)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        let platformName = "ipad"
#else
        let platformName = "mac"
#endif
        MusicStudioWebMidiBridge(webView: webView).installCapabilityMetadata(platform: platformName)
    }
}
