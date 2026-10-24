/* ============ Événements ============ */
document.getElementById("stat-seg").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  document.querySelectorAll("#stat-seg button").forEach(x=>x.classList.remove("on"));
  b.classList.add("on"); document.getElementById("stat-seg").dataset.p=b.dataset.p;
  renderStats(b.dataset.p); renderCompare();
});
document.getElementById("hist-filter").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  document.querySelectorAll("#hist-filter button").forEach(x=>x.classList.remove("on"));
  b.classList.add("on"); document.getElementById("hist-filter").dataset.c = b.dataset.c;
  histShown = HIST_PAGE;   // nouveau filtre : on repart en haut de la liste
  renderHistory();
});
document.getElementById("budget-input").addEventListener("change", e=>{
  const v=parseAmount(e.target.value);
  if (v > 0){ state.budget=v; save(); toast("Budget mis à jour"); }
  else {
    state.budget = 0; e.target.value = ""; save();
    toast("Budget global désactivé — Kola suit juste tes dépenses");
  }
});
document.getElementById("currency-select").addEventListener("change", e=>{
  state.currency=e.target.value; save(); toast(tt("Devise : {a}", {a: state.currency}));
});
document.getElementById("data-file").addEventListener("change", e=>{
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  importDataFile(f);
});
document.getElementById("rec-freq").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  setRecFreq(b.dataset.f);
});
document.getElementById("db-dir").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  pickDebtDir(b.dataset.k);
});


/* --- Budget couple --- */
document.getElementById("couple-on").addEventListener("change", e=>{
  couple();
  state.couple.on = e.target.checked;
  state.couple.lastAt = e.target.checked ? state.couple.lastAt : "";
  save(); render();
  toast(e.target.checked ? "💑 " + t("Budget couple activé") : t("Budget couple désactivé"));
});
document.getElementById("partner-name-input").addEventListener("change", e=>{
  couple();
  state.couple.partner = e.target.value.trim().slice(0, 20);
  save(); render(); renderWhoSeg();
});
document.getElementById("couple-file").addEventListener("change", e=>{
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  importCoupleFile(f);
});
["who-seg","who-edit-seg","who-ocr-seg"].forEach(id=>{
  document.getElementById(id).addEventListener("click", e=>{
    const b = e.target.closest("button"); if (!b) return;
    if (id === "who-seg") pickedWho = b.dataset.w;
    else if (id === "who-edit-seg") editWho = b.dataset.w;
    else ocrWho = b.dataset.w;
    document.querySelectorAll("#" + id + " button").forEach(x=>x.classList.toggle("on", x.dataset.w === b.dataset.w));
  });
});

// Accessibilité : les "pseudo-boutons" (role=button) réagissent à Enter et Espace
document.addEventListener("keydown", e=>{
  if ((e.key === "Enter" || e.key === " ") && e.target.matches &&
      e.target.matches('[role="button"]')){
    e.preventDefault(); e.target.click();
  }
});

document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeAllSheets(); });

// Filet du header liquide : visible seulement quand le contenu glisse dessous
function updateHeaders(){
  document.querySelectorAll(".header").forEach(h=>h.classList.toggle("scrolled", window.scrollY > 12));
}
window.addEventListener("scroll", updateHeaders, {passive:true});
window.addEventListener("resize", updateHeaders, {passive:true});

// Scroll lock : le fond ne défile pas pendant qu'une sheet est ouverte ; focus rendu au déclencheur
let openerMemo = null;
function syncScrollLock(){
  const open = document.querySelector(".sheet.show");
  document.body.classList.toggle("locked", !!open);
  if (!open && openerMemo && document.contains(openerMemo)){
    try { openerMemo.focus({preventScroll:true}); } catch(_){}
    openerMemo = null;
  }
}
// mémorise l'élément déclencheur : chaque tap quand aucune sheet n'est ouverte
document.addEventListener("pointerdown", ()=>{
  if (!document.querySelector(".sheet.show")) openerMemo = document.activeElement;
}, true);

