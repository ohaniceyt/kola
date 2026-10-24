/* Kola — service worker (network-first pour l'app shell, offline-first pour le reste) */
const CACHE = "kola-v27";
// Les splash screens iOS (icons/splash/) ne sont PAS pré-cachés : ~150 Ko à l'install
// pour un usage qui n'est pas hors-ligne critique. Ils entrent au cache runtime
// (offline-first) dès la première consultation en ligne.
// ⚠️ assets/app.css et src/*.js sont servis cache-first : TOUJOURS bump CACHE quand un fichier change.
const CORE = [
  "./", "./index.html", "./manifest.webmanifest", "./assets/app.css",
  "./src/01-donnees-livres.js", "./src/02-legal-stockage-recurrentes.js", "./src/03-import-csv-i18n.js",
  "./src/04-rendu.js", "./src/05-ecrans.js", "./src/06-dettes-restauration.js",
  "./src/07-couple-onboarding-divers.js", "./src/08-evenements-init-ocr-pwa.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon-180.png", "./icons/icon.svg",
  "./vendor/qr/qrcode.min.js", "./vendor/qr/jsQR.min.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Navigations : réseau d'abord (toujours la dernière version), cache en secours
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        const sameOrigin = new URL(e.request.url).origin === self.location.origin;
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        caches.match(e.request.url.includes("index.html") ? "./index.html" : "./")
      )
    )
  );
});