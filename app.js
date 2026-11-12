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
      <button class="btn primaire grand" type="button" data-ajout>Ajouter un film vu</button></div></section>
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

const PAGES = { accueil: pageAccueil, reglages: pageReglages };

async function route() {
  const hash = location.hash, [nom, id] = (hash.slice(1) || 'accueil').split('/'), page = $('#page');
  const actif = nom === 'film' ? 'collection' : nom;
  document.querySelectorAll('#app a[href^="#"]').forEach((a) => (a.getAttribute('href') === '#' + actif ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (nom !== 'film') {
    page.innerHTML = (PAGES[nom] || (() => `<div class="titre-page"><p class="sur-titre">En construction</p><h1>Cette page arrive bientôt</h1><p class="muted">Elle sera ajoutée dans une prochaine étape du développement.</p></div>`))();
  } else {
    if (page.dataset.vue !== hash) page.innerHTML = '<p class="vide">Chargement de la fiche…</p>';
    let html;
    try { html = await pageFilm(id); } catch (err) { html = `<p class="vide erreur">Fiche introuvable : ${esc(err.message)}</p>`; }
    if (location.hash !== hash) return; // on a changé de page pendant le chargement
    page.innerHTML = html;
  }
  if (page.dataset.vue !== hash) scrollTo(0, 0);
  page.dataset.vue = hash;
}
addEventListener('hashchange', () => uid && route());

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

function tuile(ico, label, valeur, unite, bas, lien) {
  const contenu = `${ico}<div><span class="tuile-label">${label}</span>${valeur == null
    ? '<span class="tuile-vide">Pas encore de note</span>'
    : `<span class="chiffre">${valeur}<small>${unite}</small></span>`}<span class="tuile-bas">${bas}</span></div>`;
  return lien ? `<a class="tuile" href="${lien}" target="_blank" rel="noopener">${contenu}</a>` : `<div class="tuile">${contenu}</div>`;
}

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
      <div class="fiche-genres">${f.genres.map((g) => `<span><img src="${buste(g)}" alt="">${g}</span>`).join('')}</div>
      <h1>${esc(f.titre)}</h1>
      <p class="fiche-meta">${meta}</p>
      <div class="tuiles">
        ${vu ? tuile(ICO_ETOILE, 'Ma note', f.note ? fr(f.note) : null, ' /5', f.note ? `<span aria-hidden="true" class="ma-note">${etoilesTxt(f.note)}</span>` : '') : ''}
        ${tuile(ICO_RT, 'Critiques', f.note_rt, ' %', 'Rotten Tomatoes ↗', `https://www.rottentomatoes.com/search?search=${encodeURIComponent(f.titre_original || f.titre)}`)}
        ${tuile(ICO_TMDB, 'Spectateurs', f.note_tmdb ? fr(Number(f.note_tmdb).toFixed(1)) : null, ' /10', `TMDB${f.votes_tmdb ? ' · ' + f.votes_tmdb.toLocaleString('fr-FR') + ' votes' : ''} ↗`, `https://www.themoviedb.org/movie/${f.tmdb_id}`)}
      </div>
      <div class="fiche-etiquettes">${vu && f.coup_de_coeur ? `<span class="coeur-on">${ICO_COEUR}Coup de cœur</span>` : ''}<span>${vuTxt}</span></div>
      <div class="fiche-actions">
        <button class="btn clair" type="button" data-action="${vu ? 'revu' : 'vu'}">${vu ? 'Je l’ai revu' : 'Je l’ai vu'}</button>
        <button class="btn contour" type="button" data-action="modifier">Modifier</button>
        <button class="btn contour carre" type="button" data-action="supprimer" aria-label="Supprimer le film">${ICO_POUBELLE}</button>
      </div>
    </div>
  </section></div>
  <div class="fiche-corps">
    <div class="fiche-main">
      ${f.synopsis ? `<section><p class="sur-titre">L'histoire</p><h2 class="section">Synopsis</h2><p class="synopsis">${esc(f.synopsis)}</p></section>` : ''}
      ${f.bande_annonce ? `<section><h2 class="section">Bande-annonce</h2><a class="ba" href="https://www.youtube.com/watch?v=${encodeURIComponent(f.bande_annonce)}" target="_blank" rel="noopener" style="background-image:url(https://i.ytimg.com/vi/${encodeURIComponent(f.bande_annonce)}/hqdefault.jpg)">
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="40" fill="#F3EEDD"/><path d="M33 26l23 14-23 14z" fill="#1A2730"/></svg><span>Regarder sur YouTube ↗</span></a></section>` : ''}
      ${f.acteurs.length ? `<section><h2 class="section">Casting</h2><ul class="casting">${f.acteurs.map((a) => `<li>
        <span class="photo">${a.photo ? `<img src="https://image.tmdb.org/t/p/w185${esc(a.photo)}" alt="" loading="lazy">` : esc(a.nom.split(' ').map((p) => p[0]).join('').slice(0, 3))}</span>
        <b>${esc(a.nom)}</b><small>${esc(a.role)}</small></li>`).join('')}</ul></section>` : ''}
    </div>
    <aside class="carte histo"><h2>Mes visionnages</h2>${vu && n ? `<ol>${visions.slice().reverse().map((d, i) => `<li class="${i === 0 ? 'dernier' : ''}">
      <b>${dateLongue(d)}</b><small>${i === n - 1 ? 'Premier visionnage' : 'Revisionnage'}</small></li>`).join('')}</ol>`
      : `<p class="muted">Pas encore vu. Dans ta watchlist depuis le ${dateLongue(f.ajoute_le.slice(0, 10))}.</p>`}</aside>
  </div>`;
}

async function pageFilm(id) {
  const { data: f, error } = await sb.from('films').select('*, visionnages(id,date)').eq('id', id).maybeSingle();
  if (error) throw error;
  fiche = f;
  return f ? htmlFilm(f) : `<div class="titre-page"><p class="sur-titre">Fiche film</p><h1>Ce film n'est plus dans ta collection</h1><a class="btn" href="#accueil" style="align-self:flex-start">Retour à l'accueil</a></div>`;
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
    ${vu ? `<fieldset class="visions"><legend>Mes visionnages</legend>${d.visions.map((v, i) => `<div class="vision">
        <label><span>${i === 0 ? 'Premier' : 'Revu le'}</span><input type="date" data-vision="${i}" value="${v}" max="${aujourdhui()}"></label>
        <button class="btn carre" type="button" data-retirer="${i}" ${d.visions.length <= 1 ? 'disabled' : ''} aria-label="Retirer le visionnage du ${v ? dateLongue(v) : 'jour non renseigné'}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button></div>`).join('')}
      <button class="btn pointille" type="button" data-ajouter-vision>+ Ajouter un visionnage</button></fieldset>` : ''}
  </div>
  <div class="ajout-pied"><p class="erreur" id="erreur-edition" role="alert" hidden></p><span></span>
    <div class="boutons"><button class="btn" type="button" data-fermer>Annuler</button><button class="btn primaire" type="button" data-enregistrer-edition>Enregistrer</button></div></div>`;
}

function majListe(id, patch) {
  const i = films.findIndex((x) => x.id === id);
  if (i >= 0) films[i] = { ...films[i], ...patch };
}

async function enregistrerEdition(b) {
  const d = edition, vu = d.statut === 'vu', err = $('#erreur-edition');
  if (vu && d.visions.some((v) => !v)) { err.textContent = 'Choisis une date pour chaque visionnage.'; err.hidden = false; return; }
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
    <span class="ico-danger" aria-hidden="true">${ICO_POUBELLE}</span>
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

async function ajouterRevisionnage(b) {
  b.disabled = true;
  const { error } = await sb.from('visionnages').insert({ film_id: fiche.id, date: aujourdhui() });
  if (error) { b.disabled = false; return toast('Revisionnage non enregistré : ' + error.message); }
  toast('Revisionnage ajouté pour aujourd’hui.');
  route();
}

$('#page').addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]')?.dataset.action;
  if (a === 'revu') ajouterRevisionnage(e.target.closest('button'));
  else if (a === 'vu') ouvrirEdition(true);
  else if (a === 'modifier') ouvrirEdition(false);
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
    if (d.note) edition.note = Number(d.note) === edition.note ? 0 : Number(d.note);
    else if ('coeur' in d) edition.coeur = !edition.coeur;
    else if (d.genre) edition.genres = edition.genres.includes(d.genre) ? edition.genres.filter((x) => x !== d.genre) : [...edition.genres, d.genre];
    else if (d.retirer) edition.visions.splice(Number(d.retirer), 1);
    else if ('ajouterVision' in d) edition.visions.push(aujourdhui());
    else return;
    afficherEdition();
  }
});
fen.addEventListener('input', (e) => { if (e.target.dataset.vision) edition.visions[Number(e.target.dataset.vision)] = e.target.value; });

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
