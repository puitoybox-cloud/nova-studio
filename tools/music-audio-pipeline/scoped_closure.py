"""Offline, explicitly scoped artifact graph. Never scans all installed packages."""
import copy
import base64
import csv
import io
import hashlib
import importlib.metadata
import json
import re
from email.parser import BytesParser
from email import policy
from pathlib import Path, PurePosixPath
from runtime_inventory import local, stable
from dependency_identity import verify_local_asset

KINDS = {'PYTHON_DISTRIBUTION','NATIVE_EXTENSION','EXECUTABLE','MODEL','CONFIG','SOURCE','WEB_ASSET','PYTHON_RUNTIME'}
LEVELS = {'VERIFIED_ARTIFACT','VERIFIED_ENTRY_FILE','OBSERVED_METADATA_ONLY','EXPECTED_ONLY','MISSING','UNSUPPORTED','UNVERIFIED'}
MAX_FILES = 4096
MAX_CONTRACT_BYTES = 1024 * 1024
MAX_TOTAL = 16 * 1024**3
MAX_METADATA_BYTES = 1024 * 1024
MAX_LICENSE_BYTES = 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024


def verify_distribution_record(root, node, metadata):
    """Authenticate RECORD itself, then bind each CSV row to approved file bytes.

    Blank installed hashes/sizes are legal metadata, never integrity evidence.
    The externally anchored graph still authenticates every file independently.
    No path scan, package installation, import or approval inference occurs.
    """
    metadata_path = PurePosixPath(metadata['path'])
    record_path = str(metadata_path.parent / 'RECORD')
    files = {f['path']: f for f in node['files']}
    records = [f['path'] for f in node['files'] if PurePosixPath(f['path']).name == 'RECORD'
               and PurePosixPath(f['path']).parent.name.endswith('.dist-info')]
    if records != [record_path]:
        raise ValueError('missing-or-ambiguous-installed-record')
    if sum(f['byteLength'] for f in node['files']) > MAX_TOTAL:
        raise ValueError('installed-record-total-byte-budget')
    binding = files.get(record_path)
    if binding is None:
        raise ValueError('missing-authenticated-installed-record')
    verify_local_asset(root, record_path, binding, MAX_RECORD_BYTES)
    with local(root, record_path).open('rb') as stream:
        raw = stream.read(MAX_RECORD_BYTES + 1)
    if len(raw) != binding['byteLength'] or hashlib.sha256(raw).hexdigest() != binding['digest']:
        raise ValueError('stale-installed-record')
    base = metadata_path.parent.parent
    seen = set(); hashed = 0; omitted_hash = 0; omitted_size = 0
    try:
        rows = csv.reader(io.StringIO(raw.decode('utf-8'), newline=''), strict=True)
        for row in rows:
            if len(seen) >= MAX_FILES or len(row) != 3:
                raise ValueError('installed-record-row-budget-or-shape')
            name, encoded, size = row
            if (not name or '\\' in name or ':' in name or '\x00' in name or
                    PurePosixPath(name).is_absolute() or any(p in ('', '.') for p in name.split('/'))):
                raise ValueError('unsafe-installed-record-path')
            # Standard script rows can traverse above site-packages, but never
            # above this approved private generation. Normalize lexically first.
            parts = list(base.parts)
            for part in name.split('/'):
                if part == '..':
                    if not parts: raise ValueError('installed-record-generation-escape')
                    parts.pop()
                else: parts.append(part)
            relative = '/'.join(parts)
            if relative in seen or relative not in files:
                raise ValueError('duplicate-or-unapproved-installed-record-file')
            seen.add(relative); expected = files[relative]
            path = local(root, relative); before = stable(path)
            from artifact_verification import VERIFIER
            VERIFIER.verify(root, relative, expected, 8*1024**3,
                            identity=node['id']+':'+relative, version=node['version'])
            if size:
                if not re.fullmatch(r'0|[1-9][0-9]*', size) or size != str(expected['byteLength']):
                    raise ValueError('installed-record-size-mismatch')
            else: omitted_size += 1
            if encoded:
                algorithm, separator, value = encoded.partition('=')
                if not separator or algorithm not in {'sha256', 'sha384', 'sha512'}:
                    raise ValueError('unsupported-installed-record-hash')
                digest = hashlib.new(algorithm)
                total = 0
                with path.open('rb') as stream:
                    while True:
                        chunk = stream.read(65536)
                        if not chunk: break
                        total += len(chunk)
                        if total > expected['byteLength']: raise ValueError('changed-installed-record-file')
                        digest.update(chunk)
                if total != expected['byteLength'] or value != base64.urlsafe_b64encode(digest.digest()).rstrip(b'=').decode('ascii'):
                    raise ValueError('installed-record-hash-mismatch')
                hashed += 1
            else: omitted_hash += 1
            if stable(path) != before: raise ValueError('changed-installed-record-file')
    except (UnicodeError, csv.Error):
        raise ValueError('invalid-installed-record-csv') from None
    if seen != set(files): raise ValueError('incomplete-authenticated-installed-record')
    return {'path': record_path, 'digest': binding['digest'], 'byteLength': binding['byteLength'],
            'status': 'VERIFIED_AUTHENTICATED_RECORD', 'fileCount': len(seen),
            'verifiedDeclaredHashes': hashed, 'omittedHashes': omitted_hash, 'omittedSizes': omitted_size,
            'integrityAuthority': 'EXTERNALLY_ANCHORED_FILE_GRAPH', 'redistributionApproved': False}


