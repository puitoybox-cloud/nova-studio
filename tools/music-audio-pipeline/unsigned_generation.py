"""Offline staging of an externally anchored private generation, never an app release.

Preserves existing logical paths. No install, imports from staged assets, downloads,
anchor creation, signing or model substitution. Runtime acceptance remains separate.
"""
import argparse
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from distribution_binding import load_manifest
from dependency_identity import verify_local_asset
from runtime_inventory import bootstrap, local, stable
from scoped_closure import load_contract, validate_graph, verify_assembly, private_python_layout, MAX_TOTAL


def copy_files(root, destination, files):
    """Copy approved regular bytes only into a new, disposable staging directory."""
    seen = set(); total = 0
    for binding in files:
        relative = binding['path']
        if relative in seen:
            raise ValueError('duplicate-package-path')
        seen.add(relative); total += binding['byteLength']
        if total > MAX_TOTAL:
            raise ValueError('package-byte-budget')
        source = local(root, relative)
        before = stable(source)
        verify_local_asset(root, relative, binding, MAX_TOTAL)
        target = local(destination, relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(); size = 0
        with source.open('rb') as incoming, target.open('xb') as outgoing:
            for chunk in iter(lambda: incoming.read(65536), b''):
                size += len(chunk)
                if size > binding['byteLength']:
                    raise ValueError('changed-package-source')
                digest.update(chunk); outgoing.write(chunk)
        if (stable(source) != before or size != binding['byteLength'] or
                digest.hexdigest() != binding['digest']):
            raise ValueError('changed-package-source')
        # Retain executable permission; discard setuid/setgid and write-by-others.
        target.chmod(0o755 if source.stat().st_mode & 0o111 else 0o644)
        verify_local_asset(destination, relative, binding, MAX_TOTAL)


def inspect(root, manifest, anchor, build):
    manifest = Path(manifest)
    approved = load_manifest(manifest, anchor, build)
    graph = load_contract(root, approved)
    nodes = validate_graph(graph)
    missing = []
    for node in nodes.values():
        if not node['files']:
            missing.append({'id':node['id'], 'path':None, 'status':'MISSING'})
        for binding in node['files']:
            try:
                stable(local(root, binding['path']))
            except (OSError, ValueError):
                missing.append({'id':node['id'], 'path':binding['path'], 'status':'MISSING'})
    report = {'status':'INCOMPLETE', 'complete':False, 'missing':missing,
              'publicationEligible':False, 'runtimeAcceptance':'UNVERIFIED',
              'nativeWrapper':'NOT_ASSEMBLED', 'signing':'NOT_PERFORMED', 'externalRequests':0}
    if missing:
        return report, None
    runtime = bootstrap(manifest, anchor, build, root)
    assembly = verify_assembly(root, graph, runtime=runtime)
    report['artifactAssembly'] = assembly
    if not assembly['complete']:
        return report, None
    private_python_layout(runtime, graph)
    # This is only disk completeness, not native isolation or physical acceptance.
    report.update(status='VERIFIED_GENERATION_BYTES', complete=True)
    return report, graph


def assemble(root, manifest, anchor, build, destination):
    supplied_root = Path(root)
    if supplied_root.is_symlink():
        raise ValueError('unsafe-runtime-root')
    root = supplied_root.resolve(); destination = Path(destination)
    parent = destination.parent
    if (destination.exists() or destination.is_symlink() or parent.is_symlink() or
            not parent.is_dir() or destination.resolve().is_relative_to(root)):
        raise ValueError('unsafe-or-existing-package-destination')
    report, graph = inspect(root, manifest, anchor, build)
    if not report['complete']:
        return report
    nodes = validate_graph(graph)
    files = [f for node in nodes.values() for f in node['files']]
    raw_manifest = Path(manifest).read_bytes()
    closure_binding = next(e for e in load_manifest(manifest,anchor,build)['assets'] if e['id']=='runtime-closure')
    files.append(dict(closure_binding, path='runtime-closure.json'))
    stage = Path(tempfile.mkdtemp(prefix='.nova-unsigned-', dir=parent))
    try:
        copy_files(root, stage, files)
        staged_manifest = stage/'distribution-manifest.json'
        if staged_manifest.exists():
            raise ValueError('reserved-package-manifest-path')
        staged_manifest.write_bytes(raw_manifest)
        final, _ = inspect(stage, staged_manifest, anchor, build)
        if not final['complete']:
            return final
        # Never overwrite a caller's existing directory. Publication remains disabled.
        destination.mkdir()
        try:
            for item in stage.iterdir():
                os.rename(item, destination/item.name)
        except BaseException:
            shutil.rmtree(destination)
            raise
        final['staged'] = True
        return final
    finally:
        shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('root','manifest','anchor','build'):
        parser.add_argument('--'+name, required=True)
    parser.add_argument('--destination')
    args = parser.parse_args()
    try:
        if args.destination:
            report = assemble(args.root,args.manifest,args.anchor,args.build,args.destination)
        else:
            report, _ = inspect(args.root,args.manifest,args.anchor,args.build)
    except (OSError, ValueError, KeyError, TypeError, StopIteration) as error:
        report = {'status':'INCOMPLETE','complete':False,'reason':str(error),
                  'publicationEligible':False,'externalRequests':0}
    print(json.dumps(report, indent=2))
    return 0 if report['complete'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
