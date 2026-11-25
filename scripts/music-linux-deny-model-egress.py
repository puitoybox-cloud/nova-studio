#!/usr/bin/env python3
"""Run a Linux model helper with network initiation blocked at the syscall layer."""

import ctypes as ct
import errno
import os
import sys

if len(sys.argv) < 2:
    sys.exit('Usage: music-linux-deny-model-egress.py /absolute/path/to/python [args...]')

# The listening server can reply on accepted TCP sockets. Launch with only
# standard descriptors so no already-connected outbound socket is inherited.
os.closerange(3, os.sysconf('SC_OPEN_MAX'))
seccomp_allow = 0x7fff0000
seccomp_deny = 0x00050000 | errno.EPERM
seccomp_compare_not_equal = 1

lib = ct.CDLL('libseccomp.so.2')
lib.seccomp_init.argtypes = (ct.c_uint32,)
lib.seccomp_init.restype = ct.c_void_p
lib.seccomp_syscall_resolve_name.argtypes = (ct.c_char_p,)
lib.seccomp_rule_add.argtypes = (ct.c_void_p, ct.c_uint32, ct.c_int, ct.c_uint)
class ArgCmp(ct.Structure):
    _fields_ = [('arg', ct.c_uint), ('op', ct.c_int), ('datum_a', ct.c_uint64), ('datum_b', ct.c_uint64)]
lib.seccomp_rule_add_array.argtypes = (ct.c_void_p, ct.c_uint32, ct.c_int, ct.c_uint, ct.POINTER(ArgCmp))
lib.seccomp_load.argtypes = (ct.c_void_p,)
ctx = lib.seccomp_init(seccomp_allow)
if not ctx:
    raise RuntimeError('seccomp init failed')
for syscall in (b'connect', b'sendmsg', b'sendmmsg', b'io_uring_setup', b'socketcall'):
    number = lib.seccomp_syscall_resolve_name(syscall)
    if syscall == b'socketcall' and number < 0:
        continue
    if number < 0 or lib.seccomp_rule_add(ctx, seccomp_deny, number, 0) != 0:
        raise RuntimeError(syscall)
# TCP responses on accepted sockets use sendto with no destination.
dest = ArgCmp(4, seccomp_compare_not_equal, 0, 0)
if lib.seccomp_rule_add_array(ctx, seccomp_deny,
                              lib.seccomp_syscall_resolve_name(b'sendto'), 1, ct.byref(dest)) != 0:
    raise RuntimeError('sendto filter failed')
if lib.seccomp_load(ctx) != 0:
    raise RuntimeError('seccomp load failed')
os.execv(sys.argv[1], sys.argv[1:])
