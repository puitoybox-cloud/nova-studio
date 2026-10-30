// Read-only enumeration. Does not instantiate, validate, authorize, or load presets.
import Foundation
import AudioToolbox
func fourCC(_ value: UInt32) -> String {
    String(bytes: [24,16,8,0].map { UInt8((value >> $0) & 255) }, encoding: .ascii) ?? String(value)
}
var query = AudioComponentDescription(componentType: kAudioUnitType_MusicDevice, componentSubType: 0, componentManufacturer: 0, componentFlags: 0, componentFlagsMask: 0)
var previous: AudioComponent? = nil
var rows: [[String: Any]] = []
while let component = AudioComponentFindNext(previous, &query) {
    previous = component
    var description = AudioComponentDescription()
    guard AudioComponentGetDescription(component, &description) == noErr else { continue }
    var name: Unmanaged<CFString>?
    guard AudioComponentCopyName(component, &name) == noErr, let resolved = name?.takeRetainedValue() else { continue }
    var version: UInt32 = 0
    let versionStatus = AudioComponentGetVersion(component, &version)
    rows.append(["name": resolved as String, "component": ["type": fourCC(description.componentType), "subtype": fourCC(description.componentSubType), "manufacturer": fourCC(description.componentManufacturer)], "componentVersion": versionStatus == noErr ? String(version) : "unknown", "logicValidated": false, "presetEnumeration": "not-requested", "installedForThisProcessArchitecture": true])
}
let data = try JSONSerialization.data(withJSONObject: ["version": 1, "architecture": "build-target", "detectionOnly": true, "entries": rows], options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
