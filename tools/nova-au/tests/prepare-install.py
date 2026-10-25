import importlib.util
from pathlib import Path
import plistlib
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('prepare', Path(__file__).parents[1] / 'prepare-install.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class PrepareTest(unittest.TestCase):
    def test_stage_conflict_and_preserve(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); candidate = root/'candidate.component'; contents = candidate/'Contents'; contents.mkdir(parents=True)
            plist = {'CFBundleIdentifier': m.BUNDLE_ID, 'CFBundleVersion': '1', 'LSMinimumSystemVersion': '12.0',
                     'AudioComponents': [dict(zip(('type','subtype','manufacturer'),m.IDENTITY))]}
            (contents/'Info.plist').write_bytes(plistlib.dumps(plist))
            for path in ('MacOS/NovaMix','MacOS/nova-whole-song','Resources/whole-song-runtime.json','Resources/AudioUnitSDK-LICENSE.txt'):
                p=contents/path;p.parent.mkdir(exist_ok=True);p.write_bytes(b'fixture')
            components=root/'Components';components.mkdir()
            result=m.prepare(candidate,root/'kit',[components],native=False)
            self.assertTrue(result['manualInstallationAllowed']);self.assertFalse(result['validation']['signatureVerified'])
            self.assertEqual(m.inventory(candidate),m.inventory(root/'kit/NovaMix.component'))
            with self.assertRaises(FileExistsError):m.prepare(candidate,root/'kit',[components],native=False)
            import shutil
            shutil.copytree(candidate,components/'Renamed.component')
            before=m.inventory(components/'Renamed.component')
            result=m.prepare(candidate,root/'conflict-kit',[components],native=False)
            self.assertFalse(result['manualInstallationAllowed']);self.assertEqual(len(result['installed']),1)
            self.assertEqual(before,m.inventory(components/'Renamed.component'))
            for output in (components/'kit',candidate/'kit'):
                with self.assertRaises(ValueError):m.prepare(candidate,output,[components],native=False)
            (components/'Broken.component').mkdir()
            result=m.prepare(candidate,root/'unreadable-kit',[components],native=False)
            self.assertTrue(result['scanErrors']);self.assertFalse(result['manualInstallationAllowed'])
            (candidate/'escape').symlink_to(root/'kit')
            with self.assertRaises(ValueError):m.prepare(candidate,root/'symlink-kit',[components],native=False)

if __name__=='__main__':unittest.main()
