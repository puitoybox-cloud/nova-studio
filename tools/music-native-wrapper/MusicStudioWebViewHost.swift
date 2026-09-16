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
        webConfiguration.userContentController.addUserScript(
            WKUserScript(
                source: MusicStudioWebMidiBridge.nativeWebMidiShimSource,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        if let marker = configuration.verificationMarker {
            webConfiguration.userContentController.addUserScript(
                WKUserScript(
                    source: Self.verificationMarkerScript(marker),
                    injectionTime: .atDocumentEnd,
                    forMainFrameOnly: true
                )
            )
        }
        self.webView = WKWebView(frame: .zero, configuration: webConfiguration)

        super.init()
        webView.navigationDelegate = self
    }

    public func start() {
        let coordinator = NativeMidiCoordinator(webView: webView, platform: platform)
        midiCoordinator = coordinator
        _ = coordinator.start()
        if configuration.startURL.isFileURL {
            webView.loadFileURL(
                configuration.startURL,
                allowingReadAccessTo: configuration.startURL.deletingLastPathComponent()
            )
        } else {
            webView.load(URLRequest(url: configuration.startURL))
        }
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

    static func verificationMarkerScript(_ marker: String) -> String {
        let data = try! JSONEncoder().encode(marker)
        let encodedMarker = String(decoding: data, as: UTF8.self)
        return """
        (() => {
          const marker = document.createElement('div');
          marker.id = 'nova-pr250-verification-marker';
          marker.setAttribute('role', 'status');
          marker.textContent = \(encodedMarker);
          Object.assign(marker.style, {
            position: 'fixed', right: '8px', bottom: '8px', zIndex: '2147483647',
            maxWidth: '70vw', padding: '4px 8px', borderRadius: '6px',
            background: 'rgba(8, 12, 24, 0.88)', color: '#9fffe0',
            border: '1px solid rgba(159, 255, 224, 0.72)',
            font: '600 10px/1.25 -apple-system, sans-serif',
            pointerEvents: 'none', userSelect: 'none'
          });
          document.body.appendChild(marker);
        })();
        """
    }
}
