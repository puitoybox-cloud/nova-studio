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

    init(onMessage: @escaping MessageHandler) {
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
        let changes = Self.sourceChanges(
            available: availableSources,
            connected: connectedSources
        )

        for source in changes.disconnect {
            MIDIPortDisconnectSource(inputPort, source)
        }
        connectedSources.removeAll { changes.disconnect.contains($0) }

        for source in changes.connect where MIDIPortConnectSource(inputPort, source, nil) == noErr {
            connectedSources.append(source)
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
        withUnsafePointer(to: eventList.pointee.packet) { firstPacket in
            var packet = firstPacket
            for packetIndex in 0..<Int(eventList.pointee.numPackets) {
                for word in packet.words() {
                    if let bytes = Self.noteBytes(fromMIDI1UMP: word) {
                        onMessage(bytes)
                    }
                }
                if packetIndex + 1 < Int(eventList.pointee.numPackets) {
                    packet = UnsafePointer(MIDIEventPacketNext(packet))
                }
            }
        }
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
