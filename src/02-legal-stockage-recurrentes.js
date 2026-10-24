/* ============ Pages légales (FR/EN, 100% statique) ============ */
const LEGAL_TITLES = {
  mentions:        ["Mentions légales", "Legal notices"],
  confidentialite: ["Politique de confidentialité", "Privacy policy"],
  cgu:             ["Conditions d'utilisation", "Terms of use"],
};
const LEGAL = {
  mentions: [
    ["h", "Éditeur", "Publisher"],
    ["p", "L'application Kola est développée et maintenue par Koami Parfait. Contact : via le dépôt GitHub du projet, en ouvrant une issue.",
          "The Kola app is developed and maintained by Koami Parfait. Contact: via the project's GitHub repository, by opening an issue."],
    ["h", "Code source", "Source code"],
    ["p", "Kola est un logiciel libre, distribué sous licence MIT. Le code source complet est consultable et vérifiable par chacun : https://github.com/ohaniceyt/kola",
          "Kola is free software, distributed under the MIT license. The complete source code is viewable and verifiable by anyone: https://github.com/ohaniceyt/kola"],
    ["h", "Hébergement", "Hosting"],
    ["p", "Le site et l'application sont hébergés par GitHub Pages (GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, États-Unis).",
          "The site and the app are hosted by GitHub Pages (GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, United States)."],
    ["h", "Cookies et traceurs", "Cookies and trackers"],
    ["p", "Kola n'utilise aucun cookie, aucun traceur ni aucun service de mesure d'audience. Aucune donnée personnelle n'est transmise lors de la consultation du site ou de l'utilisation de l'application.",
          "Kola uses no cookies, no trackers and no audience-measurement services. No personal data is transmitted when you visit the site or use the app."],
    ["h", "Version", "Version"],
    ["p", "Kola v0.12 — dernière mise à jour : octobre 2026.", "Kola v0.12 — last updated: October 2026."],
  ],
  confidentialite: [
    ["h", "L'essentiel", "The essentials"],
    ["p", "Kola suit tes dépenses 100% en local : aucune donnée ne quitte jamais ton appareil. Pas de compte, pas de serveur, pas d'outils d'analyse, pas de publicité.",
          "Kola tracks your expenses 100% on your device: no data ever leaves your device. No account, no server, no analytics, no ads."],
    ["h", "Données stockées sur ton appareil", "Data stored on your device"],
    ["p", "Ton prénom éventuel, tes dépenses, enveloppes, objectifs, récurrences, catégories et préférences sont enregistrés uniquement sur cet appareil (localStorage et IndexedDB du navigateur). Kola n'accède à rien d'autre : ni photos, ni fichiers, ni géolocalisation.",
          "Your name (optional), expenses, envelopes, goals, recurring items, categories and preferences are stored only on this device (browser localStorage and IndexedDB). Kola accesses nothing else: no photos, no files, no location."],
    ["h", "Aucune transmission", "No transmission"],
    ["p", "Rien n'est envoyé automatiquement, jamais. Les sauvegardes (fichiers JSON ou CSV) sont créées à ta demande et transitent par tes propres canaux (Mail, AirDrop, WhatsApp…) — jamais par nous.",
          "Nothing is sent automatically, ever. Backups (JSON or CSV files) are created on demand and travel through your own channels (Mail, AirDrop, WhatsApp…) — never through us."],
    ["h", "Partage en direct (budget couple)", "Direct sharing (couple budget)"],
    ["p", "Si tu actives le budget couple, les dépenses du livre actif peuvent être échangées de pair à pair entre deux appareils du même réseau Wi-Fi local (WebRTC), via un QR ou un fichier échangé par tes soins. Aucun serveur ne stocke ces données, et rien ne transite par l'appareil des autres personnes.",
          "If you enable the couple budget, the active book's expenses can be shared peer-to-peer between two devices on the same local Wi-Fi network (WebRTC), via a QR code or a file you exchange. No server stores this data, and it never passes through anyone else's device."],
    ["h", "Droits", "Rights"],
    ["p", "Tu maîtrises tout : export complet à tout moment (Réglages → Exporter), effacement intégral (Réglages → Effacer toutes les données), ou désinstallation de l'app — qui supprime définitivement toutes les données.",
          "You control everything: full export at any time (Settings → Export), complete erasure (Settings → Erase all data), or uninstalling the app — which permanently deletes all data."],
    ["h", "Contact", "Contact"],
    ["p", "Une question sur ta vie privée ? Ouvre une issue sur https://github.com/ohaniceyt/kola", "A privacy question? Open an issue at https://github.com/ohaniceyt/kola"],
  ],
  cgu: [
    ["h", "Objet", "Purpose"],
    ["p", "Kola est une application gratuite de suivi de dépenses, utilisable hors ligne et 100% en local. L'installation et l'utilisation de l'application valent acceptation des présentes conditions.",
          "Kola is a free expense-tracking app, usable offline and 100% on your device. Installing and using the app means you accept these terms."],
    ["h", "Fourniture « en l'état »", "Provided as is"],
    ["p", "Kola est fournie telle quelle (licence MIT), sans garantie expresse ou implicite. Le développeur s'efforce d'assurer la fiabilité et la sécurité des données, sans que cela constitue une obligation de résultat.",
          "Kola is provided as is (MIT license), without express or implied warranty. The developer strives to ensure data reliability and security, but this does not constitute an obligation of result."],
    ["h", "Responsabilité", "Liability"],
    ["p", "Tu es seul responsable de tes sauvegardes (l'app t'en rappelle régulièrement) et de l'usage que tu fais de l'application. Kola ne fournit aucun conseil financier, fiscal ou comptable.",
          "You are solely responsible for your backups (the app reminds you regularly) and for how you use the app. Kola provides no financial, tax or accounting advice."],
    ["h", "Limites", "Limits"],
    ["p", "Kola ne peut être tenue responsable d'une perte de données liée à la désinstallation, au changement d'appareil, au vidage du stockage du navigateur ou à un navigateur en mode privé. Des sauvegardes régulières sont recommandées.",
          "Kola cannot be held liable for data loss caused by uninstalling, changing devices, clearing browser storage, or private browsing. Regular backups are recommended."],
    ["h", "Évolution", "Evolution"],
    ["p", "Kola peut évoluer (fonctionnalités, corrections, thèmes). Toute modification substantielle des présentes conditions sera signalée dans l'application. Version : octobre 2026.",
          "Kola may evolve (features, fixes, themes). Any substantial change to these terms will be announced in the app. Version: October 2026."],
  ],
};
function openLegalSheet(key){
  const d = LEGAL[key]; if (!d) return;
  const en = (typeof LANG !== "undefined" && LANG === "en");
  document.getElementById("legal-sheet-title").textContent = t((LEGAL_TITLES[key]||[])[en?1:0] || (LEGAL_TITLES[key]||[])[0]);
  document.getElementById("legal-body").innerHTML = d.map(([kind, fr, enTxt]) =>
    `<${kind === "h" ? "h3" : "p"}>${esc((en ? enTxt : fr) || fr).replace(/\b(https:\/\/[^\s<]+)\b/g, m2 => `<a href="${m2}" target="_blank" rel="noopener">${m2}</a>`)}</${kind === "h" ? "h3" : "p"}>`).join("");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("legal-sheet").classList.add("show"); syncScrollLock();
}
function closeLegalSheet(){ const sl = document.getElementById("legal-sheet");
  if (sl){ sl.classList.remove("show"); clearSheetOverlay(); } }

