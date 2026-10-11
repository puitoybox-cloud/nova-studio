import Foundation
import WebKit
#if os(macOS)
import AppKit
#endif

public final class MusicStudioWebViewHost: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
    public let webView: WKWebView
    public let configuration: MusicStudioAppConfiguration
    public private(set) var lifecycleState = "PREPARING"
    public private(set) var ownedLifecycle: MusicStudioOwnedLifecycle?
    private let ownedTransport = MusicStudioOwnedControlTransport()
    private var privateSummary: MusicStudioPrivateSummaryChannel?
    private var renewalWork: DispatchWorkItem?
    private var automaticRenewals = 0
    private var midiCoordinator: NativeMidiCoordinator?
    private let platform: String
    private var closePreparationInFlight = false
    #if os(macOS)
    public static let activeHosts = NSHashTable<MusicStudioWebViewHost>.weakObjects()
    private weak var guardedWindow: NSWindow?
    private var windowCloseGuard: MusicStudioWindowCloseGuard?
    #endif

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
        #if os(macOS)
        Self.activeHosts.add(self)
        #endif
        if let credential = configuration.ownedCredential, let session = configuration.ownedSession,
           let port = configuration.startURL.port, let origin = URL(string: "http://127.0.0.1:\(port)") {
            ownedLifecycle = try? MusicStudioOwnedLifecycle(origin: origin, session: session, credential: credential)
            if let descriptor = configuration.ownedSummaryDescriptor {
                privateSummary = try? MusicStudioPrivateSummaryChannel(inheritedDescriptor: descriptor)
                if privateSummary == nil { ownedLifecycle?.fail(); ownedLifecycle = nil }
            }
        }
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if ownedLifecycle != nil {
            webConfiguration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "novaOwnedProcessing")
            webConfiguration.userContentController.addUserScript(WKUserScript(source:
                "Object.defineProperty(window, '__NOVA_OWNED_PROCESSING', {value:Object.freeze({authorize:value=>window.webkit.messageHandlers.novaOwnedProcessing.postMessage({action:'authorize',...value}),accept:value=>window.webkit.messageHandlers.novaOwnedProcessing.postMessage({action:'accept',...value})}),writable:false,configurable:false});",
                injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }

    public func start() {
        guard lifecycleState == "PREPARING", configuration.allows(configuration.startURL),
              configuration.ownedCredential == nil || (ownedLifecycle != nil && privateSummary != nil) else { lifecycleState = "FAILED"; return }
        lifecycleState = "SERVER_READY"

        let coordinator = NativeMidiCoordinator(webView: webView, platform: platform)
        midiCoordinator = coordinator
        _ = coordinator.start()
        if configuration.startURL.isFileURL {
            webView.loadFileURL(configuration.startURL, allowingReadAccessTo: configuration.startURL.deletingLastPathComponent())
        } else {
            webView.load(URLRequest(url: configuration.startURL))
        }
    }

    /// Explicit Swift owner API; page messages cannot choose request/result authority.
    public func ownedCommand(_ action: String, request: String? = nil,
                             input: MusicStudioOutputIdentity? = nil, outputBytes: Data? = nil,
                             expectedInventory: String? = nil, processingContract: String? = nil,
                             completion: @escaping (Bool) -> Void) {
        guard let owner = ownedLifecycle else { completion(false); return }
        if ["result","stop"].contains(action) { renewalWork?.cancel(); renewalWork = nil }
        do {
            let message = try owner.command(action, request: request, input: input, outputBytes: outputBytes, expectedInventory: expectedInventory, processingContract: processingContract)
            ownedTransport.send(message) { [weak self] result in
                DispatchQueue.main.async {
                    do {
                        try owner.receive(result.get()); self?.lifecycleState = owner.state
                        if action == "stop" { self?.receivePrivateFinalSummary(owner) }
                        if action == "authorize" { self?.scheduleOwnedRenewal() }
                        completion(true)
                    }
                    catch { owner.fail(); self?.lifecycleState = "FAILED"; completion(false) }
                }
            }
        } catch { completion(false) }
    }

    private func receivePrivateFinalSummary(_ owner: MusicStudioOwnedLifecycle) {
        guard let channel = privateSummary else { return }
        privateSummary = nil
        // Retain the owner/channel even if the view is dismantled during shutdown.
        DispatchQueue.global(qos: .utility).async { [weak self] in
            do {
                try channel.exchange(owner: owner)
                DispatchQueue.main.async { self?.lifecycleState = owner.state }
            } catch {
                owner.fail()
                DispatchQueue.main.async { self?.lifecycleState = "FAILED" }
            }
        }
    }

    private func scheduleOwnedRenewal() {
        renewalWork?.cancel()
        guard automaticRenewals < 2, ownedLifecycle?.state == "PROCESSING" else { return }
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.ownedLifecycle?.state == "PROCESSING", self.automaticRenewals < 2 else { return }
            self.ownedCommand("renew") { ok in
                guard ok else { self.ownedLifecycle?.fail(); self.lifecycleState = "FAILED"; return }
                self.automaticRenewals += 1; self.scheduleOwnedRenewal()
            }
        }
        renewalWork = work
        DispatchQueue.main.asyncAfter(deadline:.now() + 15,execute:work)
    }

    /// Only the main frame at the exact approved local origin can request an owned admission.
    /// The private control capability stays in Swift. The page receives a one-shot ticket.
    public func userContentController(_ userContentController: WKUserContentController,
                                      didReceive message: WKScriptMessage,
                                      replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
              configuration.allows(url), url.scheme == "http", url.host == "127.0.0.1",
              url.port == configuration.startURL.port, let owner = ownedLifecycle,
              let value = message.body as? [String: Any], let action = value["action"] as? String else {
            replyHandler(nil, "foreign-owned-processing-frame"); return
        }
        if action == "authorize" {
            guard Set(value.keys) == Set(["action","request","input","expectedInventory","processingContract"]),
                  let request = value["request"] as? String, let input = value["input"] as? [String: Any],
                  Set(input.keys) == Set(["digest","byteLength"]), let digest = input["digest"] as? String,
                  let length = input["byteLength"] as? Int, let expected = value["expectedInventory"] as? String,
                  let contract = value["processingContract"] as? String else { replyHandler(nil,"invalid-owned-authorization"); return }
            ownedCommand("authorize",request:request,input:MusicStudioOutputIdentity(digest:digest,byteLength:length),
                         expectedInventory:expected,processingContract:contract) { ok in
                guard ok, let auth = owner.authorization else { replyHandler(nil,"owned-authorization-denied"); return }
                replyHandler(["ticket":auth.ticket,"request":auth.request,"session":auth.session],nil)
            }
        } else if action == "accept" {
            guard Set(value.keys) == Set(["action","midiBase64"]), let encoded = value["midiBase64"] as? String,
                  encoded.utf8.count <= 89478488, let bytes = Data(base64Encoded: encoded),
                  bytes.count <= 64*1024*1024 else { replyHandler(nil,"invalid-owned-output"); return }
            ownedCommand("result") { [weak self] ok in
                guard ok, let self else { replyHandler(nil,"owned-result-denied"); return }
                self.ownedCommand("accept",outputBytes:bytes) { ok in
                    guard ok else { replyHandler(nil,"owned-output-denied"); return }
                    self.ownedCommand("stop") { stopped in
                        replyHandler(stopped ? ["accepted":true] : nil, stopped ? nil : "owned-stop-denied")
                    }
                }
            }
        } else { replyHandler(nil,"unknown-owned-processing-action") }
    }

    @discardableResult public func receiveOwnedShutdown(_ data: Data) throws -> Data {
        guard let owner = ownedLifecycle else { throw MusicStudioOwnedLifecycle.Failure.invalid }
        let acknowledgement = try owner.receiveShutdown(data); lifecycleState = owner.state
        return acknowledgement
    }

    /// Await the actual page save promise; missing API, timeout and storage errors
    /// keep the application open. No data is discarded to make closing succeed.
    public func prepareForClose(completion: @escaping (Bool) -> Void) {
        guard lifecycleState == "BROWSER_READY", !closePreparationInFlight,
              let url = webView.url, configuration.allows(url) else { completion(false); return }
        closePreparationInFlight = true
        var completed = false
        let finish: (Bool) -> Void = { [weak self] ok in
            guard !completed else { return }
            completed = true
            self?.closePreparationInFlight = false
            completion(ok)
        }
        let timeout = DispatchWorkItem { finish(false) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: timeout)
        webView.callAsyncJavaScript(
            "if(typeof window.MusicStudio?.prepareForShutdown !== 'function')return false; const body=document.body,previous=body?.inert;if(body)body.inert=true;try{const result=await window.MusicStudio.prepareForShutdown();return result?.ok===true;}finally{if(body)body.inert=previous;}",
            arguments: [:], in: nil, contentWorld: .page) { result in
                DispatchQueue.main.async {
                    timeout.cancel()
                    switch result {
                    case .success(let value): finish(value as? Bool == true)
                    case .failure: finish(false)
                    }
                }
            }
    }

    #if os(macOS)
    public static func prepareAllForTermination(completion: @escaping (Bool) -> Void) {
        let hosts = activeHosts.allObjects.filter { !["STOPPED", "CLOSED"].contains($0.lifecycleState) }
        func next(_ index: Int) {
            guard index < hosts.count else { completion(true); return }
            hosts[index].prepareForClose { ok in
                if ok { next(index + 1) } else { completion(false) }
            }
        }
        next(0)
    }
    public static func showSaveFailure() {
        let alert = NSAlert()
        alert.messageText = "保存を完了できないため、終了を取り消しました。"
        alert.informativeText = "処理が終わるまで待ち、未保存の変更を保存してから、もう一度終了してください。"
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
    private func attachWindowCloseGuard() {
        guard let window = webView.window, guardedWindow !== window else { return }
        let guardDelegate = MusicStudioWindowCloseGuard(host: self, previous: window.delegate)
        windowCloseGuard = guardDelegate
        guardedWindow = window
        window.delegate = guardDelegate
    }
    #endif

    public func stop() {
        renewalWork?.cancel(); renewalWork = nil
        if let owner = ownedLifecycle {
            if owner.state == "STOPPING" || owner.state.hasPrefix("SHUTDOWN") {
                lifecycleState = owner.state
            } else {
            do {
                let request = try owner.command("stop")
                lifecycleState = "STOPPING"
                ownedTransport.send(request) { [self] result in
                    DispatchQueue.main.async {
                        do { try owner.receive(result.get()); self.lifecycleState = owner.state; self.receivePrivateFinalSummary(owner) }
                        catch { owner.fail(); self.lifecycleState = "FAILED" }
                    }
                }
            } catch { owner.fail(); lifecycleState = "FAILED" }
            }
        } else if configuration.ownedCredential != nil {
            lifecycleState = "FAILED"
        } else {
            webView.evaluateJavaScript("window.MusicStudioAudioPipeline?.stopLocal(window.__NOVA_LOCAL_HANDOFF)", completionHandler: nil)
            if lifecycleState != "FAILED" { lifecycleState = "STOPPED" }
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
        ownedLifecycle?.fail()
        stop(); lifecycleState = "FAILED"
    }

    /// File inputs require a UI delegate on macOS. Only the approved main page
    /// may ask; selection is explicit and does not grant navigation to the file.
    public func allowsFileSelection(frameURL: URL?, isMainFrame: Bool) -> Bool {
        guard isMainFrame, let frameURL, lifecycleState == "BROWSER_READY" else { return false }
        return configuration.allows(frameURL)
    }

    #if os(macOS)
    public func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                        initiatedByFrame frame: WKFrameInfo,
                        completionHandler: @escaping ([URL]?) -> Void) {
        guard allowsFileSelection(frameURL: frame.request.url, isMainFrame: frame.isMainFrame) else {
            completionHandler(nil); return
        }
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.begin { [weak self] response in
            guard response == .OK, let self,
                  self.allowsFileSelection(frameURL: frame.request.url, isMainFrame: frame.isMainFrame) else {
                completionHandler(nil); return
            }
            completionHandler(panel.urls)
        }
    }
    #endif
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        ownedLifecycle?.fail()
        stop(); lifecycleState = "FAILED"
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !["FAILED","STOPPING","STOPPED","CLOSED"].contains(lifecycleState),
              !lifecycleState.hasPrefix("SHUTDOWN"),
              ownedLifecycle.map({ !["FAILED","STOPPING","STOPPED"].contains($0.state) && !$0.state.hasPrefix("SHUTDOWN") }) ?? true else { return }
        guard let url = webView.url, configuration.allows(url) else { ownedLifecycle?.fail(); lifecycleState = "FAILED"; stop(); return }
        lifecycleState = "BROWSER_READY"
        #if os(macOS)
        attachWindowCloseGuard()
        #endif
        #if os(iOS)
        let platformName = "ipad"
        #else
        let platformName = "mac"
        #endif
        MusicStudioWebMidiBridge(webView: webView).installCapabilityMetadata(platform: platformName)
        midiCoordinator?.resyncPageAvailability()
    }
}

