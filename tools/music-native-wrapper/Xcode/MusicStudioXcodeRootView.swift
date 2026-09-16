import SwiftUI
import WebKit

private let pr250VerificationConfiguration = MusicStudioAppConfiguration(
    startURL: URL(string: "https://cdn.jsdelivr.net/gh/puitoybox-cloud/nova-studio@8d16076cd954d201ea8f46473a56eeb3287caf85/music-studio.html")!
)

struct MusicStudioXcodeRootView: View {
    var body: some View {
        MusicStudioXcodeWebViewContainer()
            .ignoresSafeArea()
    }
}

#if os(macOS)
struct MusicStudioXcodeWebViewContainer: NSViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        context.coordinator.makeWebView()
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    static func dismantleNSView(_ nsView: WKWebView, coordinator: Coordinator) {
        coordinator.stop()
    }

    final class Coordinator {
        private var host: MusicStudioWebViewHost?

        func makeWebView() -> WKWebView {
            let host = MusicStudioWebViewHost(configuration: pr250VerificationConfiguration, platform: "mac")
            self.host = host
            host.start()
            return host.webView
        }

        func stop() {
            host?.stop()
        }
    }
}
#else
struct MusicStudioXcodeWebViewContainer: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        context.coordinator.makeWebView()
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        coordinator.stop()
    }

    final class Coordinator {
        private var host: MusicStudioWebViewHost?

        func makeWebView() -> WKWebView {
            let host = MusicStudioWebViewHost(configuration: pr250VerificationConfiguration, platform: "ipad")
            self.host = host
            host.start()
            return host.webView
        }

        func stop() {
            host?.stop()
        }
    }
}
#endif
