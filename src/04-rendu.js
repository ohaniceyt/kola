/* ============ Rendu ============ */
function switchTab(t){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-"+t).classList.add("active");
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on", b.dataset.tab===t));
  window.scrollTo(0,0);
  render();
}

function monthSpendByCat(){
  const month = todayISO().slice(0,7);
  const byCat = {};
  state.expenses.filter(e=>e.date.startsWith(month)).forEach(e=>byCat[e.cat]=(byCat[e.cat]||0)+e.amount);
  return byCat;
}

function renderEnvelopes(){
  const host = document.getElementById("envelopes");
  const spendByCat = monthSpendByCat();
  const rows = Object.entries(state.budgets||{}).filter(([k,v])=>+v>0 && state.cats[k]);
  rows.sort((a,b)=> (spendByCat[b[0]]||0)/+b[1] - (spendByCat[a[0]]||0)/+a[1]);
  document.getElementById("envelopes-card").style.display = rows.length ? "block" : "none";
  host.innerHTML = rows.map(([k,b])=>{
    const c = catOf(k), nb = +b, s = spendByCat[k]||0;
    const pct = nb ? Math.min(s/nb*100,100) : 0, over = s > nb;
    const rest = over ? tt("{a} de trop", {a: money(s-nb)}) : tt("{a} restants", {a: money(nb-s)});
    return `<div class="env">
      <div class="env-top">
        <span class="env-emoji" style="background:${c.color}22">${esc(c.emoji)}</span>
        <span class="env-n">${esc(c.label)}</span>
        <span class="env-nums">
          <span class="env-v ${over?"over":""}">${money(s)}</span>
          <span class="rest">/ ${money(nb)} · ${rest}</span>
        </span>
      </div>
      <div class="env-bar"><div style="width:${pct}%;background:${over?"var(--red)":c.color}"></div></div>
    </div>`;
  }).join("");
  rows.forEach(([k], i)=>{
    const el = host.children[i].querySelector(".env-v");
    animateNumber(el, "env:" + k + ":" + state.currency, spendByCat[k]||0, money);
  });
}

