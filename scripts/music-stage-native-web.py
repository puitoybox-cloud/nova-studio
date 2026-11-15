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
    requested = Path(destination).absolute()
    if requested.is_symlink():
        raise ValueError('symlink-stage-destination')
    destination = requested.resolve()
    protected = (ROOT / '.git', ROOT / 'assets')
    if destination == ROOT or any(destination == item or item in destination.parents for item in protected):
        raise ValueError('unsafe-stage-destination')
    tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
    # All root runtime JS/CSS and image assets cover dynamic UI references as well
    # as direct HTML links. No provider/model assets are downloaded.
    files = [name for name in tracked if ('/' not in name or name.startswith('assets/')) and
             Path(name).suffix.lower() in {'.js', '.css', '.png', '.jpeg', '.jpg', '.svg', '.webp', '.gif', '.woff', '.woff2'}]
    files.extend(name for name in tracked if name.startswith('assets/music-acoustic-v1/') and Path(name).suffix.lower() in {'.wav', '.json', '.md', '.txt'})
    files.append('music-studio.html')
    html = (ROOT / 'music-studio.html').read_text()
    for reference in re.findall(r'(?:src|href)="\./([^"?]+)', html):
        if reference not in files:
            raise ValueError('missing-entry-asset:' + reference)
    # Validate the complete inventory and every destination component before
    # writing anything. copyfile follows output symlinks by default.
    for name in sorted(set(files)) + ['asset-manifest.json']:
        source = ROOT / name
        if name != 'asset-manifest.json':
            if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(ROOT):
                raise ValueError('unsafe-or-missing-asset:' + name)
        target = destination
        for component in Path(name).parts:
            target = target / component
            if target.is_symlink():
                raise ValueError('symlink-output:' + name)
    destination.mkdir(parents=True, exist_ok=True)
    inventory = []
    for name in sorted(set(files)):
        source = ROOT / name
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
