// La clé « publishable » est faite pour être publique : les données sont protégées par les règles RLS (supabase/schema.sql).
const sb = supabase.createClient('https://garqewteguzlrpujqcjc.supabase.co', 'sb_publishable_JUGsl_hVTnJm9E4MdSynDw_o6QL5B9d');

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = (n) => String(n).replace('.', ',');
const AFFICHE = 'https://image.tmdb.org/t/p/w342';
const affiche = (chemin, alt = '') => `<span class="affiche">${chemin ? `<img src="${AFFICHE}${esc(chemin)}" alt="${esc(alt)}" loading="lazy">` : ''}</span>`;

const GENRES = ['Western', 'Thriller', 'Drame', 'SF', 'Horreur', 'Comédie', 'Romantique', 'Action', 'Aventure', 'Animation', 'Guerre'];
const buste = (g) => `img/buste-${g.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.png`;
// Genres TMDB → les 11 genres de l'app (les autres, comme Documentaire, n'ont pas d'équivalent).
const GENRE_TMDB = { 28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Thriller', 18: 'Drame', 14: 'Aventure', 36: 'Drame',
  27: 'Horreur', 9648: 'Thriller', 10749: 'Romantique', 878: 'SF', 53: 'Thriller', 10752: 'Guerre', 37: 'Western' };

let uid = null, reglages = {}, films = [];

function toast(msg, action) {
  const t = $('#toast');
  t.replaceChildren(msg);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = action.label;
    b.onclick = () => { t.hidden = true; action.fn(); };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), action ? 6000 : 3200);
}

function appliquerTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('donktv-theme', theme); } catch {}
}

async function enregistrerReglages(patch) {
  const { error } = await sb.from('reglages').upsert({ user_id: uid, ...patch });
  if (error) throw new Error('Enregistrement impossible : ' + error.message);
  Object.assign(reglages, patch);
}

/* ---------- TMDB et OMDb ---------- */

async function tmdb(chemin, params = {}, cle = reglages.tmdb_token) {
  const jeton = cle?.startsWith('eyJ');
  const q = new URLSearchParams({ language: 'fr-FR', ...params, ...(jeton ? {} : { api_key: cle }) });
  const r = await fetch(`https://api.themoviedb.org/3${chemin}?${q}`, jeton ? { headers: { Authorization: `Bearer ${cle}` } } : {});
  if (!r.ok) throw new Error(r.status === 401 ? 'TMDB refuse cette clé.' : `TMDB ne répond pas (erreur ${r.status}).`);
  return r.json();
}