/* --- Thème (palette par livre ou globale) --- */
function openThemeSheet(){
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("theme-sheet").classList.add("show"); syncScrollLock();
  renderThemeSheet();
}
function closeThemeSheet(){ const s = document.getElementById("theme-sheet");
  if (s){ s.classList.remove("show"); clearSheetOverlay(); } }
function renderThemeSheet(){
  const grid = document.getElementById("theme-grid"); if (!grid) return;
  const cur = themeOf();
  const b = curBook() || {};
  grid.innerHTML = THEMES.map(t =>
    `<button class="theme-swatch${t.id === cur.id ? " on" : ""}" style="background:linear-gradient(135deg,${t.a},${t.b || t.a})" onclick="themeSet('${t.id}')">${esc(t.name)}</button>`).join("");
  const scope = document.getElementById("theme-scope");
  if (scope) scope.textContent = b.theme ? tt("🎨 Thème du livre « {a} »", { a: b.name }) : t("🎨 Thème global (tous les livres)");
  const all = document.getElementById("theme-all");
  if (all) all.style.display = b.theme ? "block" : "none";   // déjà global : rien à étendre
}
function themeSet(id){
  const t = THEMES.find(x => x.id === id); if (!t) return;
  const b = curBook(); if (!b) return;
  b.theme = id;
  save(); render(); renderThemeSheet(); renderThemeRow();
  toast("🎨 " + tt("{a} — livre « {b} »", { a: t.name, b: b.name }));
}
function themeAll(){
  const t = themeOf();
  state.theme = t.id;
  state.books.forEach(b => { if (b && b.theme) delete b.theme; });
  save(); render(); renderThemeSheet(); renderThemeRow();
  toast("🎨 " + tt("{a} — tous les livres", { a: t.name }));
}
function renderThemeRow(){
  const el = document.getElementById("theme-current"); if (!el) return;
  el.textContent = themeOf().name;
}
/* --- Sheet de gestion des livres --- */
let bookEditId = null;   // id en cours d'édition, ou "new"
function openBookSheet(){ bookEditId = null; document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("book-sheet").classList.add("show"); syncScrollLock(); renderBookSheet(); }
function closeBookSheet(){ const s = document.getElementById("book-sheet");
  if (s){ s.classList.remove("show"); clearSheetOverlay(); } }
