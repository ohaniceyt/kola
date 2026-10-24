/* ============ Données ============ */
const CATS = {
  food:      { label:"Alimentation", emoji:"🍔", color:"#ff9500" },
  transport: { label:"Transport",    emoji:"🚕", color:"#5ac8fa" },
  shopping:  { label:"Shopping",     emoji:"🛍️", color:"#af52de" },
  bills:     { label:"Logement",     emoji:"🏠", color:"#5856d6" },
  fun:       { label:"Loisirs",      emoji:"🎬", color:"#ff2d55" },
  health:    { label:"Santé",        emoji:"💊", color:"#34c759" },
  other:     { label:"Autre",        emoji:"📦", color:"#8e8e93" },
};
const DAY = 864e5;
let state = null;

const SCHEMA_VERSION = 3;
function stateInit(raw){
  try {
    state = raw ? JSON.parse(raw) : null;
  } catch (err) {
    // Données corrompues : on garde une copie brute pour investigation, on repart propre
    console.warn("Kola : données illisibles, sauvegardées dans depenses-state-corrupt", err);
    try { localStorage.setItem("depenses-state-corrupt", raw || ""); } catch (_) {}
    state = null;
  }
  if (!state || typeof state !== "object") { state = { budget: 0, currency: "€", expenses: [] }; }
  if (!Array.isArray(state.expenses)) state.expenses = [];
  state.expenses = state.expenses.filter(e => e && typeof e === "object");
  if (!state.v || state.v < SCHEMA_VERSION) { state.v = SCHEMA_VERSION; }   // migrations future-proof
  if (!state.cats) { state.cats = catDefaults(); }
  if (!state.budgets) { state.budgets = {}; }
  if (!state.recurring) { state.recurring = []; }
  if (!state.goals) { state.goals = []; }
  if (!state.user) { state.user = { name:"" }; }
  if (state.kind !== "dettes") state.kind = "dep";          // type du livre courant (dépenses par défaut)
  if (!Array.isArray(state.debts)) state.debts = [];        // dettes du livre courant
  if (!state.couple) state.couple = { on:false, partner:"", sentIds:[], lastAt:"" };
  if (!Array.isArray(state.couple.sentIds)) state.couple.sentIds = [];
  if (typeof state.couple.on !== "boolean") state.couple.on = false;
  // Migration : les profils existants (données présentes) sautent l'onboarding
  if (state.onboarded === undefined) { state.onboarded = !!(raw && state.expenses.length); }
  if (raw && state.expenses.length) { processRecurring(); }   // pas de seed ici : l'onboarding décide
  booksEnsure();   // migration multi-livres : l'état plat devient le livre « Personnel »
}

/* load() : choisit la copie la plus récente (localStorage ⇄ IndexedDB) puis initialise */
async function load(){
  let raw = localStorage.getItem("depenses-state");
  let lsObj = null;
  try { lsObj = raw ? JSON.parse(raw) : null; } catch(_){ lsObj = null; }
  let idbWrap = null;
  try {
    if (window.indexedDB){
      idb = await idbOpen();
      if (idb){
        const w = await idbGet();
        if (w && w.app === "kola" && w.state && typeof w.state === "object") idbWrap = w;
      }
    }
  } catch(err){ console.warn("Kola : IndexedDB indisponible — localStorage seul", err); idb = null; }
  const lsRev = (lsObj && +lsObj.rev) || 0;
  const idbRev = (idbWrap && +idbWrap.rev) || 0;
  if (idbWrap && idbRev > lsRev){
    // la copie durable est plus à jour (ex : localStorage plein) → on la reprend
    console.info(`Kola : état repris d'IndexedDB (rev ${idbRev} > localStorage ${lsRev})`);
    stateInit(JSON.stringify(idbWrap.state));
  } else {
    stateInit(raw);
  }
  if (idbWrap && idbRev > 0 && (+state.rev||0) > idbRev){ idbPersist(); }  // sync immédiat de la copie durable
  save();
  maybeAutoSnap(true);                  // premier instantané du jour s'il n'existe pas
  renderAutoRow();
}

const SPLITS = { food:.30, bills:.25, transport:.10, shopping:.10, fun:.10, health:.05, other:.10 };
/* Étiquettes des catégories par défaut selon la langue détectée (le FR reste la source) */
function catDefaults(){
  if ((navigator.language||"").toLowerCase().startsWith("en")){
    return { food:{label:"Food",emoji:"🍔",color:"#ff9500"},
             transport:{label:"Transport",emoji:"🚕",color:"#5ac8fa"},
             shopping:{label:"Shopping",emoji:"🛍️",color:"#af52de"},
             bills:{label:"Housing",emoji:"🏠",color:"#5856d6"},
             fun:{label:"Fun",emoji:"🎬",color:"#ff2d55"},
             health:{label:"Health",emoji:"💊",color:"#34c759"},
             other:{label:"Other",emoji:"📦",color:"#8e8e93"} };
  }
  return JSON.parse(JSON.stringify(CATS));
}
/* ============ Livres (plusieurs suivis, un actif) ============ */
/* Exemples : 1 livre Personnel, 1 pour un enfant, 1 pour la maison.
   Chaque livre porte ses propres dépenses/budgets/enveloppes/objectifs/récurrences
   et ses catégories ; le reste (profil, monnaie, couple, langue) reste global.
   Le livre courant est remonté dans `state` (champs à plat) : tout le code
   existant (stats, historique, vues, couple) lit l'état à plat sans le savoir. */
