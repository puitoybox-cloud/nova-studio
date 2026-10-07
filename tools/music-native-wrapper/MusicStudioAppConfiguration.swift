import Foundation

public struct MusicStudioAppConfiguration: Equatable {
    public let startURL: URL
    public let allowedHosts: Set<String>
    private var isLoopbackHosted = false
    public private(set) var localHandoffJSON: String? = nil
    public private(set) var ownedCredential: MusicStudioOwnedCredential? = nil
    public private(set) var ownedSession: String? = nil
    public private(set) var ownedSummaryDescriptor: Int32? = nil

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

    /// Explicit launcher channel. Invalid/missing strict startup never chooses HTTPS.
    public static func startup(environment: [String: String], now: Date = Date()) -> MusicStudioAppConfiguration? {
        guard environment["NOVA_STRICT_OFFLINE"] == "1" || environment["NOVA_LOCAL_HANDOFF"] != nil || environment["NOVA_TRUSTED_MANIFEST_PATH"] != nil else { return .production }
        guard let text = environment["NOVA_LOCAL_HANDOFF"], text.utf8.count <= 4096,
              let data = text.data(using: .utf8),
              var value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              value["format"] as? String == "NOVA_LOCAL_BROWSER_HANDOFF",
              (value["version"] as? Int) == 1,
              let origin = value["origin"] as? String,
              let url = URL(string: origin + "/music-studio.html"),
              var configuration = localHosted(startURL: url),
              origin == "http://127.0.0.1:\(url.port!)",
              let expiry = value["expiresAt"] as? Double,
              expiry > now.timeIntervalSince1970 * 1000,
              expiry <= now.timeIntervalSince1970 * 1000 + 300000,
              let build = value["buildRevision"] as? String, !build.isEmpty else { return nil }
        for key in ["nonce", "session", "manifestDigest", "runtimeConfigDigest", "helperIdentityDigest"] {
            guard let digest = value[key] as? String, digest.count == 64,
                  digest.allSatisfy({ "0123456789abcdef".contains($0) }) else { return nil }
        }
        if let control = value.removeValue(forKey: "ownedControl") {
            guard let raw = try? JSONSerialization.data(withJSONObject: control),
                  let credential = try? JSONDecoder().decode(MusicStudioOwnedCredential.self, from: raw),
                  let session = value["session"] as? String,
                  let controlOrigin = URL(string: origin),
                  (try? MusicStudioOwnedLifecycle(origin: controlOrigin, session: session, credential: credential, now: now)) != nil else { return nil }
            configuration.ownedCredential = credential; configuration.ownedSession = session
            if let descriptor = environment["NOVA_OWNED_SUMMARY_FD"] {
                guard let number = Int32(descriptor), number > 2 else { return nil }
                configuration.ownedSummaryDescriptor = number
            }
        }
        guard let sanitized = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
              let sanitizedText = String(data: sanitized, encoding: .utf8) else { return nil }
        configuration.localHandoffJSON = sanitizedText
        return configuration
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
