"""Authenticated scoped native/import/codec evidence; never enumerates OS libraries.

Only modules in explicitly declared runtime package namespaces are observed.
Native shared-library bytes and observed extension entry files remain distinct.
No Python observation is promoted to native network enforcement.
"""
import copy
import hashlib
import json
import platform
import sys
import importlib.abc
import importlib.machinery
from pathlib import Path
from artifact_verification import VERIFIER, resolve

MAX_CONTRACT_BYTES = 1024 * 1024
NATIVE_KINDS = {'EXTENSION', 'SHARED_LIBRARY', 'FRAMEWORK', 'EXECUTABLE'}
LEVELS = {'VERIFIED_ARTIFACT', 'VERIFIED_ENTRY', 'OBSERVED_LOADED',
          'OBSERVED_METADATA_ONLY', 'OBSERVED_RUNTIME_ONLY', 'EXPECTED_ONLY',
          'MISSING', 'UNVERIFIED', 'UNSUPPORTED'}


def scoped_loaded_library(root, entry, *, system=None):
    """Probe exactly one declared path using RTLD_NOLOAD; never enumerate images.

    A successful loader lookup establishes presence only. It does not establish
    the integrity of mapped pages, architecture, or its transitive dependencies.
    No ordinary dlopen fallback is allowed on unsupported systems.
    """
    import ctypes
    import os
    import _ctypes
    system = system or platform.system()
    path = resolve(root, entry['path'])
    result = {'id': entry['id'], 'parentModule': entry['module'],
              'origin': 'DECLARED_LOCAL_ARTIFACT', 'version': entry['version'],
              'versionEvidence': 'MANIFEST_BOUND_ONLY',
              'architectureEvidence': 'UNVERIFIED', 'actualLoaded': False,
              'status': 'UNSUPPORTED', 'observation': 'RTLD_NOLOAD_EXACT_PATH',
              'mappedIntegrity': 'UNVERIFIED', 'transitiveComplete': False}
    if system not in ('Darwin', 'Linux') or not hasattr(os, 'RTLD_NOLOAD'):
        return result
    try:
        # Balance the loader reference explicitly; CDLL does not close it for us.
        handle = ctypes.CDLL(str(path), mode=os.RTLD_NOLOAD | os.RTLD_NOW)
        try:
            result.update(actualLoaded=bool(handle._handle), status='OBSERVED_LOADED')
        finally:
            if handle._handle:
                _ctypes.dlclose(handle._handle)
    except OSError:
        result['status'] = 'EXPECTED_ONLY' if path.is_file() else 'MISSING'
    return result


def shared_library_receipts(root, contract, *, verifier=VERIFIER):
    """Separate exact disk artifact integrity from actual loader presence."""
    entries = []
    for entry in contract['native']:
        if entry['kind'] not in ('SHARED_LIBRARY', 'FRAMEWORK'):
            continue
        receipt = scoped_loaded_library(root, entry)
        receipt['artifactStatus'] = 'UNVERIFIED'
        try:
            proof = verifier.verify(root, entry['path'], entry, identity=entry['id'],
                                    version=entry['version'], build=contract['buildRevision'])
            receipt.update(artifactStatus=proof['status'], digest=proof['digest'])
        except FileNotFoundError:
            receipt['artifactStatus'] = 'MISSING'
        except (OSError, ValueError):
            pass
        entries.append(receipt)
    return {'entries': entries, 'complete': False,
            'reason': 'transitive-loader-edges-and-mapped-integrity-unverified'}


def native_dependency_graph(contract, imports, native, shared):
    """Logical expected edges with independently observed child identities.

    Parent association is declared, not a claim that a loader edge was observed.
    Absence of runtime loader-edge evidence can never complete this graph.
    """
    actual = {e['id']: e for e in native + shared['entries']}
    modules = {e['module']: e for e in imports}
    edges = []
    for entry in contract['native']:
        child = actual.get(entry['id'], {})
        parent = modules.get(entry['module'])
        edges.append({'parent': parent['id'] if parent else 'declared-runtime',
            'child': entry['id'], 'evidenceLevel': 'EXPECTED_ONLY',
            'runtimeObserved': False, 'childRuntimeObserved': child.get('actualLoaded',
                child.get('status') == 'OBSERVED_LOADED'),
            'expectedIdentity': {'digest': entry['digest'], 'version': entry['version']},
            'actualIdentity': {'digest': child.get('digest') if child.get('artifactStatus') in
                ('VERIFIED_ARTIFACT', 'VERIFIED_ENTRY') else None,
                'artifactStatus': child.get('artifactStatus', 'UNVERIFIED')},
            'status': 'UNVERIFIED'})
    return {'version': 1, 'edges': edges, 'complete': False,
            'reason': 'native-loader-transitive-edges-not-observed'}