#if os(macOS)
private final class MusicStudioWindowCloseGuard: NSObject, NSWindowDelegate {
    private weak var host: MusicStudioWebViewHost?
    private weak var previous: NSWindowDelegate?
    private var approvedClose = false
    private var preparing = false
    init(host: MusicStudioWebViewHost, previous: NSWindowDelegate?) {
        self.host = host; self.previous = previous
    }
    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || (previous?.responds(to: selector) ?? false)
    }
    override func forwardingTarget(for selector: Selector!) -> Any? {
        if previous?.responds(to: selector) == true { return previous }
        return super.forwardingTarget(for: selector)
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if previous?.windowShouldClose?(sender) == false { return false }
        if approvedClose { approvedClose = false; return true }
        guard !preparing, let host else { return false }
        preparing = true
        host.prepareForClose { [weak self, weak sender] ok in
            guard let self else { return }
            self.preparing = false
            if ok, let sender { self.approvedClose = true; sender.performClose(nil) }
            else { MusicStudioWebViewHost.showSaveFailure() }
        }
        return false
    }
}

/// Shared by the Swift Package and Xcode app entrypoints.
public final class MusicStudioTerminationDelegate: NSObject, NSApplicationDelegate {
    private var preparing = false
    public func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard !preparing else { return .terminateCancel }
        preparing = true
        DispatchQueue.main.async {
            MusicStudioWebViewHost.prepareAllForTermination { [weak self] ok in
                self?.preparing = false
                sender.reply(toApplicationShouldTerminate: ok)
                if !ok { MusicStudioWebViewHost.showSaveFailure() }
            }
        }
        return .terminateLater
    }
}
#endif