def verified_license_materials(root, node, message, metadata_path):
    """Preserve installed declarations; never infer a weights/native license grant."""
    declarations = [str(v) for v in message.get_all('License-File', [])]
    if len(declarations) > 128 or len(set(declarations)) != len(declarations):
        raise ValueError('duplicate-or-overbudget-license-declarations')
    metadata_version = str(message.get('Metadata-Version', ''))
    if declarations and not re.fullmatch(r'2\.[0-9]+', metadata_version):
        raise ValueError('unsupported-license-metadata-version')
    # PEP 639 uses dist-info/licenses. Older setuptools wheels put the same
    # extension header beside METADATA; retain that explicitly legacy scope.
    base = PurePosixPath(metadata_path).parent
    modern = bool(declarations) and int(metadata_version.split('.')[1]) >= 4
    if modern:
        base = base / 'licenses'
    files = {f['path']: f for f in node['files']}
    selected = []
    for declared in declarations:
        path = PurePosixPath(declared)
        if (not declared or path.is_absolute() or '\\' in declared or ':' in declared or
                any(p in ('', '.', '..') for p in declared.split('/'))):
            raise ValueError('unsafe-declared-license-path')
        relative = str(base / path)
        binding = files.get(relative)
        if binding is None:
            raise ValueError('missing-authenticated-license-file')
        if binding['byteLength'] > MAX_LICENSE_BYTES:
            raise ValueError('license-material-budget')
        verify_local_asset(root, relative, binding, MAX_LICENSE_BYTES)
        selected.append(dict(binding))
    return {'metadataVersion': metadata_version, 'licenseExpression': message.get('License-Expression'),
            'licenseField': message.get('License'), 'declaredFiles': declarations,
            'files': selected, 'layout': 'PEP639' if modern else 'LEGACY_METADATA_EXTENSION',
            'status': 'VERIFIED_DECLARED_BYTES' if declarations else 'NO_LICENSE_FILE_DECLARATION',
            'redistributionApproved': False, 'nativeAndWeightsScopeVerified': False}


