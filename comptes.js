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
    return `<li><span><b>${esc(i.email)}</b><small>Invitation envoyée le ${dateLongue(i.invite_le.slice(0, 10))}</small></span>
      <span class="statut ${cls}">${statut}</span>
      ${i.cree ? `<button class="btn danger-trait" type="button" data-retirer="${esc(i.id)}">Retirer l’accès</button>`
        : `<button class="btn" type="button" data-renvoyer="${esc(i.email)}">Renvoyer</button>`}</li>`;
  };
  return `<div class="etroit">
    <div class="titre-page"><h1>Inviter un utilisateur</h1><p class="muted">L’utilisateur aura son propre DonkTV, complètement privé : ni toi ni lui ne voyez les films de l’autre.</p></div>
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
const htmlConfidentialite = () => `<div class="titre-page"><h1>Confidentialité</h1><p class="muted">Mise à jour le 19 novembre 2026. En bref : tes films restent à toi.</p></div>
  <section><h2>Ce que DonkTV garde</h2><ul><li>Ton adresse e-mail et ton mot de passe (chiffré), pour te connecter.</li>
    <li>Les films que tu ajoutes : vus, watchlist, notes, coups de cœur, dates, tops et sagas.</li><li>Tes réglages : thème, plateformes choisies.</li></ul></section>
  <section><h2>Ce que DonkTV ne fait pas</h2><ul><li>Aucune publicité, aucun traqueur, aucune mesure d’audience.</li>
    <li>Aucune vente ni aucun partage de tes données.</li><li>Aucun partage entre comptes : personne d’autre ne voit tes films.</li></ul></section>
  <section><h2>Où sont tes données ?</h2><p>Elles sont hébergées chez Supabase${REGION_BASE ? ', ' + REGION_BASE : ''}. Les affiches, résumés et castings viennent de TMDB ; les notes des critiques, d’OMDb ; les plateformes de streaming, de JustWatch. DonkTV leur demande des informations sur les films, jamais sur toi.</p></section>
  <section><h2>Supprimer ton compte</h2><p>Dans Réglages › Mon compte › « Supprimer mon compte ». Ton compte et tous tes films sont effacés définitivement.</p></section>
  <section><h2>Une question ?</h2><p>Écris à <a href="mailto:vgenauzeau@gmail.com">vgenauzeau@gmail.com</a>.</p></section>
  <section class="carte"><h2>Crédits</h2><p class="credit-tmdb muted" style="font-size:15px">Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Données de plateformes fournies par JustWatch.</p></section>`;

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
    <span class="credit-tmdb">Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Plateformes de streaming : JustWatch.</span>
    <span>DonkTV · version ${VERSION}</span></div>`;

Object.assign(PAGES, { inviter: () => pageInviter(), confidentialite: () => `<div class="confid etroit texte">${htmlConfidentialite()}</div>` });
