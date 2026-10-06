import Foundation
import CryptoKit

public struct MusicStudioOwnedCredential: Equatable, Codable {
    public let capability: String
    public let sequence: Int
    public let expiresAt: Double
    public let deadlineAt: Double
}

public struct MusicStudioOutputIdentity: Equatable, Codable {
    public let digest: String
    public let byteLength: Int
}

public struct MusicStudioProcessingAuthorization: Codable, Equatable {
    public let format: String
    public let version: Int
    public let owner: String
    public let session: String
    public let request: String
    public let input: MusicStudioOutputIdentity
    public let expectedInventory: String
    public let processingContract: String
    public let bindingDigest: String
    public let capabilityGeneration: Int
    public let expiresAt: Double
    public let deadlineAt: Double
    public let ticket: String
}

/// A bounded private launcher capability. Never accessible to page JavaScript.
/// Bearer authentication authenticates the owned channel, not native containment.
public final class MusicStudioOwnedLifecycle {
    public enum Failure: Error { case invalid, expired, occupied, foreign, partial }
    public private(set) var state = "READY"
    public private(set) var authorization: MusicStudioProcessingAuthorization?
    private var expectedAuthorization: (MusicStudioOutputIdentity, String, String)?
    private var ownerIdentity: String = ""
    private var finalKey = Data()
    private var acceptedResultID: String?
    private var acceptedResultDigest: String?
    private var shutdownReceived = false
    public private(set) var acceptedOutput: MusicStudioOutputIdentity?
    private let origin: URL
    private let session: String
    private var credential: MusicStudioOwnedCredential
    private var pending: (String, Int)?
    private var requestID: String?
    private var bindingDigest: String?
    private var result: ResultReceipt?
    private var renewals = 0
    private let deadline: TimeInterval
    private var expiry: TimeInterval
    private let uptime: () -> TimeInterval
    private let lock = NSRecursiveLock()