async function omdb(imdbId, cle = reglages.omdb_key) {
  const r = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(cle)}`);
  const j = await r.json().catch(() => ({}));
  if (j.Response !== 'True') throw new Error(j.Error === 'Invalid API key!' ? 'OMDb refuse cette clé : vérifie qu’elle est activée (lien dans le mail d’OMDb).' : 'OMDb : ' + (j.Error || `erreur ${r.status}`));
  return j;
}

function versFilm(d) {
  const fr_ = d.release_dates?.results?.find((x) => x.iso_3166_1 === 'FR')?.release_dates?.[0]?.release_date;
  const video = d.videos?.results?.filter((v) => v.site === 'YouTube' && v.type === 'Trailer').sort((a, b) => (b.iso_639_1 === 'fr') - (a.iso_639_1 === 'fr'))[0];
  return {
    tmdb_id: d.id, imdb_id: d.imdb_id || null, titre: d.title, titre_original: d.original_title,
    annee: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    date_sortie_fr: (fr_ || d.release_date || '').slice(0, 10) || null,
    affiche: d.poster_path, synopsis: d.overview,
    realisateurs: (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name),
    acteurs: (d.credits?.cast || []).slice(0, 10).map((c) => ({ nom: c.name, role: c.character, photo: c.profile_path })),
    duree: d.runtime || null, pays: (d.production_countries || []).map((p) => p.iso_3166_1),
    genres: [...new Set((d.genres || []).map((g) => GENRE_TMDB[g.id]).filter(Boolean))],
    bande_annonce: video?.key || null, note_tmdb: d.vote_average || null, votes_tmdb: d.vote_count || null,
  };
}

const duree = (m) => (m ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : '');

/* ---------- Pages ---------- */

const ETAPES = [
  ['#3F7A4F', 'M12 5v14M5 12h14', 'Ajoute tes films', 'Tape un titre : affiche, synopsis, réalisateur et casting arrivent tout seuls depuis TMDB.'],
  ['#E3A72F', 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z', 'Note-les', 'Une note en demi-étoiles, un coup de cœur si le film le mérite, et la date où tu l’as vu.'],
  ['#3E8ED0', 'M4 20V10M10 20V4M16 20v-7M22 20H2', 'Découvre tes stats', 'Tes genres préférés, tes réalisateurs fétiches, ta carte du monde et tes rétrospectives.'],
];

function pageAccueil() {
  if (films.length) return pageAccueilPleine();
  if (films.length) {
    // shortcut: liste simple en attendant le vrai accueil (KPI, souvenirs, bientôt au cinéma) des maquettes.
    return `<div class="titre-page"><p class="sur-titre">Accueil</p><h1>Tes derniers films</h1></div>
      <div class="grille">${films.slice(0, 18).map((f) => `<a class="film" href="#film/${f.id}">
        <span class="affiche">${f.affiche ? `<img src="${AFFICHE}${esc(f.affiche)}" alt="" loading="lazy">` : ''}<span class="badge ${f.statut === 'vu' ? 'vu' : ''}">${f.statut === 'vu' ? 'Vu' : 'À voir'}</span></span>
        <b>${esc(f.titre)}</b><small>${esc(f.annee ?? '')}${f.note ? ` · ${fr(f.note)} / 5` : ''}${f.coup_de_coeur ? ' · coup de cœur' : ''}</small></a>`).join('')}</div>`;
  }
  return `<section class="hero"><div class="hero-texte">
      <p class="sur-titre">Premier lancement</p><h1>Bienvenue sur DonkTV</h1>
      <p>Ton carnet de cinéma, rien qu'à toi. Commence par un film <span class="long">que tu as </span>vu récemment<span class="long"> : le reste se remplit tout seul</span>.</p>
      <button class="btn primaire grand" type="button" data-ajout>Ajouter un film</button></div></section>
    <section style="display:flex;flex-direction:column;gap:24px"><div><p class="sur-titre">Comment ça marche</p><h2 class="section">Trois étapes, c'est tout</h2></div>
    <ol class="etapes">${ETAPES.map(([bg, ico, titre, texte]) => `<li><span class="ico" style="background:${bg}" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${ico}"/></svg></span>
      <div><h3>${titre}</h3><p>${texte}</p></div></li>`).join('')}</ol></section>`;
}

const APERCUS = { clair: '#F6F1E4', sombre: '#141F19', auto: 'linear-gradient(90deg, #F6F1E4 50%, #141F19 50%)' };
const CLES = [
  { champ: 'tmdb_token', nom: 'Clé TMDB', aide: 'Gratuite, à créer sur themoviedb.org (Paramètres › API). Le jeton d’accès ou la clé d’API conviennent.', test: (v) => tmdb('/configuration', {}, v) },
  { champ: 'omdb_key', nom: 'Clé OMDb', aide: 'Gratuite, à demander sur omdbapi.com. Limitée à 1 000 requêtes par jour.', test: (v) => omdb('tt0133093', v) },
];

function pageReglages() {
  const theme = reglages.theme || 'auto';
  return `<div class="titre-page"><p class="sur-titre">Réglages</p><h1>Ton application, à ta façon</h1></div>
  <div class="reglages">
    <section class="carte"><div><h2>Apparence</h2><p class="muted">Le mode automatique suit le réglage de ton téléphone ou de ton ordinateur.</p></div>
      <div class="themes" role="radiogroup" aria-label="Thème">${[['clair', 'Clair'], ['sombre', 'Sombre'], ['auto', 'Automatique']].map(([id, label]) =>
        `<button type="button" role="radio" aria-checked="${theme === id}" data-theme-choix="${id}"><span class="apercu" style="background:${APERCUS[id]};border:1px solid var(--line)" aria-hidden="true"></span>${label}</button>`).join('')}</div>
    </section>
    <section class="carte"><div><h2>Sources des films</h2><p class="muted">Deux clés gratuites : TMDB pour les fiches, OMDb pour la note des critiques.</p></div>
      ${CLES.map((k) => `<div class="cle" data-cle="${k.champ}">
        <div class="cle-tete"><label for="${k.champ}">${k.nom}</label><span class="etat ${reglages[k.champ] ? 'ok' : ''}">${reglages[k.champ] ? 'Connectée' : 'À renseigner'}</span></div>
        <div class="cle-ligne"><input id="${k.champ}" type="password" value="${esc(reglages[k.champ])}" autocomplete="off" spellcheck="false">
          <button class="btn" type="button" data-voir>Afficher</button><button class="btn" type="button" data-tester>Tester et enregistrer</button></div>
        <small>${k.aide}</small></div>`).join('')}
    </section>
    <section class="carte"><h2>À propos</h2><p style="font-size:15px">DonkTV · version 1.0</p>
      <p class="muted" style="font-size:14px">Fiches, affiches et note des spectateurs : TMDB. Note des critiques : Rotten Tomatoes, via OMDb. Cette application utilise l'API TMDB mais n'est ni approuvée ni certifiée par TMDB.</p>
      <button class="btn" type="button" data-deconnexion style="align-self:flex-start">Se déconnecter</button>
    </section>
  </div>`;
}

const PAGES = { accueil: pageAccueil, reglages: pageReglages, film: (id) => pageFilm(id), collection: () => pageCollection(), calendrier: () => pageCalendrier() };

async function route() {
  const hash = location.hash, [nom, id] = (hash.slice(1) || 'accueil').split('/'), page = $('#page');
  const actif = { film: 'collection', calendrier: 'collection' }[nom] || nom;
  document.querySelectorAll('#app a[href^="#"]').forEach((a) => (a.getAttribute('href') === '#' + actif ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const rendu = (PAGES[nom] || (() => `<div class="titre-page"><p class="sur-titre">En construction</p><h1>Cette page arrive bientôt</h1><p class="muted">Elle sera ajoutée dans une prochaine étape du développement.</p></div>`))(id);
  if (rendu instanceof Promise) {
    if (page.dataset.vue !== hash) page.innerHTML = '<p class="vide">Chargement…</p>';
    let html;
    try { html = await rendu; } catch (err) { html = `<p class="vide erreur">Chargement impossible : ${esc(err.message)}</p>`; }
    if (location.hash !== hash) return; // on a changé de page pendant le chargement
    page.innerHTML = html;
  } else page.innerHTML = rendu;
  if (page.dataset.vue !== hash) scrollTo(0, 0);
  page.dataset.vue = hash;
  PAGES[nom]?.apres?.();
  if (nom === 'accueil') proposerInstallation();
}
addEventListener('hashchange', () => {
  for (const d of [fen, $('#recherche')]) if (d.open) d.close(); // une fenêtre ouverte ne survit pas à un changement de page
  if (uid) route();
});

$('#page').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.themeChoix) {
      appliquerTheme(b.dataset.themeChoix);
      await enregistrerReglages({ theme: b.dataset.themeChoix });
      route();
    } else if ('voir' in b.dataset) {
      const i = $('input', b.closest('.cle'));
      i.type = i.type === 'password' ? 'text' : 'password';
      b.textContent = i.type === 'password' ? 'Afficher' : 'Masquer';
    } else if ('tester' in b.dataset) {
      const bloc = b.closest('.cle'), k = CLES.find((c) => c.champ === bloc.dataset.cle), etat = $('.etat', bloc);
      // Le mail d'OMDb donne un lien d'exemple : on en extrait la clé si c'est lui qui a été collé.
      const v = $('input', bloc).value.trim().replace(/^.*[?&]apikey=([^&\s]+).*$/i, '$1');
      $('input', bloc).value = v;
      if (!v) return toast('Colle d’abord ta clé.');
      b.disabled = true;
      try {
        await k.test(v);
        await enregistrerReglages({ [k.champ]: v });
        etat.className = 'etat ok'; etat.textContent = 'Connectée';
        toast(k.nom + ' : connexion réussie, clé enregistrée.');
      } catch (err) {
        etat.className = 'etat ko'; etat.textContent = 'À vérifier';
        toast(err instanceof TypeError ? 'Pas de connexion à ' + k.nom.slice(4) + '.' : err.message);
      } finally { b.disabled = false; }
    } else if ('deconnexion' in b.dataset) {
      await sb.auth.signOut();
    }
  } catch (err) { toast(err.message); }
});

/* ---------- Fiche film ---------- */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateLongue = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}`; };
const aujourdhui = () => new Date().toLocaleDateString('sv');
const etoilesTxt = (n) => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '');
const ICO_ETOILE = '<svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" rx="14" fill="#F2B84B"/><path d="M26 13l3.9 8.2 8.9 1.1-6.6 6.1 1.8 8.8L26 32.8l-8 4.4 1.8-8.8-6.6-6.1 8.9-1.1z" fill="#5A3A08"/></svg>';
const ICO_RT = '<svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" rx="14" fill="#E8664A"/><path d="M17 36l3.5-10.5L33 13l6 6-12.5 12.5z" fill="#FFF"/><path d="M20.5 25.5l6 6" stroke="#E8664A" stroke-width="2.4" stroke-linecap="round"/><circle cx="27.5" cy="24.5" r="2" fill="#E8664A"/><path d="M14 39h12" stroke="#FFF" stroke-width="2.6" stroke-linecap="round"/></svg>';
const ICO_TMDB = '<svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" rx="14" fill="#3E8ED0"/><path d="M13 19h26v4.5a3.5 3.5 0 0 0 0 7V35H13v-4.5a3.5 3.5 0 0 0 0-7z" fill="#FFF"/><path d="M31 20v14" stroke="#3E8ED0" stroke-width="2.2" stroke-dasharray="2.5 2.5"/></svg>';
const ICO_COEUR = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.3-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.7 12 20 12 20z" fill="#F07A6E"/></svg>';
const ICO_POUBELLE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function etoilesHtml(note, id) {
  return `<div class="note"><div class="etoiles" role="radiogroup" aria-labelledby="${id}">${[1, 2, 3, 4, 5].map((i) => `<span class="etoile">
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="var(${note >= i ? '--star' : '--star-empty'})"/>${note >= i - 0.5 ? '<path d="M12 2.5v14.8l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="var(--star)"/>' : ''}</svg>
    <button type="button" role="radio" style="left:0" data-note="${i - 0.5}" aria-checked="${note === i - 0.5}" aria-label="${fr(i - 0.5)} sur 5"></button>
    <button type="button" role="radio" style="right:0" data-note="${i}" aria-checked="${note === i}" aria-label="${i} sur 5"></button></span>`).join('')}</div>
    <span class="chiffre">${note ? fr(note) + ' / 5' : 'À noter'}</span></div>`;
}
const coeurHtml = (on) => `<button class="btn coeur" type="button" data-coeur aria-pressed="${on}"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.3-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.7 12 20 12 20z" fill="none" stroke="#D2483B" stroke-width="1.8"/></svg>Coup de cœur</button>`;
const genresHtml = (sel) => `<div class="genres">${GENRES.map((g) => `<button type="button" data-genre="${g}" aria-pressed="${sel.includes(g)}"><img src="${buste(g)}" alt="">${g}</button>`).join('')}</div>`;

