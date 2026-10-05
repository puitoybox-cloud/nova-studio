#!/usr/bin/env python3
"""Repository-only static references. No download, pip, external executable or live probe."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

SOURCE_EXTENSIONS={'.js','.css','.html','.py','.command','.swift','.plist'}

def inspect(root, paths):
    entries=[];external=[]
    for relative in sorted(paths):
        path=Path(root,relative)
        if path.suffix not in SOURCE_EXTENSIONS or path.is_symlink() or not path.is_file():continue
        if path.stat().st_size>8*1024*1024:
            entries.append({'id':relative,'status':'UNVERIFIED','reason':'static-scan-budget'});continue
        raw=path.read_bytes();text=raw.decode('utf-8',errors='replace')
        scope='TEST_OR_TOOL' if relative.startswith(('tests/','verification/','scripts/')) else 'PRODUCT_SOURCE'
        entries.append({'id':relative,'byteLength':len(raw),'digest':hashlib.sha256(raw).hexdigest(),
            'status':'LOCAL_SOURCE','distributionStatus':'UNVERIFIED','scope':scope})
        kinds=set()
        if re.search(r'pip(?:3)?\s+install|["\x27]pip["\x27].*["\x27]install',text):kinds.add('PACKAGE_REGISTRY_INSTALL')
        if re.search(r'get_model|load_state_dict_from_url|torch\.hub',text):kinds.add('MODEL_LOADER_REQUIRES_RUNTIME_PROOF')
        if 'subprocess.' in text or re.search(r'\bffmpeg\b',text):kinds.add('NATIVE_OR_SUBPROCESS_REQUIREMENT')
        for host in sorted({urlsplit(u.rstrip('.,);')).hostname for u in re.findall(r'https?://[^\s"\x27<>]+',text)}-{None,'localhost','127.0.0.1'}):
            external.append({'source':relative,'scope':scope,'kind':'REMOTE_URL_REFERENCE','host':host,'evidence':'STATIC_REFERENCE_ONLY'})
        for kind in sorted(kinds):external.append({'source':relative,'scope':scope,'kind':kind,'evidence':'STATIC_REFERENCE_ONLY'})
    return {'version':1,'liveRequests':0,'assets':entries,'externalReferences':external,
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
