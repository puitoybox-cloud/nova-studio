"""Load the fixed production model pair offline, then release it on exit."""
import json
import sys
from pathlib import Path
from compose import digest
from model_runtime import load_runtime


def verify(weights):
    import onnxruntime
    manifest = json.loads((Path(__file__).resolve().parent / 'model-lock.json').read_text())
    (sessions, _), _ = load_runtime(weights, manifest, digest, onnxruntime)
    if len(sessions) != 2 or any('CPUExecutionProvider' not in session.get_providers() for session in sessions):
        raise ValueError('Both model sessions must load with CPUExecutionProvider')


if __name__ == '__main__':
    try:
        verify(Path(sys.argv[1]))
    except Exception as error:
        print(str(error)[:1000], file=sys.stderr)
        raise SystemExit(1)
