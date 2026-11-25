// Plateformes de l'utilisateur, « Qu'est-ce que je regarde ? », pages réalisateur / acteur et sagas.

/* ---------- Réglages : mes plateformes ---------- */

const pfListe = memo(async () => {
  const { results } = await tmdb('/watch/providers/movie', { watch_region: 'FR' });
  return uniques(results.map((p) => ({ ...p, display_priority: p.display_priorities?.FR ?? p.display_priority })));
});
const ICO_RETIRER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M18 6l-12 12 M6 6l12 12"/></svg>';

// Recherche en haut, mes plateformes en dessous : seules celles choisies sont affichées.
async function remplirPlateformes() {
  const zone = $('#pf-choix');
  if (!zone) return;
  if (!sources.tmdb) return (zone.innerHTML = '<p class="muted">Renseigne d’abord ta clé TMDB ci-dessous.</p>');
  zone.innerHTML = `<div class="pf-recherche"><label class="champ champ-recherche">${ICO_LOUPE}<input id="pf-q" type="search" placeholder="Rechercher une plateforme" aria-label="Rechercher une plateforme" autocomplete="off" aria-controls="pf-sugg"></label>
    <ul class="pf-sugg" id="pf-sugg" hidden></ul></div><ul class="pfs pf-choix" id="pf-mes" aria-label="Mes plateformes"></ul>`;
  majMesPlateformes();
}

pageReglages.apres = remplirPlateformes;

async function majMesPlateformes() {
  const l = await pfListe().catch(() => []), mes = reglages.plateformes || [], logo = (n) => l.find((p) => p.nom === n) || { nom: n };
  $('#pf-mes').innerHTML = mes.length ? mes.map((n) => `<li><span class="pf pf-mien">${logoPf(logo(n))}<b>${esc(n)}</b><button type="button" class="pf-retirer" data-pf="${esc(n)}" aria-label="Retirer ${esc(n)}">${ICO_RETIRER}</button></span></li>`).join('')
    : '<li class="muted">Aucune plateforme choisie pour l’instant.</li>';
}

async function suggererPlateformes(q) {
  const ul = $('#pf-sugg'), mes = reglages.plateformes || [];
  let l = [];
  try { l = await pfListe(); } catch (err) { ul.innerHTML = `<li class="muted">${esc(err.message)}</li>`; return (ul.hidden = false); }
  const r = q.trim() ? l.filter((p) => !mes.includes(p.nom) && norm(p.nom).includes(norm(q.trim()))).slice(0, 8) : [];
  ul.innerHTML = r.length ? r.map((p) => `<li><button type="button" data-pf="${esc(p.nom)}">${logoPf(p)}<b>${esc(p.nom)}</b><span class="lien">Ajouter</span></button></li>`).join('') : `<li class="muted">Aucune plateforme ne correspond.</li>`;
  ul.hidden = !q.trim();
}

async function basculerPlateforme(b) {
  const nom = b.dataset.pf, mes = reglages.plateformes || [], avant = [...mes];
  b.disabled = true;
  try {
    await enregistrerReglages({ plateformes: mes.includes(nom) ? mes.filter((x) => x !== nom) : [...mes, nom] });
    const q = $('#pf-q');
    if (b.closest('#pf-sugg')) { q.value = ''; $('#pf-sugg').hidden = true; q.focus(); }
    majMesPlateformes();
  } catch (err) {
    reglages.plateformes = avant;
    b.disabled = false;
    toast(/plateformes/.test(err.message) ? 'La base n’a pas encore la colonne « plateformes » : lance le script du 18 novembre dans Supabase.' : err.message);
  }
}

/* ---------- Qu'est-ce que je regarde ? ---------- */

const ICO_DE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14 M8 8.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0 M15 8.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0 M15 15.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0 M8 15.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0 M11.5 12a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0"/></svg>';
const tg = { duree: '', genre: '', mes: null, films: [], enCours: false, amis: [] };
const DUREES = [['', 'Peu importe'], ['moins', 'Moins de 2 h'], ['plus', 'Plus de 2 h']];

