"""Synthetic bounded image fixtures; never real ML/physical isolation acceptance."""
import copy
import hashlib
import importlib.machinery
import io
import json
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import runtime_evidence as evidence
from runtime_inventory import OfflineRuntimeGuard
from local_distribution_entry import strict_eligibility


def macho(cpu=0x1000007, names=('@loader_path/child.so',), rpaths=(), endian='<'):
    commands = []
    for command, values, minimum in ((0x8000001c, rpaths, 12), (0xc, names, 24)):
        for value in values:
            text = value.encode()+b'\0'; length = (minimum+len(text)+7)//8*8
            commands.append(struct.pack(endian+'III', command, length, minimum)+
                b'\0'*(minimum-12)+text+b'\0'*(length-minimum-len(text)))
    raw = b''.join(commands)
    return struct.pack(endian+'8I', 0xfeedfacf, cpu, 0, 6, len(commands), len(raw), 0, 0)+raw


def fat(images, wide=False, endian='>'):
    width = 32 if wide else 20; offset = 8+width*len(images)
    table = []; bodies = []
    for cpu, raw in images:
        table.append(struct.pack(endian+('IIQQII' if wide else 'IIIII'),
            cpu, 0, offset, len(raw), 0, *([0] if wide else [])))
        bodies.append(raw); offset += len(raw)
    return struct.pack(endian+'II', 0xcafebabf if wide else 0xcafebabe, len(images))+b''.join(table+bodies)


def elf(names=('child.so',), rpath='$ORIGIN', runpath=None, endian='<', machine=62):
    strings = bytearray(b'\0'); tags = []
    for tag, values in ((1, names), (15, (rpath,) if rpath is not None else ()),
                         (29, (runpath,) if runpath is not None else ())):
        for value in values:
            tags.append((tag, len(strings))); strings.extend(value.encode()+b'\0')
    dynamic_offset = 64+112
    string_offset = dynamic_offset+(len(tags)+3)*16
    tags += [(5, 0x1000+string_offset), (10, len(strings)), (0, 0)]
    dynamic = b''.join(struct.pack(endian+'qQ', *tag) for tag in tags)
    size = string_offset+len(strings)
    ident = b'\x7fELF'+bytes((2, 1 if endian == '<' else 2, 1))+b'\0'*9
    header = ident+struct.pack(endian+'HHIQQQIHHHHHH', 3, machine, 1, 0, 64, 0, 0, 64, 56, 2, 0, 0, 0)
    load = struct.pack(endian+'IIQQQQQQ', 1, 4, 0, 0x1000, 0, size, size, 1)
    segment = struct.pack(endian+'IIQQQQQQ', 2, 4, dynamic_offset, 0x1000+dynamic_offset, 0,
        len(dynamic), len(dynamic), 8)
    return header+load+segment+dynamic+strings


class NativeRoutingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.path = self.root/'parent.so'
    def parse(self, raw, architecture='x86_64'):
        self.path.write_bytes(raw)
        return evidence.native_image_routes(self.path, architecture)
    def entry(self, name, raw, identity):
        path = self.root/name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(raw)
        return {'id': identity, 'module': None, 'path': name, 'version': '1',
            'kind': 'SHARED_LIBRARY', 'footprintComplete': False,
            'digest': hashlib.sha256(raw).hexdigest(), 'byteLength': len(raw)}
    def test_thin_both_endians(self):
        for endian in ('<', '>'):
            result = self.parse(macho(endian=endian))
            self.assertEqual(result['commands'], ['@loader_path/child.so'])
            self.assertEqual(result['architecture'], 'x86_64')
    def test_fat_32_64_both_endians_selects_only_declared_cpu(self):
        images = [(0x1000007, macho()), (0x100000c, macho(0x100000c, ('arm-child',)))]
        for wide in (False, True):
            for endian in ('<', '>'):
                for architecture, name in (('x86_64', '@loader_path/child.so'), ('arm64', 'arm-child')):
                    result = self.parse(fat(images, wide, endian), architecture)
                    self.assertEqual(result['commands'], [name]); self.assertEqual(result['slice']['sliceCount'], 2)
                    self.assertFalse(result['slice']['runtimeSelectionVerified'])
    def test_duplicate_cpu_subtype_is_ambiguous(self):
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            self.parse(fat([(0x1000007, macho()), (0x1000007, macho())]))
    def test_missing_cpu_fails(self):
        with self.assertRaises(ValueError): self.parse(fat([(0x100000c, macho(0x100000c))]))
    def test_overlapping_slices_fails(self):
        raw = bytearray(fat([(0x1000007, macho()), (0x100000c, macho(0x100000c))]))
        struct.pack_into('>I', raw, 36, 48)
        with self.assertRaisesRegex(ValueError, 'overlapping'): self.parse(raw)
    def test_fat_header_mismatch_fails(self):
        with self.assertRaisesRegex(ValueError, 'mismatch'): self.parse(fat([(0x1000007, macho(0x100000c))]))
    def test_fat_count_and_truncation_fail(self):
        for raw in (b'\xca\xfe\xba\xbe'+struct.pack('>I', 65), fat([(0x1000007, macho())])[:-1]):
            with self.assertRaises(ValueError): self.parse(raw)
    def test_slice_commands_cannot_escape_into_other_slice(self):
        raw = bytearray(macho()); struct.pack_into('<I', raw, 20, 1000)
        with self.assertRaises(ValueError): self.parse(fat([(0x1000007, raw), (0x100000c, macho(0x100000c))]))
    def test_elf_endian_architectures_and_paths(self):
        for endian in ('<', '>'):
            for machine, architecture in ((62, 'x86_64'), (183, 'arm64')):
                result = self.parse(elf(endian=endian, machine=machine, runpath='${ORIGIN}/lib'), architecture)
                self.assertEqual(result['commands'], ['child.so']); self.assertEqual(result['rpaths'], ['$ORIGIN'])
                self.assertEqual(result['runpaths'], ['${ORIGIN}/lib'])
    def test_elf_wrong_arch_and_class_fail(self):
        raw = bytearray(elf()); raw[4] = 1
        for value in (raw, elf(machine=183)):
            with self.assertRaises(ValueError): self.parse(value)
    def test_elf_dynamic_budget_and_unterminated_fail(self):
        raw = bytearray(elf()); struct.pack_into('<Q', raw, 64+56+32, 65552)
        for value in (raw, elf()[:-1]):
            with self.assertRaises(ValueError): self.parse(value)
    def test_elf_duplicate_string_tag_fails(self):
        raw = bytearray(elf()); struct.pack_into('<q', raw, 176, 5)
        with self.assertRaisesRegex(ValueError, 'duplicate'): self.parse(raw)
    def test_elf_unmapped_strings_and_missing_null_fail(self):
        raw = bytearray(elf()); struct.pack_into('<Q', raw, 176+32+8, 0xffffffff)
        with self.assertRaises(ValueError): self.parse(raw)
        raw = bytearray(elf()); struct.pack_into('<q', raw, 176+64, 99)
        with self.assertRaises(ValueError): self.parse(raw)
    def test_elf_unsupported_filter_fails(self):
        raw = bytearray(elf()); struct.pack_into('<q', raw, 176, 0x7fffffff)
        with self.assertRaisesRegex(ValueError, 'filter'): self.parse(raw)
    def test_routing_runpath_precedence_no_inherited_guess(self):
        a = self.entry('a/child.so', b'a', 'a'); b = self.entry('b/child.so', b'b', 'b')
        child, mode, candidates = evidence._select_declared_elf(self.root, [a, b], self.path,
            'child.so', ['$ORIGIN/a'], ['$ORIGIN/b'])
        self.assertEqual(child['id'], 'b'); self.assertEqual(candidates, ['b']); self.assertIn('RUNPATH', mode)
    def test_elf_ambiguity_and_unsupported_cwd_tokens_fail_closed(self):
        a = self.entry('a/child.so', b'a', 'a'); b = self.entry('b/child.so', b'b', 'b')
        for routes in (['$ORIGIN/a', '$ORIGIN/b'], ['', '$ORIGIN/a'], ['$LIB', '$ORIGIN/a'], ['relative']):
            child, _, _ = evidence._select_declared_elf(self.root, [a, b], self.path, 'child.so', routes, None)
            self.assertIsNone(child)
    def test_elf_absolute_declared_only_and_undeclared(self):
        a = self.entry('child.so', b'a', 'a')
        self.assertEqual(evidence._select_declared_elf(self.root, [a], self.path, str(self.root/'child.so'), [], None)[0], a)
        self.assertIsNone(evidence._select_declared_elf(self.root, [a], self.path, '/undeclared/lib.so', [], None)[0])
    def test_authenticated_graph_fat_and_elf_stays_unverified(self):
        child = self.entry('child.so', macho(names=()), 'child')
        for raw in (elf(), fat([(0x1000007, macho())])):
            parent = self.entry('parent.so', raw, 'parent')
            contract = {'native': [parent, child], 'buildRevision': 'fixture', 'architecture': 'x86_64'}
            with patch.object(evidence, 'scoped_loaded_library', return_value={'actualLoaded': True}):
                result = evidence.scoped_macho_dependencies(self.root, contract)
            edge = result['edges'][0]; self.assertEqual(edge['child'], 'child')
            self.assertEqual(edge['status'], 'OBSERVED_UNVERIFIED'); self.assertFalse(edge['runtimeEdgeVerified'])
            self.assertFalse(result['complete']); self.assertNotIn(str(self.root), json.dumps(result))
    def test_changed_digest_and_parse_error_do_not_resolve(self):
        parent = self.entry('parent.so', elf(), 'parent'); parent['digest'] = '0'*64
        result = evidence.scoped_macho_dependencies(self.root, {'native': [parent], 'buildRevision': 'fixture', 'architecture': 'x86_64'})
        self.assertNotIn('child', result['edges'][0]); self.assertFalse(result['complete'])
    def test_read_budget_checked_before_io(self):
        stream = io.BytesIO(b'x')
        for offset, size, limit in ((0, 1024*1024+1, 99999999), (-1, 1, 4), (3, 2, 4)):
            with self.assertRaises(ValueError): evidence._native_read(stream, offset, size, limit)
            self.assertEqual(stream.tell(), 0)
    def test_scoped_unexpected_extension_and_duplicate_handle(self):
        declared = self.entry('child.so', b'fixture', 'child')
        contract = {'native': [declared], 'architecture': 'x86_64', 'namespaces': ['owned']}
        loader = importlib.machinery.ExtensionFileLoader('owned.hidden', str(self.root/'hidden.so'))
        module = SimpleNamespace(__spec__=SimpleNamespace(loader=loader, origin=loader.path), __file__=loader.path)
        mapped = {'entries': [{'id': 'child', 'mapped': False}, {'id': 'child', 'mapped': False}]}
        result = evidence.scoped_native_load_observation(self.root, contract, modules={'owned.hidden': module, 'other.hidden': module}, mapped=mapped)
        self.assertEqual(result['unexpected'], ['module:owned.hidden']); self.assertEqual(result['ambiguous'], ['child'])
        self.assertFalse(result['complete']); self.assertEqual(result['coverage'], 'PARTIAL')
    def test_missing_and_wrong_mapped_evidence_never_complete(self):
        declared = self.entry('child.so', b'fixture', 'child')
        contract = {'native': [declared], 'architecture': 'x86_64'}
        for entries in ([], [{'id': 'child', 'status': 'UNEXPECTED_OBSERVED'}]):
            result = evidence.scoped_native_load_observation(self.root, contract, modules={}, mapped={'entries': entries})
            self.assertFalse(result['complete']); self.assertTrue(result['unresolved'] or result['unexpected'])
    def test_unknown_processing_id_rejected_before_backend(self):
        contract = {'native': [], 'imports': [], 'architecture': 'x86_64'}
        calls = evidence.ProcessingReceipt(self.root, contract); executed = []
        with self.assertRaisesRegex(ValueError, 'unexpected-processing'):
            calls.call('inference', 'fixture', lambda: executed.append(True), native_ids=['unknown'])
        self.assertEqual(executed, []); self.assertEqual(calls.entries, [])
    def test_processing_route_cannot_override_requested_ids(self):
        contract = {'native': [{'id': 'one'}], 'processingNativeRoutes': {'fixture': ['one']}}
        calls = evidence.ProcessingReceipt(self.root, contract)
        with self.assertRaisesRegex(ValueError, 'wrong-processing-native-route'):
            calls.call('inference', 'fixture', lambda: None, native_ids=['other'])
    def test_ctypes_network_lookup_guard_is_partial_no_private_data(self):
        with patch('sys.addaudithook'): guard = OfflineRuntimeGuard()
        for event in ('ctypes.dlsym', 'ctypes.dlsym/handle'):
            for name in ('connect', 'socket', 'getaddrinfo', 'curl_easy_perform'):
                with self.assertRaises(PermissionError): guard.audit(event, (object(), name))
        guard.audit('ctypes.dlsym', (object(), 'dlinfo'))
        value = guard.snapshot(); self.assertEqual(value['events']['ctypes.network_symbol_lookup'], 8)
        self.assertFalse(value['nativeNetworkVerified']); self.assertEqual(value['native'], 'UNVERIFIED')
        self.assertEqual(value['nativeDispatchGuard']['directNativeCalls'], 'UNVERIFIED')
    def test_owned_child_actual_ctypes_lookup_is_denied_before_native_call(self):
        script = '''import ctypes, json
from runtime_inventory import OfflineRuntimeGuard
guard = OfflineRuntimeGuard()
api = ctypes.CDLL(None)
blocked = []
for name in ('socket', 'connect', 'getaddrinfo'):
    try: getattr(api, name)
    except PermissionError: blocked.append(name)
print(json.dumps({'blocked': blocked, 'snapshot': guard.snapshot()}))
'''
        result = subprocess.run([sys.executable, '-c', script], cwd=Path(__file__).parent,
            capture_output=True, text=True, timeout=10, check=True)
        value = json.loads(result.stdout)
        self.assertEqual(value['blocked'], ['socket', 'connect', 'getaddrinfo'])
        self.assertEqual(value['snapshot']['events']['ctypes.network_symbol_lookup'], 3)
        self.assertFalse(value['snapshot']['nativeNetworkVerified'])
    def test_scoped_load_gate_cannot_treat_no_unexpected_as_safe(self):
        inventory = {'runtimeEvidence': {'scopedNativeLoads': {'complete': False, 'unexpected': [], 'unresolved': [], 'ambiguous': []}}}
        result = strict_eligibility(inventory, trusted_bootstrap=True, browser_verified=True)
        self.assertFalse(result['processingEligible']); self.assertIn('scopedNativeLoadCoverage', result['blockedBy'])
    def backend(self):
        import types
        raw = b"def run(callback=None):\n    if callback: callback()\n    return 'output'\n"
        source = self.entry('backend.py', raw, 'backend'); source.pop('kind'); source.pop('footprintComplete')
        source['module'] = 'owned'
        module = types.ModuleType('owned'); module.__file__ = str(self.root/'backend.py'); module.__version__ = '1'
        exec(compile(raw, module.__file__, 'exec'), module.__dict__)
        native = self.entry('child.so', b'native-fixture', 'child')
        contract = {'native': [native], 'imports': [source], 'namespaces': ['owned'], 'architecture': 'x86_64',
                    'buildRevision': 'fixture', 'version': 1,
                    'codec': {'backend': 'soundfile', 'version': '1', 'nativeIds': ['child'], 'externalExecutable': False},
                    'processingNativeRoutes': {logical: ['child'] for logical in
                        ('decoder', 'resample', 'inference', 'torch', 'stem', 'writer')}}
        mapped = {'entries': [{'id': 'child', 'mapped': True, 'diskIntegrity': 'VERIFIED',
            'architecture': 'x86_64', 'status': 'OBSERVED_UNVERIFIED'}], 'complete': False}
        return module, contract, mapped
    def test_actual_calls_aggregate_declared_routes_but_never_verify_native_dispatch(self):
        module, contract, mapped = self.backend(); evidence.validate(contract)
        calls = evidence.ProcessingReceipt(self.root, contract)
        with patch.dict(sys.modules, {'owned': module}), patch.object(evidence, 'mapped_native_receipts', return_value=mapped):
            for stage in ('decoder', 'resample', 'inference', 'torch', 'stem', 'writer'):
                self.assertEqual(calls.call(stage, stage, module.run), 'output')
        result = calls.snapshot(); self.assertEqual(len(result['entries']), 6); self.assertFalse(result['complete'])
        for call in result['entries']:
            self.assertEqual(call['nativeIdentity'], 'OBSERVED_UNVERIFIED')
            self.assertEqual(call['mappedEvidence']['requestedNativeIds'], ['child'])
            self.assertEqual(call['nativeRouteEvidence'], 'AUTHENTICATED_DECLARATION_ONLY')
            self.assertFalse(call['scopedLoadEvidence']['complete'])
    def test_contract_changed_during_call_fails(self):
        module, contract, mapped = self.backend(); calls = evidence.ProcessingReceipt(self.root, contract)
        with patch.dict(sys.modules, {'owned': module}), patch.object(evidence, 'mapped_native_receipts', return_value=mapped):
            with self.assertRaisesRegex(ValueError, 'changed-processing-contract'):
                calls.call('inference', 'inference', module.run, lambda: contract.update(buildRevision='changed'))
        self.assertEqual(calls.entries[0]['status'], 'FAILED'); self.assertFalse(calls.entries[0]['completed'])
    def test_unexpected_load_during_actual_call_fails(self):
        module, contract, mapped = self.backend(); calls = evidence.ProcessingReceipt(self.root, contract)
        changed = copy.deepcopy(mapped); changed['entries'][0]['status'] = 'UNEXPECTED_OBSERVED'
        with patch.dict(sys.modules, {'owned': module}), patch.object(evidence, 'mapped_native_receipts', side_effect=[mapped, changed]):
            with self.assertRaisesRegex(ValueError, 'unexpected-or-ambiguous'):
                calls.call('inference', 'inference', module.run)
        self.assertEqual(calls.entries[0]['status'], 'FAILED')
    def test_native_route_contract_duplicate_unknown_or_budget_rejected(self):
        _, contract, _ = self.backend()
        for routes in ({'inference': ['child', 'child']}, {'inference': ['unknown']}, {'inference': []},
                       {'x'*129: ['child']}, {'inference': [None]}):
            invalid = copy.deepcopy(contract); invalid['processingNativeRoutes'] = routes
            with self.assertRaisesRegex(ValueError, 'route-contract'): evidence.validate(invalid)
    def test_compact_receipt_binds_all_scoped_load_categories(self):
        observation = {'expected': ['one'], 'observed': [], 'unexpected': ['module:owned.bad'],
            'unresolved': ['one'], 'ambiguous': [], 'complete': False}
        result = evidence.receipt_evidence({'scopedNativeLoads': observation})['scopedNativeLoads']
        self.assertEqual(result['unexpectedCount'], 1); self.assertNotIn('unexpected', result)
        self.assertEqual(result['observationDigest'], evidence.evidence_digest(observation))
        self.assertFalse(result['complete']); self.assertIn('unexpected', observation)
    def test_candidate_expansion_never_resolves_undeclared_filesystem_paths(self):
        declared = self.entry('child.so', b'fixture', 'child')
        # Index construction accesses only declared paths, then candidates normalize lexically.
        with patch.object(evidence, '_declared_native_path_index', return_value={str(self.root/'child.so'): [declared]}),\
             patch.object(Path, 'resolve', side_effect=AssertionError('undeclared-path-probe')):
            self.assertEqual(evidence._select_declared_elf(self.root, [declared], self.path, 'child.so', ['$ORIGIN'], None)[0], declared)
            self.assertEqual(evidence._select_declared_native(self.root, [declared], self.path, '@loader_path/child.so', [])[0], declared)


if __name__ == '__main__': unittest.main()
