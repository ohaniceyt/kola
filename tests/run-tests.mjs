/*
 * Batterie de tests de Kola — `node tests/run-tests.mjs`
 *
 * Les fonctions testées sont pures et vivent dans index.html : on les extrait
 * par sections (repères stables) et on les évalue avec des stubs injectés.
 * Zéro dépendance. Couvre : parseur de montants, CSV (banque Débit/Crédit,
 * relevés signés), validation stricte des sauvegardes (anti-injection),
 * extraction OCR (montant/date/marchand), récurrences (jamais rétroactives).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "index.html"), "utf8")
  .split("<script>")[1].split("</script>")[0];

const grab = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a === -1 || b === -1 || b <= a) throw new Error(`Section introuvable : ${from}`);
  return src.slice(a, b);
};

const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayISO = () => ymd(new Date());

/* --- Extraction des fonctions pures --- */
const amountFns = new Function(grab("function esc(", "function catOf") + "return { esc, parseAmount };")();
const csvFns = new Function("DAY", grab("const CAT_HINTS", "let csvRows = null") + "return { parseMoneyCell, normalizeCsvDate, parseCsv, guessCat };")(864e5);
const CATS = { other:{label:"Autre",emoji:"📦",color:"#8e8e93"}, food:{label:"Alimentation",emoji:"🍔",color:"#ff9500"}, transport:{label:"Transport",emoji:"🚕",color:"#5ac8fa"} };
const backupFns = new Function("SCHEMA_VERSION", "CATS", grab("/* ====== Restauration : aperçu + fusion dédoublonnée ou remplacement ====== */", "let backupPending") + "return { buildBackup };")(3, CATS);
const ocr = new Function("state", grab("function parseAmount", "function catOf") +
  grab("const stripAccents", "function fillOcrCats") + "return { ocrExtract, ocrGuessCat, stripAccents };")(
  { cats: { food:{label:"Alimentation"}, transport:{label:"Transport"}, bills:{label:"Logement"}, fun:{label:"Loisirs"}, health:{label:"Santé et pharmacie"}, other:{label:"Autre"} } });
const recFns = new Function("ymd", "todayISO", "state", "save", grab("/* ============ Dépenses récurrentes ============ */", "function renderRecurring") + "return { nextOccur, firstOccur, processRecurring };")(ymd, todayISO, { expenses: [], recurring: [] }, () => {});

const { esc, parseAmount } = amountFns;
const { parseMoneyCell, normalizeCsvDate, parseCsv, guessCat } = csvFns;
const { buildBackup } = backupFns;
const { ocrExtract, ocrGuessCat } = ocr;
const { nextOccur, firstOccur, processRecurring } = recFns;

/* --- Harnais --- */
let passed = 0, failed = 0;
const eq = (a, b, msg) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) passed++; else { failed++; console.error(`✗ ${msg}\n   attendu : ${JSON.stringify(b)}\n   obtenu  : ${JSON.stringify(a)}`); }
};
const check = (cond, msg) => cond ? passed++ : (failed++, console.error(`✗ ${msg}`));

/* ======== parseAmount ======== */
eq(parseAmount("12,50"), 12.5, "parseAmount 12,50");
eq(parseAmount("1250"), 1250, "parseAmount 1250");
eq(parseAmount("1 250"), 1250, "parseAmount espace milliers");
eq(parseAmount("1,250.50"), 1250.5, "parseFormat EN 1,250.50");
eq(parseAmount("1.250,50"), 1250.5, "parseFormat FR 1.250,50");
eq(parseAmount("12,5"), 12.5, "parseAmount 12,5");
eq(parseAmount("1,250"), 1250, "parseAmount virgule 3 chiffres = milliers");
eq(parseAmount(""), 0, "parseAmount vide");
eq(parseAmount("abc"), 0, "parseAmount lettres");

/* ======== parseMoneyCell ======== */
eq(parseMoneyCell("-13,49"), -13.49, "montant négatif");
eq(parseMoneyCell("45,20-"), -45.2, "signe en suffixe (banque)");
eq(parseMoneyCell("1 234,56"), 1234.56, "milliers FR");
eq(parseMoneyCell("1,234.56 EUR"), 1234.56, "milliers EN + devise");
eq(parseMoneyCell(""), null, "vide → null");
eq(parseMoneyCell("+1800,00"), 1800, "plus préfixe");
eq(parseMoneyCell("2 000,00 EUR"), 2000, "espace + devise");