// Focus-trap : Tab circule dans la sheet ouverte (a11y clavier)
document.addEventListener("keydown", e=>{
  if (e.key !== "Tab") return;
  const sheet = document.querySelector(".sheet.show");
  if (!sheet) return;
  const f = [...sheet.querySelectorAll('button,input,select,[tabindex]')]
    .filter(el=> !el.disabled && !el.hidden && el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length-1], a = document.activeElement;
  if (!sheet.contains(a)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && a === first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last){ e.preventDefault(); first.focus(); }
});
document.getElementById("hist-search").addEventListener("input", ()=>{ applyHistoryFilter(); });

// Sanitizer : dans les champs de montant, on n'accepte que chiffres / virgule / point
document.addEventListener("input", e=>{
  const el = e.target;
  if (el.matches && el.matches('input[type="text"][inputmode="decimal"]')){
    const v = el.value.replace(/[^\d., ]/g, "");
    if (v !== el.value) el.value = v;
  }
});

enableSwipeClose(document.getElementById("sheet"), closeSheet);
enableSwipeClose(document.getElementById("cat-sheet"), closeCatSheet);
enableSwipeClose(document.getElementById("rec-sheet"), ()=>{ closeSheet(); closeRecSheet(); });
enableSwipeClose(document.getElementById("delcat-sheet"), ()=>{ closeDelCatSheet(); });
enableSwipeClose(document.getElementById("lang-sheet"), ()=>{ closeLangSheet(); });
enableSwipeClose(document.getElementById("goal-sheet"), ()=>{ closeSheet(); closeGoalSheets(); });
enableSwipeClose(document.getElementById("goal-contrib-sheet"), ()=>{ closeSheet(); closeGoalSheets(); });
enableSwipeClose(document.getElementById("edit-sheet"), ()=>{ closeEditSheet(); clearSheetOverlay(); syncScrollLock(); });
enableSwipeClose(document.getElementById("backup-sheet"), closeBackupSheet);
enableSwipeClose(document.getElementById("ocr-sheet"), ()=>{ closeOcrSheet(); syncScrollLock(); });
enableSwipeClose(document.getElementById("device-sheet"), closeDeviceSheet);
enableSwipeClose(document.getElementById("evening-sheet"), closeEveningSheet);
enableSwipeClose(document.getElementById("edit-cat-sheet"), closeEditCatSheet);
enableSwipeClose(document.getElementById("couple-sheet"), closeCoupleSheet);
enableSwipeClose(document.getElementById("pair-sheet"), pairClose);
enableSwipeClose(document.getElementById("export-sheet"), closeExportSheet);
enableSwipeClose(document.getElementById("debt-sheet"), closeDebtSheet);
document.getElementById("cat-edit-name").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); saveEditCat(); } });

// ---- Pavé numérique (écrans tactiles) ----
const KP_TOUCH = window.matchMedia("(hover:none) and (pointer:coarse)").matches;
function syncKpDisplay(){
  const v = document.getElementById("in-amount").value;
  document.getElementById("kp-display").textContent = v.replace(".", ",") || "0,00";
}
function renderLegendModeButtons(){
  const m = state.legendMode || "amt";
  document.querySelectorAll(".legend-mode button").forEach(b=>b.classList.toggle("on", b.dataset.m===m));
}

/* ============ Init ============ */
document.getElementById("user-name-input").addEventListener("change", e=>{
  state.user.name = e.target.value.trim(); save(); updateGreeting(); toast("Profil mis à jour");
});
document.getElementById("ob-name").addEventListener("keydown", e=>{ if(e.key==="Enter") obGo(2); });
document.getElementById("ob-budget").addEventListener("keydown", e=>{ if(e.key==="Enter") obGo(4); });
document.querySelectorAll(".legend-mode").forEach(seg=>{
  seg.addEventListener("click", e=>{
    const b=e.target.closest("button"); if(!b) return;
    state.legendMode = b.dataset.m; save(); renderLegendModeButtons();
    render();
  });
});
{
  document.getElementById("keypad").addEventListener("click", e=>{
    const b = e.target.closest("button"); if(!b) return;
    const inp = document.getElementById("in-amount");
    const raw = b.dataset.k;
    if (raw === "del"){ inp.value = inp.value.slice(0,-1); }
    else if (raw === ","){ if (!inp.value.includes(",")) inp.value = (inp.value||"") + ","; }
    else if (b.textContent.trim() === "00" && !!inp.value && inp.value.replace(/[^0-9]/g,"").length > 0){}
    else {
      // garde-fou : 12 chiffres max avant la virgule
      const int = inp.value.split(",")[0].replace(/[^0-9]/g,"");
      if (raw !== undefined && !isNaN(parseInt(raw)) && int.length >= 12){ toast("Montant trop grand"); return; }
      inp.value = (inp.value||"") + raw;
    }
    syncKpDisplay();
  });
}
// l'affichage suit aussi la frappe clavier et les chips
document.getElementById("in-amount").addEventListener("input", syncKpDisplay);

