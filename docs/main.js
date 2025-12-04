// main.js
(function(){
  const $ = id => document.getElementById(id);
  const MATCHES_JSON = "data/matches.json";
  const WEAPONS_JSON = "data/weapons.json";

  function toNum(v,d=0){ const n=Number(String(v||"").replace(/[^0-9.\-]/g,"")); return Number.isFinite(n)?n:d; }
  function toBool(v){ if(typeof v==="boolean") return v; if(!v) return false; const s=String(v).trim().toLowerCase(); return ["1","true","yes","y"].includes(s); }
  function fmtDate(iso){ const d=new Date(iso); return isNaN(d)?iso:d.toLocaleDateString(); }

  // profile button wiring
  function initProfileButtons(){
    $("btnOverview")?.addEventListener("click", ()=> window.scrollTo({top:0,behavior:"smooth"}));
    $("btnMatches")?.addEventListener("click", ()=> $("timeline")?.scrollIntoView({behavior:"smooth",block:"center"}));
    $("btnPlans")?.addEventListener("click", async ()=>{
      if(!window.currentMatches){
        try{ window.currentMatches = await fetchMatches(); } catch(e){ window.currentMatches = []; }
      }
      renderAndDrawAll(window.currentMatches || []);
      $("dashboardSection").scrollIntoView({behavior:"smooth", block:"start"});
      $("hero")?.classList.add("collapsed");
    });
  }

  // CSV upload wiring
  function initCsvUpload(){
    const uploadBtn = $("uploadBtn"), csvFile = $("csvFile");
    if(!uploadBtn || !csvFile || typeof Papa === "undefined") return;
    uploadBtn.addEventListener("click", ()=> csvFile.click());
    csvFile.addEventListener("change", (ev) => {
      const f = ev.target.files && ev.target.files[0]; if(!f) return;
      Papa.parse(f, { header:true, skipEmptyLines:true, complete: (res)=>{
        const parsed = res.data.map((r,i)=> mapRowToMatch(r,i,new Date()));
        window.currentMatches = parsed;
        renderAndDrawAll(parsed);
      }, error: (err) => alert("CSV parse failed: "+err.message) });
    });
  }

  // map CSV row -> match object
  function mapRowToMatch(r,i,baseDate){
    const id = r.match || r.Match || r.id || (i+1);
    const dateRaw = r.date || r.Date || null;
    let iso;
    if(dateRaw){ const d = new Date(dateRaw); iso = isNaN(d)? new Date(baseDate.getTime()-i*24*3600*1000).toISOString() : d.toISOString(); }
    else iso = new Date(baseDate.getTime()-i*24*3600*1000).toISOString();
    const map = r.map || r.Map || 'Unknown';
    const mode = r.mode || r.Mode || 'Multiplayer';
    const result = r.result || r.Result || '';
    return {
      id, date: iso, map, mode, result,
      score: toNum(r.score||r.Score||0),
      kills: toNum(r.kills||r.Kills||0),
      deaths: toNum(r.deaths||r.Deaths||0),
      assists: toNum(r.assists||r.Assists||0),
      impact: toNum(r.impact||r.Impact||0),
      accuracy: toNum(r.accuracy||r.Accuracy||0),
      duration_min: toNum(r.duration_min||r.Duration||15),
      mvp: toBool(r.mvp||r.MVP||''),
      win: /win/i.test(String(result))
    };
  }

  // dashboard plotting helpers
  function renderSummary(matches){
    const container = $("summary"); if(!container) return;
    container.innerHTML = "";
    const total = matches.length || 0;
    const avg = key => (matches.reduce((s,m)=> s + (toNum(m[key]||0)),0) / Math.max(1,total))||0;
    const wins = matches.filter(m=>m.win).length;
    const mvps = matches.filter(m=>m.mvp).length;
    const cards = [
      {title:"Total Matches", value: total},
      {title:"Avg Kills", value: avg("kills").toFixed(2)},
      {title:"Avg Deaths", value: avg("deaths").toFixed(2)},
      {title:"K/D", value: (avg("kills")/Math.max(1,avg("deaths"))).toFixed(2)},
      {title:"Win Rate", value: ((wins/Math.max(1,total))*100).toFixed(1)+"%"},
      {title:"MVP Rate", value: ((mvps/Math.max(1,total))*100).toFixed(1)+"%"}
    ];
    cards.forEach(c=>{
      const el = document.createElement("div"); el.className = "card summary-item";
      el.innerHTML = `<div class="title">${c.title}</div><div class="value">${c.value}</div>`;
      container.appendChild(el);
    });
  }

  function drawKillsTrend(matches){ if(!$("killsTrend")) return; const x=matches.map(m=>fmtDate(m.date)); const y=matches.map(m=>m.kills); Plotly.newPlot("killsTrend",[ {x,y,type:"scatter",mode:"lines+markers",marker:{size:6}} ],{margin:{t:30,l:40,r:20,b:40},title:"Kills Trend",height:320},{responsive:true}); }
  function drawAccuracyTrend(matches){ if(!$("accuracyTrend")) return; const x=matches.map(m=>fmtDate(m.date)); const y=matches.map(m=>m.accuracy); Plotly.newPlot("accuracyTrend",[ {x,y,type:"scatter",mode:"lines+markers"} ],{margin:{t:30},title:"Accuracy Trend (%)",height:320},{responsive:true}); }
  function drawScoreImpact(matches){ if(!$("scoreImpact")) return; const x=matches.map(m=>fmtDate(m.date)); const score=matches.map(m=>m.score), impact=matches.map(m=>m.impact); Plotly.newPlot("scoreImpact", [ {x,y:score,name:"Score",type:"bar"}, {x,y:impact,name:"Impact",yaxis:"y2",type:"scatter",mode:"lines+markers"} ], {margin:{t:30},title:"Score & Impact",height:340,yaxis2:{overlaying:"y",side:"right",title:"Impact"} }, {responsive:true}); }
  function drawKDDistribution(matches){ if(!$("kdDist")) return; const kd=matches.map(m=>m.kills/Math.max(1,m.deaths)); Plotly.newPlot("kdDist",[ {x:kd,type:"histogram"} ],{margin:{t:30},title:"K/D Distribution",height:320},{responsive:true}); }
  function drawMapPerformance(matches){ if(!$("mapPerf")) return; const by={}; matches.forEach(m=>{ if(!by[m.map]) by[m.map]={matches:0,kills:0,wins:0}; by[m.map].matches++; by[m.map].kills+=toNum(m.kills); by[m.map].wins+=m.win?1:0; }); const maps=Object.keys(by); const avgKills=maps.map(mp=>by[mp].kills/Math.max(1,by[mp].matches)); const winRates=maps.map(mp=>(by[mp].wins/Math.max(1,by[mp].matches))*100); Plotly.newPlot("mapPerf",[ {x:maps,y:avgKills,name:"Avg Kills",type:"bar"}, {x:maps,y:winRates,name:"Win Rate (%)",type:"scatter",mode:"lines+markers",yaxis:"y2"} ],{margin:{t:40},title:"Map Performance (Avg Kills & Win%)",height:340,yaxis2:{overlaying:"y",side:"right",title:"Win Rate (%)"}},{responsive:true}); }

  function renderTimeline(matches){
    const container = $("timeline"); if(!container) return; container.innerHTML=""; const reversed = matches.slice().reverse();
    reversed.forEach(m=>{
      const item = document.createElement("div"); item.className="timeline-item";
      item.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><div class="badge-win ${m.win?"win":"lose"}"></div><div><div style="font-weight:600">#${m.id} — ${m.mode} on ${m.map}</div><div class="muted">${fmtDate(m.date)} • ${m.duration_min} min</div></div></div><div style="text-align:right"><div style="font-weight:600">${m.kills} / ${m.deaths} / ${m.assists}</div><div class="muted">${m.accuracy}% • ${m.score} pts ${m.mvp?' • MVP':''}</div></div>`;
      item.addEventListener("click", ()=> {
        alert(`Match #${m.id}\nMap: ${m.map}\nMode: ${m.mode}\nScore: ${m.score}\nKills: ${m.kills} • Deaths: ${m.deaths} • Assists: ${m.assists}`);
      });
      container.appendChild(item);
    });
  }

  function renderAndDrawAll(matches){
    renderSummary(matches);
    drawKillsTrend(matches);
    drawAccuracyTrend(matches);
    drawScoreImpact(matches);
    drawKDDistribution(matches);
    drawMapPerformance(matches);
    renderTimeline(matches);
    // give Plotly a bit of time then resize (mobile)
    setTimeout(()=>{ try{ ["killsTrend","accuracyTrend","scoreImpact","kdDist","mapPerf"].forEach(id=>{ const el=$(id); if(el && window.Plotly && Plotly.Plots && Plotly.Plots.resize) Plotly.Plots.resize(el); }); }catch(e){} }, 250);
  }

  // fetch static
  async function fetchMatches(){ const r = await fetch(MATCHES_JSON); if(!r.ok) throw new Error("no matches"); return r.json(); }

  // weapons gallery with video support
  async function loadWeapons(){
    try{
      const res = await fetch(WEAPONS_JSON);
      const list = res.ok ? await res.json() : [];
      const mythic = list.filter(w=>w.rarity==="mythic");
      const legend = list.filter(w=>w.rarity==="legend");
      const other = list.filter(w=>!["mythic","legend"].includes(w.rarity));
      renderGrid("mythicGrid", mythic);
      renderGrid("legendGrid", legend);
      renderBigGrid("otherGrid", other);
      window._weapons = list;
    }catch(e){
      console.warn("weapons load failed", e);
    }
  }

  function renderGrid(elId, arr){
    const container = $(elId); if(!container) return;
    container.innerHTML = "";
    const ioOptions = { root: null, rootMargin: "200px", threshold: 0.25 };
    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        const video = entry.target.querySelector("video");
        if(!video) return;
        if(entry.isIntersecting){
          video.play().catch(()=>{});
        } else {
          try{ video.pause(); video.currentTime = 0; }catch(e){}
        }
      });
    }, ioOptions);

    arr.forEach(w=>{
      const card = document.createElement("div"); card.className = "weapon-card";
      const thumb = document.createElement("div"); thumb.className = "weapon-thumb";
      const staticImg = document.createElement("img"); staticImg.src = w.img || "assets/weapons/placeholder.png"; staticImg.alt = w.name || ""; staticImg.loading = "lazy";
      thumb.appendChild(staticImg);

      if(w.video){
        const video = document.createElement("video");
        video.muted = true; video.loop = true; video.playsInline = true; video.preload = "metadata";
        if(w.poster) video.poster = w.poster;
        const src = document.createElement("source");
        src.src = w.video;
        if(/\.webm$/i.test(w.video)) src.type = "video/webm"; else if(/\.mp4$/i.test(w.video)) src.type = "video/mp4";
        video.appendChild(src);
        video.controls = false;
        video.style.width = "100%";
        video.addEventListener("loadedmetadata", ()=> card.classList.add("video-ready"));
        video.addEventListener("error", ()=> { video.remove(); card.classList.remove("video-ready"); });
        thumb.appendChild(video);
        // attempt play; will actually play when observed
        video.play().catch(()=>{});
      }

      const nameDiv = document.createElement("div"); nameDiv.className = "weapon-name"; nameDiv.textContent = w.name || "";
      const rarity = document.createElement("div"); rarity.className = "rarity-badge "+(w.rarity==="mythic"?"rarity-mythic":w.rarity==="legend"?"rarity-legend":"rarity-epic"); rarity.textContent = (w.rarity||"").toUpperCase();

      card.appendChild(thumb); card.appendChild(nameDiv); card.appendChild(rarity);
      card.addEventListener("click", ()=> openWeaponModal(w));
      container.appendChild(card);

      if(w.video) observer.observe(card);
    });
  }

  function renderBigGrid(elId, arr){
    const container = $(elId); if(!container) return;
    container.innerHTML = "";
    arr.forEach(w=>{
      const img = document.createElement("img"); img.src = w.img || "assets/weapons/placeholder.png"; img.alt = w.name || ""; img.addEventListener("click", ()=> openWeaponModal(w));
      container.appendChild(img);
    });
  }

  function openWeaponModal(w){
    const m = $("weaponModal"); if(!m) return;
    $("weaponModalImg").src = w.img || "assets/weapons/placeholder.png";
    $("weaponModalName").textContent = w.name || "";
    const rb = $("weaponModalRarity"); rb.className = "rarity-badge "+(w.rarity==="mythic"?"rarity-mythic":w.rarity==="legend"?"rarity-legend":"rarity-epic"); rb.textContent = (w.rarity||"").toUpperCase();
    $("weaponModalDesc").textContent = w.desc || "";
    m.setAttribute("aria-hidden","false");
  }

  document.addEventListener("click", (ev)=> {
    if(ev.target && (ev.target.id === "weaponModalClose" || ev.target.id === "weaponModal")) $("weaponModal").setAttribute("aria-hidden","true");
  });

  // init
  document.addEventListener("DOMContentLoaded", async ()=>{
    initProfileButtons();
    initCsvUpload();
    try{ window.currentMatches = await fetchMatches(); renderAndDrawAll(window.currentMatches); } catch(e){ console.warn("matches load failed", e); }
    await loadWeapons();
    // refresh button wiring
    $("refreshBtn")?.addEventListener("click", async ()=> {
      try{ window.currentMatches = await fetchMatches(); renderAndDrawAll(window.currentMatches); } catch(e){ alert("Failed to reload matches"); }
    });
  });

})();
