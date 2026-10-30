import Foundation
import XCTest
@testable import NovaMusicNativeWrapper

final class MusicStudioPackageStartupTests: XCTestCase {
    #if os(macOS)
    func testCandidateRequiresOwnedFixedOriginAndCannotBypassStrictStartup() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let resources = root.appendingPathComponent("Contents/Resources")
        let helper = root.appendingPathComponent("Contents/Helpers/MusicStudioEngine")
        try FileManager.default.createDirectory(at: resources, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: helper.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("{}".utf8).write(to: resources.appendingPathComponent("package-candidate.json"))
        try Data("#!/bin/sh\nexit 1\n".utf8).write(to: helper)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: helper.path)
        XCTAssertNil(MusicStudioAppConfiguration.startup(environment: [:], resourceURL: resources))
        XCTAssertNil(MusicStudioAppConfiguration.startup(environment: ["NOVA_PACKAGE_ENGINE_ORIGIN":"http://example.com"], resourceURL: resources))
        let env = ["NOVA_PACKAGE_ENGINE_ORIGIN":"http://127.0.0.1:8765"]
        let configuration = try XCTUnwrap(MusicStudioAppConfiguration.startup(environment: env, resourceURL: resources))
        XCTAssertEqual(configuration.startURL.absoluteString, "http://127.0.0.1:8765/music-studio.html")
        XCTAssertTrue(configuration.allows(configuration.startURL))
        XCTAssertFalse(configuration.allows(URL(string:"http://127.0.0.1:8767/music-studio.html")!))
        var strict = env; strict["NOVA_STRICT_OFFLINE"] = "1"
        XCTAssertNil(MusicStudioAppConfiguration.startup(environment: strict, resourceURL: resources))
        try FileManager.default.removeItem(at: helper)
        XCTAssertNil(MusicStudioAppConfiguration.startup(environment: env, resourceURL: resources))
    }
    #endif
}
