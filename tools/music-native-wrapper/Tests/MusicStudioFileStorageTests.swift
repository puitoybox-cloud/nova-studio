import XCTest
import WebKit
@testable import NovaMusicNativeWrapper

final class MusicStudioFileStorageTests: XCTestCase {
    @MainActor func testFileSelectionRejectsForeignFramesAndStoppedHost() async throws {
        let url = URL(string: "https://puitoybox-cloud.github.io/nova-studio/music-studio.html")!
        let host = MusicStudioWebViewHost(configuration: MusicStudioAppConfiguration(startURL: url), platform: "mac")
        XCTAssertTrue(host.webView.uiDelegate === host)
        XCTAssertFalse(host.allowsDownload(requestURL: URL(string: "blob:https://puitoybox-cloud.github.io/test"), sourceURL: url, isMainFrame: true))
        XCTAssertFalse(host.allowsFileSelection(frameURL: url, isMainFrame: true))
        XCTAssertFalse(host.allowsFileSelection(frameURL: nil, isMainFrame: true))
        XCTAssertFalse(host.allowsFileSelection(frameURL: URL(string: "https://example.com"), isMainFrame: true))
        XCTAssertFalse(host.allowsFileSelection(frameURL: url, isMainFrame: false))
        host.stop()
        XCTAssertFalse(host.allowsFileSelection(frameURL: url, isMainFrame: true))
    }
    // Disposable fixture only. This is WebView replacement in one test process,
    // not application termination/update or physical MIDI acceptance.
    @MainActor func testFileOriginIndexedDBSurvivesWebViewReplacement() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let assets = root.appendingPathComponent("MusicStudioWeb")
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try Data("<!doctype html><title>Isolated persistence fixture</title>".utf8).write(to: assets.appendingPathComponent("music-studio.html"))
        let configuration = try XCTUnwrap(MusicStudioAppConfiguration.bundled(resourceURL: root))
        let database = "nova-ci-" + UUID().uuidString
        func loaded(_ host: MusicStudioWebViewHost) async throws {
            host.start()
            for _ in 0..<200 {
                if host.lifecycleState == "BROWSER_READY" { return }
                if host.lifecycleState == "FAILED" { throw CocoaError(.fileReadUnknown) }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTFail("file-origin fixture did not load")
            throw CocoaError(.fileReadUnknown)
        }
        var first: MusicStudioWebViewHost? = MusicStudioWebViewHost(configuration: configuration, platform: "mac")
        try await loaded(first!)
        XCTAssertTrue(first!.allowsFileSelection(frameURL: configuration.startURL, isMainFrame: true))
        XCTAssertFalse(first!.allowsFileSelection(frameURL: configuration.startURL, isMainFrame: false))
        XCTAssertTrue(first!.webView.configuration.websiteDataStore.isPersistent)
        let write = """
        return await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);
        r.onupgradeneeded=()=>r.result.createObjectStore('fixture');r.onerror=()=>reject(String(r.error));
        r.onsuccess=()=>{const db=r.result,tx=db.transaction('fixture','readwrite');
        tx.objectStore('fixture').put({trackId:'stable-track',pitch:64},'note');
        tx.oncomplete=()=>{db.close();resolve(true)};tx.onabort=()=>reject(String(tx.error));};});
        """
        let written = try await first!.webView.callAsyncJavaScript(write, arguments: ["name": database], in: nil, contentWorld: .page)
        XCTAssertEqual(written as? Bool, true)
        first!.stop(); first = nil
        let second = MusicStudioWebViewHost(configuration: configuration, platform: "mac")
        defer { second.stop() }
        try await loaded(second)
        let read = """
        return await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onerror=()=>reject(String(r.error));
        r.onsuccess=()=>{const db=r.result,tx=db.transaction('fixture','readonly'),get=tx.objectStore('fixture').get('note');
        get.onsuccess=()=>resolve(JSON.stringify(get.result));get.onerror=()=>reject(String(get.error));
        tx.oncomplete=()=>db.close();};});
        """
        let recovered = try await second.webView.callAsyncJavaScript(read, arguments: ["name": database], in: nil, contentWorld: .page)
        XCTAssertEqual(recovered as? String, "{\"trackId\":\"stable-track\",\"pitch\":64}")
        _ = try await second.webView.callAsyncJavaScript("return await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>resolve(true);r.onerror=()=>reject(String(r.error));});", arguments: ["name": database], in: nil, contentWorld: .page)
    }
    @MainActor func testCloseWaitsForPageSaveAndRefusesFailureOrMissingAPI() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let assets = root.appendingPathComponent("MusicStudioWeb")
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let html = """
        <!doctype html><script>
        window.fixture={saved:false,fail:false};
        window.MusicStudio={prepareForShutdown:async()=>{
          await new Promise(resolve=>setTimeout(resolve,80));
          if(fixture.fail)return {ok:false}; fixture.saved=true;return {ok:true};
        }};
        </script><title>Disposable close fixture</title>
        """
        try Data(html.utf8).write(to: assets.appendingPathComponent("music-studio.html"))
        let configuration = try XCTUnwrap(MusicStudioAppConfiguration.bundled(resourceURL: root))
        let host = MusicStudioWebViewHost(configuration: configuration, platform: "mac")
        defer { host.stop() }
        var notReady: Bool?
        host.prepareForClose { notReady = $0 }
        XCTAssertEqual(notReady, false)
        host.start()
        for _ in 0..<200 {
            if host.lifecycleState == "BROWSER_READY" { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertEqual(host.lifecycleState, "BROWSER_READY")
        XCTAssertTrue(host.allowsDownload(requestURL: URL(string: "blob:null/test"), sourceURL: configuration.startURL, isMainFrame: true))
        XCTAssertFalse(host.allowsDownload(requestURL: URL(string: "https://example.com/export.wav"), sourceURL: configuration.startURL, isMainFrame: true))
        XCTAssertFalse(host.allowsDownload(requestURL: URL(string: "blob:null/test"), sourceURL: configuration.startURL, isMainFrame: false))
        XCTAssertFalse(host.allowsDownload(requestURL: URL(string: "blob:null/test"), sourceURL: URL(string: "https://example.com"), isMainFrame: true))
        let saved = await withCheckedContinuation { continuation in
            host.prepareForClose { continuation.resume(returning: $0) }
        }
        XCTAssertTrue(saved)
        let observed = try await host.webView.evaluateJavaScript("fixture.saved")
        XCTAssertEqual(observed as? Bool, true)
        _ = try await host.webView.evaluateJavaScript("fixture.fail=true;fixture.saved=false")
        let failed = await withCheckedContinuation { continuation in
            host.prepareForClose { continuation.resume(returning: $0) }
        }
        XCTAssertFalse(failed)
        XCTAssertEqual(host.lifecycleState, "BROWSER_READY")
        _ = try await host.webView.evaluateJavaScript("delete window.MusicStudio")
        let missing = await withCheckedContinuation { continuation in
            host.prepareForClose { continuation.resume(returning: $0) }
        }
        XCTAssertFalse(missing)
        XCTAssertEqual(host.lifecycleState, "BROWSER_READY")
    }

}
