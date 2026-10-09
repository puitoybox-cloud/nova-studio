"""Candidate macOS app layout over the existing externally anchored generation graph.

Never relocates approved logical paths, grants system-library policy, launches,
loads native code, signs, downloads, or invents an approval anchor.
"""
import argparse
import json
import plistlib
import shutil
import struct
from pathlib import Path, PurePosixPath
from runtime_inventory import local, stable
from scoped_closure import validate_graph, MAX_FILES
from dependency_identity import verify_local_asset
from runtime_evidence import _expand_macho_path, _macho_slice
from package_macho import package_image_routes
from unsigned_generation import inspect as inspect_generation, assemble as assemble_generation

MAGICS = {b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe',
          b'\xbe\xba\xfe\xca', b'\xca\xfe\xba\xbf', b'\xbf\xba\xfe\xca'}


def unsigned_image_type(path,architecture):
    # Reuse the bounded selected-slice parser. Do not strip existing signatures.
    before = stable(path)
    with path.open('rb') as stream:
        base,end,_ = _macho_slice(stream,before[2],architecture)
        stream.seek(base); header = stream.read(32)
        endian = '<' if header[:4] == b'\xcf\xfa\xed\xfe' else '>'
        fields = struct.unpack(endian+'8I',header)
        count,size = fields[4:6]
        if count > 4096 or size > 1024*1024 or base+32+size > end: raise ValueError('app-image-command-budget')
        commands = stream.read(size); offset = 0
        if len(commands) != size: raise ValueError('truncated-app-image-command')
        for _ in range(count):
            if offset+8 > size: raise ValueError('truncated-app-image-command')
            command,length = struct.unpack_from(endian+'II',commands,offset)
            if length < 8 or length % 8 or offset+length > size: raise ValueError('invalid-app-image-command')
            if command == 0x1d: raise ValueError('pre-signed-app-image')
            offset += length
    if stable(path) != before: raise ValueError('changed-app-native-image')
    return fields[3]


def layout(root, graph, architecture):
    """Authenticated disk inventory, independent of runtime/physical acceptance."""
    if architecture not in ('x86_64','arm64'):
        raise ValueError('unsupported-app-architecture')
    root = Path(root)
    if root.is_symlink(): raise ValueError('unsafe-app-root')
    root = root.resolve()
    nodes = validate_graph(graph); files = {}; owners = {}
    for node in nodes.values():
        for binding in node['files']:
            name = binding['path']
            if name in files: raise ValueError('duplicate-app-graph-path')
            files[name] = binding; owners[name] = node
    missing = []
    for name in ('Contents/Info.plist',):
        if name not in files:
            missing.append({'path':name,'status':'MISSING','reason':'unbound-app-layout'})
    report = {'status':'INCOMPLETE','layoutComplete':False,'nativeDiskRoutesComplete':False,
              'missing':missing,'nestedMachO':[],'signingOrderCandidate':[],
              'externalPaths':[], 'dynamicLinkers':[], 'publicationEligible':False,'runtimeAcceptance':'UNVERIFIED',
              'signing':'NOT_PERFORMED','externalRequests':0}
    if missing: return report
    # All authenticated application files must be present, including license material.
    for name, binding in files.items():
        verify_local_asset(root,name,binding,8*1024**3)
    plist_path = local(root,'Contents/Info.plist')
    if files['Contents/Info.plist']['byteLength'] > 1024*1024:
        raise ValueError('app-plist-budget')
    before = stable(plist_path); raw = plist_path.read_bytes()
    verify_local_asset(root,'Contents/Info.plist',files['Contents/Info.plist'],1024*1024)
    if stable(plist_path) != before: raise ValueError('changed-app-plist')
    info = plistlib.loads(raw)
    executable = info.get('CFBundleExecutable')
    if (info.get('CFBundlePackageType') != 'APPL' or not isinstance(executable,str) or
            not executable or executable in ('.','..') or '/' in executable or '\\' in executable or '\x00' in executable):
        raise ValueError('invalid-app-executable-plist')
    if any('_CodeSignature' in PurePosixPath(name).parts for name in files):
        raise ValueError('pre-signed-app-material')
    main = 'Contents/MacOS/'+executable
    if main not in files or owners[main]['kind'] != 'EXECUTABLE':
        report['missing'].append({'path':main,'status':'MISSING','reason':'unbound-native-wrapper'})
        return report
    # Inventory only this supplied candidate, bounded by the existing graph budget.
    pending = [root]; count = 0
    while pending:
        directory = pending.pop()
        for path in directory.iterdir():
            count += 1
            if count > MAX_FILES*8: raise ValueError('app-tree-budget')
            if path.is_symlink(): raise ValueError('unsafe-app-symlink')
            if path.is_dir(): pending.append(path); continue
            if not path.is_file(): raise ValueError('nonregular-app-file')
            relative = path.relative_to(root).as_posix()
            if relative not in files and relative not in ('runtime-closure.json','distribution-manifest.json'):
                raise ValueError('unbound-app-file')
    images = {}; executables = []
    for name,binding in files.items():
        path = local(root,name)
        with path.open('rb') as stream: magic = stream.read(4)
        is_executable = owners[name]['kind'] == 'EXECUTABLE'
        if is_executable and not path.stat().st_mode & 0o111:
            raise ValueError('app-executable-permission-missing')
        if magic in MAGICS:
            routing = package_image_routes(path,architecture)
            if routing['format'] != 'MACHO64': raise ValueError('non-macos-native-image')
            filetype = unsigned_image_type(path,architecture)
            if name == main and filetype != 2: raise ValueError('native-wrapper-not-MH_EXECUTE')
            verify_local_asset(root,name,binding,8*1024**3)
            images[name] = routing
            report['nestedMachO'].append({'path':name,'architecture':routing['architecture'],
                'digest':binding['digest'],'byteLength':binding['byteLength'],'executable':is_executable,
                'installName':routing['installName']})
        elif is_executable:
            # Shell Helper remains separately visible, never called a native wrapper.
            executables.append(name)
    if main not in images: raise ValueError('native-wrapper-not-macho')
    index = {str(local(root,name)):name for name in images}
    edges = []
    for name,routing in images.items():
        if routing['dynamicLinker'] is not None:
            loader = routing['dynamicLinker']
            report['dynamicLinkers'].append({'parent':name,'path':loader,'status':'UNVERIFIED'})
            classification = 'APPLE_SYSTEM_LOADER_CANDIDATE_POLICY_REQUIRED' if loader == '/usr/lib/dyld' else 'EXTERNAL_DYNAMIC_LINKER_POLICY_REQUIRED'
            report['externalPaths'].append({'parent':name,'path':loader,'kind':classification,'status':'UNVERIFIED'})
        for rpath in routing['rpaths']:
            if rpath != '@loader_path' and not rpath.startswith('@loader_path/'):
                report['externalPaths'].append({'parent':name,'path':rpath,'kind':'LC_RPATH','status':'UNVERIFIED'})
        for command in routing['commands']:
            # Absolute paths are never silently treated as relocatable or permitted.
            if command.startswith('/'):
                classification = 'APPLE_SYSTEM_CANDIDATE_POLICY_REQUIRED' if command.startswith(('/usr/lib/','/System/Library/')) else 'ABSOLUTE_EXTERNAL_PATH'
                report['externalPaths'].append({'parent':name,'path':command,'kind':classification,'status':'UNVERIFIED'})
                continue
            candidates, resolution = _expand_macho_path(local(root,name),command,routing['rpaths'])
            matches = sorted({index[str(path)] for path in candidates if str(path) in index})
            if len(matches) != 1:
                report['externalPaths'].append({'parent':name,'path':command,'kind':resolution,'status':'UNRESOLVED' if not matches else 'AMBIGUOUS'})
            else: edges.append({'parent':name,'child':matches[0],'resolution':resolution})
    report['nestedMachO'].sort(key=lambda item:item['path'])
    report['scriptExecutables'] = sorted(executables)
    report['nativeDiskEdges'] = edges
    # Candidates only: nested code containers follow their contents; root app last.
    targets = set(images)
    for name in images:
        for ancestor in PurePosixPath(name).parents:
            if ancestor.suffix in ('.framework','.app','.xpc','.appex'): targets.add(str(ancestor))
    report['signingOrderCandidate'] = sorted(targets,key=lambda name:(-len(PurePosixPath(name).parts),name))+['.']
    report['layoutComplete'] = True
    report['nativeDiskRoutesComplete'] = not report['externalPaths']
    report['status'] = 'VERIFIED_CANDIDATE_LAYOUT' if report['nativeDiskRoutesComplete'] else 'PARTIAL'
    return report


