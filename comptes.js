/* ---------- Comptes : inviter, confidentialité, pied de Mon espace ---------- */

// Fonction Supabase « comptes » (supabase/functions/comptes) : seule à pouvoir créer ou effacer un compte.
async function comptes(corps) {
  const { data, error } = await sb.functions.invoke('comptes', { body: corps });
  if (error) {
    const j = await error.context?.json?.().catch(() => null);
    throw new Error(j?.erreur || 'Le service des comptes ne répond pas.');
  }
  return data;
}

const ICO_ENVOYER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14l11 -11M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"/></svg>';
let invitations = [];

async function pageInviter() {
  if (!admin) return pageIntrouvable();
  invitations = await comptes({ action: 'liste' });
  const ligne = (i) => {
    // Supabase garde un lien d'invitation 24 h au plus.
    const [statut, cls] = i.cree ? ['Compte créé', 'ok'] : Date.now() - new Date(i.invite_le) < 864e5 ? ['En attente', 'attente'] : ['Lien expiré', ''];
    return `<li><span><b>${esc(i.email)}</b><small>Invitation envoyée le ${dateCourte(i.invite_le.slice(0, 10))}</small></span>
      <span class="statut ${cls}">${statut}</span>
      ${i.cree ? `<button class="btn danger-trait" type="button" data-retirer="${esc(i.id)}">Retirer l’accès</button>`
        : `<button class="btn" type="button" data-renvoyer="${esc(i.email)}">Renvoyer</button>`}</li>`;
  };
  return `<div class="etroit">
    <div class="titre-page"><h1>Inviter un utilisateur</h1><p class="muted">L’utilisateur aura son propre DonkTV, complètement privé : Si vous devenez amis, vous verrez seulement vos films en commun dans vos watchlists.</p></div>
    <section class="carte" aria-labelledby="invit-titre"><h2 id="invit-titre">Envoyer une invitation</h2>
      <form class="invit-form" data-inviter><label>E-mail de l’utilisateur<input type="email" name="email" autocomplete="off" placeholder="prenom@exemple.fr" required></label>
        <button class="btn primaire" type="submit">${ICO_ENVOYER}Envoyer l’invitation</button></form>
      <p class="muted" style="margin:0;font-size:14px">L’utilisateur reçoit un e-mail avec un lien pour créer son mot de passe. Le lien reste valable 24 heures.</p></section>
    <section aria-labelledby="invit-liste" style="display:flex;flex-direction:column;gap:14px"><h2 id="invit-liste">Mes invitations</h2>
      ${invitations.length ? `<ul class="carte invitations" style="padding:0;gap:0">${invitations.map(ligne).join('')}</ul>` : '<p class="muted">Aucune invitation pour l’instant.</p>'}</section>
  </div>`;
}

async function inviter(email, b) {
  b.disabled = true;
  try { await comptes({ action: 'inviter', email, redirectTo: URL_APP }); toast('Invitation envoyée'); route(); }
  catch (err) { toast(err.message); }
  finally { b.disabled = false; }
}

$('#page').addEventListener('submit', (e) => {
  if (!e.target.matches('[data-inviter]')) return;
  e.preventDefault();
  inviter(e.target.email.value, $('button', e.target));
});
$('#page').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b?.dataset.renvoyer) inviter(b.dataset.renvoyer, b);
  else if (b?.dataset.retirer) {
    const i = invitations.find((x) => x.id === b.dataset.retirer);
    fen.classList.add('petit');
    fenCorps.innerHTML = `<div class="confirmation" role="alertdialog" aria-labelledby="ret-titre" aria-describedby="ret-texte">
      <div><h2 id="ret-titre">Retirer l’accès ?</h2><p id="ret-texte" class="muted">${esc(i?.email)} ne pourra plus se connecter à DonkTV, et ses films seront effacés.</p></div>
      <div class="boutons"><button class="btn" type="button" data-fermer autofocus>Annuler</button><button class="btn danger" type="button" data-confirmer-retrait="${esc(b.dataset.retirer)}">Retirer l’accès</button></div></div>`;
    fen.showModal();
  }
});
fen.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (!d.confirmerRetrait && !('confirmerCompte' in d)) return;
  b.disabled = true;
  try {
    if (d.confirmerRetrait) { await comptes({ action: 'retirer', id: d.confirmerRetrait }); fen.close(); toast('Accès retiré.'); route(); }
    else { await comptes({ action: 'supprimer' }); fen.close(); await sb.auth.signOut(); toast('Ton compte a été supprimé.'); }
  } catch (err) { toast(err.message); b.disabled = false; }
});

