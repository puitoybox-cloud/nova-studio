import XCTest
@testable import NovaMusicNativeWrapper

final class MusicStudioWebMidiBridgeTests: XCTestCase {
    func testShimDefinesRequestMIDIAccessBeforePageCodeUsesIt() {
        let source = MusicStudioWebMidiBridge.nativeWebMidiShimSource
        XCTAssertTrue(source.contains("navigator.requestMIDIAccess"))
        XCTAssertTrue(source.contains("Object.defineProperty(navigator, 'requestMIDIAccess'"))
        XCTAssertTrue(source.contains("inputs: new Map"))
    }

    func testShimRoutesOnlyThreeByteNoteMessagesIntoMidiEventShape() {
        let source = MusicStudioWebMidiBridge.nativeWebMidiShimSource
        XCTAssertTrue(source.contains("data.length !== 3"))
        XCTAssertTrue(source.contains("command !== 0x80 && command !== 0x90"))
        XCTAssertTrue(source.contains("Uint8Array.from"))
        XCTAssertTrue(source.contains("input.onmidimessage"))
    }

    func testShimUsesPagePerformanceClockForExistingRecorderTiming() {
        XCTAssertTrue(MusicStudioWebMidiBridge.nativeWebMidiShimSource.contains("timeStamp: performance.now()"))
    }

    func testVerificationMarkerScriptContainsRevisionAndStableElementID() {
        let source = MusicStudioWebViewHost.verificationMarkerScript("PR #250 HEAD abc123")
        XCTAssertTrue(source.contains("nova-pr250-verification-marker"))
        XCTAssertTrue(source.contains("PR #250 HEAD abc123"))
    }
}
