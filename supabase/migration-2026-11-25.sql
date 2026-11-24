-- 25 novembre 2026 (1.4.12) : un visionnage peut ne pas avoir de date (« Je ne me rappelle plus quand »).
alter table visionnages alter column date drop not null;
