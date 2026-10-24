/* ============ Budget couple ============ */
/* Deux téléphones, un budget. Chaque appareil exporte/échange son delta
   (dépenses que l'autre n'a pas encore, identifiées par liste d'ids `sentIds`),
   l'autre fusionne en remappant les attributions moi⇄toi. Un `deviceId`
   stable identifie l'appareil : pas d'ambiguïté sur les prénoms. */
function couple(){
  if (!state.couple) state.couple = { on:false, partner:"", sentIds:[], lastAt:"" };
  if (!Array.isArray(state.couple.sentIds)) state.couple.sentIds = [];
  if (typeof state.couple.on !== "boolean") state.couple.on = false;
  if (!state.couple.deviceId){
    try { state.couple.deviceId = crypto.randomUUID(); } catch(_){ state.couple.deviceId = "d" + Date.now(); }
    save();
  }
  return state.couple;
}
function partnerName(){
  return (couple().partner || "").trim() || (LANG==="en" ? "Partner" : "Toi");
}
function myName(){
  return (state.user && state.user.name || "").trim() || (LANG==="en" ? "Me" : "Moi");
}
/* Attribution affichée relative à CET appareil : "me"/"partner"/"shared" */
function whoShort(e){
  if (e.who === "partner") return partnerName();
  if (e.who === "shared") return t("À deux");
  return "";
}
/* Remappage à l'import : le fichier vient-de l'autre appareil (sauf si c'est
   un second appareil de MAITRE même personne — deviceId identique). */
function remapWho(w, fromIsMe){
  if (fromIsMe || !w) return w || "me";
  return w === "me" ? "partner" : (w === "partner" ? "me" : w);
}
/* Delta à envoyer : dépenses jamais vues par l'autre (ids absents de sentIds)
   + petits blocs complets (cats/budgets/goals/recurring — fusion idempotente). */
function buildCoupleExport(st){
  st = st || state;
  const c = st.couple || {};
  const sent = new Set(c.sentIds || []);
  const expenses = st.expenses.filter(e=>!sent.has(e.id)).map(e=>({
    id:e.id, name:String(e.name||"").slice(0,60), cat:e.cat, amount:+e.amount,
    date:e.date, who:(e.who==="partner"||e.who==="shared") ? e.who : "me", ts:+e.ts || 0
  }));
  return { app:"kola-couple", schema:SCHEMA_VERSION, exportedAt: todayISO(),
    from: c.deviceId || "",
    name: ((st.user && st.user.name) || "").trim() || (LANG==="en" ? "Me" : "Moi"),
    expenses,
    cats: JSON.parse(JSON.stringify(st.cats||{})),
    budgets: JSON.parse(JSON.stringify(st.budgets||{})),
    budget: +st.budget || 0,
    goals: JSON.parse(JSON.stringify(st.goals||[])),
    recurring: JSON.parse(JSON.stringify(st.recurring||[])) };
}
/* Fusion du fichier/partage reçu dans un état donné — pure, pour les tests.
   fromIsMe=true quand le fichier provient d'un autre appareil de la même
   personne (second téléphone) : pas de swap moi⇄toi. */
