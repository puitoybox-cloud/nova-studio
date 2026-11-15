"""Model-load gate contracts; these doubles are not inference evidence."""
import sys
import unittest
from unittest.mock import Mock, patch
import verify_model_load


class VerifyModelLoad(unittest.TestCase):
    def test_both_sessions_require_cpu(self):
        cpu = Mock(); cpu.get_providers.return_value = ['CPUExecutionProvider']
        other = Mock(); other.get_providers.return_value = ['OtherProvider']
        with patch.dict(sys.modules, {'onnxruntime': Mock()}):
            for sessions in ((cpu,), (cpu, other)):
                with patch.object(verify_model_load, 'load_runtime', return_value=((sessions, {}), False)):
                    with self.assertRaises(ValueError): verify_model_load.verify('unused')
            with patch.object(verify_model_load, 'load_runtime', return_value=(((cpu, cpu), {}), False)):
                verify_model_load.verify('unused')

    def test_native_load_failure_propagates(self):
        with patch.dict(sys.modules, {'onnxruntime': Mock()}), patch.object(
                verify_model_load, 'load_runtime', side_effect=RuntimeError('native library incompatible')):
            with self.assertRaisesRegex(RuntimeError, 'native library incompatible'):
                verify_model_load.verify('unused')


if __name__ == '__main__': unittest.main()
