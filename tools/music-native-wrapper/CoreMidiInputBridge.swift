import CoreMIDI
import Foundation

final class CoreMidiInputBridge {
    typealias MessageHandler = (_ bytes: [UInt8]) -> Void
    private var client = MIDIClientRef()
    private var inputPort = MIDIPortRef()
    private var connectedSources: [MIDIEndpointRef] = []
    private let onMessage: MessageHandler
    init(onMessage: @escaping MessageHandler) { self.onMessage = onMessage }
    deinit { stop() }
    @discardableResult func start() -> OSStatus {
        stop()
        var status = MIDIClientCreateWithBlock("Nova Music Studio" as CFString, &client) { _ in }
        guard status == noErr else { return status }
        status = MIDIInputPortCreateWithProtocol(client, "Nova Music Studio Input" as CFString, ._1_0, &inputPort) { [weak self] eventList, _ in self?.receive(eventList) }
        guard status == noErr else { stop(); return status }
        for index in 0..<MIDIGetNumberOfSources() { let source = MIDIGetSource(index); guard source != 0 else { continue }; if MIDIPortConnectSource(inputPort, source, nil) == noErr { connectedSources.append(source) } }
        return noErr
    }
    func stop() { if inputPort != 0 { for source in connectedSources { MIDIPortDisconnectSource(inputPort, source) }; connectedSources.removeAll(); MIDIPortDispose(inputPort); inputPort = 0 }; if client != 0 { MIDIClientDispose(client); client = 0 } }
    private func receive(_ eventList: UnsafePointer<MIDIEventList>) { withUnsafePointer(to: eventList.pointee.packet) { firstPacket in var packet = firstPacket; for packetIndex in 0..<Int(eventList.pointee.numPackets) { for word in packet.words() { if let bytes = Self.noteBytes(fromMIDI1UMP: word) { onMessage(bytes) } }; if packetIndex + 1 < Int(eventList.pointee.numPackets) { packet = UnsafePointer(MIDIEventPacketNext(packet)) } } } }
    static func noteBytes(fromMIDI1UMP word: UInt32) -> [UInt8]? { guard UInt8((word >> 28) & 0x0F) == 0x02 else { return nil }; let status = UInt8((word >> 16) & 0xFF); let command = status & 0xF0; guard command == 0x80 || command == 0x90 else { return nil }; return [status, UInt8((word >> 8) & 0x7F), UInt8(word & 0x7F)] }
}
