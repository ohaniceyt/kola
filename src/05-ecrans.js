/* ============ Stats / Historique ============ */
function weekBounds(offset){
  const t = new Date();
  const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (t.getDay()+6)%7);
  monday.setDate(monday.getDate() + offset*7);
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
  return [ymd(monday), ymd(sunday)];
}
function renderStats(period){
  if (state.kind === "dettes") return renderStatsDettes();
  // Restaure l'habillage dépenses (peut avoir été masqué en livre dettes)
  const segEl = document.getElementById("stat-seg"); if (segEl) segEl.style.display = "";
  const st = document.getElementById("stats-sub"); if (st) st.textContent = t("Analyse de tes dépenses");
  ["donut2-card","bars-card","compare-card"].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = "";
  });
  renderStatsLedger(period);
}
function renderStatsLedger(period){
  const now = new Date();
  let items;
  if (period==="month"){ items = state.expenses.filter(e=>e.date.startsWith(todayISO().slice(0,7))); }
  else if (period==="w"){
    const [s, e2] = weekBounds(0);
    items = state.expenses.filter(e=>e.date>=s && e.date<=e2);
  }
  else {
    const y = now.getFullYear();
    const start = new Date(y,0,1), end = new Date(y,11,31,23,59);
    items = state.expenses.filter(e=>{ const d=new Date(e.date+"T12:00:00"); return d>=start && d<=end; });
  }
  const total = items.reduce((s,e)=>s+e.amount,0);
  const lbl = period==="month" ? "Total du mois" : period==="w" ? "Total de la semaine" : "Total de l'année";
  const days = period==="month" ? new Date().getDate()
    : period==="w" ? Math.min(((now.getDay()+6)%7)+1, 7)
    : Math.ceil((now-new Date(now.getFullYear(),0,1))/DAY);
  const avg = total/Math.max(days,1);
  const maxT = Math.max(...items.map(e=>e.amount),0);
  if (!items.length){
    document.getElementById("stat-grid").innerHTML =
      `<div class="stat" style="grid-column:1/-1;padding:26px 16px">${emptyState("📊", t("Pas encore de statistiques"), t("Ajoute ta première dépense — Kola dessinera tes stats ici."))}</div>`;
    drawDonut("donut2","legend2",{});
    document.getElementById("bars").closest(".card").style.display = "none";
    document.getElementById("compare-card").style.display = "none";
    return;
  }
  document.getElementById("bars").closest(".card").style.display = "";
  document.getElementById("stat-grid").innerHTML = `
    <div class="stat"><div class="sv">${money(total)}</div><div class="sl">${t(lbl)}</div></div>
    <div class="stat"><div class="sv">${money(avg)}</div><div class="sl">Moyenne / jour</div></div>
    <div class="stat"><div class="sv">${items.length}</div><div class="sl">Transactions</div></div>
    <div class="stat"><div class="sv">${money(maxT)}</div><div class="sl">Plus grosse dépense</div></div>
    <div class="stat"><div class="sv">${enterStreak()} <span role="img" aria-label="série">🔥</span></div><div class="sl">Série de saisie (jours)</div></div>
    <div class="stat"><div class="sv">${(state.goals||[]).filter(g=>g.target<=g.saved).length}/${(state.goals||[]).length}</div><div class="sl">Objectifs atteints</div></div>`;
  const byCat={}; items.forEach(e=>byCat[e.cat]=(byCat[e.cat]||0)+e.amount);
  drawDonut("donut2","legend2",byCat);

  // 6 derniers mois
  const mm=[];
  for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); const key=ymd(d).slice(0,7);
    mm.push({key, label:d.toLocaleDateString(I18N_LOCALE(),{month:'short'}), v: state.expenses.filter(e=>e.date.startsWith(key)).reduce((s,e)=>s+e.amount,0)}); }
  const mMax=Math.max(...mm.map(m=>m.v),1);
  document.getElementById("bars").innerHTML = mm.map((m,i)=>
    `<div class="col"><div class="stick ${i===mm.length-1?"":"other"}" style="height:${Math.max(m.v/mMax*100,3)}%"></div><div class="ml">${m.label}</div></div>`).join("");
}

/* Livre dettes : statistiques orientées dettes/créances (jamais dépenses, jamais de net) */
function renderStatsDettes(){
  const segEl = document.getElementById("stat-seg"); if (segEl) segEl.style.display = "none";
  const st = document.getElementById("stats-sub"); if (st) st.textContent = t("Analyse de tes dettes et créances");
  ["donut2-card","bars-card","compare-card"].forEach(id => document.getElementById(id).style.display = "none");
  const tl = debtTotals(state.debts);
  const nb = state.debts.length;
  const settled = state.debts.filter(d => debtRemain(d) <= 0).length;
  document.getElementById("stat-grid").innerHTML = `
    <div class="stat"><div class="sv">${money(tl.dois)}</div><div class="sl">${t("💸 Je dois")}</div></div>
    <div class="stat"><div class="sv">${money(tl.me)}</div><div class="sl">${t("🤝 On me doit")}</div></div>
    <div class="stat"><div class="sv">${money(tl.paidDois)}</div><div class="sl">${t("Remboursé")}</div></div>
    <div class="stat"><div class="sv">${money(tl.paidMe)}</div><div class="sl">${t("Encaissé")}</div></div>
    <div class="stat"><div class="sv">${tl.pct} %</div><div class="sl">${t("Remboursement global")}</div></div>
    <div class="stat"><div class="sv">${nb}</div><div class="sl">${t("Notées au total")}</div></div>
    <div class="stat"><div class="sv">${settled}/${nb}</div><div class="sl">${t("Soldées")}</div></div>`;
}
function renderHistory(){ applyHistoryFilter(); }

