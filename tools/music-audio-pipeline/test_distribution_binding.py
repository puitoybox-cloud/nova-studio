import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from distribution_binding import load_manifest, validate_health

class DistributionBindingTests(unittest.TestCase):
    def fixture(self):
        m=dict(version=1, buildRevision='fixture', helper=dict(version=1,pipelineRevision=2,sourceDigest='a'*64,protocolVersion=1,runtimeVersion='1',requirementsDigest='d'*64,identityModuleDigest='e'*64,dependencyObserverDigest='f'*64), models=[dict(id='fixture',revision='1',digest='b'*64,byteLength=3)], dependencies=[dict(id='python',version='3',digest='c'*64)], architectures=['x86_64'],assets=[])
        h=dict(ok=True,localOnly=True,host='127.0.0.1',port=8766,version=1,pipelineRevision=2,sourceDigest='a'*64,runtimeIdentity=dict(protocolVersion=1,runtimeVersion='1',architecture='x86_64',requirementsDigest='d'*64,identityModuleDigest='e'*64,dependencyObserverDigest='f'*64,modelInventory=dict(status='VERIFIED',entries=copy.deepcopy(m['models'])),dependencyInventory=dict(status='VERIFIED',entries=copy.deepcopy(m['dependencies']))))
        return m,h
    def test_binding_match_and_wrong_helper_model_dependency(self):
        m,h=self.fixture()
        self.assertTrue(validate_health(m,h))
        for key in ['modelInventory','dependencyInventory']:
            wrong=copy.deepcopy(h);wrong['runtimeIdentity'][key]['status']='UNCONFIGURED'
            with self.assertRaises(ValueError):validate_health(m,wrong)
        wrong=copy.deepcopy(h);wrong['sourceDigest']='d'*64
        with self.assertRaises(ValueError):validate_health(m,wrong)
        self.assertTrue(validate_health(m,h))
    def test_external_anchor_digest_stale_version_missing_and_duplicate(self):
        m,_=self.fixture()
        with tempfile.TemporaryDirectory() as root:
            path=Path(root,'manifest.json')
            raw=json.dumps(m,sort_keys=True,separators=(',',':')).encode();path.write_bytes(raw)
            digest=hashlib.sha256(raw).hexdigest()
            self.assertEqual(load_manifest(path,digest,'fixture'),m)
            for d,b in [(None,'fixture'),('0'*64,'fixture'),(digest,'old')]:
                with self.assertRaises(ValueError):load_manifest(path,d,b)
            for value in [dict(m,version=2),dict(m,critical=True)]:
                path.write_text(json.dumps(value))
                with self.assertRaises(ValueError):load_manifest(path,digest,'fixture')
            path.write_text('{"version":1,"version":1}')
            with self.assertRaises(ValueError):load_manifest(path,digest,'fixture')
