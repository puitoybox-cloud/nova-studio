"""Package route regressions; fixture bytes are not AI/Mach-O acceptance."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from package_paths import web_root
from package_boot import contained, prepare
from python_child import command

HERE = Path(__file__).resolve().parent


class PackageEntry(unittest.TestCase):
    def test_relocated_web_root_and_escape_rejection(self):
        with tempfile.TemporaryDirectory(prefix='nova relocated ') as tmp:
            contents = Path(tmp) / 'Music Studio.app/Contents'
            code = contents / 'Resources/MusicStudioEngine/code'
            code.mkdir(parents=True)
            with self.assertRaises(FileNotFoundError): web_root(code)
            web = contents / 'Resources/MusicStudioWeb'
            web.mkdir(); (web / 'music-studio.html').write_text('fixture')
            self.assertEqual(web_root(code), web)
            (web / 'music-studio.html').unlink()
            (web / 'music-studio.html').symlink_to(HERE / 'serve.py')
            with self.assertRaises(ValueError): web_root(code)

    def test_host_interpreter_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            contents = Path(tmp) / 'App.app/Contents'
            code = contents / 'Resources/MusicStudioEngine/code'; code.mkdir(parents=True)
            (contents / 'Frameworks/Python').mkdir(parents=True)
            with self.assertRaises(ValueError): prepare(code)

    def test_missing_runtime_does_not_use_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            helper = Path(tmp) / 'Contents/Helpers/MusicStudioEngine'
            helper.parent.mkdir(parents=True)
            shutil.copy2(HERE / 'MusicStudioEngine', helper)
            sentinel = Path(tmp) / 'python3'
            sentinel.write_text('#!/bin/sh\ntouch "' + tmp + '/executed"\n')
            sentinel.chmod(0o755)
            result = subprocess.run([str(helper)], env={'PATH': tmp}, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((Path(tmp) / 'executed').exists())

    def test_child_ignores_pythonpath_and_preserves_engine_imports(self):
        with tempfile.TemporaryDirectory() as tmp:
            marker = Path(tmp) / 'injected'
            (Path(tmp) / 'sitecustomize.py').write_text('from pathlib import Path\nPath(' + repr(str(marker)) + ').touch()')
            result = subprocess.run(command('serve.py', '--help'), env=dict(os.environ, PYTHONPATH=tmp), capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('--weights', result.stdout)
            self.assertFalse(marker.exists())
        with self.assertRaises(ValueError): command('../other.py')


if __name__ == '__main__': unittest.main()
