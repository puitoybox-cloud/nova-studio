"""Policy-neutral explicit local launcher preflight. No installation or browser navigation.

Trust anchor/build/root must be supplied externally; this module never chooses a
distribution or signing scheme. The browser envelope is a return value for the
existing bootstrap caller, never written to user storage or printed with paths.
"""
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from runtime_inventory import bootstrap
from scoped_closure import load_contract, verify_assembly
from dependency_identity import verify_local_asset
from distribution_binding import load_manifest

SOURCES = {'helper-source': 'server.py',
           'artifact-verification-source': 'artifact_verification.py',
           'runtime-evidence-source': 'runtime_evidence.py',
           'local-distribution-entry-source': 'local_distribution_entry.py'}


def prepare(root, manifest, anchor, build, pipeline=None):
    pipeline = Path(pipeline or Path(__file__).parent).resolve()
    authenticated = load_manifest(manifest, anchor, build)
    verifier_source = next((e for e in authenticated['assets'] if e['id']=='artifact-verification-source'), None)
    if verifier_source is None:
        raise ValueError('missing-authenticated-verifier-source')
    verify_local_asset(pipeline, 'artifact_verification.py', verifier_source, 1024*1024)
    from artifact_verification import VERIFIER
    runtime = bootstrap(manifest, anchor, build, root)
    for identity, relative in SOURCES.items():
        expected = runtime.expected('assets', identity)
        VERIFIER.verify(pipeline, relative, expected, 1024*1024,
                        identity=identity, version=expected['revision'], build=build)
    if runtime.manifest['helper']['sourceDigest'] != runtime.expected('assets', 'helper-source')['digest']:
        raise ValueError('launcher-helper-source-mismatch')
    graph = load_contract(runtime.root, runtime.manifest)
    artifact_report = verify_assembly(runtime.root, graph)
    if not artifact_report['complete']:
        raise ValueError('launcher-artifact-assembly-incomplete')
    from runtime_evidence import load as load_evidence, assembly_evidence
    evidence = load_evidence(runtime)
    if evidence['buildRevision'] != build:
        raise ValueError('launcher-evidence-build-mismatch')
    executable = runtime.resolve_executable('python-runtime', sys.executable)
    runtime.recheck()
    # Strict Helper boot will independently authenticate and refuse incomplete runtime evidence.
    environment = {k: v for k, v in os.environ.items() if not k.startswith(('PYTHON', 'NOVA_'))}
    environment.update(NOVA_TRUSTED_MANIFEST_PATH=str(Path(manifest).resolve()),
                       NOVA_TRUSTED_MANIFEST_DIGEST=anchor,
                       NOVA_EXPECTED_BUILD_REVISION=build,
                       NOVA_RUNTIME_ASSET_ROOT=str(runtime.root), PYTHONUNBUFFERED='1')
    return {'command': [executable, '-I', str(pipeline/'server.py')],
            'environment': environment,
            'browserEnvelope': {'manifest': runtime.manifest, 'trust': {'manifestDigest': anchor, 'buildRevision': build},
                                'runtimeConfigText': json.dumps(runtime.bindings, sort_keys=True, separators=(',', ':'), ensure_ascii=False)},
            'assembly': artifact_report, 'runtimeAssembly': assembly_evidence(runtime),
            'publicationEligible': False}


def main():
    try:
        result = prepare(os.environ['NOVA_RUNTIME_ASSET_ROOT'],
                         os.environ['NOVA_TRUSTED_MANIFEST_PATH'],
                         os.environ['NOVA_TRUSTED_MANIFEST_DIGEST'],
                         os.environ['NOVA_EXPECTED_BUILD_REVISION'])
        os.execve(result['command'][0], result['command'], result['environment'])
    except (ValueError, OSError, KeyError, TypeError):
        print('Strict local distribution preflight failed; no installation or remote fallback.', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