/* ============ Sheet ============ */
let pickedCat = "food";
function renderCatGrid(){
  if(!state.cats[pickedCat]) pickedCat = Object.keys(state.cats)[0] || "other";
  const grid=document.getElementById("cat-grid");
  grid.innerHTML = Object.entries(state.cats).map(([k,c])=>
    `<button class="cat ${k===pickedCat?"on":""}" data-k="${k}">${esc(c.emoji)} ${esc(c.label)}</button>`).join("") +
    `<button class="cat new" onclick="closeSheet(); openCatSheet()">${t("＋ Nouvelle")}</button>`;
  grid.querySelectorAll(".cat[data-k]").forEach(b=>b.onclick=()=>{
    pickedCat=b.dataset.k;
    grid.querySelectorAll(".cat[data-k]").forEach(x=>x.classList.toggle("on",x.dataset.k===pickedCat));
  });
}
function openSheet(){
  if (state.kind === "dettes"){ openDebtSheet(); return; }
  document.getElementById("sheet-cur").textContent = state.currency;
  selectedChipCat = null;
  pickedWho = "me";
  renderWhoSeg();
  renderQuickChips();
  renderCatGrid();
  document.getElementById("in-amount").value = "";
  syncKpDisplay();
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("sheet").classList.add("show"); syncScrollLock();
  if (!KP_TOUCH) setTimeout(()=>document.getElementById("in-amount").focus(), 460);
}
function closeSheet(){
  document.getElementById("sheet").classList.remove("show");
  document.getElementById("overlay").classList.remove("show"); syncScrollLock();
  document.getElementById("in-amount").value=""; document.getElementById("in-name").value="";
}
function saveExpense(){
  const a = parseAmount(document.getElementById("in-amount").value);
  const n = document.getElementById("in-name").value.trim();
  if (!a || a<=0){ toast("Entre un montant valide"); return; }
  state.expenses.push({ id: crypto.randomUUID(), name: n || catOf(pickedCat).label, cat: pickedCat,
    amount: a, date: todayISO(), ts: Date.now(),
    ...(couple().on ? { who: pickedWho } : {}) });
  save(); closeSheet(); render();
  toast("✓ Dépense ajoutée");
}
function deleteFlow(id){
  const e = state.expenses.find(x=>x.id===id); if(!e) return;
  if (confirm(tt("Supprimer « {a} » ({b}) ?", {a: e.name, b: money(e.amount)}))){
    state.expenses = state.expenses.filter(x=>x.id!==id);
    save(); render();
  }
}

/* ============ Modifier une dépense ============ */
let editId = null;
function closeEditSheet(){ document.getElementById("edit-sheet").classList.remove("show"); clearSheetOverlay(); }
function openEdit(id){
  const e = state.expenses.find(x=>x.id===id); if(!e) return;
  editId = id;
  editWho = e.who || "me";
  renderWhoSeg();
  document.getElementById("edit-cur").textContent = state.currency;
  document.getElementById("edit-amount").value = +e.amount.toFixed(2);
  document.getElementById("edit-name").value = e.name;
  document.getElementById("edit-date").value = e.date;
  const sel = document.getElementById("edit-cat");
  sel.innerHTML = Object.entries(state.cats).map(([k,c])=>
    `<option value="${k}" ${k===e.cat?"selected":""}>${esc(c.emoji)} ${esc(c.label)}</option>`).join("");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("edit-sheet").classList.add("show"); syncScrollLock();
}
function saveEdit(){
  const e = state.expenses.find(x=>x.id===editId); if(!e) return;
  const a = parseAmount(document.getElementById("edit-amount").value);
  if (!a || a <= 0){ toast("Entre un montant valide"); return; }
  const cat = document.getElementById("edit-cat").value;
  const date = document.getElementById("edit-date").value;
  e.amount = a;
  e.name = document.getElementById("edit-name").value.trim() || catOf(cat).label;
  e.cat = cat;
  if (couple().on) e.who = editWho;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = date;
  save(); clearSheetOverlay(); closeEditSheet(); render();
  toast("✓ Modifiée");
}
function deleteFromEdit(){
  const id = editId;
  closeEditSheet();
  clearSheetOverlay();
  deleteFlow(id);
}
function duplicateFromEdit(){
  const e = state.expenses.find(x=>x.id===editId); if(!e) return;
  const a = parseAmount(document.getElementById("edit-amount").value) || +e.amount;
  const cat = document.getElementById("edit-cat").value;
  const name = document.getElementById("edit-name").value.trim() || catOf(cat).label;
  state.expenses.push({ id:crypto.randomUUID(), name, cat, amount:a, date:todayISO(), ts:Date.now() });
  save(); clearSheetOverlay(); closeEditSheet(); render();
  toast("＋ Dupliquée pour aujourd'hui");
}
function clearSheetOverlay(){
  document.getElementById("overlay").classList.remove("show"); syncScrollLock();
}
function closeAllSheets(){
  closeSheet(); closeCatSheet(); closeRecSheet(); closeGoalSheets(); closeEditSheet(); closeEditCatSheet(); closeDelCatSheet(); closeLangSheet(); closeBackupSheet(); closeDeviceSheet(); closeEveningSheet(); closeOcrSheet(); closeCoupleSheet(); pairClose(); closeExportSheet();
  closeBookSheet(); closeThemeSheet(); closeAutoSheet(); closeLegalSheet(); closeDebtSheet();
  closeOpenSwipe();
  clearSheetOverlay();
}

