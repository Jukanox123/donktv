// DonkTV : relais vers TMDB, TheTVDB et Streaming Availability. Les clés de l'administrateur restent ici, jamais dans le navigateur.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // évite la requête OPTIONS avant chaque appel
};
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Clés gardées une minute par instance : une lecture de la base par rafale d'appels.
type Cles = { tmdb_token: string | null; tvdb_key: string | null; sa_key: string | null };
let cles: Cles | null = null, lues = 0;
async function lireCles() {
  if (cles && Date.now() - lues < 60_000) return cles;
  const { data: a } = await sb.from('admin').select('user_id').limit(1).maybeSingle();
  const { data: r } = a ? await sb.from('reglages').select('tmdb_token, tvdb_key, sa_key').eq('user_id', a.user_id).maybeSingle() : { data: null };
  cles = { tmdb_token: r?.tmdb_token ?? null, tvdb_key: r?.tvdb_key ?? null, sa_key: r?.sa_key ?? null }; lues = Date.now();
  return cles;
}

// TheTVDB : la clé s'échange contre un jeton valable un mois, gardé par instance.
const jetonsTvdb = new Map<string, string>();
async function jetonTvdb(cle: string) {
  if (!jetonsTvdb.has(cle)) {
    const r = await fetch('https://api4.thetvdb.com/v4/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apikey: cle }) });
    const jeton = r.ok ? (await r.json()).data?.token : null;
    if (!jeton) return null;
    jetonsTvdb.set(cle, jeton);
  }
  return jetonsTvdb.get(cle)!;
}

// Réponse gardée par le navigateur de l'utilisateur seulement (private), et seulement si elle est bonne.
const garder = (r: Response, heures: number): Record<string, string> => (r.ok ? { 'Cache-Control': `private, max-age=${heures * 3600}` } : {});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    // getClaims vérifie le jeton sur place, sans aller-retour vers le serveur d'authentification.
    const { data: auth } = await sb.auth.getClaims(jwt);
    if (!auth?.claims?.sub) return json({ erreur: 'Connecte-toi d’abord.' }, 401);
    // GET : la réponse peut être gardée par le navigateur (une POST ne l'est jamais).
    const corps = req.method === 'GET' ? JSON.parse(new URL(req.url).searchParams.get('q') ?? '{}') : await req.json();
    const k = await lireCles();

    if (typeof corps.tmdb === 'string') {
      // Seulement des chemins de l'API TMDB, en lecture.
      if (!/^\/[a-z0-9_\/-]+$/i.test(corps.tmdb)) return json({ erreur: 'Chemin TMDB invalide.' }, 400);
      if (!k.tmdb_token) return json({ erreur: 'Clé TMDB absente.' }, 401);
      const params: Record<string, string> = {};
      for (const [c, v] of Object.entries(corps.params ?? {})) params[c] = String(v);
      const jeton = k.tmdb_token.startsWith('eyJ');
      if (!jeton) params.api_key = k.tmdb_token;
      const r = await fetch(`https://api.themoviedb.org/3${corps.tmdb}?${new URLSearchParams(params)}`,
        jeton ? { headers: { Authorization: `Bearer ${k.tmdb_token}` } } : {});
      return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json', ...garder(r, 6) } });
    }
    // TheTVDB et Streaming Availability (essai du 25 novembre 2026). « cle » : clé à tester avant de l'enregistrer.
    const chemin = (c: unknown) => typeof c === 'string' && /^\/[a-z0-9_\/-]+$/i.test(c);
    const qs = new URLSearchParams(Object.entries(corps.params ?? {}).map(([c, v]) => [c, String(v)]));
    if (chemin(corps.tvdb)) {
      const cle = corps.cle ?? k.tvdb_key;
      if (!cle) return json({ erreur: 'Clé TheTVDB absente.' }, 401);
      const jeton = await jetonTvdb(cle);
      if (!jeton) return json({ erreur: 'Clé TheTVDB refusée.' }, 401);
      const r = await fetch(`https://api4.thetvdb.com/v4${corps.tvdb}?${qs}`, { headers: { Authorization: `Bearer ${jeton}` } });
      return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (chemin(corps.sa)) {
      const cle = corps.cle ?? k.sa_key;
      if (!cle) return json({ erreur: 'Clé Streaming Availability absente.' }, 401);
      const r = await fetch(`https://streaming-availability.p.rapidapi.com${corps.sa}?${qs}`,
        { headers: { 'X-RapidAPI-Key': cle, 'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com' } });
      return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return json({ erreur: 'Demande inconnue.' }, 400);
  } catch (e) {
    return json({ erreur: e instanceof Error ? e.message : String(e) }, 500);
  }
});
