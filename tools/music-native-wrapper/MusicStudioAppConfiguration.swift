import Foundation

public struct MusicStudioAppConfiguration: Equatable {
    public let startURL: URL
    public let allowedHosts: Set<String>
    public let verificationMarker: String?

    public static let production = MusicStudioAppConfiguration(
        startURL: URL(string: "https://puitoybox-cloud.github.io/nova-studio/music-studio.html")!
    )

    public static func pr250Verification(in bundle: Bundle = .main) -> MusicStudioAppConfiguration {
        guard let startURL = bundle.url(
            forResource: "music-studio",
            withExtension: "html",
            subdirectory: "VerificationProduct"
        ) else {
            fatalError("PR #250 verification product is missing from the application bundle")
        }
        return MusicStudioAppConfiguration(
            startURL: startURL,
            verificationMarker: "PR #250 HEAD b8b6f9226c1b39172b2e7f040ed228fae7fe01c3"
        )
    }

    public init(
        startURL: URL,
        allowedHosts: Set<String>? = nil,
        verificationMarker: String? = nil
    ) {
        self.startURL = startURL
        self.verificationMarker = verificationMarker
        if let allowedHosts {
            self.allowedHosts = Set(allowedHosts.map { $0.lowercased() })
        } else if let host = startURL.host?.lowercased() {
            self.allowedHosts = [host]
        } else {
            self.allowedHosts = []
        }
    }

    public func allows(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "file" else {
            return false
        }
        if scheme == "file" {
            return startURL.isFileURL
        }
        guard let host = url.host?.lowercased() else { return false }
        return allowedHosts.contains(host)
    }
}
