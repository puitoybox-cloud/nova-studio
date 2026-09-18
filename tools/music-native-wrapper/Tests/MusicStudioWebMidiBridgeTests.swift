import XCTest
import JavaScriptCore
@testable import NovaMusicNativeWrapper

final class MusicStudioWebMidiBridgeTests: XCTestCase {
    private func makeContext(performanceNow: String = "() => 42.5") throws -> JSContext {
        let context = try XCTUnwrap(JSContext())
        context.exceptionHandler = { _, exception in
            XCTFail("JavaScript exception: \(exception?.toString() ?? "unknown")")
        }
        context.evaluateScript("globalThis.window = globalThis; globalThis.navigator = {}; globalThis.performance = { now: \(performanceNow) };")
        context.evaluateScript(MusicStudioWebMidiBridge.nativeWebMidiShimSource)
        return context
    }

    func testShimDefinesRequestMIDIAccessBeforePageCodeUsesIt() {
        let source = MusicStudioWebMidiBridge.nativeWebMidiShimSource
        XCTAssertTrue(source.contains("navigator.requestMIDIAccess"))
        XCTAssertTrue(source.contains("Object.defineProperty(navigator, 'requestMIDIAccess'"))
        XCTAssertTrue(source.contains("inputs: new Map"))
    }

    func testHostInjectsOneMainFrameShimAtDocumentStart() {
        let host = MusicStudioWebViewHost(configuration: .production, platform: "mac")
        let scripts = host.webView.configuration.userContentController.userScripts
        XCTAssertEqual(scripts.count, 2)
        XCTAssertEqual(scripts[0].injectionTime, .atDocumentStart)
        XCTAssertTrue(scripts[0].isForMainFrameOnly)
        XCTAssertEqual(scripts[0].source, MusicStudioWebMidiBridge.nativeWebMidiShimSource)
        XCTAssertEqual(scripts[1].injectionTime, .atDocumentStart)
        XCTAssertTrue(scripts[1].isForMainFrameOnly)
        XCTAssertEqual(scripts[1].source, MusicStudioWebMidiBridge.diagnosticPanelSource)
    }

