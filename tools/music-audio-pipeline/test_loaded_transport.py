import hashlib
import http.client
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from runtime_evidence import scoped_loaded_library, shared_library_receipts
from local_distribution_entry import LocalEnvelopeServer, envelope_binding

class LoadedTests(unittest.TestCase):
    def test_real_scoped_loaded_ssl_extension(self):
        import _ssl
        import platform
        import os
        from artifact_verification import VERIFIER
        if not getattr(_ssl,'__file__',None):
            self.assertEqual(_ssl.__spec__.origin,'built-in')
            return  # Statically linked runtime has no separate extension artifact.
        path=Path(_ssl.__file__).resolve()
        with path.open('rb') as stream:
            digest=hashlib.file_digest(stream,'sha256').hexdigest()
        e={'id':'python-ssl-entry','path':path.name,'module':'_ssl','version':platform.python_version(),
            'kind':'SHARED_LIBRARY','digest':digest,'byteLength':path.stat().st_size}
        r=shared_library_receipts(path.parent,{'native':[e],'buildRevision':'test-only'})
        if platform.system() in ('Linux','Darwin') and hasattr(os,'RTLD_NOLOAD'):
            self.assertTrue(r['entries'][0]['actualLoaded'])
        else:
            self.assertEqual(r['entries'][0]['status'],'UNSUPPORTED')
        self.assertFalse(r['complete'])
        self.assertEqual(r['entries'][0]['mappedIntegrity'],'UNVERIFIED')

    def test_disk_and_loaded_evidence_separate(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'codec.so').write_bytes(b'fixture')
            e={'id':'codec','path':'codec.so','module':None,'version':'1','kind':'SHARED_LIBRARY',
               'digest':hashlib.sha256(b'fixture').hexdigest(),'byteLength':7}
            with patch('ctypes.CDLL',return_value=type('Handle',(),{'_handle':1})()) as loader, patch('_ctypes.dlclose') as close:
                r=shared_library_receipts(root,{'native':[e],'buildRevision':'build'})
                close.assert_called_once_with(1)
                self.assertFalse(r['complete']);self.assertTrue(r['entries'][0]['actualLoaded'])
                self.assertEqual(r['entries'][0]['artifactStatus'],'VERIFIED_ARTIFACT')
                self.assertNotIn(folder,json.dumps(r));self.assertEqual(loader.call_args.args,(str(root/'codec.so'),))
                e['digest']='0'*64
                r=shared_library_receipts(root,{'native':[e],'buildRevision':'build'})
                self.assertEqual(r['entries'][0]['artifactStatus'],'UNVERIFIED')
            with patch('ctypes.CDLL',side_effect=OSError):
                self.assertEqual(scoped_loaded_library(root,e,system='Linux')['status'],'EXPECTED_ONLY')
                (root/'codec.so').unlink()
                self.assertEqual(scoped_loaded_library(root,e,system='Linux')['status'],'MISSING')
            with patch('ctypes.CDLL') as loader:
                self.assertEqual(scoped_loaded_library(root,e,system='Windows')['status'],'UNSUPPORTED')
                loader.assert_not_called()

class TransportTests(unittest.TestCase):
    def fixture(self):
        def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        config='{}';m={'buildRevision':'fixture','helper':{'id':'fixture'},'assets':[{'id':'runtime-config','digest':hashlib.sha256(config.encode()).hexdigest()}]}
        e={'manifest':m,'trust':{'manifestDigest':digest(m),'buildRevision':'fixture'},'runtimeConfigText':config}
        expected={'manifestDigest':digest(m),'buildRevision':'fixture','runtimeConfigDigest':hashlib.sha256(config.encode()).hexdigest(),'helperIdentityDigest':digest(m['helper'])}
        return e,expected
    def make(self,**kwargs):
        e,expected=self.fixture()
        return LocalEnvelopeServer({'/index.html':b'<html></html>'},e,
            expected_binding=expected,expected_assets={'/index.html':hashlib.sha256(b'<html></html>').hexdigest()},**kwargs)
    def test_wrong_anchors_and_config(self):
        e,expected=self.fixture();self.assertEqual(envelope_binding(e,expected),expected)
        for key in expected:
            wrong=dict(expected);wrong[key]='wrong'
            with self.assertRaises(ValueError):envelope_binding(e,wrong)
        e['runtimeConfigText']='wrong'
        with self.assertRaises(ValueError):envelope_binding(e,expected)
    def request(self,s,method='POST',headers=None,path='/bootstrap-envelope'):
        c=http.client.HTTPConnection('127.0.0.1',s.server.server_port,timeout=3)
        try:
            c.request(method,path,body=b'',headers=headers or {})
            r=c.getresponse();return r.status,r.read()
        finally:c.close()
    def headers(self,s):return {'Origin':s.origin,'X-Nova-Session':s.session,'X-Nova-Nonce':s.nonce}
    def test_live_loopback_replay_cleanup_retry(self):
        s=self.make();self.assertTrue(s.start()['localOnly'])
        try:
            self.assertEqual(self.request(s,'GET',path='/index.html')[0],200)
            status,data=self.request(s,headers=self.headers(s));self.assertEqual(status,200)
            self.assertEqual(json.loads(data)['origin'],s.origin)
            self.assertEqual(self.request(s,headers=self.headers(s))[0],403)
        finally:s.close()
        s.close()
        with self.assertRaises(ValueError):s.start()
        fresh=self.make();fresh.start()
        try:self.assertEqual(self.request(fresh,headers=self.headers(fresh))[0],200)
        finally:fresh.close()
    def test_wrong_origin_session_nonce_stale(self):
        s=self.make();s.start()
        try:
            for k in ['Origin','X-Nova-Session','X-Nova-Nonce']:
                h=self.headers(s);h[k]='wrong';self.assertEqual(self.request(s,headers=h)[0],403)
            self.assertFalse(s.consumed)
            s.deadline=0;self.assertEqual(self.request(s,headers=self.headers(s))[0],403)
        finally:s.close()
    def test_external_bind_collision(self):
        for host in ['0.0.0.0','localhost','example.invalid','::']:
            with self.assertRaises(ValueError):self.make(host=host)
        s=self.make()
        try:
            with self.assertRaises(OSError):self.make(port=s.server.server_port)
        finally:s.close()
    def test_host_traversal_get_and_wrong_digest(self):
        s=self.make();s.start()
        try:
            self.assertEqual(self.request(s,'GET',path='/../secret')[0],404)
            self.assertEqual(self.request(s,'GET')[0],405)
            self.assertEqual(self.request(s,'GET',{'Host':'external.invalid'},'/index.html')[0],403)
        finally:s.close()
        with self.assertRaises(ValueError):LocalEnvelopeServer({'/x':b'x'},{},expected_binding={},expected_assets={'/x':'0'*64})

class AuditTests(unittest.TestCase):
    def test_observed_events_private_and_native_unverified(self):
        from runtime_inventory import OfflineRuntimeGuard
        with patch('sys.addaudithook'):
            g=OfflineRuntimeGuard()
        g.audit('socket.__new__',('private',))
        for event in ['socket.connect','socket.getaddrinfo','socket.sendto','subprocess.Popen']:
            args=('curl',['curl','https://private.invalid']) if event=='subprocess.Popen' else ('private',)
            with self.assertRaises(PermissionError):g.audit(event,args)
        r=g.snapshot();self.assertFalse(r['nativeNetworkVerified'])
        self.assertEqual(r['native'],'UNVERIFIED');self.assertNotIn('private',json.dumps(r))
        self.assertEqual(r['events']['socket.getaddrinfo'],1)

if __name__=='__main__':unittest.main()
