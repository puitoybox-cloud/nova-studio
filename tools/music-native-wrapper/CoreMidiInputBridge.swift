import CoreMIDI
import Foundation

/// Receives MIDI 1.0 channel voice messages from Core MIDI and forwards only
/// Note On / Note Off events to the web bridge.
///
/// Music Studio remains responsible for recording timing, duplicate suppression,
/// Track-ID routing, undo/redo and project persistence.
final class CoreMidiInputBridge {
    typealias MessageHandler = (_ bytes: [UInt8]) -> Void

    private var client = MIDIClientRef()
    private var inputPort = MIDIPortRef()
    private var connectedSources: [MIDIEndpointRef] = []
    private let connectionLock = NSLock()
    private let sourceRefreshQueue = DispatchQueue(label: "NovaMusicStudio.CoreMidiSources")
    private let onMessage: MessageHandler
    private let diagnostics: NativeMidiDiagnostics

    init(diagnostics: NativeMidiDiagnostics, onMessage: @escaping MessageHandler) {
        self.diagnostics = diagnostics
        self.onMessage = onMessage
    }

    deinit {
        stop()
    }

    @discardableResult
    func start() -> OSStatus {
        stop()

        var status = MIDIClientCreateWithBlock("Nova Music Studio" as CFString, &client) { [weak self] _ in
            // A USB MIDI endpoint can be published after the client starts even
            // when it was already attached before app launch. Reconcile on every
            // Core MIDI setup notification so the input port never remains bound
            // only to the launch-time snapshot.
            self?.sourceRefreshQueue.async { [weak self] in
                self?.refreshSources()
            }
        }
        guard status == noErr else { return status }

        status = MIDIInputPortCreateWithProtocol(
            client,
            "Nova Music Studio Input" as CFString,
            ._1_0,
            &inputPort
        ) { [weak self] eventList, _ in
            self?.receive(eventList)
        }
        guard status == noErr else {
            stop()
            return status
        }

        refreshSources()
        return noErr
    }

    func stop() {
        connectionLock.lock()
        if inputPort != 0 {
            for source in connectedSources {
                MIDIPortDisconnectSource(inputPort, source)
            }
            connectedSources.removeAll()
            MIDIPortDispose(inputPort)
            inputPort = 0
        }
        let clientToDispose = client
        client = 0
        connectionLock.unlock()

        // Disposing a client may synchronously emit a setup notification. Do
        // not hold the connection lock across that callback.
        if clientToDispose != 0 { MIDIClientDispose(clientToDispose) }
    }

    private func refreshSources() {
        connectionLock.lock()
        defer { connectionLock.unlock() }
        guard inputPort != 0 else { return }

        let availableSources = (0..<MIDIGetNumberOfSources())
            .map(MIDIGetSource)
            .filter { $0 != 0 }
        let sourceSummary = availableSources.map(Self.endpointName).joined(separator: ", ")
        diagnostics.mark(
            "A",
            status: connectedSources.isEmpty ? "WAIT" : "PASS",
            detail: "sources \(availableSources.count)" + (sourceSummary.isEmpty ? "" : " / \(sourceSummary)")
        )
        let changes = Self.sourceChanges(
            available: availableSources,
            connected: connectedSources
        )

        for source in changes.disconnect {
            MIDIPortDisconnectSource(inputPort, source)
        }
        connectedSources.removeAll { changes.disconnect.contains($0) }

        for source in changes.connect {
            let result = MIDIPortConnectSource(inputPort, source, nil)
            if result == noErr {
                connectedSources.append(source)
                diagnostics.mark("A", status: "PASS", detail: "connected / \(Self.endpointName(source))")
            } else {
                diagnostics.mark("A", status: "FAIL", detail: "connect OSStatus \(result) / \(Self.endpointName(source))")
            }
        }
    }

    static func sourceChanges(
        available: [MIDIEndpointRef],
        connected: [MIDIEndpointRef]
    ) -> (connect: [MIDIEndpointRef], disconnect: [MIDIEndpointRef]) {
        let availableSet = Set(available)
        let connectedSet = Set(connected)
        return (
            connect: available.filter { !connectedSet.contains($0) },
            disconnect: connected.filter { !availableSet.contains($0) }
        )
    }

    private func receive(_ eventList: UnsafePointer<MIDIEventList>) {
        diagnostics.mark("B", status: "PASS", detail: "Core MIDI packet callback", increment: true)
        withUnsafePointer(to: eventList.pointee.packet) { firstPacket in
            var packet = firstPacket
            for packetIndex in 0..<Int(eventList.pointee.numPackets) {
                for word in packet.words() {
                    if let bytes = Self.noteBytes(fromMIDI1UMP: word) {
                        diagnostics.markMessage("C", status: "PASS", bytes: bytes, detail: Self.messageSummary(bytes))
                        diagnostics.note(bytes)
                        onMessage(bytes)
                    } else if Self.isNoteLikeMIDI1UMP(word) {
                        diagnostics.mark("C", status: "DECODE REJECT", detail: "note-like MIDI 1.0 UMP rejected")
                    }
                }
                if packetIndex + 1 < Int(eventList.pointee.numPackets) {
                    packet = UnsafePointer(MIDIEventPacketNext(packet))
                }
            }
        }
    }

    private static func endpointName(_ source: MIDIEndpointRef) -> String {
        var value: Unmanaged<CFString>?
        guard MIDIObjectGetStringProperty(source, kMIDIPropertyDisplayName, &value) == noErr,
              let name = value?.takeRetainedValue() else { return "MIDI source" }
        return name as String
    }

    private static func isNoteLikeMIDI1UMP(_ word: UInt32) -> Bool {
        guard ((word >> 28) & 0x0F) == 0x02 else { return false }
        let command = UInt8((word >> 16) & 0xF0)
        return command == 0x80 || command == 0x90
    }

    private static func messageSummary(_ bytes: [UInt8]) -> String {
        let command = bytes[0] & 0xF0
        let kind = command == 0x80 || (command == 0x90 && bytes[2] == 0) ? "Note Off" : "Note On"
        return "\(kind) / pitch \(bytes[1]) / velocity \(bytes[2])"
    }

    /// MIDI 1.0 Channel Voice UMP is a single 32-bit word:
    /// MT=0x2, Group, Status/Channel, Data1, Data2.
    static func noteBytes(fromMIDI1UMP word: UInt32) -> [UInt8]? {
        let messageType = UInt8((word >> 28) & 0x0F)
        guard messageType == 0x02 else { return nil }

        let status = UInt8((word >> 16) & 0xFF)
        let command = status & 0xF0
        guard command == 0x80 || command == 0x90 else { return nil }

        let data1 = UInt8((word >> 8) & 0xFF)
        let data2 = UInt8(word & 0xFF)
        guard data1 <= 127, data2 <= 127 else { return nil }
        return [status, data1, data2]
    }
}
