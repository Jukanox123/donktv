// DonkTV : relais vers TMDB et OMDb. Les clés de l'administrateur restent ici, jamais dans le navigateur.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Clés gardées une minute par instance : une lecture de la base par rafale d'appels.
let cles: { tmdb_token: string | null; omdb_key: string | null } | null = null, lues = 0;
async function lireCles() {
  if (cles && Date.now() - lues < 60_000) return cles;
  const { data: a } = await sb.from('admin').select('user_id').limit(1).maybeSingle();
  const { data: r } = a ? await sb.from('reglages').select('tmdb_token, omdb_key').eq('user_id', a.user_id).maybeSingle() : { data: null };
  cles = { tmdb_token: r?.tmdb_token ?? null, omdb_key: r?.omdb_key ?? null }; lues = Date.now();
  return cles;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await sb.auth.getUser(jwt);
    if (!user) return json({ erreur: 'Connecte-toi d’abord.' }, 401);
    const corps = await req.json();
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
      return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (typeof corps.omdb === 'string') {
      if (!/^tt\d+$/.test(corps.omdb)) return json({ Response: 'False', Error: 'Identifiant IMDb invalide.' }, 400);
      if (!k.omdb_key) return json({ Response: 'False', Error: 'Clé OMDb absente.' }, 401);
      const r = await fetch(`https://www.omdbapi.com/?i=${corps.omdb}&apikey=${encodeURIComponent(k.omdb_key)}`);
      return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return json({ erreur: 'Demande inconnue.' }, 400);
  } catch (e) {
    return json({ erreur: e instanceof Error ? e.message : String(e) }, 500);
  }
});
