import Foundation

struct MusicStudioAppConfiguration: Equatable {
    let startURL: URL
    let allowedHosts: Set<String>

    init(startURL: URL, allowedHosts: Set<String>? = nil) {
        self.startURL = startURL
        if let allowedHosts {
            self.allowedHosts = Set(allowedHosts.map { $0.lowercased() })
        } else if let host = startURL.host?.lowercased() {
            self.allowedHosts = [host]
        } else {
            self.allowedHosts = []
        }
    }

    func allows(_ url: URL) -> Bool {
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
