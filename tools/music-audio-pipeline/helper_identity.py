"""Versioned local runtime identity; no installs, network or inferred model identity."""
import hashlib
import json
import sys
import importlib.util
import platform
import os
from pathlib import Path

PROTOCOL_VERSION = 1
RUNTIME_VERSION = "1"
REVISION = 2


def digest(path):
    value = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            value.update(chunk)
    return value.hexdigest()


def identity(directory):
    directory = Path(directory)
    spec = importlib.util.spec_from_file_location("nova_dependency_identity", directory / "dependency_identity.py")
    observer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(observer)
    return {"version": 1, "architecture": platform.machine(),
            "dependencyInventory": observer.observe_packages(),
            "dependencyObserverDigest": digest(directory / "dependency_identity.py"), "protocolVersion": PROTOCOL_VERSION,
            "runtimeVersion": RUNTIME_VERSION,
            "requirementsDigest": digest(directory / "requirements.txt"),
            "identityModuleDigest": digest(directory / "helper_identity.py"),
            "pythonVersion": sys.version.split()[0],
            "modelInventory": {"status": "UNCONFIGURED", "entries": []}}


def validate(health, directory, expected_models=None):
    expected = identity(directory)
    if not isinstance(health, dict) or health.get("ok") is not True:
        raise ValueError("health-unavailable")
    for key, value in {"localOnly": True, "host": "127.0.0.1", "port": 8766,
                       "version": 1, "pipelineRevision": REVISION,
                       "sourceDigest": digest(Path(directory) / "server.py")}.items():
        if type(health.get(key)) is not type(value) or health.get(key) != value:
            raise ValueError("helper-identity-mismatch:" + key)
    actual = health.get("runtimeIdentity")
    if not isinstance(actual, dict):
        raise ValueError("missing-runtime-identity")
    for key in ["version", "protocolVersion", "runtimeVersion", "requirementsDigest", "identityModuleDigest", "dependencyObserverDigest"]:
        if type(actual.get(key)) is not type(expected[key]) or actual.get(key) != expected[key]:
            raise ValueError("helper-identity-mismatch:" + key)
    # No current model loading boundary exposes installed/loaded model bytes.
    # An explicit expected inventory never passes on an unobserved legacy runtime.
    if expected_models is not None:
        inventory = actual.get("modelInventory")
        if not isinstance(inventory, dict) or inventory.get("status") != "VERIFIED" or inventory.get("entries") != expected_models:
            raise ValueError("model-inventory-mismatch")
    return True


if __name__ == "__main__":
    try:
        health = json.load(sys.stdin)
        validate(health, Path(sys.argv[1]))
        manifest_path = os.environ.get("NOVA_TRUSTED_MANIFEST_PATH")
        if manifest_path:
            from distribution_binding import load_manifest, validate_health
            manifest = load_manifest(manifest_path, os.environ.get("NOVA_TRUSTED_MANIFEST_DIGEST"), os.environ.get("NOVA_EXPECTED_BUILD_REVISION"))
            validate_health(manifest, health)
    except (ValueError, OSError, TypeError):
        sys.exit(1)
