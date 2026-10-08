"""Offline fixtures: no ML packages/model download, no physical acceptance claim."""
import copy
import hashlib
import json
import platform
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from demucs_receipt import FORMAT, ChildSession, validate_receipt
from scoped_closure import canonical, validate_graph, verify_closure, verify_assembly, verify_distribution_metadata, MAX_METADATA_BYTES
from inventory_aggregation import aggregate


def receipt():
    expected={'child':{'architecture':'fixture','sourceDigest':'a'*64},'loader':{'id':'demucs','version':'4.0.1'},
        'model':{'identity':{'id':'demucs','revision':'1','digest':'b'*64,'byteLength':1},'status':'LOADED_VERIFIED_FILE'},
        'companions':[],'native':[],'closureEntries':[]}
    value={'format':FORMAT,'version':1,'nonce':'n','status':'LOADED','lifetime':'LIVE_CHILD',
        **{k:copy.deepcopy(v) for k,v in expected.items() if k!='closureEntries'},
        'closure':{'status':'COMPLETE','complete':True,'entries':[]}}
    return expected,value


class ReceiptTests(unittest.TestCase):
    def test_correct_receipt(self):
        e,r=receipt();self.assertEqual(validate_receipt(r,e,'n'),r)

    def test_child_private_identity_pinned_to_parent_owned_exchange(self):
        e,r=receipt()
        identity={'stdlibArtifactDigest':'a'*64,'installedRecordInventory':[{'id':'fixture'}],
            'executable':{'identity':{'digest':'b'*64}},'runtimeRootIdentity':[1,2],'buildRevision':'fixture'}
        e['privatePythonIdentity']=copy.deepcopy(identity)
        origin={'status':'PARTIAL','approvedPathMatched':True,'mappedBytesVerified':False,'parentLaunchAuthenticated':False}
        r['runtimeEvidence']={'privatePython':{**identity,'processOrigin':origin}}
        self.assertEqual(validate_receipt(r,e,'n'),r)
        for key in identity:
            changed=copy.deepcopy(r);changed['runtimeEvidence']['privatePython'][key]='foreign'
            with self.assertRaisesRegex(ValueError,'foreign-child-private-runtime-origin'):validate_receipt(changed,e,'n')
        for key in ('mappedBytesVerified','parentLaunchAuthenticated'):
            changed=copy.deepcopy(r);changed['runtimeEvidence']['privatePython']['processOrigin'][key]=True
            with self.assertRaisesRegex(ValueError,'foreign-child-private-runtime-origin'):validate_receipt(changed,e,'n')
    def test_wrong_loader_model_digest_companion_architecture(self):
        e,r=receipt()
        mutations=[lambda v:v['loader'].update(version='wrong'),lambda v:v['model']['identity'].update(id='wrong'),
            lambda v:v['model']['identity'].update(digest='wrong'),lambda v:v.update(companions=[{}]),
            lambda v:v['child'].update(architecture='wrong'),lambda v:v.update(native=[{}])]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                v=copy.deepcopy(r);mutate(v)
                with self.assertRaises(ValueError):validate_receipt(v,e,'n')
    def test_load_failed_missing_partial_stale(self):
        e,r=receipt()
        for v in [None,{},dict(r,status='STARTED'),dict(r,status='LOAD_FAILED'),dict(r,nonce='stale'),dict(r,closure={'complete':False})]:
            with self.subTest(value=v):
                with self.assertRaises(ValueError):validate_receipt(v,e,'n')
    def session(self,mode):
        expected,value=receipt()
        with tempfile.TemporaryDirectory() as root:
            path=Path(root,'child.py')
            path.write_text("import json,sys,time\nr=json.loads(sys.stdin.readline());v="+repr(value)+"\nv['nonce']=r['nonce']\nmode="+repr(mode)+"\nif mode=='crash':sys.exit(1)\nif mode=='timeout':time.sleep(5)\nif mode=='failed':v['status']='LOAD_FAILED'\nprint(json.dumps(v),flush=True)\nfor line in sys.stdin:\n r=json.loads(line);print(json.dumps({'version':1,'nonce':r['nonce'],'status':'PROCESSED'}),flush=True)\n")
            return ChildSession([sys.executable,'-I',str(path)],expected,timeout=.5)
    def test_live_child_processing_close_and_retry(self):
        for _ in range(2):
            session=self.session('ok')
            try:
                self.assertEqual(session.current()['status'],'LOADED');self.assertTrue(session.process_audio('input.wav','output'))
            finally:session.close()
            with self.assertRaises(ValueError):session.current()
    def test_parent_recheck_brackets_actual_processing_and_rejects_completion_mutation(self):
        session=self.session('ok');events=[];process=session.process
        try:
            original=session._receive
            def receive():
                result=original();events.append('processed');return result
            session._receive=receive
            def recheck():
                events.append('recheck')
                if 'processed' in events:raise ValueError('changed-parent-private-runtime')
            session.recheck=recheck
            with self.assertRaisesRegex(ValueError,'changed-parent-private-runtime'):
                session.process_audio('input.wav','output')
            self.assertEqual(events,['recheck','processed','recheck'])
            self.assertIsNone(session.receipt)
            self.assertIsNotNone(process.poll())
        finally:session.close()

    def test_demucs_receipt_rejects_changed_pipe_nonce_and_generation(self):
        for mutation in ('stdin', 'nonce', 'generation'):
            with self.subTest(mutation=mutation):
                session=self.session('ok');original=session.process.stdin
                replacement=None
                try:
                    if mutation=='stdin':
                        replacement=tempfile.TemporaryFile(mode='w+');session.process.stdin=replacement
                    elif mutation=='nonce':session.nonce='foreign'
                    else:session.expected['child']['buildRevision']='foreign'
                    with self.assertRaisesRegex(ValueError,'changed-owned-demucs-continuity'):session.current()
                finally:
                    session.process.stdin=original
                    if replacement is not None:replacement.close()
                    session.close()

    def test_timeout_crash_loadfailure(self):
        for mode in ['timeout','crash','failed']:
            with self.subTest(mode=mode):
                with self.assertRaises((ValueError,TimeoutError)):self.session(mode)
    def test_unexpected_executable_permit_rejected(self):
        class Reject:
            def __enter__(self):raise PermissionError('unexpected-executable')
            def __exit__(self,*args):pass
        e,_=receipt()
        with self.assertRaises(PermissionError):ChildSession(['unexpected'],e,permit=lambda command:Reject())


