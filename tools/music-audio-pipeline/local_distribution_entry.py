"""Policy-neutral explicit local launcher preflight. No installation or browser navigation.

Trust anchor/build/root must be supplied externally; this module never chooses a
distribution or signing scheme. The browser envelope is a return value for the
existing bootstrap caller, never written to user storage or printed with paths.
"""
import json
import os
import sys
import hashlib
import secrets
import threading
import time
import http.client
import subprocess
import signal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from runtime_inventory import bootstrap
from scoped_closure import load_contract, verify_assembly
from dependency_identity import verify_local_asset
from distribution_binding import load_manifest

SOURCES = {'helper-source': 'server.py',
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


class OwnedResultChannel:
    """Private launcher -> Swift and launcher -> Helper capabilities, never browser tokens.

    One request/result per owner. Renewal only rotates the Swift capability within
    the original Helper/session deadline; it cannot extend processing authority.
    This is process-local bearer authentication, not PKI or native containment.
    """
    def __init__(self, session, deadline, *, clock=time.monotonic, wall=time.time):
        if not _token(session) or not clock() < deadline <= clock()+300:
            raise ValueError('invalid-owned-channel')
        self.session = session; self.deadline = deadline; self.clock = clock; self.wall = wall
        self.capability = secrets.token_hex(32); self.helper_capability = secrets.token_hex(32)
        self.expires = min(clock()+20, deadline)
        self.expires_at = int((wall()+self.expires-clock())*1000)
        self.deadline_at = int((wall()+deadline-clock())*1000)
        self.sequence = 0; self.renewals = 0
        self.state = 'READY'; self.binding = None; self.result = None
        self.lock = threading.RLock()

    def handoff(self):
        return {'capability': self.capability, 'sequence': self.sequence,
            'expiresAt': self.expires_at, 'deadlineAt': self.deadline_at}

    def alive(self):
        if self.clock() >= self.deadline or self.state in ('STOPPING', 'STOPPED', 'FAILED'):
            raise ValueError('expired-or-terminal-owned-channel')

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
            base = {'session','capability','sequence','action'}
            if action == 'begin':
                if set(value) != base|{'request','input'} or self.state != 'READY' or eligible is not True:
                    raise ValueError('ineligible-or-replayed-request')
                self.binding = processing_binding(self.session, value['request'], value['input'], inventory)
                self.state = 'PROCESSING'
            elif action == 'renew':
                if set(value) != base or self.state not in ('READY','PROCESSING') or self.renewals >= 2:
                    raise ValueError('renewal-budget-or-state')
                self.renewals += 1; self.capability = secrets.token_hex(32)
                self.expires = min(self.expires+20, self.deadline)
                self.expires_at = min(self.expires_at+20000, self.deadline_at)
            elif action == 'result':
                if set(value) != base or self.state != 'RESULT_READY': raise ValueError('missing-or-replayed-result')
                # Delivery consumes its sequence; only explicit output acceptance releases it.
                self.state = 'DELIVERED'
            elif action == 'accept':
                if (set(value) != base|{'resultId','output'} or self.state != 'DELIVERED' or
                        value['resultId'] != self.result['resultId'] or value['output'] != self.result['output']):
                    raise ValueError('foreign-replayed-or-output-mismatch')
                self.state = 'ACCEPTED'
            elif action == 'stop':
                if set(value) != base: raise ValueError('invalid-stop')
                self.state = 'STOPPING'
            else: raise ValueError('unknown-owned-action')
            self.sequence += 1
            response = {'format':'NOVA_OWNED_CONTROL_RECEIPT','version':1,'session':self.session,
                'action':action,'state':self.state, **self.handoff(), 'renewals':self.renewals,
                'bindingDigest':_digest(self.binding) if self.binding else None}
            if action == 'result': response['result'] = json.loads(json.dumps(self.result))
            return response

    def publish(self, value, inventory):
        from runtime_evidence import processing_binding, BoundProcessingReceipt
        with self.lock:
            self.alive()
            if (self.state != 'PROCESSING' or not isinstance(value, dict) or
                    set(value) != {'session','capability','receipt'} or value['session'] != self.session or
                    not _token(value['capability']) or not secrets.compare_digest(value['capability'], self.helper_capability)):
                raise ValueError('foreign-or-replayed-helper-result')
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
            if reproduced != receipt or reproduced['complete'] is not True:
                raise ValueError('tampered-or-partial-processing-chain')
            self.result = {'resultId':secrets.token_hex(32),'request':self.binding['request'],
                'bindingDigest':_digest(self.binding), 'receiptDigest':_digest(receipt), 'output':dict(output)}
            self.state = 'RESULT_READY'

    def close(self, *, failed=False):
        with self.lock:
            self.state = 'FAILED' if failed else 'STOPPED'
            self.capability = ''; self.helper_capability = ''; self.binding = None; self.result = None


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
                    path == '/bootstrap-envelope' or not isinstance(value, bytes) or
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
                if self.path in ('/owned-control', '/owned-helper-result'):
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
    for identity, relative in SOURCES.items():
        expected = runtime.expected('assets', identity)
        VERIFIER.verify(pipeline, relative, expected, 1024*1024,
                        identity=identity, version=expected['revision'], build=build)
    if runtime.manifest['helper']['sourceDigest'] != runtime.expected('assets', 'helper-source')['digest']:
        raise ValueError('launcher-helper-source-mismatch')
    graph = load_contract(runtime.root, runtime.manifest)
    artifact_report = verify_assembly(runtime.root, graph)
    if not artifact_report['complete']:
        raise ValueError('launcher-artifact-assembly-incomplete')
    from runtime_evidence import load as load_evidence, assembly_evidence
    evidence = load_evidence(runtime)
    if evidence['buildRevision'] != build:
        raise ValueError('launcher-evidence-build-mismatch')
    executable = runtime.resolve_executable('python-runtime', sys.executable)
    runtime.recheck()
    # Strict Helper boot will independently authenticate and refuse incomplete runtime evidence.
    environment = {k: v for k, v in os.environ.items() if not k.startswith(('PYTHON', 'NOVA_'))}
    environment.update(NOVA_TRUSTED_MANIFEST_PATH=str(Path(manifest).resolve()),
                       NOVA_TRUSTED_MANIFEST_DIGEST=anchor,
                       NOVA_EXPECTED_BUILD_REVISION=build,
                       NOVA_RUNTIME_ASSET_ROOT=str(runtime.root), PYTHONUNBUFFERED='1')
    return {'command': [executable, '-I', str(pipeline/'server.py')],
            'environment': environment,
            'browserEnvelope': {'manifest': runtime.manifest, 'trust': {'manifestDigest': anchor, 'buildRevision': build},
                                'runtimeConfigText': json.dumps(runtime.bindings, sort_keys=True, separators=(',', ':'), ensure_ascii=False)},
            'assembly': artifact_report, 'runtimeAssembly': assembly_evidence(runtime),
            'publicationEligible': False}


def strict_eligibility(inventory, *, trusted_bootstrap, browser_verified, backend_bound=False, fresh_session=None):
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
    eligible = all(checks.values())
    return {'processingEligible': eligible, 'publicationEligible': eligible and backend_bound is True,
            'blockedBy': [key for key, value in checks.items() if not value]}


class LocalProductionLifecycle:
    """Owns only a newly created child/group and one bounded loopback session.

    No old Helper is reused. Browser reporting cannot replace Helper inventory.
    Browser close is best effort; heartbeat expiry also tears down owned resources.
    A retry must instantiate a new lifecycle, never resurrect this instance.
    """
    def __init__(self, prepared, assets, expected_assets, *, popen=subprocess.Popen,
                 health=None, browser=None, native_host=None, timeout=30):
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
        self.control = OwnedResultChannel(self.server.session, self.server.deadline)
        self.shutdown_receipt = None
        self.state = 'PREPARING'; self.child = None; self.popen = popen
        self.health = health or self.read_health; self.browser = browser; self.native_host = native_host
        self.timeout = timeout; self.inventory = {}; self.browser_verified = False
        self.last_seen = time.monotonic(); self.done = threading.Event()
        self.lock = threading.RLock(); self.started = False
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
        self.inventory = inventory

    def start(self):
        if self.started or self.state != 'PREPARING': raise ValueError('stale-lifecycle-retry')
        self.started = True
        try:
            environment = dict(self.prepared['environment'])
            environment.update(NOVA_LIFECYCLE_SESSION=self.server.session, NOVA_LOCAL_BROWSER_ORIGIN=self.server.origin,
                NOVA_LIFECYCLE_DEADLINE=str(self.server.deadline),
                NOVA_OWNED_RESULT_ORIGIN=self.server.origin, NOVA_OWNED_RESULT_CAPABILITY=self.control.helper_capability)
            self.child = self.popen(self.prepared['command'], env=environment, start_new_session=True,
                                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            deadline = time.monotonic()+self.timeout
            while True:
                if self.child.poll() is not None: raise ValueError('helper-startup-failed')
                try: self.verify_health(self.health()); break
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
                self.verify_health(self.health()); self.browser_verified = True
                self.eligibility = strict_eligibility(self.inventory, trusted_bootstrap=True, browser_verified=True,
                    fresh_session=self.child is not None and self.child.poll() is None and time.monotonic() < self.server.deadline)
                self.state = 'PROCESSING_ELIGIBLE' if self.eligibility['processingEligible'] else 'IDENTITY_VERIFIED'
            elif self.state == 'SERVER_READY': self.state = 'BROWSER_READY'

    def control_event(self, route, value):
        with self.lock:
            if self.child is None or self.child.poll() is not None:
                self.state = 'FAILED'; self.control.close(failed=True); self.done.set()
                raise ValueError('unexpected-helper-termination')
            if route == '/owned-helper-result':
                self.verify_health(self.health())
                eligibility = strict_eligibility(self.inventory, trusted_bootstrap=True,
                    browser_verified=self.browser_verified, fresh_session=time.monotonic() < self.server.deadline)
                if not eligibility['processingEligible']: raise ValueError('ineligible-helper-result')
                self.control.publish(value,self.inventory)
                return {'ok':True}
            if route != '/owned-control': raise ValueError('wrong-owned-control-route')
            self.verify_health(self.health())
            eligibility = strict_eligibility(self.inventory,trusted_bootstrap=True,
                browser_verified=self.browser_verified,fresh_session=time.monotonic() < self.server.deadline)
            response = self.control.command(value,inventory=self.inventory,
                eligible=eligibility['processingEligible'],helper_alive=True)
            if response['state'] in ('ACCEPTED','STOPPING'):
                self.eligibility = strict_eligibility({},trusted_bootstrap=False,browser_verified=False)
                self.done.set()
            return response

    def supervise(self):
        try:
            while not self.done.wait(0.25):
                if (self.child.poll() is not None or time.monotonic()-self.last_seen > 30 or
                        time.monotonic() >= self.server.deadline):
                    self.state = 'FAILED'; break
        finally: self.close(failed=self.state == 'FAILED')

    def request_helper_stop(self):
        connection = http.client.HTTPConnection('127.0.0.1',8766,timeout=1)
        try:
            connection.request('POST','/owned-stop',body=b'',headers={
                'X-Nova-Session':self.control.session,'X-Nova-Owned-Capability':self.control.helper_capability})
            response = connection.getresponse(); raw = response.read(4097)
            value = json.loads(raw)
            if (response.status != 200 or len(raw)>4096 or value != {
                    'format':'NOVA_OWNED_STOP_RECEIPT','version':1,'session':self.control.session,'state':'STOPPING'}):
                raise ValueError('invalid-graceful-stop-receipt')
            return {'status':'OBSERVED','scope':'OWNED_AUTHENTICATED_HELPER','state':'STOPPING'}
        except (OSError,ValueError,http.client.HTTPException):
            return {'status':'UNVERIFIED','state':'STOP_NOT_CONFIRMED'}
        finally: connection.close()

    def close(self, *, failed=False):
        self.done.set(); self.browser_verified = False; self.inventory = {}
        self.eligibility = strict_eligibility({}, trusted_bootstrap=False, browser_verified=False)
        self.server.close()
        if self.child is not None and self.child.poll() is None:
            self.graceful_stop_receipt = self.request_helper_stop()
        self.control.close(failed=failed)
        if self.shutdown_receipt is None:
            self.shutdown_receipt = bounded_owned_shutdown(self.child)
        if self.child is not None and self.child.poll() is not None: self.child = None
        if self.child is not None: failed = True
        self.state = 'FAILED' if failed else 'STOPPED'


def main():
    lifecycle = None
    try:
        root = os.environ['NOVA_RUNTIME_ASSET_ROOT']
        result = prepare(root, os.environ['NOVA_TRUSTED_MANIFEST_PATH'],
                         os.environ['NOVA_TRUSTED_MANIFEST_DIGEST'], os.environ['NOVA_EXPECTED_BUILD_REVISION'])
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
        if os.environ.get('NOVA_LOCAL_BROWSER') != 'system': raise ValueError('explicit-local-browser-required')
        import webbrowser
        lifecycle = LocalProductionLifecycle(result, assets, expected, browser=webbrowser.open)
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
