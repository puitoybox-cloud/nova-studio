"""Isolated child interpreter, with only the fixed engine code directory added."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BOOT = 'import runpy,sys; from pathlib import Path; p=Path(sys.argv[1]).resolve(strict=True); sys.path.insert(0,str(p.parent)); sys.argv=sys.argv[1:]; runpy.run_path(str(p),run_name="__main__")'


def command(script, *arguments):
    path = HERE / script
    if script not in ('serve.py', 'verify_model_load.py'):
        raise ValueError('Unknown engine child')
    return [sys.executable, '-I', '-B', '-c', BOOT, str(path), *map(str, arguments)]
