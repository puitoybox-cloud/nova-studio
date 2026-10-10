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

    func testVelocityZeroNoteOnDoesNotLeaveHeldNoteOnDisconnect() throws {
        let context = try makeContext()
        context.evaluateScript("var events = []; NovaMusicNativeMidiShim.input.onmidimessage = e => events.push(Array.from(e.data));")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]});")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,0]});")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(events)")?.toString(), "[[144,60,100],[144,60,0]]")
    }

    func testReentrantCloseFromNoteOffCallbackDoesNotRepeatRelease() throws {
        let context = try makeContext()
        context.evaluateScript("var events = []; NovaMusicNativeMidiShim.input.onmidimessage = e => { events.push(Array.from(e.data)); if ((e.data[0] & 240) === 128) NovaMusicNativeMidiShim.input.close(); };")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]});")
        context.evaluateScript("NovaMusicNativeMidiShim.input.close();")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(events)")?.toString(), "[[144,60,100],[128,60,0]]")
    }

    func testCloseBlocksReentrantNotesWhileReleasingHeldNotes() throws {
        let context = try makeContext()
        context.evaluateScript("var events = []; var reentrantAccepted = null; NovaMusicNativeMidiShim.input.onmidimessage = e => { events.push(Array.from(e.data)); if ((e.data[0] & 240) === 128) reentrantAccepted = NovaMusicNativeMidiShim.dispatch({data:[144,61,100]}).accepted; };")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]});")
        context.evaluateScript("NovaMusicNativeMidiShim.input.close();")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(events)")?.toString(), "[[144,60,100],[128,60,0]]")
        XCTAssertFalse(context.evaluateScript("reentrantAccepted")?.toBool() == true)
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.connection")?.toString(), "closed")
        context.evaluateScript("NovaMusicNativeMidiShim.input.open(); NovaMusicNativeMidiShim.input.close();")
        XCTAssertEqual(context.evaluateScript("events.length")?.toInt32(), 2)
    }

    func testDisconnectBlocksReentrantNotesBeforeNoteOffCallbacks() throws {
        let context = try makeContext()
        context.evaluateScript("var events = []; var reentrantAccepted = null; NovaMusicNativeMidiShim.input.onmidimessage = e => { events.push(Array.from(e.data)); if ((e.data[0] & 240) === 128) reentrantAccepted = NovaMusicNativeMidiShim.dispatch({data:[144,61,90]}).accepted; };")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]});")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("JSON.stringify(events)")?.toString(), "[[144,60,100],[128,60,0]]")
        XCTAssertFalse(context.evaluateScript("reentrantAccepted")?.toBool() == true)
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.state")?.toString(), "disconnected")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.connection")?.toString(), "closed")
    }

    func testExplicitCloseSurvivesDeviceReconnectUntilApplicationOpensPort() throws {
        let context = try makeContext()
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true);")
        context.evaluateScript("NovaMusicNativeMidiShim.input.close();")
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false); NovaMusicNativeMidiShim.setSourceAvailable(true);")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.state")?.toString(), "connected")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.connection")?.toString(), "closed")
        XCTAssertFalse(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]}).accepted")?.toBool() == true)
        context.evaluateScript("NovaMusicNativeMidiShim.input.open();")
        XCTAssertTrue(context.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[144,60,100]}).accepted")?.toBool() == true)
        context.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(context.evaluateScript("NovaMusicNativeMidiShim.input.connection")?.toString(), "closed")
    }

    func testSysEx() throws {
        let c = try makeContext()
                XCTAssertEqual(c.evaluateScript("NovaMusicNativeMidiShim.access.sysexEnabled")?.toBool(), false)
                XCTAssertTrue(c.evaluateScript("navigator.requestMIDIAccess({sysex:true}).then(() => false, () => true) instanceof Promise")?.toBool() == true)
                XCTAssertEqual(c.evaluateScript("NovaMusicNativeMidiShim.access.outputs.size")?.toInt32(), 0)
    }

    func testListenerRemovalDuringDelivery() throws {
        let c = try makeContext()
                c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var hit = []; var second = () => hit.push('second'); NovaMusicNativeMidiShim.input.addEventListener('midimessage', () => {hit.push('first'); NovaMusicNativeMidiShim.input.removeEventListener('midimessage', second);}); NovaMusicNativeMidiShim.input.addEventListener('midimessage', second); NovaMusicNativeMidiShim.dispatch({data:[144,60,1]});")
                XCTAssertEqual(c.evaluateScript("JSON.stringify(hit)")?.toString(), "[\"first\",\"second\"]")
    }

    func testListenerAdditionDuringDelivery() throws {
        let c = try makeContext()
                c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var count = 0; var added = false; NovaMusicNativeMidiShim.input.addEventListener('midimessage', () => {if (!added) {added = true; NovaMusicNativeMidiShim.input.addEventListener('midimessage', () => count++);}}); NovaMusicNativeMidiShim.dispatch({data:[144,60,1]});")
                XCTAssertEqual(c.evaluateScript("count")?.toInt32(), 0)
                c.evaluateScript("NovaMusicNativeMidiShim.dispatch({data:[128,60,0]});")
                XCTAssertEqual(c.evaluateScript("count")?.toInt32(), 1)
    }

    func testPortCloseInsideMessageDelivery() throws {
        let c = try makeContext()
                c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var log = []; NovaMusicNativeMidiShim.input.onmidimessage = e => {log.push('property'); NovaMusicNativeMidiShim.input.close();}; NovaMusicNativeMidiShim.input.addEventListener('midimessage', e => log.push('listener')); NovaMusicNativeMidiShim.dispatch({data:[144,60,90]});")
                XCTAssertEqual(c.evaluateScript("JSON.stringify(log)")?.toString(), "[\"property\",\"property\",\"listener\",\"listener\"]")
    }

    func testMultiChannelDelivery() throws {
        let c = try makeContext()
                c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var data=[]; NovaMusicNativeMidiShim.input.onmidimessage=e=>data.push(Array.from(e.data)); NovaMusicNativeMidiShim.dispatch({data:[159,127,127]}); NovaMusicNativeMidiShim.dispatch({data:[143,127,0]});")
                XCTAssertEqual(c.evaluateScript("JSON.stringify(data)")?.toString(), "[[159,127,127],[143,127,0]]")
    }

    func testCloseThenSourceTransition() throws {
        let c = try makeContext()
                c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); NovaMusicNativeMidiShim.input.close(); NovaMusicNativeMidiShim.setSourceAvailable(false); NovaMusicNativeMidiShim.setSourceAvailable(true);")
                XCTAssertEqual(c.evaluateScript("NovaMusicNativeMidiShim.input.connection")?.toString(), "closed")
                XCTAssertEqual(c.evaluateScript("NovaMusicNativeMidiShim.input.state")?.toString(), "connected")
    }

    func testUnsupportedMessageDoesNotEmit() throws {
        let c = try makeContext()
                c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var hits=0; NovaMusicNativeMidiShim.input.onmidimessage=()=>hits++; NovaMusicNativeMidiShim.dispatch({data:[240,60,2]}); NovaMusicNativeMidiShim.dispatch({data:[176,60,2]});")
                XCTAssertEqual(c.evaluateScript("hits")?.toInt32(), 0)
    }

    func testZeroEndpointDeduplication() throws {
        let changes = CoreMidiInputBridge.sourceChanges(available: [0, 11, 11, 22, 22], connected: [0, 33, 33])
                XCTAssertEqual(changes.connect, [11, 22])
                XCTAssertEqual(changes.disconnect, [33])
    }

    func testExistingSourceNotReconnected() throws {
        let changes = CoreMidiInputBridge.sourceChanges(available: [20, 20, 30], connected: [20, 20, 40])
                XCTAssertEqual(changes.connect, [30])
                XCTAssertEqual(changes.disconnect, [40])
    }

    func testNoSourceChange() throws {
        let changes = CoreMidiInputBridge.sourceChanges(available: [1, 2], connected: [1, 2])
                XCTAssertTrue(changes.connect.isEmpty)
                XCTAssertTrue(changes.disconnect.isEmpty)
    }

    func testStateChangeSnapshotsBeforePropertyHandlersMutateListeners() throws {
        let c = try makeContext()
        c.evaluateScript("var events=[]; var accessListener=e=>events.push('access-listener'); var portListener=e=>events.push('port-listener'); NovaMusicNativeMidiShim.access.addEventListener('statechange',accessListener); NovaMusicNativeMidiShim.input.addEventListener('statechange',portListener); NovaMusicNativeMidiShim.access.onstatechange=e=>{events.push('access-property'); NovaMusicNativeMidiShim.access.removeEventListener('statechange',accessListener); NovaMusicNativeMidiShim.input.removeEventListener('statechange',portListener);}; NovaMusicNativeMidiShim.input.onstatechange=e=>events.push('port-property'); NovaMusicNativeMidiShim.setSourceAvailable(true);")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(events)")?.toString(), #"["access-property","access-listener","port-property","port-listener"]"#)
    }

    func testCoreMidiSourceCallbackRunsAfterConnectionLockRelease() throws {
        let source = try XCTUnwrap(
            String(contentsOf: URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent().deletingLastPathComponent()
                .appendingPathComponent("CoreMidiInputBridge.swift"))
        )
        let refresh = try XCTUnwrap(source.components(separatedBy: "private func refreshSources()").dropFirst().first?.components(separatedBy: "static func sourceChanges(").first)
        let unlock = try XCTUnwrap(refresh.range(of: "connectionLock.unlock()", options: .backwards))
        let notify = try XCTUnwrap(refresh.range(of: "onSourceAvailability(available)"))
        XCTAssertLessThan(unlock.lowerBound, notify.lowerBound)
    }

    func testDisconnectNoteReleaseCannotPublishStaleDisconnectedEventAfterReentrantReconnect() throws {
        let c = try makeContext()
        c.evaluateScript("var states=[]; NovaMusicNativeMidiShim.access.onstatechange=e=>states.push(e.port.state); NovaMusicNativeMidiShim.setSourceAvailable(true); NovaMusicNativeMidiShim.dispatch({data:[144,60,100]}); NovaMusicNativeMidiShim.input.onmidimessage=e=>{if ((e.data[0]&240)===128) NovaMusicNativeMidiShim.setSourceAvailable(true);}; NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(states)")?.toString(), #"["connected","connected"]"#)
        XCTAssertEqual(c.evaluateScript("NovaMusicNativeMidiShim.input.state")?.toString(), "connected")
    }

    func testNestedSourceTransitionDoesNotPublishOldPortEvent() throws {
        let c = try makeContext()
        c.evaluateScript("var accessStates=[]; var portStates=[]; NovaMusicNativeMidiShim.access.onstatechange=e=>{accessStates.push(e.port.state); if(e.port.state==='connected') NovaMusicNativeMidiShim.setSourceAvailable(false);}; NovaMusicNativeMidiShim.input.onstatechange=e=>portStates.push(e.port.state); NovaMusicNativeMidiShim.setSourceAvailable(true);")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(accessStates)")?.toString(), #"["connected","disconnected"]"#)
        XCTAssertEqual(c.evaluateScript("JSON.stringify(portStates)")?.toString(), #"["disconnected"]"#)
    }

    func testThrowingMidiCallbackDoesNotSuppressOtherConsumers() throws {
        let c = try makeContext()
        c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var events=[]; NovaMusicNativeMidiShim.input.onmidimessage=e=>{throw Error('handler fault');}; NovaMusicNativeMidiShim.input.addEventListener('midimessage',e=>events.push(Array.from(e.data))); NovaMusicNativeMidiShim.dispatch({data:[144,60,90]}); NovaMusicNativeMidiShim.dispatch({data:[128,60,0]});")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(events)")?.toString(), #"[[144,60,90],[128,60,0]]"#)
    }

    func testThrowingListenerDoesNotSuppressOtherMidiListeners() throws {
        let c = try makeContext()
        c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var events=[]; NovaMusicNativeMidiShim.input.addEventListener('midimessage',e=>{throw Error('fault');}); NovaMusicNativeMidiShim.input.addEventListener('midimessage',e=>events.push(Array.from(e.data))); NovaMusicNativeMidiShim.dispatch({data:[144,61,90]}); NovaMusicNativeMidiShim.input.close();")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(events)")?.toString(), #"[[144,61,90],[128,61,0]]"#)
    }

    func testThrowingStateListenersDoNotBlockConnectionState() throws {
        let c = try makeContext()
        c.evaluateScript("var states=[]; NovaMusicNativeMidiShim.access.onstatechange=e=>{throw Error('fault');}; NovaMusicNativeMidiShim.access.addEventListener('statechange',e=>states.push(e.port.state)); NovaMusicNativeMidiShim.input.onstatechange=e=>{throw Error('fault');}; NovaMusicNativeMidiShim.input.addEventListener('statechange',e=>states.push(e.port.state)); NovaMusicNativeMidiShim.setSourceAvailable(true); NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(states)")?.toString(), #"["connected","connected","disconnected","disconnected"]"#)
    }

    func testMessageByteMutationCannotCorruptOtherListeners() throws {
        let c = try makeContext()
        c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var received=[]; NovaMusicNativeMidiShim.input.onmidimessage=e=>{e.data[1]=1;}; NovaMusicNativeMidiShim.input.addEventListener('midimessage',e=>{received.push(Array.from(e.data)); e.data[2]=0;}); NovaMusicNativeMidiShim.input.addEventListener('midimessage',e=>received.push(Array.from(e.data))); NovaMusicNativeMidiShim.dispatch({data:[144,60,100]});")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(received)")?.toString(), #"[[144,60,100],[144,60,100]]"#)
    }

    func testHeldNoteReleaseBytesRemainStableAcrossMutatingListeners() throws {
        let c = try makeContext()
        c.evaluateScript("NovaMusicNativeMidiShim.setSourceAvailable(true); var notes=[]; NovaMusicNativeMidiShim.input.onmidimessage=e=>{if ((e.data[0]&240)===128) e.data[1]=1;}; NovaMusicNativeMidiShim.input.addEventListener('midimessage',e=>{if ((e.data[0]&240)===128) notes.push(Array.from(e.data));}); NovaMusicNativeMidiShim.dispatch({data:[144,60,100]}); NovaMusicNativeMidiShim.input.close();")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(notes)")?.toString(), #"[[128,60,0]]"#)
    }

    func testStateChangeExposesStableTransitionStateWithOriginalPortIdentity() throws {
        let c = try makeContext()
        c.evaluateScript("var events=[]; NovaMusicNativeMidiShim.access.onstatechange=e=>events.push([e.transitionState,e.port===NovaMusicNativeMidiShim.input]); NovaMusicNativeMidiShim.input.onstatechange=e=>events.push([e.transitionState,e.port===NovaMusicNativeMidiShim.input]); NovaMusicNativeMidiShim.setSourceAvailable(true); NovaMusicNativeMidiShim.setSourceAvailable(false);")
        XCTAssertEqual(c.evaluateScript("JSON.stringify(events)")?.toString(), #"[["connected",true],["connected",true],["disconnected",true],["disconnected",true]]"#)
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
