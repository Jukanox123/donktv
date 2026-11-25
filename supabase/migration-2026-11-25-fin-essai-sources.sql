-- 25 novembre 2026 (1.5.8) : fin de l'essai TheTVDB / Streaming Availability (TMDB reste la seule source). Les clés d'essai sont effacées.
alter table reglages drop column if exists tvdb_key, drop column if exists sa_key;
