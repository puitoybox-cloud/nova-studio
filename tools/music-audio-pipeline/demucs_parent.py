"""Authenticated exact-command resident-child startup. Never searches PATH."""
import hashlib
import json
import platform
import sys
from pathlib import Path
from dependency_identity import verify_local_asset
from runtime_inventory import local
from scoped_closure import load_contract, verify_closure
from demucs_receipt import ChildSession, unique

SOURCES = {'artifact-verification-source':'artifact_verification.py','runtime-evidence-source':'runtime_evidence.py','demucs-child-source':'demucs_child.py','demucs-receipt-source':'demucs_receipt.py',
    'scoped-closure-source':'scoped_closure.py','runtime-inventory-source':'runtime_inventory.py',
    'dependency-identity-source':'dependency_identity.py','distribution-binding-source':'distribution_binding.py'}


def start(runtime, manifest_path, anchor, build, guard):
    for identity, relative in SOURCES.items():
        expected = runtime.expected('assets', identity)
        verify_local_asset(Path(__file__).parent, relative, expected, 1024*1024)
    contract = load_contract(runtime.root, runtime.manifest)
    closure = verify_closure(runtime.root, contract,build=runtime.manifest['buildRevision'],stamp_sink=lambda relative,stamp:runtime.stamps.__setitem__(('closure',relative),(relative,stamp)))
    if not closure['complete']: raise ValueError('partial-parent-closure')
    runtime.verify('assets','demucs-child-config','demucs-child-config.json')
    config_asset = runtime.expected('assets','demucs-child-config')
    raw = local(runtime.root,'demucs-child-config.json').read_bytes()
    if len(raw)>65536 or hashlib.sha256(raw).hexdigest()!=config_asset['digest']:raise ValueError('stale-child-config')
    expected = json.loads(raw,object_pairs_hook=unique)
    binding = next(e for e in runtime.bindings['models'] if e['runtimeIdentifier']=='demucs')
    derived = {'child':{'sourceDigest':runtime.expected('assets','demucs-child-source')['digest'],
        'runtimeVersion':'1','buildRevision':runtime.manifest['buildRevision'],'pythonVersion':sys.version.split()[0],'architecture':platform.machine()},
        'loader':{'id':'demucs','version':binding['loaderVersion'],'source':expected['loader']['source']},
        'model':{'identity':runtime.expected('models',binding['id']),'status':'LOADED_VERIFIED_FILE',
            'source':binding['path'],'runtimeIdentifier':'demucs',
            'companions':[runtime.expected('assets',c['id']) for c in binding['companions']]},
        'companions':[runtime.expected('assets',c['id']) for c in binding['companions']],
        'native':list(runtime.native.values())}
    loader = derived['loader']['source']
    if {k:v for k,v in loader.items() if k!='path'}!=runtime.expected('assets','demucs-loader-source'):raise ValueError('wrong-loader-expected-source')
    if expected!=derived:raise ValueError('child-config-manifest-mismatch')
    # Receipt closure is computed, never embedded in its own config/graph digest.
    expected['closureEntries']=closure['entries']
    from runtime_evidence import load as load_evidence
    evidence_contract=load_evidence(runtime)
    expected['runtimeEvidenceDigest']=hashlib.sha256(json.dumps(evidence_contract,sort_keys=True,
        separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()
    executable = runtime.resolve_executable('python-runtime',sys.executable)
    worker = str(Path(__file__).with_name('demucs_child.py').resolve())
    command = [executable,'-I','-S',worker,str(runtime.root),str(Path(manifest_path).resolve()),anchor,build]
    runtime.recheck()
    session=ChildSession(command,expected,permit=guard.permit)
    try:runtime.recheck()
    except Exception:session.close();raise
    return session,closure
