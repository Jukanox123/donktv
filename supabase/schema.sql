-- DonkTV : schéma de la base. À exécuter une fois dans Supabase › SQL Editor.
-- Chaque ligne appartient à un utilisateur ; la sécurité (RLS) n'autorise que le sien.

create table reglages (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  tmdb_token text,
  omdb_key text,
  theme text not null default 'auto' check (theme in ('auto', 'clair', 'sombre'))
);

create table films (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tmdb_id int not null,
  imdb_id text,
  titre text not null,
  titre_original text,
  annee int,
  date_sortie_fr date,
  affiche text,            -- chemin TMDB, ex. /abc.jpg
  synopsis text,
  realisateurs text[] not null default '{}',
  acteurs jsonb not null default '[]',   -- [{nom, role, photo}]
  duree int,               -- minutes
  pays text[] not null default '{}',     -- codes ISO, ex. {FR,US}
  genres text[] not null default '{}',   -- parmi les 11 genres de l'app
  bande_annonce text,      -- identifiant YouTube
  statut text not null check (statut in ('vu', 'a_voir')),
  note numeric(2,1) check (note between 0.5 and 5 and note * 2 = floor(note * 2)),
  coup_de_coeur boolean not null default false,
  note_tmdb numeric(3,1),
  votes_tmdb int,
  note_rt int,             -- pourcentage Rotten Tomatoes
  ajoute_le timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

create table visionnages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  film_id bigint not null references films on delete cascade,
  date date not null default current_date
);

create table tops (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  liste text not null,     -- 'tous' (10 places) ou un genre (5 places)
  position int not null check (position between 1 and 10),
  film_id bigint not null references films on delete cascade,
  primary key (user_id, liste, position),
  unique (user_id, liste, film_id)
);

create index on visionnages (film_id);
create index on visionnages (user_id, date);

do $$
declare t text;
begin
  foreach t in array array['reglages', 'films', 'visionnages', 'tops'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "proprietaire" on %I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