// Enter soumet les formulaires de chaque sheet
[["in-amount","saveExpense"],["edit-amount","saveEdit"],["rec-amount","saveRecurring"],
 ["goal-target","saveGoal"],["goal-contrib-amount","contributeToGoal"]].forEach(([id,fn])=>{
  document.getElementById(id).addEventListener("keydown", e=>{ if(e.key==="Enter" && typeof window[fn]==="function"){ e.preventDefault(); window[fn](); } });
});
["in-name","edit-name","rec-name","cat-name"].forEach(id=>{
  document.getElementById(id).addEventListener("keydown", e=>{ if(e.key!=="Enter") return; e.preventDefault();
    if (id==="in-name") saveExpense();
    else if (id==="edit-name") saveEdit();
    else if (id==="rec-name") saveRecurring();
    else saveNewCat();
  });
});
document.getElementById("ob-budget").addEventListener("input", ()=>{
  renderSplitPreview();
  document.getElementById("ob-btn-budget").textContent =
    parseAmount(document.getElementById("ob-budget").value) > 0 ? "Continuer" : "Continuer sans budget";
});
/* ============ OCR reçu ============ */
/* Photo → Tesseract (100% local : ./vendor/tesseract/ lazy-loadé à la 1ʳᵉ utilisation)
   → extraction montant/date/marchand → sheet de confirmation (tout modifiable avant insertion). */
const OCR_URL = "./vendor/tesseract/";
let __ocrW = null;        // worker Tesseract (promesse, réutilisé toute la session)
let __ocrBusy = false;    // une analyse est en cours