/* ======== normalizeCsvDate ======== */
eq(normalizeCsvDate("2026-10-10"), "2026-10-10", "date ISO");
eq(normalizeCsvDate("10/09/2026"), "2026-09-10", "JJ/MM/AAAA");
eq(normalizeCsvDate("10/09/26"), "2026-09-10", "JJ/MM/AA");
eq(normalizeCsvDate("2026.10.10"), "2026-10-10", "point séparateur");
eq(normalizeCsvDate("32/13/2026"), null, "date impossible → null");

/* ======== parseCsv ======== */
eq(parseCsv("Date;Libellé;Montant\n10/09/2026;Netflix;-13,49\n11/09/2026;Salaire reçu;+1800,00\n12/09/2026;Carrefour;-45,20"),
   [{ date:"2026-09-10", label:"Netflix", amount:13.49, cat:"bills" },
    { date:"2026-09-12", label:"Carrefour", amount:45.2, cat:"food" }],
   "relevé signé : crédits ignorés, montants positifs");
eq(parseCsv("Date;Libellé;Montant\n10/09/2026;Netflix;13.49\n11/09/2026;Carrefour;45.20").length, 2,
   "relevé sans signe : tout importé");
eq(parseCsv("Date\tLibellé\tMontant\n10/09/2026\tUber\t12.90"),
   [{ date:"2026-09-10", label:"Uber", amount:12.9, cat:"transport" }],
   "séparateur tabulation + cat devinée");
const rSplit = parseCsv("Date;Libellé;Debit;Credit\n10/09/2026;Netflix;13,49;\n11/09/2026;Salaire;;1800,00\n12/09/2026;Carrefour;45,20;5,00");
eq(rSplit, [{ date:"2026-09-10", label:"Netflix", amount:13.49, cat:"bills" },
            { date:"2026-09-12", label:"Carrefour", amount:45.2, cat:"food" }],
   "colonnes Débit/Crédit : la colonne Crédit n'est jamais une dépense");
eq(parseCsv("Date;Libellé;Credit\n10/09/2026;Salaire;1800,00"), [], "relevé crédit seul : rien importé");
eq(guessCat("NETFLIX SARL"), "bills", "guessCat Netflix → bills");
eq(guessCat("UBER PARIS"), "transport", "guessCat Uber → transport");