let fiche = null; // film affiché, avec ses visionnages

// Niveau d'une note extérieure ramenée sur 100 : vert dès 75, jaune dès 60, rouge en dessous.
const NIVEAUX = [[75, 'haut', 'Très bien noté'], [60, 'moyen', 'Mitigé'], [0, 'bas', 'Mal noté']];
const niveau = (sur100) => (sur100 == null ? null : NIVEAUX.find(([min]) => sur100 >= min));

function tuile(ico, label, valeur, unite, bas, lien, niv) {
  const contenu = `${ico}<div><span class="tuile-label">${label}</span>${valeur == null
    ? '<span class="tuile-vide">Pas encore de note</span>'
    : `<span class="chiffre">${valeur}<small>${unite}</small></span>`}${niv ? `<span class="tuile-niveau">${niv[2]}</span>` : ''}<span class="tuile-bas">${bas}</span></div>`;
  const cls = `tuile${niv ? ' note-' + niv[1] : ''}`;
  return lien ? `<a class="${cls}" href="${lien}" target="_blank" rel="noopener">${contenu}</a>` : `<div class="${cls}">${contenu}</div>`;
}

const personne = (nom, photo, role) => `<li><span class="photo">${photo ? `<img src="https://image.tmdb.org/t/p/w185${esc(photo)}" alt="" loading="lazy">` : esc(nom.split(' ').map((p) => p[0]).join('').slice(0, 3))}</span>
  <b>${esc(nom)}</b>${role ? `<small>${esc(role)}</small>` : ''}</li>`;
// TMDB : 1 = femme. Au masculin dès qu'un réalisateur n'est pas une femme (ou genre inconnu).
const titreReal = (rs) => (rs.every((r) => r.genre === 1) ? 'Réalisatrice' : 'Réalisateur') + (rs.length > 1 ? 's' : '');