// Par défaut : seulement les films disponibles aujourd'hui sur mes plateformes. Les films pas encore sortis ne peuvent pas être tirés.
const candidats = () => tg.films.filter((f) => !(f.date_sortie_fr > aujourdhui())
  && (!tg.duree || (f.duree && (tg.duree === 'moins' ? f.duree <= 120 : f.duree > 120)))
  && (!tg.genre || f.genres.includes(tg.genre)) && (!tg.mes || (f.plateformes || []).some((p) => aMoi(p.nom))) && enCommunAvec(f, tg.amis));
const melange = (l) => l.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const affichePiste = (f) => `<span class="bobine-item">${f.affiche ? `<img src="${IMG(f.affiche)}" alt="">` : `<b>${esc(f.titre)}</b>`}${bustesHtml(f.genres)}</span>`;
const zoneTirage = () => $('#tirage-zone');

// Section toujours ouverte en bas de la Watchlist : filtres à gauche, tirage à droite (empilés sur mobile).
function tirageHtml() {
  tg.mes ??= !!(reglages.plateformes || []).length;
  tg.amis = tg.amis.filter((id) => av.amis.some((a) => a.ami === id));
  const genres = GENRES.filter((g) => tg.films.some((f) => f.genres.includes(g)));
  if (!genres.includes(tg.genre)) tg.genre = '';
  return `<div class="tirage carte">
    <div class="tirage-filtres">
      ${av.amis.length ? `<div><p class="tirage-lab">En commun avec</p><div class="puces" role="group" aria-label="En commun avec">${av.amis.map((a) => puceAmi(a, 'data-tg-ami', tg.amis.includes(a.ami))).join('')}</div></div>` : ''}
      <div><p class="tirage-lab">Durée</p><div class="bascule" role="group" aria-label="Durée">${DUREES.map(([v, l]) => `<button type="button" data-tg-duree="${v}" aria-pressed="${tg.duree === v}">${l}</button>`).join('')}</div></div>
      ${(reglages.plateformes || []).length ? `<div><p class="tirage-lab">Plateformes</p><button class="btn" type="button" data-tg-mes aria-pressed="${tg.mes}">${ICO_VU}Sur mes plateformes</button></div>` : ''}
      <div><p class="tirage-lab">Genre</p><div class="puces" role="group" aria-label="Genre">${['', ...genres].map((g) => `<button type="button" data-tg-genre="${g}" aria-pressed="${tg.genre === g}">${g ? `<img src="${buste(g)}" alt="">${g}` : 'Tous les genres'}</button>`).join('')}</div></div>
    </div>
    <div class="tirage-droite">
      <div class="bobine"><div class="bobine-piste" id="piste"></div><span class="bobine-cadre" aria-hidden="true"></span></div>
      <p class="muted tirage-compte" id="tg-compte" aria-live="polite"></p>
      <div id="tg-resultat" aria-live="polite"></div>
      <button class="btn primaire grand" type="button" data-tg-lancer>${ICO_DE}Lancer</button>
    </div></div>`;
}

function afficherTirage() {
  const z = zoneTirage();
  if (!z) return;
  tg.films = av.films;
  z.innerHTML = tirageHtml();
  majTirage();
}

function majTirage() {
  const l = candidats(), piste = $('#piste');
  $('#tg-compte').textContent = l.length ? `${pluriel(l.length, 'film possible', 'films possibles')}` : 'Aucun film ne correspond à ces critères.';
  $('[data-tg-lancer]').disabled = !l.length;
  $('#tg-resultat').innerHTML = '';
  piste.classList.remove('arrete');
  piste.style.transform = '';
  // Piste au repos : la boucle d'affiches (ordre tiré une fois), centrée sur un film.
  tg.ordre = melange(l); tg.pos = 0;
  poserPiste(0);
}

// Affiches de la boucle (n° depuis tg.pos - 4), le film tg.pos centré en position 4.
function poserPiste(n) {
  const piste = $('#piste'), o = tg.ordre, L = o.length;
  if (!L) { piste.innerHTML = ''; return; }
  piste.innerHTML = Array.from({ length: n + 10 }, (_, i) => affichePiste(o[(((tg.pos - 4 + i) % L) + L) % L])).join('');
  piste.style.transform = `translateX(${decalage(piste, 4)}px)`;
}

