import os
import socket
import time
from datetime import datetime

from flask import Flask, jsonify, request, render_template, send_from_directory, abort, Response, stream_with_context
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Socket connect timeout (seconds) for the port checker
PORT_CHECK_TIMEOUT = 3.0

# Speed test tuning
SPEEDTEST_CHUNK_SIZE = 256 * 1024       # 256 KB per streamed chunk
SPEEDTEST_MAX_MB = 50                   # hard ceiling per download request

app = Flask(__name__)

# Reject any request body over this size outright (covers the upload test too).
app.config["MAX_CONTENT_LENGTH"] = (SPEEDTEST_MAX_MB + 4) * 1024 * 1024


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def human_size(num_bytes: int) -> str:
    step = 1024.0
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num_bytes < step:
            return f"{num_bytes:.0f} {unit}" if unit == "B" else f"{num_bytes:.1f} {unit}"
        num_bytes /= step
    return f"{num_bytes:.1f} PB"


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API: Port checker
# ---------------------------------------------------------------------------

@app.route("/api/portcheck", methods=["POST"])
def api_portcheck():
    data = request.get_json(silent=True) or {}
    host = str(data.get("host", "")).strip()
    port_raw = data.get("port")

    if not host:
        return jsonify({"error": "Host / IP is required."}), 400

    try:
        port = int(port_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "Port must be a number."}), 400

    if not (1 <= port <= 65535):
        return jsonify({"error": "Port must be between 1 and 65535."}), 400

    # Resolve hostname -> IP
    try:
        resolved_ip = socket.gethostbyname(host)
    except socket.gaierror:
        return jsonify({
            "host": host,
            "port": port,
            "status": "error",
            "message": "Could not resolve host.",
        }), 200

    start = time.monotonic()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(PORT_CHECK_TIMEOUT)
    try:
        result = sock.connect_ex((resolved_ip, port))
        elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        status = "open" if result == 0 else "closed"
    except socket.timeout:
        elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        status = "closed"
    except OSError:
        elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        status = "error"
    finally:
        sock.close()

    return jsonify({
        "host": host,
        "resolved_ip": resolved_ip,
        "port": port,
        "status": status,
        "latency_ms": elapsed_ms,
    })


# ---------------------------------------------------------------------------
# API: File repository
# ---------------------------------------------------------------------------

@app.route("/api/files")
def api_files():
    files = []
    for name in sorted(os.listdir(UPLOAD_DIR)):
        full_path = os.path.join(UPLOAD_DIR, name)
        if os.path.isfile(full_path):
            stat = os.stat(full_path)
            files.append({
                "name": name,
                "size": human_size(stat.st_size),
                "size_bytes": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
            })
    return jsonify({"files": files})


@app.route("/download/<path:filename>")
def download_file(filename):
    safe_name = secure_filename(filename)
    if not safe_name or not os.path.isfile(os.path.join(UPLOAD_DIR, safe_name)):
        abort(404)
    return send_from_directory(UPLOAD_DIR, safe_name, as_attachment=True)


# ---------------------------------------------------------------------------
# API: Speed test
# ---------------------------------------------------------------------------

@app.route("/api/speedtest/ping")
def api_speedtest_ping():
    resp = jsonify({"pong": True, "t": time.time()})
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return resp


@app.route("/api/speedtest/download")
def api_speedtest_download():
    try:
        mb = float(request.args.get("mb", 10))
    except (TypeError, ValueError):
        mb = 10.0
    mb = max(1.0, min(mb, SPEEDTEST_MAX_MB))
    total_bytes = int(mb * 1024 * 1024)

    def generate():
        remaining = total_bytes
        while remaining > 0:
            chunk = min(SPEEDTEST_CHUNK_SIZE, remaining)
            yield os.urandom(chunk)
            remaining -= chunk

    headers = {
        "Content-Type": "application/octet-stream",
        "Content-Length": str(total_bytes),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Speedtest-Bytes": str(total_bytes),
    }
    return Response(stream_with_context(generate()), headers=headers)


@app.route("/api/speedtest/upload", methods=["POST"])
def api_speedtest_upload():
    data = request.get_data()
    return jsonify({"received_bytes": len(data)})


@app.errorhandler(RequestEntityTooLarge)
def handle_payload_too_large(e):
    return jsonify({"error": f"Payload too large. Max test size is {SPEEDTEST_MAX_MB} MB."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)