function htmlFilm(f) {
  const vu = f.statut === 'vu';
  const visions = f.visionnages.map((v) => v.date).sort();
  const n = visions.length;
  const vuTxt = !vu ? 'Dans ta watchlist' : n > 1 ? `Vu ${n} fois · dernier visionnage le ${dateLongue(visions[n - 1])}` : n ? `Vu le ${dateLongue(visions[0])}` : 'Vu';
  const meta = [f.annee, duree(f.duree)].filter(Boolean).join(' · ') + (f.realisateurs.length ? ` · de <strong>${esc(f.realisateurs.join(', '))}</strong>` : '');
  return `<div class="fiche-tete"><a class="retour" href="#collection"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Collection</a>
  <section class="fiche-hero">
    <div class="fiche-affiche">${f.affiche ? `<img src="https://image.tmdb.org/t/p/w500${esc(f.affiche)}" alt="Affiche officielle de ${esc(f.titre)} (TMDB)">` : ''}</div>
    <div class="fiche-infos">
      <h1>${esc(f.titre)}</h1>
      <div class="fiche-genres">${f.genres.map((g) => `<a href="#genre/${norm(g)}"><img src="${buste(g)}" alt="">${g}</a>`).join('')}</div>
      <p class="fiche-meta">${meta}</p>
      <div class="tuiles">
        ${vu ? tuile(ICO_ETOILE, 'Ma note', f.note ? fr(f.note) : null, ' /5', (f.note ? `<span aria-hidden="true" class="ma-note">${etoilesTxt(f.note)}</span>` : '') + '<span class="court">Ma note</span>') : ''}
        ${tuile(ICO_RT, 'Critiques', f.note_rt, ' %', 'Rotten Tomatoes ↗', `https://www.rottentomatoes.com/search?search=${encodeURIComponent(f.titre_original || f.titre)}`, niveau(f.note_rt))}
        ${tuile(ICO_TMDB, 'Spectateurs', f.note_tmdb ? fr(Number(f.note_tmdb).toFixed(1)) : null, ' /10', `TMDB${f.votes_tmdb ? ' · ' + f.votes_tmdb.toLocaleString('fr-FR') + ' votes' : ''} ↗`, `https://www.themoviedb.org/movie/${f.tmdb_id}`, niveau(f.note_tmdb && f.note_tmdb * 10))}
      </div>
      <div class="fiche-etiquettes">${vu && f.coup_de_coeur ? `<span class="coeur-on">${ICO_COEUR}Coup de cœur</span>` : ''}<span>${vuTxt}</span></div>
      <div class="fiche-actions">
        <button class="btn clair" type="button" data-action="${vu ? 'revu' : 'vu'}">${vu ? 'Je l’ai revu' : 'Je l’ai vu'}</button>
        <button class="btn contour ${vu ? '' : 'large'}" type="button" data-action="modifier">Modifier</button>
        ${vu ? `<button class="btn contour" type="button" data-action="tops">${ICO_TROPHEE}${libelleTops(f.tops)}</button>` : ''}
        <button class="btn contour carre" type="button" data-action="supprimer" aria-label="Supprimer le film">${ICO_POUBELLE}</button>
      </div>
    </div>
  </section></div>
  <div class="fiche-corps">
    <div class="fiche-main">
      ${f.synopsis ? `<section><p class="sur-titre">L'histoire</p><h2 class="section">Synopsis</h2><p class="synopsis">${esc(f.synopsis)}</p></section>` : ''}
      ${f.bande_annonce ? `<section><h2 class="section">Bande-annonce</h2><a class="ba" href="https://www.youtube.com/watch?v=${encodeURIComponent(f.bande_annonce)}" target="_blank" rel="noopener" style="background-image:url(https://i.ytimg.com/vi/${encodeURIComponent(f.bande_annonce)}/hqdefault.jpg)">
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="40" fill="#F3EEDD"/><path d="M33 26l23 14-23 14z" fill="#1A2730"/></svg><span>Regarder sur YouTube ↗</span></a></section>` : ''}
      ${f.reals.length ? `<section><h2 class="section">${titreReal(f.reals)}</h2><ul class="casting">${f.reals.map((r) => personne(r.nom, r.photo, '')).join('')}</ul></section>` : ''}
      ${f.acteurs.length ? `<section><h2 class="section">Casting</h2><ul class="casting">${f.acteurs.map((a) => personne(a.nom, a.photo, a.role)).join('')}</ul></section>` : ''}
    </div>
    <aside class="carte histo"><h2>Mes visionnages</h2>${vu && n ? `<ol>${visions.slice().reverse().map((d, i) => `<li class="${i === 0 ? 'dernier' : ''}">
      <b>${dateLongue(d)}</b><small>${i === n - 1 ? 'Premier visionnage' : 'Revisionnage'}</small></li>`).join('')}</ol>`
      : `<p class="muted">Pas encore vu. Dans ta watchlist depuis le ${dateLongue(f.ajoute_le.slice(0, 10))}.</p>`}</aside>
  </div>`;
}

async function pageFilm(id) {
  const { data: f, error } = await sb.from('films').select('*, visionnages(id,date)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (f && f.note_rt == null && f.imdb_id && reglages.omdb_key && !pageFilm.essayes.has(f.id)) {
    // Note absente (clé OMDb pas encore valide à l'ajout, ou OMDb indisponible) : on retente une fois par session.
    pageFilm.essayes.add(f.id);
    try {
      const rt = parseInt((await omdb(f.imdb_id)).Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value);
      if (rt >= 0) { f.note_rt = rt; await sb.from('films').update({ note_rt: rt }).eq('id', f.id); }
    } catch {}
  }
  if (f) {
    f.tops = (await sb.from('tops').select('liste,position').eq('film_id', f.id)).data || [];
    f.reals = await realisateurs(f);
  }
  fiche = f;
  return f ? htmlFilm(f) : `<div class="titre-page"><p class="sur-titre">Fiche film</p><h1>Ce film n'est plus dans ta collection</h1><a class="btn" href="#accueil" style="align-self:flex-start">Retour à l'accueil</a></div>`;
}

pageFilm.essayes = new Set();

// Photo et genre des réalisateurs : pas stockés en base, lus sur TMDB (sinon, les noms seuls).
const cacheReals = new Map();
async function realisateurs(f) {
  if (!cacheReals.has(f.tmdb_id) && reglages.tmdb_token) try {
    cacheReals.set(f.tmdb_id, (await tmdb(`/movie/${f.tmdb_id}/credits`)).crew.filter((c) => c.job === 'Director').map((c) => ({ nom: c.name, photo: c.profile_path, genre: c.gender })));
  } catch {}
  return cacheReals.get(f.tmdb_id) || f.realisateurs.map((nom) => ({ nom }));
}

const fen = $('#fenetre'), fenCorps = $('#fenetre-corps');
let edition = null; // brouillon de la fenêtre « Modifier »

function ouvrirEdition(versVu) {
  const visions = fiche.visionnages.map((v) => v.date).sort();
  edition = { statut: versVu ? 'vu' : fiche.statut, note: Number(fiche.note) || 0, coeur: fiche.coup_de_coeur, genres: [...fiche.genres],
    visions: versVu ? [aujourdhui()] : visions };
  fen.classList.remove('petit');
  afficherEdition();
  fen.showModal();
}

function afficherEdition() {
  const d = edition, vu = d.statut === 'vu';
  fenCorps.innerHTML = `<div class="ajout-tete"><span class="mini-affiche">${affiche(fiche.affiche)}</span>
    <div class="ajout-titres"><span class="sur-titre">${esc(fiche.titre)}</span><h2>${fiche.statut === 'vu' ? 'Modifier le film' : vu ? 'Ton avis' : 'Modifier le film'}</h2></div>
    <button class="btn carre" type="button" data-fermer aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <div class="edition">
    ${vu ? `<div class="avis"><div><span class="etiquette" id="edit-note">Ma note</span>${etoilesHtml(d.note, 'edit-note')}</div>${coeurHtml(d.coeur)}</div>` : ''}
    <fieldset><legend>Genres</legend>${genresHtml(d.genres)}</fieldset>
    ${vu ? visionsHtml() : ''}
  </div>
  <div class="ajout-pied"><p class="erreur" id="erreur-edition" role="alert" hidden></p><span></span>
    <div class="boutons"><button class="btn" type="button" data-fermer>Annuler</button><button class="btn primaire" type="button" data-enregistrer-edition>Enregistrer</button></div></div>`;
}

function visionsHtml() {
  const d = edition;
  return `<fieldset class="visions"><legend>Mes visionnages</legend>${d.visions.map((v, i) => `<div class="vision">
        <label><span>${i === 0 ? 'Premier' : 'Revu le'}</span><input type="date" data-vision="${i}" value="${v}" max="${aujourdhui()}"></label>
        <button class="btn carre" type="button" data-retirer="${i}" ${d.visions.length <= 1 ? 'disabled' : ''} aria-label="Retirer le visionnage du ${v ? dateLongue(v) : 'jour non renseigné'}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button></div>`).join('')}
      <button class="btn pointille" type="button" data-ajouter-vision>+ Ajouter un visionnage</button></fieldset>`;
}

function majListe(id, patch) {
  const i = films.findIndex((x) => x.id === id);
  if (i >= 0) films[i] = { ...films[i], ...patch };
}

async function enregistrerEdition(b) {
  const d = edition, vu = d.statut === 'vu', err = $('#erreur-edition');
  const manque = vu && !d.note ? 'Choisis une note avant d’enregistrer.' : !d.genres.length ? 'Choisis au moins un genre avant d’enregistrer.'
    : vu && d.visions.some((v) => !v) ? 'Choisis une date pour chaque visionnage.' : '';
  if (manque) { err.textContent = manque; err.hidden = false; return; }
  b.disabled = true;
  try {
    const patch = { statut: d.statut, note: vu && d.note ? d.note : null, coup_de_coeur: vu && d.coeur, genres: d.genres };
    const { error } = await sb.from('films').update(patch).eq('id', fiche.id);
    if (error) throw error;
    const anciens = fiche.visionnages.map((v) => v.date).sort();
    if (vu && d.visions.slice().sort().join() !== anciens.join()) {
      // Ajout avant suppression : si l'ajout échoue, les anciens visionnages restent.
      const { error: e1 } = await sb.from('visionnages').insert(d.visions.map((date) => ({ film_id: fiche.id, date })));
      if (e1) throw e1;
      if (fiche.visionnages.length) {
        const { error: e2 } = await sb.from('visionnages').delete().in('id', fiche.visionnages.map((v) => v.id));
        if (e2) throw e2;
      }
    }
    majListe(fiche.id, patch);
    fen.close();
    toast(fiche.statut === 'vu' || !vu ? 'Modifications enregistrées.' : `${fiche.titre} est maintenant dans tes films vus.`);
    route();
  } catch (e) {
    err.textContent = 'Enregistrement impossible : ' + (e.message || e); err.hidden = false;
    b.disabled = false;
  }
}

async function ouvrirSuppression() {
  const { data: tops } = await sb.from('tops').select('liste,position').eq('film_id', fiche.id);
  const n = fiche.visionnages.length, morceaux = [];
  if (fiche.note) morceaux.push(`ta note (${fr(fiche.note)} / 5)`);
  if (n) morceaux.push(n > 1 ? `tes ${n} visionnages` : 'ton visionnage');
  if (tops?.length) morceaux.push(`ses places dans tes tops (${tops.map((t) => `N°${t.position} du top ${t.liste === 'tous' ? 'général' : t.liste}`).join(', ')})`);
  const texte = morceaux.length
    ? (morceaux.length > 1 ? morceaux.slice(0, -1).join(', ') + ' et ' + morceaux.at(-1) : morceaux[0]).replace(/^./, (c) => c.toUpperCase()) + (morceaux.length > 1 || n > 1 ? ' seront effacés.' : ' sera effacé.')
    : 'Il sera retiré de ta watchlist.';
  fen.classList.add('petit');
  fenCorps.innerHTML = `<div class="confirmation" role="alertdialog" aria-labelledby="del-titre" aria-describedby="del-texte">
    <div><h2 id="del-titre">Supprimer ${esc(fiche.titre)} ?</h2><p id="del-texte" class="muted">${texte}</p></div>
    <div class="boutons"><button class="btn" type="button" data-fermer autofocus>Annuler</button><button class="btn danger" type="button" data-confirmer-suppression>Supprimer</button></div></div>`;
  fen.showModal();
}

let suppressionEnAttente = null;
function supprimerFilm() {
  const f = fiche, i = films.findIndex((x) => x.id === f.id), ligne = films[i];
  fen.close();
  if (i >= 0) films.splice(i, 1);
  // La suppression part après le délai d'annulation, ou tout de suite si l'app passe en arrière-plan.
  const executer = async () => {
    clearTimeout(minuteur); suppressionEnAttente = null;
    const { error } = await sb.from('films').delete().eq('id', f.id);
    if (error) { if (ligne) films.splice(i, 0, ligne); toast('Suppression impossible : ' + error.message); route(); }
  };
  const minuteur = setTimeout(executer, 6000);
  suppressionEnAttente = executer;
  location.hash = '#accueil';
  toast(`${f.titre} a été supprimé de ta collection.`, { label: 'Annuler', fn: () => {
    clearTimeout(minuteur); suppressionEnAttente = null;
    if (ligne) films.splice(i, 0, ligne);
    toast('Suppression annulée.'); route();
  } });
}
document.addEventListener('visibilitychange', () => document.hidden && suppressionEnAttente?.());

function ouvrirRevisionnage() {
  edition = null;
  fen.classList.add('petit');
  fenCorps.innerHTML = `<div class="confirmation"><div><h2>Je l’ai revu</h2><p class="muted">Quand as-tu revu ${esc(fiche.titre)} ?</p></div>
    <label class="champ"><span>Date</span><input type="date" id="date-revu" value="${aujourdhui()}" max="${aujourdhui()}" required></label>
    <p class="erreur" id="erreur-revu" role="alert" hidden></p>
    <div class="boutons"><button class="btn" type="button" data-fermer>Annuler</button><button class="btn primaire" type="button" data-enregistrer-revu>Enregistrer</button></div></div>`;
  fen.showModal();
}

async function enregistrerRevisionnage(b) {
  const date = $('#date-revu').value, err = $('#erreur-revu');
  if (!date || date > aujourdhui()) { err.textContent = 'Choisis une date passée ou celle d’aujourd’hui.'; err.hidden = false; return; }
  b.disabled = true;
  const { error } = await sb.from('visionnages').insert({ film_id: fiche.id, date });
  if (error) { b.disabled = false; err.textContent = 'Revisionnage non enregistré : ' + error.message; err.hidden = false; return; }
  fen.close();
  toast(`Revisionnage ajouté pour le ${dateLongue(date)}.`);
  route();
}

$('#page').addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]')?.dataset.action;
  if (a === 'revu') ouvrirRevisionnage();
  else if (a === 'vu') ouvrirEdition(true);
  else if (a === 'modifier') ouvrirEdition(false);
  else if (a === 'tops') ouvrirTopsFiche().catch((err) => toast(err.message));
  else if (a === 'supprimer') ouvrirSuppression().catch((err) => toast(err.message));
});

fen.addEventListener('click', (e) => {
  if (e.target === fen) return fen.close();
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if ('fermer' in d) fen.close();
  else if ('confirmerSuppression' in d) supprimerFilm();
  else if ('enregistrerEdition' in d) enregistrerEdition(b);
  else {
    if ('enregistrerRevu' in d) return enregistrerRevisionnage(b);
    if (!edition) return;
    if (d.note) { edition.note = Number(d.note) === edition.note ? 0 : Number(d.note); $('.note', fenCorps).outerHTML = etoilesHtml(edition.note, 'edit-note'); }
    else if ('coeur' in d) b.setAttribute('aria-pressed', edition.coeur = !edition.coeur);
    else if (d.genre) { const g = edition.genres; b.setAttribute('aria-pressed', !g.includes(d.genre)); edition.genres = g.includes(d.genre) ? g.filter((x) => x !== d.genre) : [...g, d.genre]; }
    else if (d.retirer || 'ajouterVision' in d) { d.retirer ? edition.visions.splice(Number(d.retirer), 1) : edition.visions.push(aujourdhui()); $('.visions', fenCorps).outerHTML = visionsHtml(); }
  }
});
fen.addEventListener('input', (e) => { if (e.target.dataset.vision) edition.visions[Number(e.target.dataset.vision)] = e.target.value; });

/* ---------- Menus déroulants ---------- */
// Un <select data-menu> reste dans la page (valeur, évènement « change ») mais s'affiche comme un bouton + une liste.

function habillerMenu(sel) {
  sel.dataset.menu = 'ok'; sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
  const nom = sel.getAttribute('aria-label') || sel.previousElementSibling?.textContent || '';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'menu-btn'; b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
  const maj = () => { b.innerHTML = `${esc(sel.selectedOptions[0]?.text)}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`; b.setAttribute('aria-label', `${nom} : ${sel.selectedOptions[0]?.text}`); };
  maj(); sel.after(b);
  b.addEventListener('click', () => (b.nextElementSibling ? fermerMenu(b) : ouvrirMenu(sel, b, maj)));
}

function ouvrirMenu(sel, b, maj) {
  document.querySelectorAll('.menu-liste').forEach((l) => fermerMenu(l.previousElementSibling));
  const ul = document.createElement('ul');
  ul.className = 'menu-liste'; ul.setAttribute('role', 'listbox');
  ul.innerHTML = [...sel.options].map((o, i) => `<li role="option" tabindex="-1" data-i="${i}" aria-selected="${o.selected}">${esc(o.text)}${o.selected ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' : ''}</li>`).join('');
  b.after(ul); b.setAttribute('aria-expanded', 'true');
  ul.children[sel.selectedIndex]?.focus();
  const choisir = (li) => {
    fermerMenu(b); b.focus();
    if (Number(li.dataset.i) === sel.selectedIndex) return;
    sel.selectedIndex = Number(li.dataset.i); maj();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  ul.addEventListener('click', (e) => e.target.closest('li') && choisir(e.target.closest('li')));
  ul.addEventListener('keydown', (e) => {
    const li = document.activeElement.closest('li');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); (e.key === 'ArrowDown' ? li?.nextElementSibling : li?.previousElementSibling)?.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (li) choisir(li); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermerMenu(b); b.focus(); }
    else if (e.key === 'Tab') fermerMenu(b);
  });
}