function coupleMergeInto(st, bk, fromIsMe){
  const key = e => e.date + "|" + String(e.name).trim().toLowerCase() + "|" + Math.round(+e.amount*100);
  if (!fromIsMe && bk.peerName && st.couple && !st.couple.partner && st.couple !== undefined) st.couple.partner = bk.peerName;
  const byId = new Set(st.expenses.map(e=>e.id));
  const have = new Set(st.expenses.map(key));
  const sent = new Set((st.couple && st.couple.sentIds) || []);   // ids dont l'autre a déjà connaissance
  let added = 0, skipped = 0;
  bk.expenses.forEach(e=>{
    const merged = { ...e, who: remapWho(e.who, fromIsMe), ts: e.ts || Date.now() };
    if (byId.has(e.id) || have.has(key(merged))){ skipped++; sent.add(e.id); return; }
    st.expenses.push(merged); byId.add(e.id); have.add(key(merged)); sent.add(e.id); added++;
  });
  Object.entries(bk.cats || {}).forEach(([k,c])=>{ if (!st.cats[k]) st.cats[k] = c; });
  Object.entries(bk.budgets || {}).forEach(([k,v])=>{ if (st.budgets[k] === undefined && st.cats[k]) st.budgets[k] = +v; });
  (bk.goals || []).forEach(g=>{
    const mine = (st.goals || []).find(x=>x.id === g.id);
    if (!mine) st.goals.push(g);
    else if (g.saved > mine.saved) mine.saved = g.saved;
  });
  (bk.recurring || []).forEach(r=>{
    const mine = (st.recurring || []).find(x=>x.name===r.name && x.cat===r.cat && x.freq===(r.freq||"m") && Math.abs(x.amount-r.amount)<0.005);
    if (!mine) st.recurring.push(r);
    else if (r.lastAdded && r.lastAdded > (mine.lastAdded||"")) mine.lastAdded = r.lastAdded;
  });
  if (!st.budget && bk.budget) st.budget = bk.budget;
  if (!st.couple || typeof st.couple !== "object") st.couple = { on:false, partner:"", sentIds:[], lastAt:"" };
  if (!Array.isArray(st.couple.sentIds)) st.couple.sentIds = [];
  st.couple.sentIds = [...sent];
  st.couple.lastAt = todayISO();
  // le fichier d'un vrai partenaire (autre deviceId) active le couple et adopte son prénom
  if (!fromIsMe){
    if (bk.peerName && !st.couple.partner) st.couple.partner = bk.peerName;
    st.couple.on = true;
  }
  return { added, skipped };
}
/* Validation de l'objet entrant : réutilise la whitelist des sauvegardes */
function buildCoupleImport(data){
  if (!data || data.app !== "kola-couple" || !Array.isArray(data.expenses)) return null;
  const bk = buildBackup(data);
  if (!bk) return null;
  bk.app = "kola-couple";
  bk.from = SAFE_UUID.test(String(data.from||"")) ? data.from : crypto.randomUUID();
  bk.peerName = String(data.name || "").slice(0, 20);
  return bk;
}
function coupleMonthly(){
  const month = todayISO().slice(0, 7);
  const sum = { me: 0, partner: 0, shared: 0 };
  state.expenses.filter(e=>e.date.startsWith(month)).forEach(e=>{ sum[e.who || "me"] += e.amount; });
  return sum;
}
function renderCoupleCard(){
  const card = document.getElementById("couple-summary");
  if (!couple().on){ card.style.display = "none"; return; }
  const sum = coupleMonthly();
  const total = sum.me + sum.partner + sum.shared;
  const my = myName(), p = partnerName();
  document.getElementById("couple-title").textContent = t("Couple") + " · " + my + " & " + p;
  let lines = "";
  if (!total){
    lines = emptyState("💑", t("Rien ce mois"), t("Les dépenses du couple s'ajouteront ici après une synchro."));
  } else {
    lines =
      `<div class="cmp-row"><span class="cmp-lbl">${esc(my)}</span><span class="cmp-nums">${money(sum.me + sum.shared/2)}</span></div>` +
      `<div class="cmp-row"><span class="cmp-lbl">${esc(p)}</span><span class="cmp-nums">${money(sum.partner + sum.shared/2)}</span></div>`;
    const solde = sum.me - sum.partner;   // ce que j'ai avancé en trop (part commune incluse)
    if (Math.abs(solde) < 0.005) lines += `<div class="cmp-row"><span class="cmp-lbl">${t("⚖️ À égalité")}</span></div>`;
    else if (solde > 0) lines += `<div class="cmp-row"><span class="cmp-lbl">⚠️ ${esc(p)} ${tt("doit {a} à {b}", {a: money(solde/2), b: esc(my)})}</span></div>`;
    else lines += `<div class="cmp-row"><span class="cmp-lbl">⚠️ ${esc(my)} ${tt("doit {a} à {b}", {a: money(-solde/2), b: esc(p)})}</span></div>`;
  }
  document.getElementById("couple-split").innerHTML = lines;
  card.style.display = "block";
}
function renderCoupleSettings(){
  const c = couple();
  document.getElementById("couple-on").checked = !!c.on;
  ["couple-partner-row","couple-export-row","couple-import-row","couple-pair-row"].forEach(id=>{
    document.getElementById(id).style.display = c.on ? "flex" : "none";
  });
  document.getElementById("partner-name-input").value = c.partner || "";
  document.getElementById("couple-last").textContent =
    c.lastAt ? tt("échangé le {a}", {a: c.lastAt}) : t("jamais");
}
/* --- UI : export du fichier d'échange, import-fusion, fiche d'aperçu --- */
let pendingCouple = null;
async function exportCouple(){
  const c = couple(); if (!c.on) return;
  const payload = buildCoupleExport();
  const me = myName().toLowerCase().replace(/[^a-z0-9]/g, "") || "moi";
  const data = JSON.stringify(payload, null, 2);
  const how = await shareOrDownload(data, "application/json", `kola-couple-${me}-${todayISO()}.json`, "📤 Fichier d'échange prêt");
  if (how === "cancelled") return;
  const sent = new Set(c.sentIds || []);
  payload.expenses.forEach(e=>sent.add(e.id));
  c.sentIds = [...sent];
  c.lastAt = todayISO();
  save(); render();
}
function openExportSheet(){
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("export-sheet").classList.add("show"); syncScrollLock();
}
function closeExportSheet(){
  document.getElementById("export-sheet").classList.remove("show");
  clearSheetOverlay();
}
function couplePick(){ document.getElementById("couple-file").click(); }
function importCoupleFile(file){
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let bk = null;
    try { bk = buildCoupleImport(JSON.parse(fr.result)); }
    catch (_){ bk = null; }
    if (!bk){ toast(t("Ce fichier n'est pas un fichier d'échange couple")); return; }
    openCoupleSheet(bk);
  };
  fr.readAsText(file);
}
function openCoupleSheet(bk){
  pendingCouple = bk;
  const fromIsMe = couple().deviceId === bk.from;
  const pName = fromIsMe ? myName() : (bk.peerName || partnerName());
  document.getElementById("couple-sheet-title").textContent = tt("Échange de {a}", {a: pName});
  const key = e => e.date + "|" + String(e.name).trim().toLowerCase() + "|" + Math.round(+e.amount*100);
  const have = new Set(state.expenses.map(key));
  const byIds = new Set(state.expenses.map(e=>e.id));
  const dups = bk.expenses.filter(e=>byIds.has(e.id) || have.has(key(e))).length;
  document.getElementById("couple-preview").innerHTML =
    `<div class="empty" style="padding:4px 0 6px">
      📂 ${tt("{n} dépense(s)", {n: bk.expenses.length})} · ${(bk.goals||[]).length} ${t("objectif(s)")} · ${(bk.recurring||[]).length} ${t("récurrence(s)")}
      <br><b>${dups ? tt("{n} doublon(s) ignoré(s) à la fusion", {n: dups}) : t("Aucun doublon à la fusion")}</b>
    </div>`;
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("couple-sheet").classList.add("show"); syncScrollLock();
}
function applyCoupleMerge(){
  const bk = pendingCouple; if (!bk) return;
  const fromIsMe = couple().deviceId === bk.from;
  if (!fromIsMe && bk.peerName && !couple().partner) couple().partner = bk.peerName;
  if (!couple().on) couple().on = true;   // un fichier d'échange reçu vaut activation
  const res = coupleMergeInto(state, bk, fromIsMe);
  pendingCouple = null;
  closeCoupleSheet(); save(); render();
  toast(res.added
    ? tt("📥 {n} dépense(s) de {a} ajoutée(s)", {n: res.added, a: partnerName()})
    : t("Rien de nouveau — à jour"));
}
function closeCoupleSheet(){
  document.getElementById("couple-sheet").classList.remove("show");
  clearSheetOverlay();
  pendingCouple = null;
}
/* --- Synchro P2P (WebRTC + QR) ---
   Même Wi-Fi, zéro serveur : le SDP compressé passe par un QR (déflatre-raw +
   base64url, préfixe SK1). Le remplacement des candidates host/mDNS requiert
   le même réseau local ; sinon, le fichier d'échange reste le recours. */