def verify_distribution_metadata(root, node):
    """Bind identity to authenticated installed bytes, never detached resolver metadata.

    Requires-Dist is retained as declarations only. This does not evaluate markers,
    selected extras, version constraints, licenses, or the complete runtime closure.
    """
    candidates = [f for f in node['files'] if Path(f['path']).name == 'METADATA'
                  and Path(f['path']).parent.name.endswith('.dist-info')]
    if len(candidates) != 1:
        raise ValueError('missing-or-ambiguous-installed-metadata')
    binding = candidates[0]
    if binding['byteLength'] > MAX_METADATA_BYTES:
        raise ValueError('installed-metadata-budget')
    with local(root, binding['path']).open('rb') as stream:
        raw = stream.read(MAX_METADATA_BYTES + 1)
    if len(raw) != binding['byteLength'] or hashlib.sha256(raw).hexdigest() != binding['digest']:
        raise ValueError('stale-installed-metadata')
    message = BytesParser(policy=policy.default).parsebytes(raw)
    names = message.get_all('Name', [])
    versions = message.get_all('Version', [])
    if message.defects or len(names) != 1 or len(versions) != 1:
        raise ValueError('invalid-installed-metadata-identity')
    def normalized(name):
        if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?', name):
            raise ValueError('invalid-distribution-name')
        return re.sub(r'[-_.]+', '-', name).lower()
    if normalized(str(names[0])) != normalized(node['id']) or str(versions[0]) != node['version']:
        raise ValueError('wrong-installed-metadata-identity')
    materials = verified_license_materials(root, node, message, binding['path'])
    return {'path': binding['path'], 'digest': binding['digest'],
            'name': str(names[0]), 'version': str(versions[0]),
            'requiresDist': [str(value) for value in message.get_all('Requires-Dist', [])],
            'dependencyConstraintsVerified': False, 'licenseMaterials': materials}


def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()


def load_contract(root, manifest, asset_id='runtime-closure'):
    binding=next((e for e in manifest['assets'] if e['id']==asset_id),None)
    if binding is None:raise ValueError('missing-authenticated-closure')
    # The logical contract path is fixed; no recursive directory search or external URL.
    relative='runtime-closure.json'
    verify_local_asset(root,relative,binding,MAX_CONTRACT_BYTES)
    with local(root,relative).open('rb') as stream:
        raw=stream.read(MAX_CONTRACT_BYTES+1)
    if len(raw)>MAX_CONTRACT_BYTES or hashlib.sha256(raw).hexdigest()!=binding['digest']:raise ValueError('stale-closure-contract')
    def unique(pairs):
        result={}
        for k,v in pairs:
            if k in result:raise ValueError('duplicate-closure-key')
            result[k]=v
        return result
    return json.loads(raw,object_pairs_hook=unique)


def validate_graph(contract):
    if not isinstance(contract,dict) or set(contract)!={'version','roots','nodes'} or type(contract['version']) is not int or contract['version']!=1:
        raise ValueError('invalid-closure-contract')
    nodes=contract['nodes'];roots=contract['roots']
    if not isinstance(nodes,list) or not 0<len(nodes)<=128 or not isinstance(roots,list) or not roots or len(roots)!=len(set(roots)):
        raise ValueError('closure-budget-or-roots')
    by_id={};file_count=0
    for node in nodes:
        if not isinstance(node,dict) or set(node)!={'id','kind','version','requires','files','evidence','licenseStatus','artifactDigest'}:
            raise ValueError('invalid-closure-node')
        identity=node['id']
        if not isinstance(identity,str) or not identity or identity in by_id:raise ValueError('duplicate-closure-node')
        if node['kind'] not in KINDS or node['evidence'] not in LEVELS or node['licenseStatus'] not in {'APPROVED','REVIEW_REQUIRED','POLICY_REQUIRED','PHYSICAL_ONLY'}:
            raise ValueError('unsupported-closure-node')
        if not isinstance(node['version'],str) or not node['version'] or not isinstance(node['requires'],list) or len(node['requires'])!=len(set(node['requires'])):
            raise ValueError('invalid-closure-node')
        files=node['files']
        if not isinstance(files,list) or len(files)>MAX_FILES or len({f['path'] for f in files})!=len(files):raise ValueError('closure-file-budget')
        file_count+=len(files)
        if file_count>MAX_FILES:raise ValueError('global-closure-file-budget')
        for f in files:
            if not isinstance(f,dict) or set(f)!={'path','digest','byteLength'} or not isinstance(f['path'],str) or type(f['byteLength']) is not int or not 0<f['byteLength']<=8*1024**3 or not isinstance(f['digest'],str) or len(f['digest'])!=64 or any(c not in '0123456789abcdef' for c in f['digest']):raise ValueError('invalid-closure-file')
            if Path(f['path']).is_absolute() or '..' in Path(f['path']).parts or not Path(f['path']).parts:raise ValueError('unsafe-closure-path')
        expected_digest=hashlib.sha256(canonical(sorted(files,key=lambda f:f['path']))).hexdigest()
        if node['artifactDigest']!=expected_digest:raise ValueError('closure-artifact-digest-mismatch')
        by_id[identity]=node
    visited=set();active=set()
    def visit(identity):
        if identity not in by_id:raise ValueError('missing-direct-or-transitive-dependency')
        if identity in active:raise ValueError('cyclic-runtime-closure')
        if identity in visited:return
        active.add(identity)
        for dependency in by_id[identity]['requires']:visit(dependency)
        active.remove(identity);visited.add(identity)
    for identity in roots:visit(identity)
    if visited!=set(by_id):raise ValueError('unexpected-unreachable-dependency')
    return by_id


