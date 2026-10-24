/* ============ Import CSV bancaire ============ */
const CAT_HINTS = {
  transport: ["uber","taxi","métro","metros","bus","train","essence","carburant","parking","péage","aéro","boda","okada","tricycle","moto"],
  food: ["café","cafe","resto","restaurant","macdo","mcdonald","burger","pizza","boulanger","marché","marche","supermarch","hypermarch","carrefour","lidl","aldi","auchan","courses","épicerie","kebab","sushi","kfc","snack","maquis","poulet"],
  shopping: ["amazon","zara","shein","aliexpress","fnac","darty","decathl","nike","adidas","jumia","boutique","vêtem","chaussure","kiabi"],
  bills: ["loyer","edf","sfr","orange","free","canal","netflix","spotify","deezer","abonn","abonnement","électric","electric","facture","internet","assur","impôt","impots","cotonou","syndic"],
  fun: ["ciné","ciné","cinema","concert","jeux","game","playstation","steam","bowling","musée","musee","festival","disco"],
  health: ["pharmac","médec","medec","clini","dent","optic","hospit","hôpital","hopital","labo"],
};
function guessCat(label){
  const s = String(label||"").toLowerCase();
  for (const [k, ws] of Object.entries(CAT_HINTS)){
    if (ws.some(w=>s.includes(w))) return k;
  }
  return "other";
}
function parseMoneyCell(raw){
  let s = String(raw).replace(/[\u00A0\u202F\s]/g, "").replace(/^\+/, "");
  const neg = s.startsWith("-") || /-\s*$/.test(String(raw).trim());
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")){
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")){
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) s = s.replace(",", ".");
    else if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) s = s.replace(",", "");
    else s = s.replace(/,/g, "");
  }
  const v = parseFloat(s);
  if (isNaN(v)) return null;
  return neg ? -v : v;
}
function normalizeCsvDate(raw){
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (m){
    let d = +m[1], mo = +m[2], y = +m[3];
    if (d > 31){ [d, mo] = [mo, d]; }
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  return null;
}
function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  if (!lines.length) return [];
  // séparateur : le plus fréquent sur les 5 premières lignes
  const head = lines.slice(0,5).join("\n");
  const delim = [";","\t",",",null].filter((d,i)=>d!==null).sort((a,b)=>
    (head.split(b).length - head.split(a).length))[0];
  const rows = lines.map(l=>{
    const cells = l.split(delim).map(c=>c.trim().replace(/^"(.*)"$/,"$1"));
    return cells;
  }).filter(c=>c.length >= 2);
  // en-tête ?
  const first = rows[0].join(" ").toLowerCase();
  const hasHeader = /date|libell|libell|description|mont|amount/.test(first) && !/\d{2}[\/.-]\d{2}[\/.-]\d{2,4}/.test(first);
  const body = hasHeader ? rows.slice(1) : rows;
  const rows2 = [];
  let hasNegative = false;
  body.forEach(cells=>{
    // colonnes date / montant / libellé
    const dateIdx = cells.findIndex(c=>normalizeCsvDate(c));
    let amountIdx = -1, labelIdx = -1, amount = null;
    // Liaison par en-tête (relevés 2 colonnes Débit/Crédit) : Débit/Montant = dépenses,
    // Crédit = argent entrant, jamais une dépense — même si les débits y sont positifs.
    let strictCol = -1, creditOnly = false;
    if (hasHeader && rows[0].length === cells.length){
      for (let i=0;i<cells.length;i++){
        if (i===dateIdx) continue;
        const h = String(rows[0][i]||"").toLowerCase();
        if (/crédit|credit|dépôt|depot|deposit|income/.test(h)){ continue; }
        if (/débit|debit|montant|amount|charge|spent/.test(h)){ strictCol = i; break; }
      }
      creditOnly = strictCol === -1 && [...cells.keys()].some(i=>{
        if (i===dateIdx) return false;
        const h = String(rows[0][i]||"").toLowerCase();
        return /crédit|credit|dépôt|depot|deposit|income/.test(h) && parseMoneyCell(cells[i]) !== null;
      });
    }
    if (strictCol > -1){
      amountIdx = strictCol;
      amount = parseMoneyCell(cells[amountIdx]);
    } else if (creditOnly){
      return;   // ligne dont le seul montant est un crédit
    } else {
      for (let i=0;i<cells.length;i++){
        if (i===dateIdx) continue;
        const cand = parseMoneyCell(cells[i]);
        if (cand!==null && amountIdx===-1){ amountIdx=i; amount=cand; }
      }
    }
    // libellé = la cellule non-date, non-montant la plus longue
    for (let i=0;i<cells.length;i++){
      if (i===dateIdx || i===amountIdx) continue;
      if (cells[i] && (labelIdx===-1 || cells[i].length > cells[labelIdx].length)) labelIdx=i;
    }
    const date = dateIdx>=0 ? normalizeCsvDate(cells[dateIdx]) : null;
    if (!date || amount===null || !amount) return;
    if (amount < 0) hasNegative = true;   // relevé signé : les positifs sont des crédits (virements reçus)
    rows2.push({ date, label: labelIdx>=0 ? cells[labelIdx].slice(0,60) : "Dépense importée", amount, cat: guessCat(labelIdx>=0 ? cells[labelIdx] : "") });
  });
  // Crédits ignorés — sauf relevé sans aucun signe négatif (tout positif = export sans signe : ce sont des dépenses)
  const out = hasNegative ? rows2.filter(r=>r.amount < 0) : rows2;
  out.forEach(r=> r.amount = Math.abs(r.amount));
  return out;
}
let csvRows = null;
function openCsvSheet(rows){
  if (!rows.length){ toast("Aucune opération reconnaissable dans ce fichier"); return; }
  csvRows = rows;
  const total = rows.reduce((s,r)=>s+r.amount,0);
  document.getElementById("csv-title").textContent = tt("Import du relevé · {n} opérations", {n: rows.length});
  document.getElementById("csv-preview").innerHTML =
    `<div class="empty" style="padding:4px 0 10px">${tt("Total : ", {})}<b>${money(total)}</b><br><span style="font-size:12px">${t("Catégories devinées automatiquement — modifiables après en tapant une dépense.")}</span></div>
     <div class="csv-wrap">` + rows.map(r=>{
       const c = catOf(r.cat);
       return `<div class="csv-row"><span class="csv-d">${r.date.slice(8)}/${r.date.slice(5,7)}</span>
         <span class="csv-l">${esc(r.label)}</span>
         <span style="white-space:nowrap">${esc(c.emoji)}</span>
         <span class="csv-a">${money(r.amount)}</span></div>`;
     }).join("") + `</div>`;
  document.getElementById("overlay").classList.add("show"); syncScrollLock();
  document.getElementById("csv-sheet").classList.add("show"); syncScrollLock();
}
function closeCsvSheet(){
  document.getElementById("csv-sheet").classList.remove("show");
  document.getElementById("overlay").classList.remove("show"); syncScrollLock();
  csvRows = null;
}
function confirmCsvImport(){
  if (!csvRows || !csvRows.length) return;
  let added = 0;
  const have = new Set(state.expenses.map(e=>e.date + "|" + e.name + "|" + Math.round(+e.amount*100)));   // Set : O(1) par ligne (20k+ dépenses = O(n) au total)
  csvRows.forEach(r=>{
    if (have.has(r.date + "|" + r.label + "|" + Math.round(+r.amount*100))) return;   // pas de doublon exact (même date, même libellé, même montant)
    state.expenses.push({ id:crypto.randomUUID(), name:r.label, cat: r.cat in state.cats ? r.cat : "other", amount:r.amount, date:r.date, ts:Date.now() });
    have.add(r.date + "|" + r.label + "|" + Math.round(+r.amount*100));
    added++;
  });
  csvRows = null;
  save(); closeCsvSheet(); render();
  toast(added ? tt("📥 {n} dépense(s) importée(s)", {n: added}) : t("Rien de nouveau à importer"));
}

