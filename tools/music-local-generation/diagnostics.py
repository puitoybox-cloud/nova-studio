"""Read-only, offline startup diagnostics. Never installs or changes trust settings."""
import importlib.metadata
import ipaddress
import json
import platform
import socket
import ssl
import subprocess
import sys
import time
from pathlib import Path
from compose import digest

HERE = Path(__file__).resolve().parent


def transport(lan_ip, cert, key, port):
    if type(port) is not int or not 1024 <= port <= 65535:
        raise ValueError('Port（ポート）は1024〜65535を指定してください')
    if not lan_ip:
        if cert or key: raise ValueError('TLS files require LAN IP（証明書にはLAN IP指定が必要です）')
        return '127.0.0.1'
    address = ipaddress.ip_address(lan_ip)
    if address.version != 4 or not any(address in ipaddress.ip_network(n) for n in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')):
        raise ValueError('Private LAN IPv4 required（MacのプライベートIPv4を指定してください）')
    if not cert or not key: raise ValueError('Certificate and key required（証明書と秘密鍵を指定してください）')
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(cert, key)  # Also checks matching private key.
    info = ssl._ssl._test_decode_cert(str(cert))
    if ('IP Address', str(address)) not in info.get('subjectAltName', ()):
        raise ValueError('Certificate IP mismatch（証明書のSANにMacのIPがありません）')
    now = time.time()
    if ssl.cert_time_to_seconds(info['notBefore']) > now or ssl.cert_time_to_seconds(info['notAfter']) <= now:
        raise ValueError('Certificate expired or not yet valid（証明書の有効期間外です）')
    return str(address)


def diagnose(asset_root, port=8766, lan_ip=None, tls_cert=None, tls_key=None):
    checks = []
    def check(name, action, remedy):
        try:
            action(); checks.append({'id': name, 'ok': True})
        except Exception as error:
            checks.append({'id': name, 'ok': False, 'error': str(error)[:400], 'remedy': remedy})
    def runtime():
        if sys.version_info < (3, 12): raise ValueError('Python 3.12+ required')
        if platform.system() == 'Darwin' and platform.machine() == 'x86_64' and int(platform.mac_ver()[0].split('.')[0]) < 13:
            raise ValueError('Intel Mac requires macOS 13+')
    check('python', runtime, 'Python 3.12以降の専用環境を使用してください。Intel MacはmacOS 13以降が必要です。')
    requirements = (HERE / 'requirements.txt').read_text().splitlines()
    for line in requirements:
        if '==' not in line or line.startswith('#'): continue
        name, version = line.split('==')
        def dependency(name=name, version=version):
            actual = importlib.metadata.version(name)
            if actual != version: raise ValueError(f'{name}: required {version}, installed {actual}')
        check('dependency:' + name, dependency, '専用環境でrequirements.txtの固定依存を明示インストールしてください。')
    def cpu():
        import onnxruntime
        if 'CPUExecutionProvider' not in onnxruntime.get_available_providers(): raise ValueError('CPU provider unavailable')
    check('cpu-provider', cpu, 'MacのCPUに合うONNX Runtimeを専用環境へ導入してください。')
    root = Path(asset_root).resolve()
    from launch import paths
    check('asset-paths', lambda: paths(root), 'prepare.pyで準備済みの資材フォルダを指定してください。')
    def verified(relative, expected):
        candidate = root / relative
        candidate.resolve(strict=True).relative_to(root)
        if digest(candidate) != expected: raise ValueError('SHA256 mismatch: ' + relative)
    for name, lock in json.loads((HERE / 'model-lock.json').read_text())['files'].items():
        check('model:' + name, lambda n=name, h=lock['sha256']: verified('weights/' + n, h), '固定モデルが不足または不一致です。新しい別フォルダへprepare.pyで準備してください。')
    def models():
        # Provider availability and byte identity alone do not establish that
        # these graphs can actually be opened by the installed native runtime.
        # Use a disposable process so the launcher does not retain a second
        # model pair while the serving process loads its production sessions.
        from python_child import command as child_command
        command = child_command('verify_model_load.py', root / 'weights')
        result = subprocess.run(command, cwd=HERE, timeout=180, capture_output=True, text=True)
        if result.returncode:
            raise ValueError('ONNX model load failed: ' + result.stderr[-1000:])
    if all(c['ok'] for c in checks if c['id'].startswith(('model:', 'dependency:')) or c['id'] == 'cpu-provider'):
        check('model-load', models, 'ONNXモデルの互換性・CPU実行環境・空きメモリを確認してください。')
    else:
        checks.append({'id': 'model-load', 'ok': False, 'error': 'Model load blocked by failed asset/runtime checks',
                       'remedy': '先にモデルと固定依存関係の診断エラーを解消してください。'})
    voice = 'hts_voice_nitech_jp_song070_f001-0.90/nitech_jp_song070_f001.htsvoice'
    check('voice', lambda: verified(voice, json.loads((HERE / 'source-lock.json').read_text())['voiceFile']['sha256']), '固定の許諾済み歌声音源をprepare.pyで準備してください。')
    def sinsy():
        resolved = paths(root)
        subprocess.run([str(resolved['sinsy']), '-h'], timeout=10, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    check('sinsy-execution', sinsy, 'Sinsyの実行権限・CPU互換・共有ライブラリを確認してください。')
    bind = None
    try: bind = transport(lan_ip, tls_cert, tls_key, port)
    except Exception as error: checks.append({'id': 'transport', 'ok': False, 'error': str(error)[:400], 'remedy': 'MacのLAN IP、有効なIP SAN証明書、対応する秘密鍵を確認してください。'})
    else: checks.append({'id': 'transport', 'ok': True})
    if bind:
        def available():
            with socket.socket() as sock: sock.bind((bind, port))
        check('listen-address', available, 'IPがこのMacに属するか、別のエンジンが同じポートで起動していないか確認してください。')
    return {'ok': all(c['ok'] for c in checks), 'system': platform.system(), 'architecture': platform.machine(),
            'signedDistribution': False, 'deviceTrustVerified': False,
            'modelsLoaded': next(c['ok'] for c in checks if c['id'] == 'model-load'),
            'assetsVerified': all(c['ok'] for c in checks if c['id'].startswith(('asset-', 'model:', 'voice', 'sinsy-'))),
            'cpuProvider': next(c['ok'] for c in checks if c['id'] == 'cpu-provider'), 'checks': checks}
