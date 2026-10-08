"""Policy-neutral explicit local launcher preflight. No installation or browser navigation.

Trust anchor/build/root must be supplied externally; this module never chooses a
distribution or signing scheme. The browser envelope is a return value for the
existing bootstrap caller, never written to user storage or printed with paths.
"""
import json
import os
import sys
import hashlib
import hmac
import secrets
import threading
import time
import http.client
import subprocess
import signal
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from runtime_inventory import bootstrap
from scoped_closure import load_contract, verify_assembly, private_python_command, private_distribution_lookup, private_runtime_preflight
from dependency_identity import verify_local_asset
from distribution_binding import load_manifest

SOURCES = {'helper-source': 'server.py',
           'runtime-inventory-source': 'runtime_inventory.py',
           'dependency-identity-source': 'dependency_identity.py',
           'distribution-binding-source': 'distribution_binding.py',
           'demucs-parent-source': 'demucs_parent.py',
           'demucs-child-source': 'demucs_child.py',
           'demucs-receipt-source': 'demucs_receipt.py',
           'scoped-closure-source': 'scoped_closure.py',
           'inventory-aggregation-source': 'inventory_aggregation.py',
           'artifact-verification-source': 'artifact_verification.py',
           'runtime-evidence-source': 'runtime_evidence.py',
           'local-distribution-entry-source': 'local_distribution_entry.py'}


def envelope_binding(envelope, expected):
    """Check transport identity against an external caller's anchor, never self-trust."""
    def digest(value):
        return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
            ensure_ascii=False, allow_nan=False).encode()).hexdigest()
    try:
        manifest = envelope['manifest']
        binding = {'buildRevision': manifest['buildRevision'],
            'manifestDigest': digest(manifest),
            'runtimeConfigDigest': hashlib.sha256(envelope['runtimeConfigText'].encode()).hexdigest(),
            'helperIdentityDigest': digest(manifest['helper'])}
        if (set(expected) != set(binding) or binding != expected or
                envelope['trust'] != {'manifestDigest': expected['manifestDigest'],
                                      'buildRevision': expected['buildRevision']}):
            raise ValueError('wrong-envelope-anchor')
        configured = next(e for e in manifest['assets'] if e['id'] == 'runtime-config')
        if configured['digest'] != binding['runtimeConfigDigest']:
            raise ValueError('wrong-envelope-runtime-config')
        return binding
    except (KeyError, TypeError, StopIteration, AttributeError):
        raise ValueError('invalid-anchored-envelope') from None


def _token(value):
    return isinstance(value, str) and len(value) == 64 and all(c in '0123456789abcdef' for c in value)


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


