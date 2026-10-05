#!/usr/bin/env python3
"""Offline resident Demucs 4.0.1 adapter. Receipts are emitted only after real load.

The parent verifies this worker and its companion sources before launch. This
worker independently authenticates the manifest/config and rechecks local bytes.
"""
import contextlib
import hashlib
import importlib.metadata
import json
import platform
import sys
from pathlib import Path

SOURCE=Path(__file__).resolve()
SOURCE_DIGEST=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
sys.path.insert(0,str(SOURCE.parent))
from runtime_inventory import bootstrap, install_offline_guard, local, stable
from scoped_closure import load_contract,verify_closure
from demucs_receipt import FORMAT,MAX_RECEIPT,unique


def write(value):
    raw=json.dumps(value,separators=(',',':'))
    if len(raw.encode())>MAX_RECEIPT:raise ValueError('receipt-budget')
    print(raw,flush=True)


def load(runtime,contract,expected,nonce):
    binding=next(e for e in runtime.bindings['models'] if e['runtimeIdentifier']=='demucs')
    if binding['loaderVersion']!='4.0.1' or importlib.metadata.version('demucs')!=binding['loaderVersion']:raise ValueError('unsupported-or-wrong-loader-version')
    closure=verify_closure(runtime.root,contract,build=runtime.manifest['buildRevision'],stamp_sink=lambda relative,stamp:runtime.stamps.__setitem__(('closure',relative),(relative,stamp)))
    if not closure['complete']:raise ValueError('partial-runtime-closure')
    primary=runtime.verify('models',binding['id'],binding['path'])
    companions=[runtime.verify('assets',e['id'],e['path']) for e in binding['companions']]
    repo=local(runtime.root,binding['repository'])
    allowed={local(runtime.root,binding['path'])}|{local(runtime.root,e['path']) for e in binding['companions'] if e['path'].endswith('.th')}
    if not repo.is_dir() or set(repo.iterdir())!=allowed|{local(runtime.root,e['path']) for e in binding['companions'] if e['path'].endswith('.yaml')}:raise ValueError('unexpected-local-model-repository-file')
    from demucs import pretrained,repo as model_repo
    loader_path=Path(pretrained.__file__).resolve()
    if loader_path!=local(runtime.root,expected['loader']['source']['path']).resolve():raise ValueError('wrong-loader-source')
    runtime.verify('assets','demucs-loader-source',expected['loader']['source']['path'])
    original=model_repo.load_model;loaded_files=[]
    def observed(path):
        path=Path(path).resolve()
        if path not in allowed or path.suffix!='.th':raise ValueError('unexpected-loaded-checkpoint')
        artifact=next((e for e in binding['companions'] if local(runtime.root,e['path']).resolve()==path),None)
        if artifact is not None:runtime.verify('assets',artifact['id'],artifact['path'])
        elif path==local(runtime.root,binding['path']).resolve():runtime.verify('models',binding['id'],binding['path'])
        else:raise ValueError('missing-checkpoint-identity')
        value=original(path)
        if value is None:raise ValueError('checkpoint-load-failed')
        runtime.recheck();loaded_files.append(path);return value
    model_repo.load_model=observed
    try:model=pretrained.get_model(binding['modelName'],repo=repo)
    finally:model_repo.load_model=original
    if model is None or set(loaded_files)!={p.resolve() for p in allowed if p.suffix=='.th'}:raise ValueError('missing-or-unexpected-loaded-checkpoint')
    model.cpu();model.eval();runtime.recheck()
    # Model bytes/revision are manifest-bound; no fabricated independent embedded revision.
    actual_model={'identity':primary,'status':'LOADED_VERIFIED_FILE','source':binding['path'],'runtimeIdentifier':'demucs','companions':companions}
    receipt={'format':FORMAT,'version':1,'nonce':nonce,'status':'LOADED','lifetime':'LIVE_CHILD',
        'child':{'sourceDigest':SOURCE_DIGEST,'runtimeVersion':'1','buildRevision':runtime.manifest['buildRevision'],'pythonVersion':sys.version.split()[0],'architecture':platform.machine()},
        'loader':{'id':'demucs','version':importlib.metadata.version('demucs'),'source':expected['loader']['source']},
        'model':actual_model,'companions':companions,'native':expected['native'],'closure':closure}
    # Native receipts must be observed in this child, never copied as proof from its parent.
    receipt['native']=[]
    for entry in runtime.bindings['native']:
        if entry['id']!='python-runtime':raise ValueError('unsupported-child-executable')
        runtime.resolve_executable(entry['id'],sys.executable)
        receipt['native'].append(runtime.native[entry['id']])
    return model,receipt