function fermerMenu(b) {
  if (b?.nextElementSibling?.classList.contains('menu-liste')) b.nextElementSibling.remove();
  b?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => { if (!e.target.closest('.menu-btn, .menu-liste')) document.querySelectorAll('.menu-liste').forEach((l) => fermerMenu(l.previousElementSibling)); });
new MutationObserver(() => document.querySelectorAll('select[data-menu=""]').forEach(habillerMenu)).observe(document.body, { childList: true, subtree: true });

/* ---------- Collection : grille et calendrier ---------- */

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pluriel = (n, mot, motP = mot + 's') => `${n} ${n > 1 ? motP : mot}`;
const ICO_COEUR_CARTE = '<svg role="img" aria-label="Coup de cœur" class="coeur-carte" width="28" height="28" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#FFFDF7"/><path d="M12 18s-6-3.6-6-8a3.3 3.3 0 0 1 6-1.9A3.3 3.3 0 0 1 18 10c0 4.4-6 8-6 8z" fill="#D2483B"/></svg>';
const ICO_REVU = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>';
const FLECHE = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d === 'g' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}"/></svg>`;

const coll = { q: '', tri: 'date', genre: '', page: 1, films: [] };
const TRIS = [['date', 'Date de visionnage'], ['note', 'Note'], ['genre', 'Genre'], ['annee', 'Année de sortie'], ['real', 'Réalisateur'], ['acteur', 'Acteur'], ['duree', 'Durée'], ['coeur', 'Coups de cœur']];

