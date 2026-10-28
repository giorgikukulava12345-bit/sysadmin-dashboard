#!/usr/bin/env python3
"""NOC local IPv4 discovery agent. Python 3.10+, standard library only."""
import argparse
import concurrent.futures
import csv
import hmac
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

VERSION = "1.0.0"
MAX_HOSTS = 1024
MAX_BODY = 4096
PRIVATE = tuple(ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))
DEFAULT_ORIGIN = "https://giorgikukulava.vercel.app"


def parse_targets(value):
    """Validate before expanding, including abbreviated final-octet ranges."""
    value = str(value).strip()
    if not value or len(value) > 80:
        raise ValueError("Enter a private IPv4 host, CIDR or start-end range.")
    if "-" in value:
        first, last = value.split("-", 1)
        if last.isdigit():
            last = first.rsplit(".", 1)[0] + "." + last
        start, end = ipaddress.IPv4Address(first), ipaddress.IPv4Address(last)
        count = int(end) - int(start) + 1
        if count < 1 or count > MAX_HOSTS:
            raise ValueError(f"Scan between 1 and {MAX_HOSTS} addresses per run.")
    else:
        net = ipaddress.IPv4Network(value, strict=False)
        count = net.num_addresses if net.prefixlen >= 31 else net.num_addresses - 2
        if not 1 <= count <= MAX_HOSTS:
            raise ValueError(f"Scan between 1 and {MAX_HOSTS} addresses per run.")
        hosts = iter(net.hosts())
        start = next(hosts)
        end = ipaddress.IPv4Address(int(start) + count - 1)
    if not any(start in n and end in n for n in PRIVATE):
        raise ValueError("Only private LAN IPv4 ranges (10/8, 172.16/12, 192.168/16) are supported.")
    return [str(ipaddress.IPv4Address(int(start) + i)) for i in range(count)]


