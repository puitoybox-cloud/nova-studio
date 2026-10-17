"""Real socket regression tests; no generation substitutes or model downloads."""
import http.client
import ssl
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from http.server import ThreadingHTTPServer
from serve import handler
from launch import paths


class Transport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        cert, key = Path(self.tmp.name) / 'cert.pem', Path(self.tmp.name) / 'key.pem'
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
                        '-subj', '/CN=localhost', '-keyout', str(key), '-out', str(cert)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), http.client.HTTPConnection)
        self.port = self.server.server_address[1]
        self.origin = f'https://127.0.0.1:{self.port}'
        options = SimpleNamespace(origin=self.origin, pairing='secret-pair-code', weights=None, sinsy=None, dictionary=None, voice=None)
        self.server.RequestHandlerClass = handler(options, self.port, 'request-token')
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); context.load_cert_chain(cert, key)
        self.server.socket = context.wrap_socket(self.server.socket, server_side=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close); self.addCleanup(self.server.shutdown)

    def request(self, method, path, body=None, **headers):
        conn = http.client.HTTPSConnection('127.0.0.1', self.port, context=ssl._create_unverified_context(), timeout=3)
        conn.request(method, path, body, headers)
        response = conn.getresponse(); data = response.read(); result = response.status, dict(response.getheaders()), data
        conn.close(); return result

    def pair(self):
        status, headers, _ = self.request('POST', '/__nova_generation/pair', 'code=secret-pair-code', Origin=self.origin)
        self.assertEqual(status, 303)
        cookie = headers['Set-Cookie']; self.assertIn('Secure; HttpOnly; SameSite=Strict', cookie)
        return cookie.split(';')[0]

    def test_pairing_and_revocation(self):
        status, _, data = self.request('GET', '/__nova_generation/status')
        self.assertEqual(status, 401); self.assertIn('接続コード'.encode(), data); self.assertNotIn(b'secret-pair-code', data)
        self.assertEqual(self.request('GET', '/music-studio.html')[0], 401)
        self.assertEqual(self.request('POST', '/__nova_generation/pair', 'code=secret-pair-code', Origin='https://evil.example')[0], 403)
        status, _, data = self.request('POST', '/__nova_generation/pair', 'code=wrong', Origin=self.origin)
        self.assertEqual(status, 403); self.assertIn(b'Code mismatch', data)
        cookie = self.pair()
        status, _, data = self.request('GET', '/__nova_generation/status', Cookie=cookie)
        self.assertEqual(status, 200); self.assertIn(b'https-paired', data)
        self.assertEqual(self.request('GET', '/__nova_generation/status', Cookie=cookie, Host='evil.example')[0], 403)
        self.assertEqual(self.request('POST', '/__nova_generation/compose', '{}', Cookie=cookie, Origin='https://evil.example', **{'X-Nova-Generation':'request-token'})[0], 403)
        self.assertEqual(self.request('POST', '/__nova_generation/compose', '{}', Cookie=cookie, Origin=self.origin)[0], 403)
        self.assertEqual(self.request('POST', '/__nova_generation/compose', '{}', Cookie=cookie, Origin=self.origin, **{'X-Nova-Generation':'request-token'})[0], 422)
        status, _, data = self.request('GET', '/music-studio.html', Cookie=cookie)
        self.assertEqual(status, 200); self.assertIn(b'window.__NOVA_GENERATION_HOST__=true', data)
        self.assertEqual(self.request('GET', '/.git/config', Cookie=cookie)[0], 403)
        self.assertEqual(self.request('GET', '/tools/music-local-generation/source-lock.json', Cookie=cookie)[0], 403)
        self.pair(); self.assertEqual(self.request('GET', '/__nova_generation/status', Cookie=cookie)[0], 401)

    def test_pairing_throttle(self):
        for _ in range(5): self.assertEqual(self.request('POST', '/__nova_generation/pair', 'code=wrong', Origin=self.origin)[0], 403)
        self.assertEqual(self.request('POST', '/__nova_generation/pair', 'code=secret-pair-code', Origin=self.origin)[0], 429)

    def test_launcher_missing_assets(self):
        with self.assertRaises(FileNotFoundError): paths(self.tmp.name)


if __name__ == '__main__': unittest.main()
