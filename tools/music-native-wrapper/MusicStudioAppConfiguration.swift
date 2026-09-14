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
