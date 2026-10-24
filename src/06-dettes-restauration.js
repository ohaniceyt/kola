/* ============ Dettes : modèle (fonctions pures) ============
   Un livre de type « dettes » suit ce que tu dois et ce qu'on te doit.
   Une dette = { id, name (personne ou motif), dir: "dois"|"me", amount,
                 date, paid (total remboursé), due (échéance facultative),
                 payments[] = journal des remboursements {id, date, amount} }. */
function normalizeDebts(list, todayIso){
  const okDate = s => SAFE_DATE.test(s || "") && !Number.isNaN(new Date(s + "T00:00:00").getTime());
  const today = todayIso || todayISO();
  if (!Array.isArray(list)) return [];
  return list.filter(d => d && typeof d === "object").map(d => ({
    id: safeId(d.id),
    name: String(d.name ?? "").slice(0, 60).trim() || "…",
    dir: d.dir === "me" ? "me" : "dois",
    amount: +d.amount || 0,
    date: okDate(d.date) ? d.date : today,
    paid: Math.min(Math.max(0, +d.paid || 0), +d.amount || 0),
    due: okDate(d.due) ? d.due : "",
    payments: Array.isArray(d.payments)
      ? d.payments.filter(p => p && typeof p === "object" && +p.amount > 0)
        .map(p => ({ id: safeId(p.id), date: okDate(p.date) ? p.date : today, amount: +p.amount }))
        .filter(p => p.amount > 0)
      : []
  })).filter(d => d.amount > 0);
}
function debtRemain(d){ return Math.max(0, (+d.amount || 0) - (+d.paid || 0)); }
function debtTotals(debts){
  const t = { dois: 0, me: 0, paidDois: 0, paidMe: 0, net: 0, pct: 0, pctDois: 0, pctMe: 0 };
  (debts || []).filter(d => d && typeof d === "object").forEach(d => {
    const rem = debtRemain(d);
    if (d.dir === "me"){ t.me += rem; t.paidMe += +d.paid || 0; }
    else { t.dois += rem; t.paidDois += +d.paid || 0; }
  });
  t.net = t.me - t.dois;
  const pctDir = (rem, paid) => {
    const orig = rem + paid;
    return orig > 0 ? Math.round((paid / orig) * 100) : 0;
  };
  t.pctDois = pctDir(t.dois, t.paidDois);
  t.pctMe = pctDir(t.me, t.paidMe);
  const orig = t.dois + t.me + t.paidDois + t.paidMe;
  if (orig > 0) t.pct = Math.round(((t.paidDois + t.paidMe) / orig) * 100);
  return t;
}
/* Rappels d'échéances : dettes/créances non soldées qui arrivent (horizon 7 j) ou sont dépassées.
   days < 0 = en retard. Pure, testée. */
function dueReminders(debts, today, horizon = 7){
  const out = [];
  (debts || []).filter(d => d && typeof d === "object" && d.due && debtRemain(d) > 0).forEach(d => {
    const a = new Date(d.due + "T00:00:00"), b = new Date(today + "T00:00:00");
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return;
    const days = Math.round((a - b) / 864e5);
    if (days <= horizon) out.push({ debtId: d.id, name: String(d.name || "…"), dir: d.dir === "me" ? "me" : "dois", remain: debtRemain(d), days, due: d.due });
  });
  return out.sort((x, y) => x.days - y.days);
}
/* Chronologie unifiée (dettes + créances + remboursements) — pure, testée.
   Tri : date desc, puis les dettes/créances avant les remboursements du même jour. */