function renderBookSheet(){
  const list = document.getElementById("book-list"); if (!list) return;
  const editRow = (name, emoji, kind) => `<div class="group" style="padding:8px 0">
    <div class="setrow" style="align-items:center">
      <input id="be-emoji" aria-label="Emoji du livre" type="text" maxlength="4" value="${esc(emoji)}"
             style="width:52px;padding:8px;text-align:center;border:0;border-radius:8px;background:var(--fill);font-family:inherit;font-size:17px;outline:none">
      <input id="be-name" aria-label="${esc(t("Nom du livre"))}" type="text" maxlength="40" value="${esc(name)}"
             style="flex:1;padding:8px;border:0;border-radius:8px;background:var(--fill);font-family:inherit;font-size:15px;color:var(--label);outline:none" placeholder="${esc(t("Nom du livre"))}">
    </div>
    <div class="setrow">
      <div class="segmented mini" style="flex:1" id="be-kindseg" role="group" aria-label="${esc(t("Type de livre"))}">
        <button data-k="dep" type="button" class="${kind === "dettes" ? "" : "on"}" onclick="bookKindPick(this)">📕 ${esc(t("Dépenses"))}</button>
        <button data-k="dettes" type="button" class="${kind === "dettes" ? "on" : ""}" onclick="bookKindPick(this)">🤝 ${esc(t("Dettes"))}</button>
      </div>
    </div>
    <div class="setrow">
      <button class="btn-ghost" onclick="bookEditSave()" style="color:var(--link);font-weight:700">✓ ${esc(t("Enregistrer"))}</button>
      <button class="btn-ghost" onclick="bookEditCancel()" style="color:var(--secondary-label)">${esc(t("Annuler"))}</button>
    </div>
  </div>`;
  const editNew = bookEditId === "new" ? editRow("", "📖", "dep") : "";
  const rows = getBooks().map(b => {
    if (b.id === bookEditId) return editRow(b.name, b.emoji, b.data.kind);
    const dettesB = b.data.kind === "dettes";
    const n = dettesB ? (b.data.debts || []).length : (b.data.expenses || []).length;
    const trash = getBooks().length > 1 ? `<div class="rowbtn" onclick="event.stopPropagation();bookAskDelete('${b.id}')" role="button" tabindex="0">🗑️</div>` : "";
    return `<div class="setrow" style="cursor:pointer" onclick="bookSwitch('${b.id}')" role="button" tabindex="0">
      <div class="icon-badge" style="font-size:18px;background:var(--fill)">${esc(b.emoji)}</div>
      <div class="n">${esc(b.name)}${b.id === state.bookId ? ` <div class="bk-sub">${esc(t("Livre actuel"))}</div>` : ""}</div>
      <div class="v">${dettesB ? tt("{n} dette(s)", { n }) : tt("{n} dépense(s)", { n })}</div>
      <div class="rowbtn" onclick="event.stopPropagation();bookSwitchEdit('${b.id}')" role="button" tabindex="0" aria-label="${esc(t("Renommer"))}">✏️</div>
      ${trash}
    </div>`;
  }).join("");
  list.innerHTML = editNew + `<div class="group">${rows}</div>
    <div class="hint" style="padding:8px 20px 2px">${esc(t("Chaque livre a ses dépenses, enveloppes et objectifs — bascule en un tap depuis l'accueil."))}</div>`;
}
function bookSwitchEdit(id){ if (bookEditId === id){ bookEditId = null; renderBookSheet(); return; }
  bookEditId = id; renderBookSheet();
  const el = document.getElementById("be-name"); if (el) el.focus(); }
