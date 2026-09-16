import SwiftUI
import WebKit

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
            let host = MusicStudioWebViewHost(configuration: .pr250Verification(), platform: "mac")
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
            let host = MusicStudioWebViewHost(configuration: .pr250Verification(), platform: "ipad")
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
