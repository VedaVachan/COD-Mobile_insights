// docs/main.js (improved + weapons + profile wiring)
(function () {
  function $id(id) { return document.getElementById(id); }
  function toNum(v, fallback = 0) {
    if (v === undefined || v === null || v === "") return fallback;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  function toBool(v) {
    if (typeof v === "boolean") return v;
    if (!v) return false;
    const s = String(v).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "y";
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString();
  }

  // Map CSV rows -> match object
  function mapRowToMatch(r, i, baseDate) {
    const matchId = r.match || r.Match || r.id || r.ID || null;
    const dateRaw = r.date || r.Date || null;
    let dateIso;
    if (dateRaw) {
      const d = new Date(dateRaw);
      dateIso = !isNaN(d) ? d.toISOString() : new Date(baseDate.getTime() - (i * 24*3600*1000)).toISOString();
    } else {
      dateIso = new Date(baseDate.getTime() - (i * 24*3600*1000)).toISOString();
    }
    const mapName = r.map || r.Map || "Unknown";
    const mode = r.mode || r.Mode || "Multiplayer";
    const result = r.result || r.Result || "";
    const score = toNum(r.score || r.Score || 0);
    const kills = toNum(r.kills || r.Kills || 0);
    const deaths = toNum(r.deaths || r.Deaths || 0);
    const assists = toNum(r.assists || r.Assists || 0);
    const kd_ratio = toNum(r["kd_ratio"] || r["KD Ratio"] || "");
    const impact = toNum(r.impact || r.Impact || 0);
    const accuracy = toNum(r.accuracy || r.Accuracy || 0);
    const adr = toNum(r.adr || r.ADR || 0);
    const firstKills = toNum(r.firstkills || r.FirstKills || 0);
    const loneWolfWins = toNum(r.lonewolfwins || r.LoneWolfWins || 0);
    const mvp = toBool(r.mvp || r.MVP || "");
    const win = /win/i.test(String(result));
    const duration_min = toNum(r.duration_min || r.Duration || (mode && mode.toLowerCase().includes("s&d") ? 18 : 15));
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

  // Visualization functions (unchanged logic)
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
      item.addEventListener("click", () => {
        alert(`Match #${m.id}\nMap: ${m.map}\nMode: ${m.mode}\nScore: ${m.score}\nKills: ${m.kills} • Deaths: ${m.deaths} • Assists: ${m.assists}`);
      });
      container.appendChild(item);
    });
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
          // expose to window for reuse
          window.currentMatches = parsed;
          renderAndDrawAll(parsed);
        },
        error: function(err) {
          alert('Failed to parse CSV: ' + err.message);
        }
      });
    });
  }

  function initRefresh() {
    const refreshBtn = $id("refreshBtn");
    if (!refreshBtn) return;
    refreshBtn.addEventListener("click", async () => {
      try {
        const matches = await fetchMatches();
        window.currentMatches = matches;
        renderAndDrawAll(matches);
      } catch (e) {
        alert("Failed to load static matches: " + e.message);
      }
    });
  }

  // Profile button wiring
  function initProfileButtons() {
    const btnOverview = $id("btnOverview");
    const btnMatches = $id("btnMatches");
    const btnPlans = $id("btnPlans");
    if (btnOverview) btnOverview.addEventListener("click", () => { $id("profileHero") && $id("profileHero").scrollIntoView({ behavior: "smooth", block: "start" }); });
    if (btnMatches) btnMatches.addEventListener("click", () => { $id("timeline") && $id("timeline").scrollIntoView({ behavior: "smooth", block: "center" }); });
    if (btnPlans) btnPlans.addEventListener("click", async () => {
      // prefer currentMatches (CSV) else load static
      try {
        let matches = window.currentMatches;
        if (!matches) {
          const res = await fetch("data/matches.json");
          if (res.ok) matches = await res.json();
          else matches = [];
        }
        renderAndDrawAll(matches);
      } catch (e) {
        console.warn("Plans load warning:", e);
      }
      const dash = $id("dashboardSection") || $id("summary");
      if (dash) dash.scrollIntoView({ behavior: "smooth", block: "start" });
      const hero = $id("profileHero");
      if (hero) hero.classList.add("collapsed");
    });
  }

  function initExport() {
    const btnExport = $id("btnExport");
    if (!btnExport) return;
    btnExport.addEventListener("click", async () => {
      try {
        const matches = window.currentMatches || await fetchMatches();
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

  // Weapons section
  (function(){
    const WEAPONS_JSON = "data/weapons.json";
    function renderWeaponsGrid(list) {
      const grid = $id("weaponsGrid");
      if (!grid) return;
      grid.innerHTML = "";
      list.forEach(w => {
        const el = document.createElement("div");
        el.className = "weapon-card";
        el.innerHTML = `
          <div class="weapon-thumb"><img src="${w.img}" alt="${w.name}" onerror="this.src='assets/weapons/placeholder.png'"/></div>
          <div class="weapon-name">${w.name}</div>
          <div class="rarity-badge ${w.rarity === 'mythic' ? 'rarity-mythic' : (w.rarity === 'legend' ? 'rarity-legend' : 'rarity-epic')}">${(w.rarity||'').toUpperCase()}</div>
        `;
        el.addEventListener("click", () => openWeaponModal(w));
        grid.appendChild(el);
      });
    }
    function defaultWeapons() {
      return [
        { id:"bp50", name:"BP50 - Ion Eruption", rarity:"mythic", img:"assets/weapons/bp50.jpg", desc:"Mythic shotgun."},
        { id:"ak117", name:"AK117 - Lava Remix", rarity:"legend", img:"assets/weapons/ak117.jpg", desc:"Legend AR."},
        { id:"qq9", name:"QQ9 - Dual Kinetics", rarity:"legend", img:"assets/weapons/qq9.jpg", desc:"SMG."}
      ];
    }
    async function loadWeapons() {
      try {
        const res = await fetch(WEAPONS_JSON);
        const weapons = res.ok ? await res.json() : defaultWeapons();
        renderWeaponsGrid(weapons);
        window._weapons = weapons;
      } catch (e) {
        console.warn("Weapons load failed:", e);
        renderWeaponsGrid(defaultWeapons());
      }
    }
    function openWeaponModal(w) {
      const modal = $id("weaponModal");
      if (!modal) return;
      $id("weaponModalImg").src = w.img || "assets/weapons/placeholder.png";
      $id("weaponModalName").textContent = w.name;
      $id("weaponModalRarity").className = "rarity-badge " + (w.rarity === 'mythic' ? 'rarity-mythic' : (w.rarity === 'legend' ? 'rarity-legend' : 'rarity-epic'));
      $id("weaponModalRarity").textContent = (w.rarity || "").toUpperCase();
      $id("weaponModalDesc").textContent = w.desc || "";
      modal.setAttribute("aria-hidden", "false");
    }
    $id("weaponModalClose").addEventListener("click", ()=> $id("weaponModal").setAttribute("aria-hidden","true"));
    $id("weaponModal").addEventListener("click", (ev)=> { if (ev.target === $id("weaponModal")) $id("weaponModal").setAttribute("aria-hidden","true"); });
    // filters
    document.addEventListener("DOMContentLoaded", ()=> {
      const fm = $id("filterMythic"), fl = $id("filterLegend"), sa = $id("showAllWeapons");
      if (fm) fm.addEventListener("click", ()=> renderWeaponsGrid((window._weapons||defaultWeapons()).filter(w=>w.rarity==='mythic')));
      if (fl) fl.addEventListener("click", ()=> renderWeaponsGrid((window._weapons||defaultWeapons()).filter(w=>w.rarity==='legend')));
      if (sa) sa.addEventListener("click", ()=> renderWeaponsGrid(window._weapons||defaultWeapons()));
      loadWeapons();
    });
  })();

  // initialize
  document.addEventListener("DOMContentLoaded", async () => {
    initCsvUpload();
    initRefresh();
    initProfileButtons();
    initExport();
    try {
      const matches = await fetchMatches();
      window.currentMatches = matches;
      renderAndDrawAll(matches);
    } catch (e) {
      console.warn("Static JSON load failed:", e.message);
    }
  });

})();

          
      
