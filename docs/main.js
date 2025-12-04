// main.js — full app wiring (profile, weapons, dashboard)
(function(){
  // helpers
  const $ = id => document.getElementById(id);
  function toNum(v, f=0){ if (v==null||v==="") return f; const n=Number(String(v).replace(/[^0-9.\-]/g,"")); return Number.isFinite(n)?n:f;}
  function toBool(v){ if(typeof v==="boolean") return v; if(!v) return false; const s=String(v).trim().toLowerCase(); return ["1","true","yes","y"].includes(s); }
  function fmtDate(iso){ const d=new Date(iso); return isNaN(d)?iso:d.toLocaleDateString(); }

  // sample data locations
  const MATCHES_JSON = "data/matches.json";
  const WEAPONS_JSON = "data/weapons.json";

  // --------- profile buttons behavior ----------
  function initProfileButtons(){
    const btnOverview = $("btnOverview"), btnMatches = $("btnMatches"), btnPlans = $("btnPlans");
    if(btnOverview) btnOverview.addEventListener("click", ()=> { window.scrollTo({top:0,behavior:"smooth"}) });
    if(btnMatches) btnMatches.addEventListener("click", ()=> { $("timeline") && $("timeline").scrollIntoView({behavior:"smooth",block:"center"}) });
    if(btnPlans) btnPlans.addEventListener("click", async ()=>{
      // render dashboard (prefer currently loaded CSV -> window.currentMatches)
      let matches = window.currentMatches;
      if(!matches){
        try{ const r = await fetch(MATCHES_JSON); if(r.ok) matches = await r.json(); }catch(e){ matches = []; }
      }
      renderAndDrawAll(matches || []);
      $("dashboardSection").scrollIntoView({behavior:"smooth", block:"start"});
      // optionally collapse hero visually
      const hero = document.getElementById("hero"); if(hero) hero.classList.add("collapsed");
    });
  }

  // --------- CSV upload wiring ----------
  function initCsvUpload(){
    const uploadBtn = $("uploadBtn"), csvFile = $("csvFile");
    if(!uploadBtn || !csvFile || typeof Papa === "undefined") return;
    uploadBtn.addEventListener("click", ()=> csvFile.click());
    csvFile.addEventListener("change", (ev)=>{
      const file = ev.target.files && ev.target.files[0]; if(!file) return;
      Papa.parse(file, { header:true, skipEmptyLines:true,
        complete:function(results){
          const baseDate = new Date();
          const parsed = results.data.map((r,i)=> mapRowToMatch(r,i,baseDate));
          window.currentMatches = parsed;
          renderAndDrawAll(parsed);
        },
        error:function(err){ alert("CSV parse failed: "+err.message) }
      });
    });
  }

  // --------- map raw csv row to match object ----------
  function mapRowToMatch(r,i,baseDate){
    const id = r.match||r.Match||r.id||r.ID|| (i+1);
    const dateRaw = r.date||r.Date||null;
    let iso;
    if(dateRaw){ const d=new Date(dateRaw); iso = isNaN(d)? new Date(baseDate.getTime()-i*24*3600*1000).toISOString() : d.toISOString(); }
    else iso = new Date(baseDate.getTime()-i*24*3600*1000).toISOString();
    const map = r.map||r.Map||"Unknown"; const mode = r.mode||r.Mode||"Multiplayer";
    const result = r.result||r.Result||"";
    return {
      id: id,
      date: iso,
      map: map,
      mode: mode,
      result: result,
      score: toNum(r.score||r.Score||0),
      kills: toNum(r.kills||r.Kills||0),
      deaths: toNum(r.deaths||r.Deaths||0),
      assists: toNum(r.assists||r.Assists||0),
      impact: toNum(r.impact||r.Impact||0),
      accuracy: toNum(r.accuracy||r.Accuracy||0),
      duration_min: toNum(r.duration_min||r.Duration||15),
      mvp: toBool(r.mvp||r.MVP||""),
      win: /win/i.test(String(result))
    };
  }

  // --------- visualizations (same as earlier) ----------
  function renderSummary(matches){
    const container = $("summary"); if(!container) return;
    container.innerHTML="";
    const total = matches.length||0;
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
      const el=document.createElement("div"); el.className="card summary-item"; el.innerHTML=`<div class="title">${c.title}</div><div class="value">${c.value}</div>`; container.appendChild(el);
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
      item.addEventListener("click", ()=> openMatchModal(m));
      container.appendChild(item);
    });
  }

  // simple alert-based details (we'll add modal for matches later if you want)
  function openMatchModal(m){ alert(`Match #${m.id}\nMap: ${m.map}\nMode: ${m.mode}\nScore: ${m.score}\nKills: ${m.kills} • Deaths: ${m.deaths} • Assists: ${m.assists}`); }

  function renderAndDrawAll(matches){
    renderSummary(matches);
    drawKillsTrend(matches);
    drawAccuracyTrend(matches);
    drawScoreImpact(matches);
    drawKDDistribution(matches);
    drawMapPerformance(matches);
    renderTimeline(matches);
    // ensure plotly resizes (mobile)
    setTimeout(resizeAllPlots, 200);
  }

  // resize helper for plotly
  function resizeAllPlots(){ try{ ["killsTrend","accuracyTrend","scoreImpact","kdDist","mapPerf"].forEach(id=>{ const el=$(id); if(el && window.Plotly && Plotly.Plots && Plotly.Plots.resize) Plotly.Plots.resize(el); }); }catch(e){console.warn(e)} }
  window.addEventListener("resize", ()=> { clearTimeout(window._resizeTO); window._resizeTO = setTimeout(resizeAllPlots, 180); });
  window.addEventListener("orientationchange", ()=> setTimeout(resizeAllPlots, 250));

  // fetch static matches
  async function fetchMatches(){
    const r = await fetch(MATCHES_JSON);
    if(!r.ok) throw new Error("no matches json");
    return r.json();
  }

  // csv/upload/export wiring
  function initCsvAndExport(){
    const up = $("uploadBtn"), cf = $("csvFile");
    if(up && cf && window.Papa){ up.addEventListener("click", ()=> cf.click()); cf.addEventListener("change", (ev)=>{ const f = ev.target.files&&ev.target.files[0]; if(!f) return; Papa.parse(f,{header:true,skipEmptyLines:true,complete:function(res){ const parsed = res.data.map((r,i)=> mapRowToMatch(r,i,new Date())); window.currentMatches = parsed; renderAndDrawAll(parsed); }, error:function(e){ alert("CSV parse error: "+e.message)} });}); }
    // refresh button
    const ref = $("refreshBtn"); if(ref) ref.addEventListener("click", async ()=> { try{ const matches = await fetchMatches(); window.currentMatches = matches; renderAndDrawAll(matches); }catch(e){ alert("load failed: "+e.message); } });
    // export
    const btnExport = document.querySelector(".profile-right .btn-small") || null;
    if(btnExport){
      btnExport.addEventListener("click", ()=> {
        const matches = window.currentMatches || [];
        if(!matches.length) return alert("No matches loaded");
        const headers = Object.keys(matches[0]); const rows = matches.map(m=> headers.map(h=> { const v = m[h]; return (typeof v==="string" && v.includes(",")) ? `"${v.replace(/"/g,'""')}"` : String(v ?? ""); }).join(","));
        const csv = [headers.join(",")].concat(rows).join("\n");
        const blob = new Blob([csv],{type:"text/csv"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="matches_export.csv"; a.click(); URL.revokeObjectURL(url);
      });
    }
  }

  // --------- weapons gallery ----------
  async function loadWeapons(){
    try{
      const res = await fetch(WEAPONS_JSON);
      const list = res.ok ? await res.json() : defaultWeapons();
      // split by rarity to the two grids and others
      const mythic = list.filter(w=>w.rarity==="mythic");
      const legend = list.filter(w=>w.rarity==="legend");
      const other = list.filter(w=>!["mythic","legend"].includes(w.rarity));
      renderGrid("mythicGrid", mythic);
      renderGrid("legendGrid", legend);
      renderBigGrid("otherGrid", other);
      window._weapons = list;
    }catch(e){ console.warn("weapons load",e); const d = defaultWeapons(); renderGrid("mythicGrid",d); renderGrid("legendGrid",d); renderBigGrid("otherGrid",d); window._weapons=d; }
  }
  function defaultWeapons(){ return [
      {id:"bp50",name:"BP50 - Ion Eruption",rarity:"mythic",img:"assets/weapons/bp50.jpg",desc:"Mythic short-range beast"},
      {id:"ak117",name:"AK117 - Lava Remix",rarity:"legend",img:"assets/weapons/ak117.jpg",desc:"Legend AR"},
      {id:"qq9",name:"QQ9 - Dual Kinetics",rarity:"legend",img:"assets/weapons/qq9.jpg",desc:"SMG"}
  ]; }
  function renderGrid(elId, arr){
    const el = $(elId); if(!el) return; el.innerHTML="";
    arr.forEach(w=>{
      const card = document.createElement("div"); card.className="weapon-card";
      card.innerHTML = `<div class="weapon-thumb"><img src="${w.img}" alt="${w.name}" /></div><div class="weapon-name">${w.name}</div><div class="rarity-badge ${w.rarity==='mythic'?'rarity-mythic':w.rarity==='legend'?'rarity-legend':'rarity-epic'}">${(w.rarity||"").toUpperCase()}</div>`;
      const img = card.querySelector("img");
      img.addEventListener("load", ()=> card.classList.add("img-loaded"));
      img.addEventListener("error", ()=> { img.src="assets/weapons/placeholder.png"; card.classList.add("img-loaded"); });
      card.addEventListener("click", ()=> openWeaponModal(w));
      el.appendChild(card);
    });
  }
  function renderBigGrid(elId, arr){
    const el = $(elId); if(!el) return; el.innerHTML="";
    arr.forEach(w=>{
      const img = document.createElement("img"); img.src = w.img; img.alt = w.name; img.onerror = ()=> img.src="assets/weapons/placeholder.png"; img.addEventListener("click", ()=> openWeaponModal(w)); el.appendChild(img);
    });
  }
  // modal open/close
  function openWeaponModal(w){
    const m = $("weaponModal"); if(!m) return; $("weaponModalImg").src = w.img || "assets/weapons/placeholder.png"; $("weaponModalName").textContent = w.name; const rb = $("weaponModalRarity"); rb.className = "rarity-badge "+(w.rarity==="mythic"?"rarity-mythic":w.rarity==="legend"?"rarity-legend":"rarity-epic"); rb.textContent = (w.rarity||"").toUpperCase(); $("weaponModalDesc").textContent = w.desc||""; m.setAttribute("aria-hidden","false");
  }
  document.addEventListener("click", (ev)=> { if(ev.target && ev.target.id==="weaponModalClose") $("weaponModal").setAttribute("aria-hidden","true"); if(ev.target && ev.target.id==="weaponModal") $("weaponModal").setAttribute("aria-hidden","true"); });

  // on load
  document.addEventListener("DOMContentLoaded", async ()=>{
    initProfileButtons(); initCsvAndExport(); initCsvUpload(); initCsvAndExport(); await loadWeapons();
    // try to load static matches
    try{ const matches = await fetch(MATCHES_JSON); window.currentMatches = matches; renderAndDrawAll(matches); } catch(e){ console.warn("matches load failed",e); }
  });

})();