def verify_closure(root,contract,distribution=None,stamp_sink=None,build="UNSPECIFIED"):
    contract=copy.deepcopy(contract);nodes=validate_graph(contract);results=[];total=0;stamps=[]
    if distribution is None:
        distribution = private_distribution_lookup(root, contract, authenticate=False)
    for identity,node in nodes.items():
        level=node['evidence'];reason=None
        if not node['files'] and level!='EXPECTED_ONLY':level='MISSING';reason='missing-artifact-files'
        if level not in ('VERIFIED_ARTIFACT','EXPECTED_ONLY'):
            try:
                for f in node['files']:stable(local(root,f['path']))
            except (ValueError,OSError):level='MISSING';reason='missing-local-artifact'
        if level=='VERIFIED_ARTIFACT':
            try:
                for f in node['files']:
                    total+=f['byteLength']
                    if total>MAX_TOTAL:raise ValueError('scoped-closure-byte-budget')
                    before=stable(local(root,f['path']))
                    from artifact_verification import VERIFIER
                    VERIFIER.verify(root,f['path'],f,8*1024**3,identity=identity+':'+f['path'],
                                    version=node['version'],build=build)
                    if stable(local(root,f['path']))!=before:raise ValueError('stale-closure-file')
                    stamps.append((f['path'],before))
                if node['kind']=='PYTHON_DISTRIBUTION':
                    installed=distribution(identity)
                    if installed.version!=node['version']:raise ValueError('wrong-installed-version')
                    recorded=installed.files
                    if recorded is None or len(recorded)>MAX_FILES:raise ValueError('unsupported-distribution-record')
                    # Exact approved distribution-record footprint, including native/metadata files.
                    actual={str(Path(installed.locate_file(p)).resolve()) for p in recorded}
                    expected={str(local(root,f['path']).resolve()) for f in node['files']}
                    if actual!=expected:raise ValueError('incomplete-installed-artifact-footprint')
                    metadata = verify_distribution_metadata(root,node)
                    verify_distribution_record(root,node,metadata)
            except FileNotFoundError:level='MISSING';reason='missing-artifact'
            except importlib.metadata.PackageNotFoundError:level='MISSING';reason='missing-installed-distribution'
            except (ValueError,OSError):level='UNVERIFIED';reason='artifact-version-footprint-or-budget-mismatch'
        results.append({'id':identity,'kind':node['kind'],'version':node['version'],'digest':node['artifactDigest'],'status':level,'licenseStatus':node['licenseStatus'],'reason':reason})
    for relative,stamp in stamps:
        try:
            if stable(local(root,relative))!=stamp:raise ValueError('stale-closure-file')
        except (ValueError,OSError):raise ValueError('stale-closure-file') from None
    if stamp_sink is not None:
        for relative,stamp in stamps: stamp_sink(relative,stamp)
    complete=all(e['status']=='VERIFIED_ARTIFACT' for e in results)
    # Only the supplied authenticated graph is proved, never all possible imports.
    # New runtime import sites still need bindings/audit coverage.

    return {'version':1,'status':'COMPLETE' if complete else 'PARTIAL','complete':complete,'entries':results,'externalRequests':0}


