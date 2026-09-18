import XCTest
@testable import NovaMusicNativeWrapper

final class MusicStudioAppConfigurationTests: XCTestCase {
    func testAllowsConfiguredHTTPSHost() throws {
        let start = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: start)
        XCTAssertTrue(configuration.allows(start))
        XCTAssertTrue(configuration.allows(try XCTUnwrap(URL(string: "https://example.com/other"))))
        XCTAssertTrue(configuration.allows(try XCTUnwrap(URL(string: "https://EXAMPLE.com:8443/other"))))
    }

    func testRejectsDifferentHost() throws {
        let start = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: start)
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "https://evil.example/music-studio.html"))))
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "https://example.com.evil.invalid/music-studio.html"))))
    }

    func testRejectsInsecureHTTP() throws {
        let start = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: start)
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "http://example.com/music-studio.html"))))
    }

    func testRejectsMalformedAndUnsupportedURLs() throws {
        let start = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: start)

        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "not-a-url"))))
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "https:///missing-host"))))
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "javascript:alert(1)"))))
    }

    func testFileURLOnlyAllowedForFileConfiguredApp() throws {
        let localStart = URL(fileURLWithPath: "/tmp/music-studio.html")
        let localConfiguration = MusicStudioAppConfiguration(
            startURL: localStart,
            allowedHosts: ["example.com"]
        )
        XCTAssertTrue(localConfiguration.allows(URL(fileURLWithPath: "/tmp/other.html")))
        XCTAssertFalse(localConfiguration.allows(try XCTUnwrap(URL(string: "file://example.com/tmp/other.html"))))
        XCTAssertFalse(localConfiguration.allows(try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))))

        let remoteStart = try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))
        let remoteConfiguration = MusicStudioAppConfiguration(startURL: remoteStart)
        XCTAssertFalse(remoteConfiguration.allows(localStart))
    }

    func testUnsupportedStartURLDoesNotEnableRemoteMode() throws {
        let insecureStart = try XCTUnwrap(URL(string: "http://example.com/music-studio.html"))
        let configuration = MusicStudioAppConfiguration(startURL: insecureStart)

        XCTAssertFalse(configuration.allows(insecureStart))
        XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: "https://example.com/music-studio.html"))))
    }
}
