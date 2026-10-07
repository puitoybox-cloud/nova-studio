import hashlib
import hmac
import json
import os
import socket
import subprocess
import sys
import time
import unittest
from local_distribution_entry import (OwnedNativeSummaryDelivery, OwnedResultChannel,
    final_lifecycle_receipt, acknowledge_final_lifecycle, strict_eligibility)

CHILD = r'''
import os,socket,json,hmac,hashlib
s=socket.socket(fileno=int(os.environ['NOVA_OWNED_SUMMARY_FD']))
s.settimeout(3)
def read(n):
 b=b''
 while len(b)<n:
  c=s.recv(n-len(b))
  if not c: raise ValueError('eof')
  b+=c
 return b
raw=read(int.from_bytes(read(4),'big'));e=json.loads(raw)
key=os.environ['KEY'];p=e['payload'];a=e['audit'][-1]
def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()
assert hmac.compare_digest(e['authentication'],hmac.new(key.encode(),json.dumps(p,sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest())
b={'format':'NOVA_FINAL_ACKNOWLEDGEMENT','version':1,'owner':p['owner'],'session':p['session'],
 'request':a['request'],'bindingDigest':a['bindingDigest'],'processingContract':a['processingContract'],
 'generation':a['generation'],'summaryDigest':digest(p),'auditDigest':a['digest'],
 'completionState':p['completionState'],'accepted':True}
if os.environ.get('MUTATE'):b['generation']+=1
k=hmac.new(key.encode(),b'NOVA_FINAL_ACK_KEY_V1',hashlib.sha256).hexdigest()
x=json.dumps({'payload':b,'authentication':hmac.new(k.encode(),json.dumps(b,sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest()},sort_keys=True,separators=(',',':')).encode()
s.sendall(len(x).to_bytes(4,'big')+x);s.close()
'''

class PrivateNativeSummaryTests(unittest.TestCase):
    def delivery(self, channel, code=CHILD, mutate=False):
        key=channel.capability
        def launch(handoff, fd):
            self.assertEqual(handoff['session'],channel.session)
            return subprocess.Popen([sys.executable,'-c',code],
                env={**os.environ,'NOVA_OWNED_SUMMARY_FD':str(fd),'KEY':key,'MUTATE':'1' if mutate else ''},
                pass_fds=(fd,),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        delivery=OwnedNativeSummaryDelivery(launch)
        delivery({'session':channel.session})
        self.addCleanup(lambda: delivery.child.wait(timeout=4))
        return delivery
    def summary(self, channel):
        return final_lifecycle_receipt(channel,{'status':'OBSERVED','state':'STOPPING'},
            {'leaderExited':True,'ownedDescendantsComplete':False},True)
    def test_actual_inherited_popen_summary_and_authenticated_ack_one_shot(self):
        c=OwnedResultChannel('a'*64,time.monotonic()+20)
        d=self.delivery(c);e=self.summary(c)
        r=acknowledge_final_lifecycle(c,d.deliver_final(e))
        self.assertEqual(r['state'],'ACKNOWLEDGED');self.assertFalse(r['complete'])
        self.assertIsNone(d.handle)
        with self.assertRaises(ValueError):d.deliver_final(e)
        with self.assertRaises(ValueError):acknowledge_final_lifecycle(c,{})
    def test_foreign_generation_authenticated_by_same_owner_still_rejected(self):
        c=OwnedResultChannel('a'*64,time.monotonic()+20);d=self.delivery(c,mutate=True)
        ack=d.deliver_final(self.summary(c))
        with self.assertRaises(ValueError):acknowledge_final_lifecycle(c,ack)
        self.assertIsNone(c.final_acknowledgement)
    def test_truncated_oversized_ack_and_eof_close_channel(self):
        for frame in [b'',b'\x00\x00\x40\x01',b'\x00\x00\x00\x08{}']:
            c=OwnedResultChannel('a'*64,time.monotonic()+20)
            code="import os,socket;s=socket.socket(fileno=int(os.environ['NOVA_OWNED_SUMMARY_FD']));s.recv(20000);s.sendall("+repr(frame)+");s.close()"
            d=self.delivery(c,code)
            with self.assertRaises((ValueError,OSError)):d.deliver_final(self.summary(c))
            self.assertIsNone(d.handle)
    def test_missing_exited_or_fake_child_never_delivers(self):
        d=OwnedNativeSummaryDelivery(lambda *args:object())
        with self.assertRaises(ValueError):d({})
        with self.assertRaises(ValueError):d.deliver_final({})
    def test_production_without_private_delivery_blocks_processing(self):
        inv={'identityComplete':True,'evidence':{'dynamicNativeGraph':{'complete':True},'network':{'nativeNetworkVerified':True,'native':'CONTAINED'}}}
        result=strict_eligibility(inv,trusted_bootstrap=True,browser_verified=True,private_lifecycle=False)
        self.assertFalse(result['processingEligible']);self.assertIn('privateLifecycleDelivery',result['blockedBy'])
