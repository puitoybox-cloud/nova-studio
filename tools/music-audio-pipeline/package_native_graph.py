"""Bounded package-root disk graph. Never consult host search paths or grant policy.

Graph file bindings are checked, not approved here. OBSERVED_METADATA_ONLY remains
unapproved. Every weak/reexport/upward dependency is conservatively required.
"""
import copy
import unicodedata
from pathlib import Path, PurePosixPath
from dependency_identity import verify_local_asset
from runtime_inventory import local, stable, MAX_ARTIFACT_BYTES
from scoped_closure import validate_graph, MAX_FILES, MAX_TOTAL
from package_macho import package_image_routes

MAGICS = {b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe',
          b'\xbe\xba\xfe\xca', b'\xca\xfe\xba\xbf', b'\xbf\xba\xfe\xca'}
INTERNAL = 'PACKAGE_INTERNAL'
SYSTEM = 'APPLE_SYSTEM_CANDIDATE_POLICY_REQUIRED'
BLOCKED = 'BLOCKED_EXTERNAL'
COMMANDS = {0xc:'LC_LOAD_DYLIB',0x80000018:'LC_LOAD_WEAK_DYLIB',
            0x8000001f:'LC_REEXPORT_DYLIB',0x80000023:'LC_LOAD_UPWARD_DYLIB',0x20:'LC_LAZY_LOAD_DYLIB'}
MAX_EDGES = MAX_FILES * 32


def safe_text(value):
    if not isinstance(value,str) or not value or len(value)>4096 or '\\' in value or any(ord(c)<32 or ord(c)==127 for c in value):
        raise ValueError('unsafe-route-text')


def normalized(value):
    safe_text(value)
    parts = []
    for part in value.split('/'):
        if part in ('','.'): continue
        if part == '..':
            if not parts: raise ValueError('package-root-escape')
            parts.pop()
        else: parts.append(part)
    return '/'.join(parts)


def apple(value):
    # Only canonical syntactic candidates; never inspect a host system image.
    if not value.startswith('/') or '..' in value.split('/') or '//' in value or '/./' in value: return False
    return value in ('/usr/lib/dyld','/bin/bash','/bin/sh','/usr/bin/env') or value.startswith(('/usr/lib/','/System/Library/'))