/* Confidentialité : une page dans l'app, une fenêtre depuis l'écran de connexion. */
const REGION_BASE = 'en Europe (Irlande)'; // région du projet Supabase : eu-west-1
const htmlConfidentialite = () => `<div class="titre-page"><h1>Confidentialité</h1><p class="muted">Mise à jour le 25 novembre 2026. En bref : tes films restent à toi.</p></div>
  <section><h2>Ce que DonkTV garde</h2><ul><li>Ton adresse e-mail et ton mot de passe (chiffré), pour te connecter.</li>
    <li>Les films que tu ajoutes : vus, watchlist, notes, coups de cœur, dates, tops et sagas.</li><li>Tes réglages : prénom, thème, plateformes choisies.</li><li>Tes amis et les demandes d’ami envoyées ou reçues.</li></ul></section>
  <section><h2>Ce que DonkTV ne fait pas</h2><ul><li>Aucune publicité, aucun traqueur, aucune mesure d’audience.</li>
    <li>Aucune vente ni aucun partage de tes données.</li><li>Aucun partage entre comptes, sauf avec tes amis : ils voient seulement les films que vous avez en commun dans vos watchlists. Jamais tes films vus ni tes notes.</li></ul></section>
  <section><h2>Où sont tes données ?</h2><p>Elles sont hébergées chez Supabase${REGION_BASE ? ', ' + REGION_BASE : ''}. Les affiches, résumés et castings viennent de TMDB ; les plateformes de streaming, de JustWatch. DonkTV leur demande des informations sur les films, jamais sur toi.</p></section>
  <section><h2>Supprimer ton compte</h2><p>Dans Réglages › Mon compte › « Supprimer mon compte ». Ton compte, tous tes films et tes amis sont effacés définitivement.</p></section>
  <section><h2>Une question ?</h2><p>Écris à <a href="mailto:vgenauzeau@gmail.com">vgenauzeau@gmail.com</a>.</p></section>
  <section class="carte"><h2>Crédits</h2><p class="credit-tmdb muted" style="font-size:15px"><img src="img/tmdb.png" alt="TMDB"><span>Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Données de plateformes fournies par JustWatch.</span></p></section>`;

function ouvrirConfidentialite() {
  fen.classList.remove('petit');
  fenCorps.innerHTML = `<div class="confid etroit texte">${htmlConfidentialite()}<div class="boutons"><button class="btn primaire" type="button" data-fermer>Fermer</button></div></div>`;
  fen.showModal();
}

// Mon espace (mobile) : ligne « Inviter » pour l'administrateur et pied de page.
const pageMonEspaceBase = pageMonEspace;
PAGES['mon-espace'] = () => pageMonEspaceBase().replace('</nav>', (admin ? `<a href="#inviter"><span class="espace-ico" style="background:#2F7D6D" aria-hidden="true">${svgEspace('M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0M16 19h6M19 16v6M6 21v-2a4 4 0 0 1 4 -4h4')}</span><span><b>Inviter un utilisateur</b><small>Un DonkTV privé pour chacun</small></span>${ICO_FLECHE_D}</a>` : '') + '</nav>')
  + `<div class="pied-m"><div class="pied-m-tete" aria-hidden="true"><img src="img/baudet-tete.png" alt="" onerror="this.parentNode.remove()"></div>
    <div class="pied-m-liens"><a href="#confidentialite">Confidentialité</a><button type="button" data-deconnexion>Se déconnecter</button></div>
    <span>DonkTV · version ${VERSION}</span></div>`;

Object.assign(PAGES, { inviter: () => pageInviter(), confidentialite: () => `<div class="confid etroit texte">${htmlConfidentialite()}</div>` });

/* ---------- Prénom et amis (1.5) ---------- */

// Fonctions SQL de supabase/migration-2026-11-25-amis.sql : un ami ne voit que les films en commun des watchlists.
let mesAmis = [];
const COULEURS_AMIS = [['#2E5B3F', '#FFFFFF'], ['#E3B23C', '#1F3327'], ['#7A5AA6', '#FFFFFF'], ['#C2603A', '#FFFFFF']];
const iniHtml = (a) => `<span class="ini" style="background:${a.fond};color:${a.encre}" aria-hidden="true">${esc(a.nom[0].toUpperCase())}</span>`;

