import copy
import hashlib
import hmac
import json
import unittest
from local_distribution_entry import OwnedAuditChain, acknowledge_final_lifecycle, final_lifecycle_receipt, _digest
import test_owned_lifecycle

class AuditTests(unittest.TestCase):
    def chain(self):return OwnedAuditChain('a'*64,'b'*64,'c'*64)
    def test_secret_free_bounded_signed_chain_and_suffix(self):
        a=self.chain();r=a.append('authorize',{'digest':'d'*64},request='d'*64,binding='e'*64,contract='f'*64)
        self.assertEqual(len(a.suffix()),1);self.assertEqual(a.suffix(),[])
        a.append('admission',{},request='d'*64,binding='e'*64,contract='f'*64)
        self.assertEqual(a.entries[-1]['previousDigest'],r['digest']);a.verify()
        self.assertNotIn('c'*64,json.dumps(a.entries));self.assertLess(len(json.dumps(a.entries)),4096)
    def test_order_generation_changed_request_contract_reject(self):
        for change in [{'event':'result'},{'event':'renew','generation':2}]:
            a=self.chain()
            with self.assertRaises(ValueError):a.append(evidence={},**change)
            self.assertEqual(a.entries,[])
        a=self.chain();a.append('authorize',{},request='d'*64,binding='e'*64,contract='f'*64)
        for kwargs in [{'request':'0'*64,'binding':'e'*64,'contract':'f'*64},{'request':'d'*64,'binding':'e'*64,'contract':'0'*64}]:
            with self.assertRaises(ValueError):a.append('admission',{},**kwargs)
    def test_missing_duplicate_reorder_tampered_foreign_chain_reject(self):
        for mutation in ['missing','duplicate','reorder','foreign','digest']:
            a=self.chain();a.append('renew',{},generation=1);a.append('renew',{},generation=2);a.suffix()
            if mutation=='missing':a.entries.pop()
            if mutation=='duplicate':a.entries.append(copy.deepcopy(a.entries[0]))
            if mutation=='reorder':a.entries.reverse()
            if mutation=='foreign':a.entries[0]['session']='f'*64
            if mutation=='digest':a.entries[0]['evidenceDigest']='f'*64
            with self.assertRaises(ValueError):a.append('stop',{},generation=2)
    def test_budget_no_unbounded_growth(self):
        a=self.chain()
        for i in range(16):a.append('renew',{},generation=i+1)
        with self.assertRaises(ValueError):a.append('renew',{},generation=17)
        self.assertEqual(len(a.entries),16)
    def final(self):
        fixture=test_owned_lifecycle.ChannelTests();fixture.setUp();c=fixture.channel;fixture.command('stop')
        r=final_lifecycle_receipt(c,{'status':'OBSERVED','state':'STOPPING'},
            {'remainingOwnedDescendants':None,'ownedDescendantsComplete':False},True)
        self.assertEqual(c.final_key,'');self.assertEqual(c.audit.key,'')
        body={'format':'NOVA_FINAL_ACKNOWLEDGEMENT','version':1,'owner':c.owner,'session':c.session,
            'request':None,'bindingDigest':None,'processingContract':None,'generation':0,
            'summaryDigest':_digest(r['payload']),'auditDigest':c.audit.entries[-1]['digest'],
            'completionState':'PARTIAL','accepted':True}
        envelope={'payload':body,'authentication':hmac.new(c.ack_key.encode(),json.dumps(body,sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest()}
        return c,envelope
    def test_private_ack_is_one_shot_and_never_promotes_partial(self):
        c,envelope=self.final();r=acknowledge_final_lifecycle(c,envelope)
        self.assertEqual(r['state'],'ACKNOWLEDGED');self.assertFalse(r['complete']);self.assertEqual(c.ack_key,'')
        with self.assertRaises(ValueError):acknowledge_final_lifecycle(c,envelope)
    def test_foreign_stale_contract_generation_and_false_complete_ack_reject(self):
        for field in ['session','request','processingContract','generation','auditDigest','summaryDigest','completionState']:
            c,envelope=self.final();envelope['payload'][field]=1 if field=='generation' else 'f'*64
            envelope['authentication']=hmac.new(c.ack_key.encode(),json.dumps(envelope['payload'],sort_keys=True,separators=(',',':')).encode(),hashlib.sha256).hexdigest()
            with self.assertRaises(ValueError):acknowledge_final_lifecycle(c,envelope)
            self.assertIsNone(c.final_acknowledgement)
        c,envelope=self.final();c.clock=lambda:c.ack_deadline
        with self.assertRaises(ValueError):acknowledge_final_lifecycle(c,envelope)
