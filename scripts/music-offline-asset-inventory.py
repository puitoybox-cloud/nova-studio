#!/usr/bin/env python3
"""Repository-only static references. No download, pip, external executable or live probe."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

SOURCE_EXTENSIONS={'.js','.css','.html','.py','.command','.swift','.plist','.txt'}

def inspect(root, paths):
    entries=[];external=[]
    for relative in sorted(paths):
        path=Path(root,relative)
        if path.suffix not in SOURCE_EXTENSIONS or path.is_symlink() or not path.is_file():continue
        if path.stat().st_size>8*1024*1024:
            entries.append({'id':relative,'status':'UNVERIFIED','reason':'static-scan-budget'});continue
        raw=path.read_bytes();text=raw.decode('utf-8',errors='replace')
        scope='TEST_OR_TOOL' if relative.startswith(('tests/','verification/','scripts/')) or '/Tests/' in relative or Path(relative).name.startswith(('test_','verify_')) else 'PRODUCT_SOURCE'
        entries.append({'id':relative,'byteLength':len(raw),'digest':hashlib.sha256(raw).hexdigest(),
            'status':'LOCAL_SOURCE','distributionStatus':'UNVERIFIED','scope':scope})
        kinds=set()
        if path.name=='requirements.txt' and any(line.strip() and not line.strip().startswith('#') for line in text.splitlines()):kinds.add('DECLARED_PYTHON_DEPENDENCIES_REQUIRE_APPROVED_LOCAL_CLOSURE')
        if re.search(r'pip(?:3)?\s+install|["\x27]pip["\x27].*["\x27]install',text):kinds.add('PACKAGE_REGISTRY_INSTALL')
        if re.search(r'get_model|load_state_dict_from_url|torch\.hub',text):kinds.add('MODEL_LOADER_REQUIRES_RUNTIME_PROOF')
        if 'subprocess.' in text or re.search(r'\bffmpeg\b',text):kinds.add('NATIVE_OR_SUBPROCESS_REQUIREMENT')
        hosts=set()
        for url in sorted(set(re.findall(r'https?://[^\s"\x27<>]+',text))):
            candidate=url.rstrip('.,);')
            try:
                host=urlsplit(candidate).hostname
            except ValueError:
                external.append({'source':relative,'scope':scope,'kind':'INVALID_URL_REFERENCE','status':'UNVERIFIED','evidence':'STATIC_REFERENCE_ONLY'})
                continue
            if host not in {None,'localhost','127.0.0.1'}:hosts.add(host)
        for host in sorted(hosts):
            external.append({'source':relative,'scope':scope,'kind':'REMOTE_URL_REFERENCE','host':host,'evidence':'STATIC_REFERENCE_ONLY'})
        for kind in sorted(kinds):external.append({'source':relative,'scope':scope,'kind':kind,'evidence':'STATIC_REFERENCE_ONLY'})
    for reference in external:
        source=reference['source'];host=reference.get('host');kind=reference['kind']
        if kind=='INVALID_URL_REFERENCE': classification='UNVERIFIED';reason='malformed static URL; cannot classify host or infer runtime behavior'
        elif reference['scope']=='TEST_OR_TOOL': classification='DEVELOPMENT_ONLY';reason='test/diagnostic fixture; not production startup'
        elif source.endswith('Info.plist') or (source=='app.js' and host=='example.com') or host=='type.googleapis.com': classification='DOCUMENTATION_ONLY';reason='DTD, placeholder or error type identifier; no fetch at this reference'
        elif source.startswith('gemini-bridge'): classification='OPTIONAL';reason='explicit user navigation; not offline Helper processing'
        elif source=='music-studio-editor.js': classification='POLICY_DEPENDENT';reason='online provider branch; optional for local runtime, provider choice required'
        elif source.endswith('requirements.txt'): classification='POLICY_DEPENDENT';reason='declared package versions; installed artifacts/redistribution approval remain separate'
        elif source.endswith('START_AUDIO_PIPELINE.command'): classification='POLICY_DEPENDENT';reason='legacy installer requires registry; approved assembled runtime must replace install path'
        elif source.endswith('MusicStudioAppConfiguration.swift'): classification='PRODUCTION_RUNTIME_REQUIRED';reason='current native wrapper start URL is hosted; local entry provisioning remains open'
        elif source.endswith('server.py') and host=='puitoybox-cloud.github.io': classification='DOCUMENTATION_ONLY';reason='CORS allowlist literal, not outbound request'
        elif host=='{host}': classification='DOCUMENTATION_ONLY';reason='loopback launch message template, not outbound request'
        else: classification='PRODUCTION_RUNTIME_REQUIRED';reason='runtime loader/process boundary needs authenticated local artifacts; static reference is not proof of a remote call'
        reference.update(classification=classification,classificationReason=reason)
    counts={}
    for reference in external:counts[reference['classification']]=counts.get(reference['classification'],0)+1
    return {'classificationCounts':counts,'deadUnreferencedCount':0,'deadReferenceEvidence':'NO_UNPROVEN_DEAD_CLAIMS','version':2,'liveRequests':0,'assets':entries,'externalReferences':external,
        'actualOfflineDistribution':'OPEN','assembly':[
        {'component':'repository JS/CSS/HTML/Helper Python/local configuration','status':'UNVERIFIED','reason':'source bytes inventoried; approved assembled distribution not supplied'},
        {'component':'Python/ML packages and native runtime','status':'LICENSE REVIEW REQUIRED','reason':'installed entry evidence is not redistribution permission or transitive closure'},
        {'component':'Demucs/Basic Pitch model bytes and companion assets','status':'LICENSE REVIEW REQUIRED','reason':'no approved local model bundle or model license evidence'},
        {'component':'registry/model-download/hosted references','status':'EXTERNAL REQUIRED','reason':'legacy installers/loaders retain external prerequisites; strict path blocks them'},
        {'component':'trust provisioning/distribution/storage/retention/GC','status':'POLICY REQUIRED'},
        {'component':'Gatekeeper/notarization/Intel/Apple Silicon/real accuracy','status':'PHYSICAL ONLY'}]}

if __name__=='__main__':
    root=Path(__file__).resolve().parent.parent
    paths=subprocess.run(['git','ls-files'],cwd=root,check=True,capture_output=True,text=True).stdout.splitlines()
    print(json.dumps(inspect(root,paths),ensure_ascii=False,indent=2))
