import SwiftUI
import WebKit

private let pr250VerificationConfiguration = MusicStudioAppConfiguration(
    startURL: URL(string: "https://cdn.jsdelivr.net/gh/puitoybox-cloud/nova-studio@448554e4282747a5c58a708f820131e079d94d53/music-studio.html?raw=1")!,
    allowedHosts: [
        "cdn.jsdelivr.net",
        "puitoybox-cloud.github.io"
    ]
)

struct MusicStudioXcodeRootView: View {
    var body: some View {
        MusicStudioXcodeWebViewContainer()
            // Keep the iPad system status row above Music Studio, while still
            // allowing the editor to use the full landscape width.
            .ignoresSafeArea(.container, edges: .horizontal)
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
