"""Dependency-free local HTTP boundary regression tests for the audio helper."""
import importlib.util
import json
import threading
import time
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
        self.assertIsInstance(payload["demucs"], bool)
        self.assertIsInstance(payload["basicPitch"], bool)
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_health_does_not_advertise_missing_audio_dependencies(self):
        with patch.object(server_module.importlib.util, "find_spec", return_value=None):
            status, _, payload = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertFalse(payload["demucs"])
        self.assertFalse(payload["basicPitch"])
        self.assertTrue(payload["localOnly"])

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

    def test_second_request_is_rejected_while_first_conversion_is_running(self):
        entered = threading.Event()
        release = threading.Event()
        first_result = []

        def slow_processor(source, work_dir):
            entered.set()
            if not release.wait(timeout=5):
                raise RuntimeError("Test processor was not released")
            return {"ok": True, "localOnly": True, "midiBase64": "TVRoZA=="}

        headers = {"Origin": "https://puitoybox-cloud.github.io",
                   "X-Nova-Audio-Pipeline": "1", "X-Nova-File-Name": "test.wav"}
        with patch.object(server_module, "process_audio", side_effect=slow_processor) as processor:
            first = threading.Thread(target=lambda: first_result.append(
                self.request("POST", "/process", body=b"first", headers=headers)))
            first.start()
            try:
                self.assertTrue(entered.wait(timeout=3), "First conversion did not start")
                status, _, payload = self.request("POST", "/process", body=b"second", headers=headers)
                self.assertEqual(status, 409)
                self.assertTrue(payload["busy"])
                self.assertEqual(processor.call_count, 1)
            finally:
                release.set()
                first.join(timeout=5)
        self.assertFalse(first.is_alive())
        self.assertEqual(first_result[0][0], 200)

    def test_failed_conversion_releases_lock_and_deletes_temporary_input(self):
        headers = {"Origin": "http://127.0.0.1:8765",
                   "X-Nova-Audio-Pipeline": "1", "X-Nova-File-Name": "failed.wav"}
        with patch.object(server_module, "process_audio", side_effect=RuntimeError("mock conversion failure")) as processor:
            status, _, payload = self.request("POST", "/process", body=b"audio", headers=headers)
        self.assertEqual(status, 500)
        self.assertFalse(payload["ok"])
        self.assertEqual(processor.call_count, 1)
        temporary_input = processor.call_args.args[0]
        deadline = time.monotonic() + 3
        while (temporary_input.exists() or server_module.PROCESS_LOCK.locked()) and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertFalse(temporary_input.exists())
        self.assertFalse(server_module.PROCESS_LOCK.locked())
        with patch.object(server_module, "process_audio", return_value={
            "ok": True, "localOnly": True, "midiBase64": "TVRoZA==",
        }) as recovered:
            status, _, payload = self.request("POST", "/process", body=b"next", headers=headers)
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(recovered.call_count, 1)

    def test_timeout_returns_gateway_timeout_and_releases_lock(self):
        headers = {"Origin": "http://localhost:8765",
                   "X-Nova-Audio-Pipeline": "1", "X-Nova-File-Name": "slow.wav"}
        with patch.object(server_module, "process_audio", side_effect=server_module.subprocess.TimeoutExpired("demucs", 3600)):
            status, _, payload = self.request("POST", "/process", body=b"audio", headers=headers)
        self.assertEqual(status, 504)
        self.assertFalse(payload["ok"])
        deadline = time.monotonic() + 3
        while server_module.PROCESS_LOCK.locked() and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertFalse(server_module.PROCESS_LOCK.locked())

    def test_filename_sanitization_keeps_audio_inside_temporary_directory(self):
        self.assertEqual(server_module.safe_name("../../song.wav"), "song.wav")
        self.assertEqual(server_module.safe_name("%2e%2e%2f%2e%2e%2fnotes.wav"), "notes.wav")
        self.assertEqual(server_module.safe_name("folder%2Fother.mp3"), "other.mp3")
        self.assertEqual(server_module.safe_name("folder\\\\other.mp3"), "other.mp3")
        self.assertEqual(server_module.safe_name("folder%5Cother.mp3"), "other.mp3")
        self.assertEqual(server_module.safe_name("..%5C..%5Cother.wav"), "other.wav")

    def test_stop_command_refuses_to_kill_stale_or_unrelated_pid(self):
        stop = Path(__file__).with_name("STOP_AUDIO_PIPELINE.command").read_text()
        self.assertIn('[[ "$PID" =~ ^[0-9]+$ ]]', stop)
        self.assertIn('COMMAND="$(/bin/ps -p "$PID" -o command=', stop)
        self.assertIn('[[ "$COMMAND" != *server.py* ]]', stop)
        self.assertIn('-a -p "$PID" -iTCP:8766 -sTCP:LISTEN', stop)
        self.assertLess(stop.index('if [[ "$COMMAND" != *python* ]]'), stop.index('kill "$PID"'))

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
        # The HTTP response can arrive before the handler exits its TemporaryDirectory.
        # Wait briefly for the server-side cleanup rather than racing that finalizer.
        temporary_input = processor.call_args.args[0]
        deadline = time.monotonic() + 3
        while temporary_input.exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertFalse(temporary_input.exists(), "Temporary input must be deleted")


if __name__ == "__main__":
    unittest.main()
