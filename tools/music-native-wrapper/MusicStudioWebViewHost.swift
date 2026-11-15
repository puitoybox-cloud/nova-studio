import Foundation
import WebKit
#if os(macOS)
import AppKit
import CryptoKit
import Darwin
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
    private var activeDownloads: [WKDownload] = []
    #endif

    public init(configuration: MusicStudioAppConfiguration, platform: String) {
        self.configuration = configuration
        self.platform = platform

        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.websiteDataStore = .default()
        #if NOVA_NATIVE_ACCEPTANCE && os(macOS)
        // CI-only profiles: never compiled into the normal release build.
        if #available(macOS 14.0, *), let raw = ProcessInfo.processInfo.environment["NOVA_NATIVE_ACCEPTANCE_STORE"],
           let identifier = UUID(uuidString: raw) {
            webConfiguration.websiteDataStore = WKWebsiteDataStore(forIdentifier: identifier)
        }
        #endif
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

    // Only the configured main document may request a microphone. The OS and
    // WebKit still prompt; no camera capture or automatic permission grant.
    public func webView(_ webView: WKWebView,
                        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                        initiatedByFrame frame: WKFrameInfo,
                        type: WKMediaCaptureType,
                        decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let expected = configuration.startURL
        let allowed = frame.isMainFrame && type == .microphone &&
            origin.protocol == expected.scheme && origin.host == (expected.host ?? "") &&
            origin.port == (expected.port ?? (expected.scheme == "https" ? 443 : expected.scheme == "http" ? 80 : 0)) &&
            frame.request.url.map(configuration.allows) == true
        decisionHandler(allowed ? .prompt : .deny)
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
    public func prepareForClose(timeoutSeconds: TimeInterval = 15, completion: @escaping (Bool) -> Void) {
        guard lifecycleState == "BROWSER_READY", !closePreparationInFlight,
              let url = webView.url, configuration.allows(url) else { completion(false); return }
        #if os(macOS)
        guard activeDownloads.isEmpty else { completion(false); return }
        #endif
        closePreparationInFlight = true
        packageLifecycleEvent("CLOSE_REQUEST")
        var completed = false
        let finish: (Bool) -> Void = { [weak self] ok in
            guard !completed else { return }
            completed = true
            self?.packageLifecycleEvent(ok ? "CLOSE_SAVED" : "CLOSE_REFUSED")
            completion(ok)
        }
        // A timeout refuses termination but does not cancel WebKit's pending save.
        // Keep admission closed until that callback returns, so a retry cannot
        // overlap the original write or unlock its page while it still saves.
        let timeout = DispatchWorkItem { finish(false) }
        DispatchQueue.main.asyncAfter(deadline: .now() + timeoutSeconds, execute: timeout)
        webView.callAsyncJavaScript(
            "if(typeof window.MusicStudio?.prepareForShutdown !== 'function')return {ok:false,reason:'page-api-unavailable'}; const body=document.body,previous=body?.inert;if(body)body.inert=true;try{const result=await window.MusicStudio.prepareForShutdown();return {ok:result?.ok===true,reason:result?.reason||'none'};}finally{if(body)body.inert=previous;}",
            arguments: [:], in: nil, in: .page) { result in
                DispatchQueue.main.async {
                    timeout.cancel()
                    self.closePreparationInFlight = false
                    switch result {
                    case .success(let value):
                        let result = value as? [String: Any]
                        if let reason = result?["reason"] as? String,
                           reason.count <= 96, reason.allSatisfy({ $0.isASCII && ($0.isLetter || $0 == "-") }) {
                            self.packageLifecycleEvent("CLOSE_REASON_" + reason)
                        }
                        finish(result?["ok"] as? Bool == true)
                    case .failure: self.packageLifecycleEvent("CLOSE_SCRIPT_FAILED"); finish(false)
                    }
                }
            }
    }

    #if NOVA_NATIVE_ACCEPTANCE && os(macOS)
    // A separately compiled CI candidate can exercise the real app WebView across
    // process exits. Normal candidates contain no script-file execution hook.
    private func runNativeAcceptance() {
        let environment = ProcessInfo.processInfo.environment
        guard let scriptPath = environment["NOVA_NATIVE_ACCEPTANCE_SCRIPT"],
              let resultPath = environment["NOVA_NATIVE_ACCEPTANCE_RESULT"] else { return }
        do {
            let script = try String(contentsOfFile: scriptPath, encoding: .utf8)
            guard script.utf8.count <= 32 * 1024 * 1024 else { throw CocoaError(.fileReadTooLarge) }
            webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
                do {
                    let value = try result.get()
                    guard let report = value as? [String: Any] else { throw CocoaError(.coderInvalidValue) }
                    let data = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
                    try data.write(to: URL(fileURLWithPath: resultPath), options: .atomic)
                    self?.packageLifecycleEvent("NATIVE_ACCEPTANCE_COMPLETE")
                } catch {
                    self?.packageLifecycleEvent("NATIVE_ACCEPTANCE_FAILED")
                    fputs("Native acceptance failed: \(error)\n", stderr)
                }
            }
        } catch { packageLifecycleEvent("NATIVE_ACCEPTANCE_FAILED") }
    }
    #endif

    private func packageLifecycleEvent(_ event: String) {
        #if os(macOS)
        guard let resources = Bundle.main.resourceURL,
              FileManager.default.fileExists(atPath: resources.appendingPathComponent("package-candidate.json").path) else { return }
        print("NOVA_PACKAGE_" + event)
        fflush(stdout)
        #endif
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
        #if os(macOS)
        if navigationAction.shouldPerformDownload,
           allowsDownload(requestURL: url, sourceURL: navigationAction.sourceFrame.request.url,
                          isMainFrame: navigationAction.sourceFrame.isMainFrame) {
            decisionHandler(.download); return
        }
        #endif
        decisionHandler(configuration.allows(url) ? .allow : .cancel)
    }

    /// Only explicit blob downloads from the approved main document may open a
    /// destination picker. The page cannot choose a filesystem destination.
    public func allowsDownload(requestURL: URL?, sourceURL: URL?, isMainFrame: Bool) -> Bool {
        guard lifecycleState == "BROWSER_READY", isMainFrame,
              let sourceURL, configuration.allows(sourceURL),
              let requestURL, requestURL.scheme == "blob" else { return false }
        let value = requestURL.absoluteString
        if configuration.startURL.isFileURL { return value.hasPrefix("blob:null/") }
        guard let components = URLComponents(url: configuration.startURL, resolvingAgainstBaseURL: false),
              let scheme = components.scheme, let host = components.host else { return false }
        let port = components.port.map { ":\($0)" } ?? ""
        return value.hasPrefix("blob:\(scheme)://\(host)\(port)/")
    }

    #if os(macOS)
    public func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        activeDownloads.append(download)
        download.delegate = self
    }
    #endif

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
        MusicStudioAutoFinishHelper.shared.withHandoff { [weak self] handoff in
            guard let self, let data = try? JSONSerialization.data(withJSONObject: handoff, options: [.sortedKeys]),
                  let json = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("Object.defineProperty(window,'__NOVA_AUTO_FINISH_HANDOFF',{value:Object.freeze(\(json)),writable:false,configurable:false});")
        }
        if configuration.startURL.absoluteString == "http://127.0.0.1:8765/music-studio.html",
           let resources = Bundle.main.resourceURL,
           FileManager.default.fileExists(atPath: resources.appendingPathComponent("package-candidate.json").path) {
            // Bounded owned stdout acknowledgement for the package launcher.
            // This establishes document navigation, not saved-song acceptance.
            print("NOVA_PACKAGE_NATIVE_DOCUMENT_LOADED")
            fflush(stdout)
            webView.callAsyncJavaScript("for(let i=0;i<300;i++){if(window.MusicStudio?.state?.loaded===true&&typeof window.MusicStudio.prepareForShutdown==='function')return true;await new Promise(resolve=>setTimeout(resolve,100));}return false;", arguments: [:], in: nil, in: .page) { [weak self] result in
                if case .success(let ready) = result, ready as? Bool == true {
                    self?.packageLifecycleEvent("NATIVE_SAVE_API_READY")
                    #if NOVA_NATIVE_ACCEPTANCE
                    self?.runNativeAcceptance()
                    #endif
                } else { self?.packageLifecycleEvent("NATIVE_SAVE_API_UNAVAILABLE") }
            }
        }
        #endif
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
extension MusicStudioWebViewHost: WKDownloadDelegate {
    public func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                         suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard activeDownloads.contains(where: { $0 === download }), lifecycleState == "BROWSER_READY" else {
            completionHandler(nil); return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = URL(fileURLWithPath: suggestedFilename).lastPathComponent
        panel.canCreateDirectories = true
        panel.begin { [weak self] result in
            guard result == .OK, let self, self.lifecycleState == "BROWSER_READY" else {
                completionHandler(nil); return
            }
            completionHandler(panel.url)
        }
    }
    public func downloadDidFinish(_ download: WKDownload) {
        activeDownloads.removeAll { $0 === download }
    }
    public func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        activeDownloads.removeAll { $0 === download }
    }
}
#endif

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
    private var terminationSignal: DispatchSourceSignal?
    public func applicationDidFinishLaunching(_ notification: Notification) {
        MusicStudioAutoFinishHelper.shared.start()
        // Package launcher shutdown must use the same save gate as Cmd-Q.
        // A storage failure cancels termination and leaves the engine/editor alive.
        signal(SIGTERM, SIG_IGN)
        let source = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        source.setEventHandler {
            print("NOVA_NATIVE_TERMINATION_SIGNAL"); fflush(stdout)
            // AppKit's terminateLater may enter a nested run loop. Starting it
            // inside a main dispatch callback prevents the queued save request
            // from running on that same serial queue. Re-enter through AppKit's
            // run loop after this signal callback has returned.
            RunLoop.main.perform {
                NSApplication.shared.terminate(nil)
            }
        }
        terminationSignal = source
        source.resume()
    }
    public func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        guard let resources = Bundle.main.resourceURL else { return false }
        return FileManager.default.fileExists(atPath: resources.appendingPathComponent("package-candidate.json").path)
    }
    public func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard !preparing else { return .terminateCancel }
        preparing = true
        print("NOVA_NATIVE_TERMINATION_REQUEST"); fflush(stdout)
        DispatchQueue.main.async {
            MusicStudioWebViewHost.prepareAllForTermination { [weak self] ok in
                guard ok else {
                    self?.preparing = false
                    sender.reply(toApplicationShouldTerminate: false)
                    MusicStudioWebViewHost.showSaveFailure()
                    return
                }
                MusicStudioAutoFinishHelper.shared.stop {
                    self?.preparing = false
                    sender.reply(toApplicationShouldTerminate: true)
                }
            }
        }
        return .terminateLater
    }
}