function entete(vue, compteur = '') {
  const lien = (v, label, ico) => `<a href="#${v}" ${v === vue ? 'aria-current="page"' : ''}>${ico}${label}</a>`;
  return `<div class="coll-tete"><div class="titre-page"><p class="sur-titre">Collection</p><h1>Mes films</h1></div>
    <div class="coll-tete-droite">${compteur}<nav class="bascule bascule-liens" aria-label="Affichage">
      ${lien('collection', 'Grille', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>')}
      ${lien('calendrier', 'Calendrier', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>')}
    </nav></div></div>`;
}

async function pageCollection() {
  const { data, error } = await sb.from('films').select('id,titre,annee,affiche,note,coup_de_coeur,genres,realisateurs,acteurs,duree,ajoute_le,visionnages(date)').eq('statut', 'vu');
  if (error) throw error;
  coll.films = data.map((f) => ({ ...f, note: f.note == null ? null : Number(f.note),
    dernier: f.visionnages.map((v) => v.date).sort().at(-1) || f.ajoute_le.slice(0, 10),
    cherche: norm([f.titre, ...f.realisateurs, ...f.acteurs.map((a) => a.nom)].join(' ')) }));
  return entete('collection', `<p class="muted"><strong>${coll.films.length}</strong> ${coll.films.length > 1 ? 'films vus' : 'film vu'}</p>`) + `
  <div class="filtres">
    <div class="filtres-ligne">
      <label class="champ champ-recherche"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="coll-q" type="search" placeholder="Titre, réalisateur, acteur…" aria-label="Rechercher dans la collection" value="${esc(coll.q)}" autocomplete="off"></label>
      <label class="champ"><span>Trier par</span><select id="coll-tri" data-menu>${TRIS.map(([v, l]) => `<option value="${v}" ${v === coll.tri ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="puces" role="group" aria-label="Filtrer par genre">${['', ...GENRES].map((g) =>
      `<button type="button" data-filtre-genre="${g}" aria-pressed="${coll.genre === g}">${g ? `<img src="${buste(g)}" alt="">${g}` : 'Tous les genres'}</button>`).join('')}</div>
  </div>
  <div id="coll-resultats">${htmlResultats()}</div>`;
}

function filmsFiltres() {
  const q = norm(coll.q.trim()), fin = '￿', txt = (a, b) => a.localeCompare(b, 'fr');
  const parDate = (a, b) => b.dernier.localeCompare(a.dernier);
  const tri = {
    date: parDate,
    note: (a, b) => (b.note ?? -1) - (a.note ?? -1) || parDate(a, b),
    genre: (a, b) => txt(a.genres[0] || fin, b.genres[0] || fin) || parDate(a, b),
    annee: (a, b) => (b.annee ?? 0) - (a.annee ?? 0),
    real: (a, b) => txt(a.realisateurs[0] || fin, b.realisateurs[0] || fin),
    acteur: (a, b) => txt(a.acteurs[0]?.nom || fin, b.acteurs[0]?.nom || fin),
    duree: (a, b) => (b.duree ?? 0) - (a.duree ?? 0),
    coeur: (a, b) => b.coup_de_coeur - a.coup_de_coeur || parDate(a, b),
  }[coll.tri];
  return coll.films.filter((f) => (!coll.genre || f.genres.includes(coll.genre)) && (!q || f.cherche.includes(q))).sort(tri);
}

function htmlResultats() {
  if (!coll.films.length) return `<div class="vide-mascotte"><img src="img/mascotte.png" alt="Baudet, la mascotte de DonkTV">
    <div><h2>Ta collection est vide</h2><p class="muted">Ajoute un film que tu as vu : il apparaîtra ici avec ta note.</p><button class="btn primaire" type="button" data-ajout>Ajouter un film</button></div></div>`;
  const parPage = matchMedia('(max-width: 760px)').matches ? 12 : 10;
  const l = filmsFiltres(), n = l.length, nbPages = Math.max(1, Math.ceil(n / parPage));
  coll.page = Math.min(coll.page, nbPages);
  const p = coll.page, debut = (p - 1) * parPage;
  if (!n) return `<div class="vide-mascotte"><img src="img/mascotte.png" alt="Baudet, la mascotte de DonkTV">
    <div><h2>Aucun film trouvé</h2><p class="muted">Baudet a fouillé partout, rien ne correspond à ces filtres.</p><button class="btn primaire" type="button" data-reinitialiser>Réinitialiser les filtres</button></div></div>`;
  // Pages affichées : la première, la dernière et les voisines de la page courante.
  const numeros = [...new Set([1, p - 1, p, p + 1, nbPages])].filter((x) => x >= 1 && x <= nbPages).sort((a, b) => a - b);
  return `<p class="muted compteur" aria-live="polite">${nbPages > 1 ? `Films ${debut + 1} à ${Math.min(debut + parPage, n)} sur ${n}` : pluriel(n, 'film')}</p>
  <div class="grille-films">${l.slice(debut, debut + parPage).map((f) => {
    const g = f.genres;
    return `<a class="carte-film" href="#film/${f.id}" aria-label="${esc(f.titre)}${f.annee ? ', ' + f.annee : ''}${f.note ? ', noté ' + fr(f.note) + ' sur 5' : ''}">
      <span class="poster">${f.affiche ? `<img src="${AFFICHE}${esc(f.affiche)}" alt="" loading="lazy">` : ''}${f.coup_de_coeur ? ICO_COEUR_CARTE : ''}
        <span class="bustes">${g.slice(0, 2).map((x) => `<span title="${x}" role="img" aria-label="Genre : ${x}"><img src="${buste(x)}" alt=""></span>`).join('')}${g.length > 2 ? `<span class="plus" title="${g.slice(2).join(', ')}">+${g.length - 2}</span>` : ''}</span></span>
      <b>${esc(f.titre)}</b><span class="carte-bas"><span>${f.annee ?? ''}</span><strong>${f.note ? '★ ' + fr(f.note) : 'À noter'}</strong></span></a>`;
  }).join('')}</div>
  ${nbPages > 1 ? `<nav class="pagination" aria-label="Pagination">
    <button class="btn" type="button" data-page="${p - 1}" ${p === 1 ? 'disabled' : ''} aria-label="Page précédente">${FLECHE('g')}<span class="long">Précédent</span></button>
    ${numeros.map((x, i) => `${i && x - numeros[i - 1] > 1 ? '<span class="muted">…</span>' : ''}<button class="btn carre" type="button" data-page="${x}" aria-label="Page ${x}" ${x === p ? 'aria-current="page"' : ''}>${x}</button>`).join('')}
    <button class="btn" type="button" data-page="${p + 1}" ${p === nbPages ? 'disabled' : ''} aria-label="Page suivante"><span class="long">Suivant</span>${FLECHE('d')}</button></nav>` : ''}`;
}

const majResultats = () => { const r = $('#coll-resultats'); if (r) r.innerHTML = htmlResultats(); };

/* Calendrier */

const cal = { mois: null, jour: null, visions: [] };

async function pageCalendrier() {
  const { data, error } = await sb.from('visionnages').select('date,film_id,films(id,titre,affiche,note,coup_de_coeur,duree)');
  if (error) throw error;
  const premier = {};
  data.forEach((v) => { if (!premier[v.film_id] || v.date < premier[v.film_id]) premier[v.film_id] = v.date; });
  cal.visions = data.filter((v) => v.films).map((v) => ({ ...v, revu: v.date > premier[v.film_id] }));
  cal.mois ??= aujourdhui().slice(0, 7);
  return entete('calendrier') + `<div id="cal" class="cal">${htmlCal()}</div>`;
}

function htmlCal() {
  const [y, m] = cal.mois.split('-').map(Number), nbJours = new Date(y, m, 0).getDate();
  const decalage = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lundi en premier
  const duMois = cal.visions.filter((v) => v.date.startsWith(cal.mois)), parJour = {};
  duMois.forEach((v) => (parJour[Number(v.date.slice(8))] ??= []).push(v));
  const jours = Object.keys(parJour).map(Number);
  if (!parJour[cal.jour]) cal.jour = jours.length ? Math.max(...jours) : null;
  const heures = Math.round(duMois.reduce((s, v) => s + (v.films.duree || 0), 0) / 60);
  const nomMois = MOIS[m - 1].replace(/^./, (c) => c.toUpperCase()) + ' ' + y;
  const nomJour = (d) => new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long' });
  const img = (v) => `<span class="cal-affiche">${v.films.affiche ? `<img src="https://image.tmdb.org/t/p/w185${esc(v.films.affiche)}" alt="">` : ''}</span>`;
  const cases = [];
  for (let i = 0; i < Math.ceil((decalage + nbJours) / 7) * 7; i++) {
    const d = i - decalage + 1, vs = parJour[d];
    if (d < 1 || d > nbJours) cases.push('<span></span>');
    else if (!vs) cases.push(`<span class="cal-vide">${d}</span>`);
    else cases.push(`<button type="button" class="cal-jour" data-jour="${d}" aria-pressed="${d === cal.jour}" aria-label="${nomJour(d)} ${d} ${MOIS[m - 1]} : ${esc(vs.map((v) => v.films.titre).join(', '))}">
      ${vs.length <= 3 ? vs.map(img).join('') : img(vs[0]) + img(vs[1]) + `<span class="cal-plus">+${vs.length - 2}</span>`}
      <span class="cal-num">${d}</span>${vs.some((v) => v.revu) ? `<span class="cal-revu" title="Revisionnage">${ICO_REVU}</span>` : ''}${vs.length === 1 && vs[0].films.coup_de_coeur ? ICO_COEUR_CARTE : ''}</button>`);
  }
  const vsJour = parJour[cal.jour] || [];
  return `<section class="carte cal-mois" aria-labelledby="mois-titre">
    <div class="cal-tete"><div class="cal-nav"><button class="btn carre" type="button" data-mois="-1" aria-label="Mois précédent">${FLECHE('g')}</button>
      <h2 id="mois-titre">${nomMois}</h2><button class="btn carre" type="button" data-mois="1" aria-label="Mois suivant">${FLECHE('d')}</button></div>
      <p class="cal-resume"><span><strong>${duMois.length}</strong> ${duMois.length > 1 ? 'films' : 'film'}</span><span><strong>${heures} h</strong> devant l'écran</span><span><strong>${jours.length}</strong> ${jours.length > 1 ? 'jours' : 'jour'} de cinéma</span></p></div>
    <div class="cal-grille cal-semaine" aria-hidden="true">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => `<span>${j}</span>`).join('')}</div>
    <div class="cal-grille">${cases.join('')}</div></section>
  <aside class="carte cal-detail" aria-live="polite">${cal.jour ? `<div><span class="sur-titre">${pluriel(vsJour.length, 'film vu', 'films vus')}</span>
      <h2>${nomJour(cal.jour).replace(/^./, (c) => c.toUpperCase())} ${cal.jour === 1 ? '1er' : cal.jour} ${MOIS[m - 1]}</h2></div>
    <ul>${vsJour.map((v) => `<li><a href="#film/${v.films.id}">${affiche(v.films.affiche)}<span><b>${esc(v.films.titre)}</b>
      <small>${v.films.note ? `<span class="etoile-txt" aria-hidden="true">★</span> ${fr(Number(v.films.note))}` : 'Pas noté'}${v.films.duree ? ' · ' + duree(v.films.duree) : ''}</small>
      <span class="pastilles">${v.films.coup_de_coeur ? '<span class="pastille-coeur">Coup de cœur</span>' : ''}${v.revu ? '<span>Revisionnage</span>' : ''}</span></span></a></li>`).join('')}</ul>`
    : `<h2>Aucun film en ${MOIS[m - 1]}</h2><p class="muted">Les films vus ce mois-ci apparaîtront dans les cases des jours.</p>`}</aside>`;
}

$('#page').addEventListener('input', (e) => {
  if (e.target.id === 'coll-q') { coll.q = e.target.value; coll.page = 1; majResultats(); }
});
$('#page').addEventListener('change', (e) => {
  if (e.target.id === 'coll-tri') { coll.tri = e.target.value; coll.page = 1; majResultats(); }
});
$('#page').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.filtreGenre != null) {
    coll.genre = d.filtreGenre; coll.page = 1;
    document.querySelectorAll('[data-filtre-genre]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    majResultats();
  } else if ('reinitialiser' in d) {
    Object.assign(coll, { q: '', genre: '', page: 1 });
    $('#coll-q').value = '';
    document.querySelectorAll('[data-filtre-genre]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.filtreGenre === ''));
    majResultats();
  } else if (d.page) {
    coll.page = Number(d.page); majResultats();
    $('.filtres').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } else if (d.mois) {
    const [y, m] = cal.mois.split('-').map(Number), x = new Date(y, m - 1 + Number(d.mois), 1);
    cal.mois = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; cal.jour = null;
    $('#cal').innerHTML = htmlCal();
  } else if (d.jour) {
    cal.jour = Number(d.jour); $('#cal').innerHTML = htmlCal();
    $(`[data-jour="${d.jour}"]`)?.focus();
  }
});

/* ---------- Ajouter un film ---------- */

const dlg = $('#ajout'), corps = $('#ajout-corps');
let saisie = null; // film choisi + avis en cours

function etape(n, titre) {
  $('#ajout-etape').textContent = `Étape ${n} sur 3`;
  $('#ajout-titre').textContent = titre;
  dlg.querySelectorAll('.progression span').forEach((s, i) => s.classList.toggle('on', i < n));
}

function ouvrirRecherche() {
  etape(1, 'Ajouter un film');
  if (!reglages.tmdb_token) {
    corps.innerHTML = `<p class="vide">Il manque ta clé TMDB pour chercher des films.<br><br><a class="btn primaire" href="#reglages" data-fermer>Ouvrir les réglages</a></p>`;
  } else {
    corps.innerHTML = `<label class="recherche"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Tape le titre d'un film…" aria-label="Titre du film" autocomplete="off"><small>via TMDB</small></label>
      <ul class="resultats" id="resultats"></ul>`;
  }
  if (!dlg.open) dlg.showModal();
  $('#q')?.focus();
}

let dernier = 0;
async function chercher(q) {
  const moi = ++dernier, ul = $('#resultats');
  if (!q.trim()) return (ul.innerHTML = '');
  try {
    const { results } = await tmdb('/search/movie', { query: q });
    if (moi !== dernier) return; // une frappe plus récente a pris le relais
    ul.innerHTML = results.length ? results.slice(0, 8).map((r) => {
      const connu = films.find((f) => f.tmdb_id === r.id);
      return `<li><button type="button" ${connu?.statut === 'vu' ? `data-fiche="${connu.id}"` : `data-id="${r.id}"`}>${affiche(r.poster_path)}
        <span><b>${esc(r.title)}</b><small>${esc((r.release_date || '').slice(0, 4) || 'Date inconnue')}</small></span>
        ${connu ? `<span class="badge ${connu.statut === 'vu' ? 'vu' : ''}">${connu.statut === 'vu' ? 'Déjà vu' : 'Dans ta watchlist'}</span>` : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>'}
      </button></li>`;
    }).join('') : `<li class="vide">Aucun film trouvé pour « ${esc(q)} ». Vérifie l'orthographe ou essaie le titre original.</li>`;
  } catch (err) {
    if (moi === dernier) ul.innerHTML = `<li class="vide erreur">${esc(err instanceof TypeError ? 'Pas de connexion à TMDB.' : err.message)}</li>`;
  }
}

