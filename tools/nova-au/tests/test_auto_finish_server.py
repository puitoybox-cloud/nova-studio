from unittest.mock import patch, Mock
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

 def uploaded_session(self):
  sid=self.runtime.create(self.request)
  for stem in self.request['stems']: self.runtime.upload(sid,stem['id'],io.BytesIO(b'RIFF'+b'0'*40),44,stem['role'])
  return sid
 def test_changed_same_size_stem_refuses_start_and_resume_without_spawn(self):
  sid=self.uploaded_session(); record=self.runtime.load(sid); path=Path(record['uploaded']['voice']['path']); path.write_bytes(b'RIFF'+b'1'*40)
  before=(self.runtime.directory(sid)/'session.json').read_bytes()
  with patch.object(server.subprocess,'Popen') as spawn:
   for resume in (False,True):
    with self.assertRaisesRegex(ValueError,'integrity'): self.runtime.command(sid,resume)
   spawn.assert_not_called()
  self.assertEqual((self.runtime.directory(sid)/'session.json').read_bytes(),before)
  self.assertFalse((self.runtime.directory(sid)/'request.json').exists())
 def test_missing_truncated_or_rebound_stem_refuses_execution(self):
  for fault in ('missing','short','path','role'):
   with self.subTest(fault=fault):
    sid=self.uploaded_session(); record=self.runtime.load(sid); saved=record['uploaded']['voice']; path=Path(saved['path'])
    if fault=='missing': path.unlink()
    elif fault=='short': path.write_bytes(b'RIFF')
    else: saved[fault]='wrong'; self.runtime.save(sid,record)
    with patch.object(server.subprocess,'Popen') as spawn:
     with self.assertRaisesRegex(ValueError,'integrity'): self.runtime.command(sid)
     spawn.assert_not_called()
 def test_valid_uploads_verify_after_fresh_runtime(self):
  sid=self.uploaded_session(); fresh=server.Runtime(self.runtime.root,self.runtime.engine,self.runtime.ffmpeg,self.runtime.scripts)
  fresh.verified_uploads(sid,fresh.load(sid))
 def test_failed_reupload_keeps_previous_valid_bytes_and_manifest(self):
  sid=self.uploaded_session(); record=self.runtime.load(sid); path=Path(record['uploaded']['voice']['path']); before=path.read_bytes()
  with self.assertRaisesRegex(ValueError,'truncated'): self.runtime.upload(sid,'voice',io.BytesIO(b'RIFF'),44,'vocal')
  self.assertEqual(path.read_bytes(),before); self.assertEqual(self.runtime.load(sid),record); self.assertFalse(path.with_suffix('.partial').exists())
 def test_failed_metadata_replace_preserves_committed_session(self):
  sid=self.uploaded_session(); before=self.runtime.load(sid)
  with patch.object(server.os,'replace',side_effect=OSError('disk failure')):
   with self.assertRaises(OSError): self.runtime.save(sid,{**before,'state':'failed'})
  self.assertEqual(self.runtime.load(sid),before)
 def test_fsync_failure_does_not_publish_uploaded_bytes(self):
  sid=self.runtime.create(self.request); before=self.runtime.load(sid)
  with patch.object(server.os,'fsync',side_effect=OSError('disk failure')):
   with self.assertRaises(OSError): self.runtime.upload(sid,'voice',io.BytesIO(b'RIFF'+b'0'*40),44,'vocal')
  self.assertEqual(self.runtime.load(sid),before); self.assertEqual(list((self.runtime.directory(sid)/'stems').iterdir()),[])
 def test_discovery_isolates_nonobject_and_wrong_shape_records(self):
  sid=self.uploaded_session()
  for i,value in enumerate(([],None,{'format':'nova-auto-finish-session-v1','request':None})):
   path=self.runtime.root/format(i,'032x'); path.mkdir(); (path/'session.json').write_text(json.dumps(value))
  self.assertEqual([r['session'] for r in self.runtime.discover('p')],[sid])
 def test_empty_project_identity_is_rejected_before_writing(self):
  for key in ('projectId','audioVersion'):
   for value in ('',None,1,' '*3):
    with self.subTest(key=key,value=value):
     request={**self.request,key:value}
     with self.assertRaisesRegex(ValueError,'identity'): self.runtime.create(request)
  self.assertEqual(list(self.runtime.root.iterdir()),[])

 def test_old_waiter_cannot_complete_a_new_execution(self):
  sid=self.uploaded_session(); record=self.runtime.load(sid); record['state']='running'; self.runtime.save(sid,record)
  old=Mock(); old.wait.return_value=0; self.runtime.jobs[sid]=Mock(); log=Mock()
  self.runtime._wait(sid,old,log)
  self.assertEqual(self.runtime.load(sid)['state'],'running'); log.close.assert_called_once()
 def test_metadata_failure_after_launch_reaps_process_and_closes_log(self):
  sid=self.uploaded_session(); process=Mock(); process.poll.return_value=None; process.pid=12345
  with patch.object(server.subprocess,'Popen',return_value=process), patch.object(self.runtime,'save',side_effect=OSError('disk failure')), patch.object(server.os,'killpg') as kill:
   with self.assertRaises(OSError): self.runtime.command(sid)
   kill.assert_called_once_with(process.pid,server.signal.SIGTERM); process.wait.assert_called_once_with(timeout=2)
  self.assertEqual(self.runtime.load(sid)['state'],'uploading')
 def test_spawn_failure_leaves_saved_session_retryable(self):
  sid=self.uploaded_session(); before=self.runtime.load(sid)
  with patch.object(server.subprocess,'Popen',side_effect=OSError('cannot launch')):
   with self.assertRaises(OSError): self.runtime.command(sid)
  self.assertEqual(self.runtime.load(sid),before); self.assertNotIn(sid,self.runtime.jobs)

if __name__=='__main__': unittest.main()