let __pair = null;   // { pc, dc, role, stream }
const PAIR_PREFIX = "SK1:";
function pairStatus(msg){
  const el = document.getElementById("pair-status");
  el.textContent = msg; el.style.display = msg ? "block" : "none";
}
/* libs QR lazy-loadées avant toute fiche qui les affiche ou scanne */
async function pairLibsOrNotify(){
  try { await pairLibs(); return true; }
  catch (_) { pairStatus(t(QR_NET_MSG)); return false; }
}
function openPairSheet(){
  document.getElementById("pair-choice").style.display = "";
  document.getElementById("pair-stage").style.display = "none";
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("pair-sheet").classList.add("show"); syncScrollLock();
}
function pairClose(){
  if (__pair){ try { __pair.pc && __pair.pc.close(); } catch(_){} stopPairScan(); __pair = null; }
  document.getElementById("pair-sheet").classList.remove("show");
  clearSheetOverlay();
  pairStatus("");
}
/* --- compression du code (deflate-raw → base64url ; SK1:) --- */
async function pairEncode(obj){
  const raw = JSON.stringify(obj);
  let body = raw;
  try { if (window.CompressionStream){
    const resp = new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw")));
    body = bufToB64url(new Uint8Array(await resp.arrayBuffer()));
  } } catch(_){ /* sans compression : le SDP brut tient souvent quand même */ }
  return PAIR_PREFIX + body;
}
async function pairDecode(text){
  text = String(text || "").trim();
  if (!text.startsWith(PAIR_PREFIX)) return null;
  let body = text.slice(PAIR_PREFIX.length);
  try {
    const buf = b64urlToBuf(body);
    const resp = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("deflate-raw")));
    return JSON.parse(await resp.text());
  } catch (_){}
  try { return JSON.parse(body.replace(/^deflate:/, "")); }   // repli non-compressé
  catch (e){ return null; }
}
/* --- WebRTC --- */
function pairPeer(){
  const pc = new RTCPeerConnection({ iceServers: [] });   // host-only : même Wi-Fi, rien ne quitte le réseau local
  return pc;
}
function waitIce(pc){
  return new Promise(res=>{
    if (pc.iceGatheringState === "complete") return res();
    const to = setTimeout(res, 2500);   // on prend ce qu'on a : host candidates suffisants
    pc.addEventListener("icegatheringstatechange", ()=>{
      if (pc.iceGatheringState === "complete"){ clearTimeout(to); res(); }
    });
  });
}
function pairShowQr(text){
  try {
    const qr = qrcode(0, "L"); qr.addData(text, "Byte"); qr.make();
    const img = document.getElementById("pair-qr");
    img.src = qr.createDataURL(Math.max(2, Math.floor(260 / (qr.getModuleCount() + 8))), 4);
    img.style.display = "block";
    document.getElementById("pair-video").style.display = "none";
    return true;
  } catch (err){ return false; }
}
async function pairOffer(){
  if (!await pairLibsOrNotify()) return;
  pairStatus(t("Préparation du code…"));
  try { await pairLibs(); } catch(_){ pairStatus(t(QR_NET_MSG)); return; }
  document.getElementById("pair-choice").style.display = "none";
  document.getElementById("pair-stage").style.display = "block";
  document.getElementById("pair-qr").style.display = "";
  document.getElementById("pair-video").style.display = "none";
  const pc = pairPeer();
  const dc = pc.createDataChannel("kola");
  hookDataChannel(dc);
  await pc.setLocalDescription(await pc.createOffer());
  await waitIce(pc);
  const code = await pairEncode({ t:"offer", sdp: pc.localDescription.sdp });
  if (!pairShowQr(code)){ pairStatus(t("Code trop long — utilise le fichier d'échange 📤")); return; }
  pairStatus(t("L'autre téléphone scanne ce code (Réglages → Budget couple → 📷)"));
  __pair = { pc, dc, role:"offer", offerCode: code };   // code récupérable sans scanner (tests, repli)
  // repli clipboard pour QR illisible
  const ta = document.getElementById("pair-paste");
  ta.style.display = "block";
  ta.value = "";
  document.getElementById("pair-use-paste").style.display = "block";
  document.getElementById("pair-scan-answer").style.display = "block";
}
async function pairAcceptOffer(code){
  if (!await pairLibsOrNotify()) return false;
  const msg = await pairDecode(code);
  if (!msg || msg.t !== "offer"){ toast(t("Code invalide")); return false; }
  if (__pair){ try { __pair.pc && __pair.pc.close(); } catch(_){} stopPairScan(); }
  const pc = pairPeer();
  await pc.setRemoteDescription({ type:"offer", sdp: msg.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await waitIce(pc);
  __pair = { pc, dc:null, role:"answer" };
  pc.ondatachannel = e => hookDataChannel(e.channel);
  const code2 = await pairEncode({ t:"answer", sdp: pc.localDescription.sdp });
  __pair.answerCode = code2;
  if (!pairShowQr(code2)){ pairStatus(t("Code réponse trop long — utilise le fichier d'échange 📤")); return false; }
  pairStatus(t("Fais scanner ce code par l'autre téléphone"));
  document.getElementById("pair-paste").value = code2;
  return true;
}
async function pairUsePaste(codeArg){
  const ta = document.getElementById("pair-paste");
  const code = (codeArg || ta.value || "").trim();   // argument (rempli par test/P2P) sinon le champ

  if (!code) return;
  if (__pair && __pair.scanning) stopPairScan();
  if (__pair && __pair.role === "offer"){
    const msg = await pairDecode(code);
    if (!msg || msg.t !== "answer"){ toast(t("Code invalide")); return; }
    try { await __pair.pc.setRemoteDescription({ type:"answer", sdp: msg.sdp }); }
    catch(err){ toast(t("Code invalide")); return; }
    ta.value = ""; ta.style.display = "none";
    return;
  }
  await pairAcceptOffer(code);
}
async function pairScanAnswer(){ stopPairScan(); __pair.scanning = true; pairScanLoop(); }
/* --- scanner QR (jsQR sur le flux caméra) --- */
function stopPairScan(){
  if (__pair && __pair.stream){ __pair.stream.getTracks().forEach(t=>t.stop()); __pair.stream = null; }
  __pair && (__pair.scanning = false);
}
async function pairScan(){
  if (!await pairLibsOrNotify()) return;
  document.getElementById("pair-choice").style.display = "none";
  document.getElementById("pair-stage").style.display = "block";
  pairStatus(t("Caméra en cours…"));
  try { await pairLibs(); } catch(_){ pairStatus(t(QR_NET_MSG)); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment", width:{ideal:1280} } });
  } catch(err){ pairStatus(t("Caméra indisponible — colle le code dans le champ"));; 
    document.getElementById("pair-paste").style.display = "block";
    document.getElementById("pair-use-paste").style.display = "block";
    return; }
  if (!__pair) __pair = { pc:null, dc:null, role:"scan", stream };
  __pair.stream = stream;
  const video = document.getElementById("pair-video");
  video.srcObject = stream; video.style.display = "block";
  document.getElementById("pair-qr").style.display = "none";
  await video.play().catch(()=>{});
  __pair.scanning = true;
  pairScanLoop();
}
function pairScanLoop(){
  if (!__pair || !__pair.scanning || !__pair.stream) return;
  const video = document.getElementById("pair-video");
  if (video.readyState >= 2){
    const c = document.createElement("canvas");
    const w = Math.min(video.videoWidth || 640, 480), h = Math.round(w * (video.videoHeight / (video.videoWidth || 640)));
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const im = ctx.getImageData(0, 0, w, h);
    const found = window.jsQR && jsQR(im.data, im.width, im.height, { inversionAttempts: "dontInvert" });
    if (found && found.data){
      __pair.scanning = false;
      stopPairScan();
      pairOnScan(found.data);
    }
  }
  setTimeout(pairScanLoop, 180);
}
async function pairOnScan(data){
  if (__pair && __pair.role === "offer"){
    // initiateur : on attend la réponse de l'autre téléphone
    const msg = await pairDecode(data);
    if (!msg || msg.t !== "answer"){ __pair.scanning = true; pairScanLoop(); return; }
    try { await __pair.pc.setRemoteDescription({ type:"answer", sdp: msg.sdp }); }
    catch(err){ pairStatus(t("Code invalide")); __pair.scanning = true; pairScanLoop(); return; }
    document.getElementById("pair-video").style.display = "none";
    pairStatus(t("Connexion… synchronisation"));
    return;
  }
  // accepteur : on vient de scanner l'offre → on fabrique la réponse
  const ok = await pairAcceptOffer(data);
  if (!ok) pairStatus(t("Code invalide"));
}
/* --- canal de données : échange des delta couples, comme un fichier --- */
function hookDataChannel(dc){
  if (!__pair) __pair = { pc:null, role:"handoff" };
  __pair.dc = dc;
  dc.onopen = () => {
    pairStatus(t("Connecté — échange des dépenses…"));
    const payload = JSON.stringify(buildCoupleExport());
    if (payload.length > 150000){   // au-delà, le canal sature : le fichier reste le recours
      pairStatus(t("Historique trop gros 📤 — utilise le fichier d'échange"));
      return;
    }
    dc.send(payload);
  };
  dc.onmessage = ev => pairOnPayload(String(ev.data));
  dc.onerror = () => pairStatus(t("Connexion perdue — réessaie ou utilise le fichier 📤"));
}
function pairOnPayload(text){
  let bk = null;
  try { bk = buildCoupleImport(JSON.parse(text)); } catch(_){ bk = null; }
  if (!bk){ toast(t("Code invalide")); return; }
  const fromIsMe = couple().deviceId === bk.from;
  if (!fromIsMe && bk.peerName && !couple().partner) couple().partner = bk.peerName;
  if (!couple().on) couple().on = true;
  const res = coupleMergeInto(state, bk, fromIsMe);
  couple().lastAt = todayISO();
  save(); render();
  pairStatus(res.added
    ? tt("✓ Synchro faite — {n} dépense(s) ajoutée(s)", { n: res.added })
    : t("✓ Synchro faite — à jour"));
  toast(res.added ? tt("📥 {n} dépense(s) de {a} ajoutée(s)", { n: res.added, a: partnerName() }) : t("Rien de nouveau — à jour"));
}
/* --- lazy-load des libs QR (vendored, ~150 Ko) : offre/réponse et scan --- */
const QR_URL = "./vendor/qr/";
function pairLibs(){
  const need = [];
  if (typeof window.qrcode !== "function") need.push("qrcode.min.js");
  if (typeof window.jsQR !== "function") need.push("jsQR.min.js");
  if (!need.length) return Promise.resolve();
  if (window.__pairLibP) return window.__pairLibP;
  window.__pairLibP = Promise.all(need.map(n => new Promise((res, rej)=>{
    const s = document.createElement("script");
    s.src = QR_URL + n;
    s.onload = ()=>res(); s.onerror = ()=>rej(new Error("lib QR manquante"));
    document.head.appendChild(s);
  }))).catch(err => { window.__pairLibP = null; throw err; });
  return window.__pairLibP;
}
const QR_NET_MSG = "Impossible de charger les outils QR — vérifie ta connexion";

/* --- base64url --- */
function bufToB64url(buf){
  let bin = ""; buf.forEach(b=>bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBuf(s){
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s); const buf = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

/* --- Choix "Qui a payé ?" (3 fiches de saisie) --- */
let pickedWho = "me", editWho = "me", ocrWho = "me";
function renderWhoSeg(){
  if (!state || !state.couple) return;
  const on = !!couple().on;
  ["who-field","who-edit-field","who-ocr-field"].forEach(id=>{
    const f = document.getElementById(id); if (f) f.style.display = on ? "block" : "none";
  });
  const pb = document.getElementById("who-partner-btn");
  if (pb) pb.textContent = partnerName();
  [["who-seg", pickedWho], ["who-edit-seg", editWho], ["who-ocr-seg", ocrWho]].forEach(([id, cur])=>{
    const seg = document.getElementById(id); if (!seg) return;
    seg.querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.w === cur));
  });
}
/* ====== Vue du soir : résumé du jour + rappels (alternative 100% locale aux push) ====== */
function showEveningView(){
  if (!state.onboarded) return;
  const h = new Date().getHours();
  if (h < 18 && h >= 5) return;
  if (state.eveningSeen === todayISO()) return;
  renderEveningView();
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("evening-sheet").classList.add("show"); syncScrollLock();
}
function eveningDismiss(){
  state.eveningSeen = todayISO();   // une fois par soir
  save(); closeEveningSheet();
}
function closeEveningSheet(){
  document.getElementById("evening-sheet").classList.remove("show");
  clearSheetOverlay();
}
function renderEveningView(){
  const host = document.getElementById("evening-content");
  const today = todayISO();
  const todays = state.expenses.filter(e=>e.date===today).slice().sort((a,b)=>b.amount-a.amount);   // montant desc : la plus grosse en tête
  const totalToday = todays.reduce((s,e)=>s+e.amount,0);
  const month = today.slice(0,7);
  const bud = catBudgetTotal() || state.budget;
  const spent = state.expenses.filter(e=>e.date.startsWith(month)).reduce((s,e)=>s+e.amount,0);
  let lines = "";
  if (!todays.length){
    lines += `<div class="setrow"><div class="n" style="color:var(--secondary-label);font-size:14px">${t("Rien saisi aujourd'hui — tout va bien.")}</div></div>`;
  } else {
    lines += `<div class="setrow"><div class="n">${tt("Aujourd'hui : {n} dépense(s) · ", {n: todays.length})}<b>${money(totalToday)}</b></div></div>`;
    if (todays[0]) lines += `<div class="setrow"><div class="n" style="font-size:13.5px">${esc(catOf(todays[0].cat).emoji)} ${t("Plus grosse dépense")} : <b>${money(todays[0].amount)}</b> — ${esc(todays[0].name)}</div></div>`;
  }
  if (bud > 0){
    const rest = bud - spent;
    lines += rest >= 0
      ? `<div class="setrow"><div class="n">${t("Solde mensuel restant")} : <b>${money(rest)}</b></div></div>`
      : `<div class="setrow"><div class="n" style="color:var(--red)">⚠️ ${tt("{a} de trop sur le mois", {a: money(-rest)})}</div></div>`;
  }
  if (state.expenses.length && !(state.lastBackupAt)) lines += `<div class="setrow"><div class="n" style="font-size:13.5px">${t("Aucune sauvegarde depuis la création — ton historique mérite un fichier")}</div></div>`;
  // Rappels : échéances dettes/créances de TOUS les livres (≤ 7 jours ou dépassées)
  const debtsAll = [...(state.debts || []),
    ...getBooks().filter(b => b.id !== state.bookId).flatMap(b => (b.data.debts || []))];
  const due = dueReminders(debtsAll, today);
  if (due.length){
    lines += `<div class="list-header" style="padding:10px 0 4px"><span class="t">⏰ ${t("Échéances à venir")}</span></div>`;
    due.forEach(r => {
      const dl = r.days < 0
        ? tt("En retard de {n} jour{p}", { n: -r.days, p: r.days < -1 ? "s" : "" })
        : r.days === 0 ? t("Échéance aujourd'hui")
        : r.days === 1 ? t("Échéance demain")
        : tt("Dans {n} jour{p}", { n: r.days, p: r.days > 1 ? "s" : "" });
      const col = r.days < 0 ? "var(--red)" : "";
      lines += `<div class="setrow" style="cursor:pointer" onclick="closeEveningSheet(); openDebtSheetGlobal('${r.debtId || ""}')" role="button" tabindex="0" aria-label="${esc(r.name)}">
        <div class="n" style="font-size:14px">${r.dir === "dois" ? "💸" : "🤝"} ${esc(r.name)}
          <div style="font-size:12px;color:${col || "var(--secondary-label)"}">${esc(dl)} · ${tt("{a} restants", { a: money(r.remain) })}</div>
        </div>
        <div class="v chev">›</div>
      </div>`;
    });
  }
  host.innerHTML = lines;
}
/* Tap sur un rappel d'échéance : ouvre la fiche de la dette, où qu'elle vive */
function openDebtSheetGlobal(debtId){
  if (state.debts.some(d => d && d.id === debtId)){ openDebtSheet(debtId); return; }
  const holder = getBooks().find(b => (b.data.debts || []).some(d => d && d.id === debtId));
  if (!holder) return;
  bookSwitch(holder.id);
  openDebtSheet(debtId);
}
function openDeviceSheet(){
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("device-sheet").classList.add("show"); syncScrollLock();
}
function closeDeviceSheet(){
  document.getElementById("device-sheet").classList.remove("show");
  clearSheetOverlay();
}
function closeBackupSheet(){
  document.getElementById("backup-sheet").classList.remove("show");
  clearSheetOverlay();
  backupPending = null;
}
/* Fusion dédoublonnée d'un ledger (dépenses, cats, enveloppes, objectifs, récurrences)
   dans une destination à plat — utilisée par le merge simple et le merge par livre. */
function mergeLedgerInto(dst, src){
  let added = 0;
  const key = e => e.date + "|" + String(e.name).trim().toLowerCase() + "|" + Math.round(+e.amount*100);
  const have = new Set(dst.expenses.map(key));
  src.expenses.forEach(e=>{ const k = key(e); if (!have.has(k)){ dst.expenses.push(e); have.add(k); added++; } });
  Object.entries(src.cats||{}).forEach(([k,c])=>{ if (!dst.cats[k]) dst.cats[k] = c; });
  Object.entries(src.budgets||{}).forEach(([k,v])=>{ if (dst.budgets[k] === undefined && dst.cats[k]) dst.budgets[k] = +v; });
  (src.goals||[]).forEach(g=>{
    const mine = (dst.goals||[]).find(x=>x.id === g.id);
    if (!mine) dst.goals.push(g);
    else if (g.saved > mine.saved) mine.saved = g.saved;   // progression cumulée max
  });
  (src.recurring||[]).forEach(r=>{
    const mine = (dst.recurring||[]).find(x=>x.name===r.name && x.cat===r.cat && x.freq===(r.freq||"m") && Math.abs(x.amount-r.amount)<0.005);
    if (!mine) dst.recurring.push(r);
    else if (r.lastAdded && r.lastAdded > (mine.lastAdded||"")) mine.lastAdded = r.lastAdded;
  });
  let addedDebts = 0;
  if (!Array.isArray(dst.debts)) dst.debts = [];
  (src.debts||[]).forEach(d=>{
    const mine = dst.debts.find(x=>x.id === d.id ||
      (x.name===d.name && x.dir===d.dir && x.date===d.date && Math.abs(x.amount-d.amount)<0.005));
    if (!mine){ dst.debts.push({ ...d, payments: (d.payments||[]).map(p=>({...p})) }); addedDebts++; }
    else {
      if (d.paid > mine.paid) mine.paid = d.paid;   // reprise : le plus remboursé gagne
      // journal des remboursements : union par id de paiement
      if (Array.isArray(d.payments) && d.payments.length){
        if (!Array.isArray(mine.payments)) mine.payments = [];
        d.payments.forEach(p => { if (p && !mine.payments.some(x => x.id === p.id)) mine.payments.push({ ...p }); });
      }
    }
  });
  return { added, addedDebts };
}
function applyBackupMerge(){
  const bk = backupPending; if (!bk) return;
  let added = 0, addedDebts = 0;
  if (Array.isArray(bk.books) && bk.books.length){
    // Fichier multi-livres : fusion par id (sinon par nom, sinon nouveau livre)
    bk.books.forEach(sb=>{
      const data = sb.data || sb;
      const mine = state.books.find(x=>x.id===sb.id) || state.books.find(x=>x.name===sb.name);
      if (mine){
        const r = mergeLedgerInto(mine.data, data);
        added += r.added; addedDebts += r.addedDebts;
        if (!+mine.data.budget && +data.budget) mine.data.budget = +data.budget;
        if (sb.theme && !mine.theme) mine.theme = sb.theme;   // adopte le thème du livre importé
      } else {
        state.books.push({ id: sb.id, name: sb.name, emoji: sb.emoji, ...(sb.theme ? { theme: sb.theme } : {}),
          data: { budget:+data.budget||0, expenses:(data.expenses||[]).slice(), budgets:{...(data.budgets||{})},
                  recurring:(data.recurring||[]).slice(), goals:(data.goals||[]).map(g=>({...g})), cats:{...(data.cats||{})},
                  kind: data.kind === "dettes" ? "dettes" : "dep", debts:(data.debts||[]).map(d=>({...d, payments:(d.payments||[]).map(p=>({...p}))})) } });
        added += (data.expenses||[]).length;
      }
    });
  } else {
    // Fichier à plat (ancien format) : fusion dans le livre courant
    ({ added, addedDebts } = mergeLedgerInto({ expenses: state.expenses, cats: state.cats, budgets: state.budgets, goals: state.goals, recurring: state.recurring, debts: state.debts }, bk));
    if (!state.budget && bk.budget) state.budget = bk.budget;
  }
  if (!state.user.name && bk.user.name) state.user.name = bk.user.name;
  if (bk.couple){
    if (!state.couple || typeof state.couple !== "object") state.couple = { on:false, partner:"", sentIds:[], lastAt:"" };
    if (!Array.isArray(state.couple.sentIds)) state.couple.sentIds = [];
    if (bk.couple.partner && !state.couple.partner) state.couple.partner = bk.couple.partner;
    if (bk.couple.on && !state.couple.on) state.couple.on = true;
    const sent = new Set(state.couple.sentIds || []);
    (bk.couple.sentIds||[]).forEach(x=>sent.add(x));
    state.couple.sentIds = [...sent];
  }
  state.lastBackupAt = ymd(new Date());
  closeBackupSheet();
  save(); renderHistFilter(); switchTab("home"); render(); renderBookbar(); renderBooksRow();
  toast(tt("📥 {n} dépense(s) ajoutée(s) par fusion", {n: added}));
  if (addedDebts) toast(tt("🤝 {n} dette(s) fusionnée(s)", {n: addedDebts}));
}
function applyBackupReplace(){
  const bk = backupPending; if (!bk) return;
  const totalExp = Array.isArray(bk.books)
    ? bk.books.reduce((n,b)=>n + ((b.data||b).expenses||[]).length, 0)
    : bk.expenses.length;
  if (!confirm(tt("Remplacer TOUTES les données de cet appareil par le fichier ({n} dépense(s)) ?", {n: totalExp}))) return;
  const ownRev = +state.rev || 0;       // rev locale (au moins celle de la copie IDB, sinon l'IDB écraserait le remplacement au boot suivant)
  // Préférences locales conservées : le fichier ne les référence pas
  const keep = { lang: state.lang, legendMode: state.legendMode, eveningSeen: state.eveningSeen };
  state = bk;
  Object.assign(state, keep);
  booksEnsure();                        // normalise les livres et remonte le livre actif à plat
  state.rev = Math.max(ownRev, +bk.rev || 0);
  state.lastBackupAt = ymd(new Date());
  closeBackupSheet();
  save(); renderHistFilter(); switchTab("home"); render(); renderBookbar(); renderBooksRow();
  toast(tt("📥 {n} dépense(s) importée(s)", {n: totalExp}));
}
function installPWA(){
  if (!deferredPrompt){ toast("iPhone : Partager → « Sur l'écran d'accueil »"); return; }
  deferredPrompt.prompt();
  deferredPrompt = null;
}
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault(); deferredPrompt = e;
  const row = document.getElementById("install-row");
  if (row) row.style.display = "flex";
});
/* Partage natif (iOS : data:/anchor ignorés en app installée) avec repli téléchargement blob */
function shareOrDownload(data, mime, name, okMsg){
  if (navigator.share && navigator.canShare){
    try {
      const file = new File([data], name, { type:mime });
      if (navigator.canShare({ files:[file] })){
        return navigator.share({ files:[file], title:name })
          .then(()=>{ toast(okMsg + " — enregistre-le dans Fichiers"); return "shared"; })
          .catch(err=>{ if (err && err.name === "AbortError") return "cancelled"; return shareOrDownloadFallback(data, name); });
      }
    } catch(_){ /* partage indisponible : repli */ }
  }
  return Promise.resolve(shareOrDownloadFallback(data, name));
}
function shareOrDownloadFallback(data, name){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type:"application/octet-stream" }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
function exportCSV(){
  if (state.kind === "dettes") return exportDebtsCSV();
  const rows = [["Date","Libellé","Catégorie","Montant"]];
  [...state.expenses].sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    rows.push([e.date, e.name, catOf(e.cat).label, e.amount.toFixed(2)]);
  });
  const csv = "﻿" + rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  shareOrDownload(csv, "text/csv", "kola-" + todayISO() + ".csv", "📤 CSV exporté").then(how=>{
    if (how === "downloaded") toast("📤 CSV exporté");
  });
}
/* Livre dettes : CSV dédié (démontrable au partage, ré-importable nulle part — gardé par detectDebtsCsv) */
function exportDebtsCSV(){
  const rows = [["Date","Type","Personne","Montant","Remboursements","Restant","Échéance"]];
  [...state.debts].sort((a,b)=>b.date.localeCompare(a.date)).forEach(d=>{
    rows.push([d.date, d.dir === "me" ? t("On me doit") : t("Je dois"), d.name, (+d.amount).toFixed(2),
               (+d.paid||0).toFixed(2), debtRemain(d).toFixed(2), d.due || ""]);
    [...(d.payments||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))).forEach(p=>{
      rows.push([p.date, t("Remboursement"), d.name, (+p.amount).toFixed(2), "", "", ""]);
    });
  });
  const csv = "﻿" + rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  shareOrDownload(csv, "text/csv", "kola-dettes-" + todayISO() + ".csv", "📤 CSV des dettes exporté").then(how=>{
    if (how === "downloaded") toast("📤 " + t("CSV des dettes exporté"));
  });
}
/* Les exports dettes ne doivent jamais se ré-importer comme relevés bancaires */
function isDebtsCsv(txt){
  const first = String(txt || "").replace(/^[﻿\s]*/, "").split(/\r?\n/, 1)[0];
  return /"?Date"?;?\s*"?Type"?;?\s*"?Personne"?;?/i.test(first);
}
const HIST_PAGE = 200;
let histShown = HIST_PAGE;
/* Historique d'un livre dettes : chronologie dettes/créances + remboursements */
function applyDebtHistoryFilter(){
  const f = document.getElementById("hist-filter").dataset.c || "all";
  const q = (document.getElementById("hist-search").value || "").toLowerCase().trim();
  let items = debtLedgerEntries(state.debts);
  if (f === "dois") items = items.filter(e => e.dir === "dois");
  else if (f === "me") items = items.filter(e => e.dir === "me");
  else if (f === "pays") items = items.filter(e => e.t === "pay");
  if (q) items = items.filter(e => e.name.toLowerCase().includes(q));
  document.getElementById("history-sub").textContent = tt("{n} entrée(s)", { n: items.length })
    + (f === "pays" && items.length ? " · " + money(items.reduce((s,e)=>s+e.amount,0)) : "");
  const shown = items.slice(0, histShown);
  renderDebtHistoryList(shown);
  if (items.length > shown.length){
    const host = document.getElementById("history-list");
    const btn = document.createElement("button");
    btn.className = "btn-ghost"; btn.style.margin = "8px 16px 0"; btn.style.width = "calc(100% - 32px)";
    btn.textContent = tt("Afficher plus ({n} restantes)", { n: items.length - shown.length });
    btn.onclick = () => { histShown += HIST_PAGE; applyDebtHistoryFilter(); };
    host.appendChild(btn);
  }
}
function renderDebtHistoryList(items){
  const host = document.getElementById("history-list");
  if (!items.length){
    host.innerHTML = emptyState("🤝", t("Aucune dette pour le moment."),
      t("Tape ＋ pour suivre ce que tu dois ou ce qu'on te doit."));
    return;
  }
  const groups = {};
  items.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
  let html = "";
  Object.keys(groups).sort().reverse().forEach(d => {
    // pas de total de jour : dettes et remboursements ne doivent jamais être mélangés en une seule somme
    html += `<div class="list-header"><span class="t" style="font-size:15px;color:var(--secondary-label);text-transform:capitalize">${esc(dayName(d))}</span></div><div class="group">`;
    groups[d].forEach(e => {
      html += `<div class="rowitem" role="button" tabindex="0" onclick="openDebtSheet('${e.debtId}')"
        aria-label="${esc(tt("Dette : {a}, {b}", { a: e.name, b: money(e.amount) }))}">
        <div class="icon-badge" style="background:${e.t === "pay" ? "rgba(52,199,89,.16)" : "rgba(var(--accent-rgb),.14)"}">${e.t === "pay" ? "🔁" : e.dir === "dois" ? "💸" : "🤝"}</div>
        <div class="txt"><div class="n">${esc(e.name)}</div><div class="d">${esc(e.t === "pay" ? t("Remboursement") : (e.dir === "dois" ? t("Je dois") : t("On me doit")) + (e.due ? " · " + tt("Échéance {a}", { a: dayName(e.due) }) : ""))}</div></div>
        <div class="amt" style="color:${e.t === "pay" ? "var(--green)" : (e.dir === "dois" ? "var(--red)" : "var(--label)")}"
        >${e.t === "pay" ? "+" : e.dir === "dois" ? "−" : "+"}${money(e.amount)}</div>
      </div>`;
    });
    html += `</div>`;
  });
  host.innerHTML = html;
}
function applyHistoryFilter(){
  if (state.kind === "dettes") return applyDebtHistoryFilter();
  const f = document.getElementById("hist-filter").dataset.c || "all";
  const q = (document.getElementById("hist-search").value||"").toLowerCase().trim();
  const all = [...state.expenses].sort(byRecent);
  let items = f==="all" ? all : all.filter(e=>e.cat===f);
  if (q) items = items.filter(e=> e.name.toLowerCase().includes(q) || catOf(e.cat).label.toLowerCase().includes(q));
  const total = items.reduce((s,e)=>s+e.amount,0);
  document.getElementById("history-sub").textContent =
    tt("{n} transaction(s) · {t}", {n: items.length, t: money(total)});
  const shown = items.slice(0, histShown);
  let emptyMsg;
  if (!items.length){
    const c = catOf(f);
    if (q) emptyMsg = emptyState("🔍", tt("Aucun résultat pour «\u00a0{a}\u00a0»", {a: esc(q)}), t("Vérifie l'orthographe ou essaie un autre mot."));
    else if (f !== "all") emptyMsg = emptyState(c.emoji, tt("Rien en {a} pour le moment", {a: esc(c.label)}), t("Ajoute une dépense dans cette catégorie — ou vois tout."));
  }
  renderList("history-list", shown, false, emptyMsg);
  if (items.length > shown.length){
    const host = document.getElementById("history-list");
    const btn = document.createElement("button");
    btn.className = "btn-ghost";
    btn.style.margin = "8px 16px 0";
    btn.style.width = "calc(100% - 32px)";
    btn.textContent = tt("Afficher plus ({n} restantes)", {n: items.length - shown.length});
    btn.onclick = () => { histShown += HIST_PAGE; applyHistoryFilter(); };
    host.appendChild(btn);
  }
}