def run_command(args, timeout=2):
    return subprocess.run(args, capture_output=True, text=True, errors="replace", timeout=timeout,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


def system_tool(name):
    if os.name == "nt":
        path = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / (name + ".exe")
        return str(path) if path.is_file() else None
    return shutil.which(name)


def ping_host(ip):
    windows = os.name == "nt"
    executable = system_tool("ping")
    if not executable:
        raise OSError("The system ping command is missing.")
    if windows:
        args = [executable, "-n", "1", "-w", "800", ip]
    elif sys.platform == "darwin":
        args = [executable, "-n", "-c", "1", "-W", "800", ip]
    else:
        args = [executable, "-n", "-c", "1", "-W", "1", ip]
    try:
        result = run_command(args, 2)
        # Windows may exit 0 for destination-unreachable responses; require a TTL reply.
        up = result.returncode == 0 and (not windows or bool(re.search(r"TTL\s*[=:]\s*\d+", result.stdout, re.I)))
        match = re.search(r"(?:time|temps|zeit|время)\s*[=<]\s*([\d.,]+)\s*(?:ms|мс)", result.stdout, re.I)
        return up, float(match[1].replace(",", ".")) if up and match else None
    except subprocess.TimeoutExpired:
        return False, None


def resolve_name(ip):
    # A subprocess bounds platform resolver latency without changing global socket state.
    try:
        result = run_command([sys.executable, "-I", "-c", "import socket,sys; print(socket.gethostbyaddr(sys.argv[1])[0])", ip], 2)
        return result.stdout.strip()[:253] if result.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def parse_neighbors(text):
    rows = {}
    for line in text.splitlines():
        ip = re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", line)
        mac = re.search(r"\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b", line, re.I)
        if ip and mac:
            value = mac[0].replace("-", ":").upper()
            if value not in ("00:00:00:00:00:00", "FF:FF:FF:FF:FF:FF"):
                rows[ip[0]] = value
    return rows


def neighbors():
    arp = system_tool("arp")
    args = [arp, "-a"] if os.name == "nt" else ([shutil.which("ip"), "neigh", "show"] if shutil.which("ip") else [arp, "-an"])
    try:
        if not args[0]:
            return {}
        return parse_neighbors(run_command(args, 2).stdout)
    except (OSError, subprocess.TimeoutExpired):
        return {}


def load_oui(path):
    if not path:
        return {}
    rows = {}
    with open(path, encoding="utf-8-sig", newline="") as handle:
        for i, row in enumerate(csv.reader(handle)):
            if i >= 100000:
                raise ValueError("OUI CSV exceeds 100000 rows.")
            if len(row) >= 2:
                prefix = row[0].replace(":", "").replace("-", "").upper()
                if re.fullmatch(r"[0-9A-F]{6}", prefix):
                    rows[prefix] = row[1].strip()[:160]
    return rows


class ScanManager:
    def __init__(self, oui=None, probe=ping_host, neighbor_reader=neighbors):
        self.lock = threading.Lock()
        self.job = None
        self.cancel = threading.Event()
        self.oui = oui or {}
        self.probe = probe
        self.neighbor_reader = neighbor_reader

    def start(self, target, names=False):
        targets = parse_targets(target)
        if not system_tool("ping") and self.probe is ping_host:
            raise ValueError("The system ping command is missing. Install/enable it before scanning.")
        with self.lock:
            if self.job and self.job["status"] in ("running", "stopping"):
                raise RuntimeError("A scan is already running. Stop it or wait for completion.")
            self.cancel = threading.Event()
            self.job = {"apiVersion": 1, "agentVersion": VERSION, "jobId": secrets.token_hex(12),
                        "target": target, "status": "running", "total": len(targets), "completed": 0,
                        "results": [], "error": "", "startedAt": int(time.time())}
            identity = self.job["jobId"]
        threading.Thread(target=self._scan, args=(identity, targets, names), daemon=True).start()
        return identity

    def _scan(self, identity, targets, names):
        def one(ip):
            if self.cancel.is_set():
                return None
            up, latency = self.probe(ip)
            return {"ip": ip, "status": "up" if up else "no-response", "name": resolve_name(ip) if up and names and not self.cancel.is_set() else "",
                    "mac": "", "manufacturer": "", "latencyMs": latency}
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
                pending = [pool.submit(one, ip) for ip in targets]
                for future in concurrent.futures.as_completed(pending):
                    row = future.result()
                    if row:
                        with self.lock:
                            self.job["results"].append(row)
                            self.job["completed"] += 1
            macs = self.neighbor_reader()
            with self.lock:
                for row in self.job["results"]:
                    row["mac"] = macs.get(row["ip"], "")
                    if row["mac"] and not (int(row["mac"][:2], 16) & 2):
                        row["manufacturer"] = self.oui.get(row["mac"].replace(":", "")[:6], "")
                self.job["status"] = "stopped" if self.cancel.is_set() else "completed"
        except Exception as error:
            with self.lock:
                self.job["status"] = "error"
                self.job["error"] = str(error)[:240]

    def snapshot(self, identity):
        with self.lock:
            if not self.job or self.job["jobId"] != identity:
                return None
            value = json.loads(json.dumps(self.job))
        value["results"].sort(key=lambda row: int(ipaddress.IPv4Address(row["ip"])))
        return value

    def stop(self, identity):
        with self.lock:
            if not self.job or self.job["jobId"] != identity:
                return False
            if self.job["status"] == "running":
                self.job["status"] = "stopping"
                self.cancel.set()
            return True


class AgentServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, port, token, origins, manager):
        self.token, self.origins, self.manager = token, set(origins), manager
        super().__init__(("127.0.0.1", port), Handler)