/// Owns the optional Auto-Finish helper for exactly the lifetime of the packaged
/// macOS app. It accepts only an inventoried, bundled runtime from NovaMix.component.
public final class MusicStudioAutoFinishHelper: @unchecked Sendable {
    public static let shared = MusicStudioAutoFinishHelper()
    private let queue = DispatchQueue(label: "com.puitoybox.nova.auto-finish-helper")
    private var process: Process?
    private var stdout = Data()
    private var handoff: [String: Any]?
    private var waiters: [([String: Any]) -> Void] = []

    public func start(componentURL: URL? = nil, workspaceURL: URL? = nil) {
        queue.async { [self] in
            if componentURL == nil {
                guard let resources = Bundle.main.resourceURL,
                      FileManager.default.fileExists(atPath: resources.appendingPathComponent("package-candidate.json").path) else { return }
            }
            guard process == nil, let component = componentURL ?? installedComponent(),
                  let launch = try? verifiedLaunch(component: component, workspaceURL: workspaceURL) else { return }
            stdout.removeAll(keepingCapacity: true)
            handoff = nil
            waiters.removeAll()
            let child = Process(), output = Pipe(), errors = Pipe()
            child.executableURL = launch.python
            child.arguments = ["-I", "-B", launch.server.path, "--workspace", launch.workspace.path,
                               "--engine", launch.engine.path, "--ffmpeg", launch.ffmpeg.path,
                               "--scripts", launch.resources.path, "--allowed-origin", "http://127.0.0.1:8765"]
            child.environment = ["PATH": "/usr/bin:/bin", "PYTHONNOUSERSITE": "1"]
            child.standardOutput = output; child.standardError = errors
            output.fileHandleForReading.readabilityHandler = { [weak self] handle in self?.consume(handle.availableData) }
            errors.fileHandleForReading.readabilityHandler = { handle in _ = handle.availableData }
            child.terminationHandler = { [weak self] stopped in
                self?.queue.async {
                    output.fileHandleForReading.readabilityHandler = nil
                    errors.fileHandleForReading.readabilityHandler = nil
                    if self?.process === stopped { self?.process = nil; self?.handoff = nil }
                }
            }
            do { try child.run(); process = child }
            catch { output.fileHandleForReading.readabilityHandler = nil; errors.fileHandleForReading.readabilityHandler = nil }
        }
    }

