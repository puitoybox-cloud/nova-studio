import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('diagnostics',Path(__file__).parents[1]/'collect-diagnostics.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class DiagnosticsTest(unittest.TestCase):
    def test_non_mac_rejected_without_output(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(m.platform,'system',return_value='Linux'):
            out=Path(temp)/'report'
            with self.assertRaises(ValueError):m.collect(out)
            self.assertFalse(out.exists())

    def test_failures_timeout_and_existing_receipt_preserved(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(m.platform,'system',return_value='Darwin'):
            out=Path(temp)/'report'
            def run(command,**kwargs):
                self.assertEqual(kwargs['timeout'],120)
                if '-a' in command:raise subprocess.TimeoutExpired(command,120)
                return subprocess.CompletedProcess(command,1,b'failed probe',b'diagnostic stderr')
            with patch.object(m.subprocess,'run',side_effect=run) as runner:
                report=m.collect(out)
                self.assertEqual(runner.call_count,5)
            self.assertIn('error',report['results']['component-list'])
            self.assertEqual(report['results']['component-validation']['exitCode'],1)
            before=(out/'diagnostics.json').read_bytes()
            with self.assertRaises(FileExistsError):m.collect(out)
            self.assertEqual(before,(out/'diagnostics.json').read_bytes())
            self.assertFalse(json.loads(before)['logicPhysicalAcceptance'])

if __name__=='__main__':unittest.main()