function debtLedgerEntries(debts){
  const out = [];
  (debts || []).filter(d => d && typeof d === "object").forEach(d => {
    (d.payments || []).filter(p => p && typeof p === "object").forEach(p => {
      out.push({ t: "pay", id: p.id, debtId: d.id, name: d.name, dir: d.dir, amount: +p.amount || 0, date: p.date, due: "" });
    });
    out.push({ t: "debt", id: d.id, debtId: d.id, name: d.name, dir: d.dir, amount: +d.amount || 0, date: d.date, due: d.due || "" });
  });
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date))
    || (a.t === "pay" ? 1 : 0) - (b.t === "pay" ? 1 : 0)
    || String(a.name).localeCompare(String(b.name)));
}
/* ============ Dettes : UI ============ */
let debtEditId = null;
function openDebtSheet(id){
  debtEditId = id || null;
  const d = state.debts.find(x => x.id === id);
  document.getElementById("db-cur").textContent = state.currency;
  document.getElementById("db-pay-cur").textContent = state.currency;
  document.getElementById("db-name").value = d ? d.name : "";
  document.getElementById("db-amount").value = d ? +d.amount.toFixed(2) : "";
  document.getElementById("db-date").value = d ? d.date : todayISO();
  document.getElementById("db-due").value = d ? (d.due || "") : "";
  document.getElementById("db-pay").value = "";
  document.getElementById("db-pay-field").style.display = d && debtRemain(d) > 0 ? "" : "none";
  document.getElementById("db-delete").style.display = d ? "" : "none";
  document.getElementById("db-save").textContent = d ? t("Enregistrer") : t("Ajouter la dette");
  document.getElementById("debt-sheet-title").textContent = d ? t("Modifier la dette") : t("Nouvelle dette");
  renderDebtPays(d);
  pickDebtDir(d ? d.dir : "dois");
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("debt-sheet").classList.add("show"); syncScrollLock();
  if (!KP_TOUCH) setTimeout(()=>document.getElementById("db-name").focus(), 460);
}
function closeDebtSheet(){ document.getElementById("debt-sheet").classList.remove("show"); clearSheetOverlay(); syncScrollLock(); }
function pickDebtDir(dir){ document.querySelectorAll("#db-dir button").forEach(b => b.classList.toggle("on", b.dataset.k === dir)); }
function pickedDebtDir(){
  const b = document.querySelector("#db-dir button.on");
  return (b && b.dataset.k === "me") ? "me" : "dois";
}
function saveDebt(){
  const n = document.getElementById("db-name").value.trim().slice(0, 60);
  const a = parseAmount(document.getElementById("db-amount").value);
  if (!a || a <= 0){ toast(t("Entre un montant valide")); return; }
  if (!n){ toast(t("Entre une personne ou un motif")); return; }
  const date = document.getElementById("db-date").value;
  if (!SAFE_DATE.test(date)){ toast(t("Entre une date valide")); return; }
  const dueRaw = document.getElementById("db-due").value;
  const fields = { name: n, dir: pickedDebtDir(), amount: a, date,
                   due: SAFE_DATE.test(dueRaw) ? dueRaw : "" };
  if (debtEditId){
    const d = state.debts.find(x => x.id === debtEditId); if (!d) return;
    Object.assign(d, fields);
    d.paid = Math.min(d.paid, d.amount);
    toast("✓ " + t("Dette mise à jour"));
  } else {
    state.debts.push({ id: crypto.randomUUID(), ...fields, paid: 0 });
    toast("✓ " + t("Dette ajoutée"));
  }
  closeDebtSheet(); save(); render();
}
function applyDebtPayment(){
  const d = state.debts.find(x => x.id === debtEditId); if (!d) return;
  const a = parseAmount(document.getElementById("db-pay").value);
  const rem = debtRemain(d);
  if (!a || a <= 0){ toast(t("Entre un montant valide")); return; }
  const pay = Math.min(a, rem);
  d.payments = Array.isArray(d.payments) ? d.payments : [];
  d.payments.push({ id: crypto.randomUUID(), date: todayISO(), amount: pay });   // journal (historique)
  d.paid = +(d.paid + pay).toFixed(2);
  if (debtRemain(d) <= 0) toast("🎉 " + t("Dette réglée"));
  else toast("✓ " + tt("Paiement de {a} enregistré", { a: money(pay) }));
  save(); closeDebtSheet(); render();
}
/* Journal des remboursements d'une dette : suppression d'une entrée (paid suit) */
function delDebtPay(debtId, payId){
  const d = state.debts.find(x => x.id === debtId); if (!d || !Array.isArray(d.payments)) return;
  const p = d.payments.find(x => x.id === payId); if (!p) return;
  if (!confirm(tt("Supprimer ce remboursement ({a} du {b}) ?", { a: money(p.amount), b: dayName(p.date) }))) return;
  d.payments = d.payments.filter(x => x.id !== payId);
  d.paid = Math.max(0, +(d.paid - p.amount).toFixed(2));
  toast("🗑️ " + t("Remboursement supprimé"));
  save(); render(); openDebtSheet(debtId);
}
function renderDebtPays(d){
  const field = document.getElementById("db-pays-field");
  const host = document.getElementById("db-pays"); if (!field || !host) return;
  const pays = (d && Array.isArray(d.payments)) ? [...d.payments].sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
  field.style.display = pays.length ? "" : "none";
  host.innerHTML = pays.map(p =>
    `<div class="setrow">
      <div class="icon-badge" style="background:rgba(52,199,89,.16)">🔁</div>
      <div class="n">${esc(tt("Remboursement · {a}", { a: dayName(p.date) }))}</div>
      <div class="v" style="color:var(--green)">${money(p.amount)}</div>
      <div class="rowbtn" onclick="delDebtPay('${d.id}','${p.id}')" role="button" tabindex="0" aria-label="${esc(t("Supprimer le remboursement"))}">🗑️</div>
    </div>`).join("");
}
function delDebt(){
  const d = state.debts.find(x => x.id === debtEditId); if (!d) return;
  if (!confirm(tt("Supprimer la dette « {a} » ({b}) ?", { a: d.name, b: money(d.amount) }))) return;
  state.debts = state.debts.filter(x => x.id !== debtEditId);
  debtEditId = null;
  closeDebtSheet(); save(); render();
}
/* Rendu partagé des listes de dettes (vue livre dettes et carte des livres dépenses) */
function debByOrder(a, b){
  return (debtRemain(a) > 0 ? 0 : 1) - (debtRemain(b) > 0 ? 0 : 1)
      || String(b.date || "").localeCompare(String(a.date || ""));
}
function debtRow(d){
  const rem = debtRemain(d);
  const pct = d.amount > 0 ? Math.min(100, Math.round(d.paid / d.amount * 100)) : 100;
  const overdue = rem > 0 && d.due && d.due < todayISO();
  const sub = rem <= 0 ? `✓ ${t("Payée")}`
            : (overdue ? "⚠️ " : "") +
              tt("Reste {a} · remboursé {p} %", { a: money(rem), p: pct }) +
              (d.due ? " · " + tt("Échéance {a}", { a: overdue ? d.due : dayName(d.due) }) : "");
  const amt = rem <= 0 ? "✓" : (d.dir === "dois" ? "−" : "+") + money(rem);
  const col = rem <= 0 ? "var(--green)" : (d.dir === "dois" ? "var(--red)" : "var(--label)");
  return `<div class="rowitem" role="button" tabindex="0" onclick="openDebtSheet('${d.id}')"
            aria-label="${esc(tt("Dette : {a}, {b}", { a: d.name, b: money(d.amount) }))}">
    <div class="icon-badge" style="background:rgba(var(--accent-rgb),.14)">${d.dir === "dois" ? "💸" : "🤝"}</div>
    <div class="txt"><div class="n">${esc(d.name)}</div><div class="d">${esc(sub)}</div></div>
    <div class="amt" style="color:${col}">${amt}</div>
  </div>`;
}
function debGroupsHtml(){
  const group = (dir, title) => {
    const list = state.debts.filter(d => d.dir === dir).sort(debByOrder);
    if (!list.length) return "";
    return `<div class="list-header" style="padding:14px 0 6px"><span class="t">${esc(title)}</span></div><div class="group">${list.map(debtRow).join("")}</div>`;
  };
  return group("dois", t("Je dois")) + group("me", t("On me doit"));
}
/* Héros dettes : chaque sens sur sa propre ligne — jamais de net mélange dettes/créances */
function renderDettesHome(){
  const tl = debtTotals(state.debts);
  const labelEl = document.getElementById("hero-label");
  const bar = document.getElementById("hero-bar");
  const meW = document.getElementById("hero-me-w");
  if (!state.debts.length){
    labelEl.textContent = t("Dettes");
    animateNumber(document.getElementById("hero-remaining"), "hero-dt", 0, money);
    document.getElementById("hero-spent").textContent = t("Tape ＋ pour suivre ce que tu dois ou ce qu'on te doit.");
    bar.style.visibility = "hidden";
    meW.style.display = "none";
  } else {
    // Ligne 1 : ce que tu dois
    labelEl.textContent = "💸 " + t("Je dois");
    animateNumber(document.getElementById("hero-remaining"), "hero-dt", tl.dois, money);
    document.getElementById("hero-spent").textContent = tl.dois
      ? tt("Remboursé : {a} · {p} %", { a: money(tl.paidDois), p: tl.pctDois })
      : "✓ " + t("Tout est réglé 🎉");
    bar.style.visibility = "visible";
    bar.firstElementChild.style.width = (tl.dois ? tl.pctDois : 100) + "%";
    bar.firstElementChild.style.background = "#fff";
    // Ligne 2 : ce qu'on te doit
    meW.style.display = "";
    document.getElementById("hero-me-label").textContent = "🤝 " + t("On me doit");
    animateNumber(document.getElementById("hero-me-amount"), "hero-dt-me", tl.me, money);
    document.getElementById("hero-me-sub").textContent = tl.me
      ? tt("Encaissé : {a} · {p} %", { a: money(tl.paidMe), p: tl.pctMe })
      : "✓ " + t("Tout est réglé 🎉");
    const mb = document.getElementById("hero-me-bar");
    mb.style.visibility = "visible";
    mb.firstElementChild.style.width = (tl.me ? tl.pctMe : 100) + "%";
    mb.firstElementChild.style.background = "#fff";
  }
  document.getElementById("dettes-host").innerHTML = state.debts.length
    ? debGroupsHtml()
    : emptyState("🤝", t("Aucune dette pour le moment."), t("Tape ＋ pour suivre ce que tu dois ou ce qu'on te doit."));
}
/* Carte dettes : dans un livre « dépenses », accès rapide aux dettes sans changer de livre (phase 2) */
function renderDettesCard(){
  const host = document.getElementById("dettes-host"); if (!host) return;
  host.innerHTML = (state.debts.length
    ? debGroupsHtml()
    : `<div class="hint" style="padding:2px 0 2px">${esc(t("Note un prêt ou une dette en un tap — pour un suivi complet, fais un livre 🤝 Dettes."))}</div>`);
}
/* ====== Restauration : aperçu + fusion dédoublonnée ou remplacement ====== */
/* --- Validation stricte des champs importés (anti-injection) ---
   Un fichier de sauvegarde vient de l'extérieur (Mail/WhatsApp) : tout ce qui
   finit interpolé dans du HTML (ids, clés de catégorie, emoji, couleurs,
   valeurs de budgets, dates) est reconstruit ici ; un champ non conforme est
   remplacé, jamais accepté tel quel. */
