-- 25 novembre 2026 (1.5.4) : clés des sources en essai (TheTVDB, Streaming Availability), lues seulement par la fonction « sources ».
alter table reglages add column if not exists tvdb_key text, add column if not exists sa_key text;
