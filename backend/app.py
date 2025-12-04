# backend/app.py
from flask import Flask, jsonify, send_from_directory, request
from datetime import datetime, timedelta
import random
import os
import pathlib

# compute absolute path to the frontend folder (relative to this file)
BASE_DIR = pathlib.Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="/")

def generate_sample_matches(n=30):
    maps = ['Altar', 'Shipyard', 'Bunker', 'Factory']
    modes = ['BR', 'Multiplayer', 'Duel']
    matches = []
    for i in range(n):
        d = datetime.utcnow() - timedelta(days=(n - 1 - i))
        kills = random.randint(0, 18)
        deaths = random.randint(0, 12)
        assists = random.randint(0, 6)
        accuracy = round(random.uniform(20, 70), 1)
        score = random.randint(200, 2500)
        impact = random.randint(0, 150)
        match = {
            "id": i + 1,
            "date": d.isoformat() + "Z",
            "map": maps[i % len(maps)],
            "mode": modes[i % len(modes)],
            "kills": kills,
            "deaths": deaths,
            "assists": assists,
            "score": score,
            "accuracy": accuracy,
            "impact": impact,
            "duration_min": random.randint(5, 30),
            "mvp": random.random() > 0.8,
            "win": random.random() > 0.6
        }
        matches.append(match)
    return matches

# Log requests for easier debugging
@app.before_request
def log_request():
    print(f"[Request] {request.method} {request.path}")

# Serve index.html at root
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

# Serve any other static file from frontend folder (css, js, images)
@app.route("/<path:filename>")
def static_files(filename):
    # safe-guard: ensure file exists
    target = pathlib.Path(app.static_folder) / filename
    if target.exists():
        return send_from_directory(app.static_folder, filename)
    # fallback: return index (for SPA) or 404
    return ("Not Found", 404)

# API endpoint
@app.route("/api/matches")
def api_matches():
    matches = generate_sample_matches(30)
    return jsonify(matches)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # debug=True automatically restarts on change; keep it for dev
    app.run(host="0.0.0.0", port=port, debug=True)
