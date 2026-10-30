#!/usr/bin/env python3
"""Check an explicitly supplied approved artifact graph; never installs or bundles."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'tools/music-audio-pipeline'))
from runtime_inventory import bootstrap
from scoped_closure import load_contract,verify_assembly


def inspect(root,manifest,anchor,build):
    runtime=bootstrap(manifest,anchor,build,root)
    graph=load_contract(root,runtime.manifest)
    report=verify_assembly(root,graph,runtime=runtime)
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
