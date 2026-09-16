import XCTest
@testable import NovaMusicNativeWrapper

final class MusicStudioAppConfigurationTests: XCTestCase {
    func testAllowsConfiguredHTTPSHost() throws {
        let start = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: start)
        XCTAssertTrue(configuration.allows(start))
        XCTAssertTrue(configuration.allows(try XCTUnwrap(URL(string: "https://example.com/other"))))
    }

    func testRejectsDifferentHost() throws {
        let start = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: start)
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "https://evil.example/music-studio.html"))))
    }

    func testRejectsInsecureHTTP() throws {
        let start = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: start)
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "http://example.com/music-studio.html"))))
    }

    func testFileURLOnlyAllowedForFileConfiguredApp() throws {
        let localStart = URL(fileURLWithPath: "/tmp/music-studio.html")
        let localConfiguration = MusicStudioAppConfiguration(startURL: localStart)
        XCTAssertTrue(localConfiguration.allows(URL(fileURLWithPath: "/tmp/other.html")))

        let remoteStart = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let remoteConfiguration = MusicStudioAppConfiguration(startURL: remoteStart)
        XCTAssertFalse(remoteConfiguration.allows(localStart))
    }
}