/* ============ Utilitaires ============ */
function money(a){
  const dec = state.currency === "FCFA" ? 0 : 2;   // le franc CFA n'a pas de sous-unités
  return a.toLocaleString(LANG==="en" ? "en-GB" : "fr-FR",{minimumFractionDigits:dec, maximumFractionDigits:dec}) + " " + state.currency;
}
// Noms de jours/mois et locale de formatage selon la langue active
const I18N_LOCALE = () => LANG==="en" ? "en-GB" : "fr-FR";
const I18N_WD = () => LANG==="en"
  ? ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
  : ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
/* ================= i18n =================
   Le FR est la langue source (texte inline) ; l'EN est un dictionnaire.
   Deux mécanismes :
   1. t()/tt() pour les chaînes construites en JS ;
   2. passe automatique (MutationObserver) qui traduit tout nœud texte
      ou attribut dont le contenu correspond EXACTEMENT au dictionnaire —
      aucun data-i18n à maintenir dans le markup.
*/
const I18N_EN = {
  /* --- Dettes : historique --- */
  "Remboursements":"Repayments",
  "Historique des remboursements":"Payment history",
  "Remboursement":"Repayment",
  "Supprimer le remboursement":"Delete the repayment",
  "Paiements antérieurs (non datés)":"Earlier payments (undated)",
  "Remboursement supprimé":"Repayment deleted",
  /* --- Accueil --- */
  "Dépensé ce mois":"Spent this month",
  "💾 Sauvegarde conseillée":"💾 Backup recommended",
  "Sauvegarder":"Back up",
  "Plus tard":"Later",
  "Rappeler plus tard":"Remind me later",
  "Enveloppes du mois":"Monthly envelopes",
  "Objectifs d'épargne":"Savings goals",
  "＋ Objectif":"＋ Goal",
  "＋ Nouvelle":"＋ New",
  "Solde mensuel restant":"Monthly balance left",
  "Aucun budget défini — ajoute-le dans Réglages quand tu veux":"No budget set — add one in Settings whenever you want",
  /* --- Stats / Historique --- */
  "Analyse de tes dépenses":"Analysis of your spending",
  "Semaine":"Week",
  "Mois":"Month",
  "Année":"Year",
  "Par catégorie":"By category",
  "vs mois précédent":"vs last month",
  "vs semaine précédente":"vs last week",
  "Tendance mensuelle":"Monthly trend",
  "Historique":"History",
  "tout":"All",
  "Récentes":"Recent",
  "Tout voir":"See all",
  "Moyenne / jour":"Average / day",
  "Plus grosse dépense":"Biggest expense",
  "Série de saisie (jours)":"Logging streak (days)",
  "Objectifs atteints":"Goals reached",
  "Total du mois":"Total this month",
  "Total de la semaine":"Total this week",
  "Total de l'année":"Total this year",
  "Aujourd'hui":"Today",
  "Hier":"Yesterday",
  "nouveau":"new",
  "Nouvelle dépense":"New expense",
  "Saisie rapide":"Quick entry",
  /* --- Sheets --- */
  "Libellé":"Label",
  "Catégorie":"Category",
  "Ajouter la dépense":"Add expense",
  "Supprimer la catégorie":"Delete category",
  "Déplacer vers":"Move to",
  "Catégorie de destination":"Destination category",
  "Tout réaffecter et supprimer":"Reassign all and delete",
  "Annuler":"Cancel",
  "Nouvelle catégorie":"New category",
  "Nom":"Name",
  "Icône":"Icon",
  "Couleur":"Color",
  "Créer la catégorie":"Create category",
  "Nouvelle récurrence":"New recurring expense",
  "Modifier la récurrence":"Edit recurring expense",
  "Montant (par mois)":"Amount (per month)",
  "Fréquence":"Frequency",
  "Mensuelle":"Monthly",
  "Hebdomadaire":"Weekly",
  "Jour du mois (1–28)":"Day of month (1–28)",
  "Jour de la semaine":"Day of week",
  "Lundi":"Monday","Mardi":"Tuesday","Mercredi":"Wednesday","Jeudi":"Thursday","Vendredi":"Friday","Samedi":"Saturday","Dimanche":"Sunday",
  "Programmer la récurrence":"Schedule recurring expense",
  "Enregistrer les changements":"Save changes",
  "Arrêter la récurrence":"Stop recurring expense",
  "Seront ajoutées automatiquement chaque mois, même en ouvrant l'app une fois par mois.":"Added automatically every month, even if you open the app once a month.",
  "Enregistrer":"Save",
  "Modifier la dépense":"Edit expense",
  "Date":"Date",
  "＋ Même dépense aujourd'hui":"＋ Same expense today",
  "Supprimer la dépense":"Delete expense",
  "Nouvel objectif":"New goal",
  "Montant cible":"Target amount",
  "Créer l'objectif":"Create goal",
  "Épargner":"Set aside",
  "Montant à mettre de côté":"Amount to set aside",
  "Ajouter à l'objectif":"Add to goal",
  "Retirer de l'objectif":"Withdraw from goal",
  "Modifier la catégorie":"Edit category",
  /* --- Réglages --- */
  "Réglages":"Settings",
  "Préférences de l'app":"App preferences",
  "Mon profil":"My profile",
  "Mon prénom":"My name",
  "Revoir la présentation":"Replay the intro",
  "Budget":"Budget",
  "Budget mensuel":"Monthly budget",
  "Catégories":"Categories",
  "Ajouter une catégorie":"Add a category",
  "Budgets par catégorie":"Category budgets",
  "Laisse une ligne vide pour n'utiliser que le budget global":"Lines left empty just use the global budget",
  "Dépenses récurrentes":"Recurring expenses",
  "Ajouter une récurrence":"Add a recurring expense",
  "Devise":"Currency",
  "Monnaie":"Currency",
  "Euro €":"Euro €",
  "Dollar $":"Dollar $",
  "Dollar US":"US dollar",
  "Dollar CAD":"CAD dollar",
  "Franc CFA":"CFA franc",
  "Franc suisse":"Swiss franc",
  "Livre £":"Pound £",
  "Franc CHF":"Swiss franc CHF",
  "Données":"Data",
  "Effacer toutes les données":"Erase all data",
  "Exporter en CSV":"Export as CSV",
  "Sauvegarde complète (JSON)":"Full backup (JSON)",
  "Importer un relevé CSV":"Import a bank statement (CSV)",
  "Restaurer une sauvegarde":"Restore a backup",
  "Installer l'application":"Install the app",
  "iPhone : Partager → « Sur l'écran d'accueil »":"iPhone: Share → « Add to Home Screen »",
  "Langue":"Language",
  "Système":"System",
  "Français":"Français",
  "English":"English",
  /* --- Onboarding --- */
  "Ton argent, sous contrôle.":"Your money, under control.",
  "Enveloppes, objectifs, récurrentes — en 2 minutes.":"Envelopes, goals, recurring — in 2 minutes.",
  "🔒 100% local — tes données restent sur ton téléphone, rien n'est envoyé.":"🔒 100% local — your data stays on your phone, nothing is ever sent.",
  "Créer mon profil":"Create my profile",
  "Passer":"Skip",
  "Tu t'appelles comment ?":"What's your name?",
  "Kola te salue chaque jour par ton prénom.":"Kola greets you every day by your name.",
  "Continuer":"Continue",
  "Ta devise ?":"Your currency?",
  "Tous tes montants seront affichés dans cette monnaie.":"All your amounts will be shown in this currency.",
  "Ton budget mensuel":"Your monthly budget",
  "(optionnel)":"(optional)",
  "Kola fonctionne très bien sans budget : tu verras juste tes dépenses, sans objectif. Tu pourras l'ajouter plus tard dans Réglages.":"Kola works just fine without a budget: you'll simply see your expenses, without targets. You can add one later in Settings.",
  "Continuer sans budget":"Continue without a budget",
  "Répartition conseillée ?":"Suggested split?",
  "Kola peut découper ton budget en enveloppes par catégorie :":"Kola can split your budget into category envelopes:",
  "Créer ces enveloppes":"Create these envelopes",
  "🚀 C'est parti !":"🚀 Let's go!",
  "Tout reste modifiable plus tard dans Réglages.":"Everything stays editable later in Settings.",
  /* --- CSV --- */
  "Import du relevé":"Statement import",
  "Importer les dépenses":"Import expenses",
  "Catégories devinées automatiquement — modifiables après en tapant une dépense.":"Categories guessed automatically — editable afterwards by tapping an expense.",
  "Rien de nouveau à importer":"Nothing new to import",
  "Passer sur un autre appareil":"Move to another device",
  "🌙 Vue du soir":"🌙 Evening view",
  "＋ Ajouter une dépense":"＋ Add an expense",
  "Rien saisi aujourd'hui — tout va bien.":"Nothing logged today — all good.",
  "{a} de trop sur le mois":"{a} over budget this month",
  "Kola ne transmet rien du tout : tu passes par un fichier. La ligne rouge du 100% local reste intacte.":"Kola sends nothing at all: you go through a file. The 100% local red line stays intact.",
  "Ici : Réglages → Sauvegarde complète (JSON)":"Here: Settings → Full backup (JSON)",
  "Envoie le fichier par Mail, AirDrop ou WhatsApp":"Send the file by Mail, AirDrop or WhatsApp",
  "Sur le nouvel appareil : Restaurer une sauvegarde → choisis fusionner":"On the new device: Restore a backup → choose merge",
  "Fusionner (ajoute, sans doublon)":"Merge (adds, no duplicates)",
  "Remplacer tout":"Replace everything",
  "Fusionner : ajoute les dépenses absentes de cet appareil (id + libellé + montant + date identiques = ignorées) et complète catégories et objectifs. Remplacer : efface tout ici et restaure tel quel.":"Merge: adds expenses missing from this device (same id + label + amount + date = skipped) and completes categories and goals. Replace: erases everything here and restores as is.",
  "guide":"guide",
  "OK":"OK",
  "Aucun doublon à la fusion":"No duplicates on merge",
  /* --- Livres --- */
  "Livres":"Books",
  "Livres de suivi":"Tracking books",
  "Personnel, maison, un enfant… un suivi par livre":"Personal, home, a child… one ledger per book",
  "Ajouter un livre":"Add a book",
  "Chaque livre a ses dépenses, enveloppes et objectifs — bascule en un tap depuis l'accueil.":"Each book has its own expenses, envelopes and goals — switch with one tap from Home.",
  "Nouveau livre":"New book",
  /* --- Livres / Dettes --- */
  "Dettes":"Debts",
  "🤝 Dettes":"🤝 Debts",
  "💸 Je dois":"💸 I owe",
  "🤝 On me doit":"🤝 They owe me",
  "🔁 Remboursements":"🔁 Repayments",
  "Analyse de tes dettes et créances":"Analysis of your debts and receivables",
  "Remboursé / encaissé":"Repaid / received",
  "Remboursement global":"Overall repayment",
  "Notées au total":"Logged in total",
  "Soldées":"Settled",
  "CSV des dettes exporté":"Debts CSV exported",
  "C'est un export dettes Kola — il ne s'importe pas en relevé bancaire.":"This is a Kola debts export — it can't be imported as a bank statement.",
  "Échéances à venir":"Due dates ahead",
  "Échéance aujourd'hui":"Due today",
  "Échéance demain":"Due tomorrow",
  "Je dois":"I owe",
  "On me doit":"They owe me",
  "Type de livre":"Book type",
  "📕 Dépenses":"📕 Expenses",
  "Nouvelle dette":"New debt",
  "＋ Dette":"＋ Debt",
  "Modifier la dette":"Edit debt",
  "Personne / Motif":"Person / Reason",
  "Échéance (facultatif)":"Due date (optional)",
  "Ajouter la dette":"Add debt",
  "Remboursement":"Repayment",
  "Enregistrer le paiement":"Save payment",
  "Dette ajoutée":"Debt added",
  "Dette mise à jour":"Debt updated",
  "Dette réglée":"Debt settled",
  "Payée":"Repaid",
  "Entre une personne ou un motif":"Enter a person or a reason",
  "Entre une date valide":"Enter a valid date",
  "Aucune dette pour le moment.":"No debt yet.",
  "Tout est réglé 🎉":"All settled 🎉",
  "Tape ＋ pour suivre ce que tu dois ou ce qu'on te doit.":"Tap ＋ to track what you owe or what you're owed.",
  "Supprimer":"Delete",
  "Nom du livre":"Book name",
  "Emoji du livre":"Book emoji",
  "Livre actuel":"Current book",
  "Modifier les livres":"Edit books",
  "🗑️ Livre « {a} » supprimé":"🗑️ Book “{a}” deleted",
  /* --- Thème --- */
  "Thème":"Theme",
  "Une couleur par livre, ou la même partout":"One color per book, or the same everywhere",
  "🎨 Thème du livre « {a} »":"🎨 Book theme “{a}”",
  "🎨 Thème global (tous les livres)":"🎨 Global theme (all books)",
  "Appliquer à tous les livres":"Apply to all books",
  "🎨 {a} — livre « {b} »":"🎨 {a} — book “{b}”",
  "🎨 {a} — tous les livres":"🎨 {a} — all books",
  "Émeraude":"Emerald",
  "Bleu":"Blue",
  "Indigo":"Indigo",
  "Violet":"Purple",
  "Rose":"Pink",
  "Orange":"Orange",
  "Supprimer le livre « {a} » et ses {n} dépense(s) ? Action irréversible.":"Delete book “{a}” and its {n} expense(s)? This cannot be undone.",
  "{n} livre(s)":"{n} book(s)",
  "Renommer":"Rename",
  /* --- Sauvegardes automatiques --- */
  "Sauvegardes automatiques":"Automatic backups",
  "Un instantané par jour, 7 jours gardés — rien à faire":"A snapshot a day, 7 days kept — nothing to do",
  "Kola enregistre un instantané complet chaque jour où tu apportes un changement. Tout reste dans le stockage durable de ce téléphone (IndexedDB) — rien n'est envoyé. Utile si un livre est supprimé par erreur ou qu'un import tourne mal.":"Kola records a full snapshot every day you make a change. It all stays in this phone's durable storage (IndexedDB) — nothing is sent. Useful if a book is deleted by mistake or an import goes wrong.",
  "Restaurer":"Restore",
  "Aucune sauvegarde encore":"No backup yet",
  "Elle apparaîtra après ton premier changement du jour.":"It will appear after your first change of the day.",
  "Introuvable":"Not found",
  "Un instantané à chaque ouverture — 7 jours gardés, rien à faire":"A snapshot on every open — 7 days kept, nothing to do",
  "Kola enregistre un instantané complet quand tu ouvres l'app (dernières 7 journées gardées). Tout reste dans le stockage durable de ce téléphone (IndexedDB) — rien n'est envoyé, rien à faire. Utile si un livre est supprimé par erreur ou qu'un import tourne mal : tu reviens en arrière d'un tap.":"Kola records a full snapshot when you open the app (last 7 days kept). It all stays in this phone's durable storage (IndexedDB) — nothing is sent, nothing to do. Useful if a book is deleted by mistake or an import goes wrong: you go back in one tap.","Supprimer toutes les sauvegardes auto":"Delete all automatic backups",
  "Supprimer toutes les sauvegardes automatiques de cet appareil ? Les données actuelles ne sont pas affectées.":"Delete all automatic backups on this device? Current data is not affected.",
  "Installe l'app":"Install the app",
  "iPhone : bouton Partager ↓ → « Sur l'écran d'accueil ». Tu l'auras en plein écran, hors ligne, comme une vraie appli.":"iPhone: Share button ↓ → “Add to Home Screen”. You'll get it full screen, offline, like a real app.",
  /* --- Légal --- */
  "Légal":"Legal",
  "Mentions légales":"Legal notices",
  "Politique de confidentialité":"Privacy policy",
  "Conditions d'utilisation":"Terms of use",
  "Fermer":"Close",
  "Un livre par suivi":"One book per ledger",
  "Sépare tes comptes : un livre Personnel, un pour la maison, un pour ton enfant… Bascule en un tap depuis l'accueil — et chaque livre peut avoir sa couleur.":"Separate your ledgers: one Personal book, one for home, one for your child… Switch with one tap from Home — and each book can have its own color.",
  "🪙 Personnel":"🪙 Personal",
  "🏠 Maison":"🏠 Home",
  "🧒 Enfant":"🧒 Child",
  "C'est parti !":"Let's go!",
  "Tu pourras en ajouter d'autres dans Réglages → Livres.":"You can add more later in Settings → Books.",
  "objectif(s)":"goal(s)",
  "récurrence(s)":"recurring expense(s)",
  "Aucune opération reconnaissable dans ce fichier":"No recognizable transactions in this file",
  "Import impossible : fichier invalide":"Import failed: invalid file",
  "Dépense importée":"Imported expense",
  /* --- Toasts / messages --- */
  "Entre un montant valide":"Enter a valid amount",
  "✓ Dépense ajoutée":"✓ Expense added",
  "✓ Modifiée":"✓ Updated",
  "＋ Dupliquée pour aujourd'hui":"＋ Duplicated for today",
  "Il faut au moins une catégorie":"At least one category is required",
  "Donne un nom à la catégorie":"Give the category a name",
  "Cette catégorie existe déjà":"This category already exists",
  "✓ Catégorie modifiée":"✓ Category updated",
  "✓ Récurrence mise à jour":"✓ Recurring expense updated",
  "Récurrence arrêtée":"Recurring expense stopped",
  "🔁 Récurrence programmée":"🔁 Recurring expense scheduled",
  "On te rappelle dans 3 jours":"We'll remind you in 3 days",
  "Objectif supprimé":"Goal deleted",
  "Nom et montant cible requis":"Name and target amount required",
  "Montant trop grand":"Amount too large",
  "Données effacées":"Data erased",
  "Budget mis à jour":"Budget updated",
  "Enveloppe mise à jour":"Envelope updated",
  "Profil mis à jour":"Profile updated",
  "Devise :":"Currency:",
  "💾 Sauvegarde exportée":"💾 Backup exported",
  "💾 Sauvegarde partagée — enregistre-la dans Fichiers":"💾 Backup shared — save it to Files",
  "📤 CSV exporté":"📤 CSV exported",
  "Partage annulé":"Share cancelled",
  "Pas encore de comparaison possible.":"No comparison possible yet.",
  "Rechercher une dépense…":"Search for an expense…",
  "Rechercher une dépense":"Search for an expense",
  "Budget global désactivé — Kola suit juste tes dépenses":"Global budget off — Kola just tracks your spending",
  "⚠️ Sauvegarde impossible — exporte tes données (Réglages → Données)":"⚠️ Backup failed — export your data (Settings → Data)",
  "Kola : impossible d'enregistrer":"Kola: unable to save",
  "🛜 Connexion rétablie":"🛜 Back online",
  "Modes hors ligne : tes données restent disponibles":"Offline mode: your data stays available",
  "📲 L'app fonctionne hors ligne":"📲 The app works offline",
  "Supprimer TOUTES les dépenses ? Cette action est irréversible.":"Delete ALL expenses? This cannot be undone.",
  "Supprimer TOUTES les données ? Dépenses, budgets, enveloppes, objectifs, récurrences et profil. Action irréversible.":"Delete ALL data? Expenses, budgets, envelopes, goals, recurring and profile. This cannot be undone.",
  "Supprimer TOUTES les données ? Dépenses, budgets, enveloppes, objectifs, récurrences et profil. Les sauvegardes automatiques récentes restent récupérables (Réglages → Données). Les sauvegardes exportées (fichiers) ne sont pas concernées.":"Delete ALL data? Expenses, budgets, envelopes, goals, recurring and profile. Recent automatic backups remain recoverable (Settings → Data). Exported backup files are unaffected.",
  "Supprimer":"Delete",
  "Modifier":"Edit",
  "Supprimer l'objectif":"Delete goal",
  "Aucune sauvegarde depuis la création — ton historique mérite un fichier":"No backup since day one — your history deserves a file",
  "Aucune dépense récurrente":"No recurring expenses",
  "＋ Nouvelle dépense":"＋ New expense",
  /* --- divers --- */
  /* --- Budget couple --- */
  "Enveloppes":"Envelopes",
  "Récurrences":"Recurring expenses",
  "Couple":"Couple",
  "Budget couple":"Couple budget",
  "Budget couple activé":"Couple budget on",
  "Budget couple désactivé":"Couple budget off",
  "Prénom du partenaire":"Partner's first name",
  "Fichier d'échange pour le partenaire":"Exchange file for your partner",
  "Importer le fichier du partenaire":"Import your partner's file",
  "Partage des dépenses par échange de fichier":"Share expenses through file exchange",
  "Deux téléphones, un budget — chaque téléphone exporte son fichier d'échange, l'autre l'importe. 100% local.":"Two phones, one budget — each phone exports its exchange file, the other imports it. 100% local.",
  "Moi":"Me",
  "Toi":"You",
  "À deux":"Both of us",
  "Qui a payé ?":"Who paid?",
  "jamais":"never",
  "⚖️ À égalité":"⚖️ Dead even",
  "Ce fichier n'est pas un fichier d'échange couple":"This file isn't a couple exchange file",
  "Rien de nouveau — à jour":"Nothing new — up to date",
  "Échange du couple":"Couple exchange",
  "Fusionner les dépenses du partenaire":"Merge partner's expenses",
  "📤 Fichier d'échange prêt":"📤 Exchange file ready",
  /* --- Synchro P2P --- */
  "Synchroniser en direct":"Sync in real time",
  "Synchroniser maintenant (Wi-Fi)":"Sync now (Wi-Fi)",
  "Je montre mon code":"I show my code",
  "Je scanne son code":"I scan their code",
  "Scanner la réponse":"Scan the answer",
  "Continuer avec ce code":"Continue with this code",
  "Préparation du code…":"Preparing code…",
  "L'autre téléphone scanne ce code (Réglages → Budget couple → 📷)":"The other phone scans this code (Settings → Couple budget → 📷)",
  "Fais scanner ce code par l'autre téléphone":"Have the other phone scan this code",
  "Caméra en cours…":"Starting camera…",
  "Caméra indisponible — colle le code dans le champ":"Camera unavailable — paste the code in the field",
  "Code invalide":"Invalid code",
  "Code trop long — utilise le fichier d'échange 📤":"Code too long — use the exchange file 📤",
  "Code réponse trop long — utilise le fichier d'échange 📤":"Answer code too long — use the exchange file 📤",
  "Connexion… synchronisation":"Connecting… syncing",
  "Connecté — échange des dépenses…":"Connected — exchanging expenses…",
  "Connexion perdue — réessaie ou utilise le fichier 📤":"Connection lost — retry or use the file 📤",
  "✓ Synchro faite — à jour":"✓ Sync done — up to date",
  "Historique trop gros 📤 — utilise le fichier d'échange":"History too big 📤 — use the exchange file",
  "Sauvegarder & exporter":"Save & export",
  "Importer un fichier":"Import a file",
  "Exporter":"Export",
  "Fichier d'échange couple : importe-le dans « Budget couple »":"Couple exchange file: import it under « Couple budget »",
  "Moyenne":"Average",
  "Total":"Total",
  "Transactions":"Transactions",
  "Stats":"Stats",
  "Répartition":"Split",
  "% seulement":"% only",
  "Montant":"Amount",
    "Aucune dépense pour le moment.":"No expenses yet.",
  "Pas encore de statistiques":"No stats yet",
  "Ajoute ta première dépense — Kola dessinera tes stats ici.":"Add your first expense — Kola will draw your stats here.",
  "Vérifie l'orthographe ou essaie un autre mot.":"Check the spelling or try another word.",
  "Rien en {a} pour le moment":"Nothing in {a} yet",
  "Ajoute une dépense dans cette catégorie — ou vois tout.":"Add an expense in this category — or see everything.",
  "Rien ce mois":"Nothing this month",
  "Les dépenses du couple s'ajouteront ici après une synchro.":"Couple expenses will collect here after a sync.",
  "Vide":"Empty",

  "Tape ＋ pour en ajouter une.":"Tap ＋ to add one.",
  "· atteint !":"· reached!",
  "Activer le budget couple":"Enable couple budget",
  "Les deux téléphones sur le même Wi-Fi. Les données circulent directement d'un téléphone à l'autre (WebRTC), sans serveur — le contenu ne quitte jamais le couple.":"Both phones on the same Wi-Fi. Data flows directly from phone to phone (WebRTC), no server — content never leaves the couple.",
  "➕ Je montre mon code":"➕ Show my code",
  "📷 Je scanne son code":"📷 Scan their code",
  "📷 Scanner la réponse":"📷 Scan the answer",
  "Ou colle ici le code de l'autre téléphone":"Or paste the other phone's code here",
  "Qui a payé":"Who paid",
  "Impossible de charger les outils QR — vérifie ta connexion":"Couldn't load QR tools — check your connection",
  "📷 Photo du reçu":"📷 Scan a receipt",
  "Photo de reçu":"Receipt photo",
  "Fermer":"Close",
  "Texte reconnu":"Recognized text",
  "Analyse du reçu en cours…":"Reading receipt…",
  "Chargement du moteur OCR…":"Loading OCR engine…",
  "Reçu analysé — vérifie les champs":"Receipt read — check the fields",
  "Impossible de lire le reçu 😕 — saisis-le à la main":"Couldn't read the receipt 😕 — enter it manually",
  "✓ Montant détecté — vérifie avant d'ajouter":"✓ Amount detected — check before adding",
  "⚠️ Montant non détecté — complète-le à la main":"⚠️ Amount not detected — fill it in manually",
  "photo et reconnaissance du texte : le 1ᵉʳ chargement (~5 Mo) demande le réseau":"photo and text recognition: first download (~5 MB) needs network",
};
/* Chaînes paramétrées (l'EN remplace le gabarit, {x} remplacés par les params) */
const I18N_EN_T = {
  /* --- Dettes --- */
  "{n} dette(s)":"{n} debt(s)",
  "{n} entrée(s)":"{n} item(s)",
  "Remboursement · {a}":"Repayment · {a}",
  "Supprimer ce remboursement ({a} du {b}) ?":"Delete this repayment ({a} on {b})?",
  "En retard de {n} jour{p}":"Late by {n} day{p}",
  "Dans {n} jour{p}":"In {n} day{p}",
  "Remboursé : {a} · {p} %":"Repaid: {a} · {p}%",
  "Encaissé : {a} · {p} %":"Received: {a} · {p}%",
  "Dette : {a}, {b}":"Debt: {a}, {b}",
  "Reste {a} · remboursé {p} %":"{a} left · {p}% repaid",
  "Échéance {a}":"Due {a}",
  "Paiement de {a} enregistré":"Payment of {a} saved",
  "Supprimer la dette « {a} » ({b}) ?":"Delete debt « {a} » ({b})?",
  "Supprimer le livre « {a} » et ses {n} dette(s) ? Action irréversible.":"Delete book « {a} » and its {n} debt(s)? Irreversible.",
  "🤝 {n} dette(s) fusionnée(s)":"🤝 {n} debt(s) merged",
  "Note un prêt ou une dette en un tap — pour un suivi complet, fais un livre 🤝 Dettes.":"Log a loan or debt in one tap — for full tracking, make a 🤝 Debts book.",
  "Catégorie {a}, {b}, glisse à droite pour modifier, à gauche pour supprimer":"Category {a}, {b}, swipe right to edit, left to delete",
  "Dépense : {a}, {b}":"Expense: {a}, {b}",
  "Enveloppe mensuelle : {a}":"Monthly envelope: {a}",
  "{a} de trop":"{a} over budget",
  "Aujourd'hui : {n} dépense(s) · ":"Today: {n} expense(s) · ",
  "{a} restants":"{a} left",
  "Dépensé ce mois : {a} · Budget {b}":"Spent this month: {a} · Budget {b}",
  "{n} transaction(s) · {t}":"{n} transaction(s) · {t}",
  "Afficher plus ({n} restantes)":"Show more ({n} left)",
  "Dernière sauvegarde : il y a {n} jour{p}":"Last backup: {n} day{p} ago",
  "📊 Fin de {m} — sauvegarde du mois":"📊 {m} is over — monthly backup",
  "{n} dépense(s) en {m} : archive-les dans un fichier JSON avant de tourner la page":"{n} expense(s) in {m}: archive them to a JSON file before turning the page",
  "{n} opération(s)":"{n} transaction(s)",
  "Total : ":"Total: ",
  "📥 {n} dépense(s) importée(s)":"📥 {n} expense(s) imported",
  "+{a} épargnés":"+{a} saved",
  "{a} retirés":"{a} withdrawn",
  "🎯 Objectif « {a} » créé":"🎯 Goal « {a} » created",
  "🎉 Objectif « {a} » atteint !":"🎉 Goal « {a} » reached!",
  "Supprimer l'objectif « {a} » ?":"Delete goal « {a} »?",
  "({a} épargnés sont à remettre de côté de ton côté.)":"({a} saved — remember to set it aside yourself.)",
  "Supprimer la catégorie « {a} » ?":"Delete category « {a} »?",
  "Supprimer « {a} » ?":"Delete « {a} »?",
  "Supprimer « {a} » ({b}) ?":"Delete « {a} » ({b})?",
  "« {a} » supprimée — tout déplacé vers « {b} »":"« {a} » deleted — everything moved to « {b} »",
  "« {a} » supprimée":"« {a} » deleted",
  "« {a} » ajoutée":"« {a} » added",
  "✓ « {a} » ajoutée":"✓ « {a} » added",
  "Arrêter la récurrence de « {a} » ?":"Stop recurring expense « {a} »?",
  "Import du relevé · {n} opérations":"Statement import · {n} transactions",
  "Importer {n} dépense(s) ?\nToutes les données actuelles seront remplacées.":"Import {n} expense(s)?\nAll current data will be replaced.",
  "👋 Bienvenue, {a} !":"👋 Welcome, {a}!",
    "chaque {a}":"every {a}",
    "échangé le {a}":"exchanged on {a}",
  "Aucun résultat pour « {a} »":"No results for « {a} »",
  "doit {a} à {b}":"owes {a} to {b}",
  "Échange de {a}":"Exchange from {a}",
  "📥 {n} dépense(s) de {a} ajoutée(s)":"📥 {n} expense(s) from {a} added",
  "✓ Synchro faite — {n} dépense(s) ajoutée(s)":"✓ Sync done — {n} expense(s) added",
  "📤 Fichier d'échange partagé — enregistre-le dans Fichiers":"📤 Exchange file shared — save it to Files",
  "📤 Fichier d'échange prêt — envoie-le à {a}":"📤 Exchange file ready — send it to {a}",
  "le {a} de chaque mois":"on day {a} of every month",
  "Sauvegarde du {d} · ":"Backup from {d} · ",
  "Devise du fichier : {a} (cette devise ici : {b})":"File currency: {a} (current currency here: {b})",
  "{n} doublon(s) ignoré(s) à la fusion":"{n} duplicate(s) skipped on merge",
  "Fichier de {a} — nom adopté":"File from {a} — name adopted",
  "📥 {n} dépense(s) ajoutée(s) par fusion":"📥 {n} expense(s) added by merge",
  "Remplacer TOUTES les données de cet appareil par le fichier ({n} dépense(s)) ?":"Replace ALL data on this device with the file ({n} expense(s))?",
  "Modifier la récurrence {a}":"Edit recurring expense {a}",
  "{n} dépense(s)":"{n} expense(s)",
  "{n} récurrence(s)":"{n} recurring expense(s)",
  "{n} et {c} utilisent cette catégorie. Où les déplacer ?":"{n} and {c} use this category. Where should they go?",
  "Épargner · ":"Set aside: ",
  "Épargner · {a}":"Set aside: {a}",
  "Devise : {a}":"Currency: {a}",
  "👋 Bienvenue dans Kola !":"👋 Welcome to Kola!",
  "📷 Analyse du reçu… {p}":"📷 Reading receipt… {p}",
  "📷 Photo du reçu choisie…":"📷 Receipt photo received…",
  "Bonjour":"Hello",
  "Bonsoir":"Good evening",
  "1 dépense":"1 expense",
  "1 récurrence":"1 recurring expense",
  "et":"and"
};
function i18nLang(){
  const set = state && state.lang;
  if (set === "fr" || set === "en") return set;
  return (navigator.language||"").toLowerCase().startsWith("en") ? "en" : "fr";
}
let LANG = "fr";
function t(s){ return LANG==="en" ? (I18N_EN[s] ?? s) : s; }
function tt(key, params){
  const s = LANG==="en" ? (I18N_EN_T[key] ?? key) : key;
  return s.replace(/\{(\w+)\}/g, (_,k)=> (params && params[k] !== undefined) ? params[k] : "");
}
/* Passe automatique : nœuds texte + attributs traduits si correspondance exacte */
const __i18nText = new WeakMap();   // nœud texte → valeur originale
const __i18nAttr = new WeakMap();   // élément → { attribut : valeur originale }
function i18nWalk(root){
  root = root.nodeType === 1 ? root : root.parentElement;
  if (!root) return;
  if (root.tagName !== "SCRIPT" && root.tagName !== "STYLE"){
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(n){
      return n.parentElement && n.parentElement.closest("script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }});
    w.currentNode = root;
    while (w.nextNode()){
      const n = w.currentNode;
      const raw = n.nodeValue; if (!raw || !raw.trim()) continue;
      const key = raw.trim().replace(/\s+/g," ");
      const en = I18N_EN[key];
      if (en === undefined || en === key) continue;
      if (!__i18nText.has(n)) __i18nText.set(n, raw);
      // write-back : la key (espaces normalisés) peut différer du raw
      // (espaces insécables FR, double espaces) → matching regex \s+ flexible,
      // sinon replace sans effet et le node reste en FR
      if (key === raw) n.nodeValue = en;
      else {
        const pat = new RegExp(key.split(/\s+/).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("\\s+"));
        const out = raw.replace(pat, en);
        if (out !== raw) n.nodeValue = out;
      }
    }
  }
  root.querySelectorAll && root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el=>{
    ["placeholder","aria-label","title"].forEach(a=>{
      const v = el.getAttribute(a); if (!v || v.trim() !== v) return;
      const en = I18N_EN[v]; if (en === undefined || en === v) return;
      const store = __i18nAttr.get(el) || {};
      if (!(a in store)) store[a] = v;
      __i18nAttr.set(el, store);
      el.setAttribute(a, en);
    });
  });
}
function i18nRestore(){
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()){ const n = w.currentNode; if (__i18nText.has(n)){ n.nodeValue = __i18nText.get(n); } }
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el=>{
    const store = __i18nAttr.get(el); if (!store) return;
    Object.entries(store).forEach(([a,v])=>el.setAttribute(a,v));
    __i18nAttr.delete(el);
  });
}
/* Anti ping-pong : on suspend l'observer pendant la traduction (pattern
   disconnect/observe) — sinon chaque mutation traduite re-déclenche l'observer
   en boucle. */
