#!/usr/bin/env python3
"""Private loopback transport for the existing NOVA auto-finish CLI."""
import argparse, hashlib, json, os, secrets, signal, subprocess, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs

ROLES={'vocal','piano','strings','bass','drums'}; MAX_STEM=2*1024*1024*1024

class Runtime:
 def __init__(self, root, engine, ffmpeg, scripts, expose_token=False, allowed_origin=None):
  self.root=Path(root).resolve(); self.root.mkdir(parents=True,exist_ok=True)
  self.engine=Path(engine).resolve(); self.ffmpeg=Path(ffmpeg).resolve(); self.scripts=Path(scripts).resolve()
  self.token=secrets.token_urlsafe(32); self.lifecycle_session=secrets.token_hex(16); self.expose_token=expose_token; self.allowed_origin=allowed_origin; self.lock=threading.Lock(); self.jobs={}
 def directory(self,sid):
  if len(sid)!=32 or any(c not in '0123456789abcdef' for c in sid): raise ValueError('invalid-session')
  path=(self.root/sid).resolve()
  if path.parent!=self.root: raise ValueError('invalid-session')
  return path
 def create(self,value):
  allowed={'projectId','audioVersion','sourceKind','alignmentConfirmed','instruction','stems'}
  if set(value)!=allowed or value['sourceKind'] not in {'logic-render','recorded-audio'} or value['alignmentConfirmed'] is not True or value['instruction'] not in {'この曲をきれいに仕上げて','この曲を自然に仕上げて','全体の音を自然に整えて'}: raise ValueError('invalid-request')
  stems=value['stems']
  if not isinstance(stems,list) or not 2<=len(stems)<=16: raise ValueError('invalid-stem-count')
  ids=set()
  for stem in stems:
   if set(stem)!={'id','role','name','size','type'} or stem['role'] not in ROLES or not isinstance(stem['id'],str) or not stem['id'] or stem['id'] in ids or not isinstance(stem['size'],int) or not 44<=stem['size']<=MAX_STEM: raise ValueError('invalid-stem')
   ids.add(stem['id'])
  sid=secrets.token_hex(16); directory=self.directory(sid); (directory/'stems').mkdir(parents=True)
  (directory/'session.json').write_text(json.dumps({'format':'nova-auto-finish-session-v1','request':value,'uploaded':{},'state':'uploading'},ensure_ascii=False,sort_keys=True))
  return sid
 def load(self,sid): return json.loads((self.directory(sid)/'session.json').read_text())
 def save(self,sid,value):
  path=self.directory(sid)/'session.json'; temp=path.with_suffix('.partial'); temp.write_text(json.dumps(value,ensure_ascii=False,sort_keys=True)); os.replace(temp,path)
 def upload(self,sid,stem_id,stream,length,role):
  with self.lock:
   record=self.load(sid)
   expected=next((x for x in record['request']['stems'] if x['id']==stem_id),None)
   if record['state']!='uploading' or not expected or expected['role']!=role or expected['size']!=length: raise ValueError('stem-identity-mismatch')
   target=self.directory(sid)/'stems'/(hashlib.sha256(stem_id.encode()).hexdigest()+'.wav'); partial=target.with_suffix('.partial'); digest=hashlib.sha256(); remaining=length
   with partial.open('wb') as handle:
    while remaining:
     chunk=stream.read(min(1024*1024,remaining))
     if not chunk: raise ValueError('stem-upload-truncated')
     handle.write(chunk); digest.update(chunk); remaining-=len(chunk)
   os.replace(partial,target); record['uploaded'][stem_id]={'path':str(target),'sha256':digest.hexdigest(),'size':length,'role':role}; self.save(sid,record)
 def command(self,sid,resume=False):
  with self.lock:
   record=self.load(sid)
   if set(record['uploaded'])!={x['id'] for x in record['request']['stems']}: raise ValueError('stems-incomplete')
   active=self.jobs.get(sid)
   if active and active.poll() is None: raise ValueError('already-running')
   request={k:v for k,v in record['request'].items() if k!='stems'}
   request['stems']=[{'id':x['id'],'role':x['role'],'path':record['uploaded'][x['id']]['path']} for x in record['request']['stems']]
   request_path=self.directory(sid)/'request.json'; request_path.write_text(json.dumps(request,ensure_ascii=False))
   output=self.directory(sid)/'finish'; args=[sys.executable,'-I','-B',str(self.scripts/'auto-finish.py'),str(request_path),'--engine',str(self.engine),'--ffmpeg',str(self.ffmpeg),'--output',str(output)]
   if resume: args.append('--resume')
   log=(self.directory(sid)/'process.log').open('ab')
   process=subprocess.Popen(args,stdout=log,stderr=log,start_new_session=True); self.jobs[sid]=process
   record['state']='running'; record.pop('error',None); self.save(sid,record)
   threading.Thread(target=self._wait,args=(sid,process,log),daemon=True).start()
 def _wait(self,sid,process,log):
  code=process.wait(); log.close()
  with self.lock:
   record=self.load(sid)
   if record['state']=='cancelled': return
   record['state']='complete' if code==0 else 'failed'; record['returnCode']=code
   if code: record['error']='auto-finish-process-failed'
   self.save(sid,record)
 def cancel(self,sid):
  with self.lock:
   process=self.jobs.get(sid); record=self.load(sid)
   if process and process.poll() is None: os.killpg(process.pid,signal.SIGTERM)
   record['state']='cancelled'; self.save(sid,record)
 def shutdown(self):
  with self.lock:
   active=[process for process in self.jobs.values() if process.poll() is None]
   for process in active:
    if process.poll() is None:
     try: os.killpg(process.pid,signal.SIGTERM)
     except ProcessLookupError: pass
  deadline=time.monotonic()+2
  for process in active:
   try: process.wait(timeout=max(0,deadline-time.monotonic()))
   except subprocess.TimeoutExpired:
    try: os.killpg(process.pid,signal.SIGKILL)
    except ProcessLookupError: pass
  for process in active:
   try: process.wait(timeout=1)
   except subprocess.TimeoutExpired: pass
 def status(self,sid):
  record=self.load(sid); result={'session':sid,'complete':record['state']=='complete','failed':record['state']=='failed','cancelled':record['state']=='cancelled','message':record.get('error')}
  manifest=self.directory(sid)/'finish'/'auto-finish.json'
  if manifest.exists():
   value=json.loads(manifest.read_text()); result['progress']=value.get('progress'); result['renders']=value.get('renders'); result['complete']=bool(value.get('complete')) and record['state']=='complete'
   master=self.directory(sid)/'finish'/'mastering'/'manifest.json'
   if master.exists(): result['adopted']=json.loads(master.read_text()).get('adopted')
  return result
 def adopt(self,sid,choice):
  if choice not in {'A','B','C','undo'} or not self.status(sid)['complete']: raise ValueError('invalid-adoption')
  finish=self.directory(sid)/'finish'; request=self.load(sid)['request']
  args=[sys.executable,'-I','-B',str(self.scripts/'select-whole-song.py'),str(finish/'mastering'),'--project',request['projectId'],'--track','auto-finish-stereo','--version',request['audioVersion'],'--source-wav',str(finish/'mix.wav'),'--choice',choice,'--approve']
  subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
  return json.loads((finish/'mastering'/'manifest.json').read_text()).get('adopted')
 def artifact(self,sid,name):
  allowed={'A-lufs-matched.wav','B-lufs-matched.wav','C-lufs-matched.wav','adopted.wav'}
  if name not in allowed: raise ValueError('artifact-not-allowed')
  path=self.directory(sid)/'finish'/'mastering'/name
  if not path.is_file() or path.is_symlink(): raise ValueError('artifact-missing')
  return path

