import SwiftUI

@main
struct MusicStudioXcodeApp: App {
    #if os(macOS)
    @NSApplicationDelegateAdaptor(MusicStudioTerminationDelegate.self) private var terminationDelegate
    #endif
    var body: some Scene {
        WindowGroup {
            MusicStudioXcodeRootView()
        }
    }
}