    private struct ResultReceipt: Codable {
        let resultId: String
        let request: String
        let bindingDigest: String
        let receiptDigest: String
        let output: MusicStudioOutputIdentity
    }
    private struct Response: Codable {
        let format: String
        let version: Int
        let session: String
        let action: String
        let state: String
        let capability: String
        let sequence: Int
        let expiresAt: Double
        let deadlineAt: Double
        let renewals: Int
        let bindingDigest: String?
        let result: ResultReceipt?
        let authorization: MusicStudioProcessingAuthorization?
    }
    private static func token(_ text: String) -> Bool {
        text.count == 64 && text.allSatisfy { "0123456789abcdef".contains($0) }
    }
    public init(origin: URL, session: String, credential: MusicStudioOwnedCredential,
                now: Date = Date(), uptime: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }) throws {
        let time = now.timeIntervalSince1970 * 1000
        guard origin.scheme == "http", origin.host == "127.0.0.1", let port = origin.port,
              (1...65535).contains(port), origin.absoluteString == "http://127.0.0.1:\(port)",
              Self.token(session), Self.token(credential.capability), credential.sequence == 0,
              credential.expiresAt.isFinite, credential.deadlineAt.isFinite,
              credential.expiresAt > time, credential.expiresAt <= time + 20000,
              credential.deadlineAt >= credential.expiresAt, credential.deadlineAt <= time + 300000 else { throw Failure.invalid }
        self.ownerIdentity = Self.identity(Data(credential.capability.utf8)).digest
        self.finalKey = Data(credential.capability.utf8)
        self.origin = origin; self.session = session; self.credential = credential; self.uptime = uptime
        deadline = uptime() + (credential.deadlineAt - time)/1000
        expiry = uptime() + (credential.expiresAt - time)/1000
    }
    public static func identity(_ bytes: Data) -> MusicStudioOutputIdentity {
        var digest = SHA256()
        var index = 0
        while index < bytes.count {
            let end = min(index + 65536, bytes.count)
            digest.update(data: bytes.subdata(in: index..<end)); index = end
        }
        return MusicStudioOutputIdentity(digest: digest.finalize().map { String(format: "%02x", $0) }.joined(), byteLength: bytes.count)
    }
    /// No retries: an uncertain delivery invalidates this one-shot owner.
    public func command(_ action: String, request: String? = nil, input: MusicStudioOutputIdentity? = nil,
                        outputBytes: Data? = nil, expectedInventory: String? = nil, processingContract: String? = nil) throws -> URLRequest {
        lock.lock(); defer { lock.unlock() }
        guard pending == nil, !shutdownReceived, !state.hasPrefix("SHUTDOWN") else { throw Failure.occupied }
        guard uptime() < expiry, uptime() < deadline,
              !["FAILED","STOPPING","STOPPED"].contains(state) else { throw Failure.expired }
        var body: [String: Any] = ["session": session, "capability": credential.capability,
            "sequence": credential.sequence, "action": action]
        switch action {
        case "begin", "authorize":
            guard state == "READY", let request, Self.token(request), let input,
                  Self.token(input.digest), (1...500*1024*1024).contains(input.byteLength) else { throw Failure.invalid }
            body["request"] = request; body["input"] = ["digest": input.digest, "byteLength": input.byteLength]
            if action == "authorize" {
                guard let expectedInventory, let processingContract, Self.token(expectedInventory), Self.token(processingContract) else { throw Failure.invalid }
                body["owner"] = ownerIdentity; body["expectedInventory"] = expectedInventory; body["processingContract"] = processingContract
                expectedAuthorization = (input, expectedInventory, processingContract)
            }
            requestID = request
        case "renew":
            guard ["READY","PROCESSING"].contains(state), renewals < 2 else { throw Failure.invalid }
        case "result": guard state == "PROCESSING" else { throw Failure.invalid }
        case "accept":
            guard state == "DELIVERED", let result, let outputBytes,
                  outputBytes.count <= 64*1024*1024, Self.identity(outputBytes) == result.output else { throw Failure.foreign }
            body["resultId"] = result.resultId
            body["output"] = ["digest": result.output.digest, "byteLength": result.output.byteLength]
        case "stop": break
        default: throw Failure.invalid
        }
        var urlRequest = URLRequest(url: origin.appendingPathComponent("owned-control"))
        urlRequest.httpMethod = "POST"; urlRequest.timeoutInterval = 2
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        pending = (action, credential.sequence)
        return urlRequest
    }
    public func receive(_ data: Data, now: Date = Date()) throws {
        lock.lock(); defer { lock.unlock() }
        do {
            guard data.count <= 4096, let pending, uptime() < expiry, uptime() < deadline,
                  let value = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  Set(value.keys).isSubset(of: ["format","version","session","action","state","capability","sequence","expiresAt","deadlineAt","renewals","bindingDigest","result","authorization"]) else { throw Failure.invalid }
            let response = try JSONDecoder().decode(Response.self, from: data)
            let expectedState = ["begin":"PROCESSING","authorize":"PROCESSING","renew":state,"result":"DELIVERED","accept":"ACCEPTED","stop":"STOPPING"][pending.0]
            guard response.format == "NOVA_OWNED_CONTROL_RECEIPT", response.version == 1,
                  response.session == session, response.action == pending.0, response.state == expectedState,
                  response.sequence == pending.1 + 1, Self.token(response.capability),
                  response.expiresAt.isFinite, response.deadlineAt == credential.deadlineAt,
                  response.expiresAt <= response.deadlineAt,
                  response.expiresAt > now.timeIntervalSince1970 * 1000,
                  response.renewals == renewals + (pending.0 == "renew" ? 1 : 0),
                  pending.0 == "renew" ? response.capability != credential.capability : response.capability == credential.capability,
                  pending.0 == "renew" ? response.expiresAt <= credential.expiresAt + 20000 : response.expiresAt <= credential.expiresAt else { throw Failure.foreign }
            if ["begin","authorize"].contains(pending.0) {
                guard let binding = response.bindingDigest, Self.token(binding) else { throw Failure.partial }
                bindingDigest = binding
            } else if response.bindingDigest != bindingDigest { throw Failure.foreign }
            if pending.0 == "authorize" {
                guard let auth = response.authorization, let expected = expectedAuthorization,
                      auth.format == "NOVA_PROCESSING_AUTHORIZATION", auth.version == 1, auth.owner == ownerIdentity,
                      auth.session == session, auth.request == requestID, auth.input == expected.0,
                      auth.expectedInventory == expected.1, auth.processingContract == expected.2,
                      auth.bindingDigest == bindingDigest, auth.capabilityGeneration == renewals,
                      auth.expiresAt == response.expiresAt, auth.deadlineAt == credential.deadlineAt,
                      Self.token(auth.ticket) else { throw Failure.foreign }
                authorization = auth; expectedAuthorization = nil
            } else if response.authorization != nil { throw Failure.foreign }
            if pending.0 == "result" {
                guard let received = response.result, received.request == requestID,
                      received.bindingDigest == bindingDigest, Self.token(received.resultId), Self.token(received.receiptDigest),
                      Self.token(received.output.digest), (1...64*1024*1024).contains(received.output.byteLength) else { throw Failure.foreign }
                result = received
            } else if response.result != nil { throw Failure.foreign }
            if pending.0 == "accept" {
                acceptedOutput = result?.output; acceptedResultID = result?.resultId
                let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys,.withoutEscapingSlashes]
                if let result { acceptedResultDigest = Self.identity(try encoder.encode(result)).digest }
                result = nil
            }
            if pending.0 == "renew" { expiry = min(deadline, expiry + 20) }
            renewals = response.renewals
            credential = MusicStudioOwnedCredential(capability: response.capability, sequence: response.sequence,
                expiresAt: response.expiresAt, deadlineAt: response.deadlineAt)
            state = response.state; self.pending = nil
            if state == "STOPPING" {
                credential = MusicStudioOwnedCredential(capability: "", sequence: response.sequence,
                    expiresAt: response.expiresAt, deadlineAt: response.deadlineAt)
            }
        } catch { state = "FAILED"; self.pending = nil; result = nil; authorization = nil; throw error }
    }
    /// Called only by an explicit private launcher sink after transports close.
    /// Authentication proves the owner summary; unknown descendants remain PARTIAL.
    public func receiveShutdown(_ data: Data) throws {
        lock.lock(); defer { lock.unlock() }
        do {
            guard state == "STOPPING", !shutdownReceived, data.count <= 4096,
                  let envelope = try JSONSerialization.jsonObject(with: data) as? [String:Any],
                  Set(envelope.keys) == Set(["payload","authentication"]),
                  let payload = envelope["payload"] as? [String:Any], let authentication = envelope["authentication"] as? String,
                  Self.token(authentication), Set(payload.keys) == Set(["format","version","owner","session","request","bindingDigest","resultId","resultDigest","stopDigest","shutdownDigest","admissionClosed","remainingOwnedDescendants","ownedDescendantsComplete","transportClosed","capabilityInvalidated","completionState","status","complete"]) else { throw Failure.invalid }
            let raw = try JSONSerialization.data(withJSONObject:payload,options:[.sortedKeys,.withoutEscapingSlashes])
            let received = stride(from:0,to:64,by:2).map { index -> UInt8 in
                let start = authentication.index(authentication.startIndex,offsetBy:index)
                return UInt8(authentication[start..<authentication.index(start,offsetBy:2)],radix:16)!
            }
            guard HMAC<SHA256>.isValidAuthenticationCode(received,authenticating:raw,using:SymmetricKey(data:finalKey)) else { throw Failure.foreign }
            struct Summary: Decodable {
                let format: String; let version: Int; let owner: String; let session: String
                let request: String?; let bindingDigest: String?; let resultId: String?; let resultDigest: String?
                let stopDigest: String; let shutdownDigest: String; let admissionClosed: Bool
                let remainingOwnedDescendants: Int?; let ownedDescendantsComplete: Bool
                let transportClosed: Bool; let capabilityInvalidated: Bool; let completionState: String
                let status: String; let complete: Bool
            }
            let summary = try JSONDecoder().decode(Summary.self,from:raw)
            guard summary.format == "NOVA_FINAL_LIFECYCLE_RECEIPT", summary.version == 1,
                  summary.owner == ownerIdentity, summary.session == session, summary.request == requestID,
                  summary.bindingDigest == bindingDigest, summary.resultId == acceptedResultID,
                  Self.token(summary.stopDigest), Self.token(summary.shutdownDigest),
                  summary.resultDigest == acceptedResultDigest,
                  summary.transportClosed, summary.capabilityInvalidated,
                  summary.remainingOwnedDescendants == nil || summary.remainingOwnedDescendants! >= 0 else { throw Failure.foreign }
            let proven = summary.admissionClosed && summary.ownedDescendantsComplete && summary.remainingOwnedDescendants == 0
            guard summary.complete ? proven && summary.completionState == "COMPLETE" && summary.status == "OBSERVED" :
                ["PARTIAL","FAILED"].contains(summary.completionState) && summary.status == "PARTIAL" else { throw Failure.partial }
            state = summary.complete ? "SHUTDOWN_OBSERVED" : "SHUTDOWN_" + summary.completionState
            shutdownReceived = true; finalKey = Data(); authorization = nil
        } catch { fail(); finalKey = Data(); throw error }
    }
    public func fail() { lock.lock(); defer { lock.unlock() }; state = "FAILED"; pending = nil; result = nil; authorization = nil }
}