function i18nProcess(muts){
  __i18nObs.disconnect();
  try {
    muts.forEach(m=>{
      if (m.type === "characterData") i18nWalk(m.target);
      else if (m.type === "attributes" && m.attributeName && /^(placeholder|aria-label|title)$/.test(m.attributeName)) i18nWalk(m.target);
      m.addedNodes.forEach(n=>{ if (n.nodeType === 1 || n.nodeType === 3) i18nWalk(n); });
    });
  } finally {
    __i18nObs.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["placeholder","aria-label","title"] });
  }
}
const __i18nObs = new MutationObserver(muts=>{
  if (LANG !== "en") return;
  Promise.resolve().then(()=>i18nProcess(muts));
});

function applyI18n(){
  LANG = i18nLang();
  document.documentElement.lang = LANG;
  if (LANG === "en") i18nWalk(document.body);
  else i18nRestore();
}
/* Changement de langue : repasse le static puis re-rend tout (les rendus JS
   écrivent du FR, traduit à la volée par l'observer) */
function applyI18nFull(){
  renderLangRow();
  applyI18n();
  render();
  const active = document.querySelector(".page.active");
  if (active){ /* le contenu dynamique est couvert par re-render ci-dessus */ }
  if (!state.onboarded) showOnboarding();
}

// Échappe toute donnée utilisateur avant interpolation dans innerHTML (anti-XSS)
function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
// Date locale → "YYYY-MM-DD" (jamais via toISOString qui est en UTC)
function ymd(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
// Parse une saisie de montant : accepte "12,50" / "12.50" / "1 200,5"
function parseAmount(str){
  // Formats acceptés : « 1250 », « 1 250 », « 1 250,50 », « 1,250.50 » (EN), « 1.250,50 », « 12,50 »
  // Règle : si les deux séparateurs sont présents, le DERNIER est la décimale (l'anti-ambiguïté) ;
  // sinon une virgule suivie d'exactement 3 chiffres répétés = milliers (EN), sinon la virgule est décimale.
  if (typeof str !== "string") str = String(str ?? "");
  let s = str.replace(/[\s\u202F\u00A0'\u2009]/g, "").replace(/[^[0-9],.]/g, "");
  const firstDot = s.indexOf("."), firstComma = s.indexOf(",");
  if (firstDot > -1 && firstComma > -1){
    if (firstComma > firstDot) s = s.replace(/\./g, "").replace(/,/g, ".");   // « 1.250,50 »
    else s = s.replace(/,/g, "");                                             // « 1,250.50 »
  } else if (firstComma > -1){
    if (/^[0-9]{1,3}(,[0-9]{3})+$/.test(s)) s = s.replace(/,/g, "");          // « 1,250 » ou « 1,250,000 »
    else s = s.replace(/,/g, ".");                                            // « 1250,50 » / « 12,50 »
  }
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}
function catOf(k){ return state.cats[k] || { label:"Divers", emoji:"📦", color:"#8e8e93" }; }
function catBudgetTotal(){
  return Object.values(state.budgets||{}).reduce((s,v)=>s+(+v||0), 0);
}
const todayISO = () => ymd(new Date());
function dayName(iso){
  const d = new Date(iso + "T12:00:00"); const now = new Date();
  if (iso === todayISO()) return t("Aujourd'hui");
  if (iso === ymd(new Date(now.getTime()-DAY))) return t("Hier");
  return d.toLocaleDateString(I18N_LOCALE(),{weekday:'long', day:'numeric', month:'long'});
}

