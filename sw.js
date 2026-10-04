// Fonctionnement hors connexion. Avec du rÃ©seau, on prend toujours la derniÃ¨re version et on la garde ;
// sans rÃ©seau, on ressort la copie gardÃ©e sur l'appareil.
const CACHE = 'labise-v7';
const COQUILLE = ['./', 'index.html', 'style.css', 'app.js', 'themes.js', 'labo.js', 'textes.js',
  'moteur/criteres.js', 'moteur/reglages.js', 'moteur/generateur.js', 'moteur/export.js',
  'moteur/rejeu.js', 'moteur/carnet.js', 'moteur/decks.js',
  'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'donnees.json', 'laboratoire.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((reponse) => {
      if (reponse.ok) {
        const copie = reponse.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie));
      }
      return reponse;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
