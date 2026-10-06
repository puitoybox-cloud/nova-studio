import XCTest
import CryptoKit
@testable import NovaMusicNativeWrapper

final class MusicStudioOwnedLifecycleTests: XCTestCase {
    let token = String(repeating: "a", count: 64)
    let requestID = String(repeating: "b", count: 64)
    let binding = String(repeating: "c", count: 64)
    let now = Date(timeIntervalSince1970: 1000)
    func owner(clock: @escaping () -> TimeInterval = { 100 }) throws -> MusicStudioOwnedLifecycle {
        try MusicStudioOwnedLifecycle(origin: URL(string: "http://127.0.0.1:18766")!, session: token,
            credential: MusicStudioOwnedCredential(capability: token, sequence: 0, expiresAt: 1020000, deadlineAt: 1060000), now: now, uptime: clock)
    }
    func response(action: String, state: String, sequence: Int, binding: String? = nil,
                  capability: String? = nil, expiry: Double = 1020000, renewals: Int = 0, result: [String: Any]? = nil) throws -> Data {
        var value: [String: Any] = ["format":"NOVA_OWNED_CONTROL_RECEIPT","version":1,"session":token,
            "action":action,"state":state,"sequence":sequence,"capability":capability ?? token,
            "expiresAt":expiry,"deadlineAt":1060000,"renewals":renewals]
        if let binding { value["bindingDigest"] = binding }
        if let result { value["result"] = result }
        return try JSONSerialization.data(withJSONObject: value)
    }
    func begin(_ owner: MusicStudioOwnedLifecycle) throws {
        _ = try owner.command("begin", request: requestID, input: MusicStudioOwnedLifecycle.identity(Data("input".utf8)))
        try owner.receive(response(action: "begin", state: "PROCESSING", sequence: 1, binding: binding), now: now)
    }
    func testOneShotResultOutputAcceptanceAndDuplicateRejection() throws {
        let owner = try owner(); try begin(owner)
        let bytes = Data("output".utf8); let identity = MusicStudioOwnedLifecycle.identity(bytes)
        _ = try owner.command("result")
        try owner.receive(response(action: "result",state:"DELIVERED",sequence:2,binding:binding,result:[
            "resultId":token,"request":requestID,"bindingDigest":binding,"receiptDigest":token,
            "output":["digest":identity.digest,"byteLength":identity.byteLength]]),now:now)
        XCTAssertThrowsError(try owner.command("accept",outputBytes:Data("foreign".utf8)))
        _ = try owner.command("accept",outputBytes:bytes)
        try owner.receive(response(action:"accept",state:"ACCEPTED",sequence:3,binding:binding),now:now)
        XCTAssertEqual(owner.acceptedOutput,identity);XCTAssertEqual(owner.state,"ACCEPTED")
        XCTAssertThrowsError(try owner.command("accept",outputBytes:bytes))
        XCTAssertThrowsError(try owner.command("begin",request:requestID,input:identity))
    }
    func testForeignSessionSequenceStateAndBindingFailClosed() throws {
        for field in ["session","sequence","state","bindingDigest"] {
            let owner = try owner(); try begin(owner); _ = try owner.command("renew")
            var value = try XCTUnwrap(JSONSerialization.jsonObject(with:response(action:"renew",state:"PROCESSING",sequence:2,
                binding:binding,capability:String(repeating:"d",count:64),expiry:1040000,renewals:1)) as? [String:Any])
            if field == "sequence" { value[field] = 0 } else { value[field] = String(repeating:"f",count:64) }
            XCTAssertThrowsError(try owner.receive(JSONSerialization.data(withJSONObject:value),now:now))
            XCTAssertEqual(owner.state,"FAILED");XCTAssertThrowsError(try owner.command("stop"))
        }
    }
    func testBoundedRotatingRenewalCannotExtendHelperDeadline() throws {
        let owner = try owner()
        _ = try owner.command("renew")
        try owner.receive(response(action:"renew",state:"READY",sequence:1,capability:String(repeating:"d",count:64),expiry:1040000,renewals:1),now:now)
        _ = try owner.command("renew")
        try owner.receive(response(action:"renew",state:"READY",sequence:2,expiry:1060000,renewals:2),now:now)
        XCTAssertThrowsError(try owner.command("renew"))
    }
    func testExpiredCapabilityMonotonicDeadlineAndNoRetry() throws {
        var clock: TimeInterval = 100
        let owner = try owner(clock:{clock});clock=120
        XCTAssertThrowsError(try owner.command("stop"))
        let fresh = try self.owner();_ = try fresh.command("stop")
        XCTAssertThrowsError(try fresh.command("stop"));fresh.fail()
        XCTAssertThrowsError(try fresh.receive(response(action:"stop",state:"STOPPING",sequence:1),now:now))
    }
    func testReplayResponseAndUnexpectedResultRejected() throws {
        let owner = try owner();_ = try owner.command("stop")
        let data = try response(action:"stop",state:"STOPPING",sequence:1)
        try owner.receive(data,now:now);XCTAssertEqual(owner.state,"STOPPING")
        XCTAssertThrowsError(try owner.receive(data,now:now));XCTAssertEqual(owner.state,"FAILED")
    }
    func testForeignResultAndReceiptDigestRejected() throws {
        for field in ["request","bindingDigest","receiptDigest","resultId"] {
            let owner = try owner();try begin(owner);_ = try owner.command("result")
            var value: [String:Any] = ["resultId":token,"request":requestID,"bindingDigest":binding,"receiptDigest":token,
                "output":["digest":token,"byteLength":1]]
            value[field] = field == "receiptDigest" || field == "resultId" ? "invalid" : String(repeating:"f",count:64)
            XCTAssertThrowsError(try owner.receive(response(action:"result",state:"DELIVERED",sequence:2,binding:binding,result:value),now:now))
            XCTAssertEqual(owner.state,"FAILED")
        }
    }
    func testWrongOriginAndInvalidCredentialRejected() throws {
        let credential = MusicStudioOwnedCredential(capability:token,sequence:0,expiresAt:1020000,deadlineAt:1060000)
        for text in ["http://localhost:18766","https://127.0.0.1:18766","http://127.0.0.1:18766/escape","http://user@127.0.0.1:18766"] {
            XCTAssertThrowsError(try MusicStudioOwnedLifecycle(origin:URL(string:text)!,session:token,credential:credential,now:now))
        }
        XCTAssertThrowsError(try MusicStudioOwnedLifecycle(origin:URL(string:"http://127.0.0.1:18766")!,session:token,
            credential:MusicStudioOwnedCredential(capability:token,sequence:1,expiresAt:1020000,deadlineAt:1060000),now:now))
    }
    func testPrivateCapabilityStrippedFromBrowserInjection() throws {
        let privateToken = String(repeating:"d",count:64)
        var value: [String:Any] = ["format":"NOVA_LOCAL_BROWSER_HANDOFF","version":1,"origin":"http://127.0.0.1:18766",
            "expiresAt":1060000,"buildRevision":"fixture","ownedControl":["capability":privateToken,"sequence":0,"expiresAt":1020000,"deadlineAt":1060000]]
        for key in ["nonce","session","manifestDigest","runtimeConfigDigest","helperIdentityDigest"] { value[key]=token }
        let text = String(decoding:try JSONSerialization.data(withJSONObject:value),as:UTF8.self)
        let config = try XCTUnwrap(MusicStudioAppConfiguration.startup(environment:["NOVA_LOCAL_HANDOFF":text],now:now))
        XCTAssertEqual(config.ownedCredential?.capability,privateToken)
        XCTAssertFalse(try XCTUnwrap(config.localHandoffJSON).contains(privateToken))
        XCTAssertFalse(try XCTUnwrap(config.localHandoffJSON).contains("ownedControl"))
    }
    func testUnknownOversizedAndExpiredResponseRejected() throws {
        for kind in ["unknown","oversized","expired"] {
            let owner = try owner();_ = try owner.command("stop")
            var data = try response(action:"stop",state:"STOPPING",sequence:1)
            if kind == "oversized" { data = Data(repeating:32,count:4097) }
            if kind == "unknown" {
                var value = try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any]);value["unexpected"]="field"
                data = try JSONSerialization.data(withJSONObject:value)
            }
            XCTAssertThrowsError(try owner.receive(data,now:kind == "expired" ? Date(timeIntervalSince1970:1020) : now))
            XCTAssertEqual(owner.state,"FAILED")
        }
    }
    func testStopTransportRejectsRemoteAndNoJavaScriptCredentials() throws {
        let owner = try owner();let request = try owner.command("stop")
        XCTAssertEqual(request.url?.absoluteString,"http://127.0.0.1:18766/owned-control")
        XCTAssertNil(request.value(forHTTPHeaderField:"Origin"));XCTAssertEqual(request.timeoutInterval,2)
        let transport = MusicStudioOwnedControlTransport();var remote = request;remote.url=URL(string:"https://example.invalid/owned-control")
        var rejected=false
        transport.send(remote) { result in if case .failure = result { rejected=true } }
        XCTAssertTrue(rejected)
    }

    func authorizationResponse(_ owner: MusicStudioOwnedLifecycle, input: MusicStudioOutputIdentity, mutation: String? = nil) throws -> Data {
        var value = try XCTUnwrap(JSONSerialization.jsonObject(with:response(action:"authorize",state:"PROCESSING",sequence:1,binding:binding)) as? [String:Any])
        var auth: [String:Any] = ["format":"NOVA_PROCESSING_AUTHORIZATION","version":1,
            "owner":MusicStudioOwnedLifecycle.identity(Data(token.utf8)).digest,"session":token,"request":requestID,
            "input":["digest":input.digest,"byteLength":input.byteLength],"expectedInventory":binding,
            "processingContract":token,"bindingDigest":binding,"capabilityGeneration":0,
            "expiresAt":1020000,"deadlineAt":1060000,"ticket":token]
        if let mutation { auth[mutation] = String(repeating:"f",count:64) }
        value["authorization"] = auth
        return try JSONSerialization.data(withJSONObject:value)
    }
    func testExplicitAuthorizationBindsInputInventoryContractOwnerAndTicket() throws {
        let owner = try owner();let input = MusicStudioOwnedLifecycle.identity(Data("input".utf8))
        let message = try owner.command("authorize",request:requestID,input:input,expectedInventory:binding,processingContract:token)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with:try XCTUnwrap(message.httpBody)) as? [String:Any])
        XCTAssertEqual(body["owner"] as? String,MusicStudioOwnedLifecycle.identity(Data(token.utf8)).digest)
        XCTAssertEqual(body["expectedInventory"] as? String,binding)
        try owner.receive(authorizationResponse(owner,input:input),now:now)
        XCTAssertEqual(owner.authorization?.ticket,token);XCTAssertEqual(owner.authorization?.request,requestID)
        XCTAssertThrowsError(try owner.command("authorize",request:requestID,input:input,expectedInventory:binding,processingContract:token))
    }
    func testMissingAndTamperedAuthorizationCannotStartProcessing() throws {
        let input = MusicStudioOwnedLifecycle.identity(Data("input".utf8))
        for field in ["owner","session","request","expectedInventory","processingContract","bindingDigest","input","capabilityGeneration"] {
            let owner = try owner()
            _ = try owner.command("authorize",request:requestID,input:input,expectedInventory:binding,processingContract:token)
            XCTAssertThrowsError(try owner.receive(authorizationResponse(owner,input:input,mutation:field),now:now))
            XCTAssertEqual(owner.state,"FAILED");XCTAssertNil(owner.authorization)
        }
        let owner = try owner()
        XCTAssertThrowsError(try owner.command("authorize",request:requestID,input:input))
        _ = try owner.command("authorize",request:requestID,input:input,expectedInventory:binding,processingContract:token)
        XCTAssertThrowsError(try owner.receive(response(action:"authorize",state:"PROCESSING",sequence:1,binding:binding),now:now))
    }
    func shutdownEnvelope(_ payload: [String:Any]) throws -> Data {
        let raw = try JSONSerialization.data(withJSONObject:payload,options:[.sortedKeys,.withoutEscapingSlashes])
        let signature = HMAC<SHA256>.authenticationCode(for:raw,using:SymmetricKey(data:Data(token.utf8))).map { String(format:"%02x",$0) }.joined()
        return try JSONSerialization.data(withJSONObject:["payload":payload,"authentication":signature])
    }
    func shutdownPayload() -> [String:Any] {
        ["format":"NOVA_FINAL_LIFECYCLE_RECEIPT","version":1,
         "owner":MusicStudioOwnedLifecycle.identity(Data(token.utf8)).digest,"session":token,
         "request":NSNull(),"bindingDigest":NSNull(),"resultId":NSNull(),"resultDigest":NSNull(),
         "stopDigest":token,"shutdownDigest":token,"admissionClosed":true,"remainingOwnedDescendants":NSNull(),
         "ownedDescendantsComplete":false,"transportClosed":true,"capabilityInvalidated":true,
         "completionState":"PARTIAL","status":"PARTIAL","complete":false]
    }
    func stoppedOwner() throws -> MusicStudioOwnedLifecycle {
        let owner = try owner();_ = try owner.command("stop")
        try owner.receive(response(action:"stop",state:"STOPPING",sequence:1),now:now);return owner
    }
    func testAuthenticatedPartialShutdownIsNotCompleteAndReplayRejected() throws {
        let owner = try stoppedOwner();let data = try shutdownEnvelope(shutdownPayload())
        try owner.receiveShutdown(data);XCTAssertEqual(owner.state,"SHUTDOWN_PARTIAL")
        XCTAssertThrowsError(try owner.receiveShutdown(data));XCTAssertEqual(owner.state,"FAILED")
    }
    func testForeignTamperedPrematureAndFalseCompleteShutdownRejected() throws {
        for kind in ["foreign","tamper","complete","transport","boolean-count"] {
            let owner = try stoppedOwner();var payload = shutdownPayload()
            if kind == "foreign" { payload["session"] = String(repeating:"f",count:64) }
            if kind == "complete" { payload["complete"] = true;payload["completionState"] = "COMPLETE";payload["status"] = "OBSERVED" }
            if kind == "transport" { payload["transportClosed"] = false }
            if kind == "boolean-count" { payload["remainingOwnedDescendants"] = false }
            var data = try shutdownEnvelope(payload)
            if kind == "tamper" {
                var envelope = try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any]);envelope["authentication"] = String(repeating:"f",count:64)
                data = try JSONSerialization.data(withJSONObject:envelope)
            }
            XCTAssertThrowsError(try owner.receiveShutdown(data));XCTAssertEqual(owner.state,"FAILED")
        }
        XCTAssertThrowsError(try owner().receiveShutdown(shutdownEnvelope(shutdownPayload())))
    }
}