async function choisir(id) {
  corps.innerHTML = '<p class="vide">Chargement de la fiche…</p>';
  try {
    const d = await tmdb(`/movie/${id}`, { append_to_response: 'credits,videos,release_dates', include_video_language: 'fr,en' });
    saisie = { film: versFilm(d), statut: 'vu', note: 0, coeur: false, date: new Date().toLocaleDateString('sv') };
    afficherDetails();
  } catch (err) {
    corps.innerHTML = `<p class="vide erreur">${esc(err instanceof TypeError ? 'Pas de connexion à TMDB.' : err.message)}</p>`;
  }
}

function afficherDetails() {
  const { film: f, statut, note, coeur, date } = saisie, vu = statut === 'vu';
  etape(2, 'Ton avis');
  corps.innerHTML = `<div class="details">
    <div class="details-affiche">${affiche(f.affiche, 'Affiche de ' + f.titre)}Affiche officielle (TMDB)</div>
    <div class="details-infos">
      <div><h3>${esc(f.titre)}</h3><p class="muted">${esc([f.annee, duree(f.duree), f.realisateurs.length ? 'de ' + f.realisateurs.join(', ') : ''].filter(Boolean).join(' · '))}</p><p>${esc(f.synopsis)}</p></div>
      <fieldset><legend>Statut</legend><div class="bascule">
        <button type="button" data-statut="vu" aria-pressed="${vu}">Je l’ai vu</button><button type="button" data-statut="a_voir" aria-pressed="${!vu}">À voir</button></div></fieldset>
      ${vu ? `<div class="avis">
        <div><span class="etiquette" id="note-label">Ta note</span>${etoilesHtml(note, 'note-label')}</div>
        ${coeurHtml(coeur)}
        <label><span class="etiquette">Vu le</span><input type="date" id="date-vu" value="${date}" max="${new Date().toLocaleDateString('sv')}"></label>
      </div>` : '<p class="info">Il rejoindra ta watchlist. Tu pourras le noter le jour où tu le verras.</p>'}
      <fieldset><legend>Genres <span>· pré-remplis par TMDB, modifiables</span></legend>${genresHtml(f.genres)}</fieldset>
    </div></div>
    <div class="ajout-pied"><button class="btn plat" type="button" data-retour>‹ Changer de film</button>
      <button class="btn primaire" type="button" data-enregistrer style="height:48px;padding:0 24px">${vu ? 'Ajouter à mes films vus' : 'Ajouter à ma watchlist'}</button>
      <p class="erreur" id="erreur-ajout" role="alert" hidden></p></div>`;
}