def inspect(root,manifest,anchor,build,architecture):
    generation,graph = inspect_generation(root,manifest,anchor,build)
    report = {'status':'INCOMPLETE','unsignedDiskComplete':False,'complete':False,
              'generation':generation,'publicationEligible':False,'runtimeAcceptance':'UNVERIFIED'}
    if graph is None: return report
    app = layout(root,graph,architecture); report['appLayout'] = app
    report['unsignedDiskComplete'] = generation['complete'] and app['layoutComplete'] and app['nativeDiskRoutesComplete']
    report['status'] = 'VERIFIED_UNSIGNED_DISK_CANDIDATE' if report['unsignedDiskComplete'] else 'INCOMPLETE'
    # Whole production assembly is still open (launcher/backend/policy/device).
    report['complete'] = False
    return report


def assemble(root,manifest,anchor,build,architecture,destination):
    report = inspect(root,manifest,anchor,build,architecture)
    if not report['unsignedDiskComplete']: return report
    assembled = assemble_generation(root,manifest,anchor,build,destination)
    if not assembled.get('staged'):
        return dict(report,status='INCOMPLETE',unsignedDiskComplete=False,generation=assembled)
    try:
        final = inspect(destination,Path(destination)/'distribution-manifest.json',anchor,build,architecture)
        if not final['unsignedDiskComplete']:
            shutil.rmtree(destination)
            final['staged'] = False
        else: final['staged'] = True
        return final
    except BaseException:
        shutil.rmtree(destination)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('root','manifest','anchor','build','architecture'):
        parser.add_argument('--'+name,required=True)
    parser.add_argument('--destination')
    args = parser.parse_args()
    try:
        values = (args.root,args.manifest,args.anchor,args.build,args.architecture)
        report = assemble(*values,args.destination) if args.destination else inspect(*values)
    except (OSError,ValueError,KeyError,TypeError,StopIteration,plistlib.InvalidFileException) as error:
        report = {'status':'INCOMPLETE','unsignedDiskComplete':False,'complete':False,
                  'reason':str(error),'publicationEligible':False,'externalRequests':0}
    print(json.dumps(report,indent=2))
    return 0 if report.get('unsignedDiskComplete') else 2


if __name__ == '__main__': raise SystemExit(main())