def manifest_assembly_binding(runtime, nodes):
    """Same exact anchored identity gate for offline inspection and actual spawn."""
    required={e['id'] for kind in ('models','dependencies','assets') for e in runtime.manifest[kind]}-{'runtime-closure'}
    missing=sorted(required-set(nodes)); mismatches=[]
    for kind in ('models','dependencies','assets'):
        bindings={e['id']:e for e in runtime.bindings[kind]}
        for expected in runtime.manifest[kind]:
            identity=expected['id']
            if identity=='runtime-closure':continue
            node=nodes.get(identity); binding=bindings.get(identity)
            if identity=='runtime-config':binding={'path':'runtime-config.json'}
            if binding is None:
                for model in runtime.bindings['models']:
                    binding=next((e for e in model.get('companions',[]) if e['id']==identity),binding)
                binding=next((e for e in runtime.bindings['native'] if e['id']==identity),binding)
                for dependency in runtime.bindings['dependencies']:
                    binding=next((e for e in dependency.get('native',[]) if e['id']==identity),binding)
            if node is None:continue
            if binding is None:
                mismatches.append(identity);continue
            file=next((f for f in node['files'] if f['path']==binding['path']),None)
            if file is None or file['digest']!=expected['digest'] or ('byteLength' in expected and file['byteLength']!=expected['byteLength']):mismatches.append(identity)
            if kind=='dependencies' and (node['kind']!='PYTHON_DISTRIBUTION' or node['version']!=expected['version']):mismatches.append(identity)
            if kind=='models' and (node['kind']!='MODEL' or node['version']!=expected['revision']):mismatches.append(identity)
    return {'manifestIdentityMismatches':sorted(set(mismatches)), 'missingManifestIdentities':missing,
            'trustedManifest':'EXTERNALLY_ANCHORED'}


def verify_assembly(root,contract,distribution=None, *, runtime=None):
    observed=verify_closure(root,contract,distribution);nodes=validate_graph(contract);classified=[];materials=[];records=[]
    for entry in observed['entries']:
        status=entry['status'];license_status=entry['licenseStatus']
        if status=='MISSING':value='MISSING'
        elif license_status=='REVIEW_REQUIRED':value='LICENSE_REVIEW_REQUIRED'
        elif license_status=='POLICY_REQUIRED':value='POLICY_REQUIRED'
        elif license_status=='PHYSICAL_ONLY':value='PHYSICAL_ONLY'
        elif status=='EXPECTED_ONLY':value='EXTERNAL_REQUIRED'
        else:value='PRESENT_VERIFIED' if status=='VERIFIED_ARTIFACT' else 'PRESENT_UNVERIFIED'
        classified.append({'id':entry['id'],'classification':value,'evidence':status})
        if entry['kind']=='PYTHON_DISTRIBUTION':
            item={'id':entry['id'],'version':entry['version'],'artifactDigest':entry['digest'],
                  'approvalStatus':license_status,'status':'ARTIFACT_NOT_VERIFIED','files':[]}
            if status=='VERIFIED_ARTIFACT':
                metadata=verify_distribution_metadata(root,nodes[entry['id']])
                item.update(metadata['licenseMaterials'])
                records.append({'id':entry['id'],'version':entry['version'],'artifactDigest':entry['digest'],
                                **verify_distribution_record(root,nodes[entry['id']],metadata)})
            materials.append(item)
    roles={node['kind'] for node in nodes.values()}
    required={'SOURCE','PYTHON_RUNTIME','PYTHON_DISTRIBUTION','NATIVE_EXTENSION','MODEL','CONFIG','WEB_ASSET'}
    missing_roles=sorted(required-roles)
    complete=not missing_roles and all(e['classification']=='PRESENT_VERIFIED' for e in classified)
    manifest_binding=manifest_assembly_binding(runtime,nodes) if runtime is not None else {}
    if manifest_binding.get('manifestIdentityMismatches') or manifest_binding.get('missingManifestIdentities'):complete=False
    return {'version':1,'status':'COMPLETE' if complete else 'OPEN','complete':complete,'artifacts':classified,'missingRoles':missing_roles,'externalRequests':0,'bundledByVerifier':False,
            **manifest_binding, 'installedRecordInventory':records,
            'noticeMaterialInventory':materials,'noticeRedistributionApproved':False,
            'noticeScope':'AUTHENTICATED_INSTALLED_DECLARATIONS_ONLY'}


