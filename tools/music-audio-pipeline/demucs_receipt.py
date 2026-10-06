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
from pathlib import Path

FORMAT='nova-demucs-child-receipt'
MAX_RECEIPT=65536


class OwnedExitObservation:
    """One creator-owned child exit subscription; never a signaling handle.

    Register before reader/supervisor threads can reap this Popen child. Its
    unreaped child identity cannot be reassigned while registering NOTE_EXIT.
    No NOTE_TRACK, PID search, process-group operation or capability promotion.
    """
    def __init__(self, process, session, generation):
        self.process=process;self.creator=os.getpid();self.session=session
        self.generation=hashlib.sha256(json.dumps(generation,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        self.queue=None;self.status='UNVERIFIED';self.exited=False;self.closed=False
        self.identifier=None
        if not isinstance(process,subprocess.Popen) or process.poll() is not None:
            return
        if not hasattr(select,'kqueue'):
            self.status='UNSUPPORTED';return
        try:
            self.identifier=process.pid
            self.queue=select.kqueue()
            event=select.kevent(self.identifier,filter=select.KQ_FILTER_PROC,
                flags=select.KQ_EV_ADD|select.KQ_EV_ENABLE|select.KQ_EV_ONESHOT,
                fflags=select.KQ_NOTE_EXIT)
            self.queue.control([event],0,0)
            self.status='REGISTERED_OWNED_CHILD_EXIT_ONLY'
        except (OSError,ValueError):
            if self.queue is not None:self.queue.close()
            self.queue=None;self.status='UNVERIFIED'

    def observe(self, process, binding=None):
        if process is not self.process or os.getpid()!=self.creator:
            raise ValueError('foreign-owned-exit-observation')
        if self.queue is not None and not self.closed and not self.exited:
            try:
                for event in self.queue.control(None,1,0):
                    if (event.ident!=self.identifier or event.filter!=select.KQ_FILTER_PROC or
                            event.flags & select.KQ_EV_ERROR or not event.fflags & select.KQ_NOTE_EXIT):
                        self.status='UNVERIFIED'
                    else:self.exited=True
            except (OSError,ValueError):self.status='UNVERIFIED'
        return {'childSession':self.session,'generationIdentity':self.generation,
            'requestBindingDigest':hashlib.sha256(json.dumps(binding,sort_keys=True,separators=(',',':')).encode()).hexdigest() if binding is not None else None,
            'creatorOwnership':'RETAINED_POPEN_OBJECT' if isinstance(process,subprocess.Popen) else 'UNVERIFIED',
            'kernelExitSubscription':self.status,'kernelExitObserved':self.exited,
            'leaderReaped':process.poll() is not None,'descriptorClosed':self.closed,
            'liveInterruptionHandle':'UNVERIFIED','ownedDescendantsComplete':False}

    def close(self):
        if self.queue is not None and not self.closed:self.queue.close()
        self.closed=True


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