    public func withHandoff(_ completion: @escaping ([String: Any]) -> Void) {
        queue.async { [self] in
            if let handoff { DispatchQueue.main.async { completion(handoff) } }
            else if process?.isRunning == true { waiters.append(completion) }
        }
    }

    public func stop(completion: @escaping () -> Void) {
        queue.async { [self] in
            guard let child = process, child.isRunning else { DispatchQueue.main.async(execute: completion); return }
            var delivered = false
            let finish = {
                self.queue.async {
                    guard !delivered else { return }; delivered = true
                    DispatchQueue.main.async(execute: completion)
                }
            }
            let previous = child.terminationHandler
            child.terminationHandler = { stopped in previous?(stopped); finish() }
            child.terminate()
            queue.asyncAfter(deadline: .now() + 3) {
                if child.isRunning { kill(child.processIdentifier, SIGKILL) }
                finish()
            }
        }
    }

    private func consume(_ data: Data) {
        guard !data.isEmpty else { return }
        queue.async { [self] in
            guard handoff == nil else { return }
            stdout.append(data)
            guard stdout.count <= 16_384, let newline = stdout.firstIndex(of: 10) else { return }
            let line = stdout[..<newline]
            guard let value = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  value["ok"] as? Bool == true, value["host"] as? String == "127.0.0.1",
                  value["port"] as? Int == 8767, let token = value["token"] as? String, token.count >= 32,
                  let session = value["lifecycleSession"] as? String, session.count == 32 else { return }
            handoff = ["version": 1, "token": token, "lifecycleSession": session]
            let ready = waiters; waiters.removeAll()
            for waiter in ready { DispatchQueue.main.async { waiter(self.handoff!) } }
        }
    }

