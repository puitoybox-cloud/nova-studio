"""Synthetic selected-slice package syntax only, never runtime acceptance."""
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from test_native_routing import fat


def route_command(command,name,minimum=12,endian='<'):
    encoded = name.encode()+b'\0'; length = (minimum+len(encoded)+7)//8*8
    return struct.pack(endian+'III',command,length,minimum)+b'\0'*(minimum-12)+encoded+b'\0'*(length-minimum-len(encoded))


def image(commands,cpu=0x1000007,kind=2,endian='<'):
    return struct.pack(endian+'8I',0xfeedfacf,cpu,0,kind,len(commands),sum(map(len,commands)),0,0)+b''.join(commands)


class PackageMachOTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'image'

    def parse(self,raw,architecture='x86_64'):
        from package_macho import package_image_routes
        self.path.write_bytes(raw)
        return package_image_routes(self.path,architecture)

    def test_loader_separate_from_dylib_rpath_and_install_name(self):
        from runtime_evidence import native_image_routes
        raw = image([route_command(0xe,'/usr/lib/dyld'),
            route_command(0xc,'@rpath/private.dylib',24),route_command(0x8000001c,'@loader_path/../Frameworks')])
        result = self.parse(raw)
        self.assertEqual(result['dynamicLinker'],'/usr/lib/dyld')
        self.assertEqual(result['commands'],['@rpath/private.dylib'])
        self.assertEqual(result['rpaths'],['@loader_path/../Frameworks'])
        self.assertEqual(result['architecture'],'x86_64')
        self.assertFalse(result['runtimeSelectionVerified'])
        with self.assertRaisesRegex(ValueError,'unsupported-macho-loader'):
            native_image_routes(self.path,'x86_64')
        dylib = self.parse(image([route_command(0xd,'@rpath/private.dylib',24)],kind=6))
        self.assertEqual(dylib['installName'],'@rpath/private.dylib')
        self.assertEqual(dylib['commands'],[])

    def test_fat_arm64_and_big_endian_selected_slice(self):
        x = image([route_command(0xe,'/usr/lib/dyld')])
        a = image([route_command(0xe,'/usr/lib/dyld')],cpu=0x100000c)
        for arch in ('x86_64','arm64'):
            result = self.parse(fat([(0x1000007,x),(0x100000c,a)]),arch)
            self.assertEqual(result['architecture'],arch)
            self.assertEqual(result['dynamicLinker'],'/usr/lib/dyld')
            self.assertFalse(result['slice']['runtimeSelectionVerified'])
        self.assertEqual(self.parse(image([route_command(0xe,'/usr/lib/dyld',endian='>')],endian='>'))['dynamicLinker'],'/usr/lib/dyld')

    def test_environment_duplicate_loader_and_non_executable_loader_rejected(self):
        command = route_command(0xe,'/usr/lib/dyld')
        for raw in [image([route_command(0x27,'DYLD_LIBRARY_PATH=/foreign')]),
                    image([command,command]),image([command],kind=6)]:
            with self.subTest(raw=raw),self.assertRaises(ValueError): self.parse(raw)

    def test_malformed_string_bounds_and_command_table_fail(self):
        base = route_command(0xe,'/usr/lib/dyld')
        invalid = []
        for index in (0,8,len(base),0xffffffff):
            c = bytearray(base); struct.pack_into('<I',c,8,index); invalid.append(image([bytes(c)]))
        c = bytearray(base); c[12:] = b'x'*(len(c)-12); invalid.append(image([bytes(c)]))
        invalid += [image([struct.pack('<II',0xe,8)]), image([base])+b'extra']
        # Extra disk bytes outside the table are legal; unaccounted table bytes are not.
        invalid.pop()
        c = bytearray(image([base])); struct.pack_into('<I',c,16,0); invalid.append(bytes(c))
        c = bytearray(image([base])); struct.pack_into('<I',c,20,len(base)+8); invalid.append(bytes(c))
        c = bytearray(base); c[12] = 0xff; invalid.append(image([bytes(c)]))
        for raw in invalid:
            with self.subTest(raw=raw),self.assertRaises(ValueError): self.parse(raw)

    def test_wrong_cpu_unsupported_architecture_and_budgets_fail(self):
        for raw,arch in [(image([]),'arm64'),(image([]),'universal2')]:
            with self.assertRaises(ValueError): self.parse(raw,arch)
        for field,value in [(16,4097),(20,1024*1024+1)]:
            raw = bytearray(image([])); struct.pack_into('<I',raw,field,value)
            with self.assertRaises(ValueError): self.parse(raw)

    def test_changed_image_rejected_without_loading_or_rewriting(self):
        import package_macho
        original = package_macho._native_read
        self.path.write_bytes(image([route_command(0xe,'/usr/lib/dyld')]))
        def change(*args):
            raw = original(*args)
            if args[1] == 32:
                with self.path.open('ab') as stream: stream.write(b'changed')
            return raw
        with patch.object(package_macho,'_native_read',side_effect=change),self.assertRaisesRegex(ValueError,'changed'):
            package_macho.package_image_routes(self.path,'x86_64')
