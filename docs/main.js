// docs/main.js (improved)
(function () {
  // Helper: safe query
  function $id(id) { return document.getElementById(id); }

  // Robust parser for numbers
  function toNum(v, fallback = 0) {
    if (v === undefined || v === null || v === "") return fallback;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }

  // Normalize boolean-like values
  function toBool(v) {
    if (typeof v === "boolean") return v;
    if (!v) return false;
    const s = String(v).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "y";
  }

  // Map CSV rows (any header names) -> dashboard match object
  function mapRowToMatch(r, i, baseDate) {
    // Common header possibilities
    const matchId = r.match || r.Match || r.id || r.ID || r["Match #"] || r["#"] || null;
    const dateRaw = r.date || r.Date || r.played_at || r.Timestamp || null;
    // If CSV has no date, synthesize from baseDate by subtracting days
    let dateIso;
    if (dateRaw) {
      // try to make ISO if it's already a date or simple string
      const d = new Date(dateRaw);
      if (!isNaN(d)) dateIso = d.toISOString();
      else dateIso = new Date(baseDate.getTime() - (i * 24*3600*1000)).toISOString();
    } else {
      dateIso = new Date(baseDate.getTime() - (i * 24*3600*1000)).toISOString();
    }

    // map name variations
    const mapName = r.map || r.Map || r["Map Name"] || r["Map"] || "Unknown";
    const mode = r.mode || r.Mode || r["Game Mode"] || r["Mode"] || "Multiplayer";
    const result = r.result || r.Result || r["Outcome"] || "";
    const score = toNum(r.score || r.Score || r.Points || 0);
    const kills = toNum(r.kills || r.Kills || r["Kill"] || 0);
    const deaths = toNum(r.deaths || r.Deaths || r["Death"] || 0);
    const assists = toNum(r.assists || r.Assists || 0);
    const kd_ratio = toNum(r["kd_ratio"] || r["KD Ratio"] || r["K/D"] || r["KD"] || "");
    const impact = toNum(r.impact || r.Impact || 0);
    const accuracy = toNum(r.accuracy || r.Accuracy || r.Acc || 0);
    const adr = toNum(r.adr || r.ADR || 0);
    const firstKills = toNum(r.firstkills || r.FirstKills || r["First Kills"] || 0);
    const loneWolfWins = toNum(r.lonewolfwins || r.LoneWolfWins || r["LoneWolfWins"] || r["Lone Wolf"] || 0);
    const mvpVal = r.mvp || r.MVP || r["IsMVP"] || r["Mvp"] || r["MVP?"] || "";
    const mvp = toBool(mvpVal);

    // determine win boolean from Result text (detect 'win' case-insensitive)
    const win = /win/i.test(String(result));

    // duration: if present use it else estimate (S&D short)
    const duration_min = toNum(r.duration_min || r.Duration || r["Duration (min)"], (mode && mode.toLowerCase().includes("s&d")) ? 18 : 15);

    return {
      id: matchId ? (toNum(matchId, null) || String(matchId)) : (i + 1),
      date: dateIso,
      map: mapName,
      mode: mode,
      result: result,
      score: score,
      kills: kills,
      deaths: deaths,
      assists: assists,
      kd_ratio: kd_ratio,
      impact: impact,
      accuracy: accuracy,
      adr: adr,
      firstKills: firstKills,
      loneWolfWins: loneWolfWins,
      mvp: mvp,
      duration_min: duration_min,
      win: win
    };
  }

  // ---- Existing visualization functions (unchanged) ----
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString();
  }

  function renderSummary(matches) {
    const container = $id("summary");
    if (!container) return;
    container.innerHTML = "";

    const total = matches.length || 0;
    const avg = (key) => (matches.reduce((s, m) => s + (toNum(m[key] || 0)), 0) / Math.max(1, total)) || 0;
    const wins = matches.filter(m => m.win).length;
    const mvps = matches.filter(m => m.mvp).length;

    const cards = [
      { title: "Total Matches", value: total },
      { title: "Avg Kills", value: avg("kills").toFixed(2) },
      { title: "Avg Deaths", value: avg("deaths").toFixed(2) },
      { title: "K/D", value: (avg("kills") / Math.max(1, avg("deaths"))).toFixed(2) },
      { title: "Win Rate", value: ((wins / Math.max(1, total)) * 100).toFixed(1) + "%" },
      { title: "MVP Rate", value: ((mvps / Math.max(1, total)) * 100).toFixed(1) + "%" },
    ];

    for (const c of cards) {
      const el = document.createElement("div");
      el.className = "card summary-item";
      el.innerHTML = `<div class="title">${c.title}</div><div class="value">${c.value}</div>`;
      container.appendChild(el);
    }
  }

  function drawKillsTrend(matches) {
    if (!$id("killsTrend")) return;
    const x = matches.map(m => formatDate(m.date));
    const y = matches.map(m => m.kills);
    const layout = { margin: { t: 30, l: 40, r: 20, b: 40 }, title: "Kills Trend", height: 320 };
    Plotly.newPlot("killsTrend", [{ x, y, type: "scatter", mode: "lines+markers", marker: { size: 6 } }], layout, { responsive: true });
  }

  function drawAccuracyTrend(matches) {
    if (!$id("accuracyTrend")) return;
    const x = matches.map(m => formatDate(m.date));
    const y = matches.map(m => m.accuracy);
    const layout = { margin: { t: 30 }, title: "Accuracy Trend (%)", height: 320 };
    Plotly.newPlot("accuracyTrend", [{ x, y, type: "scatter", mode: "lines+markers" }], layout, { responsive: true });
  }

  function drawScoreImpact(matches) {
    if (!$id("scoreImpact")) return;
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
    if (!$id("kdDist")) return;
    const kd = matches.map(m => (m.kills / Math.max(1, m.deaths)));
    const layout = { margin: { t: 30 }, title: "K/D Distribution", height: 320 };
    Plotly.newPlot("kdDist", [{ x: kd, type: "histogram" }], layout, { responsive: true });
  }

  function drawMapPerformance(matches) {
    if (!$id("mapPerf")) return;
    const byMap = {};
    matches.forEach(m => {
      if (!byMap[m.map]) byMap[m.map] = { matches: 0, kills: 0, wins: 0 };
      byMap[m.map].matches++;
      byMap[m.map].kills += toNum(m.kills);
      byMap[m.map].wins += (m.win ? 1 : 0);
    });
    const maps = Object.keys(byMap);
    const avgKills = maps.map(mp => byMap[mp].kills / Math.max(1, byMap[mp].matches));
    const winRates = maps.map(mp => (byMap[mp].wins / Math.max(1, byMap[mp].matches)) * 100);

    const layout = { margin: { t: 40 }, title: "Map Performance (Avg Kills & Win%)", height: 340, yaxis2: { overlaying: "y", side: "right", title: "Win Rate (%)" } };
    const data = [
      { x: maps, y: avgKills, name: "Avg Kills", type: "bar" },
      { x: maps, y: winRates, name: "Win Rate (%)", type: "scatter", mode: "lines+markers", yaxis: "y2" }
    ];
    Plotly.newPlot("mapPerf", data, layout, { responsive: true });
  }

  function renderTimeline(matches) {
    const container = $id("timeline");
    if (!container) return;
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
      // click event to view details (if desired)
      item.addEventListener("click", () => {
        // simple detail alert — replace with modal if you like
        alert(`Match #${m.id}\nMap: ${m.map}\nMode: ${m.mode}\nScore: ${m.score}\nKills: ${m.kills} • Deaths: ${m.deaths} • Assists: ${m.assists}`);
      });
      container.appendChild(item);
    });
  }

  // Render pipeline
  function renderAndDrawAll(matches) {
    renderSummary(matches);
    drawKillsTrend(matches);
    drawAccuracyTrend(matches);
    drawScoreImpact(matches);
    drawKDDistribution(matches);
    drawMapPerformance(matches);
    renderTimeline(matches);
  }

  // Fetch static JSON (Pages) or throw
  async function fetchMatches() {
    const res = await window.fetch("data/matches.json");
    if (!res.ok) throw new Error("Failed to fetch matches.json: " + res.status);
    return res.json();
  }

  // CSV parsing handler using PapaParse (if loaded)
  function initCsvUpload() {
    const uploadBtn = $id("uploadBtn");
    const csvFile = $id("csvFile");
    if (!uploadBtn || !csvFile || typeof Papa === "undefined") return;

    uploadBtn.addEventListener("click", () => csvFile.click());

    csvFile.addEventListener("change", (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          const baseDate = new Date();
          const parsed = results.data.map((r, i) => mapRowToMatch(r, i, baseDate));
          renderAndDrawAll(parsed);
        },
        error: function(err) {
          alert('Failed to parse CSV: ' + err.message);
        }
      });
    });
  }

  // Refresh button wiring
  function initRefresh() {
    const refreshBtn = $id("refreshBtn");
    if (!refreshBtn) return;
    refreshBtn.addEventListener("click", async () => {
      try {
        const matches = await fetchMatches();
        renderAndDrawAll(matches);
      } catch (e) {
        alert("Failed to load static matches: " + e.message);
      }
    });
  }

  // Profile hero wiring (Overview / Matches / Plans) — safe wiring
  function initProfileButtons() {
    const btnOverview = $id("btnOverview");
    const btnMatches = $id("btnMatches");
    const btnPlans = $id("btnPlans");
    if (btnOverview) btnOverview.addEventListener("click", () => { $id("summary") && $id("summary").scrollIntoView({ behavior: "smooth" }); });
    if (btnMatches) btnMatches.addEventListener("click", () => { $id("timeline") && $id("timeline").scrollIntoView({ behavior: "smooth", block: "center" }); });
    if (btnPlans) btnPlans.addEventListener("click", () => { alert("Plans: Coming soon — customized training, map guides, and stat reports."); });
  }

  // Export button wiring (safe)
  function initExport() {
    const btnExport = $id("btnExport");
    if (!btnExport) return;
    btnExport.addEventListener("click", async () => {
      try {
        const matches = await fetchMatches();
        // simple CSV: header + values
        const headers = Object.keys(matches[0] || {});
        const rows = matches.map(m => headers.map(h => {
          const v = m[h];
          return typeof v === "string" && v.includes(",") ? `"${v.replace(/"/g,'""')}"` : String(v ?? "");
        }).join(","));
        const csv = [headers.join(",")].concat(rows).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "matches_export.csv"; a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert("Export failed: " + e.message);
      }
    });
  }

  // On load: initialize everything
  document.addEventListener("DOMContentLoaded", async () => {
    initCsvUpload();
    initRefresh();
    initProfileButtons();
    initExport();

    // Try load static JSON by default
    try {
      const matches = await fetchMatches();
      renderAndDrawAll(matches);
    } catch (e) {
      // If static load fails, attempt no-op (CSV upload can still work)
      console.warn("Static JSON load failed:", e.message);
    }
  });

})();
