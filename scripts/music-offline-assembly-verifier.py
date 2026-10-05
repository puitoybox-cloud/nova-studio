#!/usr/bin/env python3
"""Check an explicitly supplied approved artifact graph; never installs or bundles."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'tools/music-audio-pipeline'))
from runtime_inventory import bootstrap
from scoped_closure import load_contract,verify_assembly,validate_graph


def inspect(root,manifest,anchor,build):
    runtime=bootstrap(manifest,anchor,build,root)
    graph=load_contract(root,runtime.manifest)
    nodes=validate_graph(graph)
    report=verify_assembly(root,graph)
    required={e['id'] for kind in ('models','dependencies','assets') for e in runtime.manifest[kind]}-{'runtime-closure'}
    missing=sorted(required-set(nodes))
    mismatches=[]
    for kind in ('models','dependencies','assets'):
        bindings={e['id']:e for e in runtime.bindings[kind]}
        for expected in runtime.manifest[kind]:
            identity=expected['id']
            if identity=='runtime-closure':continue  # Independently anchored, no self-hash cycle.
            node=nodes.get(identity)
            binding=bindings.get(identity)
            if identity=='runtime-config':binding={'path':'runtime-config.json'}
            if binding is None:
                for model in runtime.bindings['models']:
                    binding=next((e for e in model.get('companions',[]) if e['id']==identity),binding)
                binding=next((e for e in runtime.bindings['native'] if e['id']==identity),binding)
                for dependency in runtime.bindings['dependencies']:
                    binding=next((e for e in dependency.get('native',[]) if e['id']==identity),binding)
            if node is None or binding is None:continue
            file=next((f for f in node['files'] if f['path']==binding['path']),None)
            if file is None or file['digest']!=expected['digest'] or ('byteLength' in expected and file['byteLength']!=expected['byteLength']):mismatches.append(identity)
            if kind=='dependencies' and (node['kind']!='PYTHON_DISTRIBUTION' or node['version']!=expected['version']):mismatches.append(identity)
            if kind=='models' and (node['kind']!='MODEL' or node['version']!=expected['revision']):mismatches.append(identity)
    report['manifestIdentityMismatches']=sorted(set(mismatches))
    report['missingManifestIdentities']=missing
    report['trustedManifest']='EXTERNALLY_ANCHORED'
    if missing or mismatches:report.update(status='OPEN',complete=False)
    from runtime_evidence import assembly_evidence
    report['artifactAssemblyComplete'] = report['complete']
    report['runtimeAssembly'] = assembly_evidence(runtime)
    report['assemblyReady'] = report['artifactAssemblyComplete'] and report['runtimeAssembly']['complete']
    report['complete'] = report['assemblyReady']
    report['status'] = 'COMPLETE' if report['assemblyReady'] else 'OPEN'
    report['publicationEligible'] = False
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('root','manifest','anchor','build'):parser.add_argument('--'+name,required=True)
    args=parser.parse_args()
    try:
        # Validate verifier source with the primitive trust-root verifier before cached bootstrap.
        from distribution_binding import load_manifest
        from dependency_identity import verify_local_asset
        manifest=load_manifest(args.manifest,args.anchor,args.build)
        expected=next(e for e in manifest['assets'] if e['id']=='artifact-verification-source')
        verify_local_asset(Path(__file__).resolve().parent.parent/'tools/music-audio-pipeline',
                           'artifact_verification.py',expected,1024*1024)
        result=inspect(args.root,args.manifest,args.anchor,args.build)
        print(json.dumps(result,ensure_ascii=False,indent=2))
        raise SystemExit(0 if result.get('assemblyReady') else 2)
    except (ValueError,OSError,KeyError,StopIteration):
        print(json.dumps({'version':1,'status':'OPEN','complete':False,'reason':'assembly-authentication-or-closure-failed','externalRequests':0}))
        raise SystemExit(2)
