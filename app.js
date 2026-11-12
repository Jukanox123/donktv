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

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
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
  if (j.Response !== 'True') throw new Error(r.status === 401 ? 'OMDb refuse cette clé.' : 'OMDb : ' + (j.Error || `erreur ${r.status}`));
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
      <div class="grille">${films.slice(0, 18).map((f) => `<div class="film">
        <span class="affiche">${f.affiche ? `<img src="${AFFICHE}${esc(f.affiche)}" alt="" loading="lazy">` : ''}<span class="badge ${f.statut === 'vu' ? 'vu' : ''}">${f.statut === 'vu' ? 'Vu' : 'À voir'}</span></span>
        <b>${esc(f.titre)}</b><small>${esc(f.annee ?? '')}${f.note ? ` · ${fr(f.note)} / 5` : ''}${f.coup_de_coeur ? ' · coup de cœur' : ''}</small></div>`).join('')}</div>`;
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

function route() {
  const nom = location.hash.slice(1) || 'accueil';
  $('#page').innerHTML = (PAGES[nom] || (() => `<div class="titre-page"><p class="sur-titre">En construction</p><h1>Cette page arrive bientôt</h1><p class="muted">Elle sera ajoutée dans une prochaine étape du développement.</p></div>`))();
  document.querySelectorAll('#app a[href^="#"]').forEach((a) => (a.getAttribute('href') === '#' + nom ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  scrollTo(0, 0);
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
      const bloc = b.closest('.cle'), k = CLES.find((c) => c.champ === bloc.dataset.cle), etat = $('.etat', bloc), v = $('input', bloc).value.trim();
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
      return `<li><button type="button" data-id="${r.id}" ${connu?.statut === 'vu' ? 'disabled' : ''}>${affiche(r.poster_path)}
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
        <div><span class="etiquette" id="note-label">Ta note</span><div class="note"><div class="etoiles" role="radiogroup" aria-labelledby="note-label">${[1, 2, 3, 4, 5].map((i) => `<span class="etoile">
          <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="var(${note >= i ? '--star' : '--star-empty'})"/>${note >= i - 0.5 ? '<path d="M12 2.5v14.8l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="var(--star)"/>' : ''}</svg>
          <button type="button" role="radio" style="left:0" data-note="${i - 0.5}" aria-checked="${note === i - 0.5}" aria-label="${fr(i - 0.5)} sur 5"></button>
          <button type="button" role="radio" style="right:0" data-note="${i}" aria-checked="${note === i}" aria-label="${i} sur 5"></button></span>`).join('')}</div>
          <span class="chiffre">${note ? fr(note) + ' / 5' : 'À noter'}</span></div></div>
        <button class="btn coeur" type="button" data-coeur aria-pressed="${coeur}"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.3-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.7 12 20 12 20z" fill="none" stroke="#D2483B" stroke-width="1.8"/></svg>Coup de cœur</button>
        <label><span class="etiquette">Vu le</span><input type="date" id="date-vu" value="${date}" max="${new Date().toLocaleDateString('sv')}"></label>
      </div>` : '<p class="info">Il rejoindra ta watchlist. Tu pourras le noter le jour où tu le verras.</p>'}
      <fieldset><legend>Genres <span>· pré-remplis par TMDB, modifiables</span></legend><div class="genres">${GENRES.map((g) =>
        `<button type="button" data-genre="${g}" aria-pressed="${f.genres.includes(g)}"><img src="${buste(g)}" alt="">${g}</button>`).join('')}</div></fieldset>
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
      <div class="boutons"><button class="btn primaire" type="button" data-fermer style="height:48px">Terminer</button><button class="btn" type="button" data-retour style="height:48px">Ajouter un autre film</button></div></div></div>`;
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
