"""Offline startup, certificate and failure reporting regressions."""
import json
import os
import socket
import ssl
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from diagnostics import diagnose, transport, check_listen_address
from prepare_tls import create

HERE = Path(__file__).resolve().parent


class Startup(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.directory = Path(cls.tmp.name) / 'certificates'
        cls.fingerprint = create(cls.directory, '192.168.1.20')

    @classmethod
    def tearDownClass(cls): cls.tmp.cleanup()

    def test_certificate_identity_chain_permissions_and_no_overwrite(self):
        cert, key = self.directory / 'server.pem', self.directory / 'server-key.pem'
        self.assertEqual(transport('192.168.1.20', cert, key, 8766), '192.168.1.20')
        context = ssl.create_default_context(cafile=str(self.directory / 'ca.pem'))
        self.assertTrue(context.check_hostname)
        verified = subprocess.run(['openssl', 'verify', '-CAfile', str(self.directory / 'ca.pem'), str(cert)], capture_output=True)
        self.assertEqual(verified.returncode, 0)
        self.assertIn('SHA256', self.fingerprint.upper())
        self.assertEqual(os.stat(key).st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(self.directory / 'ca-key.pem').st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(self.directory).st_mode & 0o777, 0o700)
        original = cert.read_bytes()
        with self.assertRaises(ValueError): create(self.directory, '192.168.1.20')
        self.assertEqual(cert.read_bytes(), original)

    def test_invalid_transport_fails_before_listen(self):
        cert, key = self.directory / 'server.pem', self.directory / 'server-key.pem'
        for address in ('8.8.8.8', '127.0.0.1', '::1', '192.168.1.21'):
            with self.subTest(address=address), self.assertRaises(ValueError): transport(address, cert, key, 8766)
        with self.assertRaises(ValueError): transport(None, cert, key, 8766)
        with self.assertRaises(ValueError): transport('192.168.1.20', None, key, 8766)
        with self.assertRaises(ValueError): transport(None, None, None, True)
        with self.assertRaises(ssl.SSLError): transport('192.168.1.20', cert, self.directory / 'ca-key.pem', 8766)
        with self.assertRaises(ValueError): create(HERE / 'unsafe-certificates', '192.168.1.20')

    def test_multiple_missing_assets_and_occupied_port_reported_together(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            report = diagnose(Path(self.tmp.name) / 'missing', port=sock.getsockname()[1])
        self.assertFalse(report['ok']); self.assertFalse(report['assetsVerified'])
        checks = {row['id']: row for row in report['checks']}
        for name in ('asset-paths', 'model:model_base.onnx', 'voice', 'sinsy-execution', 'listen-address'):
            self.assertFalse(checks[name]['ok']); self.assertTrue(checks[name]['remedy'])
        self.assertFalse(report['deviceTrustVerified'])

    def test_time_wait_preflight_reopens_same_origin(self):
        with socket.socket() as listener:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(('127.0.0.1', 0)); listener.listen(1)
            port = listener.getsockname()[1]
            with socket.create_connection(('127.0.0.1', port), timeout=2) as client:
                connection, _ = listener.accept()
                with connection:
                    connection.shutdown(socket.SHUT_WR)
                    self.assertEqual(client.recv(1), b'')
        # The server initiated TCP close, leaving TIME_WAIT on its own port.
        # This reproduces the failed non-reusing preflight without any sleep.
        with socket.socket() as naive:
            with self.assertRaises(OSError): naive.bind(('127.0.0.1', port))
        check_listen_address('127.0.0.1', port)
        check_listen_address('127.0.0.1', port)

    def test_reusing_active_listener_is_still_rejected(self):
        with socket.socket() as active:
            active.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            active.bind(('127.0.0.1', 0)); active.listen(1)
            with self.assertRaises(OSError): check_listen_address('127.0.0.1', active.getsockname()[1])

    def test_config_relative_paths_and_invalid_keys(self):
        config = Path(self.tmp.name) / 'launch.json'
        config.write_text(json.dumps({'assets': 'missing assets', 'port': 8766}))
        result = subprocess.run([sys.executable, str(HERE / 'launch.py'), '--config', str(config), '--check'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        report = json.loads(result.stdout)
        self.assertFalse(report['ok']); self.assertIn(str(Path(self.tmp.name) / 'missing assets'), result.stdout)
        self.assertNotIn('Traceback', result.stderr)
        config.write_text(json.dumps({'assets': 'missing', 'command': 'echo unsafe'}))
        result = subprocess.run([sys.executable, str(HERE / 'launch.py'), '--config', str(config), '--check'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2); self.assertIn('unknown config keys', result.stderr)


if __name__ == '__main__': unittest.main()
