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

    func testIPadTargetUsesAppIconAssetWithoutChangingMacIconSettings() throws {
        let project = try source("MusicStudioNative.xcodeproj/project.pbxproj")
        let appIcon = try source("Assets.xcassets/AppIcon.appiconset/Contents.json")

        XCTAssertEqual(project.components(separatedBy: "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon").count - 1, 2)
        XCTAssertEqual(project.components(separatedBy: "A20000000000000000000011").count - 1, 2)
        XCTAssertFalse(project.contains("A10000000000000000000011"))
        XCTAssertTrue(appIcon.contains("MusicStudio-AppIcon-1024.png"))
        XCTAssertTrue(appIcon.contains("\"platform\" : \"ios\""))
        XCTAssertTrue(appIcon.contains("\"size\" : \"1024x1024\""))
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
