"""Package-only Mach-O disk syntax. No loader/policy/runtime acceptance grant.

LC_LOAD_DYLINKER is separate from dylib dependencies and always needs external
policy review. LC_DYLD_ENVIRONMENT remains rejected. Runtime verifier unchanged.
"""
import os
import struct
from pathlib import Path
from artifact_verification import stamp
from runtime_evidence import _native_read, _macho_slice, MAX_CONTRACT_BYTES


def package_image_routes(path, architecture):
    if architecture not in ('x86_64','arm64'): raise ValueError('unsupported-package-architecture')
    with Path(path).open('rb') as stream:
        before = os.fstat(stream.fileno())
        base,end,selection = _macho_slice(stream,before.st_size,architecture)
        header = _native_read(stream,base,32,end)
        endian = {b'\xcf\xfa\xed\xfe':'<',b'\xfe\xed\xfa\xcf':'>'}.get(header[:4])
        if endian is None: raise ValueError('unsupported-package-macho')
        _,cpu,_,filetype,count,size,_,_ = struct.unpack(endian+'8I',header)
        actual = {0x1000007:'x86_64',0x100000c:'arm64'}.get(cpu)
        if actual != architecture or count > 4096 or size > MAX_CONTRACT_BYTES:
            raise ValueError('package-architecture-or-command-budget')
        raw = _native_read(stream,base+32,size,end)
        names = []; load_commands = []; rpaths = []; loader = None; install = None; offset = 0
        dylibs = (0xc,0x80000018,0x8000001f,0x80000023,0x20)
        for _ in range(count):
            if offset+8 > size: raise ValueError('truncated-package-command')
            command,length = struct.unpack_from(endian+'II',raw,offset)
            if length < 8 or length % 8 or offset+length > size:
                raise ValueError('invalid-package-command-size')
            if command == 0x27: raise ValueError('package-dyld-environment-forbidden')
            minimum = 12 if command in (0xe,0x8000001c) else 24 if command in (*dylibs,0xd) else None
            if minimum is not None:
                if length < minimum: raise ValueError('invalid-package-route-command')
                index = struct.unpack_from(endian+'I',raw,offset+8)[0]
                if not minimum <= index < length: raise ValueError('invalid-package-route-name')
                encoded = raw[offset+index:offset+length]
                if b'\0' not in encoded: raise ValueError('unterminated-package-route')
                name = encoded.split(b'\0',1)[0].decode('utf8')
                if not name or len(name) > 4096: raise ValueError('package-route-budget')
                if command == 0xe:
                    if loader is not None or filetype != 2: raise ValueError('invalid-or-duplicate-package-loader')
                    loader = name
                elif command == 0xd:
                    if install is not None: raise ValueError('duplicate-package-install-name')
                    install = name
                else:
                    (rpaths if command == 0x8000001c else names).append(name)
                    if command != 0x8000001c:
                        load_commands.append({'command':command,'name':name})
            offset += length
        if offset != size: raise ValueError('package-command-size-mismatch')
        if len(rpaths) > 128: raise ValueError('package-rpath-budget')
        if stamp(before) != stamp(os.fstat(stream.fileno())) or stamp(before) != stamp(Path(path).stat()):
            raise ValueError('changed-package-native-image')
    return {'format':'MACHO64','architecture':actual,'commands':names,'loadCommands':load_commands,'rpaths':rpaths,
        'runpaths':None,'slice':selection,'dynamicLinker':loader,'installName':install,
        'fileType':filetype,'scope':'PACKAGE_DISK_SYNTAX_ONLY','runtimeSelectionVerified':False}