/// Exact-origin, redirect-denying, ephemeral transport with a response byte budget.
public final class MusicStudioOwnedControlTransport: NSObject, URLSessionDataDelegate {
    private var session: URLSession?
    private var task: URLSessionDataTask?
    private var expectedURL: URL?
    private var bytes = Data()
    private var completion: ((Result<Data, Error>) -> Void)?
    private let lock = NSRecursiveLock()
    public func send(_ request: URLRequest, completion: @escaping (Result<Data, Error>) -> Void) {
        lock.lock(); defer { lock.unlock() }
        guard task == nil, let url = request.url, url.scheme == "http", url.host == "127.0.0.1",
              url.port != nil, url.path == "/owned-control", url.user == nil, url.password == nil,
              url.query == nil, url.fragment == nil, request.httpMethod == "POST" else {
            completion(.failure(MusicStudioOwnedLifecycle.Failure.invalid)); return
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 2; configuration.timeoutIntervalForResource = 3
        configuration.urlCache = nil; configuration.httpCookieStorage = nil; configuration.urlCredentialStorage = nil
        self.completion = completion; expectedURL = url; bytes = Data()
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        self.session = session; task = session.dataTask(with: request); task?.resume()
    }
    public func urlSession(_ session: URLSession, task: URLSessionTask,
                           willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                           completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                           completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        lock.lock(); defer { lock.unlock() }
        guard response.url == expectedURL, let http = response as? HTTPURLResponse, http.statusCode == 200,
              response.expectedContentLength >= 0, response.expectedContentLength <= 4096 else { completionHandler(.cancel); return }
        completionHandler(.allow)
    }
    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        lock.lock(); defer { lock.unlock() }
        guard bytes.count + data.count <= 4096 else { dataTask.cancel(); return }
        bytes.append(data)
    }
    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        lock.lock()
        let callback = completion; let result: Result<Data, Error> = error.map { .failure($0) } ?? .success(bytes)
        completion = nil; self.task = nil; self.session = nil; expectedURL = nil; bytes = Data()
        lock.unlock(); session.invalidateAndCancel(); callback?(result)
    }
}
