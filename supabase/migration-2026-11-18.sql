-- DonkTV, 18 novembre 2026 : plateformes de streaming, sagas et date de mise à jour des notes.
-- À exécuter une fois dans Supabase › SQL Editor.
alter table reglages add column if not exists plateformes text[] not null default '{}'; -- noms des plateformes de l'utilisateur
alter table films
  add column if not exists plateformes jsonb,      -- [{nom, logo}] en abonnement ou gratuit en France ; null = jamais lu
  add column if not exists plateformes_le date,    -- dernière lecture des plateformes
  add column if not exists saga_id int,            -- collection TMDB
  add column if not exists saga_nom text,
  add column if not exists maj_le date;            -- dernière mise à jour de la note Rotten Tomatoes