function bookEditNew(){ if (bookEditId === "new") return; bookEditId = "new"; renderBookSheet();
  const el = document.getElementById("be-name"); if (el) el.focus(); }
function bookEditSave(){
  const n = (document.getElementById("be-name") || {}).value ?? "";
  const e = (document.getElementById("be-emoji") || {}).value ?? "";
  if (!String(n).trim()){ toast(t("Nom du livre")); return; }
  const kb = document.querySelector("#be-kindseg button.on");
  const kind = (kb && kb.dataset.k === "dettes") ? "dettes" : "dep";
  if (bookEditId === "new") bookAdd(n, e, kind); else bookRename(bookEditId, n, e, kind);
  bookEditId = null;
  renderBookSheet();   // efface le formulaire d'édition resté affiché après l'enregistrement
}
function bookEditCancel(){ bookEditId = null; renderBookSheet(); }
function bookAskDelete(id){
  const b = getBooks().find(x => x.id === id); if (!b || getBooks().length <= 1) return;
  if (b.data.kind === "dettes"){
    if (confirm(tt("Supprimer le livre « {a} » et ses {n} dette(s) ? Action irréversible.", { a: b.name, n: (b.data.debts || []).length }))) bookDelete(id);
  } else if (confirm(tt("Supprimer le livre « {a} » et ses {n} dépense(s) ? Action irréversible.", { a: b.name, n: (b.data.expenses || []).length }))) bookDelete(id);
}
function bookKindPick(btn){
  btn.parentElement.querySelectorAll("button").forEach(x => x.classList.remove("on"));
  btn.classList.add("on");
}

function autoSplitBudget(){
  state.budgets = {};
  Object.keys(state.cats).forEach(k=>{
    if (SPLITS[k] && state.budget > 0){
      state.budgets[k] = Math.round(state.budget * SPLITS[k]);
    }
  });
}
function save(){
  if (Array.isArray(state.books)) bookStore();   // le livre courant reste synchronisé avant chaque écriture
  maybeAutoSnap();                               // instantané automatique 1×/jour (IndexedDB)
  state.rev = (+state.rev || 0) + 1;   // compteur monotone : arbitre entre les 2 copies
  let lsOk = false;
  try {
    if (state.user) { state.lastChangeAt = ymd(new Date()); }   // pour le rappel de sauvegarde
    localStorage.setItem("depenses-state", JSON.stringify(state));
    lsOk = true;
  } catch (err) {
    // Quota dépassé (Safari iOS ~5 Mo) ou mode privé : la copie IndexedDB prend le relais
    console.warn("Kola : localStorage plein ou inaccessible", err);
    if (!idb) toast("⚠️ Sauvegarde impossible — exporte tes données (Réglages → Données)");
  }
  if (!lsOk) idbPersist();               // immédiat si localStorage a échoué
  else { clearTimeout(idbTimer); idbTimer = setTimeout(idbPersist, 600); }
}
/* ============ Stockage IndexedDB (durable au-delà du quota localStorage) ============ */
let idb = null, idbTimer = null;
function idbOpen(){
  return new Promise(res=>{
    try {
      const rq = indexedDB.open("kola", 2);
      rq.onupgradeneeded = ()=>{ const db = rq.result;
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
        if (!db.objectStoreNames.contains("snaps")) db.createObjectStore("snaps", { keyPath: "key" }); };
      rq.onsuccess = ()=>res(rq.result);
      rq.onerror = ()=>res(null);
      rq.onblocked = ()=>res(null);
    } catch(_){ res(null); }
  });
}
function idbGet(){
  return new Promise(res=>{
    try {
      const tx = idb.transaction("state","readonly");
      const rq = tx.objectStore("state").get("main");
      rq.onsuccess = ()=>res(rq.result || null);
      rq.onerror = ()=>res(null);
      tx.onabort = ()=>res(null);
    } catch(_){ res(null); }
  });
}
async function idbPersist(){
  if (!idb || !state) return;
  try {
    const wrap = { app:"kola", schema:SCHEMA_VERSION, savedAt:new Date().toISOString(), rev:+state.rev||0, state };
    const tx = idb.transaction("state","readwrite");
    tx.objectStore("state").put(wrap, "main");
    tx.onerror = e=>console.warn("Kola : écriture IndexedDB impossible", e && e.target && e.target.error);
    tx.onabort = ()=>idbClose();
  } catch(err){ console.warn("Kola : IndexedDB inaccessible", err); }
}
let idbFailures = 0;

