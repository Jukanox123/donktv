# État du projet DonkTV

Mis à jour le 18 novembre 2026.

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

- Retour du 13 novembre : onglets « Mes films » et « Watchlist » ; plus de sur-titres verts (accueil, Mes films, Watchlist, fiche, Mes tops, Statistiques) ; titres « Mes tops » et « Statistiques » ; synopsis « bientôt disponible » pour un film pas encore sorti ; stats : évolutions en vert / rouge, courbe posée sur l'axe avec films vus du mois au survol, sélecteur d'année masqué s'il n'y en a qu'une (menu de l'app sinon), heatmap mobile en 12 mini-calendriers, « Genre préféré » au-dessus des genres sur mobile avec étiquette crème, carte sans survol, photos des réalisateurs et acteurs, « Par année de sortie » ; tops PC : podium en 3 colonnes égales avec places libres en pointillés.

- Retour du 17 novembre : genres en lecture seule à l'ajout et dans Modifier (plus de « pré-remplis par TMDB, modifiables », plus d'erreur genre) ; stats : portraits carrés à coins arrondis (photos), « Par année de sortie » qui défile avec son axe, heatmap sans survol ; rétro : genre dominant sur un panneau sombre, têtes d'affiche = 3 réalisateurs et 3 acteurs avec photo, rythme sans « pic » ni liste des revisionnages ; plus de débordement à droite sur mobile.

- Retour du 17 novembre (2e série) : plus d'étiquettes « Vu » ni « À voir » sur les affiches (accueil, Watchlist, pages de genre) ; « À voir ensuite » sans points sous les affiches ; « Bientôt au cinéma en France » : bustes de genre sur l'affiche, plus de genre sous l'affiche.
- Retour du 17 novembre (3e série) : « Bientôt au cinéma » sans point après l'année ; Mes films : les puces de genre mènent à la page du genre ; bandeau de genre sans arrondi en bas (PC et mobile) ; Watchlist : « Vu » ouvre la fenêtre « Ton avis » (note, coup de cœur, date) ; stats : infobulles gardées dans l'écran ; rétro : plus de « Le podium », « Tes têtes d'affiche » au style de « Tes meilleurs films », « Ton rythme par semaine » (par jour / par mois selon la période) sans sous-titre, panneau sombre du genre dominant autour de la liste des genres seulement.
- Retour du 17 novembre (4e série) : rétro : « Ton rythme par … » au style des titres Réalisateurs / Acteurs, bandeau du haut sans arrondi en bas (PC et mobile) ; pages de genre : en-tête « Mes films » avec Grille / Calendrier, puis recherche, tri et puces de genre (avec « Tous les genres ») au-dessus du bandeau.
- 18 novembre : nouvelles pages et sections à créer dans les maquettes (Où le regarder, Mes plateformes, filtre Plateforme, Qu'est-ce que je regarde, pages personne, saga, Mes sagas, page introuvable).
- Retour du 17 novembre (5e série) : puce du genre en cours ramenée à l'écran ; onglet « Mes films » actif sur les pages de genre ; « tes » → « mes » dans les titres et libellés (Mes westerns…, Mes genres, Mes meilleurs films, Mes têtes d'affiche, Répartition de mes notes, Mon genre dominant… sur l'accueil) ; « +X ce mois-ci » des KPI à la taille des autres phrases.
- 18 novembre (nouvelles fonctions) : « Où le regarder ? » sur la fiche (plateformes en France via TMDB/JustWatch, en vert celles de l'utilisateur, location et achat à part) ; Réglages › Mes plateformes ; filtre « Plateforme » (dont « Sur mes plateformes ») dans Mes films et la Watchlist, logos de mes plateformes sous les cartes de la Watchlist ; « Qu'est-ce que je regarde ? » (bouton de la Watchlist, tirage animé avec filtres durée, genre, mes plateformes) ; pages réalisateur / acteur (#personne/id, liens depuis le casting) ; sagas (bloc sur la fiche, #saga/id, #sagas via Mon espace et la recherche) ; page introuvable avec Baudet.
- 18 novembre (retours, version 1.1) : section « Ce que DonkTV sait faire » en bas de l'accueil (6 cartes avec les icônes de Mon espace) ; icône Sagas (calques) ; engrenage de Mon espace réparé ; Mes plateformes = barre de recherche + seulement les plateformes choisies ; titre de la page « Réglages » ; numéro de version (constante VERSION dans app.js, augmentée à chaque mise en ligne) ; fiche : bloc Saga dans la colonne de droite sous Mes visionnages ; « Où le regarder ? » sans la mention JustWatch ni la location/achat.
- 18 novembre (version 1.2) : menu PC en capsule centrée (Accueil, Mes films, Watchlist, Mon espace ▾ avec Mes tops, Statistiques, Rétrospectives, Mes sagas, Réglages), pastille qui glisse sous l'onglet actif, recherche en icône à droite ; page saga = jauge en haut (nom, films vus sur le total) puis frise chronologique d'affiches au format des cartes de l'app, flèches sur PC si la frise dépasse.
- Numéros de version : 1.1 (fonctions du 18 novembre + retours), 1.2 (menu et page saga). Règle : majeur.mineur.correctif, augmenté à chaque mise en ligne.

## Améliorations techniques du 18 novembre
- Base : lancer une fois `supabase/migration-2026-11-18.sql` (colonnes plateformes, saga, maj_le). Sans elles, l'app marche mais sans plateformes ni sagas.
- Données à jour : à l'ouverture d'une fiche, notes TMDB, date de sortie FR, plateformes et saga relues sur TMDB (une fois par session) ; note Rotten Tomatoes relue si elle a plus de 30 jours ou si le film a été vu depuis. Au démarrage, les films dont les plateformes ont plus de 7 jours sont complétés en arrière-plan (sans OMDb).
- Cache mémoire des lectures (`lire()` dans app.js) : affichage immédiat, relecture après 30 s, vidé à chaque écriture.
- Service worker : cache des images séparé et plafonné à 400 fichiers ; l'ancien cache v1 est supprimé.
- Démarrage attendu après le chargement de tous les scripts (`pagesChargees`).

## Écarts assumés par rapport aux maquettes
- Mobile : barre du bas Accueil · Collection · + · À voir · Mon espace ; tops, stats, rétros et réglages via Mon espace.
- La collection n'affiche que les films vus.
- Filtres de la watchlist : un genre sans film à voir est masqué.
- Tops : flèches seulement, pas de glisser-déposer.
- Réalisateurs : photo et genre (Réalisateur / Réalisatrice) lus sur TMDB à l'ouverture de la fiche, pas stockés en base.

## Technique
- Site statique : `index.html`, `style.css`, `app.js` (base, fiche, collection, ajout), `pages.js` (autres pages), `decouvrir.js` (plateformes, tirage, personnes, sagas), `sw.js`, `img/`.
- Schéma de la base : `supabase/schema.sql` (tables reglages, films, visionnages, tops ; sécurité par utilisateur).
- Routage par `#page/param` ; table `PAGES`.
- Clés TMDB et OMDb : saisies dans Réglages, stockées dans Supabase, jamais dans le code.

## Règles de travail
- Utiliser le skill ponytail (code minimal, réponses courtes).
- Poser des questions et ne rien faire sans accord, sauf consigne contraire.
- Relire un fichier des maquettes depuis l'artifact avant de le modifier ; ne pas toucher « Artboard 1 » sur « Page 2 » du canvas.
- Ne jamais demander ni écrire la clé secret/service_role de Supabase ni le mot de passe de la base.
- Après chaque étape : mettre à jour ce fichier et le cahier des charges.
