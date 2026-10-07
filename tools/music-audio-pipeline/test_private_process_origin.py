"""Self-only OS executable observations; fixtures never approve production."""
import copy
import ctypes
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import scoped_closure as closure
from runtime_evidence import processing_binding


class PrivateProcessOriginTests(unittest.TestCase):
    def test_actual_self_origin_does_not_promote_parent_or_mapped_bytes(self):
        value = closure.private_process_origin(str(Path(sys.executable).resolve()))
        self.assertIn(value['status'], ('PARTIAL', 'UNVERIFIED'))
        self.assertFalse(value['parentLaunchAuthenticated'])
        if value['status'] == 'PARTIAL':
            self.assertFalse(value['mappedBytesVerified'])
            self.assertTrue(value['approvedPathMatched'])

    def test_other_disk_file_is_not_this_process(self):
        with tempfile.TemporaryDirectory() as directory:
            foreign = Path(directory)/'python'
            foreign.write_bytes(b'executable-fixture')
            with patch('platform.system',return_value='Linux'):
                with self.assertRaisesRegex(ValueError,'foreign-private-process-origin'):
                    closure.private_process_origin(str(foreign))

    def test_kernel_reference_inode_mismatch_fails_even_when_path_matches(self):
        expected = str(Path(sys.executable).resolve())
        actual = os.stat(expected)
        with patch('platform.system',return_value='Linux'), patch('os.readlink',return_value=expected), \
             patch('os.fstat',return_value=type('Stat',(),{'st_dev':actual.st_dev,'st_ino':-1})()):
            with self.assertRaisesRegex(ValueError,'foreign-private-process-origin'):
                closure.private_process_origin(expected)

    def test_os_query_unavailable_never_uses_sys_executable_as_proof(self):
        expected = str(Path(sys.executable).resolve())
        with patch('platform.system',return_value='Linux'), patch('os.readlink',side_effect=OSError):
            value = closure.private_process_origin(expected)
        self.assertEqual(value['status'],'UNVERIFIED')
        self.assertFalse(value['parentLaunchAuthenticated'])

    def test_darwin_query_is_bounded_and_path_only(self):
        expected = str(Path(sys.executable).resolve())
        raw = os.fsencode(expected)+b'\x00'
        def query(buffer, size):
            size._obj.value = len(raw)
            if buffer is None: return -1
            ctypes.memmove(buffer, raw, len(raw)); return 0
        api = type('Api',(),{})(); api._NSGetExecutablePath = query
        with patch('platform.system',return_value='Darwin'), patch('ctypes.CDLL',return_value=api):
            value = closure.private_process_origin(expected)
        self.assertEqual(value['source'],'DYLD_SELF_EXECUTABLE_PATH')
        self.assertEqual(value['status'],'PARTIAL')
        self.assertFalse(value['backingInodeMatched'])
        self.assertFalse(value['mappedBytesVerified'])

    def test_darwin_oversize_query_does_not_allocate(self):
        def query(buffer,size): size._obj.value=65537; return -1
        api=type('Api',(),{})(); api._NSGetExecutablePath=query
        with patch('platform.system',return_value='Darwin'), patch('ctypes.CDLL',return_value=api), \
             patch('ctypes.create_string_buffer',side_effect=AssertionError('unbounded-allocation')):
            self.assertEqual(closure.private_process_origin(str(Path(sys.executable).resolve()))['status'],'UNVERIFIED')

    def test_origin_change_invalidates_existing_processing_inventory(self):
        inventory={'privatePython':{'processOrigin':{'status':'PARTIAL','source':'DYLD_SELF_EXECUTABLE_PATH'}}}
        args=('a'*64,'b'*64,{'digest':'c'*64,'byteLength':1})
        first=processing_binding(*args,inventory)['inventoryRevision']
        changed=copy.deepcopy(inventory); changed['privatePython']['processOrigin']['status']='UNVERIFIED'
        self.assertNotEqual(first,processing_binding(*args,changed)['inventoryRevision'])


if __name__ == '__main__': unittest.main()
