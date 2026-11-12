// Pages chargées après app.js : À voir, genres, Mes tops, statistiques, rétrospectives, accueil complet,
// recherche rapide, Mon espace et installation. Les fonctions et constantes d'app.js sont partagées.

/* ---------- Outils communs ---------- */

const mobile = () => matchMedia('(max-width: 760px)').matches;
const ICO_TROPHEE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>';
const ICO_LOUPE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const ICO_FLECHE_D = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const iso = (d) => d.toLocaleDateString('sv');
const ajoutJours = (isoDate, n) => { const d = new Date(isoDate + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
const joursEntre = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const majuscule = (s) => s.replace(/^./, (c) => c.toUpperCase());
const moyenne = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
const fr1 = (n) => fr(Math.round(n * 10) / 10);
const slugGenre = (g) => norm(g);
const genreDeSlug = (s) => GENRES.find((g) => slugGenre(g) === s);

function ilYa(isoDate) {
  const n = joursEntre(isoDate, aujourdhui());
  if (n <= 0) return 'aujourd’hui';
  if (n === 1) return 'hier';
  if (n < 7) return `il y a ${n} j`;
  if (n < 30) return `il y a ${Math.floor(n / 7)} sem.`;
  if (n < 60) return 'le mois dernier';
  if (n < 365) return `il y a ${Math.floor(n / 30)} mois`;
  return `il y a ${pluriel(Math.floor(n / 365), 'an')}`;
}

// Tous les films avec leurs dates de visionnage triées.
async function chargerFilms() {
  const { data, error } = await sb.from('films').select('id,tmdb_id,titre,titre_original,annee,date_sortie_fr,affiche,genres,realisateurs,acteurs,duree,pays,statut,note,coup_de_coeur,ajoute_le,visionnages(date)');
  if (error) throw error;
  return data.map((f) => ({ ...f, note: f.note == null ? null : Number(f.note), visions: f.visionnages.map((v) => v.date).sort(), ajout: f.ajoute_le.slice(0, 10),
    cherche: norm([f.titre, f.titre_original, ...f.realisateurs, ...f.acteurs.map((a) => a.nom)].join(' ')) }));
}

const bustesHtml = (g) => `<span class="bustes">${g.slice(0, 2).map((x) => `<span title="${x}" role="img" aria-label="Genre : ${x}"><img src="${buste(x)}" alt=""></span>`).join('')}${g.length > 2 ? `<span class="plus" title="${g.slice(2).join(', ')}">+${g.length - 2}</span>` : ''}</span>`;
const posterHtml = (f, badge = '') => `<span class="poster">${f.affiche ? `<img src="${AFFICHE}${esc(f.affiche)}" alt="" loading="lazy">` : ''}${badge}${f.statut === 'vu' && f.coup_de_coeur ? ICO_COEUR_CARTE : ''}${bustesHtml(f.genres)}</span>`;
const badgeStatut = (f) => `<span class="badge ${f.statut === 'vu' ? 'vu' : ''}">${f.statut === 'vu' ? 'Vu' : 'À voir'}</span>`;
const carteFilm = (f, bas, badge = '') => `<a class="carte-film" href="#film/${f.id}" aria-label="${esc(f.titre)}${f.annee ? ', ' + f.annee : ''}">${posterHtml(f, badge)}<b>${esc(f.titre)}</b><span class="carte-bas">${bas}</span></a>`;
const noteBas = (f) => `<span>${f.annee ?? ''}</span><strong>${f.statut !== 'vu' ? 'À voir' : f.note ? '★ ' + fr(f.note) : 'À noter'}</strong>`;

function paginationHtml(p, nbPages, attr) {
  if (nbPages <= 1) return '';
  const numeros = [...new Set([1, p - 1, p, p + 1, nbPages])].filter((x) => x >= 1 && x <= nbPages).sort((a, b) => a - b);
  return `<nav class="pagination" aria-label="Pagination">
    <button class="btn" type="button" ${attr}="${p - 1}" ${p === 1 ? 'disabled' : ''} aria-label="Page précédente">${FLECHE('g')}<span class="long">Précédent</span></button>
    ${numeros.map((x, i) => `${i && x - numeros[i - 1] > 1 ? '<span class="muted">…</span>' : ''}<button class="btn carre" type="button" ${attr}="${x}" aria-label="Page ${x}" ${x === p ? 'aria-current="page"' : ''}>${x}</button>`).join('')}
    <button class="btn" type="button" ${attr}="${p + 1}" ${p === nbPages ? 'disabled' : ''} aria-label="Page suivante"><span class="long">Suivant</span>${FLECHE('d')}</button></nav>`;
}

// Liste filtrée + paginée, partagée par À voir et les pages de genre.
function decouper(liste, page, parPage) {
  const nbPages = Math.max(1, Math.ceil(liste.length / parPage)), p = Math.min(page, nbPages), debut = (p - 1) * parPage;
  const compteur = nbPages > 1 ? `Films ${debut + 1} à ${Math.min(debut + parPage, liste.length)} sur ${liste.length}` : pluriel(liste.length, 'film');
  return { p, nbPages, items: liste.slice(debut, debut + parPage), compteur };
}

const champRecherche = (id, valeur, label) => `<label class="champ champ-recherche">${ICO_LOUPE}<input id="${id}" type="search" placeholder="Titre, réalisateur, acteur…" aria-label="${label}" value="${esc(valeur)}" autocomplete="off"></label>`;
const champTri = (id, options, valeur) => `<label class="champ"><span>Trier par</span><select id="${id}" data-menu>${options.map(([v, l]) => `<option value="${v}" ${v === valeur ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const videMascotte = (titre, texte, bouton) => `<div class="vide-mascotte"><img src="img/mascotte.png" alt="Baudet, la mascotte de DonkTV"><div><h2>${titre}</h2><p class="muted">${texte}</p>${bouton}</div></div>`;

const TRIS_TEXTE = { titre: (a, b) => a.titre.localeCompare(b.titre, 'fr') };
const parDernier = (a, b) => (b.visions.at(-1) || b.ajout).localeCompare(a.visions.at(-1) || a.ajout);

/* ---------- À voir ---------- */

const av = { q: '', tri: 'ajout', genre: '', page: 1, films: [], vus: [] };

async function pageAVoir() {
  av.films = (await chargerFilms()).filter((f) => f.statut === 'a_voir');
  av.vus = [];
  const n = av.films.length;
  return `<div class="coll-tete avoir-tete"><div class="titre-page"><p class="sur-titre">À voir</p><h1>Watchlist</h1></div>
    <p class="muted"><strong>${n}</strong> ${n > 1 ? 'films à voir' : 'film à voir'}</p></div>
  ${n ? `<div class="filtres"><div class="filtres-ligne">${champRecherche('av-q', av.q, 'Rechercher dans la watchlist')}
      ${champTri('av-tri', [['ajout', 'Date d’ajout'], ['genre', 'Genre'], ['annee', 'Année de sortie'], ['duree', 'Durée'], ['titre', 'Titre']], av.tri)}</div>
    <div class="puces" role="group" aria-label="Filtrer par genre">${['', ...GENRES].map((g) => {
      const c = g ? av.films.filter((f) => f.genres.includes(g)).length : n;
      if (!c && av.genre !== g) return ''; // un genre absent de la watchlist ne filtrerait rien
      return `<button type="button" data-av-genre="${g}" aria-pressed="${av.genre === g}">${g ? `<img src="${buste(g)}" alt="">${g}` : 'Tous les genres'}<small>${c}</small></button>`;
    }).join('')}</div></div>` : ''}
  <div id="av-resultats">${htmlAVoir()}</div>`;
}

function htmlAVoir() {
  const restants = av.films.filter((f) => !av.vus.includes(f.id));
  if (!restants.length) return videMascotte('Watchlist vide !', 'Tu as tout vu. Baudet attend tes prochaines envies de cinéma.', '<button class="btn primaire" type="button" data-ajout>Ajouter un film à voir</button>');
  const q = norm(av.q.trim());
  const tri = { ajout: (a, b) => b.ajoute_le.localeCompare(a.ajoute_le), genre: (a, b) => (a.genres[0] || '￿').localeCompare(b.genres[0] || '￿', 'fr'),
    annee: (a, b) => (b.annee ?? 0) - (a.annee ?? 0), duree: (a, b) => (a.duree ?? 1e9) - (b.duree ?? 1e9), ...TRIS_TEXTE }[av.tri];
  const l = restants.filter((f) => (!av.genre || f.genres.includes(av.genre)) && (!q || f.cherche.includes(q))).sort(tri);
  if (!l.length) return videMascotte('Aucun film trouvé', 'Baudet a fouillé partout, rien ne correspond à ces filtres.', '<button class="btn primaire" type="button" data-av-reset>Réinitialiser les filtres</button>');
  const { p, nbPages, items, compteur } = decouper(l, av.page, mobile() ? 12 : 10);
  av.page = p;
  return `<p class="muted compteur" aria-live="polite">${compteur}</p>
  <div class="grille-films grille-avoir">${items.map((f) => `<div class="carte-avoir">
    <a href="#film/${f.id}" tabindex="-1" aria-hidden="true">${posterHtml(f, '<span class="badge">À voir</span>')}</a>
    <div class="carte-avoir-texte"><a href="#film/${f.id}"><b>${esc(f.titre)}</b></a><small>${f.annee ?? ''}${f.annee ? ' · ' : ''}ajouté ${ilYa(f.ajout)}</small></div>
    <button class="btn" type="button" data-marquer-vu="${f.id}" aria-label="Marquer ${esc(f.titre)} comme vu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg><span>Marquer comme vu</span></button>
  </div>`).join('')}</div>${paginationHtml(p, nbPages, 'data-av-page')}`;
}

async function marquerVu(id, b) {
  const f = av.films.find((x) => x.id === id);
  b.disabled = true;
  const { error } = await sb.from('films').update({ statut: 'vu' }).eq('id', id);
  const e2 = error || (await sb.from('visionnages').insert({ film_id: id, date: aujourdhui() })).error;
  if (e2) { b.disabled = false; return toast('Impossible de marquer le film comme vu : ' + e2.message); }
  av.vus.push(id);
  majListe(id, { statut: 'vu' });
  $('#av-resultats').innerHTML = htmlAVoir();
  toast(`${f.titre} est passé dans tes films vus.`, { label: 'Le noter', fn: () => { location.hash = '#film/' + id; } });
}

/* ---------- Pages de genre ---------- */

// Couleurs et textes du bandeau de chaque genre, repris des maquettes.
const GENRE_INFO = {
  Western: ['#F1C98E', '#3A2414', '#6A4528', 'rgba(255,253,247,.72)', '255,244,222', 'Poussière, duels au soleil et grands espaces. Baudet a sorti son chapeau.', 'Tes westerns', 'Baudet en cowboy, lasso à la main, dans le désert devant un saloon'],
  Thriller: ['#4A5A6E', '#F1ECDF', '#C9D3DC', 'rgba(20,28,38,.55)', '18,26,36', 'Ruelles mouillées, indices et suspense. Baudet a sorti sa loupe.', 'Tes thrillers', 'Baudet en détective, loupe à la main, dans une rue pluvieuse la nuit'],
  Drame: ['#8A6A4E', '#F6EEE2', '#E2D3C2', 'rgba(40,28,20,.5)', '38,26,18', 'Larmes, pluie d’automne et grandes émotions. Baudet a sorti son mouchoir.', 'Tes drames', 'Baudet en larmes, un mouchoir à la main, assis près d’une fenêtre sous la pluie d’automne'],
  SF: ['#B7A9DA', '#24204A', '#4A4473', 'rgba(250,248,255,.76)', '238,232,250', 'Étoiles, planètes lointaines et voyages dans le temps. Baudet a enfilé son scaphandre.', 'Tes films de SF', 'Baudet en astronaute qui fait coucou sur une planète violette, devant une planète à anneaux et une fusée'],
  Horreur: ['#3E4A4A', '#EEF0EA', '#C3CBC4', 'rgba(16,22,22,.55)', '14,20,20', 'Brume, craquements et manoirs abandonnés. Baudet a allumé sa lampe torche.', 'Tes films d’horreur', 'Baudet inquiet, lampe torche à la main, dans une forêt brumeuse la nuit devant un vieux manoir'],
  Comédie: ['#B24A3A', '#FFF6E8', '#F6D9C2', 'rgba(60,16,12,.5)', '70,18,14', 'Fous rires, quiproquos et confettis. Baudet a sorti son nez rouge.', 'Tes comédies', 'Baudet en clown qui jongle en riant sur une scène de cirque, entre des rideaux rouges et des confettis'],
  Romantique: ['#F2C6CC', '#4A1F2A', '#7A3E4A', 'rgba(255,248,248,.74)', '255,240,242', 'Bouquets de fleurs, lettres d’amour et couchers de soleil. Baudet a sorti sa plus belle rose.', 'Tes films romantiques', 'Baudet en pull et écharpe rose, une rose et une lettre d’amour à la main, dans un jardin fleuri au coucher du soleil'],
  Action: ['#E8A07A', '#2A1410', '#5A2E22', 'rgba(255,246,238,.72)', '255,236,222', 'Courses-poursuites, cascades et explosions au ralenti. Baudet a sorti ses lunettes noires.', 'Tes films d’action', 'Baudet en blouson de cuir, bandeau rouge et lunettes de soleil, sautant d’un toit à l’autre au coucher du soleil'],
  Animation: ['#BFDDE2', '#1E3A40', '#3E5E64', 'rgba(250,255,255,.74)', '238,248,250', 'Crayons, pinceaux et mondes dessinés à la main. Baudet a enfilé sa blouse d’artiste.', 'Tes films d’animation', 'Baudet en béret rouge et blouse tachée de peinture, palette à la main, devant son chevalet dans un atelier ensoleillé'],
  Aventure: ['#A9CFA0', '#1E3A22', '#3E5E40', 'rgba(250,255,246,.72)', '236,248,230', 'Cartes au trésor, temples oubliés et jungles à perte de vue. Baudet a sorti son casque d’explorateur.', 'Tes films d’aventure', 'Baudet en explorateur, casque colonial et carte au trésor à la main, devant un temple en ruine dans la jungle'],
  Guerre: ['#C9C2B2', '#2A2A1E', '#545240', 'rgba(250,248,240,.72)', '240,236,226', 'Brume de l’aube, tranchées et héros ordinaires. Baudet a enfilé son casque et sorti ses jumelles.', 'Tes films de guerre', 'Baudet en uniforme kaki et casque, jumelles à la main, devant un campement militaire dans la brume de l’aube'],
};

const gp = { genre: null, q: '', tri: 'date', page: 1, films: [] };

async function pageGenre(s) {
  const g = genreDeSlug(s) || GENRES[0];
  if (gp.genre !== g) Object.assign(gp, { genre: g, q: '', tri: 'date', page: 1 });
  gp.films = (await chargerFilms()).filter((f) => f.genres.includes(g));
  const vus = gp.films.filter((f) => f.statut === 'vu');
  const [bg, texte, attenue, kpiBg, voile, accroche, filmsTitre, alt] = GENRE_INFO[g];
  const notes = vus.filter((f) => f.note).map((f) => f.note);
  const minutes = vus.reduce((s2, f) => s2 + (f.duree || 0) * Math.max(1, f.visions.length), 0);
  const nbCoeurs = vus.filter((f) => f.coup_de_coeur).length;
  const kpis = [[vus.length, vus.length > 1 ? 'films vus' : 'film vu'], [notes.length ? fr1(moyenne(notes)) : '–', 'note moyenne'],
    [Math.round(minutes / 60) + ' h', 'devant l’écran'], [nbCoeurs, nbCoeurs > 1 ? 'coups de cœur' : 'coup de cœur']];
  return `<nav class="puces genres-nav" aria-label="Autres genres">${GENRES.map((x) => `<a href="#genre/${slugGenre(x)}" ${x === g ? 'aria-current="page"' : ''}><img src="${buste(x)}" alt="">${x}</a>`).join('')}</nav>
  <section class="genre-hero" style="--g-bg:${bg};--g-texte:${texte};--g-attenue:${attenue};--g-kpi:${kpiBg};--g-voile:${voile}">
    <picture><source media="(max-width: 760px)" srcset="img/decor-${slugGenre(g)}.jpg"><img src="img/genre-${slugGenre(g)}.jpg" alt="${alt}"></picture>
    <div class="genre-hero-texte"><p class="sur-titre">Genre</p><h1>${g}</h1><p>${accroche}</p>
      ${vus.length ? `<div class="genre-kpis">${kpis.map(([v, l]) => `<div><span class="chiffre">${v}</span><span>${l}</span></div>`).join('')}</div>` : ''}</div>
  </section>
  <section class="genre-films"><h2 class="section">${filmsTitre}</h2>
    ${vus.length ? `<div class="filtres-ligne">${champRecherche('genre-q', gp.q, 'Rechercher dans ce genre')}${champTri('genre-tri', [['date', 'Date de visionnage'], ['note', 'Note'], ['annee', 'Année de sortie'], ['titre', 'Titre']], gp.tri)}</div>
      <div id="genre-resultats">${htmlGenre()}</div>`
    : `<div class="genre-vide"><img src="${buste(g)}" alt=""><h3>Aucun film vu dans ce genre pour l’instant</h3><p class="muted">Ajoute ton premier film : il apparaîtra ici avec ta note.</p>
      <div class="boutons"><button class="btn primaire" type="button" data-ajout>Ajouter un film</button><a class="btn" href="#a-voir">Voir ma watchlist</a></div></div>`}
  </section>`;
}

function htmlGenre() {
  const q = norm(gp.q.trim());
  const tri = { date: parDernier, note: (a, b) => (b.note ?? -1) - (a.note ?? -1), annee: (a, b) => (b.annee ?? 0) - (a.annee ?? 0), ...TRIS_TEXTE }[gp.tri];
  // Les films vus d'abord, puis la watchlist du genre.
  const l = gp.films.filter((f) => !q || f.cherche.includes(q)).sort((a, b) => (a.statut === 'vu' ? 0 : 1) - (b.statut === 'vu' ? 0 : 1) || tri(a, b));
  if (!l.length) return `<div class="genre-vide" role="status">${ICO_LOUPE}<h3>Aucun film trouvé</h3><p class="muted">Rien ne correspond à « ${esc(gp.q)} » dans ce genre.</p>
    <div class="boutons"><button class="btn" type="button" data-genre-reset>Effacer la recherche</button><button class="btn primaire" type="button" data-ajout>Ajouter un film</button></div></div>`;
  const { p, nbPages, items, compteur } = decouper(l, gp.page, mobile() ? 9 : 10);
  gp.page = p;
  return `<p class="muted compteur" aria-live="polite">${compteur}</p><div class="grille-films">${items.map((f) => carteFilm(f, noteBas(f), badgeStatut(f))).join('')}</div>${paginationHtml(p, nbPages, 'data-genre-page')}`;
}

/* ---------- Mes tops ---------- */

const tp = { liste: 'tous', rows: [], films: [] };
const tailleTop = (l) => (l === 'tous' ? 10 : 5);
const nomTop = (l) => (l === 'tous' ? 'Top 10 de tous les temps' : 'Top 5 ' + l);
const topDe = (l) => tp.rows.filter((r) => r.liste === l).sort((a, b) => a.position - b.position);

function libelleTops(tops = []) {
  const tous = tops.find((t) => t.liste === 'tous');
  return tous ? `N°${tous.position} de mes tops` : tops.length ? `Dans ${pluriel(tops.length, 'top')}` : 'Ajouter à mes tops';
}

async function chargerTops() {
  const { data, error } = await sb.from('tops').select('liste,position,film_id,films(titre)');
  if (error) throw error;
  tp.rows = data;
}

// Remplace tout un classement. Sans transaction côté navigateur : si l'écriture échoue, on remet l'ancien.
async function enregistrerTop(liste, ids) {
  const anciens = topDe(liste).map(({ position, film_id }) => ({ liste, position, film_id }));
  const nouveaux = ids.slice(0, tailleTop(liste)).map((film_id, i) => ({ liste, position: i + 1, film_id }));
  const { error: e1 } = await sb.from('tops').delete().eq('liste', liste);
  if (e1) throw e1;
  if (nouveaux.length) {
    const { error: e2 } = await sb.from('tops').insert(nouveaux);
    if (e2) {
      if (anciens.length) await sb.from('tops').insert(anciens);
      throw e2;
    }
  }
  await chargerTops();
}

async function pageTops(s) {
  if (s) tp.liste = s === 'tous' ? 'tous' : genreDeSlug(s) || 'tous';
  const [f] = await Promise.all([chargerFilms(), chargerTops()]);
  tp.films = f;
  return htmlTops();
}

function htmlTops() {
  const l = tp.liste, taille = tailleTop(l), rangs = topDe(l), liste = rangs.map((r) => tp.films.find((f) => f.id === r.film_id)).filter(Boolean);
  const medailles = ['var(--or)', 'var(--argent)', 'var(--bronze)'];
  const fleches = (f, i) => `<div class="fleches"><button class="btn carre" type="button" data-top-monter="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Faire monter ${esc(f.titre)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>
    <button class="btn carre" type="button" data-top-descendre="${i}" ${i === liste.length - 1 ? 'disabled' : ''} aria-label="Faire descendre ${esc(f.titre)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
    <button class="btn carre" type="button" data-top-retirer="${i}" aria-label="Retirer ${esc(f.titre)} du classement"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  const note = (f) => (f.note ? `<span aria-hidden="true" class="etoile-txt">★</span> ${fr(f.note)}` : 'Pas noté');
  return `<div class="titre-page"><p class="sur-titre">Mes tops</p><h1>Classements</h1><p class="muted">Ton classement à toi, dans l'ordre que tu veux. Utilise les flèches pour faire monter ou descendre un film.</p></div>
  <nav class="puces" aria-label="Choisir un classement">${['tous', ...GENRES].map((x) => `<a href="#tops/${x === 'tous' ? 'tous' : slugGenre(x)}" ${x === l ? 'aria-current="page"' : ''}>${x === 'tous' ? `<span class="trophee">${ICO_TROPHEE}</span>Tous les temps` : `<img src="${buste(x)}" alt="">${x}`}</a>`).join('')}</nav>
  <div class="tops-tete"><h2 class="section">${nomTop(l)}</h2><div><span class="muted">${liste.length} / ${taille} places</span>
    ${liste.length < taille && liste.length ? `<button class="btn primaire" type="button" data-top-ajouter>${ICO_TROPHEE}Ajouter au top</button>` : ''}</div></div>
  ${!liste.length ? `<div class="vide-mascotte"><img src="img/baudet-medaille.png" alt="Baudet qui fait un clin d'œil en montrant une médaille d'or numéro 1"><div>
      <h2>Ton ${l === 'tous' ? 'top 10' : 'top 5 ' + l} est vide</h2><p class="muted">Choisis ton film numéro 1 et Baudet lui déroulera le tapis rouge.</p>
      <button class="btn primaire" type="button" data-top-ajouter>Choisir un premier film</button></div></div>`
  : `<ol class="podium">${liste.slice(0, 3).map((f, i) => `<li><div class="podium-haut"><span class="rang" style="color:${medailles[i]}" aria-hidden="true">${i + 1}</span>
      <a href="#film/${f.id}" aria-label="N°${i + 1} : ${esc(f.titre)}">${posterHtml({ ...f, genres: [] })}</a></div>
      <div class="podium-bas"><div><a href="#film/${f.id}"><b>${esc(f.titre)}</b></a><small>${f.annee ?? ''} · ${note(f)}</small></div>${fleches(f, i)}</div></li>`).join('')}</ol>
    <ol class="top-suite" start="4">${liste.slice(3).map((f, j) => `<li><span class="rang-ligne">${j + 4}</span>${affiche(f.affiche)}
      <div><a href="#film/${f.id}"><b>${esc(f.titre)}</b></a><small>${f.annee ?? ''}</small></div><span class="note-ligne">${note(f)}</span>${fleches(f, j + 3)}</li>`).join('')}
      ${Array.from({ length: taille - Math.max(liste.length, 3) }, (_, k) => `<li class="libre"><button class="btn" type="button" data-top-ajouter><span class="rang-ligne">${Math.max(liste.length, 3) + k + 1}</span><span>+ Place libre · ajouter un film</span></button></li>`).join('')}</ol>`}`;
}

function ouvrirAjoutTop() {
  const l = tp.liste, dedans = new Set(topDe(l).map((r) => r.film_id));
  const candidats = tp.films.filter((f) => f.statut === 'vu' && !dedans.has(f.id) && (l === 'tous' || f.genres.includes(l))).sort((a, b) => (b.note ?? -1) - (a.note ?? -1));
  fen.classList.remove('petit');
  fenCorps.innerHTML = `<div class="ajout-tete"><div class="ajout-titres"><span class="sur-titre">${nomTop(l)}</span><h2>Ajouter au top</h2></div>
    <button class="btn carre" type="button" data-fermer aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="recherche">${ICO_LOUPE}<input id="top-q" type="search" placeholder="Rechercher parmi tes films vus…" aria-label="Rechercher parmi tes films vus" autocomplete="off"></label>
    <ul class="resultats" id="top-candidats">${candidats.length ? candidats.map((f) => `<li data-cherche="${esc(f.cherche)}"><button type="button" data-top-choisir="${f.id}">${affiche(f.affiche)}
      <span><b>${esc(f.titre)}</b><small>${[f.annee, f.genres.join(', ')].filter(Boolean).join(' · ')}</small></span><span class="badge vu">Ajouter</span></button></li>`).join('')
    : `<li class="vide">${l === 'tous' ? 'Tous tes films vus sont déjà classés, ou tu n’as pas encore de film vu.' : `Aucun film vu en ${l} à ajouter.`}</li>`}</ul>`;
  fen.showModal();
  $('#top-q').focus();
}

async function modifierTop(action, b) {
  const l = tp.liste, ids = topDe(l).map((r) => r.film_id), i = Number(b.dataset[action]);
  if (action === 'topMonter') [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
  else if (action === 'topDescendre') [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
  else if (action === 'topRetirer') ids.splice(i, 1);
  else if (action === 'topChoisir') ids.push(Number(b.dataset.topChoisir));
  b.disabled = true;
  try {
    await enregistrerTop(l, ids);
    if (action === 'topChoisir') fen.close();
    $('#page').innerHTML = htmlTops();
  } catch (err) { toast('Classement non enregistré : ' + err.message); b.disabled = false; }
}

// Fenêtre « Ajouter à mes tops » depuis la fiche : le classement général et les genres du film.
async function ouvrirTopsFiche() {
  await chargerTops();
  const f = fiche;
  const listes = ['tous', ...f.genres];
  fen.classList.remove('petit');
  fenCorps.innerHTML = `<div class="ajout-tete"><span class="mini-affiche">${affiche(f.affiche)}</span><div class="ajout-titres"><span class="sur-titre">${esc(f.titre)}</span><h2>Ajouter à mes tops</h2></div>
    <button class="btn carre" type="button" data-fermer aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <div class="edition"><p class="muted">Le classement général et les genres du film. Choisis une place puis valide.</p>
  ${listes.map((l) => {
    const rangs = topDe(l), taille = tailleTop(l), moi = rangs.find((r) => r.film_id === f.id), n = rangs.length;
    const max = moi ? n : Math.min(n + 1, taille), plein = !moi && n >= taille;
    return `<div class="top-fiche ${moi ? 'classe' : ''}" data-liste-top="${esc(l)}">
      <span class="top-ico">${l === 'tous' ? ICO_TROPHEE : `<img src="${buste(l)}" alt="">`}</span>
      <div><b>${nomTop(l)}</b><small>${moi ? `Classé N°${moi.position}` : `Pas encore classé · ${n} / ${taille} places`}</small>
        ${plein ? `<small class="attention">Top plein : « ${esc(rangs.at(-1).films?.titre || '')} » sortira du classement.</small>` : ''}</div>
      <label class="champ place"><span>Place</span><select data-place data-menu ${moi && n === 1 ? 'disabled' : ''} aria-label="Place dans le ${nomTop(l)}">${Array.from({ length: max }, (_, k) => `<option ${k + 1 === (moi ? moi.position : max) ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></label>
      <button class="btn ${moi ? '' : 'primaire'}" type="button" ${moi ? 'data-top-fiche-retirer' : 'data-top-fiche-ajouter'}>${moi ? 'Retirer' : 'Ajouter'}</button></div>`;
  }).join('')}</div>
  <div class="ajout-pied"><a class="lien" href="#tops" data-fermer>Voir tous mes tops</a><button class="btn primaire" type="button" data-fermer>Terminé</button></div>`;
  if (!fen.open) fen.showModal();
}

async function actionTopFiche(el) {
  const bloc = el.closest('[data-liste-top]'), l = bloc.dataset.listeTop, place = Number($('[data-place]', bloc).value);
  const ids = topDe(l).map((r) => r.film_id).filter((x) => x !== fiche.id);
  if (!('topFicheRetirer' in el.dataset)) ids.splice(place - 1, 0, fiche.id);
  el.disabled = true;
  try {
    await enregistrerTop(l, ids);
    fiche.tops = tp.rows.filter((r) => r.film_id === fiche.id).map(({ liste, position }) => ({ liste, position }));
    const label = $('[data-action="tops"]');
    if (label) label.innerHTML = ICO_TROPHEE + libelleTops(fiche.tops);
    await ouvrirTopsFiche();
  } catch (err) { toast('Classement non enregistré : ' + err.message); el.disabled = false; }
}

/* ---------- Graphiques ---------- */

function maxRond(m) {
  if (m <= 0) return 4;
  const pas = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => s * 4 >= m) || Math.ceil(m / 4000) * 1000;
  return pas * 4;
}

// Barres verticales avec axe des ordonnées : 5 graduations rondes de 0 au maximum.
function barres(items, unite = '') {
  const max = maxRond(Math.max(0, ...items.map((i) => i.v))), ticks = [4, 3, 2, 1, 0].map((k) => (max * k) / 4);
  return `<div class="graph"><div class="axe" aria-hidden="true">${ticks.map((t) => `<span>${t}${unite}</span>`).join('')}</div>
    <div class="zone"><div class="lignes" aria-hidden="true">${ticks.map(() => '<span></span>').join('')}</div>
    ${items.map((i) => `<div class="col" title="${esc(i.tip)}"><span class="tip">${esc(i.tip)}</span><div class="barre ${i.fort ? 'fort' : ''}" style="height:${(i.v / max) * 100}%"></div></div>`).join('')}</div>
    <span></span><div class="etiquettes" aria-hidden="true">${items.map((i) => `<span>${i.label}</span>`).join('')}</div></div>`;
}

const lignesH = (rows) => `<ol class="hbarres">${rows.map((r) => `<li>${r.ico || ''}<span class="hb-nom">${r.nom}</span><span class="hb-piste" title="${esc(r.tip || '')}"><span style="width:${r.pct}%"></span></span><span class="hb-val">${r.val}</span></li>`).join('')}</ol>`;

/* ---------- Statistiques ---------- */

const st = { films: [], annee: null, mesure: 'films', periodeReal: 'annee', periodeActeur: 'annee', carte: null };

async function pageStats() {
  st.films = (await chargerFilms()).filter((f) => f.statut === 'vu' && f.visions.length);
  st.annee ??= Number(aujourdhui().slice(0, 4));
  return htmlStats();
}

function htmlStats() {
  const F = st.films, auj = aujourdhui(), moisCourant = auj.slice(0, 7);
  if (!F.length) return `<div class="titre-page"><p class="sur-titre">Statistiques</p><h1>Ton cinéma, décortiqué</h1></div>${videMascotte('Pas encore de statistiques', 'Ajoute tes premiers films vus : Baudet calculera tes chiffres, tes genres et tes pays.', '<button class="btn primaire" type="button" data-ajout>Ajouter un film</button>')}`;
  const visions = F.flatMap((f) => f.visions.map((d) => ({ d, f })));
  const notes = F.filter((f) => f.note).map((f) => f.note);
  const minutes = visions.reduce((s, v) => s + (v.f.duree || 0), 0);
  const parGenre = GENRES.map((g) => ({ g, n: F.filter((f) => f.genres.includes(g)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const top = parGenre[0];
  const nouveauxMois = F.filter((f) => f.visions[0].startsWith(moisCourant)).length;
  const debut = F.map((f) => f.visions[0]).sort()[0];
  const kpis = [['Films vus', F.length, '', `+${nouveauxMois} ce mois-ci`], ['Heures passées', Math.round(minutes / 60), 'h', `environ ${pluriel(Math.round(minutes / 1440), 'jour')}`],
    ['Note moyenne', notes.length ? fr1(moyenne(notes)) : '–', '/ 5', `${pluriel(notes.filter((n) => n === 5).length, 'film noté', 'films notés')} 5 ★`], ['Genre préféré', top ? top.g : '–', '', top ? pluriel(top.n, 'film') : '']];

  // 12 derniers mois
  const mois = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return iso(d).slice(0, 7); });
  const cumul = mois.map((m) => F.filter((f) => f.visions[0].slice(0, 7) <= m).length);
  const maxC = maxRond(Math.max(...cumul)), pts = cumul.map((v, i) => [i * (1000 / 11), 250 - (v / maxC) * 240]);
  const lab = (m) => MOIS_COURT[Number(m.slice(5)) - 1];
  const parMois = mois.map((m) => {
    const vs = visions.filter((v) => v.d.startsWith(m)), h = Math.round(vs.reduce((s, v) => s + (v.f.duree || 0), 0) / 60);
    const v = st.mesure === 'films' ? vs.length : h;
    return { v, label: lab(m), tip: `${majuscule(MOIS[Number(m.slice(5)) - 1])} ${m.slice(0, 4)} : ${st.mesure === 'films' ? pluriel(vs.length, 'film') : h + ' h'}` };
  });
  const repNotes = Array.from({ length: 10 }, (_, i) => { const n = (i + 1) / 2, c = notes.filter((x) => x === n).length; return { v: c, label: fr(n), tip: `${fr(n)} ★ : ${pluriel(c, 'film')}` }; });
  const decs = [...new Set(F.filter((f) => f.annee).map((f) => Math.floor(f.annee / 10) * 10))].sort();
  const parDec = decs.map((d) => ({ d, v: F.filter((f) => f.annee >= d && f.annee < d + 10).length }));
  const decMax = parDec.reduce((a, b) => (b.v > a.v ? b : a), { v: -1 });

  // Calendrier annuel
  const annees = [...new Set([Number(auj.slice(0, 4)), ...visions.map((v) => Number(v.d.slice(0, 4)))])].sort((a, b) => b - a);
  const an = st.annee, jan1 = `${an}-01-01`, dec31 = `${an}-12-31`;
  const decal = (new Date(an, 0, 1).getDay() + 6) % 7, departHm = ajoutJours(jan1, -decal);
  const parJour = {};
  visions.forEach((v) => { if (v.d.startsWith(an)) (parJour[v.d] ??= []).push(v.f.titre); });
  const nbSemaines = Math.ceil((decal + joursEntre(jan1, dec31) + 1) / 7);
  const cases = Array.from({ length: nbSemaines * 7 }, (_, i) => {
    const d = ajoutJours(departHm, i);
    if (d < jan1 || d > dec31) return '<span class="hm-hors"></span>';
    const t = parJour[d] || [], niv = Math.min(t.length, 4);
    return `<span class="hm-${niv}" title="${esc(dateLongue(d) + (t.length ? ' : ' + t.join(', ') : ' : aucun film'))}"></span>`;
  });
  // Le nom du mois s'affiche au-dessus de la semaine qui contient son 1er jour.
  const etiquettesSem = Array.from({ length: nbSemaines }, (_, w) => {
    const premier = Array.from({ length: 7 }, (_, k) => ajoutJours(departHm, w * 7 + k)).find((d) => d.endsWith('-01') && d.startsWith(an));
    return `<span>${premier ? MOIS_COURT[Number(premier.slice(5, 7)) - 1] : ''}</span>`;
  });
  const joursVus = Object.keys(parJour).sort();
  let serie = 0, record = 0, prec = null;
  joursVus.forEach((d) => { serie = prec && joursEntre(prec, d) === 1 ? serie + 1 : 1; record = Math.max(record, serie); prec = d; });
  const parJourSem = [0, 0, 0, 0, 0, 0, 0];
  visions.forEach((v) => parJourSem[(new Date(v.d + 'T12:00').getDay() + 6) % 7]++);
  const jourFav = ['le lundi', 'le mardi', 'le mercredi', 'le jeudi', 'le vendredi', 'le samedi', 'le dimanche'][parJourSem.indexOf(Math.max(...parJourSem))];

  // Réalisateurs et acteurs : sur le mois en cours ou l'année en cours.
  const classement = (cle, periode) => {
    const pref = periode === 'mois' ? moisCourant : auj.slice(0, 4), compte = {};
    F.filter((f) => f.visions.some((d) => d.startsWith(pref))).forEach((f) => (cle === 'real' ? f.realisateurs : f.acteurs.slice(0, 5).map((a) => a.nom)).forEach((n) => (compte[n] = (compte[n] || 0) + 1)));
    const rows = Object.entries(compte).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).slice(0, 5);
    const m = rows[0]?.[1] || 1;
    return rows.length ? lignesH(rows.map(([nom, n]) => ({ ico: `<span class="initiales" aria-hidden="true">${esc(nom.split(' ').map((x) => x[0]).join('').slice(0, 2))}</span>`, nom: esc(nom), pct: (n / m) * 100, val: pluriel(n, 'film') })))
      : `<p class="muted">Aucun film ${periode === 'mois' ? 'ce mois-ci' : 'cette année'}.</p>`;
  };
  const seg = (attr, val, opts) => `<div class="bascule" role="group">${opts.map(([v, l]) => `<button type="button" ${attr}="${v}" aria-pressed="${v === val}">${l}</button>`).join('')}</div>`;
  const periodes = [['mois', majuscule(MOIS[Number(moisCourant.slice(5)) - 1])], ['annee', auj.slice(0, 4)]];

  // Pays
  const pays = {};
  F.forEach((f) => (f.pays || []).forEach((p) => (pays[p] ??= []).push(f.titre)));
  const topPays = Object.entries(pays).sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  const nomPays = (c) => { try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(c); } catch { return c; } };
  st.pays = pays;

  return `<div class="titre-page"><p class="sur-titre">Statistiques</p><h1>Ton cinéma, décortiqué</h1><p class="muted">Depuis ${MOIS[Number(debut.slice(5, 7)) - 1]} ${debut.slice(0, 4)} · seuls les films vus comptent.</p></div>
  <section class="kpis">${kpis.map(([l, v, u, s]) => `<div class="kpi"><span class="kpi-label">${l}</span><span class="chiffre">${v}<small>${u}</small></span><span class="muted">${s}</span></div>`).join('')}</section>
  <div class="stats-grille">
  <section class="carte stat large"><div class="stat-tete"><h2>Ta collection au fil des mois</h2><span class="muted">${pluriel(F.length, 'film')} · +${cumul[11] - cumul[0]} en 12 mois</span></div>
    <div class="graph"><div class="axe" aria-hidden="true">${[4, 3, 2, 1, 0].map((k) => `<span>${(maxC * k) / 4}</span>`).join('')}</div>
    <div class="zone"><div class="lignes" aria-hidden="true">${[0, 1, 2, 3, 4].map(() => '<span></span>').join('')}</div>
    <svg viewBox="0 0 1000 260" preserveAspectRatio="none" role="img" aria-label="Nombre total de films vus, cumulé : de ${cumul[0]} en ${MOIS[Number(mois[0].slice(5)) - 1]} ${mois[0].slice(0, 4)} à ${cumul[11]} aujourd’hui">
      <path d="M0,250 L${pts.map((p) => p.join(',')).join(' L')} L1000,250 Z" fill="var(--accent)" fill-opacity=".12"/>
      <polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
    ${pts.map((p, i) => `<span class="point" style="left:${p[0] / 10}%;top:${(p[1] / 260) * 100}%" title="${MOIS_COURT[Number(mois[i].slice(5)) - 1]} ${mois[i].slice(0, 4)} : ${pluriel(cumul[i], 'film')}"></span>`).join('')}</div>
    <span></span><div class="etiquettes" aria-hidden="true">${mois.map((m) => `<span>${lab(m)}</span>`).join('')}</div></div></section>

  <section class="carte stat large"><div class="stat-tete"><h2>Ton année ciné, jour par jour</h2>
    <label class="champ petit-champ"><span>Année</span><select id="stats-annee">${annees.map((a) => `<option ${a === an ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
    <div class="hm-defile"><div class="hm" style="--semaines:${nbSemaines}"><span></span><div class="hm-mois" aria-hidden="true">${etiquettesSem.join('')}</div>
      <div class="hm-jours" aria-hidden="true"><span></span><span>mar.</span><span></span><span>jeu.</span><span></span><span>sam.</span><span></span></div>
      <div class="hm-cases" role="img" aria-label="${joursVus.length} jours avec un film en ${an}">${cases.join('')}</div></div></div>
    <div class="hm-bas"><div class="hm-chiffres"><div><span class="chiffre">${joursVus.length}</span><span class="muted">jours avec un film</span></div>
      <div><span class="chiffre">${pluriel(record, 'jour')}</span><span class="muted">plus longue série</span></div><div><span class="chiffre">${majuscule(jourFav.slice(3))}</span><span class="muted">ton jour préféré pour un film</span></div></div>
      <div class="hm-legende" aria-hidden="true"><span>Aucun</span>${[0, 1, 2, 3, 4].map((n) => `<span class="hm-${n}"></span>`).join('')}<span>4 films et +</span></div></div></section>

  <section class="carte stat"><div class="stat-tete"><h2>${st.mesure === 'films' ? 'Films vus par mois' : 'Heures par mois'}</h2>${seg('data-mesure', st.mesure, [['films', 'Films'], ['heures', 'Heures']])}</div>${barres(parMois)}</section>
  <section class="carte stat"><div class="stat-tete"><h2>Répartition de tes notes</h2><span class="muted">moyenne ${notes.length ? fr1(moyenne(notes)) : '–'} / 5</span></div>${barres(repNotes)}</section>

  <section class="carte stat large stat-genres"><div class="stat-genres-liste"><div class="stat-tete"><h2>Tes genres</h2><p class="muted">Un film peut compter dans plusieurs genres.</p></div>
    ${lignesH(parGenre.map((x) => ({ ico: `<a href="#genre/${slugGenre(x.g)}" tabindex="-1" aria-hidden="true"><img class="hb-buste" src="${buste(x.g)}" alt=""></a>`, nom: `<a href="#genre/${slugGenre(x.g)}">${x.g}</a>`, pct: (x.n / parGenre[0].n) * 100, val: x.n, tip: pluriel(x.n, 'film') })))}</div>
    ${top ? `<a class="genre-prefere" href="#genre/${slugGenre(top.g)}"><img src="img/decor-${slugGenre(top.g)}.jpg" alt="${esc(GENRE_INFO[top.g][7])}">
      <span><span class="sur-titre">Genre préféré</span><b>${top.g}</b><small>${pluriel(top.n, 'film')} · ${Math.round((top.n / F.length) * 100)} % de ta collection</small></span></a>` : ''}</section>

  <section class="carte stat large"><div class="stat-tete"><h2>Ton tour du monde</h2><span class="muted">un film coproduit compte dans chacun de ses pays · détail au survol</span></div>
    <div class="carte-monde"><div id="carte-monde" class="carte-svg">${st.carte || '<p class="muted">Chargement de la carte…</p>'}</div>
      <div class="carte-cote"><div><span class="chiffre">${Object.keys(pays).length}</span><span class="muted">${Object.keys(pays).length > 1 ? 'pays visités en films' : 'pays visité en films'}</span></div>
        <ol class="top-pays">${topPays.map(([c, l]) => `<li><span class="pastille-geo geo-${niveauPays(l.length)}" aria-hidden="true"></span><span>${esc(nomPays(c))}</span><b>${l.length}</b></li>`).join('')}</ol>
        <div class="geo-legende" aria-hidden="true">${['1', '2-4', '5-14', '15-49', '50+'].map((l, i) => `<span><span class="pastille-geo geo-${i + 1}"></span>${l}</span>`).join('')}</div></div></div></section>

  <section class="carte stat"><div class="stat-tete"><h2>Réalisateurs les plus vus</h2>${seg('data-periode-real', st.periodeReal, periodes)}</div>${classement('real', st.periodeReal)}</section>
  <section class="carte stat"><div class="stat-tete"><h2>Acteurs les plus vus</h2>${seg('data-periode-acteur', st.periodeActeur, periodes)}</div>${classement('acteur', st.periodeActeur)}</section>

  <section class="carte stat large"><div class="stat-tete"><h2>Par décennie de sortie</h2>${decMax.v > 0 ? `<span class="muted">les années ${decMax.d} dominent</span>` : ''}</div>
    ${barres(parDec.map((x) => ({ v: x.v, label: `${String(x.d).slice(2)}s`, tip: `Années ${x.d} : ${pluriel(x.v, 'film')}`, fort: x === decMax })))}</section>
  </div>`;
}

const niveauPays = (n) => (n >= 50 ? 5 : n >= 15 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : 1);

// world-atlas identifie les pays par code numérique ISO 3166-1 ; TMDB par code à deux lettres.
// shortcut: table limitée aux pays producteurs courants ; les autres comptent dans les chiffres mais ne sont pas coloriés.
const ISO_NUM = { AF: 4, AL: 8, DZ: 12, AO: 24, AR: 32, AM: 51, AU: 36, AT: 40, AZ: 31, BD: 50, BY: 112, BE: 56, BJ: 204, BO: 68, BA: 70, BW: 72, BR: 76, BG: 100, BF: 854, KH: 116,
  CM: 120, CA: 124, CF: 140, TD: 148, CL: 152, CN: 156, CO: 170, CD: 180, CG: 178, CR: 188, CI: 384, HR: 191, CU: 192, CY: 196, CZ: 203, DK: 208, DO: 214, EC: 218, EG: 818, SV: 222,
  EE: 233, ET: 231, FI: 246, FR: 250, GA: 266, GE: 268, DE: 276, GH: 288, GR: 300, GT: 320, GN: 324, HT: 332, HN: 340, HU: 348, IS: 352, IN: 356, ID: 360, IR: 364, IQ: 368, IE: 372,
  IL: 376, IT: 380, JM: 388, JP: 392, JO: 400, KZ: 398, KE: 404, KR: 410, KP: 408, KW: 414, KG: 417, LA: 418, LV: 428, LB: 422, LY: 434, LT: 440, LU: 442, MK: 807, MG: 450, MY: 458,
  ML: 466, MR: 478, MX: 484, MD: 498, MN: 496, ME: 499, MA: 504, MZ: 508, MM: 104, NA: 516, NP: 524, NL: 528, NZ: 554, NI: 558, NE: 562, NG: 566, NO: 578, OM: 512, PK: 586, PS: 275,
  PA: 591, PY: 600, PE: 604, PH: 608, PL: 616, PT: 620, PR: 630, QA: 634, RO: 642, RU: 643, RW: 646, SA: 682, SN: 686, RS: 688, SK: 703, SI: 705, SO: 706, ZA: 710, ES: 724, LK: 144,
  SD: 729, SE: 752, CH: 756, SY: 760, TW: 158, TJ: 762, TZ: 834, TH: 764, TN: 788, TR: 792, TM: 795, UG: 800, UA: 804, AE: 784, GB: 826, US: 840, UY: 858, UZ: 860, VE: 862, VN: 704,
  YE: 887, ZM: 894, ZW: 716, GL: 304, PG: 598, ER: 232, SS: 728, BT: 64, TL: 626, BI: 108, LS: 426, SZ: 748, GQ: 226, GM: 270, GW: 624, SL: 694, LR: 430, TG: 768, MW: 454, DJ: 262 };

const chargerScript = (src) => new Promise((ok, ko) => {
  if (document.querySelector(`script[src="${src}"]`)) return ok();
  const s = document.createElement('script');
  Object.assign(s, { src, onload: ok, onerror: () => ko(new Error('carte indisponible hors connexion')) });
  document.head.append(s);
});

async function dessinerCarte() {
  const el = $('#carte-monde');
  if (!el || st.carte) return;
  try {
    await chargerScript('https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js');
    await chargerScript('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
    const monde = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')).json();
    const features = topojson.feature(monde, monde.objects.countries).features.filter((f) => f.id !== '010'); // sans l'Antarctique
    const chemin = d3.geoPath(d3.geoNaturalEarth1().fitSize([960, 480], { type: 'FeatureCollection', features }));
    const parNum = {};
    Object.entries(st.pays).forEach(([c, l]) => { if (ISO_NUM[c]) parNum[String(ISO_NUM[c]).padStart(3, '0')] = [c, l]; });
    const nom = (c) => { try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(c); } catch { return c; } };
    st.carte = `<svg viewBox="0 0 960 480" role="img" aria-label="Carte des pays d'origine de tes films">${features.map((f) => {
      const p = parNum[f.id];
      return `<path d="${chemin(f)}" class="geo-${p ? niveauPays(p[1].length) : 0}">${p ? `<title>${esc(nom(p[0]))} : ${pluriel(p[1].length, 'film')} — ${esc(p[1].slice(0, 6).join(', '))}${p[1].length > 6 ? '…' : ''}</title>` : ''}</path>`;
    }).join('')}</svg>`;
    if ($('#carte-monde')) $('#carte-monde').innerHTML = st.carte;
  } catch (err) {
    if ($('#carte-monde')) $('#carte-monde').innerHTML = `<p class="muted">La carte n'a pas pu être chargée (${esc(err.message)}).</p>`;
  }
}

/* ---------- Rétrospectives ---------- */

const rt = { periode: 'mois', decalage: 0, films: [] };

function bornes(periode, decalage) {
  const auj = new Date(aujourdhui() + 'T12:00');
  if (periode === 'semaine') {
    const lundi = ajoutJours(aujourdhui(), -((auj.getDay() + 6) % 7) - 7 * decalage);
    return [lundi, ajoutJours(lundi, 6)];
  }
  if (periode === 'mois') {
    const d = new Date(auj.getFullYear(), auj.getMonth() - decalage, 1, 12);
    return [iso(d), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))];
  }
  const y = auj.getFullYear() - decalage;
  return [`${y}-01-01`, `${y}-12-31`];
}

function resumePeriode(debut, fin) {
  const vs = rt.films.flatMap((f) => f.visions.filter((d) => d >= debut && d <= fin).map((d) => ({ d, f, revu: d > f.visions[0] })));
  const distincts = [...new Set(vs.map((v) => v.f))];
  const notes = distincts.filter((f) => f.note).map((f) => f.note);
  return { vs, distincts, n: vs.length, heures: Math.round(vs.reduce((s, v) => s + (v.f.duree || 0), 0) / 60), note: notes.length ? moyenne(notes) : null,
    coeurs: distincts.filter((f) => f.coup_de_coeur).length, revus: vs.filter((v) => v.revu).length };
}

async function pageRetro(param) {
  if (param) { const [p, d] = param.split('-'); if (['semaine', 'mois', 'annee'].includes(p)) Object.assign(rt, { periode: p, decalage: Number(d) || 0 }); }
  rt.films = (await chargerFilms()).filter((f) => f.statut === 'vu' && f.visions.length);
  return htmlRetro();
}

function htmlRetro() {
  const { periode: P, decalage: D } = rt, [debut, fin] = bornes(P, D), [pDebut, pFin] = bornes(P, D + 1);
  const r = resumePeriode(debut, fin), prec = resumePeriode(pDebut, pFin);
  const nomMois = (d) => MOIS[Number(d.slice(5, 7)) - 1];
  const titre = P === 'semaine' ? (D === 0 ? 'Cette semaine' : D === 1 ? 'La semaine dernière' : `Semaine du ${dateLongue(debut).replace(/ \d{4}$/, '')}`)
    : P === 'mois' ? `${majuscule(nomMois(debut))} ${debut.slice(0, 4)}` : debut.slice(0, 4);
  const ici = P === 'semaine' ? 'cette semaine' : P === 'mois' ? `en ${nomMois(debut)}` : `en ${debut.slice(0, 4)}`;
  const ref = P === 'semaine' ? 'la semaine d’avant' : `en ${P === 'mois' ? nomMois(pDebut) : pDebut.slice(0, 4)}`;
  const que = (/^[aeiou]/.test(ref) ? 'qu’' : 'que ') + ref;
  const cmp = (a, b, unite, mot, motP) => (a === b ? ['eq', `Autant ${que}`]
    : [a > b ? 'up' : 'down', `${unite ? Math.abs(a - b) + ' ' + unite : pluriel(Math.abs(a - b), mot, motP)} de ${a > b ? 'plus' : 'moins'} ${que}`]);
  const kpis = [[r.n, '', `${r.n > 1 ? 'films vus' : 'film vu'} ${ici}`, cmp(r.n, prec.n, '', 'film')], [r.heures, 'h', 'passées devant l’écran', cmp(r.heures, prec.heures, 'h')],
    [r.note ? fr1(r.note) : '–', '/ 5', 'de note moyenne'], [r.coeurs, '', r.coeurs > 1 ? 'coups de cœur' : 'coup de cœur', cmp(r.coeurs, prec.coeurs, '', 'coup de cœur', 'coups de cœur')]];
  const fleches = { up: '↑', down: '↓', eq: '=' };
  const resume = P === 'semaine' ? `Du ${dateLongue(debut).replace(/ \d{4}$/, '')} au ${dateLongue(fin)}.` : P === 'mois' ? `Du 1er au ${Number(fin.slice(8))} ${nomMois(fin)}.` : `De janvier à ${D === 0 ? 'aujourd’hui' : 'décembre'}.`;
  const genres = GENRES.map((g) => ({ g, n: r.distincts.filter((f) => f.genres.includes(g)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 3);
  const top = [...r.distincts].sort((a, b) => (b.note ?? 0) - (a.note ?? 0) || b.coup_de_coeur - a.coup_de_coeur).slice(0, 3);
  const phare = (cle) => {
    const c = {};
    r.distincts.forEach((f) => (cle === 'real' ? f.realisateurs : f.acteurs.slice(0, 5).map((a) => a.nom)).forEach((x) => (c[x] = (c[x] || 0) + 1)));
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  };
  const phares = [['Réalisateur phare', phare('real')], ['Acteur phare', phare('acteur')]].filter((x) => x[1]);
  // Rythme : jours de la semaine, semaines du mois ou mois de l'année.
  let rythme;
  if (P === 'semaine') rythme = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((l, i) => { const d = ajoutJours(debut, i), n = r.vs.filter((v) => v.d === d).length; return { v: n, label: l, tip: `${majuscule(dateLongue(d))} : ${pluriel(n, 'film')}` }; });
  else if (P === 'mois') {
    rythme = [];
    for (let d = debut, k = 1; d <= fin; d = ajoutJours(d, 7), k++) { const f2 = ajoutJours(d, 6) > fin ? fin : ajoutJours(d, 6), n = r.vs.filter((v) => v.d >= d && v.d <= f2).length; rythme.push({ v: n, label: `S${k}`, tip: `Du ${Number(d.slice(8))} au ${Number(f2.slice(8))} ${nomMois(d)} : ${pluriel(n, 'film')}` }); }
  } else {
    const dernier = D === 0 ? Number(aujourdhui().slice(5, 7)) : 12;
    rythme = Array.from({ length: dernier }, (_, i) => { const m = `${debut.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`, n = r.vs.filter((v) => v.d.startsWith(m)).length; return { v: n, label: MOIS_COURT[i], tip: `${majuscule(MOIS[i])} : ${pluriel(n, 'film')}` }; });
  }
  const pic = rythme.reduce((a, b) => (b.v > a.v ? b : a), { v: 0 });
  const mur = (r.distincts.length >= 4 ? r.distincts : rt.films).filter((f) => f.affiche);
  const colonnes = Array.from({ length: 12 }, (_, i) => `<div class="mur-col" style="animation-delay:${-i * 1.7}s">${Array.from({ length: 8 }, (_, j) => { const f = mur[(i * 3 + j * 5) % (mur.length || 1)]; return `<span>${f ? `<img src="https://image.tmdb.org/t/p/w185${esc(f.affiche)}" alt="" loading="lazy">` : ''}</span>`; }).join('')}</div>`).join('');

  return `<section class="retro-hero"><div class="mur" aria-hidden="true">${colonnes}</div><div class="retro-voile" aria-hidden="true"></div>
    <div class="retro-hero-in">
      <div class="retro-onglets" role="tablist" aria-label="Période">${[['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année']].map(([v, l]) => `<button type="button" role="tab" data-retro-periode="${v}" aria-selected="${v === P}">${l}</button>`).join('')}</div>
      <p class="sur-titre">Ta rétrospective</p>
      <div class="retro-titre"><button class="btn carre" type="button" data-retro-decaler="1" aria-label="Période précédente">${FLECHE('g')}</button><h1>${titre}</h1>
        <button class="btn carre" type="button" data-retro-decaler="-1" aria-label="Période suivante" ${D === 0 ? 'disabled' : ''}>${FLECHE('d')}</button></div>
      <p class="retro-resume">${resume} ${r.n ? `${pluriel(r.n, 'séance')}${r.revus ? `, dont ${pluriel(r.revus, 'revisionnage')}` : ''}.` : 'Aucun film vu sur cette période.'}</p>
      ${r.n ? `<div class="retro-kpis">${kpis.map(([v, u, phrase, c]) => `<div><span class="chiffre">${v}<small>${u}</small></span><span>${phrase}</span>${c ? `<span class="cmp cmp-${c[0]}"><b aria-hidden="true">${fleches[c[0]]}</b>${c[1]}</span>` : ''}</div>`).join('')}</div>` : ''}
    </div></section>
  ${r.n ? `<div class="retro-corps">
    <section><p class="sur-titre">Le podium</p><h2 class="section">Tes meilleurs films</h2>
      <ol class="retro-top">${top.map((f, i) => `<li><span class="rang" aria-hidden="true">${i + 1}</span><a href="#film/${f.id}">${posterHtml({ ...f, genres: [] })}<b>${esc(f.titre)}</b><small>${f.note ? `<span class="etoile-txt" aria-hidden="true">★</span> ${fr(f.note)} · ` : ''}${f.annee ?? ''}</small></a></li>`).join('')}</ol></section>
    ${genres.length ? `<section class="retro-genre"><img src="img/decor-${slugGenre(genres[0].g)}.jpg" alt="${esc(GENRE_INFO[genres[0].g][7])}"><div class="retro-genre-voile" aria-hidden="true"></div>
      <div class="retro-genre-texte"><p class="sur-titre">Genre dominant</p><h2>${genres[0].g}</h2>
      ${lignesH(genres.map((x) => ({ ico: `<img class="hb-buste" src="${buste(x.g)}" alt="">`, nom: x.g, pct: (x.n / genres[0].n) * 100, val: x.n })))}</div></section>` : ''}
    ${phares.length ? `<section class="retro-phares"><p class="sur-titre">Tes têtes d'affiche</p><div>${phares.map(([role, [nom, n]]) => `<div class="carte phare"><span class="initiales" aria-hidden="true">${esc(nom.split(' ').map((x) => x[0]).join('').slice(0, 2))}</span>
      <span class="muted">${role}</span><b>${esc(nom)}</b><small class="muted">${pluriel(n, 'film')} ${ici}</small></div>`).join('')}</div></section>` : ''}
    <section class="carte stat"><div class="stat-tete"><div><p class="sur-titre">Ton rythme</p><h2>${P === 'semaine' ? 'Jour par jour' : P === 'mois' ? 'Semaine par semaine' : 'Mois par mois'}</h2></div>
      ${pic.v ? `<span class="muted">pic : ${pic.label}</span>` : ''}</div>${barres(rythme)}
      ${r.revus ? `<p class="revisions">${ICO_REVU} ${pluriel(r.revus, 'revisionnage')} ${ici} : ${esc([...new Set(r.vs.filter((v) => v.revu).map((v) => v.f.titre))].join(', '))}.</p>` : ''}</section>
  </div>` : videMascotte('Rien à raconter… pour l’instant', 'Aucun film vu sur cette période. Change de période avec les flèches, ou ajoute un film.', '<button class="btn primaire" type="button" data-ajout>Ajouter un film</button>')}`;
}

/* ---------- Accueil ---------- */

const SIGNE = { Western: 'du western', Thriller: 'du thriller', Drame: 'du drame', SF: 'de la SF', Horreur: 'de l’horreur', Comédie: 'de la comédie', Romantique: 'de la romance',
  Action: 'de l’action', Aventure: 'de l’aventure', Animation: 'de l’animation', Guerre: 'du film de guerre' };

async function pageAccueilPleine() {
  const F = await chargerFilms(), vus = F.filter((f) => f.statut === 'vu' && f.visions.length), aVoir = F.filter((f) => f.statut === 'a_voir');
  const auj = aujourdhui(), notes = vus.filter((f) => f.note).map((f) => f.note);
  const minutes = vus.reduce((s, f) => s + (f.duree || 0) * f.visions.length, 0);
  const ceMois = vus.filter((f) => f.visions[0].startsWith(auj.slice(0, 7))).length;
  rt.films = vus;
  const [md, mf] = bornes('mois', 1), rp = resumePeriode(md, mf);
  const gMois = GENRES.map((g) => ({ g, n: rp.distincts.filter((f) => f.genres.includes(g)).length })).sort((a, b) => b.n - a.n)[0];
  // Ce jour-là : un film vu à la même date une année précédente (le plus récent).
  const souvenir = vus.flatMap((f) => f.visions.filter((d) => d.slice(5) === auj.slice(5) && d < auj).map((d) => ({ d, f }))).sort((a, b) => b.d.localeCompare(a.d))[0];
  const sorties = aVoir.filter((f) => f.date_sortie_fr && f.date_sortie_fr > auj).sort((a, b) => a.date_sortie_fr.localeCompare(b.date_sortie_fr)).slice(0, 4);
  const jourTxt = majuscule(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })).replace(/ 1 /, ' 1er ');
  const titreSection = (sur, titre, lien, label) => `<div class="section-tete"><div><p class="sur-titre">${sur}</p><h2 class="section">${titre}</h2></div>${lien ? `<a class="lien" href="${lien}">${label} →</a>` : ''}</div>`;
  const kpis = [['Films vus', vus.length, '', `+${ceMois} ce mois-ci`], ['Heures passées', Math.round(minutes / 60), 'h', `environ ${pluriel(Math.round(minutes / 1440), 'jour')}`],
    ['Note moyenne', notes.length ? fr1(moyenne(notes)) : '–', '/ 5', `sur ${pluriel(notes.length, 'film noté', 'films notés')}`], ['À voir', aVoir.length, '', 'dans ta watchlist']];
  return `<section class="hero accueil-hero"><div class="hero-texte"><p class="sur-titre">${jourTxt}</p><h1>Quel film viens-tu de voir ?</h1>
      <p><span class="long">Tape son titre : affiche, synopsis et casting se remplissent tout seuls. Il ne te reste qu'à le noter.</span><span class="court">Tape son titre, le reste se remplit tout seul.</span></p>
      <div class="boutons"><button class="btn primaire grand" type="button" data-ajout>Ajouter un film</button><a class="btn grand" href="#a-voir">Ma watchlist · ${aVoir.length}</a></div></div></section>
  <section>${titreSection('', 'Ton cinéma en chiffres', '#stats', 'Toutes les statistiques')}
    <div class="kpis">${kpis.map(([l, v, u, s]) => `<div class="kpi"><span class="kpi-label">${l}</span><span class="chiffre">${v}<small>${u}</small></span><span class="muted">${s}</span></div>`).join('')}</div></section>
  ${souvenir ? `<section class="souvenir"><a href="#film/${souvenir.f.id}" tabindex="-1" aria-hidden="true">${affiche(souvenir.f.affiche)}</a>
    <div><p class="sur-titre">Ce jour-là · ${dateLongue(souvenir.d)}</p><h2>Il y a ${pluriel(Number(auj.slice(0, 4)) - Number(souvenir.d.slice(0, 4)), 'an')}, tu regardais <span>${esc(souvenir.f.titre)}</span></h2>
    <p class="muted">${souvenir.f.note ? `<span class="etoile-txt" aria-hidden="true">★</span> ${fr(souvenir.f.note)} / 5` : 'Pas noté'}${souvenir.f.coup_de_coeur ? ' · coup de cœur' : ''}</p>
    <a class="btn" href="#film/${souvenir.f.id}">Revoir la fiche</a></div></section>` : ''}
  ${vus.length ? `<section>${titreSection('Récemment', 'Derniers films vus', '#collection', 'Voir la collection')}
    <div class="rangee">${[...vus].sort(parDernier).slice(0, 6).map((f) => carteFilm(f, noteBas(f), '<span class="badge vu">Vu</span>')).join('')}</div></section>` : ''}
  ${rp.n ? `<section class="retro-carte"><div><p class="sur-titre">Rétrospective · ${majuscule(MOIS[Number(md.slice(5, 7)) - 1])} ${md.slice(0, 4)}</p>
      <h2>${gMois?.n ? `Un mois sous le signe ${SIGNE[gMois.g]}` : 'Ton mois en un coup d’œil'}</h2>
      <p>Ton genre dominant, ton réalisateur phare et tes meilleures notes du mois, réunis sur une page.</p><a class="btn clair" href="#retros/mois-1">Voir ma rétro de ${MOIS[Number(md.slice(5, 7)) - 1]}</a></div>
    <div class="retro-carte-chiffres"><div><span class="chiffre">${rp.n}</span><span>${rp.n > 1 ? 'films vus' : 'film vu'}</span></div><div><span class="chiffre">${rp.heures}<small>h</small></span><span>devant l'écran</span></div>
      <div><span class="chiffre">${rp.note ? fr1(rp.note) : '–'}</span><span>note moyenne</span></div></div></section>` : ''}
  ${aVoir.length ? `<section>${titreSection('Watchlist', 'À voir ensuite', '#a-voir', 'Toute la watchlist')}
    <div class="rangee">${[...aVoir].sort((a, b) => b.ajoute_le.localeCompare(a.ajoute_le)).slice(0, 6).map((f) => carteFilm(f, `<span>${f.annee ?? ''}</span><span>ajouté ${ilYa(f.ajout)}</span>`, '<span class="badge">À voir</span>')).join('')}</div></section>` : ''}
  ${sorties.length ? `<section><div class="section-tete"><div><p class="sur-titre">Dans ta watchlist</p><h2 class="section">Bientôt au cinéma en France</h2></div></div>
    <div class="rangee sorties">${sorties.map((f) => { const j = joursEntre(auj, f.date_sortie_fr); return `<a class="carte-film" href="#film/${f.id}">${posterHtml({ ...f, genres: [] }, `<span class="badge vu">dans ${pluriel(j, 'jour')}</span>`)}
      <b>${esc(f.titre)}</b><span class="carte-bas"><span>${Number(f.date_sortie_fr.slice(8))} ${MOIS_COURT[Number(f.date_sortie_fr.slice(5, 7)) - 1]} ${f.date_sortie_fr.slice(0, 4)}${f.genres[0] ? ' · ' + f.genres[0] : ''}</span></span></a>`; }).join('')}</div></section>` : ''}`;
}

/* ---------- Mon espace (mobile) ---------- */

function pageMonEspace() {
  const lien = (href, couleur, ico, titre, sous) => `<a href="${href}"><span class="espace-ico" style="background:${couleur}" aria-hidden="true">${ico}</span><span><b>${titre}</b><small>${sous}</small></span>${ICO_FLECHE_D}</a>`;
  const svg = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  return `<div class="titre-page"><h1>Mon espace</h1></div><nav class="carte espace" aria-label="Autres pages">
    ${lien('#tops', '#E3A72F', svg('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3'), 'Mes tops', 'Top 10 de tous les temps et tops par genre')}
    ${lien('#stats', '#3F7A4F', svg('M3 17l6-6 4 4 8-8M15 7h6v6'), 'Statistiques', 'Tes chiffres, tes genres et tes pays')}
    ${lien('#retros', '#3E8ED0', svg('M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z'), 'Rétrospectives', 'Semaine, mois et année')}
    ${installee() ? '' : `<button type="button" data-installer><span class="espace-ico" style="background:#8A5A2B" aria-hidden="true">${svg('M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 7v7M9 11l3 3 3-3M11 19h2')}</span><span><b>Installer l’app sur ton téléphone</b><small>DonkTV sur ton écran d’accueil, en plein écran</small></span>${ICO_FLECHE_D}</button>`}
    ${lien('#reglages', '#56685A', svg('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 10h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.6 1z'), 'Réglages', 'Thème, clés TMDB et OMDb')}
  </nav>`;
}

/* ---------- Installation sur téléphone ---------- */

let invitationAndroid = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invitationAndroid = e; });
const installee = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const CLE_PLUS_TARD = 'donktv-installer-plus-tard';

function proposerInstallation() {
  if (installee() || !mobile() || !films.length || fen.open || dlg.open) return;
  let plusTard = 0;
  try { plusTard = Number(localStorage.getItem(CLE_PLUS_TARD)) || 0; } catch {}
  if (Date.now() - plusTard < 7 * 864e5) return;
  ouvrirInstallation(/iPhone|iPad/.test(navigator.userAgent) ? 'ios' : 'android');
}

function ouvrirInstallation(os) {
  const ios = os === 'ios';
  fen.classList.add('feuille');
  fen.classList.remove('petit');
  fenCorps.innerHTML = `<div class="installer"><span class="poignee" aria-hidden="true"></span>
    <div class="installer-tete"><img src="img/icone-180.png" alt=""><div><h2>Installe <span class="logo logo-inline" role="img" aria-label="DonkTV"></span></h2><span class="muted">Sur ton écran d'accueil, comme une vraie app</span></div></div>
    <ul><li><span aria-hidden="true">▢</span>S'ouvre en plein écran, sans barre de navigateur</li><li><span aria-hidden="true">⌂</span>L'icône DonkTV sur ton écran d'accueil</li><li><span aria-hidden="true">≋</span>Ta collection reste consultable hors connexion</li></ul>
    <div class="bascule" role="group" aria-label="Ton téléphone"><button type="button" data-os="android" aria-pressed="${!ios}">Android</button><button type="button" data-os="ios" aria-pressed="${ios}">iPhone</button></div>
    ${ios ? `<ol class="etapes-ios"><li><span>1</span>Touche <b>Partager</b> (le carré avec une flèche) dans Safari</li><li><span>2</span>Choisis « Sur l'écran d'accueil »</li><li><span>3</span>Valide avec « Ajouter »</li></ol>`
      : invitationAndroid ? '<button class="btn primaire grand" type="button" data-installer-android>Installer l\'application</button>'
      : `<ol class="etapes-ios"><li><span>1</span>Ouvre le menu <b>⋮</b> de Chrome</li><li><span>2</span>Choisis « Installer l'application » ou « Ajouter à l'écran d'accueil »</li></ol>`}
    <button class="btn plat" type="button" data-plus-tard>Plus tard</button></div>`;
  if (!fen.open) fen.showModal();
}
fen.addEventListener('close', () => fen.classList.remove('feuille'));

/* ---------- Recherche rapide (Ctrl K) ---------- */

const rr = { films: null, q: '', tmdb: [] };
const rch = $('#recherche'), rchCorps = $('#recherche-corps');
const PAGES_RECHERCHE = [['Collection', '#collection'], ['À voir', '#a-voir'], ['Mes tops', '#tops'], ['Statistiques', '#stats'], ['Rétrospectives', '#retros'], ['Réglages', '#reglages']];

async function ouvrirRechercheRapide() {
  rr.q = ''; rr.tmdb = [];
  rchCorps.innerHTML = `<label class="recherche">${ICO_LOUPE}<input id="rr-q" type="search" placeholder="Un film, un réalisateur, une page…" aria-label="Rechercher un film ou une page" autocomplete="off"><kbd class="nav-haut">Échap</kbd>
    <button class="btn plat loupe-mobile" type="button" data-rr-fermer>Annuler</button></label><div id="rr-res" class="rr-res"></div>
    <div class="rr-aide nav-haut"><span><kbd>↑ ↓</kbd> naviguer</span><span><kbd>Entrée</kbd> ouvrir</span><span><kbd>Échap</kbd> fermer</span><span>⌘ K sur Mac</span></div>`;
  if (!rch.open) rch.showModal();
  $('#rr-q').focus();
  try { rr.films = await chargerFilms(); } catch { rr.films = []; }
  afficherRecherche();
}

function afficherRecherche() {
  const q = norm(rr.q.trim()), item = (href, titre, sous, ico, extra = '') => `<div class="rr-item"><a href="${href}" data-rr-lien>${ico}<span><b>${titre}</b>${sous ? `<small>${sous}</small>` : ''}</span></a>${extra}</div>`;
  const filmItem = (f) => item(`#film/${f.id}`, esc(f.titre), [f.annee, f.statut === 'vu' ? (f.note ? '★ ' + fr(f.note) : 'Vu') : 'À voir'].filter(Boolean).join(' · '), affiche(f.affiche));
  const pageItem = ([n, h]) => item(h, n, '', `<span class="rr-ico" aria-hidden="true">${ICO_FLECHE_D}</span>`);
  let groupes;
  if (!q) groupes = [['Récents', [...(rr.films || [])].filter((f) => f.statut === 'vu').sort(parDernier).slice(0, 3).map(filmItem)], ['Aller à', PAGES_RECHERCHE.map(pageItem)]];
  else {
    const connus = new Set((rr.films || []).map((f) => f.tmdb_id));
    groupes = [['Dans ta collection', (rr.films || []).filter((f) => f.cherche.includes(q)).slice(0, 5).map(filmItem)],
      ['Ajouter depuis TMDB', rr.tmdb.filter((r) => !connus.has(r.id)).slice(0, 5).map((r) => `<div class="rr-item">${affiche(r.poster_path)}<span><b>${esc(r.title)}</b><small>${(r.release_date || '').slice(0, 4) || 'Date inconnue'}</small></span>
        <span class="rr-actions"><button class="btn" type="button" data-rr-vu="${r.id}">Vu</button><button class="btn" type="button" data-rr-avoir="${r.id}">À voir</button></span></div>`)],
      ['Pages', PAGES_RECHERCHE.filter(([n]) => norm(n).includes(q)).map(pageItem)]];
  }
  groupes = groupes.filter(([, l]) => l.length);
  $('#rr-res').innerHTML = groupes.length ? groupes.map(([t, l]) => `<p class="rr-groupe">${t}</p>${l.join('')}`).join('') : `<p class="vide">Aucun résultat pour « ${esc(rr.q)} ».</p>`;
}

async function chercherTmdbRapide() {
  const q = rr.q.trim();
  if (!q || !reglages.tmdb_token) { rr.tmdb = []; return afficherRecherche(); }
  try { const { results } = await tmdb('/search/movie', { query: q }); if (rr.q.trim() === q) rr.tmdb = results; } catch { rr.tmdb = []; }
  afficherRecherche();
}

async function ajouterAVoirRapide(id, b) {
  b.disabled = true;
  try {
    const film = versFilm(await tmdb(`/movie/${id}`, { append_to_response: 'credits,videos,release_dates', include_video_language: 'fr,en' }));
    let note_rt = null;
    if (reglages.omdb_key && film.imdb_id) try { note_rt = parseInt((await omdb(film.imdb_id)).Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value) || null; } catch {}
    const { data, error } = await sb.from('films').upsert({ ...film, user_id: uid, statut: 'a_voir', note: null, coup_de_coeur: false, note_rt }, { onConflict: 'user_id,tmdb_id' }).select('id,tmdb_id,titre,annee,affiche,statut,note,coup_de_coeur').single();
    if (error) throw error;
    films = [data, ...films.filter((f) => f.id !== data.id)];
    rch.close();
    toast(`${film.titre} rejoint ta watchlist.`, { label: 'Voir', fn: () => { location.hash = '#film/' + data.id; } });
    route();
  } catch (err) { b.disabled = false; toast('Ajout impossible : ' + (err.message || err)); }
}

rch.addEventListener('input', (e) => {
  if (e.target.id !== 'rr-q') return;
  rr.q = e.target.value; afficherRecherche();
  clearTimeout(chercherTmdbRapide.t); chercherTmdbRapide.t = setTimeout(chercherTmdbRapide, 300);
});
rch.addEventListener('click', (e) => {
  if (e.target === rch) return rch.close();
  const b = e.target.closest('a, button');
  if (!b) return;
  if ('rrLien' in b.dataset || 'rrFermer' in b.dataset) rch.close();
  else if (b.dataset.rrVu) { rch.close(); ouvrirRecherche(); choisir(b.dataset.rrVu); }
  else if (b.dataset.rrAvoir) ajouterAVoirRapide(b.dataset.rrAvoir, b);
});
rch.addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  const liens = [...rch.querySelectorAll('[data-rr-lien], .rr-actions button')], i = liens.indexOf(document.activeElement);
  const cible = e.key === 'ArrowDown' ? liens[i + 1] || liens[0] : i <= 0 ? $('#rr-q') : liens[i - 1];
  if (cible) { e.preventDefault(); cible.focus(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && uid) { e.preventDefault(); if (!rch.open) ouvrirRechercheRapide(); }
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-recherche]')) ouvrirRechercheRapide(); });

/* ---------- Branchements ---------- */

Object.assign(PAGES, {
  'a-voir': () => pageAVoir(), genre: (s) => pageGenre(s), tops: (s) => pageTops(s), stats: () => pageStats(), retros: (p) => pageRetro(p), 'mon-espace': pageMonEspace,
});
PAGES.stats.apres = dessinerCarte;
const majStats = () => { const y = scrollY; $('#page').innerHTML = htmlStats(); scrollTo(0, y); dessinerCarte(); };

$('#page').addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'av-q') { av.q = e.target.value; av.page = 1; $('#av-resultats').innerHTML = htmlAVoir(); }
  else if (id === 'genre-q') { gp.q = e.target.value; gp.page = 1; $('#genre-resultats').innerHTML = htmlGenre(); }
});
$('#page').addEventListener('change', (e) => {
  const id = e.target.id;
  if (id === 'av-tri') { av.tri = e.target.value; av.page = 1; $('#av-resultats').innerHTML = htmlAVoir(); }
  else if (id === 'genre-tri') { gp.tri = e.target.value; gp.page = 1; $('#genre-resultats').innerHTML = htmlGenre(); }
  else if (id === 'stats-annee') { st.annee = Number(e.target.value); majStats(); }
});
$('#page').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.avGenre != null) {
    av.genre = d.avGenre; av.page = 1;
    document.querySelectorAll('[data-av-genre]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    $('#av-resultats').innerHTML = htmlAVoir();
  } else if ('avReset' in d) {
    Object.assign(av, { q: '', genre: '', page: 1 }); $('#av-q').value = '';
    document.querySelectorAll('[data-av-genre]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.avGenre === ''));
    $('#av-resultats').innerHTML = htmlAVoir();
  } else if (d.avPage) { av.page = Number(d.avPage); $('#av-resultats').innerHTML = htmlAVoir(); $('#av-resultats').scrollIntoView({ block: 'start' }); }
  else if (d.marquerVu) marquerVu(Number(d.marquerVu), b);
  else if ('genreReset' in d) { gp.q = ''; $('#genre-q').value = ''; $('#genre-resultats').innerHTML = htmlGenre(); }
  else if (d.genrePage) { gp.page = Number(d.genrePage); $('#genre-resultats').innerHTML = htmlGenre(); $('.genre-films').scrollIntoView({ block: 'start' }); }
  else if ('topAjouter' in d) ouvrirAjoutTop();
  else if (d.topMonter) modifierTop('topMonter', b);
  else if (d.topDescendre) modifierTop('topDescendre', b);
  else if (d.topRetirer) modifierTop('topRetirer', b);
  else if (d.mesure) { st.mesure = d.mesure; majStats(); }
  else if (d.periodeReal) { st.periodeReal = d.periodeReal; majStats(); }
  else if (d.periodeActeur) { st.periodeActeur = d.periodeActeur; majStats(); }
  else if (d.retroPeriode) { Object.assign(rt, { periode: d.retroPeriode, decalage: 0 }); $('#page').innerHTML = htmlRetro(); }
  else if (d.retroDecaler) { rt.decalage = Math.max(0, rt.decalage + Number(d.retroDecaler)); $('#page').innerHTML = htmlRetro(); }
  else if ('installer' in d) ouvrirInstallation(/iPhone|iPad/.test(navigator.userAgent) ? 'ios' : 'android');
});
fen.addEventListener('click', async (e) => {
  const b = e.target.closest('button, a');
  if (!b) return;
  const d = b.dataset;
  if (b.tagName === 'A' && 'fermer' in d) fen.close();
  else if (d.topChoisir) modifierTop('topChoisir', b);
  else if ('topFicheAjouter' in d || 'topFicheRetirer' in d) actionTopFiche(b);
  else if (d.os) ouvrirInstallation(d.os);
  else if ('plusTard' in d) { try { localStorage.setItem(CLE_PLUS_TARD, Date.now()); } catch {} fen.close(); }
  else if ('installerAndroid' in d) { invitationAndroid.prompt(); await invitationAndroid.userChoice; invitationAndroid = null; fen.close(); }
});
fen.addEventListener('change', async (e) => {
  // Changer la place d'un film déjà classé le déplace aussitôt.
  const bloc = e.target.closest('.top-fiche.classe');
  if (bloc && e.target.matches('[data-place]')) actionTopFicheDeplacer(bloc, Number(e.target.value));
});
fen.addEventListener('input', (e) => {
  if (e.target.id !== 'top-q') return;
  const q = norm(e.target.value);
  fen.querySelectorAll('#top-candidats li[data-cherche]').forEach((li) => (li.hidden = !li.dataset.cherche.includes(q)));
});

async function actionTopFicheDeplacer(bloc, place) {
  const l = bloc.dataset.listeTop, ids = topDe(l).map((r) => r.film_id).filter((x) => x !== fiche.id);
  ids.splice(place - 1, 0, fiche.id);
  try {
    await enregistrerTop(l, ids);
    fiche.tops = tp.rows.filter((r) => r.film_id === fiche.id).map(({ liste, position }) => ({ liste, position }));
    const label = $('[data-action="tops"]');
    if (label) label.innerHTML = ICO_TROPHEE + libelleTops(fiche.tops);
    toast(`${fiche.titre} passe N°${place} du ${nomTop(l)}.`);
    await ouvrirTopsFiche();
  } catch (err) { toast('Classement non enregistré : ' + err.message); }
}
