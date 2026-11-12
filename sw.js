// Hors connexion : l'app et les dernières données lues restent disponibles.
const CACHE = 'donktv-v1';
const IMAGES_ET_LIBS = ['image.tmdb.org', 'i.ytimg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  // Réseau d'abord pour l'app et la base (données à jour), cache en secours hors connexion.
  if (u.origin === location.origin || (u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/rest/'))) e.respondWith(reseauDabord(r));
  // Cache d'abord pour les affiches, polices et bibliothèques, qui ne changent pas.
  else if (IMAGES_ET_LIBS.includes(u.hostname)) e.respondWith(cacheDabord(r));
});

async function reseauDabord(r) {
  try {
    const rep = await fetch(r);
    if (rep.ok) (await caches.open(CACHE)).put(r, rep.clone());
    return rep;
  } catch {
    return (await caches.match(r)) || Response.error();
  }
}

async function cacheDabord(r) {
  const c = await caches.match(r);
  if (c) return c;
  const rep = await fetch(r);
  if (rep.ok || rep.type === 'opaque') (await caches.open(CACHE)).put(r, rep.clone());
  return rep;
}