def load(runtime):
    expected = runtime.expected('assets', 'runtime-evidence')
    path = resolve(runtime.root, 'runtime-evidence.json')
    VERIFIER.verify(runtime.root, 'runtime-evidence.json', expected, MAX_CONTRACT_BYTES,
                    build=runtime.manifest['buildRevision'])
    with path.open('rb') as stream:
        raw = stream.read(MAX_CONTRACT_BYTES + 1)
    if len(raw) > MAX_CONTRACT_BYTES or hashlib.sha256(raw).hexdigest() != expected['digest']:
        raise ValueError('stale-runtime-evidence')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('duplicate-runtime-evidence')
            result[key] = value
        return result
    contract = json.loads(raw, object_pairs_hook=unique)
    validate(contract)
    canonical = json.dumps(contract, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    if raw != canonical:
        raise ValueError('noncanonical-runtime-evidence')
    return contract


def validate(contract):
    if (not isinstance(contract, dict) or set(contract) - {'mappedSymbols', 'processingNativeRoutes'} !=
            {'version', 'buildRevision', 'architecture', 'namespaces', 'imports', 'native', 'codec'} or
            type(contract['version']) is not int or contract['version'] != 1):
        raise ValueError('invalid-runtime-evidence')
    if (not isinstance(contract['buildRevision'], str) or not contract['buildRevision'] or
            not isinstance(contract['architecture'], str) or not contract['architecture']):
        raise ValueError('invalid-evidence-build')
    namespaces = contract['namespaces']
    if (not isinstance(namespaces, list) or not namespaces or len(namespaces) > 128 or
            any(not isinstance(n, str) or not n.isidentifier() for n in namespaces) or
            len(set(namespaces)) != len(namespaces)):
        raise ValueError('invalid-runtime-namespaces')
    for kind in ('imports', 'native'):
        values = contract[kind]
        if not isinstance(values, list) or len(values) > 4096:
            raise ValueError('runtime-evidence-budget')
        ids = set()
        for entry in values:
            keys = {'id', 'path', 'digest', 'byteLength', 'version', 'module'}
            if kind == 'native':
                keys |= {'kind', 'footprintComplete'}
            if not isinstance(entry, dict) or set(entry) != keys:
                raise ValueError('invalid-runtime-entry')
            if (not isinstance(entry['id'], str) or not entry['id'] or entry['id'] in ids or
                    not isinstance(entry['version'], str) or not entry['version'] or
                    type(entry['byteLength']) is not int or not 0 < entry['byteLength'] <= 8*1024**3 or
                    not isinstance(entry['digest'], str) or len(entry['digest']) != 64 or
                    any(c not in '0123456789abcdef' for c in entry['digest'])):
                raise ValueError('invalid-runtime-entry-identity')
            ids.add(entry['id'])
            if not isinstance(entry['path'], str):
                raise ValueError('unsafe-runtime-evidence-path')
            relative = Path(entry['path'])
            if relative.is_absolute() or '..' in relative.parts or not relative.parts:
                raise ValueError('unsafe-runtime-evidence-path')
            module = entry['module']
            if module is not None and (not isinstance(module, str) or
                    any(not part.isidentifier() for part in module.split('.')) or
                    module.split('.')[0] not in namespaces):
                raise ValueError('unexpected-runtime-namespace')
            if kind == 'imports' and module is None:
                raise ValueError('missing-dynamic-module')
            if kind == 'native' and (entry['kind'] not in NATIVE_KINDS or
                    type(entry['footprintComplete']) is not bool):
                raise ValueError('invalid-native-evidence')
    modules = [e['module'] for e in contract['imports']]
    if len(set(modules)) != len(modules):
        raise ValueError('duplicate-runtime-import')
    codec = contract['codec']
    if (not isinstance(codec, dict) or set(codec) != {'backend', 'version', 'nativeIds', 'externalExecutable'} or
            not isinstance(codec['nativeIds'], list) or not codec['nativeIds'] or
            len(codec['nativeIds']) != len(set(codec['nativeIds'])) or
            not set(codec['nativeIds']) <= {e['id'] for e in contract['native']} or
            codec['backend'] != 'soundfile' or not isinstance(codec['version'], str) or
            not codec['version'] or codec['externalExecutable'] is not False):
        raise ValueError('unsupported-or-fallback-codec')
    symbols = contract.get('mappedSymbols', {})
    if (not isinstance(symbols, dict) or not set(symbols) <= {e['id'] for e in contract['native']} or
            any(not isinstance(v, str) or not v.isascii() or not v.isidentifier() or len(v) > 128 for v in symbols.values())):
        raise ValueError('invalid-mapped-symbol-contract')
    routes = contract.get('processingNativeRoutes', {})
    native_ids = {e['id'] for e in contract['native']}
    if (not isinstance(routes, dict) or len(routes) > 256 or any(
            not isinstance(logical, str) or not 0 < len(logical) <= 128 or
            not isinstance(ids, list) or not 0 < len(ids) <= 4096 or
            any(not isinstance(identity, str) for identity in ids) or
            len(ids) != len(set(ids)) or not set(ids) <= native_ids for logical, ids in routes.items())):
        raise ValueError('invalid-processing-native-route-contract')
    return contract


def observe(root, contract, modules=None, *, build=None, architecture=None, verifier=VERIFIER):
    contract = copy.deepcopy(validate(contract))
    if contract['buildRevision'] != build or contract['architecture'] != (architecture or platform.machine()):
        raise ValueError('wrong-runtime-evidence-build-or-architecture')
    modules = sys.modules if modules is None else modules
    allowed = {e['module']: e for e in contract['imports']}
    scoped = {name for name in modules if name.split('.')[0] in contract['namespaces']}
    errors = ['unexpected-dynamic-import'] if scoped - set(allowed) else []
    imports = []; native = []; proofs = []
    for kind, target in [('imports', imports), ('native', native)]:
        for entry in contract[kind]:
            status = 'UNVERIFIED'; proof = None
            try:
                proof = verifier.verify(root, entry['path'], entry, identity=entry['id'],
                                        version=entry['version'], build=build)
                proofs.append(proof)
                module = modules.get(entry['module']) if entry['module'] else None
                if entry['module']:
                    if module is None:
                        status = 'EXPECTED_ONLY'
                    elif (not getattr(module, '__file__', None) or
                          Path(module.__file__).resolve() != resolve(root, entry['path']).resolve()):
                        status = 'UNVERIFIED'
                    else:
                        status = 'OBSERVED_LOADED'
                        if kind == 'native':
                            spec = getattr(module, '__spec__', None)
                            if (entry['kind'] != 'EXTENSION' or spec is None or
                                    not isinstance(getattr(spec, 'loader', None), importlib.machinery.ExtensionFileLoader) or
                                    not getattr(spec, 'origin', None) or
                                    Path(spec.origin).resolve() != resolve(root, entry['path']).resolve()):
                                status = 'OBSERVED_METADATA_ONLY'
                else:
                    # Shared libraries have byte evidence, not a fabricated loaded receipt.
                    status = 'VERIFIED_ENTRY'
            except FileNotFoundError:
                status = 'MISSING'
            except (OSError, ValueError):
                status = 'UNVERIFIED'
            target.append({'id': entry['id'], 'module': entry['module'], 'version': entry['version'],
                           'versionEvidence': 'MANIFEST_BOUND_ONLY',
                           'digest': entry['digest'], 'status': status,
                           'artifactStatus': 'VERIFIED_ENTRY' if proof else 'UNVERIFIED'})
    dynamic_complete = not errors and bool(imports) and all(e['status'] == 'OBSERVED_LOADED' for e in imports)
    # Native closure needs explicit observed load for every component. Byte-only libraries cannot pass.
    native_complete = bool(native) and all(e['status'] == 'OBSERVED_LOADED' for e in native)
    codec = contract['codec']
    sf = modules.get('soundfile')
    codec_complete = (getattr(sf, '__version__', None) == codec['version'] and
                      'soundfile' in allowed and dynamic_complete and
                      all(e['status'] == 'OBSERVED_LOADED' for e in native if e['id'] in codec['nativeIds']))
    shared = shared_library_receipts(root, contract, verifier=verifier)
    mapped = mapped_native_receipts(root, contract)
    transitive = scoped_macho_dependencies(root, contract)
    return {'version': 1, 'scope': 'DECLARED_RUNTIME_NAMESPACES_ONLY',
            'contractDigest': hashlib.sha256(json.dumps(contract, sort_keys=True,
                separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest(),
            'nativeClosure': {'complete': native_complete, 'entries': native},
            'dynamicImports': {'complete': dynamic_complete, 'entries': imports, 'errors': errors},
            'codec': {**codec, 'complete': codec_complete, 'status': 'VERIFIED_ENTRY' if codec_complete else 'UNVERIFIED',
                      'versionEvidence': 'OBSERVED_MODULE_VERSION' if codec_complete else 'UNVERIFIED'},
            'largeArtifacts': {'complete': len(proofs) == len(imports)+len(native), 'entries': proofs},
            'network': {'python': 'UNVERIFIED', 'native': 'UNVERIFIED',
                'components': {'helper':'PYTHON_GUARDED_NATIVE_UNVERIFIED','demucs-child':'NETWORK_CAPABLE_NATIVE_UNVERIFIED','codec':'NETWORK_CAPABILITY_UNVERIFIED'}, 'nativeNetworkVerified':False},
            'processingChain': processing_backend_inventory(contract, modules),
            'transitiveNativeObservation': transitive,
            'mappedNative': mapped,
            'scopedNativeLoads': scoped_native_load_observation(root, contract, modules=modules, mapped=mapped),
            'runtimeNativeClosure': runtime_native_closure(mapped, transitive),
            'sharedLibraries': shared,
            'dynamicNativeGraph': native_dependency_graph(contract, imports, native, shared),
            'complete': False, 'publicationEligible': False}


def upgrade(inventory, evidence=None):
    result = copy.deepcopy(inventory)
    result['identityComplete'] = result.get('complete') is True
    result['runtimeClosureVersion'] = 1
    result['processingReceiptVersion'] = 1
    result['offlineRuntimeComplete'] = False
    result['runtimeEvidence'] = copy.deepcopy(evidence) if evidence else {
        'complete': False, 'reason': 'missing-authenticated-runtime-evidence',
        'network': {'native': 'UNVERIFIED'}}
    evidence_value = result['runtimeEvidence']
    result['nativeClosureComplete'] = evidence_value.get('dynamicNativeGraph', {}).get('complete') is True
    result['processingChainComplete'] = evidence_value.get('processingChain', {}).get('complete') is True
    result['mappedNativeState'] = copy.deepcopy(evidence_value.get('mappedNative', {'complete': False}))
    result['processingBlockedBy'] = [key for key, value in {
        'identityComplete': result['identityComplete'], 'nativeClosureComplete': result['nativeClosureComplete'],
        'processingChainComplete': result['processingChainComplete'], 'nativeNetworkContainment': False}.items() if not value]
    result.update(complete=False, processingEligible=False, publicationEligible=False)
    if result.get('status') == 'VERIFIED':
        result['status'] = 'PARTIAL'
    return result


def receipt_evidence(evidence):
    """Bind all scoped entry receipts by digest without exceeding child wire budget.

    Summary digest is observation evidence from the authenticated child, not an
    independent signature or a substitute for missing native network containment.
    """
    result = copy.deepcopy(evidence)
    loads = result.get('scopedNativeLoads')
    if loads is not None:
        observation_digest = evidence_digest(loads)
        for key in ('expected', 'observed', 'unexpected', 'unresolved', 'ambiguous'):
            entries = loads.pop(key)
            loads[key+'Count'] = len(entries)
        loads['observationDigest'] = observation_digest
    transitive = result.get('transitiveNativeObservation')
    if transitive is not None:
        entries = transitive.pop('edges')
        transitive.update(edgeCount=len(entries), edgesDigest=hashlib.sha256(json.dumps(entries,sort_keys=True,separators=(',',':')).encode()).hexdigest())
    graph = result.get('dynamicNativeGraph')
    if graph is not None:
        edges = graph.pop('edges')
        graph.update(edgeCount=len(edges), edgesDigest=hashlib.sha256(json.dumps(
            edges, sort_keys=True, separators=(',', ':')).encode()).hexdigest())
    runtime_graph = result.get('runtimeNativeClosure')
    if runtime_graph is not None:
        edges = runtime_graph.pop('edges')
        runtime_graph.update(edgeCount=len(edges), edgesDigest=evidence_digest(edges))
    for key in ('nativeClosure', 'dynamicImports', 'largeArtifacts', 'sharedLibraries', 'mappedNative'):
        if key not in result: continue
        value = result[key]
        entries = value.pop('entries')
        statuses = {}
        for entry in entries:
            status = entry['status']
            statuses[status] = statuses.get(status, 0) + 1
        value.update(entryCount=len(entries), statusCounts=statuses,
                     entriesDigest=hashlib.sha256(json.dumps(entries, sort_keys=True,
                         separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest())
    return result



class ProcessingReceipt:
    """Runtime-scoped call receipts, not predictions of unexecuted backend stages."""
    def __init__(self, root, contract):
        self.root = root; self.contract = contract; self.contract_revision = evidence_digest(contract); self.entries = []

    def not_applicable(self, stage, reason):
        if stage != 'resample' or reason != 'INPUT_RATE_EQUALS_TARGET_RATE': raise ValueError('invalid-not-applicable-stage')
        if len(self.entries) >= 256: raise ValueError('processing-receipt-budget')
        self.entries.append({'stage': stage, 'status': 'NOT_APPLICABLE', 'reason': reason, 'completed': True,
            'fallback': False, 'nativeIdentity': 'NOT_APPLICABLE'})

    def call(self, stage, logical, function, *args, native_ids=(), fallback=False, **kwargs):
        if evidence_digest(self.contract) != self.contract_revision: raise ValueError('changed-processing-contract')
        if len(self.entries) >= 256: raise ValueError('processing-receipt-budget')
        requested_ids = list(native_ids)
        routed_ids = self.contract.get('processingNativeRoutes', {}).get(logical)
        if routed_ids is not None:
            if requested_ids and requested_ids != routed_ids:
                raise ValueError('wrong-processing-native-route')
            requested_ids = list(routed_ids)
        declared_ids = {entry['id'] for entry in self.contract.get('native', [])}
        if (len(requested_ids) > 4096 or any(not isinstance(identity, str) for identity in requested_ids) or
                len(requested_ids) != len(set(requested_ids)) or not set(requested_ids) <= declared_ids):
            raise ValueError('unexpected-processing-native-identity')
        before = scoped_native_load_observation(self.root, self.contract)
        if before['unexpected'] or before['ambiguous']:
            raise ValueError('unexpected-or-ambiguous-scoped-native-load')
        import inspect
        import importlib.metadata
        module = sys.modules.get(function.__module__)
        source = inspect.getsourcefile(function)
        entry = next((e for e in self.contract['imports'] if e['module'] == function.__module__), None)
        status = 'OBSERVED_UNVERIFIED'; artifact = None
        if source and entry and Path(source).resolve() == resolve(self.root, entry['path']).resolve():
            try:
                artifact = VERIFIER.verify(self.root, entry['path'], entry,
                    identity=entry['id'], version=entry['version'], build=self.contract['buildRevision'])['digest']
                status = 'VERIFIED_ENTRY'
            except (ValueError, OSError): pass
        version = getattr(module, '__version__', None)
        if version is None:
            try: version = importlib.metadata.version(function.__module__.split('.')[0])
            except importlib.metadata.PackageNotFoundError: version = None
        value = {'stage': stage, 'logicalId': logical, 'actualImplementation': function.__module__+'.'+function.__name__,
            'version': version, 'artifactDigest': artifact, 'architecture': platform.machine(),
            'nativeIds': requested_ids, 'nativeIdentity': 'UNVERIFIED', 'fallback': fallback,
            'nativeRouteEvidence': 'AUTHENTICATED_DECLARATION_ONLY' if routed_ids is not None else 'CALLER_REQUESTED_ONLY',
            'externalExecutable': False, 'status': status, 'completed': False}
        if fallback or status != 'VERIFIED_ENTRY' or (version is not None and version != entry['version']):
            raise ValueError('unverified-or-fallback-processing-backend')
        self.entries.append(value)
        try:
            result = function(*args, **kwargs)
        except BaseException:
            value['status'] = 'FAILED'
            raise
        mapped = mapped_native_receipts(self.root, self.contract) if self.contract.get('native') else {'complete': False, 'entries': []}
        if evidence_digest(self.contract) != self.contract_revision:
            value['status'] = 'FAILED'
            raise ValueError('changed-processing-contract')
        after = scoped_native_load_observation(self.root, self.contract, mapped=mapped)
        value['scopedLoadEvidence'] = {'beforeDigest': evidence_digest(before), 'afterDigest': evidence_digest(after),
            'observedCount': len(after['observed']), 'unexpectedCount': len(after['unexpected']),
            'unresolvedCount': len(after['unresolved']), 'ambiguousCount': len(after['ambiguous']),
            'complete': False, 'nativeNetwork': 'UNVERIFIED', 'runtimeEdges': 'UNVERIFIED'}
        if after['unexpected'] or after['ambiguous']:
            value['status'] = 'FAILED'
            raise ValueError('unexpected-or-ambiguous-scoped-native-load')
        declared_ids = {entry['id'] for entry in self.contract.get('native', [])}
        if len(requested_ids) != len(set(requested_ids)) or any(identity not in declared_ids for identity in requested_ids):
            value['status'] = 'FAILED'
            raise ValueError('unexpected-processing-native-identity')
        selected = [entry for entry in mapped['entries'] if entry['id'] in requested_ids]
        selected_ids = {entry['id'] for entry in selected}
        missing_ids = [identity for identity in requested_ids if identity not in selected_ids]
        statuses = {}
        for entry in selected:
            statuses[entry['status']] = statuses.get(entry['status'], 0) + 1
        native_observed = (bool(requested_ids) and not missing_ids and
            all(entry.get('mapped') is True and entry.get('diskIntegrity') == 'VERIFIED' and
                entry.get('architecture') == self.contract['architecture'] and
                entry.get('status') == 'OBSERVED_UNVERIFIED' for entry in selected))
        value['nativeIdentity'] = 'OBSERVED_UNVERIFIED' if native_observed else 'UNVERIFIED'
        value['mappedEvidence'] = {'complete': False, 'entryCount': len(selected),
            'entriesDigest': evidence_digest(selected), 'scope': 'REQUESTED_DECLARED_HANDLES_ONLY',
            'requestedNativeIds': requested_ids, 'missingNativeIds': missing_ids,
            'statusCounts': statuses, 'allRequestedObserved': native_observed,
            'mappedIntegrity': 'UNVERIFIED'}
        value['completed'] = True
        return result

    def snapshot(self):
        # Actual mapped native and Basic Pitch internal decode paths are still open.
        return {'version': 1, 'entries': copy.deepcopy(self.entries), 'complete': False,
            'status': 'PARTIAL' if self.entries else 'NOT_OBSERVED',
            'reason': 'mapped-native-and-all-processing-stages-unverified'}


def processing_backend_inventory(contract, modules=None):
    modules = sys.modules if modules is None else modules
    codec = contract['codec']; sf = modules.get('soundfile')
    return {'version': 1, 'complete': False, 'entries': [
        {'stage': 'decoder', 'logicalId': 'audio-input', 'actualBackend': 'soundfile' if sf else None,
         'version': getattr(sf, '__version__', None), 'expectedVersion': codec['version'],
         'nativeIds': codec['nativeIds'], 'architecture': platform.machine(),
         'status': 'OBSERVED_ONLY' if sf else 'NOT_OBSERVED', 'fallback': False,
         'nativeBackendVersion': getattr(sf, '__libsndfile_version__', None)},
        {'stage': 'basic-pitch-input', 'status': 'UNVERIFIED', 'reason': 'internal-decoder-resample-not-intercepted'},
        {'stage': 'demucs-resample', 'status': 'NOT_OBSERVED', 'reason': 'only-receipted-when-rate-conversion-called'},
        {'stage': 'stem-writer', 'status': 'NOT_OBSERVED', 'reason': 'selected-writer-call-not-yet-receipted'}]}


def scoped_native_load_observation(root, contract, *, modules=None, mapped=None):
    """Exact handles + declared namespace extension entries, never a process image list.

    Detects contradictions in this bounded coverage only. An empty unexpected
    set never proves the absence of hidden direct dlopen or transient loads.
    """
    modules = sys.modules if modules is None else modules
    entries = contract.get('native', [])
    if len(entries) > 4096: raise ValueError('scoped-native-observation-budget')
    expected = [entry['id'] for entry in entries]
    ambiguous = sorted({identity for identity in expected if expected.count(identity) > 1})
    paths = _declared_native_path_index(root, entries)
    ambiguous += sorted({entry['id'] for values in paths.values() if len(values) > 1 for entry in values})
    if mapped is None:
        mapped = mapped_native_receipts(root, contract) if entries else {'entries': [], 'complete': False}
    observed = []; unexpected = []; unresolved = []
    seen = set()
    for entry in mapped.get('entries', []):
        identity = entry.get('id')
        if identity in seen: ambiguous.append(identity)
        seen.add(identity)
        if identity not in expected or entry.get('status') == 'UNEXPECTED_OBSERVED': unexpected.append(identity)
        elif (entry.get('mapped') and entry.get('diskIntegrity') == 'VERIFIED' and
                entry.get('architecture') == contract['architecture'] and entry.get('status') == 'OBSERVED_UNVERIFIED'):
            observed.append(identity)
        else: unresolved.append(identity)
    unresolved.extend(identity for identity in expected if identity not in seen)
    namespaces = set(contract.get('namespaces', []))
    scoped_modules = [name for name in modules if name.split('.')[0] in namespaces]
    if len(scoped_modules) > 4096: raise ValueError('scoped-module-observation-budget')
    for name in scoped_modules:
        module = modules[name]; spec = getattr(module, '__spec__', None)
        if not isinstance(getattr(spec, 'loader', None), importlib.machinery.ExtensionFileLoader): continue
        origin = getattr(spec, 'origin', None); source = getattr(module, '__file__', None)
        candidates = paths.get(str(Path(origin).resolve()), []) if isinstance(origin, str) else []
        if (len(candidates) != 1 or not source or Path(source).resolve() != Path(origin).resolve() or
                candidates[0]['module'] != name or candidates[0]['kind'] != 'EXTENSION'):
            unexpected.append('module:'+name)
    return {'version': 1, 'scope': 'EXACT_DECLARED_HANDLES_AND_DECLARED_NAMESPACE_EXTENSIONS',
            'contractRevision': evidence_digest(contract),
            'expected': sorted(set(expected)), 'observed': sorted(set(observed)),
            'unexpected': sorted(set(unexpected)), 'unresolved': sorted(set(unresolved)),
            'ambiguous': sorted(set(ambiguous)), 'complete': False, 'status': 'OBSERVED_UNVERIFIED',
            'coverage': 'PARTIAL', 'runtimeEdges': 'UNVERIFIED', 'mappedIntegrity': 'UNVERIFIED',
            'blockedBy': ['runtime-loader-edge-proof', 'mapped-memory-integrity', 'unobserved-direct-native-loads']}


def _declared_native_path_index(root, entries):
    result = {}
    for entry in entries:
        try:
            absolute = resolve(root, entry['path']).resolve()
        except (ValueError, OSError):
            continue
        # A trusted root may itself be an OS alias (macOS /var -> /private/var).
        # Index both known root spellings for this declared relative path only.
        # Do not resolve arbitrary dependency/search candidates to find aliases.
        lexical = _lexical_native_path(Path(root).absolute() / entry['path'])
        for spelling in {str(absolute), str(lexical)}:
            result.setdefault(spelling, []).append(entry)
    return result


def _expand_macho_path(parent_path, value, rpaths):
    """Resolve only loader-relative/rpath candidates; never probe system paths."""
    parent = Path(parent_path)
    if value.startswith('@loader_path/'):
        return [_lexical_native_path(parent.parent / value[len('@loader_path/'):])], 'LOADER_PATH'
    if value.startswith('@rpath/'):
        suffix = value[len('@rpath/'):]
        candidates = []
        for rpath in rpaths:
            if rpath == '@loader_path':
                candidates.append(_lexical_native_path(parent.parent / suffix))
            elif rpath.startswith('@loader_path/'):
                candidates.append(_lexical_native_path(parent.parent / rpath[len('@loader_path/'):] / suffix))
            else:
                return [], 'UNSUPPORTED_MACHO_RPATH'
        return candidates, 'RPATH_DECLARED_ONLY'
    if value.startswith('@executable_path/'):
        return [], 'EXECUTABLE_PATH_UNRESOLVED'
    candidate = Path(value)
    if candidate.is_absolute():
        return [_lexical_native_path(candidate)], 'ABSOLUTE_DECLARED_ONLY'
    return [], 'UNSUPPORTED_LOAD_PATH'


def _lexical_native_path(value):
    # Candidate paths never cause filesystem probing outside declared artifacts.
    import os
    return Path(os.path.normpath(str(value)))


def _select_declared_native(root, entries, parent_path, name, rpaths):
    index = _declared_native_path_index(root, entries)
    candidates, mode = _expand_macho_path(parent_path, name, rpaths)
    matches = []
    for candidate in candidates:
        matches.extend(index.get(str(candidate), []))
    unique = {entry['id']: entry for entry in matches}
    return (next(iter(unique.values())) if len(unique) == 1 else None), mode, sorted(unique)


def _native_read(stream, offset, size, limit):
    """Every allocation is bounded; offset/size are checked before seeking."""
    if offset < 0 or size < 0 or size > MAX_CONTRACT_BYTES or offset + size > limit:
        raise ValueError('native-image-range-or-budget')
    stream.seek(offset)
    raw = stream.read(size)
    if len(raw) != size: raise ValueError('truncated-native-image')
    return raw


def _macho_slice(stream, limit, architecture):
    """Select exactly one CPU slice. Never infer a subtype or loader selection."""
    import struct
    magic = _native_read(stream, 0, 4, limit)
    formats = {b'\xca\xfe\xba\xbe': ('>', False), b'\xbe\xba\xfe\xca': ('<', False),
               b'\xca\xfe\xba\xbf': ('>', True), b'\xbf\xba\xfe\xca': ('<', True)}
    if magic not in formats: return 0, limit, None
    endian, wide = formats[magic]
    count = struct.unpack(endian+'I', _native_read(stream, 4, 4, limit))[0]
    if not 0 < count <= 64: raise ValueError('fat-slice-budget')
    width = 32 if wide else 20
    table_end = 8 + count * width
    table = _native_read(stream, 8, count * width, limit)
    slices = []; candidates = []
    cpu_names = {0x1000007: 'x86_64', 0x100000c: 'arm64'}
    for i in range(count):
        values = struct.unpack_from(endian+('IIQQII' if wide else 'IIIII'), table, i*width)
        cpu, subtype, offset, size, align = values[:5]
        if (size < 32 or offset < table_end or offset + size > limit or align > 31 or
                offset % (1 << align) or (wide and values[5] != 0)):
            raise ValueError('invalid-fat-slice')
        if any(offset < end and start < offset+size for start, end in slices):
            raise ValueError('overlapping-fat-slices')
        slices.append((offset, offset+size))
        if cpu_names.get(cpu) == architecture: candidates.append((offset, size, cpu, subtype))
    if len(candidates) != 1: raise ValueError('missing-or-ambiguous-fat-architecture')
    offset, size, cpu, subtype = candidates[0]
    header = _native_read(stream, offset, 12, offset+size)
    endian = {b'\xcf\xfa\xed\xfe': '<', b'\xfe\xed\xfa\xcf': '>'}.get(header[:4])
    if endian is None or struct.unpack_from(endian+'II', header, 4) != (cpu, subtype):
        raise ValueError('fat-slice-header-mismatch')
    return offset, offset+size, {'sliceCount': count, 'selectedArchitecture': architecture,
                                'selection': 'UNIQUE_DECLARED_CPU_ONLY', 'runtimeSelectionVerified': False}


def _elf_routes(stream, limit, architecture):
    """ELF64 program headers only, bounded DT strings; no sections/tool/env search."""
    import struct
    header = _native_read(stream, 0, 64, limit)
    if header[:4] != b'\x7fELF' or header[4] != 2 or header[5] not in (1, 2) or header[6] != 1:
        raise ValueError('unsupported-elf-format')
    endian = '<' if header[5] == 1 else '>'
    fields = struct.unpack(endian+'HHIQQQIHHHHHH', header[16:])
    kind, machine, version, _, phoff, _, _, ehsize, phsize, phcount, _, _, _ = fields
    actual_arch = {62: 'x86_64', 183: 'arm64'}.get(machine)
    if (kind not in (2, 3) or version != 1 or ehsize != 64 or phsize != 56 or
            not 0 < phcount <= 1024 or phoff < 64 or actual_arch != architecture):
        raise ValueError('elf-header-or-architecture')
    raw = _native_read(stream, phoff, phcount*phsize, limit)
    loads = []; dynamic = []
    for i in range(phcount):
        tag, _, offset, address, _, size, memory, _ = struct.unpack_from(endian+'IIQQQQQQ', raw, i*56)
        if offset+size > limit or size > memory: raise ValueError('elf-segment-range')
        if tag == 1: loads.append((address, address+size, offset))
        if tag == 2: dynamic.append((offset, size))
    if len(dynamic) != 1: raise ValueError('missing-or-ambiguous-elf-dynamic')
    offset, size = dynamic[0]
    if size % 16 or size > 4096*16: raise ValueError('elf-dynamic-budget')
    raw = _native_read(stream, offset, size, limit)
    tags = {}; needed = []; ended = False
    for i in range(0, size, 16):
        tag, value = struct.unpack_from(endian+'qQ', raw, i)
        if tag == 0: ended = True; break
        if tag == 1: needed.append(value)
        elif tag in (5, 10, 15, 29):
            if tag in tags: raise ValueError('duplicate-elf-dynamic-tag')
            tags[tag] = value
        elif tag in (0x7fffffff, 0x7ffffffd, 0x6ffffefb, 0x6ffffefc):
            raise ValueError('unsupported-elf-filter-or-audit-route')
    if not ended or not {5, 10} <= set(tags) or not 0 < tags[10] <= MAX_CONTRACT_BYTES:
        raise ValueError('elf-string-table-budget')
    matches = [file_offset+tags[5]-start for start, end, file_offset in loads
               if start <= tags[5] and tags[5]+tags[10] <= end]
    if len(matches) != 1: raise ValueError('ambiguous-or-unmapped-elf-strings')
    strings = _native_read(stream, matches[0], tags[10], limit)
    def string(index):
        if index >= len(strings): raise ValueError('elf-string-index')
        end = strings.find(b'\0', index, min(len(strings), index+4097))
        if end < 0: raise ValueError('unterminated-or-overbudget-elf-string')
        value = strings[index:end].decode('utf8')
        if not value: raise ValueError('empty-elf-route')
        return value
    names = [string(index) for index in needed]
    rpath = string(tags[15]).split(':') if 15 in tags else []
    runpath = string(tags[29]).split(':') if 29 in tags else None
    if len(rpath) > 128 or (runpath is not None and len(runpath) > 128):
        raise ValueError('elf-search-path-budget')
    return {'format': 'ELF64', 'architecture': actual_arch, 'commands': names,
            'rpaths': rpath, 'runpaths': runpath, 'slice': None}


def native_image_routes(path, architecture):
    """Bounded disk syntax, not an authenticated runtime loader-edge proof."""
    import os
    import struct
    from artifact_verification import stamp
    with Path(path).open('rb') as stream:
        before = os.fstat(stream.fileno()); limit = before.st_size
        if _native_read(stream, 0, 4, limit) == b'\x7fELF':
            result = _elf_routes(stream, limit, architecture)
        else:
            base, end, selection = _macho_slice(stream, limit, architecture)
            header = _native_read(stream, base, 32, end)
            endian = {b'\xcf\xfa\xed\xfe': '<', b'\xfe\xed\xfa\xcf': '>'}.get(header[:4])
            if endian is None: raise ValueError('unsupported-native-image')
            _, cpu, _, _, count, size, _, _ = struct.unpack(endian+'8I', header)
            actual_arch = {0x1000007: 'x86_64', 0x100000c: 'arm64'}.get(cpu)
            if actual_arch != architecture or count > 4096 or size > MAX_CONTRACT_BYTES:
                raise ValueError('native-architecture-or-command-budget')
            raw = _native_read(stream, base+32, size, end)
            names = []; rpaths = []; offset = 0
            for _ in range(count):
                if offset+8 > size: raise ValueError('truncated-native-command')
                command, length = struct.unpack_from(endian+'II', raw, offset)
                if length < 8 or length % 8 or offset+length > size:
                    raise ValueError('invalid-native-command-size')
                if command in (0xe, 0x27):
                    raise ValueError('unsupported-macho-loader-or-environment-route')
                minimum = 12 if command == 0x8000001c else 24 if command in (0xc, 0x80000018, 0x8000001f, 0x80000023, 0x20) else None
                if minimum is not None:
                    if length < minimum: raise ValueError('invalid-native-route-command')
                    index = struct.unpack_from(endian+'I', raw, offset+8)[0]
                    if not minimum <= index < length: raise ValueError('invalid-native-route-name')
                    encoded = raw[offset+index:offset+length]
                    if b'\0' not in encoded: raise ValueError('unterminated-native-route')
                    name = encoded.split(b'\0', 1)[0].decode('utf8')
                    if not name or len(name) > 4096: raise ValueError('native-route-budget')
                    (rpaths if command == 0x8000001c else names).append(name)
                offset += length
            if offset != size: raise ValueError('native-command-size-mismatch')
            if len(rpaths) > 128: raise ValueError('native-rpath-budget')
            result = {'format': 'MACHO64', 'architecture': actual_arch, 'commands': names,
                      'rpaths': rpaths, 'runpaths': None, 'slice': selection}
        if stamp(before) != stamp(os.fstat(stream.fileno())) or stamp(before) != stamp(Path(path).stat()):
            raise ValueError('changed-native-image')
        return result


def _select_declared_elf(root, entries, parent_path, name, rpaths, runpaths):
    index = _declared_native_path_index(root, entries)
    candidates = []; unsupported = False
    paths = runpaths if runpaths is not None else rpaths
    def expand(value):
        if value == '$ORIGIN' or value == '${ORIGIN}': return Path(parent_path).parent
        for prefix in ('$ORIGIN/', '${ORIGIN}/'):
            if value.startswith(prefix) and '$' not in value[len(prefix):]:
                return Path(parent_path).parent / value[len(prefix):]
        if '$' not in value and Path(value).is_absolute(): return Path(value)
        return None
    if '/' in name:
        direct = expand(name)
        if direct is None: unsupported = True
        else: candidates.append(_lexical_native_path(direct))
    else:
        for route in paths:
            directory = expand(route)
            if directory is None: unsupported = True
            else: candidates.append(_lexical_native_path(directory/name))
    matches = {entry['id']: entry for candidate in candidates for entry in index.get(str(candidate), [])}
    mode = 'ELF_RUNPATH_DECLARED_ONLY' if runpaths is not None else 'ELF_RPATH_DECLARED_ONLY'
    if unsupported: return None, 'UNSUPPORTED_ELF_SEARCH_ROUTE', sorted(matches)
    return (next(iter(matches.values())) if len(matches) == 1 else None), mode, sorted(matches)


def scoped_macho_dependencies(root, contract):
    """Compatibility entry point: declared thin/fat Mach-O and ELF disk routing.

    LC_RPATH and ELF DT_RPATH/RUNPATH are honored only for lexical candidates
    matching authenticated declared artifacts. Absolute paths likewise match
    declared artifacts only. No filesystem search,
    dyld image enumeration, subprocess, environment lookup, or system probing
    occurs. Static routing evidence never becomes a verified runtime loader edge.
    """
    import struct
    edges = []; entries = contract['native']
    for entry in entries:
        if len(edges) >= 4096:
            edges.append({'parent': entry['id'], 'status': 'OBSERVED_UNVERIFIED', 'reason': 'global-native-edge-budget'})
            break
        if entry['kind'] not in ('EXTENSION', 'SHARED_LIBRARY', 'FRAMEWORK'): continue
        try:
            path = resolve(root, entry['path'])
            VERIFIER.verify(root,entry['path'],entry,identity=entry['id'],version=entry['version'],build=contract['buildRevision'])
            routing = native_image_routes(path, contract['architecture'])
            VERIFIER.verify(root,entry['path'],entry,identity=entry['id'],version=entry['version'],build=contract['buildRevision'])
            commands = routing['commands']; rpaths = routing['rpaths']
            for name in commands:
                if len(edges) >= 4096: raise ValueError('global-native-edge-budget')
                if routing['format'] == 'ELF64':
                    child, resolution, matches = _select_declared_elf(root, entries, path, name, rpaths, routing['runpaths'])
                else:
                    child, resolution, matches = _select_declared_native(root, entries, path, name, rpaths)
                proof=None; observed=False
                if child is None:
                    status='UNEXPECTED_OBSERVED'
                    reason='ambiguous-or-undeclared-native-route' if matches else 'unresolved-native-route'
                else:
                    loaded=scoped_loaded_library(root,child);observed=loaded['actualLoaded'];reason=None
                    try:
                        proof=VERIFIER.verify(root,child['path'],child,identity=child['id'],version=child['version'],build=contract['buildRevision'])
                        status='OBSERVED_UNVERIFIED' if observed else 'EXPECTED_NOT_OBSERVED'
                    except FileNotFoundError: status='MISSING'
                    except (OSError,ValueError): status='OBSERVED_UNVERIFIED'
                edge={'parent':entry['id'],'child':child['id'] if child else None,
                    'status':status,'evidence':'DISK_DYNAMIC_TAG_DECLARED_ROUTE' if routing['format'] == 'ELF64' else 'DISK_LOAD_COMMAND_DECLARED_ROUTE',
                    'resolution':resolution,'actualLoaded':observed,
                    'artifactDigest':proof['digest'] if proof else None,
                    'parentArtifactDigest':entry['digest'],
                    'architecture':routing['architecture'], 'imageFormat':routing['format'],
                    'sliceSelection':routing['slice'],
                    'routeState': 'AMBIGUOUS' if len(matches) > 1 else 'UNRESOLVED' if child is None else 'EXPECTED',
                    'mappedIntegrity':'UNVERIFIED','runtimeEdgeVerified':False}
                if reason: edge['reason']=reason
                if matches: edge['declaredCandidateIds']=matches
                edges.append(edge)
        except (ValueError,OSError,UnicodeError,struct.error):
            edges.append({'parent':entry['id'],'status':'OBSERVED_UNVERIFIED',
                'reason':'global-native-edge-budget' if len(edges) >= 4096 else 'invalid-or-missing-native-image'})
            if len(edges) > 4096: break
    return {'version':3,'edges':edges,'complete':False,'scope':'DECLARED_NATIVE_IMAGES_AND_DECLARED_RPATHS_ONLY',
        'contractRevision':evidence_digest(contract),
        'reason':'declared-static-routing-and-exact-loaded-presence-do-not-prove-runtime-loader-edges'}


def local_audio_path(path):
    value = str(path)
    if '://' in value or value.startswith(('http:', 'https:', 'ftp:', 'pipe:', 'tcp:', 'udp:')):
        raise ValueError('remote-or-protocol-codec-input')
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('missing-or-unsafe-codec-input')
    return path


def decode_soundfile(module, path, expected_version, receipt=None):
    """Explicit single backend, never system executable/torchaudio dispatch fallback."""
    path = local_audio_path(path)
    if module.__version__ != expected_version:
        raise ValueError('wrong-codec-version')
    if receipt is not None:
        return receipt.call('decoder','audio-input',module.read,str(path),
            native_ids=receipt.contract['codec']['nativeIds'],dtype='float32',always_2d=True)
    return module.read(str(path), dtype='float32', always_2d=True)


class ScopedImportGuard(importlib.abc.MetaPathFinder):
    """Allowlisted dynamic resolution inside declared runtime namespaces only.

    This does not intercept native dlopen or every Python import mechanism.
    Snapshot observation also checks preloaded entries and bypass mismatches.
    """
    def __init__(self, root, contract, verifier=VERIFIER):
        self.root = root
        self.contract = copy.deepcopy(validate(contract))
        self.verifier = verifier
        self.bindings = {e['module']: e for e in self.contract['imports']}

    def find_spec(self, fullname, path=None, target=None):
        if fullname.split('.')[0] not in self.contract['namespaces']:
            return None
        entry = self.bindings.get(fullname)
        if entry is None:
            raise ImportError('unexpected-scoped-dynamic-import')
        spec = importlib.machinery.PathFinder.find_spec(fullname, path)
        expected = resolve(self.root, entry['path'])
        if spec is None or not spec.origin or Path(spec.origin).resolve() != expected.resolve():
            raise ImportError('missing-or-wrong-scoped-module-source')
        self.verifier.verify(self.root, entry['path'], entry, identity=entry['id'],
                             version=entry['version'], build=self.contract['buildRevision'])
        if isinstance(getattr(spec, 'loader', None), importlib.machinery.SourceFileLoader):
            spec.loader = VerifiedSourceLoader(expected, entry)
        return spec


class VerifiedSourceLoader(importlib.abc.Loader):
    """Compile the same authenticated source bytes; never use stale bytecode cache."""
    def __init__(self, path, expected):
        self.path = path
        self.expected = copy.deepcopy(expected)

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        with self.path.open('rb') as stream:
            raw = stream.read(MAX_CONTRACT_BYTES + 1)
        if (len(raw) > MAX_CONTRACT_BYTES or len(raw) != self.expected['byteLength'] or
                hashlib.sha256(raw).hexdigest() != self.expected['digest']):
            raise ImportError('stale-scoped-module-source')
        exec(compile(raw, str(self.path), 'exec'), module.__dict__)


def install_import_guard(root, contract):
    guard = ScopedImportGuard(root, contract)
    sys.meta_path.insert(0, guard)
    return guard


def assembly_evidence(runtime):
    """Disk evidence never substitutes for observed imports, codecs or native isolation."""
    try:
        contract = load(runtime)
        evidence = observe(runtime.root, contract, build=runtime.manifest['buildRevision'])
        binding = next(e for e in runtime.bindings['native'] if e.get('id') == 'python-runtime')
        runtime.resolve_executable('python-runtime', resolve(runtime.root, binding['path']))
        return {'complete': False, 'runtimeEvidence': evidence, 'requiredLocalExecutable':
                copy.deepcopy(runtime.native['python-runtime']),
                'requirements': {'mappedNativeExpectation': [e['id'] for e in contract['native']],
                    'transitiveNativeGraph': 'REQUIRED_RUNTIME_OBSERVATION', 'codecArtifacts': contract['codec'],
                    'nativeNetworkContainment': 'REQUIRED_NOT_PROVIDED', 'processingChain': 'REQUIRED_ACTUAL_CALLS'},
                'runtimeObservationSatisfied': False, 'reason': 'native-network-and-observed-runtime-acceptance-open'}
    except (ValueError, OSError, KeyError, TypeError, AttributeError, StopIteration):
        return {'complete': False, 'reason': 'missing-or-invalid-runtime-evidence',
                'network': {'native': 'UNVERIFIED'}}


def evidence_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
        ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def native_architecture(path, expected=None):
    """Bounded architecture observation, fat slice selected by declared CPU only."""
    if expected is not None:
        try: return native_image_routes(path, expected)['architecture']
        except (ValueError, OSError): return 'UNSUPPORTED'
    import struct
    with Path(path).open('rb') as stream:
        header = stream.read(32)
    if len(header) >= 20 and header[:4] == b'\x7fELF' and header[5] in (1, 2):
        machine = struct.unpack_from('<H' if header[5] == 1 else '>H', header, 18)[0]
        return {62: 'x86_64', 183: 'arm64'}.get(machine, 'UNSUPPORTED')
    if len(header) == 32 and header[:4] == b'\xcf\xfa\xed\xfe':
        return {0x1000007: 'x86_64', 0x100000c: 'arm64'}.get(struct.unpack_from('<I', header, 4)[0], 'UNSUPPORTED')
    return 'UNSUPPORTED'


def exact_mapped_path(path, symbol=None):
    """Return a private path for ONE already-loaded declared handle.

    Linux reads only that handle's link_map name (never l_next/l_prev). Darwin
    uses dladdr on one explicitly approved symbol, never dyld image enumeration.
    No load fallback; no symbol execution; no path/address enters the report.
    """
    import ctypes
    import os
    import _ctypes
    if platform.system() not in ('Linux', 'Darwin') or not hasattr(os, 'RTLD_NOLOAD'):
        return None, 'UNSUPPORTED'
    try:
        library = ctypes.CDLL(str(path), mode=os.RTLD_NOLOAD | os.RTLD_NOW)
    except OSError:
        return None, 'EXPECTED_NOT_OBSERVED'
    try:
        api = ctypes.CDLL(None)
        if platform.system() == 'Linux':
            class LinkMap(ctypes.Structure):
                _fields_ = [('address', ctypes.c_void_p), ('name', ctypes.c_char_p)]
            info = getattr(api, 'dlinfo', None)
            if info is None: return None, 'UNSUPPORTED'
            info.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
            info.restype = ctypes.c_int
            pointer = ctypes.POINTER(LinkMap)()
            if info(library._handle, 2, ctypes.byref(pointer)) != 0 or not pointer or not pointer.contents.name:
                return None, 'OBSERVED_UNVERIFIED'
            return Path(os.fsdecode(pointer.contents.name)), 'DLINFO_EXACT_HANDLE'
        if not symbol: return None, 'UNSUPPORTED'
        class DlInfo(ctypes.Structure):
            _fields_ = [('name', ctypes.c_char_p), ('base', ctypes.c_void_p),
                        ('symbol', ctypes.c_char_p), ('symbol_address', ctypes.c_void_p)]
        lookup = api.dlsym; lookup.argtypes = [ctypes.c_void_p, ctypes.c_char_p]; lookup.restype = ctypes.c_void_p
        address = lookup(library._handle, symbol.encode('ascii'))
        if not address: return None, 'OBSERVED_UNVERIFIED'
        info = api.dladdr; info.argtypes = [ctypes.c_void_p, ctypes.POINTER(DlInfo)]; info.restype = ctypes.c_int
        result = DlInfo()
        if not info(address, ctypes.byref(result)) or not result.name: return None, 'OBSERVED_UNVERIFIED'
        return Path(os.fsdecode(result.name)), 'DLADDR_DECLARED_SYMBOL'
    except (AttributeError, OSError, UnicodeError):
        return None, 'UNSUPPORTED'
    finally:
        _ctypes.dlclose(library._handle)


def mapped_native_receipts(root, contract):
    entries = []; probes = contract.get('mappedSymbols', {})
    for entry in contract['native']:
        if entry['kind'] not in ('EXTENSION', 'SHARED_LIBRARY', 'FRAMEWORK'): continue
        value = {'id': entry['id'], 'parentComponent': entry['module'],
            'expectedIdentity': {'digest': entry['digest'], 'version': entry['version']},
            'actualMappedArtifact': None, 'diskIntegrity': 'UNVERIFIED', 'diskDigest': None,
            'architecture': 'UNSUPPORTED', 'mapped': False, 'mappedIntegrity': 'UNVERIFIED',
            'status': 'OBSERVED_UNVERIFIED', 'observation': 'UNSUPPORTED'}
        try:
            path = resolve(root, entry['path'])
            actual, source = exact_mapped_path(path, probes.get(entry['id']))
            value['observation'] = source
            if actual is not None:
                value['mapped'] = True
                if not actual.is_absolute() or actual.resolve() != path.resolve():
                    value['status'] = 'UNEXPECTED_OBSERVED'
                else:
                    value['actualMappedArtifact'] = entry['id']
                    value['status'] = 'OBSERVED_UNVERIFIED'
            else:
                value['status'] = source if source in ('UNSUPPORTED', 'EXPECTED_NOT_OBSERVED') else 'OBSERVED_UNVERIFIED'
            proof = VERIFIER.verify(root, entry['path'], entry, identity=entry['id'],
                version=entry['version'], build=contract['buildRevision'])
            value.update(diskIntegrity='VERIFIED', diskDigest=proof['digest'], architecture=native_architecture(path, contract['architecture']))
            if value['architecture'] != contract['architecture']:
                value['status'] = 'UNSUPPORTED' if value['architecture'] == 'UNSUPPORTED' else 'OBSERVED_UNVERIFIED'
                value['reason'] = 'architecture-unverified-or-mismatch'
            # Mapping path is observed, but the bytes in memory are NOT hashed.
        except FileNotFoundError:
            value.update(status='MISSING', diskIntegrity='MISSING')
        except (ValueError, OSError):
            value['reason'] = 'disk-artifact-unverified'
        entries.append(value)
    return {'version': 1, 'scope': 'EXACT_DECLARED_HANDLES_ONLY', 'entries': entries,
        'complete': False, 'reason': 'mapped-page-integrity-and-runtime-edges-unverified'}


def stable_processing_inventory(value):
    if isinstance(value, dict):
        return {key: stable_processing_inventory(item) for key, item in value.items() if key not in ('cache', 'processingCalls')}
    if isinstance(value, list): return [stable_processing_inventory(item) for item in value]
    return value


def processing_binding(session, request, input_identity, inventory):
    """Private request binding invalidates on ALL model/codec/native evidence changes."""
    for token in (session, request):
        if not isinstance(token, str) or len(token) != 64 or any(c not in '0123456789abcdef' for c in token):
            raise ValueError('invalid-processing-session-or-request')
    if (not isinstance(input_identity, dict) or set(input_identity) != {'digest', 'byteLength'} or
            type(input_identity['byteLength']) is not int or not 0 < input_identity['byteLength'] <= 500*1024*1024 or
            not isinstance(input_identity['digest'], str) or len(input_identity['digest']) != 64 or
            any(c not in '0123456789abcdef' for c in input_identity['digest'])):
        raise ValueError('invalid-processing-input-identity')
    evidence = inventory.get('runtimeEvidence', {})
    return {'session': session, 'request': request, 'input': copy.deepcopy(input_identity),
        'inventoryRevision': evidence_digest(stable_processing_inventory(inventory)), 'modelIdentity': evidence_digest(inventory.get('models', [])),
        'codecIdentity': evidence_digest(evidence.get('codec', {})),
        'nativeIdentity': evidence_digest({key: evidence.get(key) for key in
            ('mappedNative', 'dynamicNativeGraph', 'transitiveNativeObservation', 'nativeClosure', 'scopedNativeLoads')}),
        'networkIdentity': evidence_digest(evidence.get('network', {}))}


class BoundProcessingReceipt:
    """One attempt, one session, one response. No persistence or reusable attestation."""
    def __init__(self, binding, *, timeout=3600, clock=None):
        import time
        import secrets
        if type(timeout) not in (int, float) or not 0 < timeout <= 3600: raise ValueError('processing-timeout-budget')
        self.clock = clock or time.monotonic; self.deadline = self.clock()+timeout
        if (not isinstance(binding, dict) or set(binding) != {'session', 'request', 'input', 'inventoryRevision',
                'modelIdentity', 'codecIdentity', 'nativeIdentity', 'networkIdentity'} or
                any(not isinstance(binding.get(key), str) or len(binding[key]) != 64 or
                    any(c not in '0123456789abcdef' for c in binding[key]) for key in binding if key != 'input')):
            raise ValueError('invalid-processing-binding')
        self.binding = copy.deepcopy(binding); self.ticket = secrets.token_hex(32)
        self.calls = []; self.children = []; self.state = 'ACTIVE'; self.result = None

    def check(self, binding):
        if self.state != 'ACTIVE' or self.clock() >= self.deadline or binding != self.binding:
            self.abort('stale-or-expired-processing'); raise ValueError('stale-or-expired-processing')

    def add_calls(self, calls):
        if self.state != 'ACTIVE': raise ValueError('inactive-processing')
        entries = calls.get('entries', [])
        if not isinstance(entries, list) or len(self.calls)+len(entries) > 256: raise ValueError('processing-call-budget')
        self.calls.extend(copy.deepcopy(entries))

    def add_child(self, receipt):
        if self.state != 'ACTIVE' or len(self.children) >= 8: raise ValueError('child-processing-budget')
        if (receipt.get('parentBinding') != self.binding or receipt.get('format') != 'NOVA_PROCESSING_RECEIPT' or
                any(receipt.get('binding', {}).get(key) != self.binding[key] for key in ('session', 'request', 'input'))):
            raise ValueError('wrong-child-processing-binding')
        if (receipt.get('complete') is not True or receipt.get('status') != 'VERIFIED' or
                receipt.get('nativeClosureComplete') is not True or receipt.get('networkContainment') != 'CONTAINED' or
                receipt.get('blockedBy') != [] or receipt.get('processingEligible') is not True or
                receipt.get('publicationEligible') is not False):
            raise ValueError('partial-child-processing-chain')
        self.children.append(copy.deepcopy(receipt))

    def finish(self, binding, inventory, output_identity):
        self.check(binding)
        expected = processing_binding(binding['session'], binding['request'], binding['input'], inventory)
        if binding != expected:
            self.abort('changed-processing-inventory'); raise ValueError('changed-processing-inventory')
        if (not isinstance(output_identity, dict) or set(output_identity) != {'digest', 'byteLength'} or
                type(output_identity['byteLength']) is not int or output_identity['byteLength'] <= 0 or
                not isinstance(output_identity['digest'], str) or len(output_identity['digest']) != 64 or
                any(c not in '0123456789abcdef' for c in output_identity['digest'])):
            self.abort('invalid-output-identity'); raise ValueError('invalid-output-identity')
        evidence = inventory.get('runtimeEvidence', {})
        stages = []
        required = ('decoder', 'resample', 'model', 'inference', 'stem', 'encoder', 'result')
        all_calls = self.calls + [call for child in self.children for call in child.get('entries', [])]
        for stage in required:
            calls = [call for call in all_calls if call.get('stage') == stage]
            # Actual call/source identity alone never establishes native backend identity.
            verified = bool(calls) and all(call.get('status') == 'VERIFIED' and call.get('completed') is True
                and call.get('fallback') is False and call.get('nativeIdentity') in ('VERIFIED', 'NOT_APPLICABLE') for call in calls)
            not_applicable = bool(calls) and stage == 'resample' and all(call.get('status') == 'NOT_APPLICABLE' for call in calls)
            stages.append({'stage': stage, 'status': 'VERIFIED' if verified else 'NOT_APPLICABLE' if not_applicable else 'UNVERIFIED' if calls else 'EXPECTED'})
        reasons = ['stage:'+s['stage'] for s in stages if s['status'] not in ('VERIFIED', 'NOT_APPLICABLE')]
        if evidence.get('dynamicNativeGraph', {}).get('complete') is not True: reasons.append('native-closure-incomplete')
        loads = evidence.get('scopedNativeLoads')
        if loads is not None:
            if loads.get('unexpected'): reasons.append('unexpected-scoped-native-load')
            if loads.get('ambiguous'): reasons.append('ambiguous-scoped-native-load')
            if loads.get('unresolved'): reasons.append('unresolved-scoped-native-load')
            if loads.get('complete') is not True: reasons.append('scoped-native-load-coverage-incomplete')
        network = evidence.get('network', {})
        if network.get('native') != 'CONTAINED' or network.get('nativeNetworkVerified') is not True: reasons.append('native-network-unverified')
        if inventory.get('identityComplete') is not True: reasons.append('model-helper-identity-incomplete')
        complete = not reasons
        self.result = {'format': 'NOVA_PROCESSING_RECEIPT', 'version': 1, 'binding': copy.deepcopy(self.binding),
            'entries': copy.deepcopy(self.calls), 'children': copy.deepcopy(self.children), 'stages': stages,
            'output': copy.deepcopy(output_identity), 'complete': complete, 'status': 'VERIFIED' if complete else 'UNVERIFIED',
            'nativeClosureComplete': evidence.get('dynamicNativeGraph', {}).get('complete') is True,
            'networkContainment': network.get('native', 'UNVERIFIED'), 'blockedBy': reasons,
            'processingEligible': complete, 'publicationEligible': False, 'publicationBlockedBy': 'BLOCKED BY BACKEND'}
        self.state = 'FINISHED'
        return copy.deepcopy(self.result)

    def consume(self, receipt, binding):
        if (self.state != 'FINISHED' or self.clock() >= self.deadline or binding != self.binding or
                receipt != self.result or receipt.get('complete') is not True):
            self.abort('invalid-or-partial-processing-response'); raise ValueError('invalid-or-partial-processing-response')
        self.state = 'CONSUMED'; return copy.deepcopy(receipt)

    def abort(self, reason='cancelled'):
        self.state = 'ABORTED'; self.calls.clear(); self.children.clear(); self.result = None


def audio_identity(path):
    """Temporary request bytes only, streamed with before/after identity checks."""
    from artifact_verification import stamp
    path = local_audio_path(path); before = path.stat(); value = hashlib.sha256(); total = 0
    if not 0 < before.st_size <= 500*1024*1024: raise ValueError('processing-audio-budget')
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            total += len(chunk)
            if total > before.st_size: raise ValueError('changed-processing-audio')
            value.update(chunk)
    if total != before.st_size or stamp(before) != stamp(path.stat()): raise ValueError('changed-processing-audio')
    return {'digest': value.hexdigest(), 'byteLength': total}


def runtime_native_closure(mapped, disk_graph):
    """Join static parent edges to independent mapped/disk receipts; never invent edges."""
    actual = {entry['id']: entry for entry in mapped.get('entries', [])}
    edges = []
    for edge in disk_graph.get('edges', []):
        parent = actual.get(edge.get('parent')); child = actual.get(edge.get('child'))
        status = edge['status']
        if edge.get('child') is not None:
            if child is None or child.get('status') == 'MISSING': status = 'MISSING'
            elif child.get('status') == 'UNEXPECTED_OBSERVED': status = 'UNEXPECTED_OBSERVED'
            elif child.get('status') == 'UNSUPPORTED': status = 'UNSUPPORTED'
            elif not child.get('mapped'): status = 'EXPECTED_NOT_OBSERVED'
            else: status = 'OBSERVED_UNVERIFIED'
        edges.append({**copy.deepcopy(edge), 'status': status,
            'parentMapped': bool(parent and parent.get('mapped')),
            'childMapped': bool(child and child.get('mapped')),
            'childDiskIntegrity': child.get('diskIntegrity', 'UNVERIFIED') if child else 'UNVERIFIED',
            'runtimeEdgeVerified': False})
    return {'version': 2, 'edges': edges, 'complete': False,
        'mappedComplete': mapped.get('complete') is True, 'unexpectedLoadDetection': 'UNVERIFIED',
        'reason': 'runtime-transitive-edge-and-unexpected-native-load-coverage-unverified'}


class SessionRequestRegistry:
    """Bounded one-shot request IDs for one owned Helper lifetime, no eviction/replay."""
    def __init__(self, session, capacity=4096):
        import threading
        if not isinstance(session, str) or len(session) != 64 or any(c not in '0123456789abcdef' for c in session):
            raise ValueError('invalid-owned-request-session')
        if type(capacity) is not int or not 0 < capacity <= 4096: raise ValueError('request-registry-budget')
        self.session = session; self.capacity = capacity; self.seen = set(); self.lock = threading.Lock(); self.closed = False

    def claim(self, session, request):
        with self.lock:
            if (self.closed or session != self.session or not isinstance(request, str) or len(request) != 64 or
                    any(c not in '0123456789abcdef' for c in request) or request in self.seen or len(self.seen) >= self.capacity):
                raise ValueError('stale-replayed-or-exhausted-processing-request')
            self.seen.add(request)

    def close(self):
        with self.lock:
            self.closed = True; self.session = ''; self.seen.clear()