/* Journal d'erreurs local : si l'app plante (freeze/blanc), le dernier incident
   se lit dans Réglages → Sauvegardes automatiques (partie basse) — 100% local. */
function __errLog(kind, msg){
  try {
    const lines = (localStorage.getItem("kola-errlog") || "").split("\n").filter(Boolean).slice(-4);
    lines.push(new Date().toISOString() + " " + kind + " " + String(msg).slice(0, 300));
    localStorage.setItem("kola-errlog", lines.join("\n"));
  } catch(_){}
}
window.addEventListener("error", e => __errLog("ERR", (e && (e.message || (e.error && e.error.message))) || "inconnu"));
window.addEventListener("unhandledrejection", e => __errLog("PROMISE", (e && e.reason && (e.reason.message || e.reason)) || "rejet inconnu"));

/* ============ Sauvegardes automatiques (7 derniers jours, IndexedDB) ============ */
const AUTO_SNAPS = 7;
let snapQueued = false;
const idbSnapsOk = () => !!(idb && idb.objectStoreNames && idb.objectStoreNames.contains("snaps"));
/* Peut-être un instantané : au plus une fois par jour (état complet gelé, inclut les livres) */
function maybeAutoSnap(immediate){
  if (!idbSnapsOk() || !state || snapQueued) return;
  const d = todayISO();
  if (state.lastSnapAt === d && !immediate) return;   // déjà fait aujourd'hui
  snapQueued = true;
  // loin de l'interaction : idle s'il existe (pas sur Safari), sinon 4 s après le dernier changement
  const schedule = (window.requestIdleCallback || (f => setTimeout(f, 4000)));
  schedule(() => {
    snapQueued = false;
    try {
      const wrap = { app:"kola", schema:SCHEMA_VERSION, exportedAt:d, savedAt:new Date().toISOString(), rev:+state.rev||0, state: JSON.parse(JSON.stringify(state)) };
      const tx = idb.transaction("snaps","readwrite");
      tx.objectStore("snaps").put({ key: d, wrap });
      tx.oncomplete = () => { state.lastSnapAt = d; renderAutoRow(); };   // pas de save() ici : la propriété partira avec le prochain changement
      tx.onerror = () => console.warn("Kola : instantané auto impossible");
    } catch(err){ console.warn("Kola : instantané auto impossible", err); }
  }, 1500);   // hors du coup de l'action utilisateur
}
function listAutoSnaps(){
  return new Promise(res => {
    if (!idbSnapsOk()) return res([]);
    try {
      const tx = idb.transaction("snaps","readonly");
      const rq = tx.objectStore("snaps").getAll();
      rq.onsuccess = () => res((rq.result || []).filter(x => x && x.key && x.wrap).sort((a,b) => b.key.localeCompare(a.key)).slice(0, AUTO_SNAPS));
      rq.onerror = () => res([]);
      tx.onabort = () => res([]);
    } catch(_){ res([]); }
  });
}
async function pruneAutoSnaps(){
  const snaps = await listAutoSnaps();
  const old = snaps.slice(AUTO_SNAPS);
  if (!old.length) return;
  try {
    const tx = idb.transaction("snaps","readwrite");
    old.forEach(x => tx.objectStore("snaps").delete(x.key));
  } catch(_){}
}
function renderAutoRow(){
  const el = document.getElementById("auto-last"); if (!el) return;
  if (!idbSnapsOk()){ el.textContent = "n/a"; return; }
  el.textContent = state.lastSnapAt ? state.lastSnapAt : "—";
}
function openAutoSheet(){
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("auto-sheet").classList.add("show"); syncScrollLock();
  renderAutoSheet();
}
function closeAutoSheet(){ const sl = document.getElementById("auto-sheet");
  if (sl){ sl.classList.remove("show"); clearSheetOverlay(); } }
