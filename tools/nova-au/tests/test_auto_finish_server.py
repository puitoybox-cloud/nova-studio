import importlib.util, io, json, subprocess, sys, tempfile, unittest
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
 def test_token_is_private_by_default_and_manual_exposure_is_explicit(self):
  self.assertFalse(self.runtime.expose_token)
  manual=server.Runtime(Path(self.temp.name)/'manual',Path(self.temp.name)/'engine',Path(self.temp.name)/'ffmpeg',Path(self.temp.name),True)
  self.assertTrue(manual.expose_token); self.assertNotEqual(manual.lifecycle_session,self.runtime.lifecycle_session)
 def test_packaged_launch_can_pin_exact_music_studio_origin(self):
  pinned=server.Runtime(Path(self.temp.name)/'pinned',Path(self.temp.name)/'engine',Path(self.temp.name)/'ffmpeg',Path(self.temp.name),False,'http://127.0.0.1:8765')
  self.assertEqual(pinned.allowed_origin,'http://127.0.0.1:8765')
 def test_shutdown_reaps_owned_process_group(self):
  child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)'],start_new_session=True)
  self.runtime.jobs['owned']=child
  self.runtime.shutdown()
  self.assertIsNotNone(child.poll())

 def test_new_runtime_discovers_interrupted_session_without_old_token(self):
  sid=self.runtime.create(self.request); record=self.runtime.load(sid); record['state']='running'; self.runtime.save(sid,record)
  fresh=server.Runtime(self.runtime.root,self.runtime.engine,self.runtime.ffmpeg,self.runtime.scripts)
  rows=fresh.discover('p'); self.assertEqual(len(rows),1); self.assertEqual(rows[0]['session'],sid); self.assertTrue(rows[0]['cancelled']); self.assertEqual(rows[0]['audioVersion'],'v1')
  self.assertNotEqual(fresh.token,self.runtime.token); self.assertNotIn('token',json.dumps(rows)); self.assertEqual(fresh.discover('other'),[])
 def test_discovery_keeps_complete_results_and_ignores_corrupt_directory(self):
  sid=self.runtime.create(self.request); record=self.runtime.load(sid); record['state']='complete'; self.runtime.save(sid,record)
  (self.runtime.root/('f'*32)).mkdir(); (self.runtime.root/('f'*32)/'session.json').write_text('{')
  rows=self.runtime.discover('p'); self.assertEqual(len(rows),1); self.assertEqual(rows[0]['state'],'complete'); self.assertEqual(self.runtime.load(sid),record)

 def test_project_render_source_identity_is_retained(self):
  self.request['sourceKind']='project-render'; sid=self.runtime.create(self.request)
  self.assertEqual(self.runtime.load(sid)['request']['sourceKind'],'project-render')
 def test_http_restart_discovery_requires_fresh_authentication(self):
  import http.client, threading
  sid=self.runtime.create(self.request); fresh=server.Runtime(self.runtime.root,self.runtime.engine,self.runtime.ffmpeg,self.runtime.scripts)
  class QuietHandler(server.Handler):
   runtime=fresh
   def log_message(self,*args): pass
  httpd=server.ThreadingHTTPServer(('127.0.0.1',0),QuietHandler); thread=threading.Thread(target=httpd.serve_forever,daemon=True); thread.start()
  try:
   conn=http.client.HTTPConnection('127.0.0.1',httpd.server_port)
   conn.request('GET','/sessions?projectId=p',headers={'X-Nova-Auto-Finish':self.runtime.token}); response=conn.getresponse(); self.assertEqual(response.status,401); response.read()
   conn.request('GET','/sessions?projectId=p',headers={'X-Nova-Auto-Finish':fresh.token}); response=conn.getresponse(); self.assertEqual(response.status,200); payload=json.loads(response.read()); self.assertEqual(payload['sessions'][0]['session'],sid); self.assertEqual(payload['sessions'][0]['projectId'],'p'); conn.close()
  finally: httpd.shutdown(); httpd.server_close(); thread.join()

if __name__=='__main__': unittest.main()
