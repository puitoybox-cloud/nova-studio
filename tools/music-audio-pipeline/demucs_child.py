#!/usr/bin/env python3
"""Offline resident Demucs 4.0.1 adapter. Receipts are emitted only after real load.

The parent verifies this worker and its companion sources before launch. This
worker independently authenticates the manifest/config and rechecks local bytes.
"""
import contextlib
import copy
import hashlib
import importlib.metadata
import json
import platform
import sys
from pathlib import Path

SOURCE=Path(__file__).resolve()
SOURCE_DIGEST=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
if str(SOURCE.parent) not in sys.path:
    sys.path.insert(0,str(SOURCE.parent))
from runtime_inventory import bootstrap, install_offline_guard, local, stable
from scoped_closure import load_contract,verify_closure,private_runtime_preflight
from demucs_receipt import FORMAT,MAX_RECEIPT,unique


def write(value):
    raw=json.dumps(value,separators=(',',':'))
    if len(raw.encode())>MAX_RECEIPT:raise ValueError('receipt-budget')
    print(raw,flush=True)


def processing_inventory(runtime, model, evidence):
    private = runtime.snapshot().get('privatePython')
    if not isinstance(private, dict) or not isinstance(private.get('processOrigin'), dict):
        raise ValueError('missing-child-private-process-origin')
    return {'identityComplete':True, 'models':[copy.deepcopy(model)],
        'runtimeEvidence':copy.deepcopy(evidence), 'privatePython':copy.deepcopy(private)}


def load(runtime,contract,expected,nonce):
    binding=next(e for e in runtime.bindings['models'] if e['runtimeIdentifier']=='demucs')
    distribution=private_runtime_preflight(runtime,contract,SOURCE.parent)
    if binding['loaderVersion']!='4.0.1' or importlib.metadata.version('demucs')!=binding['loaderVersion']:raise ValueError('unsupported-or-wrong-loader-version')
    closure=verify_closure(runtime.root,contract,distribution,build=runtime.manifest['buildRevision'],stamp_sink=lambda relative,stamp:runtime.stamps.__setitem__(('closure',relative),(relative,stamp)))
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
        if entry['id'] not in ('python-runtime','native-wrapper'):raise ValueError('unsupported-child-executable')
        path=sys.executable if entry['id']=='python-runtime' else local(runtime.root,entry['path'])
        runtime.resolve_executable(entry['id'],path)
        receipt['native'].append(runtime.native[entry['id']])
    receipt['native'].sort(key=lambda entry:entry['identity']['id'])
    return model,receipt


def soundfile_only_save(save, path, *args, **kwargs):
    """Keep Demucs 4.0.1 WAV output on the declared soundfile codec.

    Upstream save_audio calls torchaudio.save without a backend. Its dispatcher
    can otherwise choose FFmpeg before soundfile, bypassing our encoder receipt.
    No backend installation, format fallback, or license approval happens here.
    """
    if '://' in str(path) or Path(path).suffix.lower() != '.wav':
        raise ValueError('strict-stem-format-not-supported')
    if kwargs.get('backend') not in (None, 'soundfile'):
        raise ValueError('strict-stem-backend-not-supported')
    kwargs['backend'] = 'soundfile'
    return save(path, *args, **kwargs)


def process(model,binding,source,output,codec=None,receipt=None,*,recheck=None):
    from demucs import separate
    import torchaudio
    from demucs.audio import convert_audio
    original_loader=separate.get_model_from_args;original_track=separate.load_track
    original_writer = getattr(separate, 'save_audio', None)
    original_apply = getattr(separate, 'apply_model', None)
    original_sf_write = None
    original_ta_save = None
    if receipt is not None:
        if codec is None or original_apply is None or original_writer is None: raise ValueError('missing-demucs-processing-backend')
        import soundfile
        original_sf_write = soundfile.write
        original_ta_save = torchaudio.save
    separate.get_model_from_args=lambda args:model
    def local_track(track,audio_channels,samplerate):
        # No FFmpeg/PATH fallback. All subprocesses in this child are forbidden.
        if codec is None:
            audio,sr=torchaudio.load(str(track))
        else:
            import soundfile
            import torch
            from runtime_evidence import decode_soundfile
            samples,sr=decode_soundfile(soundfile,track,codec['version'],receipt=receipt)
            audio=torch.from_numpy(samples.T)
        if receipt is None: return convert_audio(audio,sr,samplerate,audio_channels)
        if sr == samplerate: receipt.not_applicable('resample', 'INPUT_RATE_EQUALS_TARGET_RATE')
        import julius
        original_resample = julius.resample_frac
        def observed_resample(*args, **kwargs):
            return receipt.call('resample','demucs-sample-rate',original_resample,*args,**kwargs)
        julius.resample_frac = observed_resample
        try: return convert_audio(audio,sr,samplerate,audio_channels)
        finally: julius.resample_frac = original_resample
    separate.load_track=local_track
    if receipt is not None:
        def observed_writer(*args, **kwargs):
            # Receipt of dispatch wrapper is separate from the concrete soundfile encoder below.
            if recheck is not None: recheck()
            return receipt.call('encoder','demucs-stem-writer',original_writer,*args,**kwargs)
        separate.save_audio = observed_writer
    if receipt is not None:
        def observed_apply(actual_model, *args, **kwargs):
            if actual_model is not model: raise ValueError('demucs-stem-model-replaced')
            return receipt.call('stem', 'demucs-retained-model', original_apply, actual_model, *args, **kwargs)
        separate.apply_model = observed_apply
        def observed_sf_write(file, *args, **kwargs):
            # torchaudio 2.2.2 calls soundfile.write(file=..., data=...).
            if '://' in str(file): raise ValueError('remote-codec-output')
            if recheck is not None: recheck()
            return receipt.call('encoder', 'soundfile-output', original_sf_write, file, *args,
                native_ids=codec['nativeIds'], **kwargs)
        soundfile.write = observed_sf_write
        torchaudio.save = lambda path, *args, **kwargs: soundfile_only_save(original_ta_save, path, *args, **kwargs)
    try:separate.main(['-n',binding['modelName'],'--repo',str(binding['repository']),'-o',str(output),str(source)])
    finally:
        separate.get_model_from_args=original_loader;separate.load_track=original_track
        if receipt is not None:
            separate.save_audio=original_writer; separate.apply_model=original_apply
            if original_sf_write is not None: soundfile.write=original_sf_write
            if original_ta_save is not None: torchaudio.save=original_ta_save
    return receipt.snapshot() if receipt is not None else None