class Handler(BaseHTTPRequestHandler):
 runtime=None
 def origin_ok(self):
  origin=self.headers.get('Origin')
  if self.runtime.allowed_origin: return origin==self.runtime.allowed_origin
  return origin in (None,'null') or (origin.startswith('http://127.0.0.1:') and origin[17:].isdigit())
 def cors(self):
  origin=self.headers.get('Origin'); self.send_header('Access-Control-Allow-Origin',origin if origin else 'null'); self.send_header('Vary','Origin')
 def reply(self,status,value):
  body=json.dumps(value,ensure_ascii=False).encode(); self.send_response(status); self.cors(); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
 def authenticated(self,query=None): return secrets.compare_digest(self.headers.get('X-Nova-Auto-Finish','') or (query or ''),self.runtime.token)
 def do_OPTIONS(self):
  if not self.origin_ok(): return self.reply(403,{'error':'origin-forbidden'})
  self.send_response(204); self.cors(); self.send_header('Access-Control-Allow-Headers','Content-Type,X-Nova-Auto-Finish,X-Nova-Stem-Role,X-Nova-File-Name'); self.send_header('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS'); self.end_headers()
 def do_GET(self):
  try:
   parsed=urlsplit(self.path)
   if not self.origin_ok(): return self.reply(403,{'error':'origin-forbidden'})
   if parsed.path=='/health':
    value={'ok':True,'localOnly':True,'host':'127.0.0.1','port':8767,'protocol':1,'lifecycleSession':self.runtime.lifecycle_session}
    if self.runtime.expose_token: value['token']=self.runtime.token
    return self.reply(200,value)
   parts=parsed.path.strip('/').split('/'); query=parse_qs(parsed.query).get('token',[''])[0]
   if not self.authenticated(query): return self.reply(401,{'error':'authentication-required'})
   if len(parts)==2 and parts[0]=='sessions': return self.reply(200,self.runtime.status(parts[1]))
   if len(parts)==4 and parts[0]=='sessions' and parts[2]=='artifacts':
    path=self.runtime.artifact(parts[1],unquote(parts[3])); self.send_response(200); self.cors(); self.send_header('Content-Type','audio/wav'); self.send_header('Content-Length',str(path.stat().st_size)); self.send_header('Cache-Control','no-store'); self.end_headers()
    with path.open('rb') as handle:
     while True:
      chunk=handle.read(1024*1024)
      if not chunk: break
      self.wfile.write(chunk)
    return
   self.reply(404,{'error':'not-found'})
  except Exception as error: self.reply(422,{'error':str(error)})
 def body_json(self):
  size=int(self.headers.get('Content-Length','0'))
  if size<0 or size>1024*1024: raise ValueError('json-body-size')
  return json.loads(self.rfile.read(size))
 def do_POST(self):
  try:
   if not self.origin_ok(): return self.reply(403,{'error':'origin-forbidden'})
   if not self.authenticated(): return self.reply(401,{'error':'authentication-required'})
   parts=urlsplit(self.path).path.strip('/').split('/')
   if parts==['sessions']: return self.reply(201,{'session':self.runtime.create(self.body_json())})
   if len(parts)==3 and parts[0]=='sessions':
    sid,action=parts[1],parts[2]
    if action=='start': self.body_json(); self.runtime.command(sid); return self.reply(202,{'ok':True})
    if action=='resume': self.body_json(); self.runtime.command(sid,True); return self.reply(202,{'ok':True})
    if action=='cancel': self.body_json(); self.runtime.cancel(sid); return self.reply(200,{'ok':True})
    if action=='adopt':
     body=self.body_json()
     if body.get('approve') is not True or set(body)!={'choice','approve'}: raise ValueError('explicit-approval-required')
     return self.reply(200,{'ok':True,'adopted':self.runtime.adopt(sid,body['choice'])})
   self.reply(404,{'error':'not-found'})
  except Exception as error: self.reply(422,{'error':str(error)})
 def do_PUT(self):
  try:
   if not self.origin_ok(): return self.reply(403,{'error':'origin-forbidden'})
   if not self.authenticated(): return self.reply(401,{'error':'authentication-required'})
   parts=urlsplit(self.path).path.strip('/').split('/')
   if len(parts)!=4 or parts[0]!='sessions' or parts[2]!='stems': return self.reply(404,{'error':'not-found'})
   size=int(self.headers.get('Content-Length','-1'))
   if size<44 or size>MAX_STEM: raise ValueError('stem-size')
   self.runtime.upload(parts[1],unquote(parts[3]),self.rfile,size,self.headers.get('X-Nova-Stem-Role','')); self.reply(201,{'ok':True})
  except Exception as error: self.reply(422,{'error':str(error)})
 def log_message(self,fmt,*args): print('[NOVA Auto Finish] '+fmt%args)

