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
        XCTAssertEqual(scripts.count, 1)
        XCTAssertEqual(scripts[0].injectionTime, .atDocumentStart)
        XCTAssertTrue(scripts[0].isForMainFrameOnly)
        XCTAssertEqual(scripts[0].source, MusicStudioWebMidiBridge.nativeWebMidiShimSource)
    }

    func testLateNavigationCompletionCannotReplaceStoppedOrFailedState() {
        let host = MusicStudioWebViewHost(configuration: .production, platform: "mac")
        host.stop()
        XCTAssertEqual(host.lifecycleState, "STOPPED")
        host.webView(host.webView, didFinish: nil)
        XCTAssertEqual(host.lifecycleState, "STOPPED")
        host.webView(host.webView, didFail: nil, withError: NSError(domain: "fixture", code: 1))
        XCTAssertEqual(host.lifecycleState, "FAILED")
        host.webView(host.webView, didFinish: nil)
        XCTAssertEqual(host.lifecycleState, "FAILED")
        host.stop()
        XCTAssertEqual(host.lifecycleState, "FAILED")
    }

    func testShimExposesTheMusicStudioRequestMIDIAccessContract() throws {
        let context = try makeContext()
        XCTAssertEqual(context.evaluateScript("typeof navigator.requestMIDIAccess")?.toString(), "function")
        XCTAssertEqual(context.evaluateScript("Object.prototype.toString.call(navigator.requestMIDIAccess())")?.toString(), "[object Promise]")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.access.inputs.size")?.toInt32(), 1)
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.id")?.toString(), "nova-native-core-midi")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.name")?.toString(), "Core MIDI (Native)")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.state")?.toString(), "disconnected")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.connection")?.toString(), "closed")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.access.outputs.size")?.toInt32(), 0)
    }

    func testShimDispatchesNoteOnNoteOffAndVelocityZeroThroughOnMidiMessage() throws {
        let context = try makeContext()
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
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
            "NovaMusicNativeMidiShim.dispatch({data:['bad',60,1]}).accepted",
            "NovaMusicNativeMidiShim.dispatch({data:['144',60,1]}).accepted",
            "NovaMusicNativeMidiShim.dispatch({data:[true,60,1]}).accepted",
            "NovaMusicNativeMidiShim.dispatch({data:{0:144,1:60,2:1,length:3}}).accepted"
        ] {
            XCTAssertFalse(context.evaluateScript(expression)?.toBool() == true)
        }
    }

    func testShimUsesFiniteNonnegativeMonotonicPageClock() throws {
        let context = try makeContext(performanceNow: "(() => { let values = [12, 8, NaN]; return () => values.shift(); })()")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("var stamps = []; NovaMusicNativeMidiShim.input.onmidimessage = event => stamps.push(event.timeStamp);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[0x90,60,1]}); NovaMusicNativeMidiShim.dispatch({data:[0x80,60,0]}); NovaMusicNativeMidiShim.dispatch({data:[0x90,61,1]});")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(stamps)")?.toString(), "[12,12,12]")
    }

    func testSourceDisconnectRejectsNotesAndReconnectRestoresDelivery() throws {
        let context = try makeContext()
        context.evaluateScript("var changes = []; NovaMusicNativeMidiShim.access.onstatechange = e => changes.push(e.port.state);")
        XCTAssertFalse(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,90]}).accepted")?.toBool() == true)
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        XCTAssertTrue(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,90]}).accepted")?.toBool() == true)
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertFalse(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,90]}).accepted")?.toBool() == true)
        XCTAssertEqual(context.evaluateScript("JSON.stringify(changes)")?.toString(), "[\"connected\",\"disconnected\"]")
    }

    func testDisconnectReleasesHeldNotesAndDoesNotReplayThem() throws {
        let context = try makeContext()
        context.evaluateScript("var received = []; NovaMusicNativeMidiShim.input.onmidimessage = e => received.push(Array.from(e.data));")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[145,60,90]});")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(received)")?.toString(), "[[145,60,90],[129,60,0]]")
    }

    func testDisconnectReleasesAllChannelsAndRepeatedNotesOnce() throws {
        let context = try makeContext()
        context.evaluateScript("var events = []; NovaMusicNativeMidiShim.input.onmidimessage = e => events.push(Array.from(e.data));")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]});")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,110]});")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[145,60,90]});")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[145,62,90]});")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[145,62,0]});")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(events.slice(5))")?.toString(), "[[128,60,0],[129,60,0]]")
    }

    func testStateChangeEventListenersReceiveTransitionsOnce() throws {
        let context = try makeContext()
        context.evaluateScript("var states = []; var handler = e => states.push(e.port.state); NovaMusicNativeMidiShim.access.addEventListener('statechange', handler);")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.access.removeEventListener('statechange', handler);")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(states)")?.toString(), "[\"connected\"]")
    }

    func testInputPortReceivesStateChangeEvents() throws {
        let context = try makeContext()
        context.evaluateScript("var events = []; NovaMusicNativeMidiShim.input.onstatechange = e => events.push('property:' + e.target.state); NovaMusicNativeMidiShim.input.addEventListener('statechange', e => events.push('listener:' + e.port.state));")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(events)")?.toString(), "[\"property:connected\",\"listener:connected\",\"property:disconnected\",\"listener:disconnected\"]")
    }

    func testExplicitPortCloseBlocksDeliveryUntilReopened() throws {
        let context = try makeContext()
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.input.close();")
        XCTAssertFalse(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]}).accepted")?.toBool() == true)
        context.evaluateScript("NovaMusicNativeMidiShim.input.open();")
        XCTAssertTrue(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]}).accepted")?.toBool() == true)
    }

    func testExplicitCloseReleasesHeldNotesWithoutDuplicates() throws {
        let context = try makeContext()
        context.evaluateScript("var events = []; NovaMusicNativeMidiShim.input.onmidimessage = e => events.push(Array.from(e.data));")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[146,64,110]});")
        context.evaluateScript("NovaMusicNativeMidiShim.input.close(); NovaMusicNativeMidiShim.input.close();")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(events)")?.toString(), "[[146,64,110],[130,64,0]]")
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
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
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

    func testCoreMidiWordReachesRegisteredSyntheticInputHandlerExactlyOnce() throws {
        let context = try makeContext(performanceNow: "() => 250.25")
        let bytes = try XCTUnwrap(
            CoreMidiInputBridge.noteBytes(fromMIDI1UMP: 0x20903C64)
        )
        let payload = bytes.map(String.init).joined(separator: ",")

        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("var received = []; NovaMusicNativeMidiShim.input.onmidimessage = event => received.push({ data: Array.from(event.data), timeStamp: event.timeStamp });")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({ data: [\(payload)] });")

        XCTAssertEqual(context.evaluateScript("received.length")?.toInt32(), 1)
        XCTAssertEqual(context.evaluateScript("JSON.stringify(received[0].data)")?.toString(), "[144,60,100]")
        XCTAssertEqual(context.evaluateScript("received[0].timeStamp")?.toDouble(), 250.25)
    }
}