/* ============ Gestion des catégories ============ */
const EMOJIS = ['🍔','🚕','🛍️','🏠','🎬','💊','📦','✈️','⚽','📚','🐾','🎁','☕','💡','📱','🎓','🚗','🏥','💼','🎮','🍰','🧾','✂️','🎵'];
const COLORS = ['#007aff','#34c759','#ff9500','#ff3b30','#af52de','#ff2d55','#5ac8fa','#5856d6','#ffcc00','#8e8e93'];
let newEmoji = '📦', newColor = COLORS[0];

function renderHistFilter(){
  const seg = document.getElementById("hist-filter");
  if (state.kind === "dettes"){
    // Livre dettes : filtres Tout / Je dois / On me doit / Remboursements
    let cur = seg.dataset.c || "all";
    if (!["all","dois","me","pays"].includes(cur)) cur = "all";
    seg.dataset.c = cur;
    seg.innerHTML = [["all", t("Tout")], ["dois", "💸 " + t("Je dois")], ["me", "🤝 " + t("On me doit")], ["pays", "🔁 " + t("Remboursements")]]
      .map(([k,l]) => `<button class="${k===cur?'on':''}" data-c="${k}">${esc(l)}</button>`).join("");
    return;
  }
  let cur = seg.dataset.c || "all";
  if (cur !== "all" && !state.cats[cur]) cur = "all";
  seg.dataset.c = cur;
  seg.innerHTML = `<button class="${cur==='all'?'on':''}" data-c="all">Tout</button>` +
    Object.entries(state.cats).map(([k,c]) =>
      `<button class="${k===cur?'on':''}" data-c="${k}">${esc(c.emoji)}</button>`).join("");
}

function renderCats(){
  const host = document.getElementById("cat-manage");
  host.innerHTML = "";
  openSwipe = null;
  Object.entries(state.cats).forEach(([k,c])=>{
    const count = state.expenses.filter(e=>e.cat===k).length;
    // swipe iOS : à droite = Modifier, à gauche = Supprimer
    const wrap = document.createElement("div"); wrap.className = "swipe-wrap";
    wrap.innerHTML = `
      <div class="swipe-actions" style="left:0"><button class="sw-btn edit" aria-label="${esc(t("Modifier la catégorie"))}">✏️<span>Modifier</span></button></div>
      <div class="swipe-actions" style="right:0"><button class="sw-btn del" aria-label="${esc(t("Supprimer la catégorie"))}">🗑️<span>Supprimer</span></button></div>`;
    const front = document.createElement("div"); front.className = "swipe-front setrow";
    front.setAttribute("role","button"); front.tabIndex = 0;
    front.setAttribute("aria-label", tt(`Catégorie {a}, {b}, glisse à droite pour modifier, à gauche pour supprimer`, {a: c.label, b: count===1 ? t("1 dépense") : tt("{n} dépense(s)", {n: count})}));
    front.innerHTML = `<div class="icon-badge" style="background:${c.color}22">${esc(c.emoji)}</div>
      <div class="n">${esc(c.label)}<span style="font-size:12px;color:var(--secondary-label);margin-left:7px">${count===1 ? t("1 dépense") : tt("{n} dépense(s)", {n: count})}</span></div>`;
    front.onclick = () => { if (openSwipe){ closeOpenSwipe(); return; } openEditCat(k); };
    front.onkeydown = e => { if (e.key==="Enter" || e.key===" "){ e.preventDefault(); openEditCat(k); } };
    attachSwipe(wrap, front, ()=>openEditCat(k), ()=>deleteCat(k));
    wrap.appendChild(front);
    host.appendChild(wrap);
  });
  const add = document.createElement("div"); add.className = "setrow";
  add.setAttribute("role","button"); add.tabIndex = 0;
  add.innerHTML = `<div class="icon-badge" style="background:rgba(var(--accent-rgb),.15)">➕</div>
    <div class="n" style="color:var(--link);font-weight:600">${t("Ajouter une catégorie")}</div>`;
  add.onclick = openCatSheet;
  host.appendChild(add);
}
let openSwipe = null;
function closeOpenSwipe(){
  if (openSwipe){ openSwipe(); openSwipe = null; }
}
function attachSwipe(wrap, front, onEdit, onDelete){
  const MAX = 76;
  let x0 = null, y0 = null;
  wrap.querySelector(".sw-btn.edit").onclick = e => { e.stopPropagation(); onEdit(); };
  wrap.querySelector(".sw-btn.del").onclick  = e => { e.stopPropagation(); onDelete(); };
  front.addEventListener("touchstart", e=>{
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    front.style.transition = "none";
  }, {passive:true});
  front.addEventListener("touchmove", e=>{
    if (x0===null) return;
    const t = e.touches[0];
    const dX = t.clientX - x0, dY = Math.abs(t.clientY - y0);
    if (dY > Math.abs(dX) && dY > 10){ x0 = null; front.style.transition=""; return; }  // laisse défiler
    const m = getComputedStyle(front).transform;
    const cur = (m && m !== "none") ? (new DOMMatrixReadOnly(m)).m41 : 0;
    let v = cur + dX;
    x0 = t.clientX; y0 = t.clientY;
    if (v > MAX) v = MAX + (v-MAX)*0.25;
    if (v < -MAX) v = -MAX + (v+MAX)*0.25;
    front.style.transform = `translateX(${v}px)`;
  }, {passive:true});
  front.addEventListener("touchend", ()=>{
    front.style.transition = "";
    x0 = null;
    const v = parseFloat((front.style.transform.match(/-?\d+\.?\d*/) || [0])[0]);
    const side = v > MAX*0.5 ? 1 : (v < -MAX*0.5 ? -1 : 0);
    if (openSwipe) { openSwipe(); openSwipe = null; }
    if (side){
      front.style.transform = `translateX(${side*MAX}px)`;
      openSwipe = () => { front.style.transform = ""; };
    } else {
      front.style.transform = "";
    }
  });
}