/* ======== buildBackup (validation stricte, anti-injection) ======== */
const UUIDRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const evil = buildBackup({
  expenses: [{ id: '"><img src=x onerror=alert(1)>', name: "ok", cat: "food", amount: 5, date: "2026-10-01" }],
  cats: { '"><img>': { label: "<xss>", emoji: "<img src=x onerror=alert(1)>", color: '"><script>' },
          food: { label: "Alimentation", emoji: "🍔", color: "#ff9500" } },
  budgets: { '"><img>': '"><u>', food: "50" },
  goals: [{ name: "g", target: 1, saved: 0, id: "x'); alert(1); ('" }],
  recurring: [{ name: "r", cat: "food", amount: 1, lastAdded: "not-a-date" }]
});
check(Object.values(evil.expenses).every(e => UUIDRE.test(e.id)), "buildBackup : id malveillant → UUID");
check(Object.keys(evil.cats).every(k => /^[a-z][a-z0-9_-]{0,31}$/i.test(k)), "buildBackup : clés de catégories sûres");
check(Object.values(evil.cats).every(c => /^#[0-9a-f]{6}$/i.test(c.color) && !/[<>&"'`\\\/{}]/.test(c.emoji)), "buildBackup : emoji/couleur neutralisés");
check(evil.goals.every(g => UUIDRE.test(g.id)), "buildBackup : id d'objectif reconstruit");
check(evil.recurring.every(r => r.lastAdded === ""), "buildBackup : lastAdded invalide vidé");
check(evil.budgets.food === 50 && evil.budgets.food !== undefined && Number.isFinite(evil.budgets.food), "buildBackup : budget légitime conservé");
eq(evil.expenses[0].cat, "food", "buildBackup : référence cat remappée vers la bonne clé");
const legit = buildBackup({
  rev: 42, budget: 1000,
  cats: { food: { label: "Alimentation", emoji: "🍔", color: "#ff9500" } },
  budgets: { food: 300 },
  recurring: [{ name: "Loyer", cat: "food", amount: 700, freq: "m", day: 5, lastAdded: "2026-09-05" }],
  goals: [{ name: "Japon", target: 5000, saved: 100 }],
  expenses: [{ id: "01234567-89ab-cdef-0123-456789abcdef", name: "Café", cat: "food", amount: 2.5, date: "2026-10-10" }]
});
check(legit.expenses[0].id === "01234567-89ab-cdef-0123-456789abcdef" && legit.goals[0].id.length !== undefined && UUIDRE.test(legit.goals[0].id), "buildBackup : ids valides conservés");
check(legit.rev === 42 && legit.budget === 1000 && legit.budgets.food === 300, "buildBackup : rev/budgets intacts");
check(legit.recurring[0].lastAdded === "2026-09-05" && legit.recurring[0].cat === "food", "buildBackup : récurrence date/cat conservées");

/* ======== ocrExtract ======== */
eq(ocrExtract("CARREFOUR MARKET\n2026-10-01\nTOTAL : 12,50 €").amount, 12.5, "OCR montant ligne TOTAL");
eq(ocrExtract("SOUS-TOTAL 10,00\nTOTAL : 12,50").amount, 12.5, "OCR : TOTAL au-dessus du sous-total");
eq(ocrExtract("TICKET\n10/10/2026\nTOTAL : 12,50").date, "2026-10-10", "OCR date JJ/MM/AAAA");
eq(ocrExtract("TICKET\n2026-10-01\nTOTAL : 12,50").date, "2026-10-01", "OCR date ISO");
eq(ocrExtract("CARREFOUR MARKET\n1234 MAIN ST\nTOTAL 12,50").merchant, "CARREFOUR MARKET", "OCR marchand = 1ʳᵉ ligne");
eq(ocrExtract("NET A PAYER 45,00 €").amount, 45, "OCR montant NET À PAYER");
eq(ocrExtract("TOTAL").amount, 0, "OCR sans montant → 0");
eq(ocrExtract("TVA 1,20\nTOTAL 12,50").amount, 12.5, "OCR : la TVA n'est pas le total");
check(typeof ocrExtract("TOTAL 2").amount === "number" && typeof ocrExtract("TOTAL 2").date === "string", "OCR : sortie toujours objet date/amount/merchant");
check(ocrExtract(null).amount === 0 && ocrExtract(null).date === "", "OCR : entrée non-string → valeurs neutres");

/* ======== ocrGuessCat ======== */
eq(ocrGuessCat("SUPERMARCHE SHOPRITE"), "food", "OCR cat supermarché → food");
eq(ocrGuessCat("STATION TAXI METRO"), "transport", "OCR cat transport");
eq(ocrGuessCat("PHARMACIE CENTRALE"), "health", "OCR cat pharmacie → santé");
check(["food","transport","bills","fun","health","other"].includes(ocrGuessCat("")), "OCR cat fallback = une catégorie existante");

/* ======== Récurrences ======== */
const today = todayISO();
check(firstOccur({freq:"m", day:1}) > today, "récurrence mensuelle jour passé → prochaine occurrence");
check(firstOccur({freq:"m", day:28}) >= today, "récurrence mensuelle : jamais rétroactive");
check(firstOccur({freq:"w", wd:0}) >= today, "récurrence hebdo : jamais rétroactive");
// nextOccur : bascule d'année
eq(nextOccur({freq:"m", day:5}, "2026-12-05"), "2027-01-05", "nextOccur décembre → janvier");
eq(nextOccur({freq:"m", day:31}, "2026-01-31"), "2026-02-28", "nextOccur jour 31 clôt au 28");
eq(nextOccur({freq:"w", wd:0}, "2026-10-05"), "2026-10-12", "nextOccur hebdo +7 jours");
// processRecurring : rattrapage complet
{
  const state = { expenses: [], recurring: [{ name: "Loyer", cat: "food", amount: 700, freq: "m", day: 5, lastAdded: "2026-09-05" }] };
  const fns = new Function("ymd", "todayISO", "state", "save", grab("/* ============ Dépenses récurrentes ============ */", "function renderRecurring") + "return { processRecurring };")(ymd, todayISO, state, () => {});
  fns.processRecurring();
  check(state.expenses.length === 1, "rattrapage : 1 occurrence échue (octobre)");
  eq(state.expenses[0]?.date, "2026-10-05", "rattrapage : date de l'occurrence");
  eq(state.recurring[0].lastAdded, (today >= "2026-10-05" && today < "2026-11-05") ? "2026-10-05" : state.recurring[0].lastAdded, "rattrapage : lastAdded avancé");
  // nouvelle récurrence créée en cours de mois, jour déjà passé : rien d'inséré
  const st2 = { expenses: [], recurring: [{ name: "Netflix", cat: "fun", amount: 13.5, freq: "m", day: 1, lastAdded: "" }] };
  const fns2 = new Function("ymd", "todayISO", "state", "save", grab("/* ============ Dépenses récurrentes ============ */", "function renderRecurring") + "return { processRecurring };")(ymd, todayISO, st2, () => {});
  fns2.processRecurring();
  eq(st2.expenses.length, today.slice(8) < "01" ? 1 : 0, "création en cours de mois avec jour passé : pas d'ajout rétroactif");
}

/* ======== Budget couple ======== */
const TODAY = "2026-10-10";
const ST = {};
const useST = obj => {
  Object.keys(ST).forEach(k => delete ST[k]);
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    ST[k] = (Array.isArray(v)) ? v.map(x=>JSON.parse(JSON.stringify(x)))
         : (v && typeof v === "object") ? JSON.parse(JSON.stringify(v)) : v;
  });
  return ST;
};
const coupleFns = new Function("SCHEMA_VERSION", "CATS", "state", "todayISO",
  grab("/* ====== Restauration : aperçu + fusion dédoublonnée ou remplacement ====== */", "let backupPending") +
  grab("/* ============ Budget couple ============ */", "/* ====== Vue du soir") +
  "const LANG = \"fr\"; return { couple, remapWho, buildCoupleExport, coupleMergeInto, buildCoupleImport };"
)(3, { other:{label:"Autre",emoji:"\ud83d\udce6",color:"#8e8e93"}, food:{label:"Alimentation",emoji:"\ud83c\udf54",color:"#ff9500"} }, ST, () => TODAY);
const { remapWho, buildCoupleExport, coupleMergeInto, buildCoupleImport } = coupleFns;