function postponeBackup(){
  const d = new Date(); d.setDate(d.getDate()+3);
  state.lastBackupAt = state.lastBackupAt ? todayISO() : "";   // neutralise le rappel 3 jours
  state.backupPostponedAt = ymd(d); save(); render();
  toast("On te rappelle dans 3 jours");
}
function prevMonthKey(){
  const t = new Date();
  return ymd(new Date(t.getFullYear(), t.getMonth()-1, 1)).slice(0,7);
}
function backupReminder(){
  const card = document.getElementById("backup-card");
  const n = state.expenses.length;
  if (!n){ card.style.display = "none"; return; }
  const changed = state.lastChangeAt || "";
  const backed = state.lastBackupAt || "";
  const postponed = state.backupPostponedAt || "";
  const today = todayISO();
  const paused = postponed && postponed > today;
  if (paused){ card.style.display = "none"; return; }
  // Bandeau mensuel : dans les 7 premiers jours du mois, proposer d'archiver le mois précédent
  const pmKey = prevMonthKey();
  const prevCount = state.expenses.filter(e=>e.date.startsWith(pmKey)).length;
  const monthly = new Date().getDate() <= 7 && prevCount > 0 && state.lastMonthlyBackup !== pmKey;
  if (monthly){
    const pmLabel = new Date(pmKey+"T12:00:00").toLocaleDateString(I18N_LOCALE(),{month:"long", year:"numeric"});
    const pmShort = LANG==="en" ? pmLabel.replace(/^(\w+).*/, "$1") : pmLabel.split(" ")[0];
    card.style.display = "block";
    document.getElementById("bk-title").textContent = tt("📊 Fin de {m} — sauvegarde du mois", {m: pmShort});
    document.getElementById("bk-sub").textContent =
      tt("{n} dépense(s) en {m} : archive-les dans un fichier JSON avant de tourner la page", {n: prevCount, m: pmLabel});
    return;
  }
  // Rappel hebdomadaire (comportement historique)
  const since = backed ? Math.floor((new Date(today+"T12:00:00") - new Date(backed+"T12:00:00"))/DAY) : 999;
  const stale = !backed || (changed && changed > backed) || since > 7;
  if (stale){
    card.style.display = "block";
    document.getElementById("bk-title").textContent = t("💾 Sauvegarde conseillée");
    document.getElementById("bk-sub").textContent = backed
      ? tt("Dernière sauvegarde : il y a {n} jour{p}", {n: since, p: since>1 ? "s" : ""})
      : t("Aucune sauvegarde depuis la création — ton historique mérite un fichier");
  } else card.style.display = "none";
}
/* --- Compteurs animés (version douce : uniquement quand la valeur change) --- */
const __numPrev = new Map();   // clé → dernière valeur affichée (null = jamais affichée)
function animateNumber(el, key, to, fmt){
  if (!el) return;
  const hasPrev = __numPrev.has(key);
  const from = hasPrev ? __numPrev.get(key) : to;
  __numPrev.set(key, to);
  if (from === to || !hasPrev){ el.textContent = fmt(to); return; }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches){ el.textContent = fmt(to); return; }
  const t0 = performance.now(), DUR = 700, ease = t => 1 - Math.pow(1-t, 3);
  const frame = now => {
    const pt = Math.min((now - t0)/DUR, 1);
    el.textContent = fmt(from + (to - from)*ease(pt));
    if (pt < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function renderHome(){
  // Livre de type « dettes » : l'accueil bascule sur le suivi des dettes
  const dettes = state.kind === "dettes";
  ["couple-summary","envelopes-card","goals-card","repart-card"].forEach(id=>{
    const el = document.getElementById(id); if (el) el.style.display = dettes ? "none" : "";
  });
  const hmw = document.getElementById("hero-me-w"); if (hmw) hmw.style.display = dettes ? "" : "none";
  // Mini héros dettes/créances (livres dépenses seulement) : chaque sens sa ligne, jamais de net
  const mini = document.getElementById("hero-mini-w");
  if (mini){
    if (!dettes && state.debts.length){
      const tlD = debtTotals(state.debts);
      mini.style.display = "";
      animateNumber(document.getElementById("mini-dois"), "mini-dois:" + state.currency, tlD.dois, money);
      animateNumber(document.getElementById("mini-me"), "mini-me:" + state.currency, tlD.me, money);
      document.getElementById("mini-dois-bar").firstElementChild.style.width = (tlD.dois ? tlD.pctDois : 100) + "%";
      document.getElementById("mini-me-bar").firstElementChild.style.width = (tlD.me ? tlD.pctMe : 100) + "%";
    } else mini.style.display = "none";
  }
  const rh = document.getElementById("recent-header"), dc = document.getElementById("dettes-card");
  if (rh) rh.style.display = dettes ? "none" : "";
  if (dc) dc.style.display = "";   // visible dans les deux types : héros dettes et/ou carte (le rendu diffère)
  if (dettes){ backupReminder(); renderDettesHome(); return; }
  const month = todayISO().slice(0,7);
  const spent = state.expenses.filter(e=>e.date.startsWith(month)).reduce((s,e)=>s+e.amount,0);
  const bud = catBudgetTotal() || state.budget;
  const labelEl = document.getElementById("hero-label");
  const barWrap = document.getElementById("hero-bar");
  if (bud > 0){
    const remaining = bud - spent;
    const pct = Math.min(spent/bud*100,100);
    labelEl.textContent = "Solde mensuel restant";
    animateNumber(document.getElementById("hero-remaining"), "hero-rem", Math.max(remaining,0), money);
    document.getElementById("hero-spent").textContent = tt("Dépensé ce mois : {a} · Budget {b}", {a: money(spent), b: money(bud)});
    document.getElementById("hero-bar").firstElementChild.style.width = pct+"%";
    document.getElementById("hero-bar").firstElementChild.style.background = remaining<0 ? "var(--red)" : "#fff";
    barWrap.style.visibility = "visible";
  } else {
    labelEl.textContent = "Dépensé ce mois";
    animateNumber(document.getElementById("hero-remaining"), "hero-sp", spent, money);
    document.getElementById("hero-spent").textContent = "Aucun budget défini — ajoute-le dans Réglages quand tu veux";
    document.getElementById("hero-bar").firstElementChild.style.width = "100%";
    document.getElementById("hero-bar").firstElementChild.style.background = "rgba(255,255,255,.22)";
  }

  backupReminder();
  renderCoupleCard();
  drawDonut("donut","legend",monthSpendByCat());
  renderEnvelopes();
  renderGoals();
  renderDettesCard();
  renderList("recent-list", [...state.expenses].sort(byRecent).slice(0,6), true);
}

function drawDonut(svgId, legendId, byCat){
  const svg = document.getElementById(svgId), legend = document.getElementById(legendId);
  const total = Object.values(byCat).reduce((s,v)=>s+v,0);
  svg.innerHTML = "";
  legend.innerHTML = "";
  if (!total) { svg.innerHTML='<circle cx="60" cy="60" r="46" fill="none" stroke="var(--fill)" stroke-width="14"/><text x="60" y="64" text-anchor="middle" font-size="11" fill="var(--secondary-label)">Vide</text>'; return; }
  const NS="http://www.w3.org/2000/svg"; let angle=-90;
  const sorted = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  sorted.forEach(([ck,v])=>{
    const c = catOf(ck);
    const frac=v/total, a0=angle*Math.PI/180, a1=(angle+frac*360-1.2)*Math.PI/180; angle+=frac*360;
    const large = frac*360>180?1:0;
    const x0=60+46*Math.cos(a0), y0=60+46*Math.sin(a0), x1=60+46*Math.cos(a1), y1=60+46*Math.sin(a1);
    const p=document.createElementNS(NS,"path");
    p.setAttribute("d",`M ${x0} ${y0} A 46 46 0 ${large} 1 ${x1} ${y1}`);
    p.setAttribute("fill","none"); p.setAttribute("stroke",c.color); p.setAttribute("stroke-width","14"); p.setAttribute("stroke-linecap","round");
    svg.appendChild(p);
    const row=document.createElement("div"); row.className="row";
    const mode = state.legendMode || "amt";   // "amt" ou "pct" — jamais les deux à la fois
    row.innerHTML=`<div class="dot" style="background:${c.color}"></div>${esc(c.label)}<div class="val">${mode==="pct" ? Math.round(frac*100)+"%" : money(v)}</div>`;
    legend.appendChild(row);
  });
}

function emptyState(icon, title, sub){
  return `<div class="empty-state"><div class="ico">${icon}</div><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
}
/* Ordre canonique « du plus récent au plus ancien » : date, puis ts (saisie intra-jour), puis id.
   Tolérant aux entrées anormales (null, date manquante) : une donnée corrompue doit bloquer l'app. */
function byRecent(a,b){
  const da = String((a || {}).date || ""), db = String((b || {}).date || "");
  return db.localeCompare(da)
      || ((b || {}).ts || 0) - ((a || {}).ts || 0)
      || String((b || {}).id || "").localeCompare(String((a || {}).id || ""));
}
function renderList(elId, items, compact, emptyMsg){
  const host = document.getElementById(elId);
  const groups = {};
  items.forEach(e=>{ (groups[e.date] = groups[e.date]||[]).push(e); });
  let html = "";
  const dates = Object.keys(groups).sort().reverse();
  if (!dates.length){
    host.innerHTML = emptyMsg || emptyState("📤", t("Aucune dépense pour le moment."), t("Tape ＋ pour en ajouter une."));
    return;
  }
  if (compact){
    const g = document.createElement("div"); g.className="group";
    groups[dates[0]] = groups[dates[0]];
    const flat=[]; dates.slice(0,2).forEach(d=>groups[d].forEach(e=>flat.push(e)));
    host.innerHTML = ""; host.appendChild(g);
    flat.forEach((e,idx)=>{
      const c=catOf(e.cat);
      const r=document.createElement("div"); r.className="rowitem";
      r.setAttribute("role","button"); r.tabIndex=0;
      r.setAttribute("aria-label", tt("Dépense : {a}, {b}", {a: e.name, b: money(e.amount)}));
      r.innerHTML=`<div class="icon-badge" style="background:${c.color}22">${esc(c.emoji)}</div>
        <div class="txt"><div class="n">${esc(e.name)}</div><div class="d">${esc(c.label)} · ${dayName(e.date)}${whoShort(e) ? ` · ${esc(whoShort(e))}` : ""}</div></div>
        <div class="amt">-${money(e.amount)}</div>`;
      r.onclick=()=>openEdit(e.id);
      g.appendChild(r);
    });
  } else {
    dates.forEach(d=>{
      const day = groups[d];
      const tot = day.reduce((s,e)=>s+e.amount,0);
      html += `<div class="list-header"><span class="t" style="font-size:15px;color:var(--secondary-label);text-transform:capitalize">${dayName(d)}</span><span style="font-size:13px;color:var(--secondary-label);font-weight:600">${money(tot)}</span></div>`;
      html += `<div class="group">`;
      day.sort((a,b)=> (b.ts||0)-(a.ts||0) || b.id.localeCompare(a.id)).forEach(e=>{
        const c=catOf(e.cat);
        html += `<div class="rowitem" data-id="${e.id}" role="button" tabindex="0" aria-label="${esc(tt("Dépense : {a}, {b}", {a: e.name, b: money(e.amount)}))}">
          <div class="icon-badge" style="background:${c.color}22">${esc(c.emoji)}</div>
          <div class="txt"><div class="n">${esc(e.name)}</div><div class="d">${esc(c.label)}${whoShort(e) ? ` · ${esc(whoShort(e))}` : ""}</div></div>
          <div class="amt">-${money(e.amount)}</div></div>`;
      });
      html += `</div>`;
    });
    host.innerHTML = html;
    host.querySelectorAll(".rowitem").forEach(r=>r.onclick=()=>openEdit(r.dataset.id));
  }
}

