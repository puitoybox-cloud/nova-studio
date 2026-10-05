"""Offline, explicitly scoped artifact graph. Never scans all installed packages."""
import copy
import hashlib
import importlib.metadata
import json
from pathlib import Path
from runtime_inventory import local, stable
from dependency_identity import verify_local_asset

KINDS = {'PYTHON_DISTRIBUTION','NATIVE_EXTENSION','EXECUTABLE','MODEL','CONFIG','SOURCE','WEB_ASSET','PYTHON_RUNTIME'}
LEVELS = {'VERIFIED_ARTIFACT','VERIFIED_ENTRY_FILE','OBSERVED_METADATA_ONLY','EXPECTED_ONLY','MISSING','UNSUPPORTED','UNVERIFIED'}
MAX_FILES = 4096
MAX_TOTAL = 256 * 1024 * 1024


def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()


def load_contract(root, manifest, asset_id='runtime-closure'):
    binding=next((e for e in manifest['assets'] if e['id']==asset_id),None)
    if binding is None:raise ValueError('missing-authenticated-closure')
    # The logical contract path is fixed; no recursive directory search or external URL.
    relative='runtime-closure.json'
    verify_local_asset(root,relative,binding,65536)
    raw=local(root,relative).read_bytes()
    if len(raw)>65536 or hashlib.sha256(raw).hexdigest()!=binding['digest']:raise ValueError('stale-closure-contract')
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
            if not isinstance(f,dict) or set(f)!={'path','digest','byteLength'} or not isinstance(f['path'],str) or type(f['byteLength']) is not int or not 0<f['byteLength']<=64*1024*1024 or not isinstance(f['digest'],str) or len(f['digest'])!=64 or any(c not in '0123456789abcdef' for c in f['digest']):raise ValueError('invalid-closure-file')
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


def verify_closure(root,contract,distribution=importlib.metadata.distribution,stamp_sink=None):
    contract=copy.deepcopy(contract);nodes=validate_graph(contract);results=[];total=0;stamps=[]
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
                    verify_local_asset(root,f['path'],f,64*1024*1024)
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


def verify_assembly(root,contract,distribution=importlib.metadata.distribution):
    observed=verify_closure(root,contract,distribution);nodes=validate_graph(contract);classified=[]
    for entry in observed['entries']:
        status=entry['status'];license_status=entry['licenseStatus']
        if status=='MISSING':value='MISSING'
        elif license_status=='REVIEW_REQUIRED':value='LICENSE_REVIEW_REQUIRED'
        elif license_status=='POLICY_REQUIRED':value='POLICY_REQUIRED'
        elif license_status=='PHYSICAL_ONLY':value='PHYSICAL_ONLY'
        elif status=='EXPECTED_ONLY':value='EXTERNAL_REQUIRED'
        else:value='PRESENT_VERIFIED' if status=='VERIFIED_ARTIFACT' else 'PRESENT_UNVERIFIED'
        classified.append({'id':entry['id'],'classification':value,'evidence':status})
    roles={node['kind'] for node in nodes.values()}
    required={'SOURCE','PYTHON_RUNTIME','PYTHON_DISTRIBUTION','NATIVE_EXTENSION','MODEL','CONFIG','WEB_ASSET'}
    missing_roles=sorted(required-roles)
    complete=not missing_roles and all(e['classification']=='PRESENT_VERIFIED' for e in classified)
    return {'version':1,'status':'COMPLETE' if complete else 'OPEN','complete':complete,'artifacts':classified,'missingRoles':missing_roles,'externalRequests':0,'bundledByVerifier':False}