async function enregistrer(bouton) {
  const { film, statut, note, coeur, date } = saisie, vu = statut === 'vu';
  bouton.disabled = true;
  try {
    let note_rt = null;
    if (reglages.omdb_key && film.imdb_id) {
      // La note des critiques est facultative : un échec OMDb ne doit pas empêcher l'ajout.
      try { note_rt = parseInt((await omdb(film.imdb_id)).Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value) || null; } catch {}
    }
    const { data, error } = await sb.from('films')
      .upsert({ ...film, user_id: uid, statut, note: vu && note ? note : null, coup_de_coeur: vu && coeur, note_rt }, { onConflict: 'user_id,tmdb_id' })
      .select('id,tmdb_id,titre,annee,affiche,statut,note,coup_de_coeur').single();
    if (error) throw error;
    if (vu) {
      const { error: e2 } = await sb.from('visionnages').insert({ film_id: data.id, date: date || undefined });
      if (e2) throw e2;
    }
    films = [data, ...films.filter((f) => f.id !== data.id)];
    etape(3, 'C’est ajouté !');
    corps.innerHTML = `<div class="fini"><div><h3>${esc(film.titre)} ${vu ? 'est dans ta collection !' : 'rejoint ta watchlist !'}</h3>
      <div class="boutons"><a class="btn primaire" href="#film/${data.id}" data-fermer style="height:48px">Voir la fiche</a><button class="btn" type="button" data-retour style="height:48px">Ajouter un autre film</button></div></div></div>`;
  } catch (err) {
    const p = $('#erreur-ajout');
    p.textContent = 'Le film n’a pas pu être enregistré : ' + (err.message || err); p.hidden = false;
    bouton.disabled = false;
  }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-ajout]')) ouvrirRecherche();
});
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) return dlg.close(); // clic sur le fond
  const b = e.target.closest('button, a');
  if (!b) return;
  const d = b.dataset;
  if ('fermer' in d) dlg.close();
  else if (d.fiche) { dlg.close(); location.hash = '#film/' + d.fiche; }
  else if (d.id) choisir(d.id);
  else if ('retour' in d) ouvrirRecherche();
  else if ('enregistrer' in d) enregistrer(b);
  else if (d.statut) { saisie.statut = d.statut; afficherDetails(); }
  else if (d.note) { saisie.note = Number(d.note) === saisie.note ? 0 : Number(d.note); afficherDetails(); }
  else if ('coeur' in d) { saisie.coeur = !saisie.coeur; afficherDetails(); }
  else if (d.genre) { const g = saisie.film.genres; saisie.film.genres = g.includes(d.genre) ? g.filter((x) => x !== d.genre) : [...g, d.genre]; afficherDetails(); }
});
dlg.addEventListener('input', (e) => {
  if (e.target.id === 'q') { clearTimeout(chercher.t); chercher.t = setTimeout(() => chercher(e.target.value), 300); }
  if (e.target.id === 'date-vu') saisie.date = e.target.value;
});
dlg.addEventListener('close', () => uid && route());

/* ---------- Connexion ---------- */

$('#form-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#erreur-connexion'), b = $('button', e.target);
  err.hidden = true; b.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#mdp').value });
  b.disabled = false;
  if (error) { err.textContent = error.status === 400 ? 'E-mail ou mot de passe incorrect.' : 'Connexion impossible : ' + error.message; err.hidden = false; }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

async function demarrer() {
  const [r, f] = await Promise.all([
    sb.from('reglages').select('*').maybeSingle(),
    sb.from('films').select('id,tmdb_id,titre,annee,affiche,statut,note,coup_de_coeur').order('ajoute_le', { ascending: false }),
  ]);
  reglages = r.data || {}; films = f.data || [];
  if (reglages.theme) appliquerTheme(reglages.theme);
  $('#connexion').hidden = true; $('#app').hidden = false;
  route();
  if (r.error || f.error) toast('Lecture de la base impossible : ' + (r.error || f.error).message);
}

sb.auth.onAuthStateChange((_evt, session) => {
  const id = session?.user?.id || null;
  if (id === uid && id) return; // simple renouvellement du jeton
  uid = id;
  if (!uid) { if (dlg.open) dlg.close(); $('#app').hidden = true; $('#connexion').hidden = false; return; }
  setTimeout(demarrer, 0); // pas d'appel Supabase dans ce rappel : il bloquerait la session
});