def private_python_layout(runtime, contract):
    """Resolve only existing anchored files; no conventional install/PATH fallback.

    The existing runtime node must include the unpacked 3.11 stdlib. Other layouts
    stay unsupported rather than guessing a distribution or accepting CI Python.
    """
    nodes = validate_graph(contract)
    binding = next((b for b in runtime.bindings['native'] if b['id'] == 'python-runtime'), None)
    node = nodes.get('python-runtime')
    if (binding is None or node is None or node['kind'] != 'PYTHON_RUNTIME' or
            node['version'] != binding['version'] or not node['version'].startswith('3.11.')):
        raise ValueError('missing-private-python-slot')
    files = {f['path']: f for f in node['files']}
    if binding['path'] not in files:
        raise ValueError('unbound-private-python-executable')
    stdlibs = [str(PurePosixPath(f).parent) for f in files if PurePosixPath(f).name == 'os.py']
    if len(stdlibs) != 1:
        raise ValueError('missing-or-ambiguous-private-stdlib')
    stdlib = stdlibs[0]
    for relative in (stdlib+'/encodings/__init__.py', stdlib+'/encodings/utf_8.py',
                     stdlib+'/json/__init__.py', stdlib+'/sysconfig.py'):
        if relative not in files:
            raise ValueError('missing-private-stdlib-bootstrap')
    roots = set()
    for distribution in nodes.values():
        if distribution['kind'] != 'PYTHON_DISTRIBUTION': continue
        metadata = verify_distribution_metadata(runtime.root, distribution)
        verify_distribution_record(runtime.root, distribution, metadata)
        roots.add(str(PurePosixPath(metadata['path']).parent.parent))
    paths = [stdlib]
    dynamic = stdlib+'/lib-dynload'
    if any(f.startswith(dynamic+'/') for n in nodes.values() for f in (e['path'] for e in n['files'])):
        paths.append(dynamic)
    paths.extend(sorted(roots))
    # Even a correct label cannot stand in for missing/stale runtime files.
    for f in node['files']:
        verify_local_asset(runtime.root, f['path'], f, 8*1024**3)
    return {'executable': runtime.resolve_executable('python-runtime', local(runtime.root,binding['path'])),
            'version': node['version'], 'stdlib': str(local(runtime.root,stdlib)),
            'paths': [str(Path(runtime.root).resolve()) if p=='.' else str(local(runtime.root,p)) for p in paths]}


def private_distribution_lookup(root, contract, *, authenticate=True):
    """Use exact approved dist-info, without ambient metadata/PATH discovery."""
    nodes = validate_graph(contract)
    selected = {}
    for node in nodes.values():
        if node['kind'] != 'PYTHON_DISTRIBUTION': continue
        candidates = [f for f in node['files'] if Path(f['path']).name == 'METADATA'
                      and Path(f['path']).parent.name.endswith('.dist-info')]
        if len(candidates) != 1: raise ValueError('missing-or-ambiguous-private-distribution')
        metadata = verify_distribution_metadata(root,node) if authenticate else candidates[0]
        key = re.sub(r'[-_.]+','-',node['id']).lower()
        if key in selected: raise ValueError('ambiguous-private-distribution')
        selected[key] = local(root,str(PurePosixPath(metadata['path']).parent))
    def lookup(identity):
        key = re.sub(r'[-_.]+','-',identity).lower()
        if key not in selected: raise importlib.metadata.PackageNotFoundError(identity)
        if not (selected[key] / 'METADATA').is_file(): raise importlib.metadata.PackageNotFoundError(identity)
        return importlib.metadata.PathDistribution(selected[key])
    return lookup


