import SwiftUI
import WebKit

private let pr250VerificationConfiguration = MusicStudioAppConfiguration(
    startURL: URL(string: "https://cdn.jsdelivr.net/gh/puitoybox-cloud/nova-studio@eeb7258358e632d01600eb8f73b2765d8d7e4a68/music-studio.html?raw=1")!,
    allowedHosts: [
        "cdn.jsdelivr.net",
        "puitoybox-cloud.github.io"
    ]
)

struct MusicStudioXcodeRootView: View {
    var body: some View {
        ZStack {
            Color(red: 8.0 / 255.0, green: 17.0 / 255.0, blue: 29.0 / 255.0)
                .ignoresSafeArea()
            MusicStudioXcodeWebViewContainer()
                // The iPad status row remains system-owned at the top.
                // Music Studio uses the complete available landscape width and bottom edge.
                .ignoresSafeArea(.container, edges: [.horizontal, .bottom])
        }
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
        let webView = context.coordinator.makeWebView()
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 8.0 / 255.0, green: 17.0 / 255.0, blue: 29.0 / 255.0, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        return webView
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
