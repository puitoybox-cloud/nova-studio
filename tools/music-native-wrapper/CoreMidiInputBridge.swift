import CoreMIDI
import Foundation

/// Receives MIDI 1.0 channel voice messages from Core MIDI and forwards only
/// Note On / Note Off events to the web bridge.
///
/// This class deliberately keeps the native surface narrow. Music Studio owns
/// recording, timing, duplicate suppression, Track-ID routing and persistence.
final class CoreMidiInputBridge {
    typealias MessageHandler = (_ bytes: [UInt8], _ hostTimestamp: UInt64) -> Void

    private var client = MIDIClientRef()
    private var inputPort = MIDIPortRef()
    private var connectedSources: [MIDIEndpointRef] = []
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

        var status = MIDIClientCreateWithBlock("Nova Music Studio" as CFString, &client) { _ in }
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

        let sourceCount = MIDIGetNumberOfSources()
        for index in 0..<sourceCount {
            let source = MIDIGetSource(index)
            guard source != 0 else { continue }
            let connectStatus = MIDIPortConnectSource(inputPort, source, nil)
            if connectStatus == noErr {
                connectedSources.append(source)
            }
        }
        return noErr
    }

    func stop() {
        if inputPort != 0 {
            for source in connectedSources {
                MIDIPortDisconnectSource(inputPort, source)
            }
            connectedSources.removeAll()
            MIDIPortDispose(inputPort)
            inputPort = 0
        }
        if client != 0 {
            MIDIClientDispose(client)
            client = 0
        }
    }

    private func receive(_ eventList: UnsafePointer<MIDIEventList>) {
        var packet = UnsafePointer<MIDIEventPacket>(&eventList.pointee.packet)

        for packetIndex in 0..<Int(eventList.pointee.numPackets) {
            let timestamp = packet.pointee.timeStamp
            for word in packet.words() {
                if let bytes = Self.noteBytes(fromMIDI1UMP: word) {
                    onMessage(bytes, timestamp)
                }
            }
            if packetIndex + 1 < Int(eventList.pointee.numPackets) {
                packet = UnsafePointer(MIDIEventPacketNext(packet))
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

        let data1 = UInt8((word >> 8) & 0x7F)
        let data2 = UInt8(word & 0x7F)
        return [status, data1, data2]
    }
}
