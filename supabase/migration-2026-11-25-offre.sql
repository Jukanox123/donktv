-- 25 novembre 2026 (1.5.1) : offre de chaque compte, en vue de futurs achats intégrés (App Store, Google Play).
-- Pas de ligne = gratuit. Aucune règle RLS : un utilisateur ne peut ni lire ni écrire cette table directement,
-- seul le serveur (clé service_role, futur webhook des stores) y écrit. On lit sa propre offre avec est_premium().
create table if not exists abonnements (
  user_id uuid primary key references auth.users on delete cascade,
  offre text not null default 'gratuit' check (offre in ('gratuit', 'premium')),
  jusqu_au timestamptz,  -- fin de l'abonnement ; null = sans fin (achat unique)
  maj_le timestamptz not null default now()
);
alter table abonnements enable row level security;

-- Utilisable dans l'app (rpc) et dans les règles RLS des futures fonctions premium.
create or replace function est_premium() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from abonnements where user_id = auth.uid() and offre = 'premium' and (jusqu_au is null or jusqu_au > now()))
$$;
revoke all on function est_premium() from public, anon;
grant execute on function est_premium() to authenticated;
