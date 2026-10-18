"""Opt-in localhost Music Studio host with real offline composer and Sinsy.
No CORS, downloads, arbitrary commands, user directories or provider calls.
"""
import argparse
import base64
import json
import secrets
import ssl
import time
import ipaddress
from http.cookies import SimpleCookie
import subprocess
import tempfile
import threading
import wave
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from compose import compose, digest

ROOT = Path(__file__).resolve().parents[2]
LOCK = threading.Lock()


def synthesize(xml, executable, dictionary, voice, directory):
    if not isinstance(xml, str) or len(xml.encode()) > 1048576 or '<!DOCTYPE' in xml.upper() or '<!ENTITY' in xml.upper():
        raise ValueError('bounded MusicXML without external entities required')
    voice_lock = json.loads((Path(__file__).parent / 'source-lock.json').read_text())['voiceFile']['sha256']
    if digest(voice) != voice_lock: raise ValueError('voice identity mismatch')
    import xml.etree.ElementTree as ET
    tree = ET.fromstring(xml)
    if tree.tag != 'score-partwise' or len(tree.findall('part')) != 1 or len(tree.findall('.//note')) > 4096:
        raise ValueError('single-part bounded score required')
    divisions = 1; beats = 0.
    for measure in tree.findall('./part/measure'):
        d = measure.findtext('./attributes/divisions')
        if d is not None: divisions = int(d)
        if divisions < 1: raise ValueError('invalid score divisions')
        for note in measure.findall('note'):
            duration = int(note.findtext('duration', '0'))
            if duration < 0: raise ValueError('invalid score duration')
            beats += duration / divisions
    if not 0 < beats <= 256: raise ValueError('score exceeds bounded synthesis length')
    source, target = Path(directory) / 'score.musicxml', Path(directory) / 'vocal.wav'
    source.write_text(xml, encoding='utf-8')
    subprocess.run([str(executable), '-m', str(voice), '-x', str(dictionary), '-o', str(target), str(source)],
                   timeout=120, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if target.stat().st_size > 64 * 1048576: raise ValueError('WAV exceeds import bound')
    with wave.open(str(target), 'rb') as audio:
        if audio.getnframes() <= 0 or audio.getnframes() / audio.getframerate() > 120 or audio.getsampwidth() != 2:
            raise ValueError('generated WAV outside import bounds')
    return target.read_bytes()


def handler(options, port, token):
    origin = getattr(options, 'origin', None) or f'http://127.0.0.1:{port}'
    remote = origin.startswith('https://')
    authority = origin.split('://', 1)[1]
    sessions = {}
    pairing = getattr(options, 'pairing', None)
    attempts = {}
    auth_lock = threading.Lock()
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
        def setup(self):
            super().setup(); self.connection.settimeout(15)
        def allowed(self): return self.headers.get('Host') == authority
        def authenticated(self):
            if not remote: return True
            cookie = SimpleCookie()
            try: cookie.load(self.headers.get('Cookie', ''))
            except Exception: return False
            value = cookie.get('__Host-nova')
            with auth_lock: return bool(value and sessions.get(value.value, 0) > time.monotonic())
        def log_message(self, *args): pass  # Never log pairing codes or session credentials.
        def pairing_page(self, status=401, message='Macに表示中の接続コードを入力してください。再起動・別のブラウザで再接続した後は、再入力が必要です。'):
            raw = ('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                   '<title>Music Studio / Pair（接続）</title><style>body{font:16px system-ui;max-width:32rem;margin:24px auto;padding:0 12px}h1{font-size:22px;margin:8px 0}p{margin:8px 0}input,button{font:inherit;padding:8px;box-sizing:border-box}input{width:100%}button{margin-top:8px}</style>'
                   '<h1>Mac engine（生成エンジン接続）</h1><p role="status">' + message + '</p>'
                   '<form method="post" action="/__nova_generation/pair"><label>Pairing code（接続コード）'
                   '<input name="code" type="password" autocomplete="off" required maxlength="128"></label><button>Connect（接続）</button></form>'
                   '<p>Macを起動したまま使用してください。再接続後は同じURLから曲を開けます。</p>'
                   '<p>端末・URLごとに保存領域が異なります。曲の移動にはFull Backup（完全バックアップ）を使用してください。</p></html>').encode()
            self.send_response(status); self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)

        def pair(self):
            if self.headers.get('Origin') != origin: return self.send_error(403)
            peer = self.client_address[0]; now = time.monotonic()
            with auth_lock:
                previous, count = attempts.get(peer, (now, 0))
                if now - previous > 60: previous, count = now, 0
                attempts[peer] = (previous, count + 1)
            if count >= 5: return self.pairing_page(429, 'Too many attempts（試行回数の上限です）。1分後にMacのコードを確認して再接続してください。')
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 256: return self.send_error(413)
                from urllib.parse import parse_qs
                code = parse_qs(self.rfile.read(size).decode()).get('code', [''])[0]
                if not secrets.compare_digest(code, pairing): return self.pairing_page(403, 'Code mismatch（接続コードが一致しません）。Macに現在表示されているコードを確認してください。')
            except (ValueError, UnicodeError): return self.send_error(400)
            session = secrets.token_urlsafe(32)
            with auth_lock:
                sessions.clear()  # One paired browser; re-pair revokes the previous session.
                sessions[session] = now + 8 * 3600
            self.send_response(303)
            self.send_header('Set-Cookie', f'__Host-nova={session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800')
            self.send_header('Location', '/music-studio.html'); self.end_headers()

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store'); self.send_header('X-Content-Type-Options', 'nosniff')
            super().end_headers()
        def reply(self, status, data):
            raw = json.dumps(data).encode(); self.send_response(status); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
        def do_GET(self):
            if not self.allowed(): return self.send_error(403)
            if not self.authenticated(): return self.pairing_page()
            if self.path == '/__nova_generation/status':
                return self.reply(200, {'token': token, 'composer': bool(options.weights), 'singer': bool(options.sinsy and options.dictionary and options.voice), 'localOnly': not remote, 'executionDevice': 'host', 'transport': 'https-paired' if remote else 'loopback'})
            # Never expose hidden files or runtime/model directories through static serving.
            from urllib.parse import unquote
            relative = unquote(self.path.split('?', 1)[0])
            resolved = Path(self.translate_path(self.path)).resolve()
            if not resolved.is_relative_to(ROOT): return self.send_error(403)
            if relative.strip('/').split('/')[0] in {'tools', 'tests', 'verification', 'native', 'scripts'}: return self.send_error(403)
            if any(part.startswith('.') for part in relative.split('/') if part): return self.send_error(403)
            if resolved.is_file() and resolved.suffix == '.html':
                raw = resolved.read_bytes().replace(b'</head>', b'<script>window.__NOVA_GENERATION_HOST__=true;</script></head>')
                self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw); return
            return super().do_GET()
        def list_directory(self, path): return self.send_error(403)
        def do_HEAD(self): return self.send_error(405)
        def do_POST(self):
            if self.allowed() and remote and self.path == '/__nova_generation/pair': return self.pair()
            if not self.authenticated() or not self.allowed() or self.headers.get('Origin') != origin or not secrets.compare_digest(self.headers.get('X-Nova-Generation', ''), token):
                return self.send_error(403)
            if self.path not in ['/__nova_generation/compose', '/__nova_generation/sing']: return self.send_error(404)
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 1100000: return self.send_error(413)
                data = json.loads(self.rfile.read(size))
                if not LOCK.acquire(blocking=False): return self.reply(409, {'error': 'generation-busy'})
                try:
                    with tempfile.TemporaryDirectory(prefix='nova-generation-') as directory:
                        if self.path.endswith('/compose'):
                            if not options.weights: raise ValueError('local model weights not configured')
                            for key in ['seed', 'events', 'bpm', 'max_ticks']:
                                if type(data.get(key)) is not int: raise ValueError('integer settings required')
                            result = compose(options.weights, Path(directory) / 'abc', **{k: data[k] for k in ['seed', 'events', 'bpm', 'max_ticks']}, **{k: data[k] for k in ['key', 'pitch_min', 'pitch_max', 'numerator', 'denominator', 'style', 'description', 'genre', 'chords', 'sourceNotes'] if k in data})
                        else:
                            if not all([options.sinsy, options.dictionary, options.voice]): raise ValueError('local Sinsy assets not configured')
                            audio = synthesize(data.get('scoreXML'), options.sinsy, options.dictionary, options.voice, directory)
                            result = {'engine': 'Sinsy 0.92 HMM', 'voice': 'NIT SONG070 F001 0.90', 'license': 'CC-BY-3.0', 'wavBase64': base64.b64encode(audio).decode()}
                    return self.reply(200, result)
                finally: LOCK.release()
            except Exception as error: return self.reply(422, {'error': str(error)[:400]})
    return Handler


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--port', type=int, default=8766); p.add_argument('--weights', type=Path)
    p.add_argument('--sinsy', type=Path); p.add_argument('--dictionary', type=Path); p.add_argument('--voice', type=Path)
    p.add_argument('--lan-ip', help='Explicit private IPv4 address; HTTPS certificate required')
    p.add_argument('--tls-cert', type=Path); p.add_argument('--tls-key', type=Path)
    options = p.parse_args()
    bind = '127.0.0.1'
    if options.lan_ip:
        address = ipaddress.ip_address(options.lan_ip)
        if address.version != 4 or not any(address in ipaddress.ip_network(network) for network in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')) or address.is_loopback or address.is_unspecified or address.is_link_local: p.error('private LAN IPv4 required')
        if not options.tls_cert or not options.tls_key: p.error('LAN requires certificate and key trusted by iPad')
        bind = str(address); options.origin = f'https://{bind}:{options.port}'
        options.pairing = secrets.token_urlsafe(24)
    elif options.tls_cert or options.tls_key: p.error('TLS options require --lan-ip')
    if not 1024 <= options.port <= 65535: p.error('port outside bounds')
    class Server(ThreadingHTTPServer):
        tls_context = None
        def get_request(self):
            connection, peer = super().get_request()
            connection.settimeout(10)
            if self.tls_context:
                try: connection = self.tls_context.wrap_socket(connection, server_side=True)
                except Exception:
                    connection.close(); raise
            return connection, peer
    server = Server((bind, options.port), handler(options, options.port, secrets.token_urlsafe(32)))
    server.daemon_threads = True
    if options.lan_ip:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(options.tls_cert, options.tls_key)
        server.tls_context = context
        print('Pairing code (expires when host exits): ' + options.pairing, flush=True)
    print(f'{getattr(options, "origin", None) or f"http://127.0.0.1:{options.port}"}/music-studio.html', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
