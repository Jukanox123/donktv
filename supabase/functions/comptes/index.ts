// DonkTV : gestion des comptes (invitations, retrait d'accès, suppression de son compte).
// Tourne chez Supabase : la clé service_role est fournie par Supabase et ne quitte jamais le serveur.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const rep = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await sb.auth.getUser(jwt);
    if (!user) return rep({ erreur: 'Connecte-toi d’abord.' }, 401);
    const { action, email, id, redirectTo } = await req.json();

    // Chacun peut supprimer son propre compte ; ses films partent avec (on delete cascade).
    if (action === 'supprimer') {
      const { error } = await sb.auth.admin.deleteUser(user.id);
      if (error) throw error;
      return rep({ ok: true });
    }

    const { data: admin } = await sb.from('admin').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!admin) return rep({ erreur: 'Réservé à l’administrateur.' }, 403);

    if (action === 'liste') {
      const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      return rep(data.users.filter((u) => u.id !== user.id).map((u) => ({
        id: u.id, email: u.email, invite_le: u.invited_at ?? u.created_at, cree: !!u.email_confirmed_at,
      })));
    }
    if (action === 'inviter') {
      const e = String(email ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return rep({ erreur: 'Adresse e-mail invalide.' }, 400);
      // Une adresse déjà invitée mais pas encore inscrite reçoit un nouveau lien.
      const { error } = await sb.auth.admin.inviteUserByEmail(e, { redirectTo });
      if (error) return rep({ erreur: /registered/i.test(error.message) ? 'Cette adresse a déjà un compte.' : error.message }, 400);
      return rep({ ok: true });
    }
    if (action === 'retirer') {
      if (!id || id === user.id) return rep({ erreur: 'Compte invalide.' }, 400);
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) throw error;
      return rep({ ok: true });
    }
    return rep({ erreur: 'Action inconnue.' }, 400);
  } catch (e) {
    return rep({ erreur: e instanceof Error ? e.message : String(e) }, 500);
  }
});
