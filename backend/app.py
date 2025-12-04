# backend/app.py
from flask import Flask, jsonify, send_from_directory
from datetime import datetime, timedelta
import random
import os

app = Flask(__name__, static_folder="../frontend", static_url_path="/")

# Generate sample matches (30 matches)
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

# Serve index.html and static assets
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    # serve static files (css, js)
    return send_from_directory(app.static_folder, path)

# API endpoint for matches
@app.route("/api/matches")
def api_matches():
    matches = generate_sample_matches(30)
    return jsonify(matches)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
