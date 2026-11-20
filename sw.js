// Hors connexion : l'app et les dernières données lues restent disponibles.
const CACHE = 'donktv-v2', CACHE_IMG = 'donktv-img-v1', MAX_IMG = 400;
const IMAGES_ET_LIBS = ['image.tmdb.org', 'i.ytimg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());
// L'ancien cache v1 mélangeait app et images : il est supprimé.
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![CACHE, CACHE_IMG].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  // Réseau d'abord pour l'app et la base (données à jour), cache en secours hors connexion.
  // Images de l'app : affichées depuis le cache tout de suite, mises à jour en arrière-plan.
  if (u.origin === location.origin && u.pathname.includes('/img/')) e.respondWith(cacheEtMaj(r, e));
  else if (u.origin === location.origin || (u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/rest/'))) e.respondWith(reseauDabord(r));
  // Cache d'abord pour les affiches, polices et bibliothèques, qui ne changent pas.
  else if (IMAGES_ET_LIBS.includes(u.hostname)) e.respondWith(cacheDabord(r, e));
});

async function reseauDabord(r) {
  try {
    // no-cache : GitHub Pages laisse le navigateur garder les fichiers 10 min ; on revalide pour voir chaque mise en ligne tout de suite.
    const rep = await fetch(r, { cache: 'no-cache' });
    if (rep.ok) (await caches.open(CACHE)).put(r, rep.clone());
    return rep;
  } catch {
    return (await caches.match(r)) || Response.error();
  }
}

async function cacheEtMaj(r, e) {
  const c = await caches.match(r);
  const maj = fetch(r).then(async (rep) => { if (rep.ok) await (await caches.open(CACHE)).put(r, rep.clone()); return rep; });
  if (!c) return maj;
  e.waitUntil(maj.catch(() => {}));
  return c;
}

async function cacheDabord(r, e) {
  const c = await caches.match(r);
  if (c) return c;
  const rep = await fetch(r);
  if (rep.ok || rep.type === 'opaque') e.waitUntil(garder(r, rep.clone()));
  return rep;
}

// Au-delà de MAX_IMG fichiers, les plus anciens partent (les clés sont rendues dans l'ordre d'ajout).
async function garder(r, rep) {
  const c = await caches.open(CACHE_IMG);
  await c.put(r, rep);
  const ks = await c.keys();
  await Promise.all(ks.slice(0, Math.max(0, ks.length - MAX_IMG)).map((k) => c.delete(k)));
}
