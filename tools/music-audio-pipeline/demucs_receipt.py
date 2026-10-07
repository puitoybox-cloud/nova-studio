"""Resident child protocol and exact parent binding. No PATH lookup or implicit executable."""
import copy
import json
import queue
import subprocess
import threading
import uuid
import os
import hashlib
import select
import time
import secrets
import hmac
import socket
from pathlib import Path

FORMAT='nova-demucs-child-receipt'
MAX_RECEIPT=65536


class OwnedExitObservation:
    """One creator-owned child exit subscription; never a signaling handle.

    Register before reader/supervisor threads can reap this Popen child. Its
    unreaped child identity cannot be reassigned while registering NOTE_EXIT.
    No NOTE_TRACK, PID search, process-group operation or capability promotion.
    """
    def __init__(self, process, session, generation, *, owned_channel=None):
        self.process=process;self.creator=os.getpid();self.session=session
        self.generation=hashlib.sha256(json.dumps(generation,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        self.queue=None;self.status='UNVERIFIED';self.exited=False;self.closed=False
        self.identifier=None
        self.registration=uuid.uuid4().hex;self.created_at=time.monotonic()
        self.event_cookie=int(self.registration[:15],16)
        self.pinned_binding=None;self.binding_pinned=False;self.stop_binding=None;self.stop_requested_at=None
        self.pipe_identity={};self.pipe_objects={}
        self.owned_channel=owned_channel
        for name in ('stdin','stdout'):
            pipe=getattr(process,name,None)
            if pipe is not None:
                try:
                    stat=os.fstat(pipe.fileno())
                    self.pipe_identity[name]=(stat.st_dev,stat.st_ino,stat.st_mode)
                    self.pipe_objects[name]=pipe
                except (OSError,ValueError):pass
        if owned_channel is not None:
            stat=os.fstat(owned_channel.fileno())
            self.pipe_identity['privateChannel']=(stat.st_dev,stat.st_ino,stat.st_mode)
            self.pipe_objects['privateChannel']=owned_channel
        if not isinstance(process,subprocess.Popen) or process.poll() is not None:
            return
        if not hasattr(select,'kqueue'):
            self.status='UNSUPPORTED';return
        try:
            self.identifier=process.pid
            self.queue=select.kqueue()
            event=select.kevent(self.identifier,filter=select.KQ_FILTER_PROC,
                flags=select.KQ_EV_ADD|select.KQ_EV_ENABLE|select.KQ_EV_ONESHOT,
                fflags=select.KQ_NOTE_EXIT,udata=self.event_cookie)
            self.queue.control([event],0,0)
            self.status='REGISTERED_OWNED_CHILD_EXIT_ONLY'
        except (OSError,ValueError):
            if self.queue is not None:self.queue.close()
            self.queue=None;self.status='UNVERIFIED'

    def bind_request(self, process, binding):
        if process is not self.process or os.getpid()!=self.creator or self.closed or self.stop_requested_at is not None:
            raise ValueError('stale-owned-exit-binding')
        self.pinned_binding=copy.deepcopy(binding);self.binding_pinned=True

    def request_stop(self, process, binding, authorization):
        if process is not self.process or os.getpid()!=self.creator or self.closed:
            raise ValueError('foreign-owned-stop-observation')
        if self.pinned_binding != binding:
            raise ValueError('stale-owned-stop-binding')
        self.binding_pinned=True
        if self.stop_requested_at is None:
            self.stop_requested_at=time.monotonic()
            self.stop_binding=hashlib.sha256(json.dumps({'binding':binding,'authorization':authorization},sort_keys=True,separators=(',',':')).encode()).hexdigest()
        return self.stop_binding

    def observe(self, process, binding=None):
        if process is not self.process or os.getpid()!=self.creator:
            raise ValueError('foreign-owned-exit-observation')
        if self.binding_pinned and binding != self.pinned_binding:
            raise ValueError('stale-owned-exit-request')
        if self.queue is not None and not self.closed and not self.exited:
            try:
                for event in self.queue.control(None,1,0):
                    if (event.ident!=self.identifier or event.filter!=select.KQ_FILTER_PROC or
                            event.flags & select.KQ_EV_ERROR or not event.fflags & select.KQ_NOTE_EXIT or
                            event.udata!=self.event_cookie):
                        self.status='UNVERIFIED'
                    else:self.exited=True
            except (OSError,ValueError):self.status='UNVERIFIED'
        pipe_status='OBSERVED' if self.pipe_objects else 'UNAVAILABLE'
        for name,pipe in self.pipe_objects.items():
            if name!='privateChannel' and getattr(process,name,None) is not pipe:
                pipe_status='UNVERIFIED';break
            try:
                stat=os.fstat(pipe.fileno())
                if (stat.st_dev,stat.st_ino,stat.st_mode)!=self.pipe_identity[name]:
                    pipe_status='UNVERIFIED';break
            except (OSError,ValueError):
                if self.stop_requested_at is None:pipe_status='UNVERIFIED';break
                pipe_status='CLOSED_AFTER_OWNED_STOP'
        return {'ownedPipeIdentityStatus':pipe_status,'registrationIdentity':self.registration,'registeredAtMonotonic':self.created_at,
            'stopRequestedAtMonotonic':self.stop_requested_at,'stopBindingDigest':self.stop_binding,
            'ownedPipeIdentityDigest':hashlib.sha256(json.dumps(self.pipe_identity,sort_keys=True,separators=(',',':')).encode()).hexdigest() if self.pipe_identity else None,
            'childSession':self.session,'generationIdentity':self.generation,
            'requestBindingDigest':hashlib.sha256(json.dumps(binding,sort_keys=True,separators=(',',':')).encode()).hexdigest() if binding is not None else None,
            'creatorOwnership':'RETAINED_POPEN_OBJECT' if isinstance(process,subprocess.Popen) else 'UNVERIFIED',
            'kernelExitSubscription':self.status,'kernelExitObserved':self.exited,
            'leaderReaped':process.poll() is not None,'descriptorClosed':self.closed,
            'liveInterruptionHandle':'UNVERIFIED','ownedDescendantsComplete':False}

    def close(self):
        if self.queue is not None and not self.closed:self.queue.close()
        self.closed=True


class OwnedStopPipe:
    """One inherited anonymous AF_UNIX stream; existing Helper authority only.

    No listener, path, browser credential, persistent key or signaling operation.
    A validated stop receipt proves admission closure, never descendant exit.
    """
    def __init__(self, handle, identity, capability, *, clock=time.monotonic):
        if (not isinstance(handle,socket.socket) or handle.family!=socket.AF_UNIX or
                handle.type!=socket.SOCK_STREAM or handle.getsockname() not in ('',b'') or
                handle.getpeername() not in ('',b'') or
                set(identity)!={'session','owner','generation','deadline'} or
                any(not isinstance(identity[k],str) or len(identity[k])!=64 or
                    any(c not in '0123456789abcdef' for c in identity[k]) for k in ('session','owner','generation')) or
                type(identity['deadline']) not in (int,float) or
                not clock()<identity['deadline']<=clock()+300 or
                not isinstance(capability,str) or len(capability)!=64 or
                any(c not in '0123456789abcdef' for c in capability)):
            raise ValueError('invalid-owned-stop-pipe')
        self.handle=handle;self.identity=copy.deepcopy(identity);self.key=capability
        self.clock=clock;self.consumed=False;self.closed=False
        self.stop_payload=None;self.final_used=False
        os.set_inheritable(handle.fileno(),False)

    def seal(self,payload):
        raw=json.dumps(payload,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
        return {'payload':payload,'authentication':hmac.new(self.key.encode(),raw,hashlib.sha256).hexdigest()}

    def validate(self,value,kind):
        if self.closed or self.consumed or not self.clock()<self.identity['deadline']+10:
            raise ValueError('stale-owned-stop-pipe')
        if not isinstance(value,dict) or set(value)!={'payload','authentication'}:
            raise ValueError('invalid-owned-stop-envelope')
        p=value['payload']
        if (not isinstance(p,dict) or set(p)!=set(self.identity)|{'kind','requestBindingDigest','challenge'} or
                any(type(p[k]) is not type(v) or p[k]!=v for k,v in self.identity.items()) or p['kind']!=kind or
                any(not isinstance(p[k],str) or len(p[k])!=64 or any(c not in '0123456789abcdef' for c in p[k])
                    for k in ('requestBindingDigest','challenge')) or
                not isinstance(value['authentication'],str) or
                not hmac.compare_digest(value['authentication'],self.seal(p)['authentication'])):
            raise ValueError('foreign-owned-stop-pipe')
        return p

    def send(self,value, *, budget=4096):
        raw=json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()+b'\n'
        if len(raw)>budget:raise ValueError('owned-stop-pipe-budget')
        self.handle.settimeout(1);self.handle.sendall(raw)

    def receive(self, *, budget=4096):
        deadline=min(self.clock()+1,self.identity['deadline']+10);raw=bytearray()
        while len(raw)<budget:
            remaining=deadline-self.clock()
            if remaining<=0:raise TimeoutError('owned-stop-pipe-time-budget')
            self.handle.settimeout(remaining)
            part=self.handle.recv(1)
            if not part:raise ValueError('owned-stop-pipe-eof')
            raw.extend(part)
            if part==b'\n':return json.loads(raw,object_pairs_hook=unique)
        raise ValueError('owned-stop-pipe-budget')

    def request(self,binding):
        payload={**self.identity,'kind':'STOP','requestBindingDigest':hashlib.sha256(
            json.dumps(binding,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
            'challenge':secrets.token_hex(32)}
        self.validate(self.seal(payload),'STOP')
        self.send(self.seal(payload));reply=self.validate(self.receive(),'STOPPING')
        if reply!={**payload,'kind':'STOPPING'}:raise ValueError('foreign-owned-stop-reply')
        self.stop_payload=copy.deepcopy(payload);self.consumed=True
        return {'status':'OBSERVED','scope':'OWNED_INHERITED_DESCRIPTOR','state':'STOPPING',
            'deliveryIdentityDigest':hashlib.sha256(json.dumps(reply,sort_keys=True,separators=(',',':')).encode()).hexdigest()}

    def accept(self,stop):
        payload=self.validate(self.receive(),'STOP')
        stop(copy.deepcopy(payload))
        self.send(self.seal({**payload,'kind':'STOPPING'}));self.stop_payload=copy.deepcopy(payload);self.consumed=True
        return payload

    def _final_payload(self, shutdown):
        if (self.closed or not self.consumed or self.stop_payload is None or self.final_used or
                not self.clock()<self.identity['deadline']+10 or not isinstance(shutdown,dict)):
            raise ValueError('stale-owned-final-delivery')
        return {**self.stop_payload,'kind':'HELPER_SHUTDOWN','shutdown':copy.deepcopy(shutdown)}

    def send_final(self, shutdown):
        """Report after actual child cleanup; never authorize another operation."""
        payload=self._final_payload(shutdown)
        self.final_used=True
        self.send(self.seal(payload),budget=MAX_RECEIPT)

    def receive_final(self):
        # Consume before reading: timeout, malformed and foreign delivery cannot retry.
        self._final_payload({});self.final_used=True
        envelope=self.receive(budget=MAX_RECEIPT)
        if not isinstance(envelope,dict) or set(envelope)!={'payload','authentication'}:
            raise ValueError('invalid-owned-final-envelope')
        payload=envelope['payload']
        if (not isinstance(payload,dict) or set(payload)!=set(self.stop_payload)|{'shutdown'} or
                {k:v for k,v in payload.items() if k!='shutdown'}!={**self.stop_payload,'kind':'HELPER_SHUTDOWN'} or
                not isinstance(payload['shutdown'],dict) or not isinstance(envelope['authentication'],str) or
                not hmac.compare_digest(envelope['authentication'],self.seal(payload)['authentication'])):
            raise ValueError('foreign-owned-final-delivery')
        return {'status':'OBSERVED','scope':'OWNED_INHERITED_DESCRIPTOR',
            'deliveryIdentityDigest':hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
            'shutdown':copy.deepcopy(payload['shutdown'])}

    def close(self):
        if not self.closed:self.handle.close()
        self.closed=True;self.key=''


def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result: raise ValueError('duplicate-receipt-key')
        result[key] = value
    return result


def validate_receipt(value,expected,nonce):
    if not isinstance(value,dict) or set(value)-{'runtimeEvidence'}!={'format','version','nonce','status','child','loader','model','companions','native','closure','lifetime'}:
        raise ValueError('missing-or-invalid-child-receipt')
    if value['format']!=FORMAT or type(value['version']) is not int or value['version']!=1 or value['nonce']!=nonce:
        raise ValueError('stale-child-receipt')
    if value['status']!='LOADED' or value['lifetime']!='LIVE_CHILD':raise ValueError('child-model-load-not-successful')
    for key in ['child','loader','model','companions','native']:
        if value[key]!=expected[key]:raise ValueError('child-receipt-identity-mismatch:'+key)
    closure=value['closure']
    if not isinstance(closure,dict) or closure.get('complete') is not True or closure.get('status')!='COMPLETE':raise ValueError('partial-child-closure')
    if closure.get('entries')!=expected['closureEntries']:raise ValueError('child-closure-mismatch')
    if 'runtimeEvidenceDigest' in expected:
        evidence=value.get('runtimeEvidence')
        if (not isinstance(evidence,dict) or evidence.get('contractDigest')!=expected['runtimeEvidenceDigest'] or
                evidence.get('complete') is not False or evidence.get('publicationEligible') is not False or
                evidence.get('network',{}).get('native')!='UNVERIFIED'):
            raise ValueError('missing-wrong-or-overstated-child-runtime-evidence')
    return copy.deepcopy(value)


class ChildSession:
    def __init__(self,command,expected,launch=subprocess.Popen,timeout=30,permit=None):
        self.command=tuple(command);self.expected=copy.deepcopy(expected);self.timeout=timeout
        self.nonce=uuid.uuid4().hex;self.process=None;self.receipt=None;self.messages=queue.Queue(maxsize=2);self.protocol_error=None;self.lock=threading.Lock();self.processing_binding=None
        try:
            if permit:
                with permit(self.command):self.process=launch(list(self.command),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1,env={'PYTHONDONTWRITEBYTECODE':'1'})
            else:self.process=launch(list(self.command),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1,env={'PYTHONDONTWRITEBYTECODE':'1'})
            self.exit_observer=OwnedExitObservation(self.process,self.nonce,self.expected)
            def enqueue(value):
                try:self.messages.put_nowait(value)
                except queue.Full:raise ValueError('unexpected-child-message-flood')
            def read():
                try:
                    while True:
                        line=self.process.stdout.readline(MAX_RECEIPT+1)
                        if not line:enqueue(ValueError('child-crash-or-missing-receipt'));break
                        if len(line.encode())>MAX_RECEIPT or not line.endswith('\n'):enqueue(ValueError('child-receipt-budget'));break
                        try:enqueue(json.loads(line, object_pairs_hook=unique))
                        except (ValueError,TypeError):enqueue(ValueError('invalid-child-json'));break
                except Exception:self.protocol_error=ValueError('child-pipe-or-message-budget-failed')
            self.reader=threading.Thread(target=read,daemon=True);self.reader.start()
            self._send({'type':'load','nonce':self.nonce})
            self.receipt=validate_receipt(self._receive(),self.expected,self.nonce)
            if self.process.poll() is not None:raise ValueError('child-exited-after-load')
            self.exit_evidence=self.exit_observer.observe(self.process)
        except Exception:
            self.close();raise

    def _send(self,value):
        if self.process is None or self.process.poll() is not None:raise ValueError('child-not-live')
        self.process.stdin.write(json.dumps(value,separators=(',',':'))+'\n');self.process.stdin.flush()

    def _receive(self):
        if self.protocol_error:raise self.protocol_error
        try:value=self.messages.get(timeout=self.timeout)
        except queue.Empty:raise TimeoutError('child-timeout') from None
        if isinstance(value,Exception):raise value
        return value

    def current(self):
        if self.protocol_error:raise self.protocol_error
        if self.process is None or self.process.poll() is not None:raise ValueError('child-not-live')
        self.exit_evidence=self.exit_observer.observe(self.process,self.processing_binding)
        return validate_receipt(self.receipt,self.expected,self.nonce)

    def process_audio(self,source,output,*,binding=None):
        with self.lock:
            if 'runtimeEvidenceDigest' in self.expected and binding is None: raise ValueError('missing-strict-processing-binding')
            self.current()
            request = {'type':'process','nonce':self.nonce,'source':str(Path(source).resolve()),'output':str(Path(output).resolve())}
            if binding is not None: request['binding'] = copy.deepcopy(binding)
            self.processing_binding=copy.deepcopy(binding)
            self.exit_observer.bind_request(self.process,self.processing_binding)
            self.exit_evidence=self.exit_observer.observe(self.process,self.processing_binding)
            self._send(request)
            try:
                result=self._receive()
                keys = {'version','nonce','status'} | ({'processingReceipt'} if binding is not None else set())
                if set(result)!=keys or result['version']!=1 or result['nonce']!=self.nonce or result['status']!='PROCESSED':raise ValueError('child-processing-failed')
                if binding is not None:
                    receipt = result['processingReceipt']
                    if (not isinstance(receipt, dict) or receipt.get('format') != 'NOVA_PROCESSING_RECEIPT' or
                            receipt.get('parentBinding') != binding or
                            any(receipt.get('binding', {}).get(key) != binding[key] for key in ('session', 'request', 'input')) or receipt.get('complete') is not True or
                            receipt.get('processingEligible') is not True or receipt.get('publicationEligible') is not False):
                        raise ValueError('invalid-or-partial-child-processing-receipt')
                    self.current(); return copy.deepcopy(receipt)
                self.current();return True
            except Exception:self.close();raise

    def close(self):
        """EOF is scoped to this owned pipe. No PID-based terminate/kill escalation."""
        self.receipt=None
        process=self.process
        if process is None:return
        receipt={'scope':'EXPLICIT_OWNED_PIPE_ONLY','graceful':'UNVERIFIED',
            'hardInterruption':'UNVERIFIED','ownedDescendantsComplete':False,'complete':False}
        observer=getattr(self,'exit_observer',None)
        if observer is not None:
            observer.request_stop(process,self.processing_binding,{'mechanism':'OWNED_PIPE_EOF'})
        try:
            if process.stdin and not process.stdin.closed: process.stdin.close()
            receipt['graceful']='OBSERVED'
            try: process.wait(timeout=3)
            except subprocess.TimeoutExpired: pass
        except (OSError,ValueError): pass
        receipt['leaderExited']=process.poll() is not None
        observer=getattr(self,'exit_observer',None)
        if observer is not None:
            receipt['ownedExitObservation']=observer.observe(process,self.processing_binding)
            if receipt['leaderExited']:
                observer.close()
                receipt['ownedExitObservation']['descriptorClosed']=True
        self.shutdown_receipt=receipt
        if receipt['leaderExited']:
            if process.stdout:
                try:process.stdout.close()
                except OSError:pass
            reader=getattr(self,'reader',None)
            if reader and reader is not threading.current_thread():reader.join(timeout=1)
            self.process=None
        # A live process handle is retained on timeout; descendants stay UNVERIFIED.
