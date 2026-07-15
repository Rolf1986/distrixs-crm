// Minimale service worker — maakt de app installeerbaar (PWA) en cachet
// statische assets voor snelheid. Bewust GEEN caching van API-/HTML-responses,
// zodat CRM-data altijd vers is en er geen verouderde/private data blijft hangen.
const CACHE = "distrixs-static-v1";
const STATIC_ASSETS = [
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Alleen statische, niet-gevoelige bestanden uit cache serveren
  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      STATIC_ASSETS.includes(url.pathname) ||
      /\.(png|jpg|jpeg|svg|ico|woff2?)$/.test(url.pathname));
  if (!isStatic) return; // API en pagina's: altijd van het netwerk

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
    )
  );
});
