import Foundation
import WebKit

public final class MusicStudioWebViewHost: NSObject, WKNavigationDelegate {
    public let webView: WKWebView
    public let configuration: MusicStudioAppConfiguration
    public private(set) var lifecycleState = "PREPARING"
    public private(set) var ownedLifecycle: MusicStudioOwnedLifecycle?
    private let ownedTransport = MusicStudioOwnedControlTransport()
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
        if let credential = configuration.ownedCredential, let session = configuration.ownedSession,
           let port = configuration.startURL.port, let origin = URL(string: "http://127.0.0.1:\(port)") {
            ownedLifecycle = try? MusicStudioOwnedLifecycle(origin: origin, session: session, credential: credential)
        }
        webView.navigationDelegate = self
    }

    public func start() {
        guard lifecycleState == "PREPARING", configuration.allows(configuration.startURL),
              configuration.ownedCredential == nil || ownedLifecycle != nil else { lifecycleState = "FAILED"; return }
        lifecycleState = "SERVER_READY"

        let coordinator = NativeMidiCoordinator(webView: webView, platform: platform)
        midiCoordinator = coordinator
        _ = coordinator.start()
        webView.load(URLRequest(url: configuration.startURL))
    }

    /// Explicit Swift owner API; page messages cannot choose request/result authority.
    public func ownedCommand(_ action: String, request: String? = nil,
                             input: MusicStudioOutputIdentity? = nil, outputBytes: Data? = nil,
                             completion: @escaping (Bool) -> Void) {
        guard let owner = ownedLifecycle else { completion(false); return }
        do {
            let message = try owner.command(action, request: request, input: input, outputBytes: outputBytes)
            ownedTransport.send(message) { [weak self] result in
                DispatchQueue.main.async {
                    do { try owner.receive(result.get()); self?.lifecycleState = owner.state; completion(true) }
                    catch { owner.fail(); self?.lifecycleState = "FAILED"; completion(false) }
                }
            }
        } catch { completion(false) }
    }

    public func stop() {
        if let owner = ownedLifecycle {
            do {
                let request = try owner.command("stop")
                lifecycleState = "STOPPING"
                ownedTransport.send(request) { [weak self] result in
                    DispatchQueue.main.async {
                        do { try owner.receive(result.get()); self?.lifecycleState = owner.state }
                        catch { owner.fail(); self?.lifecycleState = "FAILED" }
                    }
                }
            } catch { owner.fail(); lifecycleState = "FAILED" }
        } else if configuration.ownedCredential != nil {
            lifecycleState = "FAILED"
        } else {
            webView.evaluateJavaScript("window.MusicStudioAudioPipeline?.stopLocal(window.__NOVA_LOCAL_HANDOFF)", completionHandler: nil)
            lifecycleState = "STOPPED"
        }
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