def process(model,binding,source,output,codec=None):
    from demucs import separate
    import torchaudio
    from demucs.audio import convert_audio
    original_loader=separate.get_model_from_args;original_track=separate.load_track
    separate.get_model_from_args=lambda args:model
    def local_track(track,audio_channels,samplerate):
        # No FFmpeg/PATH fallback. All subprocesses in this child are forbidden.
        if codec is None:
            audio,sr=torchaudio.load(str(track))
        else:
            import soundfile
            import torch
            from runtime_evidence import decode_soundfile
            samples,sr=decode_soundfile(soundfile,track,codec['version'])
            audio=torch.from_numpy(samples.T)
        return convert_audio(audio,sr,samplerate,audio_channels)
    separate.load_track=local_track
    try:separate.main(['-n',binding['modelName'],'--repo',str(binding['repository']),'-o',str(output),str(source)])
    finally:separate.get_model_from_args=original_loader;separate.load_track=original_track


def main():
    install_offline_guard()
    root,manifest_path,anchor,build=sys.argv[1:5]
    runtime=bootstrap(manifest_path,anchor,build,root)
    contract=load_contract(root,runtime.manifest)
    from runtime_evidence import load as load_evidence, install_import_guard, observe, receipt_evidence
    evidence_contract=load_evidence(runtime)
    install_import_guard(root,evidence_contract)
    expected_asset=next(e for e in runtime.manifest['assets'] if e['id']=='demucs-child-config')
    runtime.verify('assets','demucs-child-config','demucs-child-config.json')
    raw=local(root,'demucs-child-config.json').read_bytes()
    if len(raw)>65536 or hashlib.sha256(raw).hexdigest()!=expected_asset['digest']:raise ValueError('stale-child-config')
    expected=json.loads(raw,object_pairs_hook=unique)
    line=sys.stdin.readline(MAX_RECEIPT+1);request=json.loads(line,object_pairs_hook=unique)
    if set(request)!={'type','nonce'} or request['type']!='load':raise ValueError('invalid-child-load-request')
    nonce=request['nonce']
    if not isinstance(nonce,str) or len(nonce)!=32:raise ValueError('invalid-child-nonce')
    try:
        with contextlib.redirect_stdout(sys.stderr):model,receipt=load(runtime,contract,expected,nonce)
        receipt["runtimeEvidence"]=receipt_evidence(observe(root,evidence_contract,build=build))
        write(receipt)
        binding=next(e for e in runtime.bindings['models'] if e['runtimeIdentifier']=='demucs')
        while True:
            line=sys.stdin.readline(MAX_RECEIPT+1)
            if not line:return
            if len(line)>MAX_RECEIPT:raise ValueError('child-request-budget')
            request=json.loads(line,object_pairs_hook=unique)
            if set(request)!={'type','nonce','source','output'} or request['type']!='process' or request['nonce']!=nonce:raise ValueError('stale-child-request')
            runtime.recheck()
            source=Path(request['source']);output=Path(request['output'])
            if not source.is_absolute() or not output.is_absolute() or source.is_symlink() or not source.is_file() or source.stat().st_size>500*1024*1024:raise ValueError('unsafe-child-audio-input')
            if not receipt["runtimeEvidence"].get("complete"):
                raise ValueError("strict-child-native-network-incomplete")
            with contextlib.redirect_stdout(sys.stderr):process(model,binding,source,output,evidence_contract["codec"])
            runtime.recheck();write({'version':1,'nonce':nonce,'status':'PROCESSED'})
    except Exception:
        write({'format':FORMAT,'version':1,'nonce':nonce,'status':'LOAD_OR_PROCESS_FAILED'})
        raise SystemExit(1)

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit(1)