function ocrPick(){ if (!__ocrBusy) document.getElementById("ocr-file").click(); }
function ocrOnFile(){
  const f = document.getElementById("ocr-file").files[0];
  document.getElementById("ocr-file").value = "";
  if (f) ocrRun(f);
}
/* Réduit l'image (caméra = souvent 3-12 Mpx) pour un OCR rapide et fiable */
async function ocrDownscale(file, max){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej)=>{ const i = new Image();
      i.onload = ()=>res(i); i.onerror = ()=>rej(new Error("image illisible")); i.src = url; });
    const sc = Math.min(1, (max||1600) / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", 0.9);
    // Blob : format d'entrée le plus fiable pour worker.recognize()
    const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return { blob: new Blob([arr], { type: "image/jpeg" }), preview: dataUrl };
  } finally { URL.revokeObjectURL(url); }
}
/* Lazy-load : lib principale → worker (core wasm + modèle fra.best_int, gardés en cache IDB) */
function ocrLoadLib(){
  if (window.Tesseract) return Promise.resolve();
  if (window.__ocrLibP) return window.__ocrLibP;
  window.__ocrLibP = new Promise((res, rej)=>{
    const s = document.createElement("script");
    s.src = OCR_URL + "tesseract.min.js";
    s.onload = ()=>res(); s.onerror = ()=>rej(new Error("lib OCR introuvable"));
    document.head.appendChild(s);
  });
  return window.__ocrLibP;
}
function ocrWorker(){
  if (__ocrW) return __ocrW;
  __ocrW = ocrLoadLib().then(()=> Tesseract.createWorker("fra", 1, {  // oem 1 = LSTM seulement ↔ modèles best_int vendus
    workerPath: OCR_URL + "worker.min.js",
    corePath: OCR_URL,
    langPath: OCR_URL,
    logger: m => {
      if (m.status === "recognizing text") ocrBar(m.progress);
      else ocrLoadingProgress(m.progress);
    }
  })).catch(err => { __ocrW = null; throw err; });
  return __ocrW;
}
/* --- UI de la sheet OCR --- */
function ocrStatus(msg){
  const el = document.getElementById("ocr-status");
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
}
function ocrBar(p){
  document.getElementById("ocr-bar-wrap").style.display = "block";
  document.getElementById("ocr-bar").style.width = Math.round(p*100) + "%";
  if (typeof p === "number" && p > 0 && p < 1) ocrStatus(tt("📷 Analyse du reçu… {p}", { p: Math.round(p*100) + "%" }));
}
function ocrLoadingProgress(p){
  if (typeof p === "number" && p > 0 && p < 1) ocrStatus(t("Chargement du moteur OCR…") + " " + Math.round(p*100) + "%");
  else ocrStatus(t("Chargement du moteur OCR…"));
}
const stripAccents = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/* --- Extraction des champs depuis le texte OCR (fonction pure, batterie dédiée) --- */
function ocrExtract(text){
  const out = { amount: 0, date: "", merchant: "" };
  if (typeof text !== "string") return out;
  const lines = text.split(/\r?\n/).map(s=>s.replace(/[  ]/g," ").trim()).filter(Boolean);
  const norm = s => stripAccents(s).toLowerCase();
  /* Date : AAAA-MM-JJ (sans ambiguïté) puis JJ/MM/AAAA puis JJ/MM/AA */
  const dres = [
    { re: /(\d{4})[.\-\\/ ](\d{1,2})[.\-\\/ ](\d{1,2})/, f: m=>[+m[1], +m[2], +m[3]] },
    { re: /(\d{1,2})[.\-\\/](\d{1,2})[.\-\\/](\d{4})/,   f: m=>[+m[3], +m[2], +m[1]] },
    { re: /(\d{1,2})[.\-\\/](\d{1,2})[.\-\\/](\d{2})(?!\d)/, f: m=>{ const y=+m[3]; return [y+(y>69?1900:2000), +m[2], +m[1]]; } },
  ];
  for (const l of lines){
    for (const dr of dres){
      const m = l.match(dr.re); if (!m) continue;
      const [y, mo, d] = dr.f(m);
      if (mo>=1 && mo<=12 && d>=1 && d<=31 && y>=2000 && y<=2100){
        out.date = y + "-" + String(mo).padStart(2,"0") + "-" + String(d).padStart(2,"0");
        break;
      }
    }
    if (out.date) break;
  }
  /* Montant : tokens numériques (décimales, séparateurs milliers, symbole devise possible).
     Priorité : ligne TOTAL (sous-total/TVA/HT exclus) > MONTANT/NET À PAYER/TTC > ligne avec devise
     > autre ligne TOTAL > montants à centimes (bas de reçu = total, haut = prix unitaires). */
  const tokRe = /[\d](?:[\d .,']*\d)?/g;
  const clean = s => s.replace(/(\d)\s*[oO](?=$|[\s.,])/g, "$10").replace(/(\d)\s*[lL](?=$|[\s.,])/g, "$11");
  const cands = [];
  for (let li = 0; li < lines.length; li++){
    const n = norm(lines[li]), raw = clean(lines[li]);
    const toks = []; let m2; tokRe.lastIndex = 0;
    while ((m2 = tokRe.exec(raw))){
      const v = parseAmount(m2[0]);
      if (v > 0 && v < 1e8){
        const isInt = Number.isInteger(v);
        toks.push({ v, cents: !isInt || /[.,]\d{2}$/.test(m2[0]) });
      }
    }
    if (!toks.length) continue;
    const t = toks[toks.length-1];
    const sym = /[€$£]|cfa|eur|usd|gnf|ngn/.test(n);
    const tva = /tva|hors[ -]?tax|\bht\b|remise|discount/.test(n);
    const isTot = /tot/.test(n) && !/sous[ -]?tot/.test(n);
    if (isTot && !tva) cands.push({ v: t.v, cents: t.cents, p: 0 });
    else if (/montant|a payer|net|charge|ttc|grand total/.test(n)) cands.push({ v: t.v, cents: t.cents, p: 1 });
    else if (sym) cands.push({ v: t.v, cents: t.cents, p: 2 });
    else if (isTot) cands.push({ v: t.v, cents: t.cents, p: 3 });
    else if (t.cents) cands.push({ v: t.v, cents: true, p: 4 + (li < lines.length/2 ? 0.5 : 0) });
  }
  if (cands.length){
    cands.sort((a,b)=> a.p - b.p || (b.cents - a.cents) || b.v - a.v);
    out.amount = cands[0].v;
  }
  /* Marchand : 1ʳᵉ ligne surtout alphabétique, sans « facture/ticket », ni date pure */
  for (const l of lines){
    if (l.length < 2 || l.length > 40) continue;
    if (/facture|ticket|re[çc]u|caisse|magasin[ -]/i.test(l)) continue;
    const letters = (l.match(/[a-zÀ-ɏ]/gi) || []).length;
    if (letters < l.length * 0.5) continue;
    const guess = l.replace(/^[~^*|=+\-.:°•·\s]+/, "").replace(/[~^*|=+.:°•·\s]+$/, "").trim();
    if (guess.length >= 2){ out.merchant = guess.slice(0, 40); break; }
  }
  return out;
}
/* Catégorie devinée par mots-clés sur le texte OCR ; la libellé utilisateur matche aussi */
function ocrGuessCat(text){
  const nn = stripAccents(text || "").toLowerCase();
  const rules = [
    ["aliment", "supermarch", "epicerie", "marche", "boulanger", "patisserie", "cafe", "restaurant", "carrefour", "shoprite", "kiosk", "fruits", "legumes", "boucherie", "bistro", "snack", "fast food", "jus", "boisson"],
    ["transport", "carburant", "station", "taxi", "bus", "train", "metro", "uber", "bolt", "essence", "peage", "parking", "oil", "vehicule"],
    ["pharm", "medic", "clinique", "hopital", "parapharm"],
    ["facture", "electric", "eau", "internet", "telephone", "abonnement", "loyer", "credit", "forfait", "data"],
    ["loisir", "film", "cinema", "jeu", "sport", "concert", "spectacle", "netflix", "canal+", "sortie"],
    ["ecole", "scolar", "lycee", "universite", "fournitures", "cantine", "formation", "cours"],
    ["vetement", "mode", "chaussure", "tailleur", "couture", "coiff", "beaute", "salon", "cosmetic"],
  ];
  const hitRules = rules.filter(kws => kws.some(kw => nn.includes(kw)));
  if (hitRules.length){
    for (const [k, c] of Object.entries(state.cats)){
      const lb = stripAccents((c.label || "")).toLowerCase();
      if (hitRules.some(kws => kws.some(kw => lb.includes(kw)))) return k;
    }
  }
  return Object.keys(state.cats)[0];
}
function fillOcrCats(text){
  const sel = document.getElementById("ocr-cat");
  sel.innerHTML = Object.entries(state.cats).map(([k, c])=>
    `<option value="${k}">${esc(c.emoji)} ${esc(c.label)}</option>`).join("");
  sel.value = ocrGuessCat(text);
}
/* --- Flux principal --- */
async function ocrRun(file){
  if (__ocrBusy) return;
  __ocrBusy = true;
  closeSheet();                       // la fiche d'ajout manuel sous-jacente
  document.getElementById("ocr-bar-wrap").style.display = "none";
  document.getElementById("ocr-preview-wrap").style.display = "none";
  document.getElementById("ocr-fields").style.display = "none";
  document.getElementById("ocr-go").style.display = "none";
  ocrStatus(t("Analyse du reçu en cours…"));
  document.getElementById("ocr-net").style.display = window.__ocrLibP ? "none" : "block";   // 1ʳᵉ utilisation : télécharger le moteur demande le réseau
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("ocr-sheet").classList.add("show"); syncScrollLock();
  try {
    const { blob, preview } = await ocrDownscale(file);
    document.getElementById("ocr-img").src = preview;
    document.getElementById("ocr-preview-wrap").style.display = "block";
    ocrStatus(t("Chargement du moteur OCR…"));
    const w = await ocrWorker();
    document.getElementById("ocr-net").style.display = "none";
    const { data } = await w.recognize(blob);
    const text = String((data && data.text) || "");
    const ex = ocrExtract(text);
    document.getElementById("ocr-cur").textContent = state.currency;
    document.getElementById("ocr-amount").value = ex.amount ? String(ex.amount.toFixed(2)).replace(".", ",") : "";
    document.getElementById("ocr-date").value = ex.date || todayISO();
    document.getElementById("ocr-name").value = ex.merchant;
    document.getElementById("ocr-raw").textContent = text.slice(0, 4000);
    fillOcrCats(text);
    ocrWho = "me"; renderWhoSeg();
    document.getElementById("ocr-fields").style.display = "block";
    document.getElementById("ocr-go").style.display = "block";
    document.getElementById("ocr-bar-wrap").style.display = "none";
    ocrStatus(ex.amount ? t("✓ Montant détecté — vérifie avant d'ajouter") : t("⚠️ Montant non détecté — complète-le à la main"));
  } catch (err){
    console.error("Kola OCR :", err);
    toast(t("Impossible de lire le reçu 😕 — saisis-le à la main"));
    closeOcrSheet();
  }
  __ocrBusy = false;
}
function closeOcrSheet(){
  document.getElementById("ocr-sheet").classList.remove("show");
  clearSheetOverlay();
  document.getElementById("ocr-net").style.display = "none";
  ocrStatus("");
}
function saveOcrExpense(){
  const a = parseAmount(document.getElementById("ocr-amount").value);
  if (!a || a <= 0){ toast("Entre un montant valide"); return; }
  const d = document.getElementById("ocr-date").value;
  const n = document.getElementById("ocr-name").value.trim();
  const cat = document.getElementById("ocr-cat").value;
  state.expenses.push({ id: crypto.randomUUID(), name: n || catOf(cat).label, cat,
    amount: a, date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayISO(), ts: Date.now(),
    ...(couple().on ? { who: ocrWho } : {}) });
  save(); closeOcrSheet(); render();
  toast("✓ Dépense ajoutée");
}

/* Boot async : rien de ci-dessus ne touche state ; tout ce qui suit, oui */
(async () => {
await load();   // IndexedDB ⇄ localStorage
document.getElementById("today-date").textContent = new Date().toLocaleDateString(I18N_LOCALE(),{weekday:'long',day:'numeric',month:'long'});
document.getElementById("budget-input").value = state.budget;
document.getElementById("currency-select").value = state.currency;
renderLegendModeButtons();
renderHistFilter();
applyI18n();
__i18nObs.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["placeholder","aria-label","title"] });
render();
if (!state.onboarded) showOnboarding();
else setTimeout(showEveningView, 700);
setTimeout(checkInstallBanner, 1200);   // bannière d'install iOS (hors onboarding)
})().catch(err => { console.error("Kola : échec de l'init", err); toast("⚠️ Erreur au démarrage"); });
/* (le bloc PWA, ci-dessous, n'a pas besoin de state : il reste hors du IIFE async) */

