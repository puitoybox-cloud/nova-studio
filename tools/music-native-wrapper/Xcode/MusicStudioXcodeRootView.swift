import SwiftUI
import WebKit

private let pr250VerificationConfiguration = MusicStudioAppConfiguration(
    startURL: URL(string: "https://cdn.jsdelivr.net/gh/puitoybox-cloud/nova-studio@5e8f3531c2171102d3d4bf4553563e5ae21cee98/music-studio.html?raw=1")!,
    allowedHosts: [
        "cdn.jsdelivr.net",
        "puitoybox-cloud.github.io"
    ]
)

struct MusicStudioXcodeRootView: View {
    var body: some View {
#if os(macOS)
        MusicStudioXcodeWebViewContainer()
            .ignoresSafeArea()
#else
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                Color.black.ignoresSafeArea()
                MusicStudioXcodeWebViewContainer()
                    .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        // Own the complete iPad window instead of asking WKWebView to fill
        // the safe-area-sized SwiftUI proposal. This removes the horizontal
        // gutters while leaving the system status content visible above it.
        .ignoresSafeArea(.container, edges: [.horizontal, .bottom])
        .preferredColorScheme(.dark)
#endif
    }
}

#if os(macOS)
struct MusicStudioXcodeWebViewContainer: NSViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> WKWebView { context.coordinator.makeWebView() }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
    static func dismantleNSView(_ nsView: WKWebView, coordinator: Coordinator) { coordinator.stop() }
    final class Coordinator {
        private var host: MusicStudioWebViewHost?
        func makeWebView() -> WKWebView {
            let host = MusicStudioWebViewHost(configuration: pr250VerificationConfiguration, platform: "mac")
            self.host = host
            host.start()
            return host.webView
        }
        func stop() { host?.stop() }
    }
}
#else
struct MusicStudioXcodeWebViewContainer: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let webView = context.coordinator.makeWebView()
        let musicBackground = UIColor(red: 8.0 / 255.0, green: 17.0 / 255.0, blue: 29.0 / 255.0, alpha: 1)
        webView.isOpaque = true
        webView.backgroundColor = musicBackground
        webView.scrollView.backgroundColor = musicBackground
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.contentInset = .zero
        webView.scrollView.scrollIndicatorInsets = .zero
        return webView
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {
        uiView.scrollView.contentInset = .zero
        uiView.scrollView.scrollIndicatorInsets = .zero
    }
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) { coordinator.stop() }
    final class Coordinator {
        private var host: MusicStudioWebViewHost?
        func makeWebView() -> WKWebView {
            let host = MusicStudioWebViewHost(configuration: pr250VerificationConfiguration, platform: "ipad")
            self.host = host
            host.start()
            return host.webView
        }
        func stop() { host?.stop() }
    }
}
#endif
