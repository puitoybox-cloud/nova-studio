import SwiftUI
import Foundation
import CryptoKit

@main
struct MusicStudioApp: App {
    init() {
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