def refresh_fixture_record(root, node):
    import base64, csv, io
    record_path='package-1.dist-info/RECORD'
    files=[f for f in node['files'] if f['path']!=record_path]
    output=io.StringIO(newline='');writer=csv.writer(output,lineterminator='\n')
    for f in files:
        writer.writerow([f['path'],'sha256='+base64.urlsafe_b64encode(bytes.fromhex(f['digest'])).rstrip(b'=').decode(),str(f['byteLength'])])
    writer.writerow([record_path,'',''])
    raw=output.getvalue().encode();Path(root,record_path).write_bytes(raw)
    files.append({'path':record_path,'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)})
    node['files']=files
    node['artifactDigest']=hashlib.sha256(canonical(sorted(files,key=lambda f:f['path']))).hexdigest()


def contract_fixture(root):
    kinds=['SOURCE','PYTHON_RUNTIME','PYTHON_DISTRIBUTION','NATIVE_EXTENSION','MODEL','CONFIG','WEB_ASSET']
    nodes=[]
    for i,kind in enumerate(kinds):
        relative=str(i)+'.bin';raw=('fixture'+str(i)).encode();Path(root,relative).write_bytes(raw)
        files=[{'path':relative,'digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)}]
        if kind == 'PYTHON_DISTRIBUTION':
            metadata = Path(root, 'package-1.dist-info/METADATA')
            metadata.parent.mkdir()
            raw = b'Metadata-Version: 2.1\nName: package\nVersion: 1\n\nDisposable fixture.\n'
            metadata.write_bytes(raw)
            files.append({'path':'package-1.dist-info/METADATA','digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)})
        nodes.append({'id':'package' if kind=='PYTHON_DISTRIBUTION' else kind.lower(),'kind':kind,'version':'1',
            'requires':[],'files':files,'artifactDigest':hashlib.sha256(canonical(files)).hexdigest(),
            'evidence':'VERIFIED_ARTIFACT','licenseStatus':'APPROVED'})
    refresh_fixture_record(root,nodes[2])
    nodes[0]['requires']=[e['id'] for e in nodes[1:]]
    return {'version':1,'roots':['source'],'nodes':nodes}


class ClosureTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.c=contract_fixture(self.root)
        self.dist=lambda name:SimpleNamespace(version='1',files=['2.bin','package-1.dist-info/METADATA','package-1.dist-info/RECORD'],locate_file=lambda p:self.root/p)
    def tearDown(self):self.tmp.cleanup()
    def test_complete_scoped_closure_and_assembly(self):
        r=verify_closure(self.root,self.c,self.dist);self.assertTrue(r['complete']);a=verify_assembly(self.root,self.c,self.dist);self.assertTrue(a['complete']);self.assertFalse(a['bundledByVerifier']);self.assertEqual(a['externalRequests'],0)
    def test_missing_direct_and_transitive(self):
        for index in [1,2]:
            c=copy.deepcopy(self.c);c['nodes'][index]['requires']=['missing']
            with self.assertRaises(ValueError):validate_graph(c)
    def test_wrong_version_and_record_footprint(self):
        for version,files in [('2',['2.bin']),('1',[])]:
            dist=lambda name:SimpleNamespace(version=version,files=files,locate_file=lambda p:self.root/p)
            self.assertFalse(verify_closure(self.root,self.c,dist)['complete'])
    def test_missing_file_and_wrong_native(self):
        Path(self.root,'3.bin').write_bytes(b'wrong');self.assertFalse(verify_closure(self.root,self.c,self.dist)['complete'])
        Path(self.root,'2.bin').unlink();self.assertFalse(verify_closure(self.root,self.c,self.dist)['complete'])
    def test_entry_metadata_unsupported_expected_only(self):
        for evidence in ['VERIFIED_ENTRY_FILE','OBSERVED_METADATA_ONLY','UNSUPPORTED','EXPECTED_ONLY']:
            c=copy.deepcopy(self.c);c['nodes'][2]['evidence']=evidence;r=verify_closure(self.root,c,self.dist)
            self.assertFalse(r['complete']);self.assertEqual(r['entries'][2]['status'],evidence)
    def test_unexpected_dependency_and_cycle(self):
        c=copy.deepcopy(self.c);c['nodes'][0]['requires'].pop()
        with self.assertRaises(ValueError):validate_graph(c)
        c=copy.deepcopy(self.c);c['nodes'][1]['requires']=['source']
        with self.assertRaises(ValueError):validate_graph(c)
    def test_license_policy_physical_classification(self):
        for status,wanted in [('REVIEW_REQUIRED','LICENSE_REVIEW_REQUIRED'),('POLICY_REQUIRED','POLICY_REQUIRED'),('PHYSICAL_ONLY','PHYSICAL_ONLY')]:
            c=copy.deepcopy(self.c);c['nodes'][2]['licenseStatus']=status;a=verify_assembly(self.root,c,self.dist)
            self.assertFalse(a['complete']);self.assertEqual(a['artifacts'][2]['classification'],wanted)
    def test_unsafe_path_and_wrong_graph_digest(self):
        c=copy.deepcopy(self.c);c['nodes'][0]['files'][0]['path']='../escape'
        with self.assertRaises(ValueError):validate_graph(c)


class AggregationTests(unittest.TestCase):
    def fixture(self):
        e,r=receipt();r['child']['architecture']='fixture';m=r['model']['identity'];bp={'id':'bp','revision':'1','digest':'c'*64,'byteLength':1};d={'id':'package','version':'1','digest':'d'*64}
        parent={'inventoryVersion':2,'mode':'STRICT','status':'PARTIAL','architecture':'fixture','models':[{'identity':bp,'status':'LOADED_VERIFIED_FILE'}],
            'dependencies':[{'identity':d,'status':'VERIFIED_ENTRY_FILE'}],'native':[{'identity':{'id':'python-runtime'}}],'assets':[]}
        closure={'complete':True,'status':'COMPLETE','entries':[{'id':'package','kind':'PYTHON_DISTRIBUTION','status':'VERIFIED_ARTIFACT','version':'1'}]}
        r['native']=copy.deepcopy(parent['native']);r['closure']=copy.deepcopy(closure)
        manifest={'models':[bp,m],'dependencies':[d],'architectures':['fixture']}
        return parent,r,closure,manifest
    def test_complete_identity_is_not_native_processing_eligibility(self):
        p,r,c,m=self.fixture();a=aggregate(p,r,c,m);self.assertTrue(a['complete']);self.assertFalse(a['processingEligible']);self.assertFalse(a['publicationEligible']);self.assertEqual(a['dependencies'][0]['status'],'VERIFIED_ARTIFACT')
    def test_missing_demucs_basicpitch_native_arch_manifest_and_partial(self):
        for mutate in [lambda p,r,c,m:p.update(models=[]),lambda p,r,c,m:r.update(native=[]),lambda p,r,c,m:r['child'].update(architecture='wrong'),lambda p,r,c,m:m.update(architectures=['wrong']),lambda p,r,c,m:c.update(complete=False),lambda p,r,c,m:p.update(dependencies=[]),lambda p,r,c,m:p.update(native=[])]:
            p,r,c,m=self.fixture();mutate(p,r,c,m);self.assertFalse(aggregate(p,r,c,m)['complete'])
        p,r,c,m=self.fixture();self.assertFalse(aggregate(p,None,c,m)['complete'])
    def test_legacy_unverified(self):
        p,r,c,m=self.fixture();p['mode']='LEGACY';self.assertEqual(aggregate(p,r,c,m)['status'],'UNVERIFIED')
    def test_wrong_model_digest_and_revision(self):
        for key in ['digest','revision']:
            p,r,c,m=self.fixture();r['model']['identity']=dict(r['model']['identity'],**{key:'wrong'});self.assertFalse(aggregate(p,r,c,m)['complete'])

if __name__=='__main__':unittest.main()

class RealAdapterPathFixtures(unittest.TestCase):
    """Exercise real worker adapter with injected local fake Demucs modules, not ML acceptance."""
    def fixture(self,root,loaded=None):
        import demucs_child
        import types
        model=SimpleNamespace(cpu=lambda:None,eval=lambda:None)
        repository=Path(root,'repo');repository.mkdir();checkpoint=repository/'model.th';checkpoint.write_bytes(b'fixture model')
        loader=Path(root,'pretrained.py');loader.write_text('# fixture loader')
        identity={'id':'demucs','revision':'1','digest':hashlib.sha256(checkpoint.read_bytes()).hexdigest(),'byteLength':checkpoint.stat().st_size}
        binding={'id':'demucs','runtimeIdentifier':'demucs','loaderVersion':'4.0.1','repository':'repo','path':'repo/model.th','companions':[],'modelName':'model'}
        runtime=SimpleNamespace(root=Path(root),manifest={'buildRevision':'fixture'},bindings={'models':[binding],'native':[]},stamps={},recheck=lambda:None,
            verify=lambda kind,id,path:identity if kind=='models' else {'id':id})
        repo=types.ModuleType('demucs.repo');repo.load_model=lambda path:model if loaded is None else loaded(path)
        pretrained=types.ModuleType('demucs.pretrained');pretrained.__file__=str(loader);pretrained.get_model=lambda name,repo:sys.modules['demucs.repo'].load_model(repo/'model.th')
        package=types.ModuleType('demucs');package.pretrained=pretrained;package.repo=repo
        expected={'loader':{'source':{'path':'pretrained.py'}},'native':[]}
        return demucs_child,runtime,expected,model,{'demucs':package,'demucs.pretrained':pretrained,'demucs.repo':repo}
    def test_real_load_hook_receipt_only_after_load_and_exact_object(self):
        with tempfile.TemporaryDirectory() as root:
            child,runtime,expected,model,modules=self.fixture(root)
            with patch.dict(sys.modules,modules),patch.object(child.importlib.metadata,'version',return_value='4.0.1'),patch.object(child,'private_runtime_preflight'),patch.object(child,'verify_closure',return_value={'complete':True,'status':'COMPLETE','entries':[]}):
                actual,receipt=child.load(runtime,{},expected,'n');self.assertIs(actual,model);self.assertEqual(receipt['status'],'LOADED');self.assertEqual(receipt['model']['identity']['id'],'demucs')
    def test_expected_checkpoint_exists_but_real_load_failure(self):
        with tempfile.TemporaryDirectory() as root:
            child,runtime,expected,model,modules=self.fixture(root,lambda path:None)
            with patch.dict(sys.modules,modules),patch.object(child.importlib.metadata,'version',return_value='4.0.1'),patch.object(child,'private_runtime_preflight'),patch.object(child,'verify_closure',return_value={'complete':True}):
                with self.assertRaises(ValueError):child.load(runtime,{},expected,'n')
    def test_unexpected_local_checkpoint_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            child,runtime,expected,model,modules=self.fixture(root);Path(root,'repo','unexpected.th').write_bytes(b'wrong')
            with patch.dict(sys.modules,modules),patch.object(child.importlib.metadata,'version',return_value='4.0.1'),patch.object(child,'private_runtime_preflight'),patch.object(child,'verify_closure',return_value={'complete':True}):
                with self.assertRaises(ValueError):child.load(runtime,{},expected,'n')
    def test_same_retained_model_is_used_for_processing_no_ffmpeg(self):
        import demucs_child,types
        model=object();separate=types.ModuleType('demucs.separate');loader=lambda args:None;track=lambda *args:None
        separate.get_model_from_args=loader;separate.load_track=track
        separate.main=lambda args:self.assertIs(separate.get_model_from_args(None),model)
        package=types.ModuleType('demucs');package.separate=separate;audio=types.ModuleType('demucs.audio');audio.convert_audio=lambda *args:None
        torchaudio=types.ModuleType('torchaudio');torchaudio.load=lambda path:None
        with patch.dict(sys.modules,{'demucs':package,'demucs.separate':separate,'demucs.audio':audio,'torchaudio':torchaudio}):
            demucs_child.process(model,{'modelName':'fixture','repository':'repo'},Path('input'),Path('output'))
        self.assertIs(separate.get_model_from_args,loader);self.assertIs(separate.load_track,track)

class GuardAndInvalidationTests(unittest.TestCase):
    def test_exact_child_permission_is_single_use_and_no_path_fallback(self):
        import subprocess
        folder=Path(__file__).parent.resolve()
        program="""import sys,subprocess
from runtime_inventory import install_offline_guard
g=install_offline_guard();command=[sys.executable,'-c','pass']
with g.permit(command):
 subprocess.run(command,check=True)
 try:subprocess.run(command,check=True)
 except PermissionError:pass
 else:raise AssertionError('reused permission')
for event,args in [('subprocess.Popen',('unexpected',['unexpected'],None,None)),('socket.connect',(None,('example.invalid',443))),('os.exec',('unexpected',[],{}))]:
 try:g.audit(event,args)
 except PermissionError:pass
 else:raise AssertionError('unexpected operation')
"""
        result=subprocess.run([sys.executable,'-c',program],cwd=folder,capture_output=True,text=True,timeout=5)
        self.assertEqual(result.returncode,0,result.stderr)
    def test_dead_child_aggregation_is_blocked_and_cleanup_eligible(self):
        from inventory_aggregation import snapshot
        class Dead:
            closed=False
            def current(self):raise ValueError('child-not-live')
            def close(self):self.closed=True
        child=Dead();runtime=SimpleNamespace(snapshot=lambda:{'mode':'STRICT'},manifest={})
        self.assertEqual(snapshot(runtime,child,{})['status'],'BLOCKED');self.assertTrue(child.closed)
    def test_full_closure_stamps_invalidate_exact_changes(self):
        from runtime_inventory import stable
        with tempfile.TemporaryDirectory() as root:
            contract=contract_fixture(root);stamps={};dist=lambda name:SimpleNamespace(version='1',files=['2.bin','package-1.dist-info/METADATA','package-1.dist-info/RECORD'],locate_file=lambda p:Path(root,p))
            verify_closure(root,contract,dist,stamp_sink=lambda path,stamp:stamps.__setitem__(path,stamp))
            self.assertEqual(set(stamps),{f['path'] for node in contract['nodes'] for f in node['files']});self.assertEqual(len(stamps),9);Path(root,'3.bin').write_bytes(b'changed')
            self.assertNotEqual(stamps['3.bin'],stable(Path(root,'3.bin')))

class InstalledMetadataTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.c=contract_fixture(self.root);self.node=self.c['nodes'][2]
        self.dist=lambda name:SimpleNamespace(version='1',files=[f['path'] for f in self.node['files']],
            locate_file=lambda p:self.root/p,metadata={'Name':'package','Version':'1'})
    def tearDown(self):self.tmp.cleanup()
    def metadata(self,raw):
        f=self.node['files'][1];(self.root/f['path']).write_bytes(raw)
        f.update(digest=hashlib.sha256(raw).hexdigest(),byteLength=len(raw))
        self.node['artifactDigest']=hashlib.sha256(canonical(sorted(self.node['files'],key=lambda f:f['path']))).hexdigest()
        refresh_fixture_record(self.root,self.node)
    def test_wrong_authenticated_name_or_version_blocks_real_assembly(self):
        for raw in [b'Name: different\nVersion: 1\n\n',b'Name: package\nVersion: 2\n\n']:
            with self.subTest(raw=raw):
                self.metadata(raw)
                self.assertFalse(verify_closure(self.root,self.c,self.dist)['complete'])
                self.assertFalse(verify_assembly(self.root,self.c,self.dist)['complete'])
    def test_missing_duplicate_and_malformed_headers_are_rejected(self):
        for raw in [b'Version: 1\n\n',b'Name: package\n\n',b'Name: package\nName: package\nVersion: 1\n\n',
                    b'Name: package\nVersion: 1\nVersion: 1\n\n',b'broken header\nName: package\nVersion: 1\n\n']:
            with self.subTest(raw=raw):
                self.metadata(raw)
                with self.assertRaises(ValueError):verify_distribution_metadata(self.root,self.node)
    def test_missing_or_ambiguous_authenticated_metadata_is_rejected(self):
        for files in [self.node['files'][:1],self.node['files']+[dict(self.node['files'][1],path='other.dist-info/METADATA')]]:
            with self.subTest(files=files):
                with self.assertRaises(ValueError):verify_distribution_metadata(self.root,dict(self.node,files=files))
    def test_normalized_identity_and_declarations_do_not_certify_constraints(self):
        self.node['id']='Some_Package'
        self.c['nodes'][0]['requires']=[self.node['id'] if value=='package' else value for value in self.c['nodes'][0]['requires']]
        self.metadata(b'Name: some.package\nVersion: 1\nRequires-Dist: torch>=1.7.0\nRequires-Dist: typing; python_version < "3.5"\n\n')
        result=verify_distribution_metadata(self.root,self.node)
        self.assertEqual(result['requiresDist'],['torch>=1.7.0','typing; python_version < "3.5"'])
        self.assertFalse(result['dependencyConstraintsVerified'])
        self.assertTrue(verify_closure(self.root,self.c,self.dist)['complete'])
    def test_tampered_metadata_and_oversized_binding_are_rejected(self):
        (self.root/self.node['files'][1]['path']).write_bytes(b'Name: package\nVersion: 1\n\n')
        with self.assertRaises(ValueError):verify_distribution_metadata(self.root,self.node)
        self.node['files'][1]['byteLength']=MAX_METADATA_BYTES+1
        with self.assertRaises(ValueError):verify_distribution_metadata(self.root,self.node)
    def test_detached_resolver_metadata_cannot_override_installed_bytes(self):
        self.metadata(b'Name: impostor\nVersion: 1\n\n')
        self.assertFalse(verify_closure(self.root,self.c,self.dist)['complete'])


class AssemblyCallerTests(unittest.TestCase):
    def fixture(self,root):
        import importlib.util
        path=Path(__file__).resolve().parents[2]/'scripts'/'music-offline-assembly-verifier.py'
        spec=importlib.util.spec_from_file_location('assembly_cli_fixture',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        graph=contract_fixture(root);f=graph['nodes'][4]['files'][0]
        runtime=SimpleNamespace(manifest={'models':[{'id':'model','revision':'1','digest':f['digest'],'byteLength':f['byteLength']}],'dependencies':[],'assets':[]},bindings={'models':[{'id':'model','path':f['path']}],'dependencies':[],'assets':[],'native':[]})
        return module,graph,runtime
    def test_manifest_file_identity_is_linked(self):
        with tempfile.TemporaryDirectory() as root:
            module,graph,runtime=self.fixture(root)
            with patch.object(module,'bootstrap',return_value=runtime),patch.object(module,'load_contract',return_value=graph),patch.object(module,'verify_assembly',return_value={'complete':True,'status':'COMPLETE'}):
                report=module.inspect(root,'manifest','anchor','build')
                self.assertTrue(report['artifactAssemblyComplete'])
                self.assertFalse(report['complete'])
                self.assertFalse(report['assemblyReady'])
                self.assertEqual(report['status'],'OPEN')
    def test_wrong_model_digest_revision_and_missing_identity(self):
        for key,value in [('digest','0'*64),('revision','wrong'),('id','absent')]:
            with tempfile.TemporaryDirectory() as root:
                module,graph,runtime=self.fixture(root);runtime.manifest['models'][0][key]=value
                with patch.object(module,'bootstrap',return_value=runtime),patch.object(module,'load_contract',return_value=graph),patch.object(module,'verify_assembly',return_value={'complete':True,'status':'COMPLETE'}):
                    self.assertFalse(module.inspect(root,'manifest','anchor','build')['complete'])

class HealthCompatibilityTests(unittest.TestCase):
    def test_complete_actual_v2_projects_v1_from_loaded_artifact_evidence(self):
        import server
        actual={'complete':True,'status':'VERIFIED','models':[{'identity':{'id':'loaded'},'status':'LOADED_VERIFIED_FILE'}],
            'dependencies':[{'identity':{'id':'package'},'status':'VERIFIED_ARTIFACT'}],'processingEligible':False}
        with patch.object(server,'STRICT_BOOTSTRAP',True),patch.object(server,'runtime_snapshot',return_value=actual):
            identity=server.runtime_health_identity();self.assertEqual(identity['modelInventory']['entries'],[{'id':'loaded'}]);self.assertEqual(identity['dependencyInventory']['status'],'VERIFIED');self.assertFalse(identity['actualInventory']['processingEligible'])
    def test_partial_never_projects_loaded_or_artifact_verified(self):
        import server
        with patch.object(server,'STRICT_BOOTSTRAP',True),patch.object(server,'runtime_snapshot',return_value={'complete':False,'status':'PARTIAL'}):
            self.assertEqual(server.runtime_health_identity()['modelInventory']['status'],'UNCONFIGURED')
