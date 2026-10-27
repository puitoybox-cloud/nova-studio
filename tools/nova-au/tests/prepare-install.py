import importlib.util
from pathlib import Path
import plistlib
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('prepare', Path(__file__).parents[1] / 'prepare-install.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class PrepareTest(unittest.TestCase):
    def test_runtime_inventory_corruption_and_modes(self):
        import json
        with tempfile.TemporaryDirectory() as temp:
            candidate = Path(temp)/'fixture.component'
            root = candidate/'Contents/Resources/Runtime'
            for name in ('Python/bin/python3.12','FFmpeg/bin/ffmpeg','FFmpeg/bin/ffprobe'):
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'executable');p.chmod(0o755)
            # Path component ordering differs from POSIX string ordering for directory/prefix-file pairs.
            (root/'Python.dylib').write_bytes(b'fixture-library')
            rows=[dict(path=r['path'],sha256=r['sha256'],byteLength=r['bytes'],executable=r['executable']) for r in m.inventory(root)]
            manifest=dict(format='nova-contained-runtime-v1',architecture='x86_64',python='Python/bin/python3.12',ffmpeg='FFmpeg/bin/ffmpeg',ffprobe='FFmpeg/bin/ffprobe',files=rows)
            (root/'inventory.json').write_text(json.dumps(manifest))
            self.assertEqual(m.verify_runtime(candidate)['verifiedFiles'],4)
            p=root/'FFmpeg/bin/ffmpeg';p.chmod(0o644)
            with self.assertRaises(ValueError):m.verify_runtime(candidate)
            p.chmod(0o755);p.write_bytes(b'corrupted')
            with self.assertRaises(ValueError):m.verify_runtime(candidate)
            p.write_bytes(b'executable');(root/'unexpected').write_bytes(b'extra')
            with self.assertRaises(ValueError):m.verify_runtime(candidate)

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
