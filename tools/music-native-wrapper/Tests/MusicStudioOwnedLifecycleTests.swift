import XCTest
import CryptoKit
import Darwin
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

    func auditEntry(event: String, evidence: [String:Any], index: Int, previous: String,
                    request: String? = nil, binding: String? = nil, contract: String? = nil, generation: Int = 0) throws -> [String:Any] {
        func raw(_ value: Any) throws -> Data { try JSONSerialization.data(withJSONObject:value,options:[.sortedKeys,.withoutEscapingSlashes]) }
        var entry: [String:Any] = ["format":"NOVA_OWNED_AUDIT","version":1,
            "owner":MusicStudioOwnedLifecycle.identity(Data(token.utf8)).digest,"session":token,
            "index":index,"event":event,"request":request as Any? ?? NSNull(),"bindingDigest":binding as Any? ?? NSNull(),
            "processingContract":contract as Any? ?? NSNull(),"generation":generation,"previousDigest":previous,
            "evidenceDigest":MusicStudioOwnedLifecycle.identity(try raw(evidence)).digest]
        entry["digest"] = MusicStudioOwnedLifecycle.identity(try raw(entry)).digest
        entry["authentication"] = HMAC<SHA256>.authenticationCode(for:try raw(entry),using:SymmetricKey(data:Data(token.utf8))).map { String(format:"%02x",$0) }.joined()
        return entry
    }
    func testOwnedAuditRejectsMissingForeignReplayGapGenerationAndContract() throws {
        let input = MusicStudioOwnedLifecycle.identity(Data("input".utf8))
        for mutation in ["missing","session","request","generation","processingContract","previousDigest","index","digest","authentication","order","ticket"] {
            let owner = try owner();_ = try owner.command("authorize",request:requestID,input:input,expectedInventory:binding,processingContract:token)
            var value = try XCTUnwrap(JSONSerialization.jsonObject(with:authorizationResponse(owner,input:input)) as? [String:Any])
            var entries = try XCTUnwrap(value["audit"] as? [[String:Any]])
            if mutation == "missing" { value.removeValue(forKey:"audit") }
            else if mutation == "ticket" { var auth=try XCTUnwrap(value["authorization"] as? [String:Any]);auth["ticket"]=String(repeating:"f",count:64);value["authorization"]=auth }
            else {
                if mutation == "index" || mutation == "generation" { entries[0][mutation]=2 }
                else if mutation == "order" { entries[0]["event"]="result" }
                else { entries[0][mutation]=String(repeating:"f",count:64) }
                value["audit"]=entries
            }
            XCTAssertThrowsError(try owner.receive(JSONSerialization.data(withJSONObject:value),now:now));XCTAssertEqual(owner.state,"FAILED")
        }
    }
    func testAuthenticatedAuditStopSummaryReturnsBoundedPrivateAcknowledgement() throws {
        let owner = try owner();_ = try owner.command("stop")
        var value = try XCTUnwrap(JSONSerialization.jsonObject(with:response(action:"stop",state:"STOPPING",sequence:1)) as? [String:Any])
        var evidence=value;evidence.removeValue(forKey:"capability")
        let stop = try auditEntry(event:"stop",evidence:evidence,index:1,previous:String(repeating:"0",count:64))
        value["audit"]=[stop];try owner.receive(JSONSerialization.data(withJSONObject:value),now:now)
        let payload=shutdownPayload()
        var envelope=try XCTUnwrap(JSONSerialization.jsonObject(with:shutdownEnvelope(payload)) as? [String:Any])
        let summary=try auditEntry(event:"summary",evidence:payload,index:2,previous:try XCTUnwrap(stop["digest"] as? String))
        envelope["audit"]=[summary]
        let data=try owner.receiveShutdown(JSONSerialization.data(withJSONObject:envelope))
        XCTAssertLessThan(data.count,4096);XCTAssertEqual(owner.state,"SHUTDOWN_PARTIAL")
        let ack=try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any])
        let body=try XCTUnwrap(ack["payload"] as? [String:Any]);XCTAssertEqual(body["auditDigest"] as? String,summary["digest"] as? String)
        XCTAssertEqual(body["completionState"] as? String,"PARTIAL");XCTAssertNil(body["capability"])
        XCTAssertThrowsError(try owner.receiveShutdown(JSONSerialization.data(withJSONObject:envelope)))
    }

    func testPythonOwnedTranscriptAuthorizeAdmissionRenewalResultAcceptStopAndFinalAck() throws {
        let path = URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("OwnedAuditTranscript.json")
        let value = try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:path)) as? [String:Any])
        let responses = try XCTUnwrap(value["responses"] as? [[String:Any]])
        let owner = try owner()
        let input=MusicStudioOwnedLifecycle.identity(Data("input".utf8))
        _ = try owner.command("authorize",request:requestID,input:input,expectedInventory:try XCTUnwrap(value["inventory"] as? String),processingContract:try XCTUnwrap(value["contract"] as? String))
        try owner.receive(JSONSerialization.data(withJSONObject:responses[0]),now:now)
        for (index,action) in ["renew","result","accept","stop"].enumerated() {
            _ = try owner.command(action,outputBytes:action == "accept" ? Data("output".utf8) : nil)
            try owner.receive(JSONSerialization.data(withJSONObject:responses[index+1]),now:now)
        }
        let summary=try XCTUnwrap(value["summary"] as? [String:Any])
        let ack=try owner.receiveShutdown(JSONSerialization.data(withJSONObject:summary))
        XCTAssertEqual(owner.state,"SHUTDOWN_PARTIAL");XCTAssertEqual(owner.acceptedOutput,MusicStudioOwnedLifecycle.identity(Data("output".utf8)))
        let envelope=try XCTUnwrap(JSONSerialization.jsonObject(with:ack) as? [String:Any]);let body=try XCTUnwrap(envelope["payload"] as? [String:Any])
        XCTAssertEqual(body["generation"] as? Int,1);XCTAssertEqual(body["completionState"] as? String,"PARTIAL")
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
        var evidence = value; evidence.removeValue(forKey:"authorization"); evidence.removeValue(forKey:"capability")
        evidence["authorizationDigest"] = MusicStudioOwnedLifecycle.identity(try JSONSerialization.data(withJSONObject:auth,options:[.sortedKeys,.withoutEscapingSlashes])).digest
        value["audit"] = [try auditEntry(event:"authorize",evidence:evidence,index:1,previous:String(repeating:"0",count:64),request:requestID,binding:binding,contract:token)]
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
    func testActualAnonymousDescriptorSummaryValidationAndPrivateAck() throws {
        let owner = try owner(); _ = try owner.command("stop")
        var responseValue = try XCTUnwrap(JSONSerialization.jsonObject(with:response(action:"stop",state:"STOPPING",sequence:1)) as? [String:Any])
        var evidence = responseValue; evidence.removeValue(forKey:"capability")
        let stop = try auditEntry(event:"stop",evidence:evidence,index:1,previous:String(repeating:"0",count:64))
        responseValue["audit"] = [stop]
        try owner.receive(JSONSerialization.data(withJSONObject:responseValue),now:now)
        let payload = shutdownPayload()
        var envelope = try XCTUnwrap(JSONSerialization.jsonObject(with:shutdownEnvelope(payload)) as? [String:Any])
        envelope["audit"] = [try auditEntry(event:"summary",evidence:payload,index:2,previous:try XCTUnwrap(stop["digest"] as? String))]
        let bytes = try JSONSerialization.data(withJSONObject:envelope)
        var descriptors: [Int32] = [-1,-1]
        XCTAssertEqual(socketpair(AF_UNIX,SOCK_STREAM,0,&descriptors),0)
        let channel = try MusicStudioPrivateSummaryChannel(inheritedDescriptor:descriptors[0])
        let peer = FileHandle(fileDescriptor:descriptors[1],closeOnDealloc:true)
        let count = UInt32(bytes.count)
        var frame = Data([UInt8((count >> 24) & 255),UInt8((count >> 16) & 255),UInt8((count >> 8) & 255),UInt8(count & 255)])
        frame.append(bytes); try peer.write(contentsOf:frame)
        try channel.exchange(owner:owner)
        func read(_ count: Int) throws -> Data {
            var data = Data()
            while data.count < count {
                let chunk = try XCTUnwrap(peer.read(upToCount:count-data.count))
                XCTAssertFalse(chunk.isEmpty); if chunk.isEmpty { break }; data.append(chunk)
            }
            return data
        }
        let length = try read(4).reduce(0) { ($0 << 8) | Int($1) }
        XCTAssertTrue((1...16384).contains(length))
        let ack = try XCTUnwrap(JSONSerialization.jsonObject(with:read(length)) as? [String:Any])
        let body = try XCTUnwrap(ack["payload"] as? [String:Any])
        XCTAssertEqual(body["owner"] as? String,payload["owner"] as? String)
        XCTAssertEqual(body["session"] as? String,token)
        XCTAssertEqual(body["summaryDigest"] as? String,MusicStudioOwnedLifecycle.identity(try JSONSerialization.data(withJSONObject:payload,options:[.sortedKeys,.withoutEscapingSlashes])).digest)
        XCTAssertEqual(body["completionState"] as? String,"PARTIAL")
        XCTAssertEqual(owner.state,"SHUTDOWN_PARTIAL")
        XCTAssertThrowsError(try channel.exchange(owner:owner))
        try peer.close()
    }
    func testPrivateChannelRejectsNonSocketOversizeAndTruncatedFrame() throws {
        XCTAssertThrowsError(try MusicStudioPrivateSummaryChannel(inheritedDescriptor:0))
        for frame in [Data([0,0,64,1]),Data([0,0,0,8,123,125])] {
            var descriptors: [Int32] = [-1,-1]
            XCTAssertEqual(socketpair(AF_UNIX,SOCK_STREAM,0,&descriptors),0)
            let channel = try MusicStudioPrivateSummaryChannel(inheritedDescriptor:descriptors[0])
            let peer = FileHandle(fileDescriptor:descriptors[1],closeOnDealloc:true)
            try peer.write(contentsOf:frame); shutdown(descriptors[1],SHUT_WR)
            XCTAssertThrowsError(try channel.exchange(owner:stoppedOwner()))
            XCTAssertThrowsError(try channel.exchange(owner:stoppedOwner()))
            try peer.close()
        }
    }
    func testDelayedFinalSummaryIsRejectedWithoutRenewingProcessingAuthority() throws {
        var clock: TimeInterval = 100
        let owner = try owner(clock:{clock});_ = try owner.command("stop")
        try owner.receive(response(action:"stop",state:"STOPPING",sequence:1),now:now)
        clock=110
        XCTAssertThrowsError(try owner.receiveShutdown(shutdownEnvelope(shutdownPayload())))
        XCTAssertEqual(owner.state,"FAILED");XCTAssertThrowsError(try owner.command("renew"))
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
