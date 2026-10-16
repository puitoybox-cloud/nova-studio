"""Opt-in localhost Music Studio host with real offline composer and Sinsy.
No CORS, downloads, arbitrary commands, user directories or provider calls.
"""
import argparse
import base64
import json
import secrets
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
    origin = f'http://127.0.0.1:{port}'
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
        def allowed(self): return self.headers.get('Host') == f'127.0.0.1:{port}'
        def end_headers(self):
            self.send_header('Cache-Control', 'no-store'); self.send_header('X-Content-Type-Options', 'nosniff')
            super().end_headers()
        def reply(self, status, data):
            raw = json.dumps(data).encode(); self.send_response(status); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
        def do_GET(self):
            if not self.allowed(): return self.send_error(403)
            if self.path == '/__nova_generation/status':
                return self.reply(200, {'token': token, 'composer': bool(options.weights), 'singer': bool(options.sinsy and options.dictionary and options.voice), 'localOnly': True})
            # Never expose hidden files or runtime/model directories through static serving.
            from urllib.parse import unquote
            relative = unquote(self.path.split('?', 1)[0])
            resolved = Path(self.translate_path(self.path)).resolve()
            if not resolved.is_relative_to(ROOT): return self.send_error(403)
            if any(part.startswith('.') for part in relative.split('/') if part): return self.send_error(403)
            return super().do_GET()
        def do_HEAD(self): return self.send_error(405)
        def do_POST(self):
            if not self.allowed() or self.headers.get('Origin') != origin or not secrets.compare_digest(self.headers.get('X-Nova-Generation', ''), token):
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
                            result = compose(options.weights, Path(directory) / 'abc', **{k: data[k] for k in ['seed', 'events', 'bpm', 'max_ticks']})
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
    options = p.parse_args()
    if not 1024 <= options.port <= 65535: p.error('port outside bounds')
    print(f'http://127.0.0.1:{options.port}/music-studio.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', options.port), handler(options, options.port, secrets.token_urlsafe(32))).serve_forever()
