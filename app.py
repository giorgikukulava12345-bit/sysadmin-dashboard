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

PORT_CHECK_TIMEOUT = 3.0
SPEEDTEST_CHUNK_SIZE = 256 * 1024       
SPEEDTEST_MAX_MB = 500  # ლიმიტი გავზარდოთ 500 მბ-მდე დიდი პროგრამებისთვის (მაგ. iVMS)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = (SPEEDTEST_MAX_MB + 4) * 1024 * 1024

# ---------------------------------------------------------------------------
# Google Drive ლინკების მატრიცა დიდი ფაილებისთვის
# ---------------------------------------------------------------------------
DRIVE_LINKS = {
    "SADP.exe": "https://drive.google.com/file/d/165ZxEDG5HcpFB7u8j8Kqub-Kd51qGHMO/view?usp=sharing",
    "iVMS-4200(V3.14.0.6_E).exe": "https://drive.google.com/file/d/1ChI7JzihloyM7_4I7SuQYi0fSIatW1s8/view?usp=sharing",
    "EZStation_B1130.3.18.3(IN).exe": "https://drive.google.com/file/d/1Mzso5hA06xwNd6b-7_a6BbnlTZJhLETF/view?usp=sharing"
}

def human_size(num_bytes: int) -> str:
    step = 1024.0
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num_bytes < step:
            return f"{num_bytes:.0f} {unit}" if unit == "B" else f"{num_bytes:.1f} {unit}"
        num_bytes /= step
    return f"{num_bytes:.1f} PB"


@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API: ფაილების ატვირთვის ფუნქცია (ლოკალურად)
# ---------------------------------------------------------------------------
@app.route("/api/upload", methods=["POST"])
def api_upload_real_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        filename = secure_filename(file.filename)
        if not filename:
            filename = file.filename
            
        destination = os.path.join(UPLOAD_DIR, filename)
        file.save(destination)
        
        return jsonify({
            "success": True,
            "message": f"File {filename} uploaded successfully.",
            "filename": filename
        }), 200


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

    try:
        resolved_ip = socket.gethostbyname(host)
    except socket.gaierror:
        return jsonify({
            "host": host,
            "port": port,
            "status": "error",
            "message": "Could not resolve host.",
        }) or {}, 200

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
# API: ფაილების სია დრაივის ბმულების ინტეგრაციით
# ---------------------------------------------------------------------------
@app.route("/api/files")
def api_files():
    files = []
    for name in sorted(os.listdir(UPLOAD_DIR)):
        full_path = os.path.join(UPLOAD_DIR, name)
        if os.path.isfile(full_path):
            stat = os.stat(full_path)
            
            # შემოწმება არის თუ არა ფაილი დრაივის სიაში
            if name in DRIVE_LINKS:
                download_url = DRIVE_LINKS[name]
                is_cloud = True
            else:
                download_url = f"/download/{name}"
                is_cloud = False
                
            files.append({
                "name": name,
                "size": human_size(stat.st_size),
                "size_bytes": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "download_url": download_url,
                "is_cloud": is_cloud
            })
    return jsonify({"files": files})


# ---------------------------------------------------------------------------
# API: ფაილის გადმოწერა (გასწორებული ფრჩხილებიანი ფაილებისთვის)
# ---------------------------------------------------------------------------
@app.route("/download/<path:filename>")
def download_file(filename):
    full_path = os.path.join(UPLOAD_DIR, filename)
    
    # უსაფრთხოების შემოწმება (Directory Traversal-ის პრევენცია)
    resolved_path = os.path.abspath(full_path)
    if not resolved_path.startswith(os.path.abspath(UPLOAD_DIR)):
        abort(403)
        
    if not os.path.isfile(resolved_path):
        abort(404)
        
    return send_from_directory(UPLOAD_DIR, filename, as_attachment=True)


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


@app.errorhandler(RequestEntityTooLarge)
def handle_payload_too_large(e):
    return jsonify({"error": f"Payload too large. Max test size is {SPEEDTEST_MAX_MB} MB."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