// Décalage qui place l'affiche n° i au centre de la bobine.
function decalage(piste, i) {
  const it = piste.children[0], pas = it.offsetWidth + parseFloat(getComputedStyle(piste).columnGap || 0);
  return piste.parentElement.clientWidth / 2 - it.offsetWidth / 2 - i * pas;
}

function lancerTirage() {
  const l = candidats();
  if (!l.length || tg.enCours) return;
  tg.enCours = true;
  const piste = $('#piste'), bouton = $('[data-tg-lancer]'), o = tg.ordre, L = o.length;
  const elu = o[Math.floor(Math.random() * L)];
  // Toujours de gauche à droite : on repart du film affiché et on fait plusieurs tours de boucle jusqu'à l'élu.
  let pas0 = (o.indexOf(elu) - tg.pos + L) % L;
  while (pas0 < 40) pas0 += L;
  const fin = 4 + pas0;
  piste.classList.remove('arrete');
  $('#tg-resultat').innerHTML = '';
  poserPiste(pas0);
  zoneTirage().querySelectorAll('button').forEach((x) => (x.disabled = true));
  const depart = decalage(piste, 4), arrivee = decalage(piste, fin);
  const duree = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 3800, t0 = performance.now(), items = [...piste.children];
  let centre = -1;
  const pas = (t) => {
    const k = duree ? Math.min(1, (t - t0) / duree) : 1, e = 1 - Math.pow(1 - k, 4); // ralentit comme une roue qui s'arrête
    const x = depart + (arrivee - depart) * e;
    piste.style.transform = `translateX(${x}px)`;
    const c = Math.round((decalage(piste, 0) - x) / (items[0].offsetWidth + parseFloat(getComputedStyle(piste).columnGap || 0)));
    if (c !== centre) { items[centre]?.classList.remove('centre'); items[c]?.classList.add('centre'); centre = c; }
    if (k < 1) return requestAnimationFrame(pas);
    items[centre]?.classList.remove('centre'); items[fin].classList.add('centre', 'elu');
    tg.pos = o.indexOf(elu);
    setTimeout(() => {
      piste.classList.add('arrete');
      afficherElu(elu);
      zoneTirage().querySelectorAll('button').forEach((x) => (x.disabled = false));
      bouton.disabled = false; bouton.innerHTML = ICO_DE + 'Relancer';
      tg.enCours = false;
    }, duree ? 300 : 0);
  };
  requestAnimationFrame(pas);
}

function afficherElu(f) {
  const pf = (f.plateformes || []).filter((p) => aMoi(p.nom));
  $('#tg-resultat').innerHTML = `<div class="tirage-elu"><p class="sur-titre">Baudet a choisi</p>
    <h3>${esc(f.titre)}</h3><p class="muted">${[f.annee, duree(f.duree), f.genres.join(', ')].filter(Boolean).join(' · ')}</p>
    ${pf.length ? `<p class="tirage-pf">${pf.map((p) => `<span>${logoPf(p)}${esc(p.nom)}</span>`).join('')}</p>` : ''}
    <a class="btn" href="#film/${f.id}">Voir la fiche</a></div>`;
}

/* ---------- Pages réalisateur et acteur ---------- */

const personneTmdb = memo((id) => tmdb(`/person/${id}`, { append_to_response: 'movie_credits' }));
const pers = { id: null, page: 1 };
const ICO_RETOUR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6"/></svg>';
const retour = (label) => `<button class="retour" type="button" data-retour>${ICO_RETOUR}${label}</button>`;
const sansCle = () => videMascotte('Clé TMDB manquante', 'Cette page se remplit avec TMDB : renseigne ta clé dans les Réglages.', '<a class="btn primaire" href="#reglages">Ouvrir les réglages</a>');

// Genres de l'app d'un film TMDB (sans doublon).
const genresTmdb = (c) => [...new Set((c.genre_ids || []).map((g) => GENRE_TMDB[g]).filter(Boolean))];