const emptyCouple = () => ({ on:true, partner:"", sentIds:[], lastAt:"", deviceId:"11111111-1111-4111-8111-111111111111" });
const stA = () => ({ budget: 100,
  expenses: [
    { id:"aaaaaaaa-1111-4111-8111-000000000001", name:"Café", cat:"food", amount:2.5, date:"2026-10-09", who:"me" },
    { id:"aaaaaaaa-1111-4111-8111-000000000002", name:"Courses", cat:"food", amount:40, date:"2026-10-10", who:"shared" }
  ],
  cats: { food:{label:"Alimentation",emoji:"\ud83c\udf54",color:"#ff9500"} }, budgets:{}, goals:[], recurring:[] });
const stB = () => ({ budget: 0,
  expenses: [ { id:"bbbbbbbb-2222-4222-8222-000000000001", name:"Taxi", cat:"transport", amount:12, date:"2026-10-09", who:"me" } ],
  cats:{}, budgets:{}, goals:[], recurring:[] });

// remappage moi⇄toi selon la provenance
eq(remapWho("me", false), "partner", "remapWho : moi → toi");
eq(remapWho("partner", false), "me", "remapWho : toi → moi");
eq(remapWho("shared", false), "shared", "remapWho : à deux inchangé");
eq(remapWho("me", true), "me", "remapWho : même deviceId → inchangé");

