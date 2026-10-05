import Foundation

public struct MusicStudioAppConfiguration: Equatable {
    public let startURL: URL
    public let allowedHosts: Set<String>
    private var isLoopbackHosted = false

    /// Explicit adapter for a launcher-supplied loopback origin. Caller must
    /// validate its anchored envelope; this is navigation containment only.
    public static func localHosted(startURL: URL) -> MusicStudioAppConfiguration? {
        guard startURL.scheme == "http", startURL.host == "127.0.0.1",
              let port = startURL.port, (1...65535).contains(port),
              startURL.user == nil, startURL.password == nil,
              startURL.query == nil, startURL.fragment == nil else { return nil }
        var result = MusicStudioAppConfiguration(startURL: startURL)
        result.isLoopbackHosted = true
        return result
    }

    public static let production = MusicStudioAppConfiguration(
        startURL: URL(string: "https://puitoybox-cloud.github.io/nova-studio/music-studio.html")!
    )

    public init(startURL: URL, allowedHosts: Set<String>? = nil) {
        self.startURL = startURL
        if let allowedHosts {
            self.allowedHosts = Set(allowedHosts.map { $0.lowercased() })
        } else if let host = startURL.host?.lowercased() {
            self.allowedHosts = [host]
        } else {
            self.allowedHosts = []
        }
    }

    public func allows(_ url: URL) -> Bool {
        if isLoopbackHosted {
            return url.scheme == "http" && url.host == "127.0.0.1" &&
                url.port == startURL.port && url.user == nil && url.password == nil
        }
        if startURL.isFileURL {
            // Local mode is selected only by a local start URL. Keep it separate
            // from the remote allowlist and reject file URLs with a remote host.
            return url.isFileURL && url.host == nil
        }

        guard
            startURL.scheme?.lowercased() == "https",
            startURL.host != nil,
            url.scheme?.lowercased() == "https",
            let host = url.host?.lowercased()
        else { return false }

        return allowedHosts.contains(host)
    }
}
