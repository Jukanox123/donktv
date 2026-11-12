# État du projet DonkTV

Mis à jour le 12 novembre 2026.

## Liens
- App en ligne : https://jukanox123.github.io/donktv/ (dépôt GitHub `Jukanox123/donktv`)
- Cahier des charges : https://claude.ai/artifact/MBcJ2aeWFeuETr6s1NPQp7
- Maquettes (Claude Design) : https://claude.ai/artifact/PUbN6HNY6EB9gJz8ytKT9Q
- Base Supabase : https://garqewteguzlrpujqcjc.supabase.co (clé publishable dans `app.js`)

## Où on en est
- Spec, maquettes et tests techniques : terminés.
- Développement : toutes les pages sont en ligne (accueil, collection + calendrier, À voir, fiche film, 11 pages de genre, Mes tops, statistiques + carte du monde, rétrospectives, recherche rapide Ctrl/⌘ K, Mon espace, réglages, installation iPhone, hors connexion).
- Prochaine étape : retour final de Valentin après ses tests, puis corrections.

## À vérifier en vrai (non testé en automatique)
- Carte du monde des statistiques (bibliothèques chargées depuis jsDelivr).
- Mode hors connexion (service worker `sw.js`).
- Réordonner un top avec une coupure réseau (écriture en deux temps, ancien ordre remis en cas d'erreur).

## Écarts assumés par rapport aux maquettes
- Mobile : barre du bas Accueil · Collection · + · À voir · Mon espace ; tops, stats, rétros et réglages via Mon espace.
- La collection n'affiche que les films vus.
- Filtres de la watchlist : un genre sans film à voir est masqué.
- Tops : flèches seulement, pas de glisser-déposer.

## Technique
- Site statique : `index.html`, `style.css`, `app.js` (base, fiche, collection, ajout), `pages.js` (autres pages), `sw.js`, `img/`.
- Schéma de la base : `supabase/schema.sql` (tables reglages, films, visionnages, tops ; sécurité par utilisateur).
- Routage par `#page/param` ; table `PAGES`.
- Clés TMDB et OMDb : saisies dans Réglages, stockées dans Supabase, jamais dans le code.

## Règles de travail
- Utiliser le skill ponytail (code minimal, réponses courtes).
- Poser des questions et ne rien faire sans accord, sauf consigne contraire.
- Relire un fichier des maquettes depuis l'artifact avant de le modifier ; ne pas toucher « Artboard 1 » sur « Page 2 » du canvas.
- Ne jamais demander ni écrire la clé secret/service_role de Supabase ni le mot de passe de la base.
- Après chaque étape : mettre à jour ce fichier et le cahier des charges.
