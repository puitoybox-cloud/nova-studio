"""Explicitly create a private local CA and IP certificate; never installs trust."""
import argparse
import ipaddress
import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def create(destination, address):
    address = ipaddress.ip_address(address)
    if address.version != 4 or not any(address in ipaddress.ip_network(n) for n in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')):
        raise ValueError('private LAN IPv4 required')
    destination = Path(destination).resolve()
    if destination.is_relative_to(ROOT): raise ValueError('certificate directory must be outside the repository')
    if destination.exists(): raise ValueError('new destination required; existing certificates are never replaced')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix='.nova-tls-') as temporary:
        work = Path(temporary); os.chmod(work, 0o700)
        def run(*args):
            return subprocess.run(['openssl', *args], cwd=work, check=True, timeout=30, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
        (work / 'ca.cnf').write_text('[req]\ndistinguished_name=dn\nx509_extensions=ca\nprompt=no\n[dn]\nCN=Music Studio Local CA\n[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n')
        (work / 'server.cnf').write_text(f'[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN={address}\n[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:{address}\nauthorityKeyIdentifier=keyid,issuer\n')
        run('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365', '-config', 'ca.cnf', '-keyout', 'ca-key.pem', '-out', 'ca.pem')
        run('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-config', 'server.cnf', '-keyout', 'server-key.pem', '-out', 'server.csr')
        run('x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca-key.pem', '-CAcreateserial', '-days', '30', '-sha256', '-extfile', 'server.cnf', '-extensions', 'server', '-out', 'server.pem')
        for key in ('ca-key.pem', 'server-key.pem'): os.chmod(work / key, 0o600)
        run('verify', '-CAfile', 'ca.pem', 'server.pem')
        fingerprint = run('x509', '-in', 'ca.pem', '-noout', '-fingerprint', '-sha256').decode().strip()
        (work / 'TRUST.txt').write_text(f'Music Studio / {address}\n{fingerprint}\nServer certificate: 30 days. Local CA: 365 days.\nInstall ONLY ca.pem on your own Mac/iPad after comparing this fingerprint.\nNever transfer ca-key.pem or server-key.pem to the iPad.\nTrust installation and physical Safari acceptance have NOT been performed.\nKeep this directory private. For a changed IP or expiry, create a new directory and explicitly update launch.json.\n', encoding='utf-8')
        # Exclusive reservation: a destination created during preparation is never replaced.
        destination.mkdir(mode=0o700)
        published = []
        try:
            for source in work.iterdir():
                target = destination / source.name
                os.link(source, target)  # Exclusive creation, preserving private-key modes.
                published.append(target)
        except Exception:
            for target in published: target.unlink()
            try: destination.rmdir()
            except OSError: pass
            raise
    return fingerprint


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path); parser.add_argument('--lan-ip', required=True)
    args = parser.parse_args()
    print(create(args.destination, args.lan_ip))
    print('Trust（信頼設定）は未実施です。ca.pemだけを自分の端末へ移し、指紋を照合してください。秘密鍵は移さないでください。')
