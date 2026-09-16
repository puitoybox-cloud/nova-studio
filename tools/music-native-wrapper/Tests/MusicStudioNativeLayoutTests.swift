import Foundation
import XCTest

final class MusicStudioNativeLayoutTests: XCTestCase {
    private var wrapperDirectory: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private func source(_ relativePath: String) throws -> String {
        try String(
            contentsOf: wrapperDirectory.appendingPathComponent(relativePath),
            encoding: .utf8
        )
    }

    func testIPadTargetDeclaresNativeLandscapeFullscreenContract() throws {
        let project = try source("MusicStudioNative.xcodeproj/project.pbxproj")

        XCTAssertTrue(project.contains("TARGETED_DEVICE_FAMILY = 2"))
        XCTAssertTrue(project.contains("INFOPLIST_KEY_UILaunchScreen_Generation = YES"))
        XCTAssertTrue(project.contains("INFOPLIST_KEY_UIRequiresFullScreen = YES"))
        XCTAssertTrue(project.contains("UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"))
    }

    func testIPadRootPreservesOnlyTheTopSystemSafeArea() throws {
        let root = try source("Xcode/MusicStudioXcodeRootView.swift")

        XCTAssertTrue(root.contains("Color.black.ignoresSafeArea()"))
        XCTAssertTrue(root.contains(".ignoresSafeArea(.container, edges: [.horizontal, .bottom])"))
        XCTAssertFalse(root.contains("MusicStudioXcodeWebViewContainer()\n            .ignoresSafeArea()"))
    }

    func testWKWebViewDoesNotAddItsOwnInsets() throws {
        let host = try source("MusicStudioWebViewHost.swift")

        XCTAssertTrue(host.contains("contentInsetAdjustmentBehavior = .never"))
        XCTAssertTrue(host.contains("contentInset = .zero"))
        XCTAssertTrue(host.contains("scrollIndicatorInsets = .zero"))
    }
}