function isIOSDevice(){
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se fait passer pour un Mac : détecté par écran tactile
  return /Mac/.test(ua) && (("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 1);
}
function isStandalone(){
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
}
/* Bannière iOS : iOS ne propose pas de prompt d'installation natif (pas de beforeinstallprompt),
   on guide donc l'utilisateur vers Partager → « Sur l'écran d'accueil ». Réapparait à chaque
   session tant que l'app n'est pas installée (fermable au tap, mémorisé pour la session seule). */
function checkInstallBanner(){
  const el = document.getElementById("pwa-banner");
  if (!el) return;
  const onboardingOpen = document.getElementById("onboard").classList.contains("show");
  const ok = isIOSDevice() && !isStandalone() && !onboardingOpen
             && typeof sessionStorage !== "undefined" && !sessionStorage.getItem("pwa-dismissed");
  el.classList.toggle("show", ok);
}
function dismissPwaBanner(){
  try { sessionStorage.setItem("pwa-dismissed", "1"); } catch(_){}
  const el = document.getElementById("pwa-banner"); if (el) el.classList.remove("show");
}



/* ============ PWA ============ */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").then(()=>{
    window.addEventListener("online",  ()=>toast("🛜 Connexion rétablie"));
    window.addEventListener("offline", ()=>toast("Modes hors ligne : tes données restent disponibles"));
    setTimeout(()=>toast("📲 L'app fonctionne hors ligne"), 1500);
  }).catch(()=>{});
} else if ("serviceWorker" in navigator) {
  // dev local (file://) : SW indisponible, l'app marche quand même via localStorage
}