const SAFE_UUID    = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const SAFE_CAT_KEY = /^[a-z][a-z0-9_-]{0,31}$/i;
const SAFE_COLOR   = /^#[0-9a-f]{6}$/i;
const SAFE_DATE    = /^\d{4}-\d{2}-\d{2}$/;
const safeId = id => (typeof id === "string" && SAFE_UUID.test(id)) ? id : crypto.randomUUID();
function safeEmoji(e){
  // emoji ou court symbole : aucun caractère HTML/contrôle ne doit survivre
  const s = String(e ?? "").replace(/[<>&"'`\\\/{}]/g, "").replace(/\p{C}/gu, "").trim();
  return s.slice(0, 8) || "📦";
}
const safeColor = c => (typeof c === "string" && SAFE_COLOR.test(c)) ? c : "#8e8e93";
/* Validation des champs d'un livre unique (dépenses, enveloppes, objectifs…)
   — réutilisée par buildBackup pour le format à plat (ancien) et les livres. */
function buildLedger(s){
  if (!s || typeof s !== "object" || !Array.isArray(s.expenses)) throw new Error("format");
  // Clés de catégories : les clés non conformes sont réinventées (impXXXXXXXX)
  // et TOUTES les références (dépenses, budgets, récurrences) sont re-mappées.
  const keyMap = {};
  const mapKey = k => {
    if (!keyMap[k]) keyMap[k] = SAFE_CAT_KEY.test(k) ? k : "imp" + crypto.randomUUID().slice(0, 8);
    return keyMap[k];
  };
  const catsOut = {};
  const catsSrc = (s.cats && typeof s.cats === "object" && !Array.isArray(s.cats)) ? s.cats : null;
  Object.entries(catsSrc || {}).forEach(([k, c])=>{
    if (!c || typeof c !== "object") return;
    const label = String(c.label ?? "").slice(0, 40);
    catsOut[mapKey(k)] = { label: label || "…", emoji: safeEmoji(c.emoji), color: safeColor(c.color) };
  });
  if (!Object.keys(catsOut).length){
    Object.entries(JSON.parse(JSON.stringify(CATS))).forEach(([k, c])=>{ catsOut[k] = c; });
  }
  const knownCat = k => { const kk = keyMap[k] ?? k; return catsOut[kk] !== undefined ? kk : null; };
  const budgetsOut = {};
  if (s.budgets && typeof s.budgets === "object" && !Array.isArray(s.budgets)){
    Object.entries(s.budgets).forEach(([k, v])=>{
      const nv = +v, kk = knownCat(k);
      if (kk && Number.isFinite(nv) && nv > 0) budgetsOut[kk] = nv;
    });
  }
  return {
    budget: +s.budget || 0,
    cats: catsOut,
    budgets: budgetsOut,
    recurring: Array.isArray(s.recurring) ? s.recurring.filter(r=>r && r.amount>0).map(r=>({ name:String(r.name).slice(0,80), cat: knownCat(r.cat) || "other", amount:+r.amount, freq:(r.freq||"m"), wd:+r.wd||0, day:Math.min(Math.max(+r.day||1,1),28), lastAdded: SAFE_DATE.test(r.lastAdded||"") ? r.lastAdded : "" })) : [],
    goals: Array.isArray(s.goals) ? s.goals.filter(g=>g && g.target>0).map(g=>({ id:safeId(g.id), name:String(g.name||"Objectif").slice(0,60), target:+g.target, saved:Math.max(0,+g.saved||0)})) : [],
    expenses: s.expenses.filter(e=>e && e.amount>0 && SAFE_DATE.test(e.date)).map(e=>({ id:safeId(e.id), name:String(e.name||"").slice(0,60), cat: knownCat(e.cat) || "other", amount:+e.amount, date:e.date, who: (e.who==="partner" || e.who==="shared") ? e.who : "me", ts: (+e.ts && +e.ts > 1e12 && +e.ts < 9e15) ? +e.ts : 0})),
    kind: s.kind === "dettes" ? "dettes" : "dep",
    debts: normalizeDebts(s.debts)
  };
}
function buildBackup(s){
  if (!s || typeof s !== "object") throw new Error("format");
  const user = { name: String((s.user && s.user.name) || "").slice(0,20) };
  const couple = (s.couple && typeof s.couple === "object") ? {
    on: !!s.couple.on,
    partner: String(s.couple.partner || "").slice(0,20),
    sentIds: Array.isArray(s.couple.sentIds) ? s.couple.sentIds.filter(x=>SAFE_UUID.test(x)).slice(0,2000) : [],
    lastAt: SAFE_DATE.test(s.couple.lastAt || "") ? s.couple.lastAt : ""
  } : null;
  // Thème : id simple lower-case (palette fermée de l'app ; inconnu → fallback au boot)
  const themeOk = t => (typeof t === "string" && /^[a-z]{3,8}$/.test(t)) ? t : undefined;
  // Livres : chaque livre est validé par buildLedger (anti-injection identique)
  const booksIn = Array.isArray(s.books) ? s.books.filter(b =>
    b && typeof b === "object" && (() => { const d = (b.data && typeof b.data === "object" && !Array.isArray(b.data)) ? b.data : b; return Array.isArray(d.expenses); })()
  ) : null;
  if (booksIn && booksIn.length){
    const bkBookId = id => (typeof id === "string" && /^[a-z0-9-]{1,24}$/i.test(id)) ? id : null;
    const bkName = n => String(n ?? "").replace(/[<>&"'`\\{}]/g, "").slice(0, 40).trim() || "Livre";
    const seen = new Set();
    const booksOut = booksIn.map(b => {
      const d = (b.data && typeof b.data === "object" && !Array.isArray(b.data)) ? b.data : b;
      let id = bkBookId(b.id);
      if (!id || seen.has(id)) id = "b" + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      seen.add(id);
      const themeOut = themeOk(b.theme);
      return { id, name: bkName(b.name), emoji: safeEmoji(b.emoji || "📖"), ...(themeOut ? { theme: themeOut } : {}), data: buildLedger(d) };
    });
    const act = booksOut.find(b => b.id === s.bookId) || booksOut[0];
    return {
      v: SCHEMA_VERSION,
      rev: +s.rev || 0,   // ⚠️ conservé : sans lui, la copie IndexedDB de l'appareil (rev plus haute) écraserait le fichier restauré au prochain boot
      deviceId: (typeof s.deviceId === "string" && SAFE_UUID.test(s.deviceId)) ? s.deviceId : undefined,
      currency: s.currency || "€",
      onboarded: true,
      theme: themeOk(s.theme),
      books: booksOut,
      bookId: act.id,
      user, couple,
      // Livre actif remonté à plat (compat : l'ancienne logique de fusion/rendu lit ces champs)
      budget: act.data.budget,
      cats: act.data.cats,
      budgets: act.data.budgets,
      recurring: act.data.recurring,
      goals: act.data.goals,
      expenses: act.data.expenses,
      kind: act.data.kind,
      debts: act.data.debts
    };
  }
  // Format à plat (sauvegardes d'avant les livres)
  const led = buildLedger(s);
  return {
    v: SCHEMA_VERSION,
    rev: +s.rev || 0,
    deviceId: (typeof s.deviceId === "string" && SAFE_UUID.test(s.deviceId)) ? s.deviceId : undefined,
    budget: led.budget,
    currency: s.currency || "€",
    theme: themeOk(s.theme),
    onboarded: true,
    cats: led.cats,
    budgets: led.budgets,
    recurring: led.recurring,
    goals: led.goals,
    user,
    couple,
    expenses: led.expenses,
    kind: led.kind,
    debts: led.debts
  };
}
let backupPending = null;
/* Importeur unique : JSON (sauvegarde ou fichier d'échange couple) vs CSV bancaire */
function importBackupText(txt){
  try {
    const data = JSON.parse(txt);
    if (data && data.app === "kola-couple"){
      const ck = buildCoupleImport(data);
      if (ck){ openCoupleSheet(ck); return; }   // fichier couple déposé au mauvais endroit : on route
    }
    if (!data || (typeof data !== "object")) throw new Error("format");
    const bk = buildBackup((data && data.state) ? data.state : data);
    bk.exportedAt = data && data.exportedAt ? String(data.exportedAt).slice(0,10) : "";
    openBackupSheet(bk);
  } catch (err) {
    toast("Import impossible : fichier invalide");
    console.warn("Kola import:", err);
  }
}
function importDataFile(file){
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    const txt = String(fr.result || "").trim();
    if (/^[[{]/.test(txt)) return importBackupText(txt);   // JSON : sauvegarde ou fichier couple
    openCsvSheet(parseCsv(txt));                            // sinon : relevé bancaire CSV
  };
  fr.readAsText(file);
}
function openBackupSheet(bk){
  backupPending = bk;
  const sameDay = new Set(state.expenses.map(e=>e.date + "|" + String(e.name).trim().toLowerCase() + "|" + Math.round(+e.amount*100)));
  const dups = bk.expenses.filter(e=> sameDay.has(e.date + "|" + String(e.name).trim().toLowerCase() + "|" + Math.round(+e.amount*100))).length;
  const cur = state.user && state.user.name ? state.user.name : null;
  document.getElementById("backup-title").textContent = t("Restaurer une sauvegarde");
  document.getElementById("backup-preview").innerHTML =
    `<div class="empty" style="padding:4px 0 6px">
      📂 ${bk.exportedAt ? esc(tt("Sauvegarde du {d} · ", {d: bk.exportedAt})) : ""}${tt("{n} dépense(s)", {n: bk.expenses.length})}${Array.isArray(bk.books) && bk.books.length ? " · " + tt("{n} livre(s)", {n: bk.books.length}) : ""} · ${(bk.goals||[]).length} ${t("objectif(s)")} · ${(bk.recurring||[]).length} ${t("récurrence(s)")}
      ${bk.currency !== state.currency ? "<br>⚠️ " + tt("Devise du fichier : {a} (cette devise ici : {b})", {a: esc(bk.currency||"—"), b: state.currency}) : ""}
      <br><b>${dups ? tt("{n} doublon(s) ignoré(s) à la fusion", {n: dups}) : t("Aucun doublon à la fusion")}</b>
      ${cur ? "" : "<br>" + esc(tt("Fichier de {a} — nom adopté", {a: (bk.user.name||"—")}))}
    </div>`;
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("backup-sheet").classList.add("show"); syncScrollLock();
}