    func testShimExposesTheMusicStudioRequestMIDIAccessContract() throws {
        let context = try makeContext()
        XCTAssertEqual(context.evaluateScript("typeof navigator.requestMIDIAccess")?.toString(), "function")
        XCTAssertEqual(context.evaluateScript("Object.prototype.toString.call(navigator.requestMIDIAccess())")?.toString(), "[object Promise]")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.access.inputs.size")?.toInt32(), 1)
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.id")?.toString(), "nova-native-core-midi")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.name")?.toString(), "Core MIDI (Native)")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.state")?.toString(), "connected")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.connection")?.toString(), "open")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.access.outputs.size")?.toInt32(), 0)
    }

    func testShimDispatchesNoteOnNoteOffAndVelocityZeroThroughOnMidiMessage() throws {
        let context = try makeContext()
        context.evaluateScript("var received = []; NovaMusicNativeMidiShim.input.onmidimessage = event => received.push({ data: Array.from(event.data), timeStamp: event.timeStamp });")
        XCTAssertTrue(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[0x90,60,100]}).accepted")?.toBool() == true)
        XCTAssertTrue(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[0x80,60,0]}).accepted")?.toBool() == true)
        XCTAssertTrue(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[0x90,61,0]}).accepted")?.toBool() == true)
        XCTAssertEqual(context.evaluateScript("JSON.stringify(received.map(item => item.data))")?.toString(), "[[144,60,100],[128,60,0],[144,61,0]]")
        XCTAssertEqual(context.evaluateScript("received[0].timeStamp")?.toDouble(), 42.5)
    }

    func testShimRejectsMalformedOutOfRangeAndNonNoteMessages() throws {
        let context = try makeContext()
        for expression in [
            "NovaMusicNativeMidiShim.dispatch({data:[0x90,60]}).accepted",
            "NovaMusicNativeMidiShim.dispatch({data:[0x90,128,1]}).accepted",
            "NovaMusicNativeMidiShim.dispatch({data:[0x90,60,-1]}).accepted",
            "NovaMusicNativeMidiShim.dispatch({data:[0xB0,60,1]}).accepted",
            "NovaMusicNativeMidiShim.dispatch({data:['bad',60,1]}).accepted"
        ] {
            XCTAssertFalse(context.evaluateScript(expression)?.toBool() == true)
        }
    }

    func testShimUsesFiniteNonnegativeMonotonicPageClock() throws {
        let context = try makeContext(performanceNow: "(() => { let values = [12, 8, NaN]; return () => values.shift(); })()")
        context.evaluateScript("var stamps = []; NovaMusicNativeMidiShim.input.onmidimessage = event => stamps.push(event.timeStamp);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[0x90,60,1]}); NovaMusicNativeMidiShim.dispatch({data:[0x80,60,0]}); NovaMusicNativeMidiShim.dispatch({data:[0x90,61,1]});")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(stamps)")?.toString(), "[12,12,12]")
    }

    func testShimDoesNotReplaceExistingWebMidi() throws {
        let context = try XCTUnwrap(JSContext())
        context.evaluateScript("globalThis.window = globalThis; globalThis.navigator = { requestMIDIAccess: () => 'browser-midi' };")
        context.evaluateScript(MusicStudioWebMidiBridge.nativeWebMidiShimSource)
        XCTAssertEqual(context.evaluateScript("navigator.requestMIDIAccess()")?.toString(), "browser-midi")
        XCTAssertTrue(context.evaluateScript("typeof NovaMusicNativeMidiShim === 'undefined'")?.toBool() == true)
    }

    func testRepeatedInjectionDoesNotReplaceInputOrDuplicateListeners() throws {
        let context = try makeContext()
        context.evaluateScript("var originalInput = NovaMusicNativeMidiShim.input; var listenerCount = 0; NovaMusicNativeMidiShim.input.addEventListener('midimessage', () => listenerCount++);")
        context.evaluateScript(MusicStudioWebMidiBridge.nativeWebMidiShimSource)
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[0x90,60,1]});")
        XCTAssertTrue(context.evaluateScript("originalInput === NovaMusicNativeMidiShim.input")?.toBool() == true)
        XCTAssertEqual(context.evaluateScript("listenerCount")?.toInt32(), 1)
    }

    func testNativeDeliveryUsesShimFirstAndLegacyIngressOnlyAsFallback() throws {
        let source = try XCTUnwrap(
            String(contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent().deletingLastPathComponent()
                .appendingPathComponent("MusicStudioWebMidiBridge.swift"))
        )
        XCTAssertTrue(source.contains("NovaMusicNativeMidiShim?.dispatch(payload) ?? window.MusicStudioMidiInput?.receiveNativeMessage(payload)"))
    }

    func testDiagnosticHooksObserveShimAndExistingHandlerWithoutReplacingIt() throws {
        let context = try makeContext()
        context.evaluateScript("var updates = []; NovaNativeMidiDiagnostics = { update: value => updates.push(value) }; var existing = 0; NovaMusicNativeMidiShim.input.onmidimessage = () => existing++;")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({ data: [0x90, 60, 100] });")

        XCTAssertEqual(context.evaluateScript("existing")?.toInt32(), 1)
        XCTAssertEqual(context.evaluateScript("updates.length")?.toInt32(), 2)
        XCTAssertEqual(context.evaluateScript("updates[0].stages.F.status")?.toString(), "PASS")
        XCTAssertEqual(context.evaluateScript("updates[1].stages.G.status")?.toString(), "PASS")
    }

    func testCoreMidiWordReachesRegisteredSyntheticInputHandlerExactlyOnce() throws {
        let context = try makeContext(performanceNow: "() => 250.25")
        let bytes = try XCTUnwrap(
            CoreMidiInputBridge.noteBytes(fromMIDI1UMP: 0x20903C64)
        )
        let payload = bytes.map(String.init).joined(separator: ",")

        context.evaluateScript("var received = []; NovaMusicNativeMidiShim.input.onmidimessage = event => received.push({ data: Array.from(event.data), timeStamp: event.timeStamp });")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({ data: [\(payload)] });")

        XCTAssertEqual(context.evaluateScript("received.length")?.toInt32(), 1)
        XCTAssertEqual(context.evaluateScript("JSON.stringify(received[0].data)")?.toString(), "[144,60,100]")
        XCTAssertEqual(context.evaluateScript("received[0].timeStamp")?.toDouble(), 250.25)
    }
}