    private func installedComponent() -> URL? {
        let manager = FileManager.default
        let candidates = [URL(fileURLWithPath: "/Library/Audio/Plug-Ins/Components/NovaMix.component"),
                          manager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Audio/Plug-Ins/Components/NovaMix.component")]
        return candidates.first { manager.fileExists(atPath: $0.path) }
    }

    private struct Launch { let python, server, engine, ffmpeg, resources, workspace: URL }
    private func verifiedLaunch(component: URL, workspaceURL: URL?) throws -> Launch {
        let root = component.resolvingSymlinksInPath().standardizedFileURL
        let resources = root.appendingPathComponent("Contents/Resources", isDirectory: true)
        let macOS = root.appendingPathComponent("Contents/MacOS", isDirectory: true)
        let inventoryURL = resources.appendingPathComponent("whole-song-runtime.json")
        let raw = try Data(contentsOf: inventoryURL)
        guard let inventory = try JSONSerialization.jsonObject(with: raw) as? [String: String] else { throw CocoaError(.fileReadCorruptFile) }
        let required = Set(["auto-finish.py", "auto-finish-server.py", "whole-song.py", "select-whole-song.py",
                            "au-whole-song.py", "compare-sections.py", "../MacOS/nova-whole-song", "../MacOS/nova-section-meter"])
        guard Set(inventory.keys) == required else { throw CocoaError(.fileReadCorruptFile) }
        for (name, expected) in inventory {
            let candidate = resources.appendingPathComponent(name).resolvingSymlinksInPath().standardizedFileURL
            guard candidate.path.hasPrefix(root.path + "/"), let bytes = try? Data(contentsOf: candidate),
                  SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == expected else { throw CocoaError(.fileReadCorruptFile) }
        }
        let python = resources.appendingPathComponent("Runtime/Python/bin/python3.12")
        let ffmpeg = resources.appendingPathComponent("Runtime/FFmpeg/bin/ffmpeg")
        let server = resources.appendingPathComponent("auto-finish-server.py")
        let engine = macOS.appendingPathComponent("nova-whole-song")
        for executable in [python, ffmpeg, engine] where !FileManager.default.isExecutableFile(atPath: executable.path) { throw CocoaError(.fileNoSuchFile) }
        guard FileManager.default.fileExists(atPath: server.path) else { throw CocoaError(.fileNoSuchFile) }
        let workspace = workspaceURL ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Project NOVA/Music Studio/Auto Finish", isDirectory: true)
        try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        return Launch(python: python, server: server, engine: engine, ffmpeg: ffmpeg,
                      resources: resources, workspace: workspace)
    }
}
#endif