def private_python_command(runtime, contract, worker, arguments=()):
    """Actual Helper/Demucs command: disable site/.pth and pin approved roots.

    Reuse source identity and full assembly checks. No new contract or authority.
    Runtime disk identity is not mapped-native/network or installed acceptance.
    """
    layout = private_python_layout(runtime,contract)
    worker = Path(worker)
    if worker.is_symlink(): raise ValueError('unsafe-private-worker')
    worker = worker.resolve()
    source_files = {local(runtime.root,f['path']) for node in validate_graph(contract).values()
                    if node['kind']=='SOURCE' for f in node['files']}
    if worker not in source_files: raise ValueError('foreign-private-worker-source')
    identity = 'helper-source' if worker.name == 'server.py' else 'demucs-child-source' if worker.name == 'demucs_child.py' else None
    if identity is None: raise ValueError('unexpected-private-python-worker')
    expected = runtime.expected('assets',identity)
    verify_local_asset(worker.parent,worker.name,expected,1024*1024)
    raw = worker.read_bytes()
    if len(raw) != expected['byteLength'] or hashlib.sha256(raw).hexdigest() != expected['digest']:
        raise ValueError('changed-private-worker')
    # Only builtin sys is imported before path/version validation. -S prevents
    # arbitrary .pth/sitecustomize execution, -I ignores user Python environment.
    # Source loaders compile source rather than consuming unbound cached .pyc.
    program = ('import sys\n'
        'if sys.implementation.name != \"cpython\" or sys.version_info[:2] != (3,11) or sys.version.split()[0] != '+repr(layout['version'])+' or sys.executable != '+repr(layout['executable'])+': raise RuntimeError("private-python-identity")\n'
        'if getattr(sys,"_stdlib_dir",None) != '+repr(layout['stdlib'])+': raise RuntimeError("private-stdlib-origin")\n'
        'sys.path[:] = '+repr([str(worker.parent)]+layout['paths'])+'\n'
        'sys.dont_write_bytecode = True\n'
        'def _nova_source_code(self, fullname):\n    return self.source_to_code(self.get_data(self.path),self.path)\n'
        'sys.modules["_frozen_importlib_external"].SourceFileLoader.get_code = _nova_source_code\n'
        'sys.argv = '+repr([str(worker)]+list(arguments))+'\n'
        'globals()["__file__"] = '+repr(str(worker))+'\n'
        'exec(compile('+repr(raw)+','+repr(str(worker))+',"exec"),globals())\n')
    if len(program.encode()) > 120*1024: raise ValueError('private-startup-command-budget')
    return [layout['executable'],'-I','-S','-B','-c',program]


