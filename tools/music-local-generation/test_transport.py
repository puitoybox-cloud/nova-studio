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
        self.options = options
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

    def test_authenticated_cancellation_and_delayed_compose(self):
        import json
        cookie = self.pair()
        body = json.dumps({'requestId': 'whole_transport_cancel_123'})
        headers = {'Cookie': cookie, 'Origin': self.origin, 'X-Nova-Generation': 'request-token'}
        self.assertEqual(self.request('POST', '/__nova_generation/cancel-compose', body, Cookie=cookie, Origin=self.origin)[0], 403)
        status, _, data = self.request('POST', '/__nova_generation/cancel-compose', body, **headers)
        self.assertEqual(status, 200); self.assertIn(b'cancellationRequested', data)
        status, _, data = self.request('POST', '/__nova_generation/compose', body, **headers)
        self.assertEqual(status, 422); self.assertIn(b'cancelled-or-reused', data)
        self.assertEqual(self.request('POST', '/__nova_generation/cancel-compose', '{}', **headers)[0], 422)
        self.assertEqual(self.request('POST', '/__nova_generation/compose', json.dumps({'requestId':{}}), **headers)[0], 422)
        status, _, data = self.request('POST', '/__nova_generation/compose', '{}', **headers)
        self.assertEqual(status, 422); self.assertNotIn(b'generation-busy', data)

    def test_active_cancel_releases_generation_lock(self):
        import json
        from unittest.mock import patch
        self.options.weights = Path(self.tmp.name)
        cookie = self.pair()
        headers = {'Cookie': cookie, 'Origin': self.origin, 'X-Nova-Generation': 'request-token'}
        started, completed = threading.Event(), threading.Event()
        response = []
        def blocked(*args, cancel=None, **kwargs):
            started.set()
            try:
                for _ in range(300):
                    cancel()
                    if completed.wait(.01): break
                raise RuntimeError('test inference did not cancel')
            finally: completed.set()
        body = json.dumps({'requestId':'whole_active_socket_123', 'seed':72, 'events':64, 'bpm':72, 'max_ticks':1920})
        with patch('serve.compose', blocked):
            worker = threading.Thread(target=lambda: response.append(self.request('POST', '/__nova_generation/compose', body, **headers)))
            worker.start()
            try:
                self.assertTrue(started.wait(2))
                status, _, _ = self.request('POST', '/__nova_generation/cancel-compose', json.dumps({'requestId':'whole_active_socket_123'}), **headers)
                self.assertEqual(status, 200); worker.join(2)
                self.assertFalse(worker.is_alive()); self.assertEqual(response[0][0], 422)
                self.assertIn(b'compose-request-cancelled', response[0][2])
            finally:
                completed.set(); worker.join(3)
        status, _, data = self.request('POST', '/__nova_generation/compose', '{}', **headers)
        self.assertEqual(status, 422); self.assertNotIn(b'generation-busy', data)

    def test_singer_cancel_before_arrival_is_separate_from_composer(self):
        import json
        cookie = self.pair()
        headers = {'Cookie': cookie, 'Origin': self.origin, 'X-Nova-Generation': 'request-token'}
        body = json.dumps({'requestId':'sing_transport_pending_123'})
        self.assertEqual(self.request('POST','/__nova_generation/cancel-sing',body,Cookie=cookie,Origin=self.origin)[0],403)
        status, _, data = self.request('POST','/__nova_generation/cancel-sing',body,**headers)
        self.assertEqual(status,200);self.assertIn(b'terminate-owned-process-group',data)
        status, _, data = self.request('POST','/__nova_generation/sing',body,**headers)
        self.assertEqual(status,422);self.assertIn(b'sing-request-cancelled-or-reused',data)
        status, _, data = self.request('POST','/__nova_generation/compose',body,**headers)
        self.assertEqual(status,422);self.assertNotIn(b'cancelled',data)
        for value in ('[]','null','{}'):
            self.assertEqual(self.request('POST','/__nova_generation/cancel-sing',value,**headers)[0],422)

    def test_active_singer_cancel_releases_shared_generation_lock(self):
        import json
        from unittest.mock import patch
        self.options.sinsy = self.options.voice = self.options.dictionary = Path(self.tmp.name)
        cookie = self.pair()
        headers = {'Cookie': cookie, 'Origin': self.origin, 'X-Nova-Generation': 'request-token'}
        started, done = threading.Event(), threading.Event(); responses=[]
        def synthesize(*args, cancel=None):
            started.set()
            while not done.wait(.01): cancel()
            return b''
        body=json.dumps({'requestId':'sing_socket_active_123','scoreXML':'unused-control-test'})
        with patch('serve.synthesize',synthesize):
            thread=threading.Thread(target=lambda:responses.append(self.request('POST','/__nova_generation/sing',body,**headers)))
            thread.start()
            try:
                self.assertTrue(started.wait(2))
                self.assertEqual(self.request('POST','/__nova_generation/compose','{}',**headers)[0],409)
                self.assertEqual(self.request('POST','/__nova_generation/cancel-sing',json.dumps({'requestId':'sing_socket_active_123'}),**headers)[0],200)
                thread.join(2);self.assertFalse(thread.is_alive());self.assertIn(b'sing-request-cancelled',responses[0][2])
            finally: done.set();thread.join(3)
        status, _, data=self.request('POST','/__nova_generation/compose','{}',**headers)
        self.assertEqual(status,422);self.assertNotIn(b'generation-busy',data)
        status, _, data=self.request('POST','/__nova_generation/sing',body,**headers)
        self.assertEqual(status,422);self.assertIn(b'cancelled-or-reused',data)

    def test_launcher_missing_assets(self):
        with self.assertRaises(FileNotFoundError): paths(self.tmp.name)


if __name__ == '__main__': unittest.main()
