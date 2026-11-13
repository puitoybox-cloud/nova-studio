"""Resolve the existing web server root without exposing packaged AI assets."""
from pathlib import Path


def web_root(code):
    code = Path(code).resolve(strict=True)
    contents = code.parents[2]
    if code == contents / 'Resources/MusicStudioEngine/code' and contents.name == 'Contents':
        root = (contents / 'Resources/MusicStudioWeb').resolve(strict=True)
        root.relative_to(contents)
        index = (root / 'music-studio.html').resolve(strict=True)
        index.relative_to(root)
        if not index.is_file():
            raise ValueError('Missing packaged Studio page')
        return root
    return code.parents[1]
