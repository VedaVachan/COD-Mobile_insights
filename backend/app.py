from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import pandas as pd
import os

app = Flask(__name__)
CORS(app)  # 🔥 VERY IMPORTANT — allows frontend access

DATA_PATH = os.environ.get('DATA_PATH', 'data/vedas_5match_stats.csv')

def load_data():
    if not os.path.exists(DATA_PATH):
        return pd.DataFrame()
    df = pd.read_csv(DATA_PATH)
    df.columns = [c.strip() for c in df.columns]
    return df

@app.route('/api/matches')
def matches():
    df = load_data()
    return df.to_json(orient='records', force_ascii=False)

@app.route('/api/summary')
def summary():
    df = load_data()
    total_matches = len(df)
    if total_matches == 0:
        return jsonify({'total_matches': 0})
    
    total_kills = int(df['Kills'].sum())
    total_deaths = int(df['Deaths'].sum())
    kd_ratio = round(total_kills / total_deaths, 2) if total_deaths > 0 else None
    win_rate = round((df['Result'].str.contains('Win').sum() / total_matches) * 100, 2)
    avg_accuracy = round(df['Accuracy'].astype(float).mean(), 2)
    mvp_rate = round((df['MVP'].astype(str).str.lower().eq('yes').sum() / total_matches) * 100, 2)
    avg_impact = round(df['Impact'].astype(float).mean(), 2)

    return jsonify({
        'total_matches': total_matches,
        'total_kills': total_kills,
        'total_deaths': total_deaths,
        'kd_ratio': kd_ratio,
        'win_rate': win_rate,
        'avg_accuracy': avg_accuracy,
        'mvp_rate': mvp_rate,
        'avg_impact': avg_impact
    })

@app.route('/api/trends')
def trends():
    df = load_data()
    if df.empty:
        return jsonify({'matches': [], 'kills': [], 'accuracy': [], 'impact': [], 'score': []})
    
    payload = {
        'matches': df['Match'].tolist(),
        'kills': df['Kills'].tolist(),
        'accuracy': df['Accuracy'].tolist(),
        'impact': df['Impact'].tolist(),
        'score': df['Score'].tolist()
    }
    return jsonify(payload)

@app.route('/api/maps')
def maps():
    df = load_data()
    if df.empty:
        return jsonify([])
    
    grouped = df.groupby('Map').agg({
        'Kills': 'mean',
        'Impact': 'mean',
        'KD Ratio': 'mean',
        'Match': 'count'
    }).reset_index()

    grouped = grouped.rename(columns={'Match': 'games'})
    return grouped.to_json(orient='records', force_ascii=False)

@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    f = request.files['file']
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    f.save(DATA_PATH)
    return jsonify({'ok': True, 'path': DATA_PATH})

@app.route('/')
def index():
    return "Backend running. Use /api/* endpoints"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
