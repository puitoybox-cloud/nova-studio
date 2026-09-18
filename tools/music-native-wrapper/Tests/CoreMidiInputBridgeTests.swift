import XCTest
@testable import NovaMusicNativeWrapper

final class CoreMidiInputBridgeTests: XCTestCase {
    func testNoteOnUMPDecodesToThreeMidiBytes() {
        let word: UInt32 = 0x20903C64 // MT=2, group=0, Note On ch1, note60, velocity100
        XCTAssertEqual(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: word), [0x90, 60, 100])
    }

    func testNoteOffUMPDecodesToThreeMidiBytes() {
        let word: UInt32 = 0x20803C00
        XCTAssertEqual(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: word), [0x80, 60, 0])
    }

    func testZeroVelocityNoteOnIsPreservedForJavaScriptRecorderToTreatAsNoteOff() {
        let word: UInt32 = 0x20903C00
        XCTAssertEqual(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: word), [0x90, 60, 0])
    }

    func testNonNoteChannelVoiceMessageIsRejected() {
        let controlChange: UInt32 = 0x20B0017F
        XCTAssertNil(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: controlChange))
    }

    func testNonMidi1ChannelVoiceUMPIsRejected() {
        let midi2Word: UInt32 = 0x40903C00
        XCTAssertNil(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: midi2Word))
    }

    func testMidiDataByteBoundariesArePreserved() {
        let highestNoteOnChannel16: UInt32 = 0x209F7F7F
        XCTAssertEqual(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: highestNoteOnChannel16), [0x9F, 127, 127])
    }

    func testMalformedMidiDataBytesAreRejectedInsteadOfMasked() {
        let invalidPitch: UInt32 = 0x20908040
        let invalidVelocity: UInt32 = 0x20903C80
        XCTAssertNil(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: invalidPitch))
        XCTAssertNil(CoreMidiInputBridge.noteBytes(fromMIDI1UMP: invalidVelocity))
    }
}