let delCatKey = null;
function deleteCat(k){
  if (Object.keys(state.cats).length <= 1){ toast("Il faut au moins une catégorie"); return; }
  const c = state.cats[k];
  const count = state.expenses.filter(e=>e.cat===k).length;
  const recCount = (state.recurring||[]).filter(r=>r.cat===k).length;
  if (!count && !recCount){
    if (!confirm(tt("Supprimer la catégorie « {a} » ?", {a: c.label}))) return;
    applyDeleteCat(k, null);
    return;
  }
  delCatKey = k;
  document.getElementById("delcat-title").textContent = tt("Supprimer « {a} » ?", {a: c.label});
  const parts = [];
  if (count) parts.push(count===1 ? t("1 dépense") : tt("{n} dépense(s)", {n: count}));
  if (recCount) parts.push(recCount===1 ? t("1 récurrence") : tt("{n} récurrence(s)", {n: recCount}));
  document.getElementById("delcat-sub").textContent = tt("{n} et {c} utilisent cette catégorie. Où les déplacer ?", {n: parts[0], c: parts[1] || ""}).trim();
  const sel = document.getElementById("delcat-target");
  sel.innerHTML = Object.entries(state.cats).filter(([key])=>key!==k).map(([key,c2])=>
    `<option value="${key}" ${key==="other"?"selected":""}>${esc(c2.emoji)} ${esc(c2.label)}</option>`).join("");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("delcat-sheet").classList.add("show"); syncScrollLock();
}
function confirmDeleteCat(){
  if (!delCatKey) return;
  const target = document.getElementById("delcat-target").value
    || Object.keys(state.cats).find(x=>x!==delCatKey);
  applyDeleteCat(delCatKey, target);
}
function applyDeleteCat(k, target){
  const c = state.cats[k];
  if (target){
    state.expenses.forEach(e=>{ if (e.cat===k) e.cat = target; });
    (state.recurring||[]).forEach(r=>{ if (r.cat===k) r.cat = target; });
  }
  delete state.cats[k];
  if (state.budgets) delete state.budgets[k];
  if (pickedCat === k) pickedCat = Object.keys(state.cats)[0] || "other";
  // l'historique filtré sur la catégorie supprimée serait vide : reset
  const histFilterEl = document.getElementById("hist-filter");
  if (histFilterEl && histFilterEl.dataset.c === k){ histFilterEl.dataset.c = "all"; }
  delCatKey = null;
  closeDelCatSheet(); clearSheetOverlay();
  save(); renderHistFilter(); renderCatGrid(); render();
  toast(target ? tt("« {a} » supprimée — tout déplacé vers « {b} »", {a: c.label, b: catOf(target).label}) : tt("« {a} » supprimée", {a: c.label}));
}
/* ============ Langue ============ */
const LANG_OPTIONS = [
  ["auto","Système"],
  ["fr","Français"],
  ["en","English"],
];
function openLangSheet(){
  const host = document.getElementById("lang-opts");
  host.innerHTML = LANG_OPTIONS.map(([v,label])=>
    `<button class="lang-opt" data-v="${v}" style="display:block;width:100%;text-align:left;padding:12px 14px;border:0;border-radius:12px;background:var(--fill);margin-top:8px;font-size:16px;font-family:inherit;color:var(--label);cursor:pointer">
      <span style="float:right;color:var(--secondary-label);font-size:13px">${(state.lang||"auto")===v ? "✓" : ""}</span>${label}</button>`).join("");
  host.querySelectorAll(".lang-opt").forEach(b=>b.onclick=()=>setLang(b.dataset.v));
  document.getElementById("lang-title").textContent = t("Langue");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("lang-sheet").classList.add("show"); syncScrollLock();
}
function closeLangSheet(){
  document.getElementById("lang-sheet").classList.remove("show");
  document.getElementById("overlay").classList.remove("show"); syncScrollLock();
}
function renderLangRow(){
  document.getElementById("lang-row-label").textContent = t("Langue");
  const cur = state.lang || "auto";
  document.getElementById("lang-current").textContent =
    cur==="auto" ? t("Système") : cur==="fr" ? "Français" : "English";
}
function setLang(v){
  state.lang = v; save();
  closeAllSheets();
  applyI18nFull();
}
function closeDelCatSheet(){
  document.getElementById("delcat-sheet").classList.remove("show");
  clearSheetOverlay();
  delCatKey = null;
}