async function renderAutoSheet(){
  const host = document.getElementById("auto-list"); if (!host) return;
  // diagnostic local (le dernier incident, le cas échéant) : se lit ici si l'app a gelé
  let errs = "";
  try {
    const raw = (localStorage.getItem("kola-errlog") || "");
    if (raw) errs = `<p class="hint" style="text-align:left;padding:4px 0 2px"><b>${esc(t("Dernier incident technique"))} :</b><br><code style="font-size:11px;word-break:break-all">${esc(raw.split("\n").join(" · "))}</code><br><a href="#" id="err-erase">${esc(t("Effacer ce journal"))}</a></p>`;
  } catch(_){}
  const snaps = await listAutoSnaps();
  const wipe = document.getElementById("auto-wipe");
  if (wipe) wipe.style.display = snaps.length ? "block" : "none";
  if (!snaps.length){
    host.innerHTML = errs + `<div class="group"><div class="setrow"><div class="icon-badge" style="background:var(--fill)">🛟</div><div class="n">${esc(t("Aucune sauvegarde encore"))}<div class="bk-sub">${esc(t("Elle apparaîtra après ton premier changement du jour."))}</div></div></div></div>`;
    return;
  }
  host.innerHTML = `<div class="group">` + snaps.map(x => {
    const st = (x.wrap && x.wrap.state) || {};
    const n = ((st.expenses||[]).length || 0) + (Array.isArray(st.books) ? st.books.reduce((a,b)=>a + ((b.data||{}).expenses||[]).length, 0) : 0);
    return `<div class="setrow" role="button" tabindex="0" style="cursor:pointer" onclick="restoreAutoSnap('${x.key}')">
      <div class="icon-badge" style="font-size:16px;background:var(--fill)">📅</div>
      <div class="n">${esc(x.key)}<div class="bk-sub">${esc(tt("{n} dépense(s)", {n}))}</div></div>
      <div class="v">${esc(t("Restaurer"))} ›</div>
    </div>`;
  }).join("") + `</div>` + errs;
}
addEventListener("click", function(ev){
  if (ev.target && ev.target.id === "err-erase"){
    ev.preventDefault();
    try { localStorage.removeItem("kola-errlog"); } catch(_){}
    renderAutoSheet(); toast("Journal effacé");
  }
}, true);
/* Restauration : reprend le circuit d'import (aperçu → fusion ou remplacement) — validation complète incluse */
function restoreAutoSnap(key){
  listAutoSnaps().then(snaps => {
    const hit = (snaps || []).find(x => x.key === key);
    if (!hit){ toast(t("Introuvable")); return; }
    closeAutoSheet();
    importBackupText(JSON.stringify(hit.wrap));
  });
}
function wipeAutoSnaps(){
  if (!idbSnapsOk()) return;
  if (!confirm(t("Supprimer toutes les sauvegardes automatiques de cet appareil ? Les données actuelles ne sont pas affectées."))) return;
  try {
    const tx = idb.transaction("snaps","readwrite");
    tx.objectStore("snaps").clear();
  } catch(_){}
  renderAutoSheet();
}

