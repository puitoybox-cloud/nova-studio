"""Resident child protocol and exact parent binding. No PATH lookup or implicit executable."""
import copy
import json
import queue
import subprocess
import threading
import uuid
from pathlib import Path

FORMAT='nova-demucs-child-receipt'
MAX_RECEIPT=65536


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
        self.nonce=uuid.uuid4().hex;self.process=None;self.receipt=None;self.messages=queue.Queue(maxsize=2);self.protocol_error=None;self.lock=threading.Lock()
        try:
            if permit:
                with permit(self.command):self.process=launch(list(self.command),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1,env={'PYTHONDONTWRITEBYTECODE':'1'})
            else:self.process=launch(list(self.command),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1,env={'PYTHONDONTWRITEBYTECODE':'1'})
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
        return validate_receipt(self.receipt,self.expected,self.nonce)

    def process_audio(self,source,output):
        with self.lock:
            self.current();self._send({'type':'process','nonce':self.nonce,'source':str(Path(source).resolve()),'output':str(Path(output).resolve())})
            try:
                result=self._receive()
                if set(result)!={'version','nonce','status'} or result['version']!=1 or result['nonce']!=self.nonce or result['status']!='PROCESSED':raise ValueError('child-processing-failed')
                self.current();return True
            except Exception:self.close();raise

    def close(self):
        self.receipt=None
        process=self.process
        if process is None:return
        try:
            if process.poll() is None:process.terminate()
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill();process.wait(timeout=3)
        finally:
            for stream in [process.stdin,process.stdout]:
                if stream:
                    try:stream.close()
                    except OSError:pass
            reader=getattr(self,'reader',None)
            if reader and reader is not threading.current_thread():reader.join(timeout=1)
            self.process=None