def main():
    guard = install_offline_guard()
    root,manifest_path,anchor,build=sys.argv[1:5]
    runtime=bootstrap(manifest_path,anchor,build,root)
    contract=load_contract(root,runtime.manifest)
    private_runtime_preflight(runtime,contract,SOURCE.parent)
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
        receipt['runtimeEvidence']['privatePython'] = processing_inventory(runtime,receipt['model'],{})['privatePython']
        write(receipt)
        binding=next(e for e in runtime.bindings['models'] if e['runtimeIdentifier']=='demucs')
        processing_attempts=None
        while True:
            line=sys.stdin.readline(MAX_RECEIPT+1)
            if not line:return
            if len(line)>MAX_RECEIPT:raise ValueError('child-request-budget')
            request=json.loads(line,object_pairs_hook=unique)
            if set(request)!={'type','nonce','source','output','binding'} or request['type']!='process' or request['nonce']!=nonce:raise ValueError('stale-child-request')
            runtime.recheck()
            source=Path(request['source']);output=Path(request['output'])
            if not source.is_absolute() or not output.is_absolute() or source.is_symlink() or not source.is_file() or source.stat().st_size>500*1024*1024:raise ValueError('unsafe-child-audio-input')
            if not receipt["runtimeEvidence"].get("complete"):
                raise ValueError("strict-child-native-network-incomplete")
            from runtime_evidence import ProcessingReceipt, BoundProcessingReceipt, SessionRequestRegistry, audio_identity, stem_output_identity, processing_binding
            if request['binding'].get('input') != audio_identity(source): raise ValueError('wrong-child-input-identity')
            child_evidence = observe(root,evidence_contract,build=build); child_evidence['network'] = guard.snapshot()
            child_inventory = processing_inventory(runtime,receipt['model'],child_evidence)
            child_binding = processing_binding(request['binding']['session'], request['binding']['request'], audio_identity(source), child_inventory)
            if processing_attempts is None: processing_attempts=SessionRequestRegistry(child_binding['session'])
            processing_attempts.claim(child_binding['session'],child_binding['request'])
            bound = BoundProcessingReceipt(child_binding)
            def recheck_processing():
                runtime.recheck()
                current_evidence=observe(root,evidence_contract,build=build)
                current_evidence['network']=guard.snapshot()
                current_inventory=processing_inventory(runtime,receipt['model'],current_evidence)
                bound.check(processing_binding(request['binding']['session'],request['binding']['request'],
                    audio_identity(source),current_inventory))
            try:
                with contextlib.redirect_stdout(sys.stderr):
                    processing_receipt=process(model,binding,source,output,evidence_contract["codec"],ProcessingReceipt(root,evidence_contract),recheck=recheck_processing)
                runtime.recheck()
                processing_receipt['entries'].append({'stage':'model','logicalId':'demucs-retained-model',
                    'identity':receipt['model']['identity'],'status':'VERIFIED','nativeIdentity':'NOT_APPLICABLE',
                    'completed':True,'fallback':False,'evidence':'ACTUAL_RETAINED_OBJECT_AND_VERIFIED_SERIALIZED_BYTES'})
                bound.add_calls(processing_receipt)
                evidence = observe(root,evidence_contract,build=build); evidence['network'] = guard.snapshot()
                # Identity set of request-owned WAV outputs only, never an output directory inventory.
                identity = stem_output_identity(output)
                child_inventory = processing_inventory(runtime,receipt['model'],evidence)
                current_binding = processing_binding(request['binding']['session'], request['binding']['request'], audio_identity(source), child_inventory)
                processed = bound.finish(current_binding, child_inventory, identity)
                bound.consume(processed, current_binding)
                processed['parentBinding'] = request['binding']
                write({'version':1,'nonce':nonce,'status':'PROCESSED','processingReceipt':processed})
            finally:
                if bound.state != 'CONSUMED': bound.abort()
    except Exception:
        write({'format':FORMAT,'version':1,'nonce':nonce,'status':'LOAD_OR_PROCESS_FAILED'})
        raise SystemExit(1)

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit(1)