/* Réglages : sections dépliables (chevron) */
function toggleDisclose(id, row){
  const el = document.getElementById(id);
  const open = el.style.display !== "none";
  el.style.display = open ? "none" : "";
  const chev = row && row.querySelector(".chev");
  if (chev) chev.style.transform = open ? "" : "rotate(-90deg)";
  if (row) row.setAttribute("aria-expanded", open ? "false" : "true");
}

function renderBudgets(){
  const active = Object.keys(state.budgets || {}).filter(k => +state.budgets[k] > 0 && state.cats[k]).length;
  const ec = document.getElementById("env-count");
  if (ec) ec.textContent = active || "";
  const host = document.getElementById("budgets-manage");
  host.innerHTML = "";
  Object.entries(state.cats).forEach(([k,c])=>{
    const row = document.createElement("div"); row.className = "setrow";
    row.innerHTML = `<div class="icon-badge" style="background:${c.color}22">${esc(c.emoji)}</div>
      <div class="n">${esc(c.label)}</div>
      <input class="budgets-input" type="text" inputmode="decimal" placeholder="—"
             aria-label="${esc(tt("Enveloppe mensuelle : {a}", {a: c.label}))}" data-k="${k}" value="${(+state.budgets[k]||"")}">
      <span class="v">${state.currency}</span>`;
    host.appendChild(row);
  });
  host.querySelectorAll(".budgets-input").forEach(inp=>{
    inp.addEventListener("change", ()=>{
      const k = inp.dataset.k, v = parseAmount(inp.value);
      if (v > 0) state.budgets[k] = v; else delete state.budgets[k];
      inp.value = (+state.budgets[k]||"");
      save(); toast("Enveloppe mise à jour");
    });
  });
}

function pickEmoji(e){
  newEmoji = e;
  document.querySelectorAll(".emoji-cell").forEach(b=>b.classList.toggle("on", b.textContent===e));
}
function pickColor(hex){
  newColor = hex;
  document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("on", b.dataset.c===hex));
}
function openCatSheet(){
  document.getElementById("cat-name").value = "";
  newEmoji = '📦'; newColor = COLORS[0];
  document.getElementById("emoji-grid").innerHTML =
    EMOJIS.map(e=>`<button class="emoji-cell ${e===newEmoji?'on':''}" onclick="pickEmoji('${e}')">${e}</button>`).join("");
  document.getElementById("color-grid").innerHTML =
    COLORS.map(c=>`<button class="swatch ${c===newColor?'on':''}" style="background:${c}" data-c="${c}" onclick="pickColor('${c}')"></button>`).join("");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("cat-sheet").classList.add("show"); syncScrollLock();
  setTimeout(()=>document.getElementById("cat-name").focus(), 460);
}
function closeCatSheet(){
  document.getElementById("cat-sheet").classList.remove("show");
  document.getElementById("overlay").classList.remove("show"); syncScrollLock();
}
function saveNewCat(){
  const name = document.getElementById("cat-name").value.trim();
  if (!name){ toast("Donne un nom à la catégorie"); return; }
  if (Object.values(state.cats).some(c=>c.label.toLowerCase()===name.toLowerCase())){
    toast("Cette catégorie existe déjà"); return;
  }
  const key = "c" + crypto.randomUUID().slice(0,8);
  state.cats[key] = { label: name, emoji: newEmoji, color: newColor };
  pickedCat = key;
  save(); closeCatSheet(); renderHistFilter(); render();
  toast(tt("✓ « {a} » ajoutée", {a: name}));
}