/* ============ Série de saisie (gamification) ============ */
function enterStreak(){
  if (!state.expenses.length) return 0;
  const days = new Set(state.expenses.map(e=>e.date));
  let streak = 0, d = new Date();
  const today = todayISO();
  if (!days.has(today)){
    d = new Date(d.getTime()-DAY);
    if (!days.has(ymd(d))) return 0;
  }
  while (days.has(ymd(d))){ streak++; d = new Date(d.getTime()-DAY); }
  return streak;
}

/* ============ Glisser pour fermer (sheets) ============ */
function enableSwipeClose(sheetEl, closeFn){
  let y0 = null, dy = 0;
  sheetEl.addEventListener("touchstart", e=>{
    if (sheetEl.scrollTop > 4) return;
    y0 = e.touches[0].clientY; dy = 0; sheetEl.style.transition = "none";
  }, {passive:true});
  sheetEl.addEventListener("touchmove", e=>{
    if (y0===null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) sheetEl.style.transform = `translateY(${dy}px)`;
  }, {passive:true});
  sheetEl.addEventListener("touchend", ()=>{
    if (y0===null) return;
    sheetEl.style.transition = ""; y0 = null;
    if (dy > 90){ sheetEl.style.transform = ""; closeFn(); }
    else sheetEl.style.transform = "";
  });
}