// A exporte son delta, B le fusionne
{
  const A = stA(); A.couple = emptyCouple();
  useST(A);
  const payload = buildCoupleExport();
  const bk = buildCoupleImport(JSON.parse(JSON.stringify({ ...payload, from: A.couple.deviceId, name: "Ama" })));
  check(bk && bk.app === "kola-couple" && bk.expenses.length === 2, "couple : export → import complet");
  const B = stB(); B.couple = { on:false, partner:"", sentIds:[], lastAt:"", deviceId:"22222222-2222-4222-8222-222222222222" };
  const r1 = coupleMergeInto(B, bk, false);
  eq(r1.added, 2, "couple : fusion B reçoit les 2 dépenses de A");
  eq(B.expenses.find(e=>e.name==="Courses").who, "shared", "couple : à deux inchangé chez B");
  check(B.couple.on && B.couple.partner === "Ama", "couple : activation + prénom adoptés");
  check(B.couple.sentIds.includes("aaaaaaaa-1111-4111-8111-000000000001"), "couple : ids reçus marqués envoyés");
  // B répond : son delta n'inclut PAS les dépenses reçues (déjà connues de A)
  useST(B);
  const payloadB = buildCoupleExport();
  eq(payloadB.expenses.map(e=>e.name), ["Taxi"], "couple : la réponse de B ne renvoie pas les dépenses de A");
  const bkB = buildCoupleImport({ app:"kola-couple", expenses: payloadB.expenses, cats: payloadB.cats, budgets: payloadB.budgets,
    budget: payloadB.budget, goals: payloadB.goals, recurring: payloadB.recurring, from: B.couple.deviceId, name: "Koami" });
  const r2 = coupleMergeInto(A, bkB, false);
  eq(r2.added, 1, "couple : fusion A reçoit le delta de B");
  eq(A.expenses.find(e=>e.name==="Taxi").who, "partner", "couple : taxi de B = partner chez A");
  // idempotence : refusion du même fichier → 0 ajouté
  const r3 = coupleMergeInto(A, bkB, false);
  eq(r3.added, 0, "couple : refusion = 0 ajout (dédup id + date|nom|montant)");
  // second appareil de la même personne : pas de swap
  const A2 = stB(); A2.couple = { on:true, partner:"", sentIds:[], lastAt:"", deviceId:"11111111-1111-4111-8111-111111111111" };
  coupleMergeInto(A2, bkB, true);
  eq(A2.expenses[0].who, "me", "couple : même deviceId → attribution inchangée");
  // fichier malveillant sur le couple
  const evil = buildCoupleImport({ app:"kola-couple", from:"11111111-1111-4111-8111-111111111111", name:"<x>",
    expenses:[{ id:"x'); alert(1); ('", name:"<b>", cat:"food", amount:1, date:"2026-10-01", who:"me" }] });
  check(evil && UUIDRE.test(evil.expenses[0].id), "couple : id malveillant reconstruit dans le canal couple");
  check(buildCoupleImport({ app:"autre", expenses:[] }) === null, "couple : app inconnue rejetée");
  check(buildCoupleImport({ app:"kola-couple", expenses:"pas-un-tableau" }) === null, "couple : expenses non-tableau rejeté");
}

/* ======== timestamp + ordre intra-jour ======== */
const stTs = useST({ budget:0, expenses:[
  { id:"bbbbbbbb-0000-4000-8000-000000000002", name:"Deuxieme", cat:"food", amount:2, date:"2026-10-10", who:"me" },
  { id:"bbbbbbbb-0000-4000-8000-000000000001", name:"Premier",  cat:"food", amount:1, date:"2026-10-10", who:"me", ts:1700000000000 }
], couple: emptyCouple() });
const expTs = buildCoupleExport();
check(expTs.expenses[0].ts === 0 && expTs.expenses[1].ts === 1700000000000, "couple : ts exporté tel quel (absent → 0)");
const bakTs = buildBackup({ expenses: expTs.expenses, cats: { food: { label:"Food", emoji:"\ud83c\udf54", color:"#ff9500" } } });
eq(bakTs.expenses.map(e=>e.ts), [0, 1700000000000], "buildBackup : ts validé (borne 1e12–9e15) et conservé");
const badTs = buildBackup({ expenses: [{ id:"aaaaaaaa-1111-4111-8111-000000000001", name:"x", cat:"food", amount:1, date:"2026-10-10", ts:"'; drop table" }] });
eq(badTs.expenses[0].ts, 0, "buildBackup : ts non numérique → 0");

