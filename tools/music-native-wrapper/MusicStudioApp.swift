import SwiftUI
import Foundation
import CryptoKit
import NovaMusicNativeWrapper
#if os(macOS)
import AppKit
import WebKit
#endif

@main
struct MusicStudioApp: App {
    init() {
        #if os(macOS)
        if let index = CommandLine.arguments.firstIndex(of: "--verify-file-storage-process") {
            let arguments = Array(CommandLine.arguments.dropFirst(index + 1))
            guard arguments.count == 3, arguments[1].hasPrefix("nova-ci-process-"),
                  ["write", "edit", "read", "delete"].contains(arguments[2]) else { exit(2) }
            Task { @MainActor in
                do {
                    try await verifyFileStorageProcess(root: URL(fileURLWithPath: arguments[0]),
                                                       database: arguments[1], phase: arguments[2])
                    print("FILE_STORAGE_PROCESS_VERIFIED \(arguments[2]) pid=\(ProcessInfo.processInfo.processIdentifier)")
                    exit(0)
                } catch {
                    fputs("FILE_STORAGE_PROCESS_FAILED \(arguments[2]): \(error)\n", stderr)
                    exit(1)
                }
            }
            NSApplication.shared.run()
            exit(1)
        }
        #endif
        if CommandLine.arguments.contains("--verify-bundled-assets") {
            do {
                guard let root = Bundle.module.resourceURL?.appendingPathComponent("MusicStudioWeb"),
                      let data = try? Data(contentsOf: root.appendingPathComponent("asset-manifest.json")),
                      let manifest = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let files = manifest["files"] as? [[String: Any]], !files.isEmpty,
                      files.contains(where: { $0["path"] as? String == "music-studio.html" }) else { throw CocoaError(.fileNoSuchFile) }
                for item in files {
                    guard let name = item["path"] as? String, !name.hasPrefix("/"), !name.split(separator: "/").contains(".."),
                          let digest = item["sha256"] as? String, let count = item["byteLength"] as? Int else { throw CocoaError(.fileReadCorruptFile) }
                    let bytes = try Data(contentsOf: root.appendingPathComponent(name))
                    guard bytes.count == count, SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == digest else { throw CocoaError(.fileReadCorruptFile) }
                }
                print("SPM_BUNDLED_ASSETS_VERIFIED \(files.count) \(manifest["buildRevision"] ?? "unknown")")
                exit(0)
            } catch { fputs("SPM_BUNDLED_ASSETS_INVALID\n", stderr); exit(1) }
        }
    }
    var body: some Scene {
        WindowGroup {
            MusicStudioRootView()
        }
    }
}

#if os(macOS)
/// Disposable, named fixture in separate executable processes. Never opens the
/// Music Studio project database. This proves storage persistence, not MIDI UI.
@MainActor private func verifyFileStorageProcess(root: URL, database: String, phase: String) async throws {
    guard let configuration = MusicStudioAppConfiguration.bundled(resourceURL: root) else {
        throw CocoaError(.fileNoSuchFile)
    }
    let host = MusicStudioWebViewHost(configuration: configuration, platform: "mac")
    defer { host.stop() }
    host.start()
    var loaded = false
    for _ in 0..<200 {
        if host.lifecycleState == "BROWSER_READY" { loaded = true; break }
        if host.lifecycleState == "FAILED" { throw CocoaError(.fileReadUnknown) }
        try await Task.sleep(nanoseconds: 100_000_000)
    }
    guard loaded, host.webView.configuration.websiteDataStore.isPersistent else {
        throw CocoaError(.fileReadUnknown)
    }
    let script = """
    return await new Promise((resolve,reject)=>{
      const fail=e=>reject(String(e));
      if(phase==='delete') {const r=indexedDB.deleteDatabase(name);r.onsuccess=()=>resolve(true);r.onerror=()=>fail(r.error);r.onblocked=()=>fail('blocked');return;}
      const r=indexedDB.open(name,1);
      r.onupgradeneeded=()=>{if(phase==='write')r.result.createObjectStore('fixture');else r.transaction.abort();};
      r.onerror=()=>fail(r.error);
      r.onsuccess=()=>{const db=r.result;let tx;
        try {tx=db.transaction('fixture',phase==='read'?'readonly':'readwrite');}catch(e){db.close();fail(e);return;}
        const store=tx.objectStore('fixture');let verified=false;
        tx.onabort=()=>{db.close();fail(tx.error||'identity mismatch');};
        tx.oncomplete=()=>{db.close();verified?resolve(true):fail('not verified');};
        const get=store.get('note');
        get.onsuccess=()=>{
          const value=get.result;
          if(phase==='write') {
            if(value!==undefined){tx.abort();return;}
            store.put({trackId:'stable-track',pitch:64,revision:1},'note');verified=true;
          }else {
            const expected=phase==='edit'?{trackId:'stable-track',pitch:64,revision:1}:{trackId:'stable-track',pitch:67,revision:2};
            if(JSON.stringify(value)!==JSON.stringify(expected)){tx.abort();return;}
            if(phase==='edit')store.put({trackId:'stable-track',pitch:67,revision:2},'note');
            verified=true;
          }
        };
      };
    });
    """
    let result = try await host.webView.callAsyncJavaScript(script, arguments: ["name": database, "phase": phase], in: nil, contentWorld: .page)
    guard result as? Bool == true else { throw CocoaError(.fileReadCorruptFile) }
}
#endif