/* ============ Onboarding ============ */
const CURRENCIES = [["€","Euro"],["FCFA","Franc CFA"],["CAD $","Dollar CAD"],["$","Dollar US"],["£","Livre"],["CHF","Franc suisse"]];
let ob = { currency:"€" };

function showOnboarding(){
  ob = { currency:"€", name:"", budget:0 };
  document.getElementById("ob-name").value = "";
  document.getElementById("ob-budget").value = "";
  document.getElementById("ob-autosplit").checked = true;
  const grid = document.getElementById("ob-currencies");
  grid.innerHTML = CURRENCIES.map(([v,l])=>
    `<button class="${v===ob.currency?"on":""}" data-v="${v}" onclick="obPickCur('${v}')">${l}<span style="display:block;font-size:13px;color:var(--secondary-label);margin-top:2px">${v}</span></button>`).join("");
  document.getElementById("ob-bud-cur").textContent = ob.currency;
  document.getElementById("onboard").classList.add("show");
  obGo(0);
}
function obPickCur(v){
  ob.currency = v;
  document.querySelectorAll("#ob-currencies button").forEach(b=>b.classList.toggle("on", b.dataset.v===v));
  document.getElementById("ob-bud-cur").textContent = v;
  renderSplitPreview();
}
function obGo(n){
  if (n >= 1){ ob.name = document.getElementById("ob-name").value.trim(); }
  if (n >= 4){
    ob.budget = parseAmount(document.getElementById("ob-budget").value);
    renderSplitPreview();
  }
  document.getElementById("ob-bud-cur").textContent = ob.currency;
  document.querySelectorAll(".ob-step").forEach((el,i)=>{ el.classList.toggle("on", i===n); el.setAttribute("aria-hidden", i===n?"false":"true"); });
  const dots = document.getElementById("ob-dots");
  dots.innerHTML = [0,1,2,3,4,5].map(i=>`<div class="${i===n?"on":""}"></div>`).join("");
  dots.style.visibility = n===0 ? "hidden" : "visible";
  document.getElementById("ob-skip").style.visibility = n===0 || n===5 ? "hidden" : "visible";
  if (n===1) setTimeout(()=>document.getElementById("ob-name").focus(), 460);
  if (n===3){
    document.getElementById("ob-btn-budget").textContent =
      parseAmount(document.getElementById("ob-budget").value) > 0 ? "Continuer" : "Continuer sans budget";
    setTimeout(()=>document.getElementById("ob-budget").focus(), 460);
  }
  document.getElementById("onboard").scrollTop = 0;
}
function renderSplitPreview(){
  const host = document.getElementById("ob-split-preview");
  const toggle = document.querySelector("#ob-step-4 .ob-toggle-row");
  if (!ob.budget){
    host.innerHTML = '<div class="empty" style="padding:12px 0">Sans budget, la répartition n\'est pas nécessaire.<br>Retourne à l\'étape précédente si tu en veux un.</div>';
    if (toggle) toggle.style.display = "none";
    return;
  }
  if (toggle) toggle.style.display = "flex";
  host.innerHTML = Object.keys(state.cats).map(k=>{
    if (!SPLITS[k]) return "";
    const c = catOf(k);
    return `<div class="env"><div class="env-top">
      <div class="dot" style="background:${c.color}"></div>
      <span class="env-n">${esc(c.emoji)} ${esc(c.label)}</span>
      <span class="env-v">${money((ob.budget||0)*SPLITS[k])} · ${Math.round(SPLITS[k]*100)}%</span></div></div>`;
  }).join("");
}
function obSkip(){ obFinish("pro", true); }
function obFinish(mode, skipped){
  const name = (document.getElementById("ob-name") && document.getElementById("ob-name").value.trim()) || ob.name || "";
  state.user = { name };
  if (!skipped){
    const b = parseAmount(document.getElementById("ob-budget").value);
    state.budget = b > 0 ? b : 0;   // budget optionnel : 0 = pas de budget mensuel
    state.currency = ob.currency;
    if (document.getElementById("ob-autosplit").checked) autoSplitBudget();
  }
  state.onboarded = true;
  if (typeof renderAutoRow === "function") renderAutoRow();
  save();
  document.getElementById("onboard").classList.remove("show");
  setTimeout(checkInstallBanner, 1200);
  switchTab("home");
  render();
  toast(state.user.name ? tt("👋 Bienvenue, {a} !", {a: state.user.name}) : t("👋 Bienvenue dans Kola !"));
}