/* ======== esc ======== */
eq(esc("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)&gt;", "esc : balise");
eq(esc('"a\'&'), "&quot;a&#39;&amp;", "esc : guillemets + &");
eq(esc(null), "", "esc : null → chaîne vide");

/* ======== byRecent (ordre récent→ancien, tolérant aux données anormales) ======== */
const recentFns = new Function(grab("/* Ordre canonique", "function renderList") + "return { byRecent };")();
const { byRecent } = recentFns;
check(byRecent({ date:"2026-10-11" }, { date:"2026-10-10" }) < 0, "byRecent : plus récent d'abord");
check(byRecent({ date:"2026-10-11", ts:1 }, { date:"2026-10-11", ts:9 }) > 0, "byRecent : ts décroissant intra-jour");
let threw = false;
try { byRecent(null, { date:"2026-10-10" }); byRecent({ date:"2026-10-10" }, undefined); } catch(e){ threw = true; }
check(!threw, "byRecent : entrées null/undefined ne plantent pas");

/* ======== Livres (multi-suivis) ======== */
const docStub = { getElementById: () => ({ classList: { contains: () => false } }),
  documentElement: { style: { setProperty: () => {} } }, querySelectorAll: () => [] };
const makeBooks = s => new Function("state", "catDefaults", "safeEmoji", "esc", "t", "tt", "toast", "save", "render", "renderBookbar", "renderBooksRow", "document",
  grab("/* ============ Livres (plusieurs suivis, un actif) ============ */", "function autoSplitBudget") +
  "return { booksEnsure, bookStore, bookNew, bookSwitch, safeBookName, getBooks, curBook, bookDelete };")(
  s, () => ({ other:{label:"Autre",emoji:"📦",color:"#8e8e93"} }), e => "📦", x => x, x => x, (k,o) => k, () => {}, () => {},
  () => {}, () => {}, () => {}, docStub);

/* Migration : état plat → un livre « Personnel » qui reprend les données + remontée à plat */
{
  const s = { budget: 50, expenses: [{ id:"aaaaaaaa-1111-4111-8111-000000000001", name:"Test", cat:"food", amount:1, date:"2026-10-10", who:"me" }],
              budgets: { food: 10 }, recurring: [], goals: [], cats: { food:{label:"Alimentation",emoji:"🍔",color:"#ff9500"} } };
  makeBooks(s).booksEnsure();
  const bs = s.books;
  check(bs.length === 1 && bs[0].name === "Personnel" && bs[0].data.budget === 50
        && Array.isArray(bs[0].data.expenses) && bs[0].data.expenses.length === 1
        && s.expenses === bs[0].data.expenses && s.bookId === bs[0].id,
        "livres : migration état plat → 1 livre, données reprises par référence, remontées à plat");
  bs[0].data.expenses.push({ name:"x", amount:1, date:"2026-10-10" });
  check(s.expenses.length === 2, "livres : tableau partagé en référence avec l'état");
}

/* Bascule de livre + normalisation des champs */
{
  const s = { budget: 0, expenses: [], budgets: {}, recurring: [], goals: [], cats: {} };
  const F = makeBooks(s);
  F.booksEnsure();
  s.books.push({ id:"maison", name:"Maison", emoji:"🏠", data:{ budget:200, expenses:[{ name:"Loyer", cat:"other", amount:500, date:"2026-10-01" }], budgets:{}, recurring:[], goals:[], cats:{} } });
  F.booksEnsure();
  F.bookSwitch("maison");
  check(s.bookId === "maison" && s.expenses.length === 1 && s.expenses[0].name === "Loyer" && s.budget === 200,
        "livres : bookSwitch charge les données du livre");
  // ids en double régénérés, champs manquants normalisés
  s.books.push({ id:"maison", name:"<img src=x onerror=y>", data:{ expenses:"pas un tableau" } });
  F.booksEnsure();
  const ids = s.books.map(b=>b.id);
  check(new Set(ids).size === ids.length && s.books[2].id !== "maison"
        && !/[<>]/.test(s.books[2].name)
        && Array.isArray(s.books[2].data.expenses) && s.books[2].data.expenses.length === 0,
        "livres : id en double régénéré + nom hostile neutralisé + expenses normalisées");
}

/* buildBackup : livre à plat (format ancien) ne gagne PAS de clé books */
const bakFlat = buildBackup({ expenses: [{ id:"aaaaaaaa-1111-4111-8111-000000000001", name:"x", cat:"food", amount:1, date:"2026-10-10" }], cats: { food:{ label:"Food", emoji:"🍔", color:"#ff9500" } } });
check(!("books" in bakFlat) && !("bookId" in bakFlat), "buildBackup : format à plat → pas de clé books");

/* buildBackup : multi-livres validé (nom/emoji hostiles, ids dupliqués, livre actif remonté) */
const bakBooks = buildBackup({
  v:3, budget: 999, bookId:"b1",
  books: [
    { id:"b1", name:"Perso", emoji:"🪙", data:{ budget:100, expenses:[{ name:"a", cat:"food", amount:1, date:"2026-10-10" }], budgets:{ food:10 }, cats:{ food:{ label:"Food", emoji:"🍔", color:"#ff9500" } } } },
    { id:"b1", name:"<b>malin</b>", emoji:"<script>", data:{ expenses:[{ name:"b", cat:"other", amount:2, date:"2026-10-10" }] } },
    { id:"<img>", name:"Corrompu", data:{ pas_de_expenses: true } }   // invalide : rejeté
  ],
  cats: { food:{ label:"Food", emoji:"🍔", color:"#ff9500" } }
});
check(Array.isArray(bakBooks.books) && bakBooks.books.length === 2
      && new Set(bakBooks.books.map(b=>b.id)).size === 2
      && bakBooks.bookId === "b1",
      "buildBackup : livres validés (ids dédoublonnés, livre invalide rejeté, bookId défini)");
check(bakBooks.expenses.length === 1 && bakBooks.budget === 100 && bakBooks.budgets.food === 10,
      "buildBackup : livre actif remonté à plat (budget + dépenses)");
const bakName = bakBooks.books.find(b=>b.id !== "b1");
check(!/[<>]/.test(bakName.name) && bakName.emoji !== undefined && !/[<>/]/.test(bakName.emoji),
      "buildBackup : nom de livre et emoji hostiles neutralisés");

/* ======== Thème ======== */
const bakTheme = buildBackup({ expenses:[{ id:"aaaaaaaa-1111-4111-8111-000000000001", name:"x", cat:"food", amount:1, date:"2026-10-10" }], cats:{ food:{ label:"Food", emoji:"🍔", color:"#ff9500" } }, theme:"rose" });
check(bakTheme.theme === "rose", "buildBackup : thème global validé (id palette)");
const bakThemeBad = buildBackup({ expenses:[{ id:"aaaaaaaa-1111-4111-8111-000000000001", name:"x", cat:"food", amount:1, date:"2026-10-10" }], cats:{ food:{ label:"Food", emoji:"🍔", color:"#ff9500" } }, theme:"<script>alert(1)</script>" });
check(!bakThemeBad.theme, "buildBackup : thème invalide → absent (undefined)");
const bakBooksTheme = buildBackup({
  v:3, bookId:"b1",
  books: [
    { id:"b1", name:"Perso", theme:"blue", data:{ expenses:[{ name:"a", cat:"food", amount:1, date:"2026-10-10" }] } },
    { id:"b2", name:"Maison", theme:"<img>", data:{ expenses:[] } }
  ],
  cats: { food:{ label:"Food", emoji:"🍔", color:"#ff9500" } }
});
check(bakBooksTheme.books.find(b=>b.id==="b1").theme === "blue"
      && !bakBooksTheme.books.find(b=>b.id==="b2").theme
      && bakBooksTheme.theme === undefined,
      "buildBackup : thèmes par livre validés, hostile → absent, global absent → undefined");


console.log(`\n${passed} tests OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);