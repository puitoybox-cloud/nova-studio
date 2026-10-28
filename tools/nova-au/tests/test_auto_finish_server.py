import importlib.util, io, json, tempfile, unittest
from pathlib import Path

MODULE=Path(__file__).resolve().parents[1]/'auto-finish-server.py'
spec=importlib.util.spec_from_file_location('auto_finish_server',MODULE); server=importlib.util.module_from_spec(spec); spec.loader.exec_module(server)

class RuntimeTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(); root=Path(self.temp.name); self.runtime=server.Runtime(root/'work',root/'engine',root/'ffmpeg',root)
  self.request={'projectId':'p','audioVersion':'v1','sourceKind':'logic-render','alignmentConfirmed':True,'instruction':'この曲を自然に仕上げて','stems':[{'id':'voice','role':'vocal','name':'voice.wav','size':44,'type':'audio/wav'},{'id':'piano','role':'piano','name':'piano.wav','size':44,'type':'audio/wav'}]}
 def tearDown(self): self.temp.cleanup()
 def test_upload_is_exact_bounded_and_separate_from_sources(self):
  sid=self.runtime.create(self.request); payload=b'RIFF'+b'\0'*40
  self.runtime.upload(sid,'voice',io.BytesIO(payload),44,'vocal'); record=self.runtime.load(sid)
  self.assertEqual(record['uploaded']['voice']['sha256'],__import__('hashlib').sha256(payload).hexdigest()); self.assertEqual(record['state'],'uploading')
  with self.assertRaisesRegex(ValueError,'identity'): self.runtime.upload(sid,'piano',io.BytesIO(payload),44,'vocal')
 def test_request_requires_explicit_alignment_and_supported_roles(self):
  bad=json.loads(json.dumps(self.request)); bad['alignmentConfirmed']=False
  with self.assertRaisesRegex(ValueError,'invalid-request'): self.runtime.create(bad)
  bad=json.loads(json.dumps(self.request)); bad['stems'][0]['role']='instrument'
  with self.assertRaisesRegex(ValueError,'invalid-stem'): self.runtime.create(bad)
 def test_artifacts_are_allowlisted(self):
  sid=self.runtime.create(self.request)
  with self.assertRaisesRegex(ValueError,'not-allowed'): self.runtime.artifact(sid,'../request.json')
 def test_build_inventory_contains_transport(self):
  build=(Path(__file__).resolve().parents[1]/'build.sh').read_text()
  self.assertIn('auto-finish-server.py',build)

if __name__=='__main__': unittest.main()