function updateGreeting(){
  const n = (state.user && state.user.name) || "";
  const h = new Date().getHours();
  const g = t((h >= 18 || h < 5) ? "Bonsoir" : "Bonjour");
  document.getElementById("home-title").textContent = n ? `${g}, ${n}` : t("Aujourd'hui");
  const initial = n ? (Array.from(n)[0] || "?").toUpperCase() : "👤";
  document.getElementById("home-avatar").textContent = initial;
  document.getElementById("avatar-set").textContent = initial;
}

/* ============ Divers ============ */
let toastTimer;
function toast(msg){
  const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
}
function resetAll(){
  if (confirm(tt("Supprimer TOUTES les données ? Dépenses, budgets, enveloppes, objectifs, récurrences et profil. Les sauvegardes automatiques récentes restent récupérables (Réglages → Données). Les sauvegardes exportées (fichiers) ne sont pas concernées.", {}))){
    state.expenses = []; state.budgets = {}; state.budget = 0;
    state.goals = []; state.recurring = []; state.user = { name: "" };
    state.lastBackupAt = ""; state.lastMonthlyBackup = ""; state.backupPostponedAt = "";
    state.books = []; state.bookId = "";                 // les livres aussi — recréera « Personnel » vide
    booksEnsure();
    idbErase(); save(); render(); renderBookbar(); renderBooksRow(); toast("Données effacées");
  }
}

function render(){
  updateGreeting();
  renderLangRow();
  renderBookbar(); renderBooksRow(); renderThemeRow(); applyTheme();
  document.getElementById("set-cur").textContent = state.currency;
  if (document.getElementById("page-home").classList.contains("active")) renderHome();
  else if (document.getElementById("page-stats").classList.contains("active")) {
    renderStats(document.getElementById("stat-seg").dataset.p||"month");
    renderCompare();
  }
  else if (document.getElementById("page-history").classList.contains("active")) renderHistory();
  else if (document.getElementById("page-settings").classList.contains("active")) {
    document.getElementById("budget-input").value = state.budget;
    document.getElementById("currency-select").value = state.currency;
    document.getElementById("user-name-input").value = state.user.name || "";
    renderCats();
    renderBudgets();
    renderRecurring();
    renderCoupleSettings();
  }
}

