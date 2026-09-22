"""Dependency-free local HTTP boundary regression tests for the audio helper."""
import importlib.util
import json
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

SERVER_PATH = Path(__file__).with_name("server.py")
spec = importlib.util.spec_from_file_location("nova_audio_server", SERVER_PATH)
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)


class AudioHelperBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.server = server_module.ThreadingHTTPServer(("127.0.0.1", 0), server_module.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)

    def request(self, method, path, body=None, headers=None):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        try:
            connection.request(method, path, body=body, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), json.loads(response.read())
        finally:
            connection.close()

    def test_health_is_local_and_does_not_claim_dependencies_are_installed(self):
        status, headers, payload = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertTrue(payload["localOnly"])
        self.assertEqual(payload["host"], "127.0.0.1")
        self.assertEqual(payload["port"], 8766)
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_unknown_endpoint_and_disallowed_origin(self):
        status, _, _ = self.request("GET", "/missing")
        self.assertEqual(status, 404)
        status, _, _ = self.request("OPTIONS", "/process", headers={"Origin": "https://example.invalid"})
        self.assertEqual(status, 403)
        status, _, _ = self.request("POST", "/process", body=b"x", headers={
            "Origin": "https://example.invalid", "X-Nova-Audio-Pipeline": "1",
            "X-Nova-File-Name": "test.wav",
        })
        self.assertEqual(status, 403)

    def test_process_rejects_missing_marker_invalid_size_and_extension(self):
        headers = {"Origin": "https://puitoybox-cloud.github.io", "X-Nova-File-Name": "test.wav"}
        status, _, _ = self.request("POST", "/process", body=b"x", headers=headers)
        self.assertEqual(status, 403)
        headers["X-Nova-Audio-Pipeline"] = "1"
        status, _, _ = self.request("POST", "/process", body=b"", headers=headers)
        self.assertEqual(status, 413)
        headers["X-Nova-File-Name"] = "test.txt"
        status, _, _ = self.request("POST", "/process", body=b"x", headers=headers)
        self.assertEqual(status, 415)

    def test_allowed_origin_reaches_local_processor_without_real_ai_or_network(self):
        headers = {"Origin": "https://puitoybox-cloud.github.io",
                   "X-Nova-Audio-Pipeline": "1", "X-Nova-File-Name": "test.wav"}
        with patch.object(server_module, "process_audio", return_value={
            "ok": True, "localOnly": True, "midiBase64": "TVRoZA==",
        }) as processor:
            status, response_headers, payload = self.request("POST", "/process", body=b"fake-audio", headers=headers)
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(response_headers["Access-Control-Allow-Origin"], headers["Origin"])
        self.assertEqual(processor.call_count, 1)
        self.assertFalse(processor.call_args.args[0].exists(), "Temporary input must be deleted")


if __name__ == "__main__":
    unittest.main()