async function chargerAmis() {
  const [l, c] = await Promise.all([lire('amis', () => sb.rpc('amis')), lire('communs', () => sb.rpc('films_en_commun'))]);
  mesAmis = l;
  return l.filter((a) => a.etat === 'ami').map((a, i) => ({ ...a, nom: a.prenom || a.email.split('@')[0], fond: COULEURS_AMIS[i % 4][0], encre: COULEURS_AMIS[i % 4][1],
    films: new Set(c.filter((x) => x.ami === a.ami).map((x) => x.tmdb_id)) }));
}
const amisSurAffiche = (amis, f) => {
  const qui = amis.filter((a) => a.films.has(f.tmdb_id));
  if (!qui.length) return '';
  const vus = qui.slice(0, 3).map(iniHtml).join('') + (qui.length > 3 ? `<span class="ini" style="background:var(--text);color:var(--bg)" aria-hidden="true">+${qui.length - 3}</span>` : '');
  return `<span class="amis-poster" title="${esc(qui.map((a) => a.nom).join(', '))}">${vus}</span>`;
};
const amisTexte = (amis, f) => { const qui = amis.filter((a) => a.films.has(f.tmdb_id)); return qui.length ? `<span class="vh">Aussi dans la watchlist de ${esc(qui.map((a) => a.nom).join(' et '))}</span>` : ''; };
const puceAmi = (a, attr, actif, compte = '') => `<button type="button" class="puce-ami" ${attr}="${esc(a.ami)}" aria-pressed="${actif}">${iniHtml(a)}${esc(a.nom)}${compte !== '' ? `<small>${compte}</small>` : ''}</button>`;

// Pastilles « demandes reçues » : en-tête PC et ligne de Mon espace (mobile).
async function majAmis() {
  await chargerAmis().catch(() => {});
  const n = mesAmis.filter((a) => a.etat === 'recue').length;
  document.querySelectorAll('[data-pastille]').forEach((p) => { p.textContent = n; p.hidden = !n; });
  const b = $('[data-espace-menu]');
  if (n) b.setAttribute('aria-label', `Mon espace, ${pluriel(n, 'demande d’ami reçue', 'demandes d’ami reçues')}`); else b.removeAttribute('aria-label');
}
const oublierAmis = () => { lectures.delete('amis'); lectures.delete('communs'); };

async function pageAmis() {
  oublierAmis();
  await majAmis();
  const ligne = (a, boutons, sous = esc(a.email)) => `<li class="ligne-${a.etat}">${a.etat === 'envoyee' ? '' : iniHtml(a)}<span class="ami-txt"><b>${esc(a.etat === 'envoyee' ? a.email : a.nom)}</b><small>${sous}</small></span>${boutons}</li>`;
  const amis = (await chargerAmis()), recues = mesAmis.filter((a) => a.etat === 'recue'), envoyees = mesAmis.filter((a) => a.etat === 'envoyee');
  const deco = (l) => l.map((a, i) => ({ ...a, nom: a.prenom || a.email.split('@')[0], fond: COULEURS_AMIS[(i + 2) % 4][0], encre: COULEURS_AMIS[(i + 2) % 4][1] }));
  const bloc = (titre, l) => l.length ? `<section style="display:flex;flex-direction:column;gap:14px"><h2>${titre}</h2><ul class="carte invitations amis-liste" style="padding:0;gap:0">${l.join('')}</ul></section>` : '';
  return `<div class="etroit">
    <div class="titre-page"><h1>Mes amis</h1><p class="muted">Tes amis voient seulement les films que vous avez en commun dans vos watchlists. Jamais tes films vus ni tes notes.</p></div>
    <section class="carte" aria-labelledby="ami-titre"><h2 id="ami-titre">Ajouter un ami</h2>
      <form class="invit-form" data-ami-form><label>E-mail de ton ami<input type="email" name="email" autocomplete="off" placeholder="prenom@exemple.fr" required></label>
        <button class="btn primaire" type="submit">Envoyer la demande</button></form>
      <p class="muted" style="margin:0;font-size:14px">Ton ami doit déjà avoir un compte DonkTV. Il voit ta demande ici et peut l’accepter ou la refuser.</p></section>
    ${bloc('Demandes reçues', deco(recues).map((a) => ligne(a, `<button class="btn primaire" type="button" data-ami-accepter="${a.id}">Accepter</button><button class="btn" type="button" data-ami-suppr="${a.id}">Refuser</button>`, `${esc(a.email)} · reçue le ${dateCourte(a.le.slice(0, 10))}`)))}
    ${amis.length ? bloc('Mes amis', amis.map((a) => ligne(a, `<button class="btn danger-trait" type="button" data-ami-retirer="${a.id}" data-nom="${esc(a.nom)}">Retirer</button>`))) : '<section style="display:flex;flex-direction:column;gap:14px"><h2>Mes amis</h2><p class="muted">Pas encore d’ami. Envoie une demande avec son e-mail.</p></section>'}
    ${bloc('Demandes envoyées', envoyees.map((a) => ligne(a, `<span class="statut attente">En attente</span><button class="btn" type="button" data-ami-suppr="${a.id}">Annuler</button>`, `Demande envoyée le ${dateCourte(a.le.slice(0, 10))}`)))}
  </div>`;
}

