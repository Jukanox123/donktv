-- DonkTV, 20 novembre 2026 : plusieurs comptes (invitations).
-- À exécuter une fois dans Supabase › SQL Editor.

-- L'administrateur : celui qui invite et dont les clés TMDB / OMDb servent à tout le monde.
create table if not exists admin (user_id uuid primary key references auth.users on delete cascade);
alter table admin enable row level security; -- aucune règle : la table n'est lue que par cles() et la fonction « comptes »
insert into admin select id from auth.users where email = 'vgenauzeau@gmail.com' on conflict do nothing;

-- « Les clés existent-elles ? » et « suis-je l'administrateur ? ». Les clés elles-mêmes ne quittent pas le serveur :
-- les appels TMDB / OMDb passent par la fonction « sources ».
create or replace function cles() returns json language sql stable security definer set search_path = public as $$
  select json_build_object('tmdb', r.tmdb_token is not null, 'omdb', r.omdb_key is not null,
                           'admin', exists (select 1 from admin where user_id = auth.uid()))
  from admin a left join reglages r using (user_id) limit 1
$$;
revoke all on function cles() from public, anon;
grant execute on function cles() to authenticated;