// Carte d'un film qui n'est pas (encore) dans ma base.
// L'affiche mène à la fiche du film (sans note ni visionnage) ; « Vu » ouvre l'ajout avec la note.
const carteTmdb = (c) => {
  const futur = c.release_date > aujourdhui();
  return `<div class="carte-film carte-tmdb"><a class="poster" href="#decouverte/${c.id}" aria-label="${esc(c.title)}">${c.poster_path ? `<img src="${IMG(c.poster_path)}" alt="" loading="lazy">` : maison(c.title)}${bustesHtml(genresTmdb(c))}</a>
  <a href="#decouverte/${c.id}" tabindex="-1"><b>${esc(c.title)}</b></a><span class="carte-bas"><span>${futur ? 'Sort le ' + dateCourte(c.release_date) : (c.release_date || '').slice(0, 4)}</span></span>
  <div class="carte-actions"><button class="btn" type="button" data-rr-avoir="${c.id}">+ Watchlist</button>${futur ? '' : `<button class="btn" type="button" data-tmdb-vu="${c.id}" aria-label="${esc(c.title)} : je l’ai vu">${ICO_VU}Je l’ai vu</button>`}</div></div>`;
};
const grille = (l) => `<div class="grille-films">${l.join('')}</div>`;

async function pagePersonne(p) {
  if (!sources.tmdb) return sansCle();
  let id = p;
  if (!/^\d+$/.test(p)) {
    const nom = decodeURIComponent(p), r = await tmdb('/search/person', { query: nom });
    id = (r.results?.find((x) => x.name === nom) || r.results?.[0])?.id;
    if (!id) return videMascotte('Personne introuvable', `TMDB ne connaît personne qui s’appelle « ${esc(nom)} ».`, retour('Retour'));
  }
  if (pers.id !== id) Object.assign(pers, { id, page: 1 });
  const [d, F] = await Promise.all([personneTmdb(id), chargerFilms()]);
  const real = d.known_for_department === 'Directing', femme = d.gender === 1;
  const credits = [...new Map((real ? d.movie_credits.crew.filter((c) => c.job === 'Director') : d.movie_credits.cast).map((c) => [c.id, c])).values()];
  const mien = new Map(F.map((f) => [f.tmdb_id, f]));
  const miens = credits.map((c) => mien.get(c.id)).filter(Boolean), vus = miens.filter((f) => f.statut === 'vu').sort(parDernier), aVoir = miens.filter((f) => f.statut === 'a_voir');
  const reste = credits.filter((c) => !mien.has(c.id) && !(c.genre_ids || []).includes(99)).sort((a, b) => b.vote_count - a.vote_count);
  const notes = vus.filter((f) => f.note).map((f) => f.note), coeurs = vus.filter((f) => f.coup_de_coeur).length;
  const metier = real ? (femme ? 'Réalisatrice' : 'Réalisateur') : femme ? 'Actrice' : 'Acteur';
  const kpis = [[vus.length, vus.length > 1 ? 'films vus' : 'film vu'], [notes.length ? `${fr1(moyenne(notes))}<small>/5</small>` : '–', 'ma note moyenne'], [coeurs, coeurs > 1 ? 'coups de cœur' : 'coup de cœur'],
    [`${vus.length}<small>/${credits.length}</small>`, real ? 'de ses films réalisés' : 'de sa filmographie']];
  const { p: pg, nbPages, items: montres } = decouper(reste, pers.page, mobile() ? 9 : 10);
  pers.page = pg;
  return `${retour('Retour')}
  <section class="personne-tete"><span class="personne-photo">${d.profile_path ? `<img src="${IMG(d.profile_path)}" alt="Portrait de ${esc(d.name)} (TMDB)">` : esc(d.name.split(' ').map((x) => x[0]).join('').slice(0, 2))}</span>
    <div><p class="sur-titre">${metier}</p><h1>${esc(d.name)}</h1></div>
      <div class="kpis personne-kpis">${kpis.map(([v, l]) => `<div class="kpi"><span class="chiffre">${v}</span><span class="muted">${l}</span></div>`).join('')}</div></section>
  <section class="bloc"><h2 class="section">Mes films vus</h2>
    ${vus.length ? grille(vus.map((f) => carteFilm(f, noteBas(f)))) : '<p class="muted">Aucun film vu pour l’instant.</p>'}</section>
  ${aVoir.length ? `<section class="bloc"><h2 class="section">Films dans ma watchlist</h2>${grille(aVoir.map((f) => carteFilm(f, `<span>${f.annee ?? ''}</span>`)))}</section>` : ''}
  ${reste.length ? `<section class="bloc" id="a-decouvrir"><h2 class="section">Films à découvrir</h2>${grille(montres.map(carteTmdb))}${paginationHtml(pg, nbPages, 'data-pers-page')}</section>` : ''}`;
}