async function actionAmi(fn, args, b, msg) {
  b.disabled = true;
  const { data, error } = await sb.rpc(fn, args);
  b.disabled = false;
  if (error) return toast(error.message.startsWith('Aucun') || error.message.startsWith('C’est') ? error.message : 'Action impossible : ' + error.message);
  oublierAmis();
  toast(typeof msg === 'function' ? msg(data) : msg);
  if (fen.open) fen.close();
  route();
}
$('#page').addEventListener('submit', (e) => {
  if (!e.target.matches('[data-ami-form]')) return;
  e.preventDefault();
  actionAmi('demander_ami', { email: e.target.email.value }, $('button', e.target), (r) => ({ acceptee: 'Vous êtes maintenant amis.', deja: 'Vous êtes déjà amis.' }[r] || 'Demande envoyée'));
});
$('#page').addEventListener('click', (e) => {
  const b = e.target.closest('button'), d = b?.dataset;
  if (d?.amiAccepter) actionAmi('accepter_ami', { id: Number(d.amiAccepter) }, b, 'Vous êtes maintenant amis.');
  else if (d?.amiSuppr) actionAmi('supprimer_ami', { id: Number(d.amiSuppr) }, b, 'C’est fait.');
  else if (d?.amiRetirer) {
    fen.classList.add('petit');
    fenCorps.innerHTML = `<div class="confirmation" role="alertdialog" aria-labelledby="ra-titre" aria-describedby="ra-texte">
      <div><h2 id="ra-titre">Retirer ${esc(d.nom)} de tes amis ?</h2><p id="ra-texte" class="muted">Vous ne verrez plus vos films en commun. Vos watchlists ne changent pas.</p></div>
      <div class="boutons"><button class="btn" type="button" data-fermer autofocus>Annuler</button><button class="btn danger" type="button" data-ami-confirmer="${esc(d.amiRetirer)}">Retirer</button></div></div>`;
    fen.showModal();
  }
});
fen.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ami-confirmer]');
  if (b) actionAmi('supprimer_ami', { id: Number(b.dataset.amiConfirmer) }, b, 'Ami retiré.');
});

// Comptes créés avant la 1.5 : le prénom est demandé une fois, à la connexion suivante.
function demanderPrenom() {
  fen.classList.add('petit');
  fenCorps.innerHTML = `<form class="confirmation" data-prenom-form aria-labelledby="pr-titre">
    <div><h2 id="pr-titre">Comment tu t’appelles ?</h2><p class="muted">Ton prénom apparaîtra chez tes amis dans DonkTV.</p></div>
    <label class="compte-email">Ton prénom<input name="prenom" type="text" autocomplete="given-name" maxlength="40" required autofocus></label>
    <div class="boutons"><button class="btn primaire" type="submit">Enregistrer</button></div></form>`;
  fen.showModal();
}
fen.addEventListener('submit', async (e) => {
  if (!e.target.matches('[data-prenom-form]')) return;
  e.preventDefault();
  const b = $('button', e.target), prenom = e.target.prenom.value.trim();
  if (!prenom) return;
  b.disabled = true;
  try { await enregistrerReglages({ prenom }); fen.close(); toast(`Merci ${prenom} !`); }
  catch (err) { toast(err.message); b.disabled = false; }
});

// Réglages › Mon compte : prénom modifiable.
$('#page').addEventListener('submit', async (e) => {
  if (!e.target.matches('[data-prenom-reglages]')) return;
  e.preventDefault();
  const b = $('button', e.target), prenom = e.target.prenom.value.trim();
  if (!prenom) return toast('Indique ton prénom.');
  b.disabled = true;
  try { await enregistrerReglages({ prenom }); toast('Prénom enregistré.'); }
  catch (err) { toast(err.message); }
  finally { b.disabled = false; }
});

PAGES.amis = () => pageAmis();
