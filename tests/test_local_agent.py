"""Local agent tests use mocked probes and a loopback-only HTTP server; no LAN scans."""
import concurrent.futures
import http.client
import importlib.util
import json
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "static" / "agent" / "noc_local_agent.py"
spec = importlib.util.spec_from_file_location("noc_test_agent", SOURCE)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)


def finished(manager, identity):
    limit = time.monotonic() + 4
    while time.monotonic() < limit:
        data = manager.snapshot(identity)
        if data["status"] not in ("running", "stopping"):
            return data
        time.sleep(.01)
    raise AssertionError("Mock scan did not finish")


class AgentLogicTests(unittest.TestCase):
    def test_target_boundaries_and_syntax(self):
        self.assertEqual(agent.parse_targets("192.168.1.1-3"), ["192.168.1.1", "192.168.1.2", "192.168.1.3"])
        self.assertEqual(agent.parse_targets("10.0.0.2-10.0.0.3"), ["10.0.0.2", "10.0.0.3"])
        self.assertEqual(len(agent.parse_targets("172.16.0.0/22")), 1022)
        self.assertEqual(agent.parse_targets("192.168.1.3/30"), ["192.168.1.1", "192.168.1.2"])
        self.assertEqual(len(agent.parse_targets("10.0.0.0/31")), 2)
        self.assertEqual(agent.parse_targets("10.0.0.1"), ["10.0.0.1"])
        for target in ("", "8.8.8.8", "127.0.0.1", "0.0.0.0/0", "192.168.0.0/16", "10.0.0.0/21", "172.32.0.1", "192.168.1.4-2", "192.168.1.1;whoami", "192.168.1.999", "192.168.01.1", "::1", "10.0.0.1-11.0.0.1"):
            with self.subTest(target=target), self.assertRaises(ValueError):
                agent.parse_targets(target)

    def test_windows_unreachable_does_not_count_as_up(self):
        with patch.object(agent.os, "name", "nt"), patch.object(agent, "system_tool", return_value="C:/Windows/System32/ping.exe"), patch.object(agent, "run_command") as command:
            command.return_value = subprocess.CompletedProcess([], 0, "Reply from 192.168.1.1: Destination host unreachable.", "")
            self.assertEqual(agent.ping_host("192.168.1.2"), (False, None))
            command.return_value = subprocess.CompletedProcess([], 0, "Reply from 192.168.1.2: bytes=32 time=2ms TTL=64", "")
            self.assertEqual(agent.ping_host("192.168.1.2"), (True, 2.0))

    def test_neighbors_and_offline_vendor(self):
        cache = agent.parse_neighbors("192.168.1.1 00-11-22-33-44-55 dynamic\n192.168.1.2 lladdr 02:11:22:33:44:55 REACHABLE")
        manager = agent.ScanManager({"001122": "Example manufacturer"}, probe=lambda ip: (True, 1), neighbor_reader=lambda: cache)
        data = finished(manager, manager.start("192.168.1.1-2"))
        self.assertEqual(data["completed"], 2)
        self.assertEqual(data["results"][0]["manufacturer"], "Example manufacturer")
        self.assertEqual(data["results"][1]["manufacturer"], "")
        self.assertIsNone(manager.snapshot("missing"))

    def test_stop_and_single_job(self):
        entered, release = threading.Event(), threading.Event()
        def probe(ip):
            entered.set()
            release.wait(2)
            return False, None
        manager = agent.ScanManager(probe=probe, neighbor_reader=lambda: {})
        identity = manager.start("192.168.1.0/24")
        self.assertTrue(entered.wait(1))
        with self.assertRaises(RuntimeError):
            manager.start("192.168.1.1")
        self.assertTrue(manager.stop(identity))
        release.set()
        data = finished(manager, identity)
        self.assertEqual(data["status"], "stopped")
        self.assertLess(data["completed"], data["total"])
        self.assertFalse(manager.stop("missing"))

    def test_probe_errors_are_reported(self):
        def bad(ip):
            raise OSError("Mock ping unavailable")
        manager = agent.ScanManager(probe=bad, neighbor_reader=lambda: {})
        data = finished(manager, manager.start("10.0.0.1"))
        self.assertEqual(data["status"], "error")
        self.assertIn("Mock ping", data["error"])

    def test_origins_and_oui_file(self):
        self.assertEqual(agent.valid_origin("https://example.com/"), "https://example.com")
        self.assertEqual(agent.valid_origin("http://127.0.0.1:8785"), "http://127.0.0.1:8785")
        for value in ("*", "http://example.com", "https://example.com/path", "https://x:y@example.com", "https://example.com?x=1"):
            with self.assertRaises(Exception):
                agent.valid_origin(value)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "oui.csv"
            path.write_text("prefix,vendor\n00:11:22,Example manufacturer\nBAD,Invalid\n", encoding="utf-8")
            self.assertEqual(agent.load_oui(path), {"001122": "Example manufacturer"})


class AgentHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = agent.AgentServer(0, "test-session-token", [agent.DEFAULT_ORIGIN], agent.ScanManager(probe=lambda ip: (False, None), neighbor_reader=lambda: {}))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(2)

    def request(self, method, path, body=None, **headers):
        values = {"Origin": agent.DEFAULT_ORIGIN, "Authorization": "Bearer test-session-token"}
        values.update(headers)
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        if body is not None:
            values.setdefault("Content-Type", "application/json")
            body = json.dumps(body)
        connection.request(method, path, body=body, headers=values)
        response = connection.getresponse()
        raw = response.read()
        result = response.status, dict(response.getheaders()), json.loads(raw) if raw else None
        connection.close()
        return result

    def test_health_and_preflight(self):
        status, headers, data = self.request("GET", "/v1/health")
        self.assertEqual(status, 200)
        self.assertEqual(data["apiVersion"], 1)
        self.assertEqual(headers["Access-Control-Allow-Origin"], agent.DEFAULT_ORIGIN)
        status, headers, _ = self.request("OPTIONS", "/v1/scans", Authorization="")
        self.assertEqual(status, 204)
        self.assertIn("Authorization", headers["Access-Control-Allow-Headers"])

    def test_wrong_token_origin_and_host(self):
        for headers in ({"Authorization": "wrong"}, {"Authorization": "Bearer é"}, {"Origin": "https://evil.example"}, {"Origin": "null"}, {"Host": "evil.example"}):
            with self.subTest(headers=headers):
                status, _, _ = self.request("GET", "/v1/health", **headers)
                self.assertEqual(status, 403)
        status, headers, _ = self.request("OPTIONS", "/v1/scans", Origin="https://evil.example")
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_scan_api_uses_mock_probes(self):
        status, _, data = self.request("POST", "/v1/scans", {"target": "192.168.1.1-2", "resolveNames": False})
        self.assertEqual(status, 202)
        identity = data["jobId"]
        finished(self.server.manager, identity)
        status, _, data = self.request("GET", "/v1/scans/" + identity)
        self.assertEqual(status, 200)
        self.assertEqual(data["completed"], 2)
        self.assertEqual({row["status"] for row in data["results"]}, {"no-response"})
        self.assertEqual(self.request("POST", "/v1/scans/" + identity + "/stop", {})[0], 200)
        self.assertEqual(self.request("POST", "/v1/scans", {"target": "8.8.8.8"})[0], 400)
        self.assertEqual(self.request("POST", "/v1/scans", {"target": "a" * 5000})[0], 400)
        self.assertEqual(self.request("POST", "/v1/scans", {"target": "10.0.0.1", "resolveNames": "yes"})[0], 400)
        self.assertEqual(self.request("POST", "/v1/scans", {"target": "10.0.0.1"}, **{"Content-Type": "text/plain"})[0], 400)
        self.assertEqual(self.request("GET", "/v1/scans/" + "f" * 24)[0], 404)


if __name__ == "__main__":
    unittest.main()
