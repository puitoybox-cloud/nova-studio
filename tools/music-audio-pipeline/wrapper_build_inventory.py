"""Read-only explicit Wrapper build inventory; never creates an approval anchor.

Exports OBSERVED_METADATA_ONLY graph nodes in the existing closure format.
Missing approved runtime/model/license slots always keep package INCOMPLETE.
"""
import argparse
import hashlib
import json
import plistlib
import re
import struct
from pathlib import Path
from runtime_inventory import stable
from scoped_closure import canonical, validate_graph, MAX_FILES, MAX_TOTAL
from runtime_evidence import native_image_routes, _macho_slice
from unsigned_app import MAGICS, unsigned_image_type

APPROVED_SLOTS = ('native-wrapper','helper-source','python-runtime','private-stdlib',
    'private-site-packages','native-shared-libraries','basic-pitch-model',
    'demucs-htdemucs_6s','model-config-provenance','license-material',
    'runtime-config','runtime-closure','distribution-manifest')


def observe(root,build,architecture):
    if not re.fullmatch('[0-9a-f]{40}',build): raise ValueError('exact-build-revision-required')
    if architecture not in ('x86_64','arm64'): raise ValueError('unsupported-build-architecture')
    root = Path(root)
    if root.is_symlink() or not root.is_dir(): raise ValueError('explicit-regular-wrapper-build-required')
    root = root.resolve(); root_identity = root.stat(); paths = []; directories = []; pending = [root]; visited = 0
    while pending:
        directory = pending.pop(); before = directory.stat(); directories.append((directory,before))
        for path in sorted(directory.iterdir()):
            visited += 1
            if visited > MAX_FILES*8: raise ValueError('wrapper-tree-budget')
            if path.is_symlink(): raise ValueError('unsafe-wrapper-build-symlink')
            if path.is_dir(): pending.append(path)
            elif path.is_file():
                paths.append(path)
                if len(paths) > MAX_FILES: raise ValueError('wrapper-file-budget')
            else: raise ValueError('nonregular-wrapper-build-file')
    files = []; natives = []; groups = {}; total = 0; main = None; stamps = []; reasons = []
    # Identify the executable from actual bytes, without scanning another build tree.
    plist = root/'Contents/Info.plist'
    if plist not in paths: raise ValueError('missing-wrapper-info-plist')
    before = stable(plist)
    if before[2] > 1024*1024: raise ValueError('wrapper-plist-budget')
    info = plistlib.loads(plist.read_bytes())
    if stable(plist) != before: raise ValueError('changed-wrapper-info-plist')
    if not isinstance(info,dict): raise ValueError('invalid-wrapper-info-plist')
    name = info.get('CFBundleExecutable')
    if (info.get('CFBundlePackageType') != 'APPL' or not isinstance(name,str) or
            not name or name in ('.','..') or any(c in name for c in ('/','\\','\x00'))):
        raise ValueError('invalid-wrapper-executable-name')
    main = 'Contents/MacOS/'+name
    if root/main not in paths: raise ValueError('missing-wrapper-executable')
    for path in sorted(paths):
        relative = path.relative_to(root).as_posix(); before = stable(path); stamps.append((path,before))
        total += before[2]
        if before[2] > 8*1024**3 or total > MAX_TOTAL: raise ValueError('wrapper-byte-budget')
        digest = hashlib.sha256(); length = 0; prefix = b''
        with path.open('rb') as stream:
            for chunk in iter(lambda:stream.read(65536),b''):
                if not prefix: prefix = chunk[:4]
                length += len(chunk)
                if length > before[2]: raise ValueError('changed-wrapper-file')
                digest.update(chunk)
        if stable(path) != before or length != before[2]: raise ValueError('changed-wrapper-file')
        item = {'path':relative,'digest':digest.hexdigest(),'byteLength':length}
        files.append(dict(item,status='OBSERVED_DISK_BYTES'))
        kind = 'EXECUTABLE' if relative == main or path.stat().st_mode & 0o111 else 'CONFIG'
        if prefix in MAGICS:
            route = native_image_routes(path,architecture)
            if route['format'] != 'MACHO64': raise ValueError('non-macos-wrapper-image')
            signing = 'UNSIGNED_SELECTED_SLICE'
            try: filetype = unsigned_image_type(path,architecture)
            except ValueError as error:
                if str(error) != 'pre-signed-app-image': raise
                signing = 'SIGNATURE_PRESENT_UNVERIFIED'
                with path.open('rb') as stream:
                    base,end,_ = _macho_slice(stream,before[2],architecture)
                    stream.seek(base); header = stream.read(32)
                endian = '<' if header[:4] == b'\xcf\xfa\xed\xfe' else '>'
                filetype = struct.unpack(endian+'8I',header)[3]
            if relative == main:
                if not path.stat().st_mode & 0o111: raise ValueError('wrapper-executable-mode-missing')
                if filetype != 2: raise ValueError('wrapper-not-MH_EXECUTE')
            else: kind = 'EXECUTABLE' if filetype == 2 else 'NATIVE_EXTENSION'
            natives.append({'path':relative,'architecture':route['architecture'],
                'slice':route['slice'],'commands':route['commands'],'rpaths':route['rpaths'],
                'signing':signing,'actualLoaded':False,'mappedBytesVerified':False})
        elif relative == main: raise ValueError('wrapper-executable-not-macho')
        if stable(path) != before: raise ValueError('changed-wrapper-file')
        groups.setdefault(kind,[]).append(item)
        if length == 0: reasons.append({'path':relative,'reason':'existing-graph-requires-positive-file-size'})
    for path,before in stamps:
        if stable(path) != before: raise ValueError('changed-wrapper-inventory')
    # File insertion/deletion and directory replacement also invalidate observation.
    stamp_dir = lambda s:(s.st_dev,s.st_ino,s.st_mtime_ns,s.st_ctime_ns)
    for path,before in directories:
        if path.is_symlink() or stamp_dir(path.stat()) != stamp_dir(before): raise ValueError('changed-wrapper-tree')
    if (root.stat().st_dev,root.stat().st_ino) != (root_identity.st_dev,root_identity.st_ino):
        raise ValueError('changed-wrapper-root')
    graph = None
    if not reasons:
        nodes = []
        for kind,bindings in sorted(groups.items()):
            bindings.sort(key=lambda b:b['path'])
            nodes.append({'id':'observed-wrapper-'+kind.lower(),'kind':kind,'version':build,
                'requires':[],'files':bindings,'artifactDigest':hashlib.sha256(canonical(bindings)).hexdigest(),
                'evidence':'OBSERVED_METADATA_ONLY','licenseStatus':'REVIEW_REQUIRED'})
        graph = {'version':1,'roots':[node['id'] for node in nodes],'nodes':nodes}
        validate_graph(graph)
    return {'status':'INCOMPLETE','complete':False,'publicationEligible':False,'approvedAnchor':False,
        'buildRevision':build,'provenance':'CALLER_DECLARED_NOT_AUTHENTICATED',
        'scope':'EXPLICIT_WRAPPER_BUILD_OBSERVATION_ONLY','architecture':architecture,
        'files':files,'nativeImages':natives,'observedGraph':graph,'graphConversionIssues':reasons,
        'dependencyRelations':'NOT_EVALUATED','redistributionApproved':False,'modelsApproved':False,
        'licenseCandidates':[f['path'] for f in files if re.search(r'license|licence|notice|copying|copyright',f['path'],re.I)],
        'signatureMaterial':[f['path'] for f in files if '_CodeSignature' in Path(f['path']).parts],
        'missingApprovedAssets':[{'id':slot,'path':main if slot=='native-wrapper' else None,'status':'MISSING'} for slot in APPROVED_SLOTS],
        'modelLicense':{'basicPitch':'LICENSE_UNCONFIRMED','demucs':'EXTERNAL_LICENSE_VERIFICATION_REQUIRED'},
        'signingPerformed':False,'externalRequests':0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('root','build','architecture'): parser.add_argument('--'+name,required=True)
    args = parser.parse_args()
    try: result = observe(args.root,args.build,args.architecture)
    except (OSError,ValueError,KeyError,TypeError,plistlib.InvalidFileException) as error:
        result = {'status':'INCOMPLETE','complete':False,'observedGraph':None,
            'reason':str(error),'publicationEligible':False,'approvedAnchor':False,'externalRequests':0}
    print(json.dumps(result,indent=2))
    # This observation command never claims package completeness.
    return 2


if __name__ == '__main__': raise SystemExit(main())