def main():
 parser=argparse.ArgumentParser(); parser.add_argument('--workspace',required=True); parser.add_argument('--engine',required=True); parser.add_argument('--ffmpeg',required=True); parser.add_argument('--scripts',default=Path(__file__).resolve().parent); parser.add_argument('--expose-token-for-manual-launch',action='store_true'); parser.add_argument('--allowed-origin'); args=parser.parse_args()
 if args.allowed_origin and args.allowed_origin!='http://127.0.0.1:8765': parser.error('allowed origin must be the packaged Music Studio origin')
 runtime=Runtime(args.workspace,args.engine,args.ffmpeg,args.scripts,args.expose_token_for_manual_launch,args.allowed_origin); Handler.runtime=runtime
 server=ThreadingHTTPServer(('127.0.0.1',8767),Handler)
 def stop(_signum,_frame):
  runtime.shutdown(); threading.Thread(target=server.shutdown,daemon=True).start()
 signal.signal(signal.SIGTERM,stop); signal.signal(signal.SIGINT,stop)
 print(json.dumps({'ok':True,'host':'127.0.0.1','port':8767,'workspace':str(runtime.root),'token':runtime.token,'lifecycleSession':runtime.lifecycle_session}),flush=True)
 try: server.serve_forever()
 finally: runtime.shutdown(); server.server_close()
if __name__=='__main__': main()