/* ---------- Sagas ---------- */

const FL = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// Garde les phrases entières qui tiennent dans n caractères (au moins la première).
const couper = (t, n) => {
  const phrases = t.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || [t];
  let r = phrases[0];
  for (const ph of phrases.slice(1)) { if ((r + ph).length > n) break; r += ph; }
  return r.trim();
};
const ICO_VU = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>';

// Jauge ronde : « 2/4 » au centre.
function jaugeRonde(vus, total) {
  const r = 52, c = 2 * Math.PI * r, part = total ? vus / total : 0;
  return `<div class="jauge-ronde" role="img" aria-label="${vus} films vus sur ${total}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="fond"/>
    <circle cx="60" cy="60" r="${r}" class="part" stroke-dasharray="${c * part} ${c}" transform="rotate(-90 60 60)"/></svg>
    <span><b>${vus}<small>/${total}</small></b><small>${vus > 1 ? 'films vus' : 'film vu'}</small></span></div>`;
}

// Saga : titre, résumé court et jauge ronde, puis une frise d'affiches dans l'ordre de sortie.
async function pageSaga(id) {
  if (!sources.tmdb) return sansCle();
  const [c, F] = await Promise.all([collection(id), chargerFilms()]);
  const mien = new Map(F.map((f) => [f.tmdb_id, f])), parts = [...c.parts].sort((a, b) => (a.release_date || '9999').localeCompare(b.release_date || '9999'));
  const l = sortis(parts), vus = l.filter((p) => mien.get(p.id)?.statut === 'vu').length;
  const item = (p) => {
    const f = mien.get(p.id), vu = f?.statut === 'vu';
    const carte = !f ? carteTmdb(p) : vu ? carteFilm(f, noteBas(f)) : `${carteFilm(f, `<span>${f.annee ?? ''}</span>`)}
      <button class="btn" type="button" data-marquer-vu="${f.id}" aria-label="${esc(f.titre)} : je l’ai vu">${ICO_VU}<span>Je l’ai vu</span></button>`;
    return `<li class="frise-item${vu ? '' : ' pas-vu'}"><span class="frise-annee">${(p.release_date || '').slice(0, 4) || 'À venir'}</span><span class="frise-point${vu ? ' vu' : ''}" aria-hidden="true"></span>${carte}</li>`;
  };
  return `<a class="retour" href="#sagas">${ICO_RETOUR}Mes sagas</a>
  <section class="saga-tete"><div class="saga-titre"><p class="sur-titre">Saga</p><h1>${esc(nomSaga(c.name))}</h1></div>
    ${jaugeRonde(vus, l.length)}
    ${c.overview ? `<p class="saga-resume muted">${esc(couper(c.overview, 480))}</p>` : ''}</section>
  <section class="bloc"><div class="section-tete"><div><h2 class="section">Dans l’ordre de sortie</h2></div>
      <div class="frise-fleches"><button class="btn carre" type="button" data-frise="-1" aria-label="Films précédents">${FL('M15 6l-6 6l6 6')}</button><button class="btn carre" type="button" data-frise="1" aria-label="Films suivants">${FL('M9 6l6 6l-6 6')}</button></div></div>
    <ol class="frise">${parts.map(item).join('')}</ol>
    <p class="frise-legende muted"><span><i class="frise-point vu"></i>Vu</span><span><i class="frise-point"></i>Pas encore vu</span></p></section>`;
}