class OwnedAuditChain:
    """16-event process-local chain; only digests and public bindings, no secrets.

    Authenticity derives from the initial private owner capability. This is not
    durable storage/retention policy or native evidence. Full suffixes are sent
    over the existing private channel; no browser audit endpoint is added.
    """
    def __init__(self, owner, session, key):
        self.owner = owner; self.session = session; self.key = key
        self.entries = []; self.cursor = 0; self.phase = 'READY'; self.generation = 0
        self.request = None; self.binding = None; self.contract = None

    def verify(self):
        previous = '0'*64
        for index, entry in enumerate(self.entries,1):
            unsigned = {k:v for k,v in entry.items() if k != 'authentication'}
            payload = {k:v for k,v in unsigned.items() if k != 'digest'}
            if (entry.get('index') != index or entry.get('owner') != self.owner or entry.get('session') != self.session or
                    entry.get('previousDigest') != previous or entry.get('digest') != _digest(payload) or
                    not hmac.compare_digest(entry.get('authentication',''),hmac.new(self.key.encode(),
                        json.dumps(unsigned,sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest())):
                raise ValueError('owned-audit-chain-break')
            previous = entry['digest']
        if self.cursor > len(self.entries): raise ValueError('owned-audit-missing-receipt')

    def append(self, event, evidence, *, request=None, binding=None, contract=None, generation=0):
        if len(self.entries) >= 16 or not _token(self.key): raise ValueError('owned-audit-budget-or-closed')
        self.verify()
        allowed = {'READY':{'renew','begin','authorize','stop','summary'},
            'AUTHORIZED':{'renew','admission','stop','summary'},'ADMITTED':{'renew','publication','stop','summary'},
            'LEGACY':{'renew','publication','stop','summary'},'PUBLISHED':{'result','stop','summary'},
            'DELIVERED':{'accept','stop','summary'},'ACCEPTED':{'stop','summary'},
            'STOPPING':{'summary'},'SUMMARY':set()}
        if event not in allowed[self.phase] or type(generation) is not int or generation != self.generation + (event == 'renew'):
            raise ValueError('owned-audit-order-or-generation')
        if self.request is not None and (request,binding,contract) != (self.request,self.binding,self.contract):
            raise ValueError('owned-audit-changed-binding')
        if event in ('begin','authorize'):
            if not _token(request) or not _token(binding) or event == 'authorize' and not _token(contract):
                raise ValueError('owned-audit-missing-binding')
            self.request,self.binding,self.contract = request,binding,contract
        payload = {'format':'NOVA_OWNED_AUDIT','version':1,'owner':self.owner,'session':self.session,
            'index':len(self.entries)+1,'event':event,'request':request,'bindingDigest':binding,
            'processingContract':contract,'generation':generation,
            'previousDigest':self.entries[-1]['digest'] if self.entries else '0'*64,'evidenceDigest':_digest(evidence)}
        payload['digest'] = _digest(payload)
        payload['authentication'] = hmac.new(self.key.encode(),json.dumps(payload,sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest()
        self.entries.append(payload); self.generation = generation
        self.phase = {'begin':'LEGACY','authorize':'AUTHORIZED','admission':'ADMITTED','publication':'PUBLISHED',
            'result':'DELIVERED','accept':'ACCEPTED','stop':'STOPPING','summary':'SUMMARY'}.get(event,self.phase)
        return dict(payload)

    def suffix(self):
        value = json.loads(json.dumps(self.entries[self.cursor:])); self.cursor = len(self.entries)
        return value


class OwnedResultChannel:
    """Private launcher -> Swift and launcher -> Helper capabilities, never browser tokens.

    One request/result per owner. Renewal only rotates the Swift capability within
    the original Helper/session deadline; it cannot extend processing authority.
    This is process-local bearer authentication, not PKI or native containment.
    """
    def __init__(self, session, deadline, *, clock=time.monotonic, wall=time.time, continuity=None):
        if not _token(session) or not clock() < deadline <= clock()+300:
            raise ValueError('invalid-owned-channel')
        self.session = session; self.deadline = deadline; self.clock = clock; self.wall = wall
        self.continuity = continuity
        self.capability = secrets.token_hex(32); self.helper_capability = secrets.token_hex(32)
        self.expires = min(clock()+20, deadline)
        self.expires_at = int((wall()+self.expires-clock())*1000)
        self.deadline_at = int((wall()+deadline-clock())*1000)
        self.sequence = 0; self.renewals = 0
        self.state = 'READY'; self.binding = None; self.result = None
        self.owner = hashlib.sha256(self.capability.encode()).hexdigest()
        self.final_key = self.capability; self.final_receipt = None
        self.authorization = None; self.admitted = False; self.accepted_result = None
        self.audit = OwnedAuditChain(self.owner,self.session,self.final_key)
        self.final_acknowledgement = None
        self.lock = threading.RLock()

    def audit_event(self, event, evidence):
        try:
            return self.audit.append(event,evidence,request=self.binding["request"] if self.binding else self.audit.request,
                binding=_digest(self.binding) if self.binding else self.audit.binding,
                contract=self.authorization["processingContract"] if self.authorization else self.audit.contract,generation=self.renewals)
        except (ValueError,TypeError,KeyError):
            self.close(failed=True)
            raise

    def handoff(self):
        return {'capability': self.capability, 'sequence': self.sequence,
            'expiresAt': self.expires_at, 'deadlineAt': self.deadline_at}

    def alive(self):
        if self.clock() >= self.deadline or self.state in ('STOPPING', 'STOPPED', 'FAILED'):
            raise ValueError('expired-or-terminal-owned-channel')

    def require_authorization_generation(self):
        if self.authorization is not None and self.authorization['capabilityGeneration'] != self.renewals:
            raise ValueError('changed-owned-authorization-generation')

    def command(self, value, *, inventory, eligible, helper_alive):
        from runtime_evidence import processing_binding
        with self.lock:
            self.alive()
            if (not isinstance(value, dict) or value.get('session') != self.session or
                    not _token(value.get('capability')) or not secrets.compare_digest(value['capability'], self.capability) or
                    type(value.get('sequence')) is not int or value['sequence'] != self.sequence or
                    self.clock() >= self.expires or not helper_alive):
                raise ValueError('stale-foreign-or-dead-owner')
            action = value.get('action')
            if self.binding is not None and action != 'stop':
                current = processing_binding(self.session,self.binding['request'],self.binding['input'],inventory)
                if current != self.binding: raise ValueError('changed-owned-processing-inventory')
            base = {'session','capability','sequence','action'}
            if action in ('begin','authorize'):
                fields = {'request','input'} | ({'owner','expectedInventory','processingContract'} if action == 'authorize' else set())
                if set(value) != base|fields or self.state != 'READY' or eligible is not True:
                    raise ValueError('ineligible-or-replayed-request')
                self.binding = processing_binding(self.session, value['request'], value['input'], inventory)
                if action == 'authorize':
                    contract = inventory.get('runtimeEvidence',{}).get('contractDigest')
                    if (value['owner'] != self.owner or value['expectedInventory'] != self.binding['inventoryRevision'] or
                            not _token(contract) or value['processingContract'] != contract):
                        self.binding = None
                        raise ValueError('foreign-or-changed-processing-authorization')
                    self.authorization = {'format':'NOVA_PROCESSING_AUTHORIZATION','version':1,
                        'owner':self.owner,'session':self.session,'request':value['request'],
                        'input':value['input'],'expectedInventory':self.binding['inventoryRevision'],
                        'processingContract':contract,'bindingDigest':_digest(self.binding),
                        'capabilityGeneration':self.renewals,'expiresAt':self.expires_at,
                        'deadlineAt':self.deadline_at,'ticket':secrets.token_hex(32)}
                self.state = 'PROCESSING'
            elif action == 'renew':
                if set(value) != base or self.state not in ('READY','PROCESSING') or self.renewals >= 2:
                    raise ValueError('renewal-budget-or-state')
                self.renewals += 1; self.capability = secrets.token_hex(32)
                self.expires = min(self.expires+20, self.deadline)
                self.expires_at = min(self.expires_at+20000, self.deadline_at)
            elif action == 'result':
                if self.continuity is not None: self.continuity()
                self.require_authorization_generation()
                if set(value) != base or self.state != 'RESULT_READY': raise ValueError('missing-or-replayed-result')
                # Delivery consumes its sequence; only explicit output acceptance releases it.
                self.state = 'DELIVERED'
            elif action == 'accept':
                if self.continuity is not None: self.continuity()
                self.require_authorization_generation()
                if (set(value) != base|{'resultId','output'} or self.state != 'DELIVERED' or
                        value['resultId'] != self.result['resultId'] or _digest(value['output']) != _digest(self.result['output'])):
                    raise ValueError('foreign-replayed-or-output-mismatch')
                self.accepted_result = json.loads(json.dumps(self.result))
                self.state = 'ACCEPTED'
            elif action == 'stop':
                if set(value) != base: raise ValueError('invalid-stop')
                self.state = 'STOPPING'
            else: raise ValueError('unknown-owned-action')
            self.sequence += 1
            response = {'format':'NOVA_OWNED_CONTROL_RECEIPT','version':1,'session':self.session,
                'action':action,'state':self.state, **self.handoff(), 'renewals':self.renewals,
                'bindingDigest':_digest(self.binding) if self.binding else None}
            if action == 'authorize': response['authorization'] = json.loads(json.dumps(self.authorization))
            if action == 'result': response['result'] = json.loads(json.dumps(self.result))
            audit_evidence = {key:item for key,item in response.items() if key not in ('capability','authorization')}
            if action == 'authorize': audit_evidence['authorizationDigest'] = _digest(self.authorization)
            self.audit_event(action,audit_evidence)
            response['audit'] = self.audit.suffix()
            return response

    def admit(self, value, inventory):
        """Helper-private one-shot admission, after hashing input and before any backend."""
        from runtime_evidence import processing_binding
        with self.lock:
            self.alive()
            auth = self.authorization
            if (self.state != 'PROCESSING' or auth is None or self.admitted or self.clock() >= self.expires or
                    auth['capabilityGeneration'] != self.renewals or
                    not isinstance(value,dict) or set(value) != {'session','capability','ticket','binding','processingContract'} or
                    value['session'] != self.session or not _token(value['capability']) or
                    not secrets.compare_digest(value['capability'],self.helper_capability) or
                    not _token(value['ticket']) or not secrets.compare_digest(value['ticket'],auth['ticket']) or
                    value['processingContract'] != auth['processingContract'] or
                    inventory.get('runtimeEvidence',{}).get('contractDigest') != auth['processingContract'] or
                    _digest(value['binding']) != _digest(self.binding) or
                    processing_binding(self.session,self.binding['request'],self.binding['input'],inventory) != self.binding):
                raise ValueError('missing-stale-foreign-or-replayed-authorization')
            self.admitted = True
            self.audit_event('admission',{'authorizationDigest':_digest(auth),'bindingDigest':_digest(self.binding)})
            return {'format':'NOVA_PROCESSING_ADMISSION','version':1,'session':self.session,
                'request':self.binding['request'],'bindingDigest':_digest(self.binding),
                'authorizationDigest':_digest(auth),'deadlineAt':self.deadline_at,'state':'ADMITTED'}

    def publish(self, value, inventory):
        from runtime_evidence import processing_binding, BoundProcessingReceipt
        with self.lock:
            self.alive()
            if (self.state != 'PROCESSING' or not isinstance(value, dict) or
                    set(value) != {'session','capability','receipt'} or value['session'] != self.session or
                    not _token(value['capability']) or not secrets.compare_digest(value['capability'], self.helper_capability)):
                raise ValueError('foreign-or-replayed-helper-result')
            if self.authorization is not None and not self.admitted: raise ValueError('unadmitted-helper-result')
            self.require_authorization_generation()
            receipt = value['receipt']
            current = processing_binding(self.session,self.binding['request'],self.binding['input'],inventory)
            if (not isinstance(receipt,dict) or receipt.get('format') != 'NOVA_PROCESSING_RECEIPT' or
                    receipt.get('version') != 1 or receipt.get('binding') != self.binding or current != self.binding or
                    receipt.get('complete') is not True or receipt.get('status') != 'VERIFIED' or
                    receipt.get('processingEligible') is not True or receipt.get('blockedBy') != []):
                raise ValueError('partial-or-changed-helper-result')
            output = receipt.get('output')
            if (not isinstance(output,dict) or set(output) != {'digest','byteLength'} or not _token(output['digest']) or
                    type(output['byteLength']) is not int or not 0 < output['byteLength'] <= 64*1024*1024):
                raise ValueError('invalid-owned-output')
            # Recompute the processing aggregator instead of trusting status labels.
            check = BoundProcessingReceipt(self.binding,timeout=min(3,self.deadline-self.clock()))
            check.add_calls({'entries':receipt.get('entries',[])})
            children = receipt.get('children')
            if not isinstance(children,list): raise ValueError('missing-child-evidence')
            for child in children: check.add_child(child)
            reproduced = check.finish(self.binding,inventory,output)
            if _digest(reproduced) != _digest(receipt) or reproduced['complete'] is not True:
                raise ValueError('tampered-or-partial-processing-chain')
            if self.continuity is not None: self.continuity()
            self.require_authorization_generation()
            self.result = {'resultId':secrets.token_hex(32),'request':self.binding['request'],
                'bindingDigest':_digest(self.binding), 'receiptDigest':_digest(receipt), 'output':dict(output)}
            self.state = 'RESULT_READY'
            self.audit_event('publication',self.result)

    def close(self, *, failed=False):
        with self.lock:
            self.state = 'FAILED' if failed else 'STOPPED'
            self.capability = ''; self.helper_capability = ''; self.binding = None; self.result = None
            self.authorization = None


def final_lifecycle_receipt(channel, stop, shutdown, transport_closed, *, failed=False):
    """Detached authenticated summary. STOPPING/leader exit never proves descendants."""
    with channel.lock:
        if channel.final_receipt is not None: return json.loads(json.dumps(channel.final_receipt))
        binding = channel.binding
        accepted = channel.accepted_result
        admission_closed = stop.get('status') == 'OBSERVED' and stop.get('state') == 'STOPPING'
        descendants = shutdown.get('remainingOwnedDescendants')
        proven = shutdown.get('ownedDescendantsComplete') is True and type(descendants) is int and descendants == 0
        complete = not failed and admission_closed and proven and transport_closed is True
        payload = {'format':'NOVA_FINAL_LIFECYCLE_RECEIPT','version':1,'owner':channel.owner,
            'session':channel.session,'request':binding['request'] if binding else None,
            'bindingDigest':_digest(binding) if binding else None,
            'resultId':accepted['resultId'] if accepted else None,
            'resultDigest':_digest(accepted) if accepted else None,
            'stopDigest':_digest(stop),'shutdownDigest':_digest(shutdown),
            'admissionClosed':admission_closed,'remainingOwnedDescendants':descendants,
            'ownedDescendantsComplete':proven,'transportClosed':transport_closed is True,
            'capabilityInvalidated':True,'completionState':'FAILED' if failed else 'COMPLETE' if complete else 'PARTIAL',
            'status':'OBSERVED' if complete else 'PARTIAL','complete':complete}
        key = channel.final_key
        if not _token(key): raise ValueError('missing-final-receipt-owner')
        channel.audit_event('summary',payload)
        audit = channel.audit.suffix()
        channel.close(failed=failed)
        channel.final_receipt = {'payload':payload,'authentication':hmac.new(key.encode(),
            json.dumps(payload,sort_keys=True,separators=(',',':'),allow_nan=False).encode(),hashlib.sha256).hexdigest()}
        channel.final_receipt['audit'] = audit
        channel.ack_key = hmac.new(key.encode(),b'NOVA_FINAL_ACK_KEY_V1',hashlib.sha256).hexdigest()
        channel.ack_deadline = channel.clock()+3
        channel.final_key = ''; channel.audit.key = ''
        return json.loads(json.dumps(channel.final_receipt))


def acknowledge_final_lifecycle(channel, envelope):
    """Explicit private adapter return path; no reopened HTTP server or browser route."""
    with channel.lock:
        if getattr(channel,'ack_deadline',float('inf')) <= channel.clock(): channel.ack_key = ''
        if channel.final_receipt is None or channel.final_acknowledgement is not None or not _token(getattr(channel,"ack_key",None)) or channel.clock() >= channel.ack_deadline:
            raise ValueError('missing-or-replayed-final-acknowledgement')
        if not isinstance(envelope,dict) or set(envelope) != {'payload','authentication'}:
            raise ValueError('invalid-final-acknowledgement')
        value = envelope['payload']; signature = envelope['authentication']
        if not isinstance(value,dict):
            channel.ack_key = ''; raise ValueError('invalid-final-acknowledgement-payload')
        expected = {'format':'NOVA_FINAL_ACKNOWLEDGEMENT','version':1,'owner':channel.owner,
            'session':channel.session,'request':channel.audit.request,'bindingDigest':channel.audit.binding,
            'processingContract':channel.audit.contract,'generation':channel.renewals,
            'summaryDigest':_digest(channel.final_receipt['payload']),
            'auditDigest':channel.audit.entries[-1]['digest'],
            'completionState':channel.final_receipt['payload']['completionState'],'accepted':True}
        if _digest(value) != _digest(expected) or not _token(signature) or not hmac.compare_digest(signature,
                hmac.new(channel.ack_key.encode(),json.dumps(value,sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest()):
            channel.ack_key = ''
            raise ValueError('foreign-or-changed-final-acknowledgement')
        channel.final_acknowledgement = json.loads(json.dumps(value)); channel.ack_key = ''
        return {'status':'OBSERVED','state':'ACKNOWLEDGED','completionState':value['completionState'],
            'complete':value['completionState']=='COMPLETE'}


class OwnedChildInterruptionAdapter:
    """Policy-neutral opaque handle provider contract; no OS/PID signal backend.

    A trusted provider must attest its own live handle at operation time. The
    identity/challenge/owner/freshness checks run BEFORE its scoped operation.
    Unavailable or partial providers cannot execute an interruption.
    """
    def __init__(self, handle, owner, verify, interrupt, *, clock=time.monotonic):
        if handle is None or not _token(owner) or not callable(verify) or not callable(interrupt):
            raise ValueError('invalid-owned-interruption-provider')
        self.handle=handle; self.owner=owner; self.verify=verify; self.interrupt=interrupt
        self.clock=clock; self.consumed=False; self.lock=threading.Lock()

    def __call__(self, handle, owner, timeout):
        with self.lock:
            if self.consumed or handle is not self.handle or owner != self.owner or type(timeout) not in (int,float) or not 0 < timeout <= 3:
                raise ValueError('stale-foreign-interruption-handle')
            self.consumed=True
            challenge=secrets.token_hex(32); started=self.clock()
            proof=self.verify(handle,owner,challenge)
            expected={'owner':owner,'challenge':challenge,'liveHandleVerified':True,'scope':'EXACT_OWNED_HANDLE'}
            if (not isinstance(proof,dict) or set(proof) != set(expected) or _digest(proof) != _digest(expected) or
                    not 0 <= self.clock()-started < timeout):
                raise ValueError('unverified-live-interruption-handle')
            result=self.interrupt(handle,owner,challenge,max(0.001,timeout-(self.clock()-started)))
            if (not isinstance(result,dict) or result.get('owner') != owner or result.get('challenge') != challenge or
                    result.get('liveHandleVerified') is not True or result.get('ownedChildrenComplete') is not True or
                    result.get('stopped') is not True or not 0 <= self.clock()-started <= timeout):
                raise ValueError('partial-or-stale-interruption-receipt')
            return result


def stage2_software_closure(evidence):
    """Explicit categories, never a substitute for strict runtime eligibility/formal A."""
    categories={
        'A':('swiftAuthorizationBinding','oneShotHelperAdmission','outputBytesAcceptance',
             'authenticatedFinalSummary','partialShutdownRejection','ownedInterruptionContract','scopedEvidenceAggregation',
             'browserBoundedStreamingHash','largeArtifactLifecycle','ownedBoundedAuditChain','privateFinalAcknowledgementContract'),
        'B':('approvedRuntimeAssets','approvedMLModels','realBackendLinkage','durableBackendAdapters','approvedPrivateFinalDeliveryAdapter','approvedTrustAnchors'),
        'C':('storagePolicy','distributionPolicy','signingNotarizationPKI','licenses','retentionGC'),
        'D':('intelMac','appleSilicon','iPadSafari','gatekeeper','realMLPerformance','sixNoteAccuracy','logicKeystation'),
        'E':('internalNativeKernelIdentity','authenticatedRuntimeLoaderEdges','hiddenTransientNativeLoads',
             'completeNativeNetworkSyscallContainment','ownedDescendantLiveHandleProvider')}
    rows=[]
    for category, requirements in categories.items():
        for requirement in requirements:
            rows.append({'category':category,'requirement':requirement,
                'satisfied':evidence.get(requirement) is True})
    blocked=[row['requirement'] for row in rows if row['category']=='A' and not row['satisfied']]
    return {'format':'NOVA_STAGE2_SOFTWARE_CLOSURE','version':1,'requirements':rows,
        'repositorySoftwareComplete':not blocked,'pureSoftwareBlockedBy':blocked,
        'stage2':'OPEN','stage3Gate':'NOT_PASSED','formalA':0,
        'runtimeEligibilityAuthority':False}


def bounded_owned_shutdown(child, *, timeout=3, interruption=None, owner=None):
    """Never send a PID/group signal without a separately proven live-handle adapter.

    Default is bounded wait only. A PID, Popen instance, group ID or past health
    does not prove safe termination of descendants after leader exit/PID reuse.
    An external adapter must validate opaque ownership at operation time and return
    the matching owner receipt. No OS signal implementation is supplied here.
    """
    if not 0 < timeout <= 3: raise ValueError('shutdown-budget')
    receipt = {'scope':'EXPLICIT_OWNED_HANDLE_ONLY','graceful':'UNVERIFIED',
        'hardInterruption':'UNVERIFIED','ownershipReleased':False,'complete':False}
    if child is None: return {**receipt,'ownershipReleased':True,'complete':True}
    if child.poll() is None:
        try: child.wait(timeout=timeout)
        except subprocess.TimeoutExpired: pass
    if child.poll() is None and interruption is not None:
        if not _token(owner): raise ValueError('missing-interruption-owner')
        # The adapter, not this contract, owns live-handle verification and signaling.
        proof = interruption(child, owner, timeout)
        if (not isinstance(proof,dict) or proof.get('owner') != owner or proof.get('liveHandleVerified') is not True or
                proof.get('ownedChildrenComplete') is not True or proof.get('stopped') is not True):
            raise ValueError('unverified-hard-interruption')
        receipt['hardInterruption'] = 'OBSERVED'
    # Leader reaping alone cannot establish descendant shutdown.
    receipt['leaderExited'] = child.poll() is not None
    receipt['reason'] = 'owned-descendant-live-handle-adapter-unavailable'
    return receipt


class LocalEnvelopeServer:
    """Explicit loopback transport adapter; never starts from legacy/strict main.

    Caller supplies already verified immutable web assets and anchored envelope.
    Binding is numeric loopback only. Session expires and consumes its envelope
    once; retry requires a new instance, port, nonce and session. No user files,
    directory listing, remote fetch, fallback or request logging.
    """
    def __init__(self, assets, envelope, *, expected_assets, expected_binding, host='127.0.0.1', port=0, ttl=60):
        if host != '127.0.0.1' or type(port) is not int or not 0 <= port <= 65535:
            raise ValueError('external-or-invalid-local-bind')
        if type(ttl) is not int or not 1 <= ttl <= 300:
            raise ValueError('invalid-envelope-lifetime')
        if not assets or len(assets) > 512:
            raise ValueError('invalid-web-assets')
        self.assets = {}
        if set(assets) != set(expected_assets) or sum(len(v) for v in assets.values()) > 32*1024*1024:
            raise ValueError('web-asset-inventory-mismatch')
        for path, value in assets.items():
            if (not isinstance(path, str) or not path.startswith('/') or
                    any(c in path for c in ('..', '?', '#', '%', '\\')) or
                    path in ('/bootstrap-envelope','/owned-control','/owned-helper-result','/owned-helper-admit','/lifecycle') or not isinstance(value, bytes) or
                    len(value) > 4*1024*1024):
                raise ValueError('unsafe-web-asset')
            if hashlib.sha256(value).hexdigest() != expected_assets[path]:
                raise ValueError('wrong-web-asset-digest')
            self.assets[path] = value
        # Detached bounded JSON snapshot, not references mutable by the caller.
        raw = json.dumps(envelope, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
        if len(raw) > 1024*1024:
            raise ValueError('envelope-budget')
        self.envelope = json.loads(raw)
        self.binding = envelope_binding(self.envelope, expected_binding)
        self.nonce = secrets.token_hex(32)
        self.session = secrets.token_hex(32)
        self.ttl = ttl
        self.deadline = time.monotonic() + ttl
        self.expires_at = int(time.time()*1000) + ttl*1000
        self.on_lifecycle = None
        self.on_control = None
        self.consumed = False
        self.closed = False
        self.lock = threading.Lock()
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def setup(self):
                super().setup()
                self.connection.settimeout(2)
            def log_message(self, *args): pass
            def do_GET(self):
                if self.headers.get('Host') != owner.origin.removeprefix('http://'):
                    self.send_error(403); return
                if self.path == '/bootstrap-envelope':
                    self.send_error(405); return
                from urllib.parse import urlsplit
                data = owner.assets.get(urlsplit(self.path).path)
                if data is None:
                    self.send_error(404); return
                self.send_response(200)
                suffix = Path(self.path).suffix
                self.send_header('Content-Type', {'.html':'text/html; charset=utf-8',
                    '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
                    '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml',
                    '.woff2':'font/woff2'}.get(suffix, 'application/octet-stream'))
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' http://127.0.0.1:8766; object-src 'none'; base-uri 'none'; frame-src 'none'")
                self.end_headers(); self.wfile.write(data)
            def do_POST(self):
                if self.path in ('/owned-control', '/owned-helper-result', '/owned-helper-admit'):
                    self.control(); return
                if self.path == '/lifecycle':
                    self.lifecycle(); return
                if (self.path != '/bootstrap-envelope' or
                        self.headers.get('Host') != owner.origin.removeprefix('http://') or
                        self.headers.get('Origin') != owner.origin or
                        self.headers.get('Content-Length') != '0'):
                    self.send_error(403); return
                with owner.lock:
                    if (owner.closed or owner.consumed or time.monotonic() >= owner.deadline or
                            self.headers.get('X-Nova-Session') != owner.session or
                            self.headers.get('X-Nova-Nonce') != owner.nonce):
                        self.send_error(403); return
                    owner.consumed = True
                    data = json.dumps({'version': 1, 'origin': owner.origin,
                        'format': 'NOVA_LOCAL_BROWSER_ENVELOPE',
                        'expiresAt': owner.expires_at,
                        'session': owner.session, 'nonce': owner.nonce,
                        'binding': owner.binding, 'envelope': owner.envelope},
                        sort_keys=True, separators=(',', ':')).encode()
                self.send_response(200); self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
            def control(self):
                try:
                    if (self.headers.get('Host') != owner.origin[7:] or self.headers.get('Origin') is not None or
                            self.headers.get('Transfer-Encoding') is not None or owner.closed or owner.on_control is None):
                        raise ValueError('invalid-private-control-transport')
                    length = int(self.headers.get('Content-Length','-1'))
                    if not 0 < length <= 1024*1024: raise ValueError('control-budget')
                    raw = self.rfile.read(length)
                    if len(raw) != length: raise ValueError('truncated-control')
                    value = json.loads(raw)
                    result = owner.on_control(self.path, value)
                    data = json.dumps(result,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
                    if len(data)>16384: raise ValueError('owned-response-budget')
                    self.send_response(200); self.send_header('Content-Type','application/json')
                    self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(data)))
                    self.end_headers(); self.wfile.write(data)
                except (ValueError, TypeError, KeyError, OSError): self.send_error(403)
            def lifecycle(self):
                try:
                    length = int(self.headers.get('Content-Length', '-1'))
                    if (not 0 < length <= 4096 or self.headers.get('Host') != owner.origin[7:] or
                            self.headers.get('Origin') != owner.origin or owner.closed or not owner.consumed or time.monotonic() >= owner.deadline):
                        raise ValueError('wrong-lifecycle-transport')
                    value = json.loads(self.rfile.read(length))
                    if (value.get('session') != owner.session or value.get('nonce') != owner.nonce or
                            value.get('state') not in ('BROWSER_READY', 'IDENTITY_VERIFIED', 'FAILED', 'STOPPED')):
                        raise ValueError('wrong-lifecycle-session')
                    if owner.on_lifecycle is None: raise ValueError('missing-lifecycle-owner')
                    owner.on_lifecycle(value['state'])
                    self.send_response(204); self.send_header('Content-Length', '0'); self.end_headers()
                except (ValueError, TypeError, OSError): self.send_error(403)
        self.server = ThreadingHTTPServer((host, port), Handler)
        # Slow/in-flight handlers cannot make transport shutdown wait forever.
        self.server.daemon_threads = True
        self.server.block_on_close = False
        self.origin = 'http://127.0.0.1:' + str(self.server.server_port)
        self.thread = None

    def start(self):
        if self.closed or self.thread is not None:
            raise ValueError('stale-or-started-local-server')
        if time.monotonic() >= self.deadline: raise ValueError('expired-local-server')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        try:
            self.thread.start()
        except BaseException:
            self.server.server_close(); self.closed = True
            raise
        return {'localOnly': True, 'origin': self.origin, 'session': self.session,
                'nonce': self.nonce, 'envelopeDigest': hashlib.sha256(json.dumps(
                    self.envelope, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}

    def close(self):
        if self.closed: return
        self.closed = True
        self.nonce = ''; self.session = ''; self.envelope = {}
        if self.thread is not None:
            self.server.shutdown(); self.thread.join(timeout=2)
        self.server.server_close()


def prepare(root, manifest, anchor, build, pipeline=None):
    pipeline = Path(pipeline or Path(__file__).parent).resolve()
    authenticated = load_manifest(manifest, anchor, build)
    verifier_source = next((e for e in authenticated['assets'] if e['id']=='artifact-verification-source'), None)
    if verifier_source is None:
        raise ValueError('missing-authenticated-verifier-source')
    verify_local_asset(pipeline, 'artifact_verification.py', verifier_source, 1024*1024)
    from artifact_verification import VERIFIER
    runtime = bootstrap(manifest, anchor, build, root)
    from runtime_inventory import stable, local
    source_stamps = {}
    source_assets = {}
    for identity, relative in SOURCES.items():
        expected = dict(runtime.expected('assets', identity))
        path = local(pipeline, relative)
        before = stable(path)
        VERIFIER.verify(pipeline, relative, expected, 1024*1024,
                        identity=identity, version=expected['revision'], build=build)
        if stable(path) != before:
            raise ValueError('launcher-source-changed')
        source_stamps[relative] = before
        source_assets[identity] = expected
    if runtime.manifest['helper']['sourceDigest'] != runtime.expected('assets', 'helper-source')['digest']:
        raise ValueError('launcher-helper-source-mismatch')
    graph = load_contract(runtime.root, runtime.manifest)
    distribution = private_distribution_lookup(runtime.root, graph)
    artifact_report = verify_assembly(runtime.root, graph, distribution, runtime=runtime)
    if not artifact_report['complete']:
        raise ValueError('launcher-artifact-assembly-incomplete')
    from runtime_evidence import load as load_evidence, assembly_evidence
    evidence = load_evidence(runtime)
    if evidence['buildRevision'] != build:
        raise ValueError('launcher-evidence-build-mismatch')
    command = private_python_command(runtime, graph, pipeline/'server.py')
    if runtime.resolve_executable('python-runtime', sys.executable) != command[0]:
        raise ValueError('foreign-launcher-private-python')
    runtime.recheck()
    def source_preflight():
        # Reuse existing authenticated asset identities at the actual spawn boundary.
        # This proves disk-file continuity only, never installed trust or mapped memory.
        for identity, relative in SOURCES.items():
            path = local(pipeline, relative)
            if stable(path) != source_stamps[relative]:
                raise ValueError('launcher-source-changed')
            expected = source_assets[identity]
            VERIFIER.verify(pipeline, relative, expected, 1024*1024,
                            identity=identity, version=expected['revision'], build=build)
            if stable(path) != source_stamps[relative]:
                raise ValueError('launcher-source-changed')
        if private_python_command(runtime, graph, pipeline/'server.py') != command:
            raise ValueError('launcher-runtime-changed')
        if not verify_assembly(runtime.root, graph, distribution, runtime=runtime)['complete']:
            raise ValueError('launcher-artifact-assembly-changed')
        runtime.recheck()
    def owned_process_loader():
        # Execute only the authenticated source snapshot, not import-cache/PATH content.
        expected=source_assets['demucs-receipt-source']
        path=local(pipeline,'demucs_receipt.py')
        if stable(path)!=source_stamps['demucs_receipt.py']:
            raise ValueError('launcher-owned-source-changed')
        with path.open('rb') as handle:raw=handle.read(1024*1024+1)
        if (len(raw)>1024*1024 or len(raw)!=expected['byteLength'] or
                hashlib.sha256(raw).hexdigest()!=expected['digest'] or
                stable(path)!=source_stamps['demucs_receipt.py']):
            raise ValueError('launcher-owned-source-changed')
        namespace={'__name__':'nova_authenticated_owned_process','__file__':str(path)}
        exec(compile(raw,str(path),'exec'),namespace)
        return namespace['OwnedStopPipe'],namespace['OwnedExitObservation']
    # Strict Helper boot will independently authenticate and refuse incomplete runtime evidence.
    environment = {k: v for k, v in os.environ.items() if not k.startswith(('PYTHON', 'NOVA_', 'DYLD_', 'LD_'))}
    environment.update(NOVA_TRUSTED_MANIFEST_PATH=str(Path(manifest).resolve()),
                       NOVA_TRUSTED_MANIFEST_DIGEST=anchor,
                       NOVA_EXPECTED_BUILD_REVISION=build,
                       NOVA_RUNTIME_ASSET_ROOT=str(runtime.root), PYTHONUNBUFFERED='1')
    def native_host(executable_path):
        # Existing anchored native slot and image CPU validation, no PATH guess.
        native_executable = runtime.resolve_executable('native-wrapper', executable_path)
        def launch(handoff, descriptor):
            native_environment = dict(environment)
            native_environment.update(NOVA_STRICT_OFFLINE='1',
                NOVA_LOCAL_HANDOFF=json.dumps(handoff,sort_keys=True,separators=(',',':')),
                NOVA_OWNED_SUMMARY_FD=str(descriptor))
            source_preflight()
            if runtime.resolve_executable('native-wrapper',executable_path) != native_executable:
                raise ValueError('launcher-native-wrapper-changed')
            runtime.recheck()
            return subprocess.Popen([native_executable],env=native_environment,
                pass_fds=(descriptor,),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,start_new_session=True)
        return OwnedNativeSummaryDelivery(launch)
    def activate_runtime():
        source_preflight()
        return private_runtime_preflight(runtime, graph, pipeline, configure_path=True)
    def launch_origin_identity():
        runtime.recheck()
        if runtime.private_python is None:raise ValueError('missing-launcher-private-origin')
        origin=runtime.private_python.get('processOrigin',{})
        if origin.get('status')!='PARTIAL' or origin.get('approvedPathMatched') is not True:
            raise ValueError('unverified-launcher-private-origin')
        return json.loads(json.dumps(runtime.private_python))
    return {'command': command,
            '_runtime_activation': activate_runtime,
            '_source_preflight': source_preflight, '_owned_process_loader': owned_process_loader,
            '_launch_origin_identity': launch_origin_identity,
            '_native_host': native_host,
            'environment': environment,
            'browserEnvelope': {'manifest': runtime.manifest, 'trust': {'manifestDigest': anchor, 'buildRevision': build},
                                'runtimeConfigText': json.dumps(runtime.bindings, sort_keys=True, separators=(',', ':'), ensure_ascii=False)},
            'assembly': artifact_report, 'runtimeAssembly': assembly_evidence(runtime),
            'publicationEligible': False}


def strict_eligibility(inventory, *, trusted_bootstrap, browser_verified, backend_bound=False, fresh_session=None, private_lifecycle=None):
    evidence = inventory.get('runtimeEvidence', {})
    checks = {
        'trustedBootstrap': trusted_bootstrap is True,
        'browserVerified': browser_verified is True,
        'identityComplete': inventory.get('identityComplete') is True,
        'inventoryComplete': inventory.get('complete') is True and inventory.get('mode') == 'STRICT' and inventory.get('status') == 'VERIFIED',
        'codecComplete': evidence.get('processingChain', {}).get('complete') is True,
        'nativeClosureComplete': evidence.get('dynamicNativeGraph', {}).get('complete') is True,
        'offlineComplete': evidence.get('network', {}).get('nativeNetworkVerified') is True and evidence.get('network', {}).get('native') == 'CONTAINED',
    }
    if fresh_session is not None or inventory.get('processingReceiptVersion') == 1:
        checks['freshOwnedSession'] = fresh_session is True
        checks['mappedNativeIdentity'] = evidence.get('mappedNative', {}).get('complete') is True
        checks['processingChainComplete'] = inventory.get('processingChainComplete') is True
    loads = evidence.get('scopedNativeLoads')
    if loads is not None:
        checks['scopedNativeLoadCoverage'] = (loads.get('complete') is True and
            loads.get('unexpected') == [] and loads.get('unresolved') == [] and loads.get('ambiguous') == [])
    if private_lifecycle is not None:
        checks['privateLifecycleDelivery'] = private_lifecycle is True
    eligible = all(checks.values())
    return {'processingEligible': eligible, 'publicationEligible': eligible and backend_bound is True,
            'blockedBy': [key for key, value in checks.items() if not value]}


class OwnedNativeSummaryDelivery:
    """Creator-owned anonymous native channel. Existing summary/ack are its authority.

    The externally supplied native launcher must use pass_fds and its own anchored
    executable preflight. This adapter never selects an executable or distribution.
    """
    def __init__(self, launch):
        self.launch = launch; self.handle = None; self.child = None
        self.used = False; self.started = False; self.identity = None; self.lock = threading.Lock()

    def __call__(self, handoff):
        with self.lock:
            if self.started or self.used: raise ValueError('native-summary-replay')
            self.started = True
        parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            self.child = self.launch(handoff, child.fileno())
            if not isinstance(self.child, subprocess.Popen) or self.child.poll() is not None:
                raise ValueError('native-summary-owned-child-required')
            self.handle = parent; self.identity = os.fstat(parent.fileno())
            return True
        except BaseException:
            parent.close(); self.used = True; raise
        finally: child.close()

    def deliver_final(self, envelope):
        with self.lock:
            if self.used or self.handle is None: raise ValueError('native-summary-missing-or-replay')
            self.used = True
            try:
                current = os.fstat(self.handle.fileno())
                if (current.st_dev, current.st_ino, current.st_mode) != (self.identity.st_dev, self.identity.st_ino, self.identity.st_mode):
                    raise ValueError('native-summary-descriptor-identity')
                if self.child.poll() is not None: raise ValueError('native-summary-child-exited')
                deadline = time.monotonic() + 2.5
                raw = json.dumps(envelope,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
                if not 0 < len(raw) <= 16384: raise ValueError('native-summary-budget')
                self.handle.settimeout(max(.001,deadline-time.monotonic()))
                self.handle.sendall(len(raw).to_bytes(4,'big')+raw)
                def read(count):
                    value = bytearray()
                    while len(value) < count:
                        remaining = deadline-time.monotonic()
                        if remaining <= 0: raise ValueError('native-summary-deadline')
                        self.handle.settimeout(remaining)
                        chunk = self.handle.recv(count-len(value))
                        if not chunk: raise ValueError('native-summary-eof')
                        value.extend(chunk)
                    return bytes(value)
                count = int.from_bytes(read(4),'big')
                if not 0 < count <= 16384: raise ValueError('native-ack-budget')
                return json.loads(read(count))
            finally:
                self.handle.close(); self.handle = None


class LocalProductionLifecycle:
    """Owns only a newly created child/group and one bounded loopback session.

    No old Helper is reused. Browser reporting cannot replace Helper inventory.
    Browser close is best effort; heartbeat expiry also tears down owned resources.
    A retry must instantiate a new lifecycle, never resurrect this instance.
    """
    def __init__(self, prepared, assets, expected_assets, *, popen=subprocess.Popen,
                 health=None, browser=None, native_host=None, final_sink=None, timeout=30):
        if isinstance(native_host, OwnedNativeSummaryDelivery) and final_sink is not None:
            raise ValueError('duplicate-private-final-sink')
        self.prepared = prepared
        envelope = prepared['browserEnvelope']
        manifest = envelope['manifest']
        binding = {'buildRevision': manifest['buildRevision'],
            'manifestDigest': envelope['trust']['manifestDigest'],
            'runtimeConfigDigest': hashlib.sha256(envelope['runtimeConfigText'].encode()).hexdigest(),
            'helperIdentityDigest': hashlib.sha256(json.dumps(manifest['helper'], sort_keys=True,
                separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()}
        self.server = LocalEnvelopeServer(assets, envelope, expected_assets=expected_assets, expected_binding=binding)
        self.server.on_lifecycle = self.browser_event
        self.server.on_control = self.control_event
        self.control = OwnedResultChannel(self.server.session, self.server.deadline, continuity=self.verify_processing_continuity)
        self.shutdown_receipt = None; self.final_receipt = None; self.final_acknowledgement = None; self.final_sink = final_sink; self.close_lock = threading.Lock()
        if isinstance(native_host, OwnedNativeSummaryDelivery):
            self.final_sink = native_host.deliver_final
        self.state = 'PREPARING'; self.child = None; self.popen = popen
        self.stop_pipe=None;self.child_stop_socket=None
        self.health = health or self.read_health; self.browser = browser; self.native_host = native_host
        self.timeout = timeout; self.inventory = {}; self.browser_verified = False
        self.last_seen = time.monotonic(); self.done = threading.Event()
        self.lock = threading.RLock(); self.started = False; self.closing = False
        self.eligibility = strict_eligibility({}, trusted_bootstrap=False, browser_verified=False)

    def read_health(self):
        connection = http.client.HTTPConnection('127.0.0.1', 8766, timeout=1)
        try:
            connection.request('GET', '/health')
            response = connection.getresponse()
            raw = response.read(1024*1024+1)
            if response.status != 200 or len(raw) > 1024*1024: raise ValueError('helper-health-budget')
            return json.loads(raw)
        finally: connection.close()

    def verify_health(self, health):
        self.verify_owned_continuity()
        if (health.get('host') != '127.0.0.1' or health.get('port') != 8766 or
                health.get('localOnly') is not True or health.get('lifecycleSession') != self.server.session):
            raise ValueError('stale-or-wrong-helper')
        expected = self.prepared['browserEnvelope']['manifest']['helper']
        actual = health.get('runtimeIdentity', {})
        for key, value in expected.items():
            candidate = health.get(key) if key in ('version', 'pipelineRevision', 'sourceDigest') else actual.get(key)
            if type(candidate) != type(value) or candidate != value: raise ValueError('helper-identity-mismatch')
        inventory = actual.get('actualInventory', {})
        if inventory.get('mode') != 'STRICT' or inventory.get('identityComplete') is not True:
            raise ValueError('helper-actual-identity-incomplete')
        if (hasattr(self,'expected_child_private') and
                inventory.get('privatePython')!=self.expected_child_private):
            raise ValueError('changed-or-foreign-helper-private-origin')
        self.inventory = inventory

    def verify_owned_continuity(self):
        # Retained creator object + private lifecycle binding, never PID authority.
        # Liveness is bounded observation, not kernel executable attestation.
        if not hasattr(self, '_origin_owned_child'): return
        identity = {'session': self.control.session, 'owner': self.control.owner,
            'generation': _digest(self.server.binding), 'deadline': self.server.deadline}
        if (self.child is not self._origin_owned_child or
                not isinstance(self.child, subprocess.Popen) or
                identity != self._origin_owned_identity or
                self.server.session != identity['session'] or self.stop_pipe is None or
                self.stop_pipe.identity != identity or
                (hasattr(self, '_origin_owned_pipe') and
                 (self.stop_pipe is not self._origin_owned_pipe or
                  self.stop_pipe.handle is not self._origin_owned_handle or
                  self.stop_pipe.closed or self.stop_pipe.handle.fileno() < 0 or
                  self.exit_observer.closed or
                  self.exit_observer.observe(self.child,self.control.binding)['ownedPipeIdentityStatus'] != 'OBSERVED')) or
                self.child.poll() is not None):
            self.inventory = {}
            self.eligibility = strict_eligibility({}, trusted_bootstrap=False, browser_verified=False)
            raise ValueError('changed-or-dead-owned-helper')

    def verified_owned_health(self):
        self.verify_owned_continuity()
        preflight = self.prepared.get('_source_preflight')
        try:
            if preflight is not None: preflight()
            health = self.health()
            if preflight is not None: preflight()
            self.verify_health(health)
        except (ValueError, OSError):
            self.inventory = {}
            self.eligibility = strict_eligibility({}, trusted_bootstrap=False, browser_verified=False)
            raise

    def verify_processing_continuity(self):
        self.verify_owned_continuity()
        if '_source_preflight' not in self.prepared: return
        self.verified_owned_health()
        binding=self.control.binding
        if binding is not None:
            from runtime_evidence import processing_binding
            current=processing_binding(self.control.session,binding['request'],binding['input'],self.inventory)
            if current != binding:
                self.inventory={}
                self.eligibility=strict_eligibility({},trusted_bootstrap=False,browser_verified=False)
                raise ValueError('changed-publication-processing-inventory')

    def start(self):
        if self.started or self.state != 'PREPARING': raise ValueError('stale-lifecycle-retry')
        self.started = True
        try:
            environment = dict(self.prepared['environment'])
            environment.update(NOVA_LIFECYCLE_SESSION=self.server.session, NOVA_LOCAL_BROWSER_ORIGIN=self.server.origin,
                NOVA_LIFECYCLE_DEADLINE=str(self.server.deadline),
                NOVA_OWNED_RESULT_ORIGIN=self.server.origin, NOVA_OWNED_RESULT_CAPABILITY=self.control.helper_capability)
            loader=self.prepared.get('_owned_process_loader')
            if loader is not None:
                OwnedStopPipe,OwnedExitObservation=loader()
            else:
                # Injected disposable lifecycle fixtures have no production prepare/anchor.
                from demucs_receipt import OwnedStopPipe,OwnedExitObservation
            parent_socket,self.child_stop_socket=socket.socketpair(socket.AF_UNIX,socket.SOCK_STREAM)
            identity={'session':self.control.session,'owner':self.control.owner,
                'generation':_digest(self.server.binding),'deadline':self.server.deadline}
            try:self.stop_pipe=OwnedStopPipe(parent_socket,identity,self.control.helper_capability)
            except BaseException:parent_socket.close();raise
            environment.update(NOVA_OWNED_STOP_FD=str(self.child_stop_socket.fileno()),
                NOVA_OWNED_STOP_IDENTITY=json.dumps(identity,sort_keys=True,separators=(',',':')))
            origin_identity=self.prepared.get('_launch_origin_identity')
            if origin_identity is not None:
                expected_origin=origin_identity()
                environment['NOVA_OWNED_ORIGIN_REQUIRED']='1'
            if '_source_preflight' in self.prepared:
                self.prepared['_source_preflight']()
            self.child = self.popen(self.prepared['command'], env=environment, start_new_session=True,
                                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                    pass_fds=(self.child_stop_socket.fileno(),))
            self.child_stop_socket.close();self.child_stop_socket=None
            self.exit_observer = OwnedExitObservation(self.child,self.server.session,self.server.binding,owned_channel=self.stop_pipe.handle)
            if '_source_preflight' in self.prepared:
                # Disk continuity after Popen, before health/browser admission;
                # not kernel image integrity or parent-authenticated origin.
                self.prepared['_source_preflight']()
            if origin_identity is not None:
                self._origin_owned_child = self.child
                self._origin_owned_pipe = self.stop_pipe
                self._origin_owned_handle = self.stop_pipe.handle
                self._origin_owned_identity = dict(identity)
                self.verify_owned_continuity()
                if not isinstance(self.child,subprocess.Popen) or self.child.poll() is not None:
                    raise ValueError('unowned-private-origin-child')
                if origin_identity()!=expected_origin:raise ValueError('changed-parent-launch-origin')
                self.launch_origin_binding=self.stop_pipe.request_origin(expected_origin)
                self.verify_owned_continuity()
                self.prepared['_source_preflight']()
                if origin_identity()!=expected_origin:raise ValueError('changed-parent-launch-origin')
                self.expected_child_private={**expected_origin,'parentLaunchEvidence':self.launch_origin_binding}
            deadline = time.monotonic()+self.timeout
            while True:
                if self.child.poll() is not None: raise ValueError('helper-startup-failed')
                try: self.verified_owned_health(); break
                except (OSError, http.client.HTTPException):
                    if time.monotonic() >= deadline: raise ValueError('helper-startup-timeout')
                    self.done.wait(0.05)
            self.state = 'HELPER_READY'
            self.server.start(); self.state = 'SERVER_READY'
            from urllib.parse import urlencode
            handoff = {**self.server.binding, 'version': 1, 'format': 'NOVA_LOCAL_BROWSER_HANDOFF',
                'origin': self.server.origin, 'nonce': self.server.nonce, 'session': self.server.session,
                'expiresAt': self.server.expires_at}
            self.handoff = handoff
            # Explicit private launcher adapter only: never put this token in a URL or JS envelope.
            self.swift_handoff = {**handoff, 'ownedControl': self.control.handoff()}
            url = self.server.origin+'/music-studio.html#nova-local='+urlencode({'handoff':json.dumps(handoff,separators=(',',':'))})
            if self.native_host is not None:
                if self.native_host(json.loads(json.dumps(self.swift_handoff))) is False:
                    raise ValueError('native-host-startup-failed')
            elif self.browser is None or self.browser(url) is False: raise ValueError('browser-startup-failed')
            self.last_seen = time.monotonic()
            return {'state': self.state, 'handoff': handoff, 'startURL': url, **self.eligibility}
        except BaseException:
            self.close(failed=True); raise

    def browser_event(self, state):
        with self.lock:
            if self.state in ('FAILED','STOPPED'): raise ValueError('stale-browser-receipt')
            self.last_seen = time.monotonic()
            if state in ('FAILED','STOPPED'):
                # Handler thread cannot synchronously shut down its own server.
                self.state = state; self.eligibility = strict_eligibility({}, trusted_bootstrap=False, browser_verified=False)
                self.done.set(); return
            if self.state not in ('SERVER_READY','BROWSER_READY','IDENTITY_VERIFIED','PROCESSING_ELIGIBLE'):
                raise ValueError('out-of-order-browser-receipt')
            if state == 'IDENTITY_VERIFIED':
                if self.state == 'SERVER_READY': raise ValueError('missing-browser-ready')
                self.verified_owned_health(); self.browser_verified = True
                self.eligibility = strict_eligibility(self.inventory, trusted_bootstrap=True, browser_verified=True,
                    private_lifecycle=self.private_delivery_ready(),
                    fresh_session=self.child is not None and self.child.poll() is None and time.monotonic() < self.server.deadline)
                self.state = 'PROCESSING_ELIGIBLE' if self.eligibility['processingEligible'] else 'IDENTITY_VERIFIED'
            elif self.state == 'SERVER_READY': self.state = 'BROWSER_READY'

    def private_delivery_ready(self):
        if '_source_preflight' not in self.prepared: return None
        return (isinstance(self.native_host, OwnedNativeSummaryDelivery) and self.native_host.handle is not None
            and not self.native_host.used and self.native_host.child is not None
            and self.native_host.child.poll() is None and self.stop_pipe is not None)

    def control_event(self, route, value):
        with self.lock:
            if self.closing: raise ValueError('closed-helper-admission')
            if self.child is None or self.child.poll() is not None:
                self.state = 'FAILED'; self.control.close(failed=True); self.done.set()
                raise ValueError('unexpected-helper-termination')
            if route in ('/owned-helper-result','/owned-helper-admit'):
                self.verified_owned_health()
                eligibility = strict_eligibility(self.inventory, trusted_bootstrap=True,
                    private_lifecycle=self.private_delivery_ready(),
                    browser_verified=self.browser_verified, fresh_session=time.monotonic() < self.server.deadline)
                if not eligibility['processingEligible']: raise ValueError('ineligible-helper-result')
                if route == '/owned-helper-admit': return self.control.admit(value,self.inventory)
                self.control.publish(value,self.inventory)
                return {'ok':True}
            if route != '/owned-control': raise ValueError('wrong-owned-control-route')
            self.verified_owned_health()
            eligibility = strict_eligibility(self.inventory,trusted_bootstrap=True,
                private_lifecycle=self.private_delivery_ready(),
                browser_verified=self.browser_verified,fresh_session=time.monotonic() < self.server.deadline)
            if value.get('action') == 'begin': raise ValueError('explicit-processing-authorization-required')
            response = self.control.command(value,inventory=self.inventory,
                eligible=eligibility['processingEligible'],helper_alive=True)
            self.last_seen = time.monotonic()
            if response['state'] == 'STOPPING':
                self.eligibility = strict_eligibility({},trusted_bootstrap=False,browser_verified=False)
                self.done.set()
            return response

    def supervise(self):
        try:
            while not self.done.wait(0.25):
                try: self.verify_owned_continuity()
                except ValueError:
                    self.state = 'FAILED'; break
                if (self.child.poll() is not None or time.monotonic()-self.last_seen > 30 or
                        time.monotonic() >= self.server.deadline):
                    self.state = 'FAILED'; break
        finally: self.close(failed=self.state == 'FAILED')

    def request_helper_stop(self):
        # The retained socket is the exact creator-owned delivery channel. No HTTP retry.
        if self.stop_pipe is None or not isinstance(self.child,subprocess.Popen):
            return {'status':'UNVERIFIED','state':'STOP_NOT_CONFIRMED'}
        try:return self.stop_pipe.request(self.control.binding)
        except (OSError,ValueError,TypeError):
            return {'status':'UNVERIFIED','state':'STOP_NOT_CONFIRMED'}

    def close(self, *, failed=False):
        with self.close_lock:
            if self.final_receipt is not None: return
            preflight = self.prepared.get('_source_preflight')
            if preflight is not None:
                try: preflight()
                except (OSError, ValueError, TypeError): failed = True
            with self.lock:
                self.closing = True
            self.done.set(); self.browser_verified = False; self.inventory = {}
            self.eligibility = strict_eligibility({}, trusted_bootstrap=False, browser_verified=False)
            observer=getattr(self,'exit_observer',None)
            retained = getattr(self, '_origin_owned_child', None)
            if retained is not None and self.child is not retained:
                # Never route shutdown through a replacement Popen object.
                self.child = retained; failed = True
            stop_allowed = True
            try: self.verify_owned_continuity()
            except (OSError, ValueError, TypeError): failed = True; stop_allowed = False
            if observer is not None and self.child is not None:
                try:
                    observer.bind_request(self.child,self.control.binding)
                    observer.request_stop(self.child,self.control.binding,{'owner':self.control.owner,
                        'generation':self.control.renewals,'state':self.control.state})
                except (OSError, ValueError, TypeError): failed = True; stop_allowed = False
            stop = {'status':'UNVERIFIED','state':'STOP_NOT_CONFIRMED'}
            if stop_allowed and self.child is not None and self.child.poll() is None:
                stop = self.request_helper_stop()
            self.graceful_stop_receipt = stop
            self.shutdown_receipt = bounded_owned_shutdown(self.child)
            # The buffered final frame is sent after Helper child cleanup. A retained
            # channel authenticates its report; only our observer proves Helper exit.
            descendant_delivery={'status':'UNVERIFIED','scope':'OWNED_INHERITED_DESCRIPTOR'}
            if stop.get('status')=='OBSERVED' and self.stop_pipe is not None:
                try:descendant_delivery=self.stop_pipe.receive_final()
                except (OSError,ValueError,TypeError):pass
            self.shutdown_receipt['helperChildShutdownDelivery']=descendant_delivery
            if self.child is not None:
                self.shutdown_receipt['leaderExited']=self.child.poll() is not None
            observer=getattr(self,'exit_observer',None)
            if observer is not None and self.child is not None:
                try:
                    self.shutdown_receipt['ownedExitObservation']=observer.observe(self.child,self.control.binding)
                except (OSError, ValueError, TypeError): failed = True
                if self.shutdown_receipt.get('leaderExited') is True:
                    observer.close()
                    if 'ownedExitObservation' in self.shutdown_receipt:
                        self.shutdown_receipt['ownedExitObservation']['descriptorClosed']=True
            if self.stop_pipe is not None:self.stop_pipe.close()
            if self.child_stop_socket is not None:self.child_stop_socket.close();self.child_stop_socket=None
            self.server.close()
            transport_closed = (self.server.server.socket.fileno() == -1 and
                (self.server.thread is None or not self.server.thread.is_alive()))
            if self.child is not None and self.child.poll() is not None: self.child = None
            if self.child is not None: failed = True
            # Cleanup must continue after identity failure, but its final summary
            # must never promote stale package/runtime evidence to COMPLETE.
            if preflight is not None:
                try: preflight()
                except (OSError, ValueError, TypeError): failed = True
            self.final_receipt = final_lifecycle_receipt(self.control,stop,self.shutdown_receipt,transport_closed,failed=failed)
            self.shutdown_state = self.final_receipt['payload']['completionState']
            self.state = 'FAILED' if failed else 'STOPPED'
            # Explicit private owner sink, never a browser route or a reopened transport.
            try:
                if self.final_sink is not None:
                    acknowledgement = self.final_sink(json.loads(json.dumps(self.final_receipt)))
                    if acknowledgement is not None:
                        self.final_acknowledgement = acknowledge_final_lifecycle(self.control,acknowledgement)
                        if self.final_acknowledgement['complete']:
                            self.state = 'CLOSED'
            except (OSError, ValueError, TypeError):
                self.shutdown_state = 'PARTIAL'; self.state = 'FAILED'
            finally:
                self.control.ack_key = ''


def main():
    lifecycle = None
    try:
        root = os.environ['NOVA_RUNTIME_ASSET_ROOT']
        result = prepare(root, os.environ['NOVA_TRUSTED_MANIFEST_PATH'],
                         os.environ['NOVA_TRUSTED_MANIFEST_DIGEST'], os.environ['NOVA_EXPECTED_BUILD_REVISION'])
        result['_runtime_activation']()
        # Explicit externally approved web assets only. No recursive scan or guessed asset set.
        assets = {}; expected = {}
        for entry in result['browserEnvelope']['manifest']['assets']:
            if entry['id'].startswith('web:/'):
                route = entry['id'][4:]
                relative = route.lstrip('/')
                verify_local_asset(root, relative, entry, 4*1024*1024)
                data = Path(root, relative).read_bytes()
                if len(data) != entry['byteLength'] or hashlib.sha256(data).hexdigest() != entry['digest']:
                    raise ValueError('stale-web-asset')
                assets[route] = data; expected[route] = entry['digest']
        if '/music-studio.html' not in assets: raise ValueError('missing-approved-web-entry')
        native_host = None
        if os.environ.get('NOVA_NATIVE_WRAPPER_PATH'):
            native_host = result['_native_host'](os.environ['NOVA_NATIVE_WRAPPER_PATH'])
        elif os.environ.get('NOVA_LOCAL_BROWSER') != 'system': raise ValueError('explicit-local-browser-required')
        import webbrowser
        lifecycle = LocalProductionLifecycle(result, assets, expected, browser=webbrowser.open, native_host=native_host)
        signal.signal(signal.SIGTERM, lambda *_: lifecycle.done.set())
        signal.signal(signal.SIGINT, lambda *_: lifecycle.done.set())
        lifecycle.start(); lifecycle.supervise()
        return 2 if lifecycle.state == 'FAILED' else 0
    except (ValueError, OSError, KeyError, TypeError):
        print('Strict local lifecycle failed; no installation or remote fallback.', file=sys.stderr)
        return 2
    finally:
        if lifecycle is not None: lifecycle.close(failed=lifecycle.state == 'FAILED')


if __name__ == '__main__':
    raise SystemExit(main())
