import XCTest
import WebKit
@testable import NovaMusicNativeWrapper

final class MusicStudioFileStorageTests: XCTestCase {
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
}