def inspect_native_graph(root, graph, architecture, main_executable):
    if architecture not in ('x86_64','arm64'): raise ValueError('unsupported-package-architecture')
    supplied = Path(root)
    if supplied.is_symlink() or not supplied.is_dir(): raise ValueError('unsafe-package-root')
    root = supplied.resolve(); root_stamp = root.stat()
    graph = copy.deepcopy(graph); nodes = validate_graph(graph); bindings = {}; owners = {}
    folds = {}; stamps = {}; directories = {}; diagnostics = []; images = {}; scripts = []
    def fold(name): return unicodedata.normalize('NFC',name).casefold()
    for node in nodes.values():
        for binding in node['files']:
            name = binding['path']
            if name in bindings: raise ValueError('duplicate-package-binding')
            safe_text(name)
            if normalized(name)!=name: raise ValueError('noncanonical-package-binding')
            bindings[name] = binding; owners[name] = node
            # Include ancestor names: case ambiguity is unsafe on either filesystem.
            for part in [name,*map(str,PurePosixPath(name).parents)]:
                folds.setdefault(fold(part),set()).add(part)
    pending = [root]; seen = 0
    while pending:
        directory = pending.pop(); st = directory.stat()
        directories[directory] = (st.st_dev,st.st_ino,st.st_mtime_ns,st.st_ctime_ns)
        for path in directory.iterdir():
            seen += 1
            if seen > MAX_FILES*8: raise ValueError('package-tree-budget')
            if path.is_symlink(): raise ValueError('package-symlink-forbidden')
            name = path.relative_to(root).as_posix(); folds.setdefault(fold(name),set()).add(name)
            if path.is_dir(): pending.append(path)
            elif not path.is_file(): raise ValueError('nonregular-package-file')
            elif name not in bindings and name not in ('runtime-closure.json','distribution-manifest.json'):
                raise ValueError('unbound-package-file')
    ambiguous = {key for key,names in folds.items() if len(names)>1}
    def path_safe(name):
        return all(fold(p) not in ambiguous for p in [name,*map(str,PurePosixPath(name).parents)])
    total = 0
    for name,binding in bindings.items():
        total += binding['byteLength']
        if total > MAX_TOTAL: raise ValueError('package-byte-budget')
        try:
            path = local(root,name); before = stable(path)
            verify_local_asset(root,name,binding,MAX_ARTIFACT_BYTES); stamps[name] = before
            if owners[name]['kind']=='EXECUTABLE' and not path.stat().st_mode & 0o111:
                raise ValueError('executable-permission-missing')
            if not path_safe(name): raise ValueError('case-or-unicode-path-ambiguity')
            with path.open('rb') as stream: prefix = stream.read(4096)
            if prefix[:4] in MAGICS:
                routing = package_image_routes(path,architecture)
                if routing['fileType'] not in (2,6,8): raise ValueError('unsupported-native-filetype')
                images[name] = routing
            elif owners[name]['kind'] in ('EXECUTABLE','PYTHON_RUNTIME','NATIVE_EXTENSION') or Path(name).suffix in ('.so','.dylib'):
                if prefix.startswith(b'#!'):
                    line = prefix.split(b'\n',1)[0]
                    if b'\n' not in prefix: raise ValueError('unbounded-script-interpreter')
                    interpreter = line[2:].decode('utf8').strip().split()
                    if not interpreter: raise ValueError('missing-script-interpreter')
                    scripts.append({'path':name,'interpreter':interpreter[0],'arguments':interpreter[1:]})
                elif owners[name]['kind']=='EXECUTABLE' or Path(name).suffix in ('.so','.dylib'):
                    raise ValueError('native-or-script-format-missing')
            if stable(path)!=before: raise ValueError('changed-package-file')
        except (OSError,ValueError,UnicodeError) as error:
            diagnostics.append({'parent':name,'status':'MISSING' if not (root/name).exists() else 'BLOCKED',
                                'classification':BLOCKED,'reason':str(error)})
    main_ok = (main_executable in images and images[main_executable]['fileType']==2 and
               owners[main_executable]['kind']=='EXECUTABLE' and path_safe(main_executable))
    if not main_ok: diagnostics.append({'parent':main_executable,'classification':BLOCKED,'status':'BLOCKED','reason':'unique-main-executable-unavailable'})
    def expand(raw,parent):
        safe_text(raw)
        for token,base in (('@loader_path',str(PurePosixPath(parent).parent)),
                           ('@executable_path',str(PurePosixPath(main_executable).parent) if main_ok else None)):
            if raw==token or raw.startswith(token+'/'):
                if base is None: raise ValueError('unique-main-executable-unavailable')
                name = normalized(base+raw[len(token):])
                path = local(root,name)
                if not path_safe(name): raise ValueError('case-or-unicode-path-ambiguity')
                return str(path),name
        if raw.startswith('/'):
            # Check lexical containment before resolution; no symlink following.
            if raw==str(root) or raw.startswith(str(root)+'/'):
                name = normalized(raw[len(str(root)):])
                if not path_safe(name): raise ValueError('case-or-unicode-path-ambiguity')
                return str(local(root,name)),name
            return raw,None
        raise ValueError('bare-or-unknown-route-no-host-search')
    edges = []; rpath_observations = []
    def edge(parent,command,raw):
        if len(edges)>=MAX_EDGES: raise ValueError('package-edge-budget')
        item = {'parent':parent,'rawCommand':command,'rawPath':raw,'required':True,
                'expandedCandidatePaths':[],'resolvedPackagePath':None,'targetAssetIdentity':None,
                'classification':BLOCKED,'status':'BLOCKED','reason':'unresolved-route',
                'actualLoaded':False,'runtimeSelectionVerified':False}
        edges.append(item); return item
    def policy(item,reason):
        item.update(classification=SYSTEM,status='POLICY_REQUIRED',reason=reason,
                    policyApproved=False,runtimeProof=False,redistribution='UNVERIFIED')
    for parent,routing in sorted(images.items()):
        expanded_rpaths = []; bad_rpath = False
        for index,raw in enumerate(routing['rpaths']):
            obs = {'parent':parent,'rawCommand':'LC_RPATH','rawPath':raw,'order':index}
            rpath_observations.append(obs)
            try:
                candidate,name = expand(raw,parent); obs['expandedPath'] = candidate
                if name is None:
                    item = edge(parent,'LC_RPATH',raw); item['expandedCandidatePaths']=[candidate]
                    if apple(candidate): policy(item,'external-rpath-system-policy-required')
                    else: item['reason']='external-rpath-forbidden'
                    obs.update(status=item['status'],classification=item['classification']); bad_rpath=True
                else:
                    expanded_rpaths.append(name); obs.update(status='PACKAGE_DIRECTORY_CANDIDATE')
            except ValueError as error:
                item = edge(parent,'LC_RPATH',raw); item['reason']=str(error); obs.update(status='BLOCKED',reason=str(error)); bad_rpath=True
        loads = [(COMMANDS[x['command']],x['name']) for x in routing['loadCommands']]
        if routing['dynamicLinker'] is not None: loads.insert(0,('LC_LOAD_DYLINKER',routing['dynamicLinker']))
        for command,raw in loads:
            item = edge(parent,command,raw)
            try:
                safe_text(raw)
                if command=='LC_LOAD_DYLINKER':
                    item['expandedCandidatePaths']=[raw]
                    if raw=='/usr/lib/dyld': policy(item,'disk-loader-candidate-only')
                    else: item['reason']='foreign-dynamic-loader-forbidden'
                    continue
                if raw.startswith('@rpath/'):
                    candidates = [expand('@loader_path/'+raw[7:],base+'/image') for base in expanded_rpaths]
                    if bad_rpath: raise ValueError('unsafe-or-external-rpath-search')
                    if not candidates: raise ValueError('unresolved-rpath')
                else: candidates = [expand(raw,parent)]
                item['expandedCandidatePaths']=[p for p,_ in candidates]
                if len(candidates)==1 and candidates[0][1] is None:
                    if apple(candidates[0][0]): policy(item,'disk-system-candidate-only')
                    else: item['reason']='foreign-absolute-path'
                    continue
                names = list(dict.fromkeys(n for _,n in candidates if n is not None))
                # Existence is only a candidate. Unbound or invalid candidates poison search.
                matches = [n for n in names if (root/n).exists()]
                if len(matches)!=1: raise ValueError('ambiguous-rpath' if len(matches)>1 else 'missing-target')
                target = matches[0]
                if target not in bindings: raise ValueError('target-not-graph-bound')
                if target not in images: raise ValueError('target-native-architecture-or-syntax-unverified')
                target_route = images[target]
                if target_route['fileType']!=6: raise ValueError('dylib-target-not-MH_DYLIB')
                install = target_route['installName']
                if not install: raise ValueError('missing-target-install-name')
                # Exact symbolic identity, or a canonical equivalent resolving to target.
                if install!=raw:
                    if install.startswith('@rpath/'):
                        ids = [expand('@loader_path/'+install[7:],base+'/image')[1] for base in expanded_rpaths]
                        identities = {n for n in ids if (root/n).exists()}
                        if bad_rpath or identities!={target}: raise ValueError('install-name-mismatch')
                    else:
                        _,identity = expand(install,target)
                        if identity!=target: raise ValueError('install-name-mismatch')
                verify_local_asset(root,target,bindings[target],MAX_ARTIFACT_BYTES)
                item.update(classification=INTERNAL,status='RESOLVED_BOUND_DISK_BYTES',reason='exact-bound-native-target',
                    resolvedPackagePath=target,targetAssetIdentity={'id':owners[target]['id'],**bindings[target]},
                    installName=install,architecture=architecture,bindingEvidence=owners[target]['evidence'])
            except (OSError,ValueError) as error:
                item['reason']=str(error)
                if str(error) in ('missing-target','unresolved-rpath'): item['status']='MISSING'
    for script in scripts:
        item = edge(script['path'],'SCRIPT_INTERPRETER',script['interpreter'])
        item['arguments']=script['arguments']
        if apple(script['interpreter']):
            item['expandedCandidatePaths']=[script['interpreter']]
            policy(item,'system-interpreter-policy-required')
            if script['interpreter']=='/usr/bin/env': item['reason']='env-search-selection-unverified-no-host-search'
        else: item['reason']='unapproved-script-interpreter'
    # Recheck all bound bytes and tree identities after the entire graph walk.
    for name,before in stamps.items():
        path = local(root,name)
        verify_local_asset(root,name,bindings[name],MAX_ARTIFACT_BYTES)
        if stable(path)!=before: raise ValueError('changed-package-during-graph-inspection')
    for path,before in directories.items():
        st = path.stat()
        if path.is_symlink() or before!=(st.st_dev,st.st_ino,st.st_mtime_ns,st.st_ctime_ns): raise ValueError('changed-package-tree')
    st = root.stat()
    if (st.st_dev,st.st_ino)!=(root_stamp.st_dev,root_stamp.st_ino): raise ValueError('changed-package-root')
    counts = {kind:sum(e['classification']==kind for e in edges) for kind in (INTERNAL,SYSTEM,BLOCKED)}
    internal_complete = main_ok and not diagnostics and not counts[BLOCKED]
    # All native images are checked, including disconnected lib-dynload/site-packages modules.
    # Transitive adjacency is explicit; cycles are retained as SCC signing groups.
    adjacency = {name:sorted({e['resolvedPackagePath'] for e in edges if e['parent']==name and e['classification']==INTERNAL}) for name in images}
    remaining = set(images); order = []; cycles = []
    while remaining:
        leaves = sorted(n for n in remaining if not (set(adjacency[n]) & remaining))
        if not leaves:
            cycles = sorted(remaining); break
        order.extend(leaves); remaining.difference_update(leaves)
    signing = {'status':'CANDIDATE_ONLY' if not cycles else 'BLOCKED_CYCLE_REVIEW_REQUIRED',
               'nativeLeafFirst':order,'unresolvedCycleOrDependents':cycles,
               'scriptHelpers':sorted(s['path'] for s in scripts),'mainExecutableLast':main_executable,
               'containerInsideOut':sorted({str(a) for n in images for a in PurePosixPath(n).parents
                   if a.suffix in ('.framework','.app','.xpc','.appex')},key=lambda n:(-len(PurePosixPath(n).parts),n)),
               'rootAppLast':'.','signingPerformed':False}
    license_inventory = [{'id':node['id'],'paths':sorted(f['path'] for f in node['files']),
                          'licenseStatus':node['licenseStatus'],'materialStatus':'UNVERIFIED'}
                         for node in nodes.values() if any(f['path'] in images for f in node['files'])]
    return {'scope':'PACKAGE_DISK_SYNTAX_ONLY','architecture':architecture,'mainExecutable':main_executable,
        'images':[dict(path=n,**r) for n,r in sorted(images.items())],'edges':edges,'rpaths':rpath_observations,
        'diagnostics':diagnostics,'edgeCounts':counts,'unresolvedEdgeCount':counts[BLOCKED],
        'packageFilesComplete':not diagnostics,'packageInternalNativeClosureComplete':internal_complete,
        'externalSystemPolicyComplete':not counts[SYSTEM] and not counts[BLOCKED],
        'architectureClosureComplete':internal_complete,'transitiveClosureComplete':internal_complete,
        'transitiveAdjacency':adjacency,'installNameValidation':'VERIFIED_DISK_CANDIDATE' if internal_complete else 'INCOMPLETE',
        'helperInterpreters':scripts,'privateCPythonNativeClosureStatus':'UNVERIFIED' if any(owners[n]['id']=='python-runtime' for n in images) else 'MISSING',
        'licenseMaterialInventory':license_inventory,'licenseMaterialComplete':False,
        'signingOrderCandidate':signing,'signingComplete':False,'runtimeAcceptance':'UNVERIFIED',
        'approvedAnchor':False,'parentLaunchAuthenticated':False,'parentKernelOriginVerified':False,
        'mappedBytesVerified':False,'actualLoaded':False,'runtimeSelectionVerified':False,'publicationEligible':False,
        'externalRequests':0}