class Handler(BaseHTTPRequestHandler):
    server_version = "NOCLocalAgent/1"
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *args):
        pass

    def _origin(self):
        port = self.server.server_port
        return (self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")
                and self.headers.get("Origin") in self.server.origins)

    def _reply(self, status, data):
        payload = json.dumps(data, ensure_ascii=True, allow_nan=False).encode()
        self.send_response(status)
        if self._origin():
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        if not self._origin():
            return self._reply(403, {"error": "Origin or Host not allowed."})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Max-Age", "300")
        self.end_headers()

    def _authorized(self):
        return self._origin() and hmac.compare_digest(self.headers.get("Authorization", "").encode("utf-8"), ("Bearer " + self.server.token).encode("utf-8"))

    def _body(self):
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            raise ValueError("Use application/json.")
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= MAX_BODY:
            raise ValueError("Invalid or oversized request.")
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object.")
        return value

    def do_GET(self):
        if not self._authorized():
            return self._reply(403, {"error": "Check the session token and allowed website origin."})
        if self.path == "/v1/health":
            return self._reply(200, {"apiVersion": 1, "agentVersion": VERSION, "maxHosts": MAX_HOSTS})
        match = re.fullmatch(r"/v1/scans/([a-f0-9]{24})", self.path)
        data = self.server.manager.snapshot(match[1]) if match else None
        self._reply(200 if data else 404, data or {"error": "Scan not found."})

    def do_POST(self):
        if not self._authorized():
            return self._reply(403, {"error": "Check the session token and allowed website origin."})
        try:
            body = self._body()
            if self.path == "/v1/scans":
                if not isinstance(body.get("target"), str) or not isinstance(body.get("resolveNames", False), bool):
                    raise ValueError("Invalid scan inputs.")
                identity = self.server.manager.start(body["target"], body.get("resolveNames", False))
                return self._reply(202, {"jobId": identity})
            match = re.fullmatch(r"/v1/scans/([a-f0-9]{24})/stop", self.path)
            if match and self.server.manager.stop(match[1]):
                return self._reply(200, {"status": "stopping"})
            return self._reply(404, {"error": "Scan not found."})
        except RuntimeError as error:
            self._reply(409, {"error": str(error)})
        except (ValueError, TypeError) as error:
            self._reply(400, {"error": str(error)[:240]})


def valid_origin(value):
    parsed = urlsplit(value)
    if parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError("Use an origin without credentials, path or query.")
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
        raise argparse.ArgumentTypeError("Use HTTPS, or a loopback HTTP development origin.")
    if not parsed.hostname or "*" in value:
        raise argparse.ArgumentTypeError("Use one exact website origin.")
    return value.rstrip("/")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--allow-origin", type=valid_origin, action="append", default=[])
    parser.add_argument("--oui-csv", help="Optional offline CSV: six-hex-digit OUI prefix,vendor")
    parser.add_argument("--once", metavar="TARGET", help="Run one scan and export JSON without a web connection")
    parser.add_argument("--output", default="scan-results.json")
    parser.add_argument("--resolve-names", action="store_true")
    args = parser.parse_args(argv)
    if not 1024 <= args.port <= 65535:
        parser.error("Port must be between 1024 and 65535.")
    manager = ScanManager(load_oui(args.oui_csv))
    if args.once:
        identity = manager.start(args.once, args.resolve_names)
        try:
            while manager.snapshot(identity)["status"] in ("running", "stopping"):
                time.sleep(.15)
        except KeyboardInterrupt:
            manager.stop(identity)
            raise
        snapshot = manager.snapshot(identity)
        Path(args.output).write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        print(f"Saved {snapshot['completed']} results to {args.output}")
        return 1 if snapshot["status"] == "error" else 0
    token = secrets.token_urlsafe(32)
    server = AgentServer(args.port, token, [DEFAULT_ORIGIN, *args.allow_origin], manager)
    print(f"NOC Local Agent {VERSION} | http://127.0.0.1:{args.port}")
    print("Session token (paste into the website; valid until this process exits):")
    print(token, flush=True)
    print("No scan starts automatically. Keep this window open. Ctrl+C stops the agent.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        manager.cancel.set()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, csv.Error) as error:
        print(f"Agent error: {error}", file=sys.stderr)
        raise SystemExit(1)
