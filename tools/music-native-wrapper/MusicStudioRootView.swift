import SwiftUI
import WebKit
import NovaMusicNativeWrapper

struct MusicStudioRootView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            MusicStudioWebViewContainer()
                .ignoresSafeArea(.container, edges: [.horizontal, .bottom])
        }
        .preferredColorScheme(.dark)
    }
}

#if os(macOS)
struct MusicStudioWebViewContainer: NSViewRepresentable {
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
            let host = MusicStudioWebViewHost(configuration: .production, platform: "mac")
            self.host = host
            host.start()
            return host.webView
        }

        func stop() { host?.stop() }
    }
}
#else
struct MusicStudioWebViewContainer: UIViewRepresentable {
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
            let host = MusicStudioWebViewHost(configuration: .production, platform: "ipad")
            self.host = host
            host.start()
            return host.webView
        }

        func stop() { host?.stop() }
    }
}
#endif
