# Kola 💰 v0.15 — app PWA de suivi de dépenses

**Kola** (la noix de kola, symbole d'échange en Afrique de l'Ouest) — suivi de budget personnel, design iOS (Human Interface Guidelines), **100% local** : aucune donnée ne quitte l'appareil, jamais.

**Installer** : ouvrez [https://ohaniceyt.github.io/kola/](https://ohaniceyt.github.io/kola/) sur votre téléphone
- iPhone (Safari) : bouton Partager → « Sur l'écran d'accueil »
- Android : « Installer l'application »

## Fonctionnalités
- **Onboarding** : prénom, devise (Euro, **FCFA** sans décimales, Dollar CAD/US, Livre, CHF), budget mensuel *optionnel*, répartition conseillée en enveloppes
- **Enveloppes budgétaires** par catégorie (barres colorées, dépassement signalé)
- **Livres multiples** : autant de suivis que tu veux (Personnel, Maison…), chacun avec ses dépenses, enveloppes, objectifs, récurrences et même son **thème** — bascule en un tap depuis l'accueil ou Réglages → Livres ; le choix **📕 Dépenses / 🤝 Dettes** se fait à la création (et reste modifiable)
- **Livre « Dettes » (v0.7→v0.12)** : suis ce que tu dois (💸) et ce qu'on te doit (🤝) — montants, dates, échéances, **remboursements partiels** ; **jamais de net affiché : chaque sens garde sa ligne** — deux héros empilés dans le livre dettes, mini héros dans les livres Dépenses (caché si vide) ; **historique complet** : page Historique en livre dettes (filtres Tout / 💸 / 🤝 / 🔁) et **journal des remboursements par dette** (datés, supprimables, cohérences au merge multi-appareils) ; **Stats dettes** dédiées (je dois / on me doit / remboursé-encaissé / % global / soldées) ; **CSV des dettes** exportable (dette + paiements datés, ré-importable nulle part — garde à l'import) ; disponible en backup JSON et fusion multi-appareils comme le reste
- **Saisie ultra-rapide** : chips des dépenses fréquentes + pavé numérique maison sur mobile (pas de clavier système)
- **Modifier/supprimer** : tap sur une dépense → fiche complète (avec **« Même dépense aujourd'hui »** en 1 tap) ; sur une catégorie, glisse à droite = modifier, à gauche = supprimer avec **réaffectation au choix** des dépenses et récurrences
- **Récurrences** mensuelles ou **hebdomadaires**, ajoutées automatiquement — 1ʳᵉ occurrence toujours future (pas d'ajout rétroactif à la création), moteur sans doublon, même en ouvrant l'app une fois par mois ; **tap sur une récurrence pour la modifier** (montant, catégorie, fréquence, jour) ou l'arrêter
- **Objectifs d'épargne** avec progression et suppression
- **Stats** : périodes mois / semaine / année (sélecteur), donut % ⇄ montant, comparatif vs mois ou semaine précédente, tendance 6 mois, série de saisie, objectifs atteints
- **Historique** : groupé par jour, recherche, filtres, pagination (200 par 200) — ordre intra-jour chronologique (horodatage de création, migration douce des anciennes entrées)
- **Multi-appareils sans serveur** : guide « Passer sur un autre appareil » (Réglages → Données) — transfert par le fichier JSON par Mail/AirDrop/WhatsApp, restauration avec aperçu et choix **Fusionner** (dédoublonnage date+libellé+montant, union des catégories, progression d'objectif au max, récurrences dédupliquées) ou Remplacer — tout fichier importé est **validé strictement** avant insertion (ids reconstruits, catégories/emoji/couleurs/budgets whitelistés)
- **Données** (Réglages épuré) : « Sauvegarder & exporter » (fiche : JSON complet / CSV) ; un seul « **Importer un fichier** » qui route au contenu — fichier d'échange couple, sauvegarde JSON ou **relevé bancaire CSV** (détection du séparateur/format de date/`1 234,56`⇄`1,234.56`, **catégorisation automatique**, crédits ignorés : colonne Crédit jamais retenue, montants positifs déposés dans un relevé signé) —, passer sur un autre appareil, effacement complet, rappel de sauvegarde **+ bandeau mensuel** (archivage du mois précédent dans les 7 premiers jours)
- **OCR de reçu (v0.2)** : bouton **📷 Photo du reçu** dans « Nouvelle dépense » → photo prise sur place (caméra), reconnaissance **100% locale** (Tesseract wasm vendu dans `vendor/tesseract/`, chargé à la première utilisation puis mis en cache) → montant, date et marchand proposés, **tout modifiable** dans la fiche de confirmation avant l'ajout
- **Budget couple** : active dans Réglages — chaque dépense porte une attribution **Moi / Toi / À deux** (badge dans les listes), et l'accueil affiche la répartition du mois + le **solde** (ce que l'un doit à l'autre). Deux façons de synchroniser, 100% local :
  - **Fichier d'échange** (Recommandé pour la mise à jour longue distance) : Réglages → Budget couple → 📤 Fichier d'échange (delta seulement, la suite des dépenses jamais envoyées) → le partenaire l'importe (📥) et les attributions moi⇄toi sont remappées automatiquement
  - **P2P en direct** (même Wi-Fi) : « Synchroniser maintenant (Wi-Fi) » → un téléphone montre son **code QR** (SDP compressé), l'autre le **scanne** (caméra) — WebRTC sans aucun serveur, les données circulent directly de téléphone à téléphone ; le SDP ne contient que des adresses de réseau local
- **Vue du soir** : à l'ouverture entre 18h et 5h, résumé du jour (dépenses, plus grosse dépense, solde mensuel) + rappels — dont la section **⏰ Échéances à venir** : dettes/créances de tous les livres non soldées arrivant à échéance (≤ 7 jours) ou en retard, tap → fiche de la dette correspondante ; une fois par soir, alternative 100% locale aux notifications push (impossibles sans serveur sur iOS)
- **Hors ligne** : service worker, tout marche sans réseau

- **Budget couple** : activation dans Réglages — chaque dépense porte « Qui a payé ? » (**Moi / Toi / À deux**), carte couple sur l'accueil avec répartition et solde (« X doit N à Y ») ; deux transports **100 % locaux** : **fichier d'échange** (delta idempotent — seules les dépenses jamais envoyées, identifiées par ids `sentIds` — dédupliqué, prénom du partenaire adopté) ou **synchro directe Wi-Fi** : WebRTC DataChannel apparié par QR (offre → réponse, scan caméra avec jsQR, repli coller-code) — les libs QR sont vendored dans `vendor/qr/`, aucun serveur, rien ne sort du réseau local ; à la réception, l'attribution est remappée moi⇄toi automatiquement (`deviceId`), et tout contenu reçu traverse la même validation stricte que les sauvegardes
- ## Technique
HTML/CSS/JS vanilla, **zéro dépendance build**, zéro serveur : `index.html` (shell) charge `assets/app.css` + `src/*.js` découpés par domaine dans un ordre figé, pré-cachés par le service worker. Schéma de données versionné (v3) ; **livres & dettes** : chaque livre porte ses données (`data.expenses`, `data.debts` avec journal de remboursements `payments[]`), tout ce qui re-rend à l'écran passe par la validation stricte (`buildLedger`, `normalizeDebts` — whitelist anti-injection). **Budget couple** : delta par fichiers d'échange (liste `sentIds`) ou synchro **WebRTC** sans serveur (QR : `deflate-raw` + base64url, JSQR côté caméra), moteur de fusion pur testé (`coupleMergeInto`) ; stockage « double copie » : `localStorage` (arbitré par un compteur `rev` monotone) + **IndexedDB** durable — supporte bien plus de 20 000 dépenses même quand le quota localStorage (~5 Mo chez Safari) sature, avec reprise auto de la copie la plus récente. Backup manuel encadré par un rappel automatique + bandeau mensuel, focus-trap et `role="button"` sur les listes (clavier).

**OCR** : tesseract.js 7 + modèles `best_int` (fra, ~0,7 Mo) vendus dans `vendor/tesseract/` (~12 Mo, **hors cache d'install** du service worker — téléchargés à la 1ʳᵉ photo puis gardés en cache runtime/IndexedDB par le worker Tesseract). Extraction montant/date/marchand heuristique (lignes TOTAL, MONTANT, devise, centimes), batterie de tests versionnée (`node tests/run-tests.mjs`). Fonctionne hors ligne après la 1ʳᵉ utilisation.

Icônes : source vectorielle unique `icons/icon.svg` (~0,9 Ko) → PNG compressés palette (~10–12 Ko) + **écrans de démarrage iOS** light/dark (une taille exacte par appareil, `apple-touch-startup-image`). Régénérables en 1 commande : `node scripts/gen-ios-assets.mjs` (script dev, nécessite `npm i sharp`, pas déployé).

Langues : FR (source) + EN — sélecteur « Langue » dans Réglages (Système / Français / English), montants via `Intl.NumberFormat` selon la langue, dates et noms de jours/mois localisés. Les étiquettes des catégories par défaut sont créées dans la langue détectée à la première ouverture.

Design : [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) — SF Pro, couleurs système iOS, dark mode auto, safe-areas, header « liquid glass », sheets au ressort (`cubic-bezier(.32,.72,.33,1)`).

## Fichiers
- `index.html` — le shell (markup des pages, sheets et onglets) — charge le CSS + les scripts dans l'ordre
- `assets/app.css` — tous les styles (sections commentées)
- `src/*.js` — la logique, découpée par domaine dans l'ordre de chargement : `01-donnees-livres`, `02-legal-stockage-recurrentes`, `03-import-csv-i18n`, `04-rendu`, `05-ecrans`, `06-dettes-restauration`, `07-couple-onboarding-divers`, `08-evenements-init-ocr-pwa` — **scripts classiques** (pas de bundler ni de build), le service worker les pré-charge tous en un coup
- `manifest.webmanifest` — manifeste PWA
- `sw.js` — service worker (network-first sur les navigations, offline-first ; ⚠️ assets/src sont cache-first : bump CACHE quand un fichier change)
- `icons/` — icônes (SVG source vecteur + PNG 180/192/512) et `icons/splash/` — écrans de démarrage iOS
- `scripts/gen-ios-assets.mjs` — générateur dev des PNG (script, pas déployé)
- `vendor/qr/` — qrcode-generator + jsQR (vendored, lazy) : codes de connexion P2P
- `tests/run-tests.mjs` — batterie de tests Node (138 tests : parseurs montants/CSV, validation des sauvegardes dettes incluses, chronologie dettes, extraction OCR, récurrences) — concatène les fichiers `src/*.js` et extrait les fonctions pures par repères ; zéro dépendance
- `tests/RECETTE.md` — recette manuelle à dérouler sur téléphone à chaque livraison

## Licence
MIT.