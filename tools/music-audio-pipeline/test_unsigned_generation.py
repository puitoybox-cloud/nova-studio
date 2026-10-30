"""Synthetic copy regressions only; no production asset approval."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import unsigned_generation as package


class UnsignedGenerationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name); self.root = self.base/'source'; self.root.mkdir()
        self.stage = self.base/'stage'; self.stage.mkdir()
        raw = b'disposable synthetic bytes'
        (self.root/'python').write_bytes(raw)
        self.binding = {'path':'python','digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)}

    def test_copy_exact_bytes_executable_mode_and_no_extra_files(self):
        (self.root/'python').chmod(0o6755)
        (self.root/'unapproved').write_text('never copied')
        package.copy_files(self.root,self.stage,[self.binding])
        self.assertEqual((self.stage/'python').read_bytes(),(self.root/'python').read_bytes())
        self.assertEqual((self.stage/'python').stat().st_mode & 0o7777,0o755)
        self.assertEqual([p.name for p in self.stage.iterdir()],['python'])

    def test_missing_tampered_duplicate_and_unsafe_paths_fail(self):
        for binding in [dict(self.binding,path='../python'),dict(self.binding,path='/python'),
                        dict(self.binding,path='missing'),dict(self.binding,digest='0'*64),
                        dict(self.binding,byteLength=1)]:
            with self.subTest(binding=binding), self.assertRaises((OSError,ValueError)):
                package.copy_files(self.root,self.stage,[binding])
        with self.assertRaises(ValueError):
            package.copy_files(self.root,self.stage,[self.binding,self.binding])

    def test_symlink_file_and_ancestor_never_copied(self):
        (self.root/'link').symlink_to(self.root/'python')
        (self.root/'directory').symlink_to(self.root, target_is_directory=True)
        for path in ['link','directory/python']:
            with self.assertRaises(ValueError):
                package.copy_files(self.root,self.stage,[dict(self.binding,path=path)])

    def test_incomplete_preflight_never_creates_destination(self):
        destination = self.base/'output'
        report = {'complete':False,'status':'INCOMPLETE','missing':[{'id':'python-runtime','status':'MISSING'}]}
        with patch.object(package,'inspect',return_value=(report,None)):
            self.assertEqual(package.assemble(self.root,'unused','unused','unused',destination),report)
        self.assertFalse(destination.exists())
        self.assertEqual(sorted(p.name for p in self.base.iterdir()),['source','stage'])

    def test_existing_or_source_destination_refused_before_inspection(self):
        with patch.object(package,'inspect',side_effect=AssertionError('must not inspect')):
            for destination in [self.stage,self.root/'output']:
                with self.assertRaises(ValueError):
                    package.assemble(self.root,'unused','unused','unused',destination)

    def test_moving_source_detected(self):
        original = package.stable; calls = 0
        def changed(path):
            nonlocal calls
            calls += 1
            stamp = original(path)
            return stamp if calls == 1 else (*stamp[:-1],stamp[-1]+1)
        with patch.object(package,'stable',side_effect=changed), self.assertRaisesRegex(ValueError,'changed-package-source'):
            package.copy_files(self.root,self.stage,[self.binding])

    def test_staging_rechecks_copied_generation_and_cleans_failure(self):
        from test_demucs_closure import contract_fixture
        graph = contract_fixture(self.root)
        raw = b'fixture closure'; (self.root/'runtime-closure.json').write_bytes(raw)
        closure = {'id':'runtime-closure','digest':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw)}
        manifest = self.base/'manifest.json'; manifest.write_text('fixture manifest')
        destination = self.base/'output'
        complete = {'complete':True,'publicationEligible':False,'runtimeAcceptance':'UNVERIFIED'}
        incomplete = {'complete':False,'status':'INCOMPLETE'}
        with patch.object(package,'inspect',side_effect=[(complete,graph),(incomplete,None)]) as inspect, \
             patch.object(package,'load_manifest',return_value={'assets':[closure]}):
            self.assertEqual(package.assemble(self.root,manifest,'anchor','build',destination),incomplete)
            staged = inspect.call_args.args[0]
        self.assertFalse(destination.exists()); self.assertFalse(staged.exists())
        with patch.object(package,'inspect',side_effect=[(complete,graph),(dict(complete),graph)]), \
             patch.object(package,'load_manifest',return_value={'assets':[closure]}):
            result = package.assemble(self.root,manifest,'anchor','build',destination)
        self.assertTrue(result['staged']); self.assertFalse(result['publicationEligible'])
        self.assertEqual((destination/'distribution-manifest.json').read_bytes(),manifest.read_bytes())
        self.assertEqual((destination/'runtime-closure.json').read_bytes(),raw)
        self.assertFalse(any(p.name.startswith('.nova-unsigned-') for p in self.base.iterdir()))