async function pageSagas() {
  const F = await chargerFilms(), ids = [...new Set(F.filter((f) => f.saga_id && f.statut === 'vu').map((f) => f.saga_id))];
  const titre = '<div class="titre-page"><h1>Mes sagas</h1></div>';
  if (!ids.length) return titre + videMascotte('Aucune saga pour l’instant', 'Dès qu’un film que tu as vu fait partie d’une saga (Star Wars, Harry Potter…), elle apparaît ici. Les films déjà ajoutés sont vérifiés au fil des démarrages.', '<a class="btn primaire" href="#collection">Voir mes films</a>');
  if (!sources.tmdb) return titre + sansCle();
  const vusIds = new Set(F.filter((f) => f.statut === 'vu').map((f) => f.tmdb_id));
  const sagas = (await Promise.allSettled(ids.map(collection))).filter((r) => r.status === 'fulfilled').map(({ value: c }) => {
    const l = sortis(c.parts), vus = l.filter((p) => vusIds.has(p.id)).length;
    return { c, n: l.length, vus };
  }).filter((x) => x.n).sort((a, b) => (a.vus === a.n) - (b.vus === b.n) || b.vus / b.n - a.vus / a.n);
  return `${titre}<ul class="sagas">${sagas.map(({ c, n, vus }) => `<li><a class="carte" href="#saga/${c.id}">
    <span class="saga-img">${c.backdrop_path ? `<img src="${IMG(c.backdrop_path, 500)}" alt="" loading="lazy">` : ''}</span>
    <span class="saga-txt"><b>${esc(nomSaga(c.name))}</b><small>${vus === n ? 'Terminée · ' : ''}${vus} sur ${n} vus</small><span class="jauge" aria-hidden="true"><span style="width:${(vus / n) * 100}%"></span></span></span></a></li>`).join('')}</ul>`;
}

/* ---------- Branchements ---------- */

PAGES['a-voir'] && (PAGES['a-voir'].apres = afficherTirage);
Object.assign(PAGES, { personne: (p) => pagePersonne(p), saga: (id) => pageSaga(id), sagas: () => pageSagas() });
// Flèches de la frise seulement si elle dépasse de l'écran.
PAGES.saga.apres = () => { const f = $('.frise'); if (f) $('.frise-fleches').style.display = f.scrollWidth > f.clientWidth + 2 ? '' : 'none'; };

$('#page').addEventListener('click', (e) => {
  if (!e.target.closest('.pf-recherche') && $('#pf-sugg')) $('#pf-sugg').hidden = true;
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.pf) basculerPlateforme(b);
  else if (d.tgDuree != null) { tg.duree = d.tgDuree; b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); majTirage(); }
  else if (d.tgGenre != null) { tg.genre = d.tgGenre; b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); majTirage(); }
  else if (d.tgAmi) { tg.amis = tg.amis.includes(d.tgAmi) ? tg.amis.filter((x) => x !== d.tgAmi) : [...tg.amis, d.tgAmi]; b.setAttribute('aria-pressed', tg.amis.includes(d.tgAmi)); majTirage(); }
  else if ('tgMes' in d) { tg.mes = !tg.mes; b.setAttribute('aria-pressed', tg.mes); majTirage(); }
  else if ('tgLancer' in d) lancerTirage();
  else if (d.frise) { const f = $('.frise'); f.scrollBy({ left: Number(d.frise) * f.clientWidth * 0.8, behavior: 'smooth' }); }
  else if (d.persPage) { pers.page = Number(d.persPage); route().then(() => $('#a-decouvrir')?.scrollIntoView({ block: 'start' })); }
  else if (d.tmdbVu) { ouvrirRecherche(); choisir(d.tmdbVu); }
  else if ('retour' in d) history.length > 1 ? history.back() : (location.hash = '#accueil');
  else if (d.rrAvoir) ajouterAVoirRapide(d.rrAvoir, b);
});
$('#page').addEventListener('input', (e) => { if (e.target.id === 'pf-q') suggererPlateformes(e.target.value); });

