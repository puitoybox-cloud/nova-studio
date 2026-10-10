"""Stage current standalone assets into a new native build resource directory."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def stage(destination):
    destination = Path(destination).resolve()
    if destination == ROOT or ROOT in destination.parents and '.git' in destination.parts:
        raise ValueError('unsafe-stage-destination')
    tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
    # All root runtime JS/CSS and image assets cover dynamic UI references as well
    # as direct HTML links. No provider/model assets are downloaded.
    files = [name for name in tracked if ('/' not in name or name.startswith('assets/')) and
             Path(name).suffix.lower() in {'.js', '.css', '.png', '.jpeg', '.jpg', '.svg', '.webp', '.gif', '.woff', '.woff2'}]
    files.append('music-studio.html')
    html = (ROOT / 'music-studio.html').read_text()
    for reference in re.findall(r'(?:src|href)="\./([^"?]+)', html):
        if reference not in files:
            raise ValueError('missing-entry-asset:' + reference)
    destination.mkdir(parents=True, exist_ok=True)
    inventory = []
    for name in sorted(set(files)):
        source = ROOT / name
        if source.is_symlink():
            raise ValueError('symlink-asset:' + name)
        (destination / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination / name)
        inventory.append({'path': name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                          'byteLength': source.stat().st_size})
    manifest = {'format': 'NOVA_BUNDLED_WEB_ASSETS', 'version': 1,
                'buildRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'entry': 'music-studio.html', 'files': inventory}
    (destination / 'asset-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    manifest = stage(sys.argv[1])
    print(json.dumps({'entry': manifest['entry'], 'files': len(manifest['files']), 'buildRevision': manifest['buildRevision']}))
