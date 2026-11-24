-- 25 novembre 2026 (1.5) : prénom et amis. Entre amis, seuls les films en commun des watchlists sont visibles.
-- La table amities n'a aucune règle RLS : on n'y touche que par les fonctions ci-dessous.

alter table reglages add column if not exists prenom text check (length(trim(prenom)) between 1 and 40);

create table if not exists amities (
  id bigint generated always as identity primary key,
  demandeur uuid not null references auth.users on delete cascade,
  destinataire uuid not null references auth.users on delete cascade,
  acceptee boolean not null default false,
  le timestamptz not null default now(),
  check (demandeur <> destinataire)
);
create unique index if not exists amities_paire on amities (least(demandeur, destinataire), greatest(demandeur, destinataire));
alter table amities enable row level security;

-- Mes amis et mes demandes (reçues et envoyées), avec le prénom et l'e-mail de l'autre.
create or replace function amis() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', a.id, 'le', a.le, 'email', u.email, 'prenom', r.prenom,
    'etat', case when a.acceptee then 'ami' when a.destinataire = auth.uid() then 'recue' else 'envoyee' end,
    'ami', u.id) order by a.le desc), '[]')
  from amities a
  join auth.users u on u.id = case when a.demandeur = auth.uid() then a.destinataire else a.demandeur end
  left join reglages r on r.user_id = u.id
  where auth.uid() in (a.demandeur, a.destinataire)
$$;

-- Envoie une demande à un e-mail exact. Si l'autre m'avait déjà fait une demande, l'amitié est acceptée.
create or replace function demander_ami(email text) returns text language plpgsql security definer set search_path = public as $$
declare cible uuid; existante amities;
begin
  select id into cible from auth.users where lower(auth.users.email) = lower(trim(demander_ami.email));
  if cible is null then raise exception 'Aucun compte DonkTV n’utilise cet e-mail.'; end if;
  if cible = auth.uid() then raise exception 'C’est ton propre e-mail.'; end if;
  select * into existante from amities where least(demandeur, destinataire) = least(auth.uid(), cible) and greatest(demandeur, destinataire) = greatest(auth.uid(), cible);
  if existante.id is null then insert into amities (demandeur, destinataire) values (auth.uid(), cible); return 'envoyee'; end if;
  if existante.acceptee then return 'deja'; end if;
  if existante.destinataire = auth.uid() then update amities set acceptee = true where id = existante.id; return 'acceptee'; end if;
  return 'envoyee';
end $$;

-- Accepter (destinataire seulement). Refuser, annuler ou retirer : supprimer_ami.
create or replace function accepter_ami(id bigint) returns void language sql security definer set search_path = public as $$
  update amities set acceptee = true where amities.id = accepter_ami.id and destinataire = auth.uid()
$$;
create or replace function supprimer_ami(id bigint) returns void language sql security definer set search_path = public as $$
  delete from amities where amities.id = supprimer_ami.id and auth.uid() in (demandeur, destinataire)
$$;

-- Pour chaque ami : les films (tmdb_id) qui sont dans sa watchlist ET dans la mienne. Rien d'autre ne sort.
create or replace function films_en_commun() returns table (ami uuid, tmdb_id int) language sql stable security definer set search_path = public as $$
  select f2.user_id, f2.tmdb_id
  from amities a
  join films f2 on f2.user_id = case when a.demandeur = auth.uid() then a.destinataire else a.demandeur end and f2.statut = 'a_voir'
  join films f1 on f1.user_id = auth.uid() and f1.tmdb_id = f2.tmdb_id and f1.statut = 'a_voir'
  where a.acceptee and auth.uid() in (a.demandeur, a.destinataire)
$$;

do $$
declare f text;
begin
  foreach f in array array['amis()', 'demander_ami(text)', 'accepter_ami(bigint)', 'supprimer_ami(bigint)', 'films_en_commun()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
