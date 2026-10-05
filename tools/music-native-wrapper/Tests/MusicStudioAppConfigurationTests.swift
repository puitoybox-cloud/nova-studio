import XCTest
@testable import NovaMusicNativeWrapper

final class MusicStudioAppConfigurationTests: XCTestCase {
    func testStrictStartupRequiresFreshAnchoredHandoff() throws {
        let now = Date(timeIntervalSince1970: 1000)
        var value: [String: Any] = ["format": "NOVA_LOCAL_BROWSER_HANDOFF", "version": 1,
            "origin": "http://127.0.0.1:18766", "expiresAt": 1060000,
            "buildRevision": "fixture"]
        for key in ["nonce", "session", "manifestDigest", "runtimeConfigDigest", "helperIdentityDigest"] {
            value[key] = String(repeating: "a", count: 64)
        }
        func configuration(_ value: [String: Any]) throws -> MusicStudioAppConfiguration? {
            let data = try JSONSerialization.data(withJSONObject: value)
            return MusicStudioAppConfiguration.startup(environment: ["NOVA_STRICT_OFFLINE": "1", "NOVA_LOCAL_HANDOFF": String(decoding: data, as: UTF8.self)], now: now)
        }
        let valid = try XCTUnwrap(configuration(value))
        XCTAssertNotNil(valid.localHandoffJSON)
        XCTAssertFalse(valid.allows(try XCTUnwrap(URL(string: "https://example.com/"))))
        XCTAssertNil(MusicStudioAppConfiguration.startup(environment: ["NOVA_STRICT_OFFLINE": "1"]))
        for origin in ["https://example.com", "http://127.0.0.1", "http://localhost:18766", "http://127.0.0.1:18766/escape"] {
            var wrong = value; wrong["origin"] = origin; XCTAssertNil(try configuration(wrong))
        }
        for key in ["nonce", "manifestDigest", "runtimeConfigDigest", "helperIdentityDigest"] {
            var wrong = value; wrong[key] = "wrong"; XCTAssertNil(try configuration(wrong))
        }
        value["expiresAt"] = 999000; XCTAssertNil(try configuration(value))
    }

    func testExplicitLoopbackHostedOriginContainsNavigation() throws {
        let start = try XCTUnwrap(URL(string: "http://127.0.0.1:18766/music-studio.html"))
        let configuration = try XCTUnwrap(MusicStudioAppConfiguration.localHosted(startURL: start))
        XCTAssertTrue(configuration.allows(start))
        XCTAssertTrue(configuration.allows(try XCTUnwrap(URL(string: "http://127.0.0.1:18766/asset.js"))))
        for value in ["http://127.0.0.1:18767/", "http://localhost:18766/",
                      "http://0.0.0.0:18766/", "https://127.0.0.1:18766/",
                      "https://example.com/", "http://user@127.0.0.1:18766/"] {
            XCTAssertFalse(configuration.allows(try XCTUnwrap(URL(string: value))))
        }
        XCTAssertFalse(MusicStudioAppConfiguration(startURL: start).allows(start))
    }

    func testLoopbackHostedRejectsMissingPortAndRemoteStart() throws {
        for value in ["http://127.0.0.1/", "http://127.0.0.1:0/", "http://localhost:18766/",
                      "http://0.0.0.0:18766/", "https://example.com/",
                      "http://127.0.0.1:18766/?token=x", "http://user@127.0.0.1:18766/"] {
            XCTAssertNil(MusicStudioAppConfiguration.localHosted(startURL: try XCTUnwrap(URL(string: value))))
        }
    }
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
