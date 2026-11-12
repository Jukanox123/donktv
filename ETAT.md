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
- En cours : corrections suite au retour final de Valentin, page par page, mises en ligne au fil de l'eau. Fait : accueil, collection, fiche film.

## À vérifier en vrai (non testé en automatique)
- Carte du monde des statistiques (bibliothèques chargées depuis jsDelivr).
- Mode hors connexion (service worker `sw.js`).
- Réordonner un top avec une coupure réseau (écriture en deux temps, ancien ordre remis en cas d'erreur).

## Maquettes à mettre à jour (pas faisable depuis la session du 12 novembre, accès réseau coupé)
- Accueil (Main, MAccueil) : bouton « Ajouter un film » ; titre « Bientôt au cinéma en France » sans la mention « dates de sortie en France » ; mobile : plus d'espace au-dessus du logo, voile sombre derrière le texte du bandeau en mode sombre.
- Bienvenue (Bienvenue, MBienvenue) : bouton « Ajouter un film ».
- Calendrier (Calendrier, MCalendrier) : « X jours de cinéma » au lieu de « X jours avec film ».
- Menus « Trier par » (Collection, MFilms, À voir, genres) et « Place » (fenêtre Ajouter à mes tops) : menu aux couleurs de l'app (fond carte, coins 10 px, coche verte sur le choix actif), plus de liste native.
- Fiche film (Fiche, MFiche) : titre au-dessus des genres (PC) ; colonne de droite alignée en haut et en bas sur l'affiche (PC) ; genres en coins 8 px (fiche et fenêtre Modifier) ; tuiles Critiques et Spectateurs colorées (vert ≥ 75 % ou 7,5/10 « Très bien noté », jaune ≥ 60 % ou 6/10 « Mitigé », rouge sinon « Mal noté ») ; section « Réalisateur » / « Réalisatrice » au-dessus du casting ; « Je l'ai revu » ouvre une fenêtre avec la date ; fenêtre Modifier et ajout d'un film : note et genre obligatoires, message d'erreur juste sous la section concernée ; fenêtre Ajouter à mes tops : place grisée quand le film est seul dans ce top ; mobile : bouton « Dans X tops » sur une ligne ; fenêtre Supprimer sans icône ; mobile : pas d'arrondi en bas du bandeau, « Ma note » sous la note, barre « Voir tous mes tops / Terminé » collée en bas de l'écran.

## Écarts assumés par rapport aux maquettes
- Mobile : barre du bas Accueil · Collection · + · À voir · Mon espace ; tops, stats, rétros et réglages via Mon espace.
- La collection n'affiche que les films vus.
- Filtres de la watchlist : un genre sans film à voir est masqué.
- Tops : flèches seulement, pas de glisser-déposer.
- Réalisateurs : photo et genre (Réalisateur / Réalisatrice) lus sur TMDB à l'ouverture de la fiche, pas stockés en base.

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
