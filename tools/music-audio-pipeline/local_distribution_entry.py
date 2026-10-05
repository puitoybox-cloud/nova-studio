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
        self.deadline = time.monotonic() + ttl
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
                data = owner.assets.get(self.path)
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
                self.end_headers(); self.wfile.write(data)
            def do_POST(self):
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
                        'session': owner.session, 'nonce': owner.nonce,
                        'binding': owner.binding, 'envelope': owner.envelope},
                        sort_keys=True, separators=(',', ':')).encode()
                self.send_response(200); self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
        self.server = ThreadingHTTPServer((host, port), Handler)
        self.origin = 'http://127.0.0.1:' + str(self.server.server_port)
        self.thread = None

    def start(self):
        if self.closed or self.thread is not None:
            raise ValueError('stale-or-started-local-server')
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


def main():
    try:
        result = prepare(os.environ['NOVA_RUNTIME_ASSET_ROOT'],
                         os.environ['NOVA_TRUSTED_MANIFEST_PATH'],
                         os.environ['NOVA_TRUSTED_MANIFEST_DIGEST'],
                         os.environ['NOVA_EXPECTED_BUILD_REVISION'])
        os.execve(result['command'][0], result['command'], result['environment'])
    except (ValueError, OSError, KeyError, TypeError):
        print('Strict local distribution preflight failed; no installation or remote fallback.', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
