// docs/main.js
async function fetchMatches() {
  // default: static JSON in docs/data/matches.json (works on GitHub Pages)
  const res = await fetch("data/matches.json");
  if (!res.ok) throw new Error("Failed to fetch matches.json: " + res.status);
  return res.json();
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function renderSummary(matches) {
  const container = document.getElementById("summary");
  container.innerHTML = "";

  const total = matches.length;
  const avg = (key) => (matches.reduce((s, m) => s + (m[key] || 0), 0) / total) || 0;
  const wins = matches.filter(m => m.win).length;
  const mvps = matches.filter(m => m.mvp).length;

  const cards = [
    { title: "Total Matches", value: total },
    { title: "Avg Kills", value: avg("kills").toFixed(2) },
    { title: "Avg Deaths", value: avg("deaths").toFixed(2) },
    { title: "K/D", value: (avg("kills") / Math.max(1, avg("deaths"))).toFixed(2) },
    { title: "Win Rate", value: ((wins / total) * 100).toFixed(1) + "%" },
    { title: "MVP Rate", value: ((mvps / total) * 100).toFixed(1) + "%" },
  ];

  for (const c of cards) {
    const el = document.createElement("div");
    el.className = "card summary-item";
    el.innerHTML = `<div class="title">${c.title}</div><div class="value">${c.value}</div>`;
    container.appendChild(el);
  }
}

function drawKillsTrend(matches) {
  const x = matches.map(m => formatDate(m.date));
  const y = matches.map(m => m.kills);
  const layout = { margin: { t: 30, l: 40, r: 20, b: 40 }, title: "Kills Trend", height: 320 };
  Plotly.newPlot("killsTrend", [{ x, y, type: "scatter", mode: "lines+markers", marker: { size: 6 } }], layout, { responsive: true });
}

function drawAccuracyTrend(matches) {
  const x = matches.map(m => formatDate(m.date));
  const y = matches.map(m => m.accuracy);
  const layout = { margin: { t: 30 }, title: "Accuracy Trend (%)", height: 320 };
  Plotly.newPlot("accuracyTrend", [{ x, y, type: "scatter", mode: "lines+markers" }], layout, { responsive: true });
}

function drawScoreImpact(matches) {
  const x = matches.map(m => formatDate(m.date));
  const score = matches.map(m => m.score);
  const impact = matches.map(m => m.impact);
  const layout = { margin: { t: 30 }, title: "Score & Impact", height: 340, yaxis2: { overlaying: "y", side: "right", title: "Impact" } };
  const data = [
    { x, y: score, name: "Score", type: "bar" },
    { x, y: impact, name: "Impact", yaxis: "y2", type: "scatter", mode: "lines+markers" }
  ];
  Plotly.newPlot("scoreImpact", data, layout, { responsive: true });
}

function drawKDDistribution(matches) {
  const kd = matches.map(m => (m.kills / Math.max(1, m.deaths)));
  const layout = { margin: { t: 30 }, title: "K/D Distribution", height: 320 };
  Plotly.newPlot("kdDist", [{ x: kd, type: "histogram" }], layout, { responsive: true });
}

function drawMapPerformance(matches) {
  const byMap = {};
  matches.forEach(m => {
    if (!byMap[m.map]) byMap[m.map] = { matches: 0, kills: 0, wins: 0 };
    byMap[m.map].matches++;
    byMap[m.map].kills += m.kills;
    byMap[m.map].wins += (m.win ? 1 : 0);
  });
  const maps = Object.keys(byMap);
  const avgKills = maps.map(mp => byMap[mp].kills / byMap[mp].matches);
  const winRates = maps.map(mp => (byMap[mp].wins / byMap[mp].matches) * 100);

  const layout = { margin: { t: 40 }, title: "Map Performance (Avg Kills & Win%)", height: 340, yaxis2: { overlaying: "y", side: "right", title: "Win Rate (%)" } };
  const data = [
    { x: maps, y: avgKills, name: "Avg Kills", type: "bar" },
    { x: maps, y: winRates, name: "Win Rate (%)", type: "scatter", mode: "lines+markers", yaxis: "y2" }
  ];
  Plotly.newPlot("mapPerf", data, layout, { responsive: true });
}

function renderTimeline(matches) {
  const container = document.getElementById("timeline");
  container.innerHTML = "";
  const reversed = matches.slice().reverse();
  reversed.forEach(m => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div class="badge-win ${m.win ? "win" : "lose"}"></div>
        <div>
          <div style="font-weight:600">#${m.id} — ${m.mode} on ${m.map}</div>
          <div class="muted">${formatDate(m.date)} • ${m.duration_min} min</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:600">${m.kills} / ${m.deaths} / ${m.assists}</div>
        <div class="muted">${m.accuracy}% • ${m.score} pts ${m.mvp ? ' • MVP' : ''}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

async function refreshAllFromStatic() {
  const matches = await fetchMatches();
  renderAndDrawAll(matches);
}

function renderAndDrawAll(matches) {
  renderSummary(matches);
  drawKillsTrend(matches);
  drawAccuracyTrend(matches);
  drawScoreImpact(matches);
  drawKDDistribution(matches);
  drawMapPerformance(matches);
  renderTimeline(matches);
}

// CSV upload support (PapaParse)
document.getElementById('uploadBtn').addEventListener('click', () => {
  document.getElementById('csvFile').click();
});

document.getElementById('csvFile').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const parsed = results.data.map((r, i) => ({
        id: r.id ? Number(r.id) : i+1,
        date: r.date || r.Date || new Date().toISOString(),
        map: r.map || r.Map || 'Unknown',
        mode: r.mode || r.Mode || 'Multiplayer',
        kills: Number(r.kills || r.Kills || 0),
        deaths: Number(r.deaths || r.Deaths || 0),
        assists: Number(r.assists || r.Assists || 0),
        score: Number(r.score || r.Score || 0),
        accuracy: Number(r.accuracy || r.Accuracy || 0),
        impact: Number(r.impact || r.Impact || 0),
        duration_min: Number(r.duration_min || r.Duration || 0),
        mvp: (r.mvp || r.MVP || '').toString().toLowerCase() === 'true' || (r.mvp || r.MVP || '') === '1',
        win: (r.win || r.Win || '').toString().toLowerCase() === 'true' || (r.win || r.Win || '') === '1',
      }));
      renderAndDrawAll(parsed);
    },
    error: function(err) {
      alert('Failed to parse CSV: ' + err.message);
    }
  });
});

// Refresh button triggers reload from static JSON
document.getElementById("refreshBtn").addEventListener("click", refreshAllFromStatic);

// Load the static JSON at page load
window.addEventListener("load", refreshAllFromStatic);
