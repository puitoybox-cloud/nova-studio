"""Bounded evidence at real load/invoke boundaries. No implicit trust or downloads.

Version 2 is additive to health identity v1. A receipt is scoped to this process;
file existence and metadata alone never imply a loaded or verified artifact.
"""
import copy
import hashlib
import importlib
import importlib.metadata
import os
import platform
import sys
import threading
from pathlib import Path
from dependency_identity import verify_local_asset

MAX_ARTIFACT_BYTES = 8 * 1024**3
MAX_ENTRIES = 128


def stable(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('unsafe-or-missing-runtime-artifact')
    st = path.stat()
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


def local(root, relative):
    root = Path(root).resolve()
    rel = Path(relative)
    if rel.is_absolute() or '..' in rel.parts or not rel.parts:
        raise ValueError('unsafe-runtime-path')
    path = root / rel
    # Reject symlink ancestors too. Only normalized logical identities leave process.
    current = root
    for part in rel.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('unsafe-runtime-path')
    if not path.resolve().is_relative_to(root):
        raise ValueError('unsafe-runtime-path')
    return path


class RuntimeInventory:
    def __init__(self, root, manifest, bindings, max_bytes=MAX_ARTIFACT_BYTES):
        supplied_root = Path(root)
        # The authenticated runtime root itself is part of the package identity.
        # Do not let a symlinked package root redirect otherwise-valid relative
        # asset bindings to a foreign tree.
        if supplied_root.is_symlink():
            raise ValueError('unsafe-runtime-root')
        self.root = supplied_root.resolve()
        if not self.root.is_dir():
            raise ValueError('unsafe-runtime-root')
        root_stat = self.root.stat()
        self.root_identity = (root_stat.st_dev, root_stat.st_ino)
        self.manifest = copy.deepcopy(manifest)
        self.bindings = copy.deepcopy(bindings)
        self.max_bytes = min(max_bytes, MAX_ARTIFACT_BYTES)
        self.lock = threading.RLock()
        self.loaded = {}
        self._retained_models = {}
        self.models = {}
        self.dependencies = {}
        self.native = {}
        self.assets = {}
        self.stamps = {}
        self.errors = []
        self.private_python = None
        self.verification_evidence = {}
        self._validate_bindings()

    def _validate_bindings(self):
        if set(self.bindings) != {'version', 'models', 'dependencies', 'native', 'assets'} or self.bindings['version'] != 1:
            raise ValueError('invalid-runtime-bindings')
        for kind in ('models', 'dependencies', 'native', 'assets'):
            values = self.bindings[kind]
            if not isinstance(values, list) or len(values) > MAX_ENTRIES:
                raise ValueError('runtime-inventory-budget')
            ids = [e['id'] for e in values]
            if len(ids) != len(set(ids)):
                raise ValueError('duplicate-runtime-identity')
        for kind in ('models', 'dependencies'):
            if {e['id'] for e in self.bindings[kind]} != {e['id'] for e in self.manifest[kind]}:
                raise ValueError('missing-or-unexpected-runtime-identity')
        declared_assets = {e['id'] for e in self.bindings['assets']} | {e['id'] for e in self.bindings['native']}
        for binding in self.bindings['models']:
            declared_assets.update(e['id'] for e in binding.get('companions', []))
        for binding in self.bindings['dependencies']:
            declared_assets.update(e['id'] for e in binding.get('native', []))
        # Config is authenticated by bootstrap itself; every other asset needs an explicit local mapping.
        required_assets = {e['id'] for e in self.manifest['assets']} - {'runtime-config'}
        if declared_assets - {'runtime-config'} != required_assets:
            raise ValueError('missing-or-unexpected-local-asset')

    def expected(self, kind, identity):
        matches = [e for e in self.manifest[kind] if e['id'] == identity]
        if len(matches) != 1:
            raise ValueError('unexpected-runtime-identity')
        return matches[0]

    def verify(self, kind, identity, relative):
        path = local(self.root, relative)
        before = stable(path)
        expected = self.expected(kind, identity)
        from artifact_verification import VERIFIER
        proof = VERIFIER.verify(self.root, relative, expected, self.max_bytes, identity=identity,
                                version=expected.get('revision', expected.get('version', '1')),
                                build=self.manifest.get('buildRevision', 'UNSPECIFIED'))
        self.verification_evidence[(kind, identity)] = proof
        if stable(path) != before:
            raise ValueError('runtime-artifact-changed')
        self.stamps[(kind, identity)] = (relative, before)
        if kind == 'assets':
            self.assets[identity] = dict(expected)
        return dict(expected)

    def load_model(self, identity, loader):
        with self.lock:
            self.loaded.pop(identity, None)
            self._retained_models.pop(identity, None)
            self.models.pop(identity, None)
            binding = next((e for e in self.bindings['models'] if e['id'] == identity), None)
            if binding is None:
                raise ValueError('unexpected-model')
            try:
                entry = self.verify('models', identity, binding['path'])
                companions = [self.verify('assets', c['id'], c['path']) for c in binding.get('companions', [])]
                # Loader receives exactly the file whose bytes were verified.
                value = loader(local(self.root, binding['path']))
                if value is None:
                    raise ValueError('model-load-failed')
                self.recheck()
                self.loaded[identity] = value
                self._retained_models[identity] = value
                self.models[identity] = {'identity': entry, 'status': 'LOADED_VERIFIED_FILE',
                    'source': binding['path'], 'runtimeIdentifier': binding['runtimeIdentifier'],
                    'runtimeVisibleIdentifier': type(value).__module__ + '.' + type(value).__qualname__,
                    'loadedRevisionEvidence': 'MANIFEST_BOUND_SERIALIZED_BYTES',
                    'companions': companions}
                return value
            except Exception:
                self.loaded.pop(identity, None)
                self._retained_models.pop(identity, None)
                self.models.pop(identity, None)
                raise ValueError('model-load-or-identity-failed') from None

    def retained_model(self, identity):
        with self.lock:
            self.recheck()
            value = self.loaded.get(identity)
            if value is None or self._retained_models.get(identity) is not value:
                raise ValueError('missing-or-replaced-loaded-model')
            receipt = self.models.get(identity, {})
            if receipt.get('status') != 'LOADED_VERIFIED_FILE' or receipt.get('identity') != self.expected('models', identity):
                raise ValueError('changed-loaded-model-identity')
            return value, copy.deepcopy(receipt)

    def observe_dependency(self, binding, importer=importlib.import_module, version=importlib.metadata.version):
        identity = binding['id']
        self.dependencies.pop(identity, None)
        expected = self.expected('dependencies', identity)
        try:
            observed_version = version(identity)
            if observed_version != expected['version']:
                raise ValueError('wrong-dependency-version')
            # Verify before import, then prove the runtime imported that same file.
            path = local(self.root, binding['path'])
            before = stable(path)
            evidence = {'digest': expected['digest'], 'byteLength': before[2]}
            verify_local_asset(self.root, binding['path'], evidence, self.max_bytes)
            module = importer(binding['module'])
            if Path(module.__file__).resolve() != path.resolve() or stable(path) != before:
                raise ValueError('wrong-runtime-module')
            native = []
            for companion in binding.get('native', []):
                artifact = self.verify('assets', companion['id'], companion['path'])
                extension = importer(companion['module'])
                if Path(extension.__file__).resolve() != local(self.root, companion['path']).resolve():
                    raise ValueError('wrong-native-extension')
                native.append(artifact)
            self.recheck()
            self.stamps[('dependencies', identity)] = (binding['path'], before)
            self.dependencies[identity] = {'identity': dict(expected), 'status': 'VERIFIED_ENTRY_FILE',
                'module': binding['module'], 'source': binding['path'], 'native': native,
                'scope': 'ENTRY_FILE_AND_DECLARED_NATIVE_ONLY'}
            return module
        except Exception:
            raise ValueError('dependency-artifact-or-import-failed') from None

    def resolve_executable(self, identity, executable):
        self.native.pop(identity, None)
        binding = next((e for e in self.bindings['native'] if e['id'] == identity), None)
        if binding is None or binding.get('architecture') != platform.machine():
            raise ValueError('unexpected-executable-or-architecture')
        path = local(self.root, binding['path'])
        if Path(executable).resolve() != path.resolve() or not os.access(path, os.X_OK):
            raise ValueError('wrong-executable')
        entry = self.verify('assets', identity, binding['path'])
        # Reuse the bounded actual-image parser, not the architecture label alone.
        # Disk syntax does not establish a live handle or native isolation.
        from runtime_evidence import native_image_routes
        before = stable(path)
        image = native_image_routes(path, binding['architecture'])
        if platform.system() == 'Darwin' and image['format'] != 'MACHO64':
            raise ValueError('wrong-private-runtime-image-format')
        if stable(path) != before:
            raise ValueError('changed-private-runtime-image')
        self.native[identity] = {'identity': entry, 'status': 'VERIFIED_EXECUTABLE_FILE',
            'source': binding['path'], 'architecture': platform.machine(),
            'version': binding['version'], 'versionEvidence': 'MANIFEST_BOUND_ONLY',
            'architectureEvidence': 'VERIFIED_DISK_IMAGE_HEADER', 'imageFormat': image['format'],
            'loaderSelectionVerified': False}
        return str(path)

    def recheck(self):
        try:
            root_stat = self.root.stat()
            if self.root.is_symlink() or not self.root.is_dir() or (root_stat.st_dev, root_stat.st_ino) != self.root_identity:
                raise ValueError('stale-runtime-root')
            if (set(self.loaded) != set(self._retained_models) or set(self.models) != set(self.loaded) or
                    any(self.loaded[key] is not self._retained_models[key] or
                        self.models[key].get('identity') != self.expected('models', key) for key in self.loaded)):
                raise ValueError('replaced-runtime-model-object-or-identity')
            for relative, stamp in self.stamps.values():
                if stable(local(self.root, relative)) != stamp:
                    raise ValueError('stale-runtime-artifact')
            if self.private_python is not None:
                from scoped_closure import private_process_origin
                binding = next(e for e in self.bindings['native'] if e['id']=='python-runtime')
                observed = private_process_origin(str(local(self.root,binding['path'])))
                if observed != self.private_python.get('processOrigin'):
                    raise ValueError('stale-private-process-origin')
        except (OSError, ValueError):
            self.private_python = None
            self.loaded.clear(); self._retained_models.clear(); self.models.clear(); self.dependencies.clear(); self.native.clear(); self.assets.clear()
            raise ValueError('stale-runtime-artifact') from None

    def verify_assets(self):
        for binding in self.bindings['assets']:
            self.assets[binding['id']] = self.verify('assets', binding['id'], binding['path'])

    def snapshot(self):
        with self.lock:
            try:
                self.recheck()
            except (OSError, ValueError):
                return {'inventoryVersion': 2, 'mode': 'STRICT', 'status': 'BLOCKED', 'reason': 'stale-runtime-artifact'}
            missing = []
            for kind, actual in [('models', self.models), ('dependencies', self.dependencies), ('native', self.native), ('assets', self.assets)]:
                missing.extend(kind + ':' + e['id'] for e in self.bindings[kind] if e['id'] not in actual)
            # Entry-file evidence does not authenticate an entire package/transitive closure.
            return {'inventoryVersion': 2, 'mode': 'STRICT', 'status': 'PARTIAL',
                'missing': missing, 'artifactClosure': 'UNVERIFIED',
                'privatePython': copy.deepcopy(self.private_python),
                'architecture': platform.machine(), 'models': copy.deepcopy(list(self.models.values())),
                'dependencies': copy.deepcopy(list(self.dependencies.values())), 'native': copy.deepcopy([self.native[key] for key in sorted(self.native)]),
                'assets': copy.deepcopy(list(self.assets.values())), 'largeArtifactVerification':
                {'complete': not missing, 'entries': copy.deepcopy(list(self.verification_evidence.values())),
                 'cacheScope': 'PROCESS_LOCAL_DIGEST_RECEIPT'}}

    def require_processing(self):
        result = self.snapshot()
        # Production full closure and opaque Demucs child evidence remain blockers.
        if result['status'] != 'VERIFIED' or result.get('artifactClosure') != 'VERIFIED':
            raise ValueError('strict-runtime-inventory-incomplete')
        return result


def bootstrap(manifest_path, anchor, build, root, config_relative='runtime-config.json'):
    from distribution_binding import load_manifest
    manifest = load_manifest(manifest_path, anchor, build)
    config_asset = next((e for e in manifest['assets'] if e['id'] == 'runtime-config'), None)
    if config_asset is None:
        raise ValueError('missing-authenticated-runtime-config')
    config_path = local(root, config_relative)
    verify_local_asset(root, config_relative, config_asset, 65536)
    import json
    raw = config_path.read_bytes()
    if len(raw) > 65536 or hashlib.sha256(raw).hexdigest() != config_asset['digest']:
        raise ValueError('stale-runtime-config')
    def unique(pairs):
        value = {}
        for key, item in pairs:
            if key in value: raise ValueError('duplicate-runtime-config-key')
            value[key] = item
        return value
    bindings = json.loads(raw, object_pairs_hook=unique)
    runtime = RuntimeInventory(root, manifest, bindings)
    runtime.verify('assets', 'runtime-config', config_relative)
    return runtime


class OfflineRuntimeGuard:
    """Python audit boundary, not an OS/native networking sandbox."""
    def __init__(self):
        import contextlib
        self.state = threading.local()
        self.observed = {}
        self.network_classes = {}
        self.observation_lock = threading.Lock()
        sys.addaudithook(self.audit)

    def audit(self, event, args):
        # Logical event counts only: no hosts, URLs, paths, PIDs or socket inventory.
        if event in ('ctypes.dlsym', 'ctypes.dlsym/handle'):
            # Only this owned Helper/child's Python-to-native lookup boundary.
            # Direct calls from ML/codec C code remain entirely unobserved.
            name = args[1] if len(args) > 1 else None
            if isinstance(name, bytes):
                try: name = name.decode('ascii')
                except UnicodeDecodeError: name = None
            if isinstance(name, str): name = name.removesuffix('$NOCANCEL').removesuffix('$UNIX2003')
            if type(name) is int or name in {'socket', 'connect', 'send', 'sendto', 'sendmsg', 'getaddrinfo',
                        'gethostbyname', 'gethostbyname2', 'getnameinfo', 'curl_easy_perform',
                        'curl_multi_perform', 'CFReadStreamCreateForHTTPRequest', 'socketpair',
                        'connectx', 'sendmmsg', 'res_query', 'res_search', 'getaddrinfo_a',
                        'recv', 'recvfrom', 'recvmsg', 'accept', 'accept4', 'listen', 'bind',
                        'SSL_connect', 'SSL_write', 'BIO_new_connect', 'syscall',
                        'getaddrinfo_a','gai_suspend','ares_getaddrinfo','ares_gethostbyname','ares_query','ares_send',
                        'curl_easy_perform','curl_multi_perform','curl_multi_poll','curl_multi_wait','BIO_new_ssl',
                        'SSL_set_fd','SSL_set_bio','CFNetworkExecuteProxyAutoConfigurationURL','nw_endpoint_create_host',
                        'SSL_read', 'SSL_do_handshake', 'SSL_write_ex', 'SSL_read_ex',
                        'BIO_new_ssl_connect', 'BIO_new_dgram', 'curl_easy_send', 'curl_easy_recv',
                        'curl_multi_socket_action', 'res_nquery', 'res_nsearch', 'gethostbyaddr',
                        'CFHostStartInfoResolution', 'CFReadStreamOpen', 'CFWriteStreamOpen',
                        'nw_connection_start', 'nw_connection_send', 'nw_connection_receive'}:
                with self.observation_lock:
                    self.observed['ctypes.network_symbol_lookup'] = min(1000000,
                        self.observed.get('ctypes.network_symbol_lookup', 0)+1)
                raise PermissionError('strict-offline-native-symbol-dispatch-blocked')
        if event in ('socket.__new__', 'socket.connect', 'socket.getaddrinfo',
                     'socket.sendto', 'subprocess.Popen', 'os.system', 'os.exec',
                     'os.posix_spawn', 'os.fork'):
            with self.observation_lock:
                self.observed[event] = min(1000000, self.observed.get(event, 0) + 1)
        if event in ('socket.connect', 'socket.sendto', 'socket.getaddrinfo'):
            import ipaddress
            category = 'DNS_ATTEMPT' if event == 'socket.getaddrinfo' else 'UNKNOWN'
            if event != 'socket.getaddrinfo':
                address = args[1] if event == 'socket.connect' and len(args) > 1 else args[-1] if args else None
                if isinstance(address, tuple) and address and isinstance(address[0], str):
                    try: category = 'LOOPBACK' if ipaddress.ip_address(address[0]).is_loopback else 'EXTERNAL_ATTEMPT'
                    except ValueError: category = 'EXTERNAL_ATTEMPT'
            with self.observation_lock:
                self.network_classes[category] = min(1000000, self.network_classes.get(category, 0)+1)
        if event == 'socket.connect':
            permitted = getattr(self.state, 'owned_socket', None)
            if permitted is not None and len(args) == 2 and args[0] is permitted[0] and args[1] == permitted[1]:
                self.state.owned_socket = None
                return
        if event == 'subprocess.Popen':
            permitted = getattr(self.state, 'command', None)
            if permitted is not None and tuple(args[1]) == permitted and args[0] == permitted[0]:
                self.state.command = None  # Single launch; no nested/reused permission.
                return
        if event in ('socket.connect', 'socket.getaddrinfo', 'socket.sendto', 'subprocess.Popen', 'os.system', 'os.exec', 'os.posix_spawn', 'os.fork'):
            raise PermissionError('strict-offline-runtime-operation-blocked')

    def snapshot(self):
        with self.observation_lock:
            events = dict(self.observed)
            categories = dict(self.network_classes)
        return {'python': 'AUDIT_GUARDED', 'native': 'UNVERIFIED',
                'scope': 'THIS_PROCESS_PYTHON_AUDIT_EVENTS_ONLY',
                'events': events, 'classifications': categories, 'nativeNetworkVerified': False,
                'nativeObservation': 'UNVERIFIED', 'nativeNetworkContainment': 'PARTIAL',
                'nativeDispatchGuard': {'scope': 'OWNED_PROCESS_CTYPES_LOOKUPS_ONLY',
                    'status': 'PARTIAL', 'directNativeCalls': 'UNVERIFIED'},
                'nativeBlockedBy': 'NATIVE_SYSCALL_BOUNDARY_NOT_INSTALLED',
                'components': {key: 'UNVERIFIED' for key in ('helper', 'demucs-child', 'basic-pitch', 'codec', 'approved-companion')}}

    def permit(self, command):
        import contextlib
        @contextlib.contextmanager
        def once():
            if getattr(self.state, 'command', None) is not None:
                raise ValueError('nested-child-permission')
            self.state.command = tuple(command)
            try: yield
            finally: self.state.command = None
        return once()

    def permit_owned_socket(self, handle, address):
        """One exact numeric loopback connect; never DNS or a general network bypass."""
        import contextlib
        import socket
        if (not isinstance(handle, socket.socket) or handle.family != socket.AF_INET or
                not isinstance(address, tuple) or len(address) != 2 or address[0] != '127.0.0.1' or
                type(address[1]) is not int or not 0 < address[1] <= 65535):
            raise ValueError('invalid-owned-loopback-socket')
        @contextlib.contextmanager
        def once():
            if getattr(self.state,'owned_socket',None) is not None: raise ValueError('nested-owned-socket')
            self.state.owned_socket = (handle,address)
            try: yield
            finally: self.state.owned_socket = None
        return once()


def install_offline_guard():
    return OfflineRuntimeGuard()


def legacy_snapshot():
    return {'inventoryVersion': 2, 'mode': 'LEGACY', 'status': 'UNVERIFIED',
        'models': [], 'dependencies': [], 'native': [], 'assets': []}