def private_process_origin(executable):
    """Observe this process only; sys.executable is never the observation source.

    Linux retains /proc/self/exe while comparing its backing inode. Darwin's
    bounded dyld query gives a path, not mapped-page integrity. Neither promotes
    parent-authenticated launch or complete native closure.
    """
    import os
    import platform
    expected = Path(executable)
    before = stable(expected)
    source = 'UNSUPPORTED'
    backing = False
    try:
        if platform.system() == 'Linux':
            with open('/proc/self/exe', 'rb') as image:
                actual = Path(os.readlink('/proc/self/exe'))
                observed = os.fstat(image.fileno())
                if (not actual.is_absolute() or actual != expected or
                        (observed.st_dev, observed.st_ino) != before[:2]):
                    raise ValueError('foreign-private-process-origin')
                # An open kernel-backed executable reference survives pathname
                # replacement; disk recheck below independently detects it.
                backing = True
                source = 'PROC_SELF_EXE_BACKING_INODE'
        elif platform.system() == 'Darwin':
            import ctypes
            query = ctypes.CDLL(None)._NSGetExecutablePath
            query.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
            query.restype = ctypes.c_int
            size = ctypes.c_uint32(0)
            if query(None, ctypes.byref(size)) != -1 or not 0 < size.value <= 65536:
                return {'status':'UNVERIFIED', 'source':'DYLD_QUERY_UNAVAILABLE', 'parentLaunchAuthenticated':False}
            buffer = ctypes.create_string_buffer(size.value)
            if query(buffer, ctypes.byref(size)) != 0 or b'\x00' not in buffer.raw:
                return {'status':'UNVERIFIED', 'source':'DYLD_QUERY_UNAVAILABLE', 'parentLaunchAuthenticated':False}
            actual = Path(os.fsdecode(buffer.value))
            if not actual.is_absolute() or actual != expected:
                raise ValueError('foreign-private-process-origin')
            source = 'DYLD_SELF_EXECUTABLE_PATH'
    except (OSError, AttributeError):
        return {'status':'UNVERIFIED', 'source':source, 'parentLaunchAuthenticated':False}
    if stable(expected) != before:
        raise ValueError('changed-private-process-origin')
    return {'status':'PARTIAL' if source != 'UNSUPPORTED' else 'UNVERIFIED',
        'source':source, 'approvedPathMatched':source != 'UNSUPPORTED',
        'backingInodeMatched':backing, 'mappedBytesVerified':False,
        'parentLaunchAuthenticated':False}


def private_runtime_preflight(runtime, contract, pipeline, *, configure_path=False):
    """Independent in-process acceptance of the same actual private startup path."""
    import sys
    runtime.private_python = None
    layout = private_python_layout(runtime,contract)
    if (sys.implementation.name != 'cpython' or sys.version_info[:2] != (3,11) or
            sys.version.split()[0] != layout['version'] or sys.executable != layout['executable'] or
            getattr(sys,'_stdlib_dir',None) != layout['stdlib'] or
            not sys.flags.isolated or not sys.flags.no_site or
            (not configure_path and sys.path != [str(Path(pipeline).resolve())]+layout['paths'])):
        raise ValueError('wrong-private-runtime-startup')
    nodes = validate_graph(contract)
    approved = {local(runtime.root,f['path']) for node in nodes.values()
                if node['kind'] in ('PYTHON_RUNTIME','SOURCE') for f in node['files']}
    for module in tuple(sys.modules.values()):
        spec = getattr(module,'__spec__',None)
        if getattr(spec,'origin',None) in ('built-in','frozen'): continue
        origin = getattr(module,'__file__',None)
        if origin is not None and Path(origin).resolve() not in approved:
            raise ValueError('foreign-preloaded-private-python-module')
    distribution = private_distribution_lookup(runtime.root,contract)
    before = {f['path']:stable(local(runtime.root,f['path'])) for node in nodes.values() for f in node['files']}
    report = verify_assembly(runtime.root,contract,distribution,runtime=runtime)
    if not report['complete']:
        raise ValueError('unapproved-private-runtime-assembly')
    process_origin = private_process_origin(layout['executable'])
    # Bind startup selection to the existing inventory/request/result identity.
    # This is disk/startup proof only, never mapped-native or device acceptance.
    nodes = validate_graph(contract)
    for node in nodes.values():
        for f in node['files']:
            if stable(local(runtime.root,f['path'])) != before[f['path']]:
                raise ValueError('changed-private-runtime-assembly')
            runtime.stamps[('private-python',f['path'])] = (f['path'],before[f['path']])
    runtime.recheck()
    if configure_path:
        sys.path[:] = [str(Path(pipeline).resolve())]+layout['paths']
        importlib.invalidate_caches()
    runtime.private_python = {'stdlibArtifactDigest': nodes['python-runtime']['artifactDigest'],
        'installedRecordInventory': report['installedRecordInventory'],
        'processOrigin': process_origin,
        'selection': 'ANCHORED_PRIVATE_STARTUP', 'productionReady': False}
    return distribution