const BOOK_FIELDS = ["budget","expenses","budgets","recurring","goals","cats","kind","debts"];
const SAFE_BOOK_ID = /^[a-z0-9-]{1,24}$/i;
/* Thèmes : l'accent (et les dégradés) par livre — ou global si le livre n'en définit pas */
const THEMES = [
  // a : accent (gros glyphs, FAB, dégradés boutons) ≥ 3:1 sur blanc en gros texte
  // b : départ du dégradé hero + texte accent sur fond clair ≥ 4.5:1 (petit texte)
  // c : fin du dégradé hero (plus foncé) ; rgb pour les rgba(x,.1/.12) d'états
  { id:"emerald", name:"Émeraude", a:"#0fa976", b:"#0c875e", c:"#0a6f4d", rgb:"15,169,118" },
  { id:"blue",    name:"Bleu",     a:"#0a84ff", b:"#0975e3", c:"#0a6ec3", rgb:"10,132,255" },
  { id:"indigo",  name:"Indigo",   a:"#5856d6", b:"#504ec8", c:"#3f3da0", rgb:"88,86,214" },
  { id:"violet",  name:"Violet",   a:"#af52de", b:"#a64ed3", c:"#8b3fae", rgb:"175,82,222" },
  { id:"rose",    name:"Rose",     a:"#ff2d55", b:"#e2284b", c:"#b4243f", rgb:"255,45,85" },
  { id:"orange",  name:"Orange",   a:"#d97f00", b:"#ad6500", c:"#8a5000", rgb:"217,127,0" },
];
const THEME_DEFAULT = "emerald";
function themeOf(){ return THEMES.find(x => x.id === ((curBook() || {}).theme || state.theme)) || THEMES[0]; }
/* applyTheme : pousse la palette du livre courant dans les variables CSS (fallback : :root) */
function applyTheme(){
  const t = themeOf();
  const r = document.documentElement.style;
  r.setProperty("--blue", t.a);
  r.setProperty("--link", t.b);   // texte accent sur fond clair : contraste renforcé (WCAG AA)
  r.setProperty("--grad-a", t.a); r.setProperty("--grad-b", t.b || t.a); r.setProperty("--grad-c", t.c || t.a);
  r.setProperty("--accent-rgb", t.rgb);
  document.querySelectorAll('meta[name="theme-color"]:not([media])').forEach(m => m.setAttribute("content", t.a));
}
function safeBookName(n){
  return String(n ?? "").replace(/[<>&"'`\\{}]/g, "").slice(0, 40).trim() || "Livre";
}
function getBooks(){ return Array.isArray(state.books) ? state.books.filter(b => b && typeof b === "object") : []; }
let bookSeq = 0;
function bookNew(name, emoji, id, kind){
  if (!id || !SAFE_BOOK_ID.test(id)) id = "b" + Date.now().toString(36) + (+(bookSeq++) + Math.floor(Math.random()*36)).toString(36);
  return { id, name: safeBookName(name), emoji: safeEmoji(emoji || "📖"),
           data: { budget: 0, expenses: [], budgets: {}, recurring: [], goals: [], cats: catDefaults(),
                   kind: kind === "dettes" ? "dettes" : "dep", debts: [] } };
}
function curBook(){
  const bs = getBooks();
  return bs.find(b => b.id === state.bookId) || bs[0];
}
/* booksEnsure : migration (état plat → 1 livre) + normalisation + remontée du livre courant */
function booksEnsure(){
  const catsOk = c => c && typeof c === "object" && !Array.isArray(c) && Object.keys(c).length;
  if (!getBooks().length){
    // Les données existantes (état plat d'avant les livres) deviennent le premier livre
    state.books = [{ id: "b1", name: "Personnel", emoji: "🪙",
      data: { budget: +state.budget || 0,
              expenses: Array.isArray(state.expenses) ? state.expenses : [],
              budgets: (state.budgets && typeof state.budgets === "object" && !Array.isArray(state.budgets)) ? state.budgets : {},
              recurring: Array.isArray(state.recurring) ? state.recurring : [],
              goals: Array.isArray(state.goals) ? state.goals : [],
              cats: catsOk(state.cats) ? state.cats : catDefaults(),
              kind: state.kind === "dettes" ? "dettes" : "dep",
              debts: normalizeDebts(state.debts) } }];
  }
  const seen = new Set();
  state.books = state.books.filter(b => b && typeof b === "object").map(b => {
    if (!b.id || !SAFE_BOOK_ID.test(b.id) || seen.has(b.id)) b.id = bookNew(b.name, b.emoji).id;
    seen.add(b.id);
    b.name = safeBookName(b.name);
    b.emoji = safeEmoji(b.emoji || "📖");
    if (b.theme && !THEMES.some(t => t.id === b.theme)) delete b.theme;   // thème inconnu → global
    // tolère un livre arrivé sans objet `data` (ancien format intermédiaire)
    if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) b.data = {};
    b.data.budget = +b.data.budget || 0;
    if (!Array.isArray(b.data.expenses)) b.data.expenses = [];
    if (!b.data.budgets || typeof b.data.budgets !== "object" || Array.isArray(b.data.budgets)) b.data.budgets = {};
    if (!Array.isArray(b.data.recurring)) b.data.recurring = [];
    if (!Array.isArray(b.data.goals)) b.data.goals = [];
    if (!catsOk(b.data.cats)) b.data.cats = catDefaults();
    b.data.kind = (b.data.kind === "dettes") ? "dettes" : "dep";
    b.data.debts = normalizeDebts(b.data.debts);
    return b;
  });
  if (!state.bookId || !seen.has(state.bookId)) state.bookId = state.books[0].id;
  if (state.theme && !THEMES.some(t => t.id === state.theme)) delete state.theme;
  const c = curBook();
  BOOK_FIELDS.forEach(f => { state[f] = c.data[f]; });
}
/* bookStore : recopie les champs à plat du livre courant dans state.books (avant bascule) */
function bookStore(){
  const b = curBook(); if (!b) return;
  b.data = { budget: +state.budget || 0, expenses: state.expenses, budgets: state.budgets,
             recurring: state.recurring, goals: state.goals, cats: state.cats,
             kind: state.kind === "dettes" ? "dettes" : "dep", debts: state.debts };
}
function bookSwitch(id){
  const b = getBooks().find(x => x.id === id);
  if (!b || id === state.bookId) return;
  bookStore();
  state.bookId = id;
  BOOK_FIELDS.forEach(f => { state[f] = b.data[f]; });
  save(); render(); renderBookbar(); renderBooksRow(); applyTheme();
  if (document.getElementById("book-sheet").classList.contains("show")) renderBookSheet();
  toast(b.emoji + " " + b.name);
}
function bookAdd(name, emoji, kind){
  bookStore();
  const b = bookNew(name, emoji, null, kind);
  state.books.push(b);
  state.bookId = b.id;
  BOOK_FIELDS.forEach(f => { state[f] = b.data[f]; });
  save(); render(); renderBookbar(); renderBooksRow();
  if (document.getElementById("book-sheet").classList.contains("show")) renderBookSheet();
  toast(b.emoji + " " + b.name);
}
function bookRename(id, name, emoji, kind){
  const b = getBooks().find(x => x.id === id); if (!b) return;
  b.name = safeBookName(name);
  b.emoji = safeEmoji(emoji || b.emoji);
  if ((kind === "dettes" || kind === "dep") && b.data.kind !== kind){
    // Bascule de type : les données de l'ancien type restent intègres (cachées, pas perdues)
    b.data.kind = kind;
    if (id === state.bookId) state.kind = kind;
    // si c'est un autre livre, le flat state le prendra à la prochaine bookSwitch
  }
  save(); render(); renderBookbar(); renderBooksRow();
  if (document.getElementById("book-sheet").classList.contains("show")) renderBookSheet();
}
function bookDelete(id){
  if (getBooks().length <= 1) return;
  const idx = state.books.findIndex(b => b.id === id); if (idx < 0) return;
  const gone = state.books[idx];
  state.books.splice(idx, 1);
  if (state.bookId === id){
    state.bookId = state.books[0].id;
    BOOK_FIELDS.forEach(f => { state[f] = state.books[0].data[f]; });
  }
  save(); render(); renderBookbar(); renderBooksRow();
  if (document.getElementById("book-sheet").classList.contains("show")) renderBookSheet();
  toast(tt("🗑️ Livre « {a} » supprimé", { a: gone.name }));
}
function renderBookbar(){
  const bar = document.getElementById("bookbar"); if (!bar) return;
  bar.innerHTML = getBooks().map(b =>
    `<button class="book-chip${b.id === state.bookId ? " on" : ""}" onclick="bookSwitch('${b.id}')" aria-label="${esc(b.name)}">${esc(b.emoji)} ${esc(b.name)} <span class="cnt">${b.data.kind === "dettes" ? (b.data.debts || []).length : (b.data.expenses || []).length}</span></button>`
  ).join("") + `<button class="book-chip add" onclick="openBookSheet()" aria-label="${esc(t("Modifier les livres"))}">＋ ${esc(t("Livres"))}</button>`;
}
function renderBooksRow(){
  const el = document.getElementById("books-count"); if (!el) return;
  const b = curBook();
  el.textContent = `${getBooks().length} · ${b ? b.name : ""}`;
}