/* ============ Modifier une catégorie (swipe) ============ */
let editingCatKey = null, editEmoji = '📦', editColor = COLORS[0];
function openEditCat(k){
  const c = state.cats[k]; if(!c) return;
  editingCatKey = k; editEmoji = c.emoji; editColor = c.color;
  document.getElementById("cat-edit-name").value = c.label;
  document.getElementById("emoji-grid-e").innerHTML =
    EMOJIS.map(e=>`<button class="emoji-cell ${e===editEmoji?'on':''}" onclick="pickEditEmoji('${e}')">${e}</button>`).join("");
  document.getElementById("color-grid-e").innerHTML =
    COLORS.map(cl=>`<button class="swatch ${cl===editColor?'on':''}" style="background:${cl}" data-c="${cl}" onclick="pickEditColor('${cl}')"></button>`).join("");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("edit-cat-sheet").classList.add("show"); syncScrollLock();
  setTimeout(()=>document.getElementById("cat-edit-name").focus(), 460);
}
function pickEditEmoji(e){
  editEmoji = e;
  document.querySelectorAll("#emoji-grid-e .emoji-cell").forEach(b=>b.classList.toggle("on", b.textContent===e));
}
function pickEditColor(h){
  editColor = h;
  document.querySelectorAll("#color-grid-e .swatch").forEach(b=>b.classList.toggle("on", b.dataset.c===h));
}
function closeEditCatSheet(){
  document.getElementById("edit-cat-sheet").classList.remove("show");
  document.getElementById("overlay").classList.remove("show"); syncScrollLock();
}
function saveEditCat(){
  const c = state.cats[editingCatKey]; if(!c) return;
  const name = document.getElementById("cat-edit-name").value.trim();
  if (!name){ toast("Donne un nom à la catégorie"); return; }
  if (Object.entries(state.cats).some(([k2,c2])=>k2!==editingCatKey && c2.label.toLowerCase()===name.toLowerCase())){
    toast("Cette catégorie existe déjà"); return;
  }
  c.label = name; c.emoji = editEmoji; c.color = editColor;
  save(); closeEditCatSheet(); renderHistFilter(); render();
  toast("✓ Catégorie modifiée");
}
function deleteFromEditCat(){
  const k = editingCatKey;
  closeEditCatSheet();
  if (k) deleteCat(k);   // deleteCat gère son propre confirm + réaffectation
}
let contribGoalId = null;
function renderGoals(){
  const host = document.getElementById("goals");
  if (!(state.goals||[]).length){
    document.getElementById("goals-card").style.display = "none";
    return;
  }
  document.getElementById("goals-card").style.display = "block";
  host.innerHTML = state.goals.map(g=>{
    const pct = g.target ? Math.min(g.saved/g.target*100,100) : 0;
    const done = g.saved >= g.target;
    return `<div class="goal-row">
      <div class="goal-main" onclick="openGoalContrib('${g.id}')" role="button" tabindex="0">
        <span class="goal-name">🎯 ${esc(g.name)}</span>
        <button class="del-btn" onclick="event.stopPropagation(); deleteGoal('${g.id}')" aria-label="Supprimer l'objectif">✕</button>
        <button class="goal-add" onclick="event.stopPropagation(); openGoalContrib('${g.id}')" aria-label="Épargner">＋</button>
      </div>
      <div class="goal-val ${done?"done":""}" onclick="openGoalContrib('${g.id}')">
        <b>${money(+g.saved)}</b> / ${money(+g.target)}${done?" · atteint !":" · "+Math.round(pct)+"%"}
      </div>
      <div class="goal-bar"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
}
function openGoalSheet(){
  document.getElementById("goal-cur").textContent = state.currency;
  document.getElementById("goal-name").value = "";
  document.getElementById("goal-target").value = "";
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("goal-sheet").classList.add("show"); syncScrollLock();
  setTimeout(()=>document.getElementById("goal-name").focus(), 460);
}
function saveGoal(){
  const name = document.getElementById("goal-name").value.trim();
  const t = parseAmount(document.getElementById("goal-target").value);
  if (!name || !t || t<=0){ toast("Nom et montant cible requis"); return; }
  state.goals.push({ id:crypto.randomUUID(), name, target:t, saved:0 });
  save(); closeSheet(); closeGoalSheets(); render();
  toast(tt("🎯 Objectif « {a} » créé", {a: name}));
}
function openGoalContrib(id){
  const g = state.goals.find(x=>x.id===id); if(!g) return;
  contribGoalId = id;
  document.getElementById("goal-contrib-title").textContent = tt("Épargner · {a}", {a: g.name});
  document.getElementById("goal-contrib-cur").textContent = state.currency;
  document.getElementById("goal-contrib-amount").value = "";
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("goal-contrib-sheet").classList.add("show"); syncScrollLock();
  setTimeout(()=>document.getElementById("goal-contrib-amount").focus(), 460);
}
function closeGoalSheets(){
  document.getElementById("goal-sheet").classList.remove("show");
  document.getElementById("goal-contrib-sheet").classList.remove("show");
}
function parseContrib(){ return parseAmount(document.getElementById("goal-contrib-amount").value); }
function contributeToGoal(){
  const g = state.goals.find(x=>x.id===contribGoalId); if(!g) return;
  const v = parseContrib();
  if (v<=0){ toast("Entre un montant valide"); return; }
  g.saved += v;
  save(); closeGoalSheets();
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  const done = g.saved >= g.target;
  render();
  toast(done ? tt("🎉 Objectif « {a} » atteint !", {a: g.name}) : tt("+{a} épargnés", {a: money(v)}));
}
function withdrawFromGoal(){
  const g = state.goals.find(x=>x.id===contribGoalId); if(!g) return;
  const v = parseContrib();
  if (v<=0){ toast("Entre un montant valide"); return; }
  g.saved = Math.max(0, g.saved - v);
  save(); closeGoalSheets(); render();
  toast(tt("{a} retirés", {a: money(v)}));
}
function deleteGoal(id){
  const g = state.goals.find(x=>x.id===id); if(!g) return;
  if (!confirm(tt("Supprimer l'objectif « {a} » ?", {a: g.name}) + (g.saved>0 ? "\n(" + tt("({a} épargnés sont à remettre de côté de ton côté.)", {a: money(+g.saved)}) + ")" : ""))) return;
  state.goals = state.goals.filter(x=>x.id!==id);
  save(); render();
  toast("Objectif supprimé");
}

/* ============ Récurrences (UI) ============ */
let editRec = null;   // objet récurrence en cours d'édition (null = création)
function openRecSheet(){
  editRec = null;
  document.getElementById("rec-cur").textContent = state.currency;
  const sel = document.getElementById("rec-cat");
  sel.innerHTML = Object.entries(state.cats).map(([k,c])=>`<option value="${k}">${esc(c.emoji)} ${esc(c.label)}</option>`).join("");
  document.getElementById("rec-title").textContent = "Nouvelle récurrence";
  document.getElementById("rec-submit").textContent = "Programmer la récurrence";
  document.getElementById("rec-delete").style.display = "none";
  document.getElementById("rec-hint").style.display = "";
  document.getElementById("rec-amount").value = "";
  document.getElementById("rec-name").value = "";
  document.getElementById("rec-day").value = "";
  setRecFreq("m");
  document.getElementById("rec-day-field").style.display = "";
  document.getElementById("rec-wd-field").style.display = "none";
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("rec-sheet").classList.add("show"); syncScrollLock();
  setTimeout(()=>document.getElementById("rec-amount").focus(), 460);
}
function openRecEdit(r){
  editRec = r;
  document.getElementById("rec-cur").textContent = state.currency;
  const sel = document.getElementById("rec-cat");
  sel.innerHTML = Object.entries(state.cats).map(([k,c])=>`<option value="${k}">${esc(c.emoji)} ${esc(c.label)}</option>`).join("");
  sel.value = r.cat in state.cats ? r.cat : Object.keys(state.cats)[0];
  document.getElementById("rec-title").textContent = "Modifier la récurrence";
  document.getElementById("rec-submit").textContent = "Enregistrer les changements";
  document.getElementById("rec-delete").style.display = "";
  document.getElementById("rec-hint").style.display = "none";
  document.getElementById("rec-amount").value = +(+r.amount).toFixed(2);
  document.getElementById("rec-name").value = r.name;
  document.getElementById("rec-day").value = r.freq==="m" ? (r.day||1) : "";
  document.getElementById("rec-wd").value = String(r.wd||0);
  setRecFreq(r.freq || "m");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("rec-sheet").classList.add("show"); syncScrollLock();
}
function closeRecSheet(){
  document.getElementById("rec-sheet").classList.remove("show");
  clearSheetOverlay();
  editRec = null;
}
function deleteRecFromEdit(){
  if (!editRec) return;
  const r = editRec;
  if (!confirm(tt("Arrêter la récurrence de « {a} » ?", {a: r.name}))) return;
  const idx = state.recurring.indexOf(r);
  if (idx > -1) state.recurring.splice(idx, 1);
  save(); closeRecSheet(); clearSheetOverlay(); renderRecurring(); render();
  toast("Récurrence arrêtée");
}
function setRecFreq(f){
  document.querySelectorAll("#rec-freq button").forEach(b=>b.classList.toggle("on", b.dataset.f===f));
  document.getElementById("rec-day-field").style.display = f==="m" ? "" : "none";
  document.getElementById("rec-wd-field").style.display = f==="w" ? "" : "none";
}
function saveRecurring(){
  const a = parseAmount(document.getElementById("rec-amount").value);
  const n = document.getElementById("rec-name").value.trim();
  if (!a || a<=0){ toast("Entre un montant valide"); return; }
  const freq = document.getElementById("rec-freq").querySelector(".on").dataset.f;
  const d = Math.min(Math.max(parseInt(document.getElementById("rec-day").value)||1, 1), 28);
  const wd = +document.getElementById("rec-wd").value;
  const cat = document.getElementById("rec-cat").value;
  if (editRec){
    const r = editRec;
    const schedChanged = r.freq !== freq || (freq === "m" ? (+r.day||1) !== d : (+r.wd||0) !== wd);
    Object.assign(r, { name:n||r.name||"Dépense récurrente", cat, amount:a, freq, day:freq==="m"?d:1, wd });
    if (schedChanged) r.lastAdded = "";   // le programme a changé : reprise depuis la prochaine occurrence du nouveau calendrier
    processRecurring();
    save(); closeSheet(); closeRecSheet(); render();
    toast("✓ Récurrence mise à jour");
    return;
  }
  state.recurring.push({ name:n||"Dépense récurrente", cat,
    amount:a, freq, day:freq==="m"?d:1, wd, lastAdded:"" });
  processRecurring();
  save(); closeSheet(); closeRecSheet(); render();
  toast("🔁 Récurrence programmée");
}

/* ============ Saisie rapide ============ */
function frequentExpenses(){
  const pool = state.expenses.slice(-150).reverse();
  const seen = new Set(), out = [];
  pool.forEach(e=>{
    const k = e.name+"|"+e.cat;
    if (seen.has(k)) return;
    const same = pool.filter(x=>x.name===e.name && x.cat===e.cat);
    out.push({ name:e.name, cat:e.cat, amount: Math.round(same.reduce((s,x)=>s+x.amount,0)/same.length * 100)/100, n: same.length });
    seen.add(k);
  });
  return out.sort((a,b)=>b.n-a.n).slice(0,5);
}
function renderQuickChips(){
  const host = document.getElementById("quick-chips");
  const items = frequentExpenses();
  document.getElementById("chips-field").style.display = items.length ? "block" : "none";   // rien de fréquent : pas de champ vide
  // données passées via dataset (jamais via des strings inline : encodeURIComponent ne couvre pas « ' »)
  host.innerHTML = items.map((x,i)=>
    `<button class="chip" data-i="${i}">${esc(catOf(x.cat).emoji)} ${esc(x.name)} <span class="am">${money(x.amount)}</span></button>`
  ).join("");
  host.querySelectorAll(".chip").forEach(b=>{
    b.onclick = ()=>{
      const x = items[+b.dataset.i]; if (!x) return;
      selectedChipCat = x.cat;
      document.getElementById("in-amount").value = x.amount;
      document.getElementById("in-name").value = x.name;
      syncKpDisplay();
      updateChipSel();
    };
  });
}
let selectedChipCat = null;
function updateChipSel(){
  if (selectedChipCat && state.cats[selectedChipCat]){
    pickedCat = selectedChipCat;
    document.querySelectorAll("#cat-grid .cat[data-k]").forEach(x=>x.classList.toggle("on",x.dataset.k===pickedCat));
  }
}

/* ============ Comparatif vs mois précédent ============ */
function renderCompare(){
  if (state.kind === "dettes"){ document.getElementById("compare-card").style.display = "none"; return; }
  const host = document.getElementById("compare-host");
  const period = document.getElementById("stat-seg").dataset.p || "month";
  document.getElementById("compare-card").style.display = period==="year" ? "none" : "block";
  document.getElementById("compare-title").textContent = period==="w" ? "vs semaine précédente" : "vs mois précédent";
  const now = new Date();
  let cur = {}, prev = {};
  if (period==="w"){
    const [cs, ce] = weekBounds(0), [ps, pe] = weekBounds(-1);
    state.expenses.filter(e=>e.date>=cs && e.date<=ce).forEach(e=>cur[e.cat]=(cur[e.cat]||0)+e.amount);
    state.expenses.filter(e=>e.date>=ps && e.date<=pe).forEach(e=>prev[e.cat]=(prev[e.cat]||0)+e.amount);
  } else {
    const pb = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const pKey = ymd(pb).slice(0,7);
    cur = monthSpendByCat();
    state.expenses.filter(e=>e.date.startsWith(pKey)).forEach(e=>prev[e.cat]=(prev[e.cat]||0)+e.amount);
  }
  const keys = [...new Set([...Object.keys(cur), ...Object.keys(prev)])];
  if (!keys.length || (!Object.keys(cur).length && !Object.keys(prev).length)){
    host.innerHTML = '<div class="empty" style="padding:18px 0">Pas encore de comparaison possible.</div>';
    return;
  }
  host.innerHTML = keys.sort((a,b)=>(cur[b]||0)-(cur[a]||0)).slice(0,6).map(k=>{
    const c = catOf(k), cu = cur[k]||0, pv = prev[k]||0;
    let delta, cls;
    if (!pv){ delta = "nouveau"; cls = "ok"; }
    else if (!cu){ delta = "— 100%", cls = "down"; }
    else {
      const d = Math.round((cu-pv)/pv*100);
      delta = (d>=0?"▲ ":"▼ ")+Math.abs(d)+"%"; cls = d>0?"up":d<0?"down":"ok";
    }
    return `<div class="cmp-row">
      <div class="dot" style="background:${c.color};width:9px;height:9px"></div>
      <span class="cmp-lbl">${esc(c.emoji)} ${esc(c.label)}</span>
      <span class="cmp-nums">${money(cu)} · vs ${money(pv)}</span>
      <span class="delta ${cls}">${delta}</span>
    </div>`;
  }).join("");
}

/* ============ Recherche + CSV ============ */
async function exportBackup(){
  const data = JSON.stringify({ app:"kola", schema:SCHEMA_VERSION, exportedAt: ymd(new Date()), state }, null, 2);
  const name = "kola-sauvegarde-" + todayISO() + ".json";
  // iOS (surtout en app installée) ignore les téléchargements data:/anchor :
  // la voie fiable est la fiche de partage native → « Enregistrer dans Fichiers »
  if (navigator.share && navigator.canShare){
    try {
      const file = new File([data], name, { type:"application/json" });
      if (navigator.canShare({ files: [file] })){
        await navigator.share({ files: [file], title: "Sauvegarde Kola" });
        state.lastBackupAt = ymd(new Date());
        state.lastMonthlyBackup = prevMonthKey();
        save(); render();
        toast("💾 Sauvegarde partagée — enregistre-la dans Fichiers");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") { toast("Partage annulé"); return; }
      // partage indisponible : on tente le téléchargement classique
    }
  }
  const how = await shareOrDownload(data, "application/json", name, "💾 Sauvegarde exportée");
  if (how === "cancelled") return;   // annulé : pas de rappel décalé
  state.lastBackupAt = ymd(new Date());
  state.lastMonthlyBackup = prevMonthKey();   // toute sauvegarde couvre aussi les mois passés
  save();
  render();
  if (how === "shared") return;   // toast déjà envoyé par le partage
  toast("💾 Sauvegarde exportée");
}
