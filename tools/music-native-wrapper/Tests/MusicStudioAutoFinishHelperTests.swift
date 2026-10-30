import Foundation
import XCTest
@testable import NovaMusicNativeWrapper

final class MusicStudioAutoFinishHelperTests: XCTestCase {
    #if os(macOS)
    func testVerifiedContainedComponentStartsAndStopsOwnedHelper() throws {
        guard let path = ProcessInfo.processInfo.environment["NOVA_TEST_COMPONENT"] else {
            throw XCTSkip("NOVA_TEST_COMPONENT is required for contained-runtime integration")
        }
        let workspace = FileManager.default.temporaryDirectory
            .appendingPathComponent("nova-auto-finish-helper-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: workspace) }
        let ready = expectation(description: "owned helper handoff")
        var observed: [String: Any]?
        MusicStudioAutoFinishHelper.shared.start(componentURL: URL(fileURLWithPath: path), workspaceURL: workspace)
        MusicStudioAutoFinishHelper.shared.withHandoff { value in
            observed = value
            ready.fulfill()
        }
        wait(for: [ready], timeout: 15)
        XCTAssertEqual(observed?["version"] as? Int, 1)
        XCTAssertEqual((observed?["lifecycleSession"] as? String)?.count, 32)
        XCTAssertGreaterThanOrEqual((observed?["token"] as? String)?.count ?? 0, 32)

        let stopped = expectation(description: "owned helper stopped")
        MusicStudioAutoFinishHelper.shared.stop { stopped.fulfill() }
        wait(for: [stopped], timeout: 5)

        let restarted = expectation(description: "fresh helper handoff after restart")
        var second: [String: Any]?
        MusicStudioAutoFinishHelper.shared.start(componentURL: URL(fileURLWithPath: path), workspaceURL: workspace)
        MusicStudioAutoFinishHelper.shared.withHandoff { value in
            second = value
            restarted.fulfill()
        }
        wait(for: [restarted], timeout: 15)
        XCTAssertNotEqual(second?["lifecycleSession"] as? String,
                          observed?["lifecycleSession"] as? String)
        XCTAssertNotEqual(second?["token"] as? String, observed?["token"] as? String)
        let stoppedAgain = expectation(description: "restarted helper stopped")
        MusicStudioAutoFinishHelper.shared.stop { stoppedAgain.fulfill() }
        wait(for: [stoppedAgain], timeout: 5)
    }
    #endif
}