function idbClose(){
  if (++idbFailures > 3){ idb = null; console.warn("Kola : IndexedDB abandonnée (3 blocages) — localStorage seul"); }
}
async function idbErase(){
  if (!idb) return;
  try { const tx = idb.transaction("state","readwrite"); tx.objectStore("state").delete("main"); } catch(_){}
}


/* ============ Dépenses récurrentes ============ */
function nextOccur(r, fromISO){
  if (r.freq === "w"){
    const d = new Date(fromISO + "T12:00:00");
    d.setDate(d.getDate()+7);
    return ymd(d);
  }
  const [y, M] = fromISO.split("-").map(Number);
  const m2 = M===12 ? 1 : M+1, y2 = M===12 ? y+1 : y;
  const day = Math.min(+r.day||1, 28);
  return `${y2}-${String(m2).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}
/* Première occurrence : toujours FUTURE (prochaine échéance) — pas d'ajout
   rétroactif à la création : si l'échéance du mois courant est déjà passée,
   on part du mois/lundi suivant. */
function firstOccur(r){
  if (r.freq === "w"){
    const t = new Date();
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay()+6)%7);
    const occ = new Date(monday); occ.setDate(monday.getDate() + (+r.wd||0));
    if (occ < today) occ.setDate(occ.getDate() + 7);
    return ymd(occ);
  }
  const t = new Date();
  const occ = new Date(t.getFullYear(), t.getMonth(), Math.min(+r.day||1, 28));
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  if (occ < today) occ.setMonth(occ.getMonth() + 1);
  return ymd(occ);
}
// Traite toutes les occurrences échues depuis la dernière passée ; zéro doublon par construction
function processRecurring(){
  const today = todayISO();
  let changed = false;
  (state.recurring||[]).forEach(r=>{
    if (!r.freq) r.freq = "m";
    const base = r.lastAdded || "";
    let occ = base && base <= today ? nextOccur(r, base) : firstOccur(r);
    let guard = 0;
    while (occ <= today && guard < 1200){   // garde-fou (reprise > 20 ans impossible en pratique)
      state.expenses.push({ id:crypto.randomUUID(), name:r.name, cat:r.cat, amount:+r.amount, date:occ, ts:Date.now() });
      r.lastAdded = occ;
      changed = true;
      occ = nextOccur(r, occ);
      guard++;
    }
  });
  if (changed) save();
}

function renderRecurring(){
  const host = document.getElementById("rec-manage");
  host.innerHTML = "";
  document.getElementById("rec-count").textContent = (state.recurring||[]).length || "";
  if (!(state.recurring||[]).length){
    host.innerHTML = '<div class="setrow"><div class="n" style="color:var(--secondary-label);font-size:14px">Aucune dépense récurrente</div></div>';
    return;
  }
  state.recurring.forEach((r)=>{
    const c = catOf(r.cat);
    const row = document.createElement("div"); row.className = "setrow";
    row.setAttribute("role","button"); row.tabIndex = 0;
    row.setAttribute("aria-label", tt("Modifier la récurrence {a}", {a: r.name}));
    row.innerHTML = `<div class="icon-badge" style="background:${c.color}22">${esc(c.emoji)}</div>
      <div class="n">${esc(r.name)}<div style="font-size:12px;color:var(--secondary-label)">${money(+r.amount)} · ${r.freq==="w" ? tt("chaque {a}", {a: I18N_WD()[+r.wd||0]}) : tt("le {a} de chaque mois", {a: r.day})}</div></div>`;
    row.onclick = ()=>openRecEdit(r);
    row.onkeydown = e => { if (e.key==="Enter" || e.key===" "){ e.preventDefault(); openRecEdit(r); } };
    const del = document.createElement("button"); del.className = "del-btn"; del.textContent = "✕";
    del.setAttribute("aria-label","Supprimer");
    const delFlow = ()=>{ if (confirm(tt("Arrêter la récurrence de « {a} » ?", {a: r.name}))){
      const idx = state.recurring.indexOf(r);
      if (idx > -1) state.recurring.splice(idx, 1);
      save(); renderRecurring(); render(); toast("Récurrence arrêtée"); } };
    del.onclick = ev=>{ ev.stopPropagation(); delFlow(); };
    row.appendChild(del);
    host.appendChild(row);
  });
}

