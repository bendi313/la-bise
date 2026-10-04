// L'écran de La Bise. Les calculs sont dans moteur/, labo.js, themes.js et textes.js (tous testés avec Node).

import { contexte, NOMS_CRITERES, LOIS } from './moteur/criteres.js';
import * as monLabo from './moteur/monlabo.js';
import { PROFILS, NOMBRES_DE_GRILLES, DOSAGES, FETICHES_MAX, charger, sauver, valider, validerFetiches, profilActif } from './moteur/reglages.js';
import { generer } from './moteur/generateur.js';
import { versCSV, versJSON, versTicket, telecharger } from './moteur/export.js';
import { rejouer } from './moteur/rejeu.js';
import * as carnetOutils from './moteur/carnet.js';
import * as deckOutils from './moteur/decks.js';
import { THEMES, CATEGORIES, COULEURS_PERSO, appliquer, palette, couleurThermique } from './themes.js';
import { ficheNumero, pourcent, jauge, enquetesDuNumero, bilanEnquetes, resumeFiche } from './labo.js';
import { phraseProfil, phraseFetiches, definitionStyle, nombre, signe, dateFr, MENTIONS } from './textes.js';

const $ = (id) => document.getElementById(id);
const AFFICHEES_MAX = 50;
const MENU = [['grilles', 'Grilles'], ['carnet', 'Carnet'], ['numeros', 'Numéros'], ['mesures', 'Mesures'], ['reglages', 'Réglages']];
const MODES = {
  chaud: { nom: 'Forme récente', froid: 'Sorti peu récemment', chaud: 'Souvent sorti récemment' },
  retard: { nom: 'Retard', froid: 'Sorti il y a peu', chaud: 'Absent depuis longtemps' },
  frequence: { nom: 'Depuis 2004', froid: 'Moins sorti', chaud: 'Plus sorti' },
  foule: { nom: 'Joué par la foule', froid: 'Très peu joué', chaud: 'Très joué' },
};
// Les deux familles d'enquêtes, chacune avec sa couleur (variables CSS du thème).
const FAMILLES = { insolites: { nom: 'Dates insolites', classe: 'famille-dates' }, boulier: { nom: 'Anomalies du boulier', classe: 'famille-boulier' },
  experiences: { nom: 'Expériences du labo', classe: 'famille-experiences' } };
const AIDE_JAUGE = 'La zone claire est ce que le hasard normal donne 19 fois sur 20. Le trait fin est la moyenne du hasard. Le repère épais est ce qui a été observé.';
// La teinte d'une boule, après passage par les seuils réglés par l'utilisateur.
const teinte = (t) => couleurThermique(t, pal, reglages.seuils);

let D = null, ctx = null, pal = null, indexDates = null, dernierTirage = null;
let stockage = localStorage;
let reglages = charger(stockage);
let decks = deckOutils.charger(stockage);
let carnet = carnetOutils.charger(stockage);
let labo = monLabo.charger(stockage);
const etat = { vue: 'grilles', grilles: [], mode: 'chaud', choisi: null, sousVue: 'rejeu', rapide: false, rejeu: null, message: '',
  labo: { fil: [], spec: null, question: '', dernier: null, menus: false } };

const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lireListe = (texte) => (String(texte).match(/\d+/g) || []).map(Number);
const pluriel = (n, mot) => `${nombre(n)} ${mot}${n > 1 ? 's' : ''}`;

function memoriser() {
  reglages = valider(reglages);
  sauver(stockage, reglages);
  ctx = construireContexte();
}

function habiller() {
  appliquer(document.documentElement, reglages.theme, reglages.perso);
  pal = palette(reglages.theme, reglages.perso);
  document.querySelector('meta[name="theme-color"]').content = pal.fond;
}

function boule(valeur, chaleur, etoile = false, classe = '') {
  return `<span class="boule${etoile ? ' etoile' : ''}${classe}" style="--t:${teinte(chaleur)}">${valeur}</span>`;
}

// `bons` : numéros et étoiles sortis au tirage, mis en valeur (carnet).
function boulesGrille(g, bons = null) {
  const marque = (liste, v) => (bons ? (liste.includes(v) ? ' bon' : ' rate') : '');
  return '<div class="boules">' + g.numeros.map((n) => boule(n, ctx.stats.centChaudN[n - 1], false, marque(bons?.numeros ?? [], n))).join('') +
    g.etoiles.map((e) => boule(e, ctx.stats.centChaudE[e - 1], true, marque(bons?.etoiles ?? [], e))).join('') + '</div>';
}

// ---------- Grilles ----------

function transparence() {
  const actif = profilActif(reglages);
  const bloc = (cle, nom) => `<p class="definition"><b>${nom} :</b> ${definitionStyle(cle, reglages)}</p><p class="transparence"><b>Ce que le laboratoire a mesuré.</b> ${phraseProfil(cle, D.rejeu)}</p>`;
  const styles = actif !== 'mixte'
    ? bloc(actif, PROFILS.find((p) => p.cle === actif).nom)
    : '<p class="definition"><b>Mon mélange :</b> les grilles sont notées sur plusieurs styles à la fois, selon les poids des « Réglages fins ».</p>' +
      Object.keys(NOMS_CRITERES).filter((c) => reglages.poids[c] > 0).map((c) => bloc(c, PROFILS.find((p) => p.cle === c).nom)).join('');
  const fetiches = phraseFetiches(reglages.fetiches, D.populaire);
  const lois = loisCochees().map((l) => `<p class="definition"><b>Loi du labo — ${l.nom} :</b> ${l.texte}</p>` +
    `<p class="transparence"><b>Ce que le laboratoire a mesuré.</b> ${l.mesure}</p>`).join('');
  return styles + lois + (fetiches ? `<p class="transparence">${fetiches}</p>` : '');
}

// Les lois du labo cochées pour la génération : les trois lois intégrées et celles tirées de Mon Labo.
function loisCochees() {
  const fiche = (cle) => D.experiences.fiches.find((f) => f.cle === cle);
  const mesures = {
    gauss: `Loi appliquée par goût : elle ne change pas la chance de gagner. ${fiche('retour').complement} ${fiche('retour').lecture}`,
    corde: `Loi appliquée par goût : elle ne change pas la chance de gagner. ${fiche('corde').complement} ${fiche('corde').lecture}`,
    entropie: `Loi appliquée par goût : elle ne change pas la chance de gagner. Les tirages réels ne sont ni plus ni moins dispersés que le hasard ne le veut. ${fiche('entropie').lecture}`,
  };
  return [
    ...Object.keys(LOIS).filter((cle) => reglages.lois[cle]).map((cle) => ({ cle, nom: LOIS[cle].nom, texte: LOIS[cle].texte, mesure: mesures[cle] })),
    ...loisPersoActives().map(({ id, loi }) => ({ cle: id, nom: 'Mon Labo', texte: `Garde les grilles où « ${loi.texte} ».`,
      mesure: 'Loi tirée d\'une de vos mesures : elle décrit une forme de grille, elle ne change pas la chance de gagner.' })),
  ];
}

// Les mesures de Mon Labo cochées comme lois, sous la forme attendue par le moteur.
function loisPersoActives() {
  return labo.mesures.filter((m) => reglages.loisPerso.includes(m.id)).map((m) => ({ id: m.id, loi: monLabo.loiDeGrille(m.spec) })).filter((x) => x.loi);
}

const construireContexte = () => contexte(D, reglages, loisPersoActives());

function carteGrille(g, i) {
  const respect = g.respect === null
    ? '<div class="mesure"><span>Respect de vos réglages</span><b>hasard pur</b></div>'
    : `<div class="mesure"><span>Respect de vos réglages</span><b>${nombre(g.respect)} %</b></div><div class="jauge"><i style="width:${g.respect}%"></i></div>`;
  const detail = Object.keys(NOMS_CRITERES).map((c) => `<tr><td>${NOMS_CRITERES[c]}</td><td>${nombre(100 * g.notes[c])} %</td><td>poids ${reglages.poids[c]}</td></tr>`).join('') +
    (g.notes.fetiches === null ? '' : `<tr><td>Fétiches</td><td>${nombre(100 * g.notes.fetiches)} %</td><td>poids ${DOSAGES[reglages.dosage].poids}</td></tr>`) +
    loisCochees().map((l) => `<tr><td>Loi : ${l.nom}</td><td>${nombre(100 * (g.notes.lois?.[l.cle] ?? 0))} %</td><td>poids 100</td></tr>`).join('');
  return `<div class="carte grille" style="animation-delay:${Math.min(i, 12) * 60}ms">${boulesGrille(g)}${respect}` +
    `<div class="mesure"><span>Effet de partage estimé</span><b>${signe(g.partage.gain, 1)} % de gain si elle sort</b></div>` +
    `<details><summary>Détail</summary><table>${detail}</table>` +
    `<p class="discret">Somme des numéros : ${g.numeros.reduce((a, b) => a + b, 0)}. Estimation : ${signe(g.partage.gagnants, 1)} % de gagnants par rapport à une grille ordinaire. Cette estimation vient des petits rangs ; qu'elle vaille aussi pour le gros lot est une supposition.</p></details>` +
    `<div class="ligne"><button class="bouton" data-carnet="${i}">Ajouter au carnet</button></div></div>`;
}

function lancer() {
  etat.grilles = generer(reglages.nombre, reglages, ctx, D.populaire);
  resultats();
}

function nomDuStyle() {
  const actif = profilActif(reglages);
  return actif === 'mixte' ? 'Mon mélange' : PROFILS.find((p) => p.cle === actif).nom;
}

function vueRapide(racine) {
  racine.innerHTML = `<div class="carte"><h2>Mode rapide</h2><p class="discret">${nomDuStyle()} · ${pluriel(reglages.nombre, 'grille')}` +
    (reglages.fetiches.length ? ` · fétiches ${reglages.fetiches.join(', ')}` : '') + `</p>${transparence()}` +
    '<button class="bouton principal" id="generer">GÉNÉRER</button>' +
    '<div class="ligne"><button class="bouton" id="quitter-rapide">Quitter le mode rapide</button></div></div><div id="resultats"></div>';
  $('generer').onclick = lancer;
  $('quitter-rapide').onclick = () => { etat.rapide = false; afficher(); };
  resultats();
}

function vueGrilles(racine) {
  if (etat.rapide) { vueRapide(racine); return; }
  const actif = profilActif(reglages), deckCourant = deckOutils.deckActif(decks, reglages);
  racine.innerHTML = '<div class="carte"><div class="entete"><h2>Mon style de jeu</h2><button class="bouton" id="rapide">⚡ Mode rapide</button></div>' +
    '<div class="puces">' + PROFILS.map((p) => `<button class="puce${p.cle === actif ? ' actif' : ''}" data-profil="${p.cle}">${p.nom}</button>`).join('') +
    (actif === 'mixte' ? '<button class="puce actif">Mon mélange</button>' : '') + '</div>' + transparence() +

    '<details id="d-decks"><summary>Mes decks' + (deckCourant ? ` — ${deckCourant}` : '') + '</summary>' +
    (decks.length ? '<div class="puces">' + decks.map((d) => `<button class="puce${d.nom === deckCourant ? ' actif' : ''}" data-deck="${d.nom}">${d.nom}</button>`).join('') + '</div>'
      : '<p class="discret">Un deck garde toute la configuration en cours (style, réglages fins, fétiches, thème, affichage) sous un nom.</p>') +
    `<div class="ligne"><input id="deck-nom" maxlength="30" placeholder="Nom du deck" value="${deckCourant ?? ''}"><button class="bouton" id="deck-garder">Enregistrer</button>` +
    (deckCourant ? '<button class="bouton" id="deck-oter">Supprimer</button>' : '') + '</div><p class="discret" id="deck-message"></p></details>' +

    '<details id="d-fins"><summary>Réglages fins</summary>' +
    Object.keys(NOMS_CRITERES).map((c) => `<div class="curseur"><span>${NOMS_CRITERES[c]}</span><input type="range" min="0" max="100" step="5" value="${reglages.poids[c]}" data-poids="${c}"><span>${reglages.poids[c]}</span></div>`).join('') +
    `<div class="ligne"><label>« Chaud » sur les <input type="number" id="r-fenetre" min="5" max="200" value="${reglages.fenetreChaud}"> derniers tirages</label></div>` +
    `<div class="ligne"><label>Somme entre <input type="number" id="r-min" min="15" max="240" value="${reglages.sommeMin}"> et <input type="number" id="r-max" min="15" max="240" value="${reglages.sommeMax}"></label></div>` +
    `<h3>Numéros fétiches</h3><div class="ligne"><label>Jusqu'à ${FETICHES_MAX} numéros <input id="r-fetiches" inputmode="numeric" placeholder="ex. 7 13 21" value="${reglages.fetiches.join(' ')}"></label></div>` +
    `<div class="ligne"><label>Dosage <select id="r-dosage">${Object.entries(DOSAGES).map(([cle, d]) => `<option value="${cle}"${cle === reglages.dosage ? ' selected' : ''}>${d.nom} — ${d.texte}</option>`).join('')}</select></label></div>` +
    '</details>' +

    `<details id="d-lois"><summary>Tirage Labo / Expérimental${loisCochees().length ? ` — ${loisCochees().length} loi${loisCochees().length > 1 ? 's' : ''}` : ''}</summary>` +
    '<p class="discret">Cochez les lois du labo à appliquer aux grilles. Chacune compte comme un style à plein poids. Aucune ne change la chance de gagner.</p>' +
    Object.entries(LOIS).map(([cle, l]) => `<label class="case"><input type="checkbox" data-loi="${cle}"${reglages.lois[cle] ? ' checked' : ''}><span><b>${l.nom}.</b> ${l.texte}</span></label>`).join('') +
    labo.mesures.filter((m) => monLabo.loiDeGrille(m.spec)).map((m) => `<label class="case"><input type="checkbox" data-loi-perso="${encodeURIComponent(m.id)}"${reglages.loisPerso.includes(m.id) ? ' checked' : ''}>` +
      `<span><b>Mon Labo.</b> Grilles où « ${monLabo.loiDeGrille(m.spec).texte} »</span></label>`).join('') +
    (labo.mesures.length ? '' : '<p class="discret">Les mesures enregistrées dans « Mon Labo » (onglet Mesures) apparaîtront ici.</p>') +
    '</details>' +

    `<div class="ligne"><label>Nombre de grilles <select id="r-nombre">${NOMBRES_DE_GRILLES.map((n) => `<option${n === reglages.nombre ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` +
    `<label>Affichage <select id="r-affichage"><option value="moderne"${reglages.affichage === 'moderne' ? ' selected' : ''}>Moderne</option><option value="ticket"${reglages.affichage === 'ticket' ? ' selected' : ''}>Ticket rétro</option></select></label></div>` +
    '<button class="bouton principal" id="generer">GÉNÉRER</button></div><div id="resultats"></div>';

  const garder = (...ouverts) => { afficher(); ouverts.forEach((id) => { $(id).open = true; }); };
  racine.querySelectorAll('[data-profil]').forEach((b) => {
    b.onclick = () => { reglages.poids = { ...PROFILS.find((p) => p.cle === b.dataset.profil).poids }; memoriser(); afficher(); };
  });
  racine.querySelectorAll('[data-poids]').forEach((c) => {
    c.oninput = () => { c.nextElementSibling.textContent = c.value; };
    c.onchange = () => { reglages.poids[c.dataset.poids] = Number(c.value); memoriser(); garder('d-fins'); };
  });
  const champ = (id, cle, lireValeur = (v) => Number(v)) => { $(id).onchange = () => { reglages[cle] = lireValeur($(id).value); memoriser(); garder('d-fins'); }; };
  champ('r-fenetre', 'fenetreChaud'); champ('r-min', 'sommeMin'); champ('r-max', 'sommeMax');
  champ('r-fetiches', 'fetiches', (v) => validerFetiches(lireListe(v))); champ('r-dosage', 'dosage', (v) => v);
  racine.querySelectorAll('[data-loi]').forEach((c) => { c.onchange = () => { reglages.lois[c.dataset.loi] = c.checked; memoriser(); garder('d-lois'); }; });
  racine.querySelectorAll('[data-loi-perso]').forEach((c) => {
    c.onchange = () => {
      const id = decodeURIComponent(c.dataset.loiPerso);
      reglages.loisPerso = c.checked ? [...reglages.loisPerso, id] : reglages.loisPerso.filter((x) => x !== id);
      memoriser(); garder('d-lois');
    };
  });
  $('r-nombre').onchange = () => { reglages.nombre = Number($('r-nombre').value); memoriser(); };
  $('r-affichage').onchange = () => { reglages.affichage = $('r-affichage').value; memoriser(); resultats(); };
  $('generer').onclick = lancer;
  $('rapide').onclick = () => { etat.rapide = true; afficher(); lancer(); };

  racine.querySelectorAll('[data-deck]').forEach((b) => {
    b.onclick = () => { reglages = deckOutils.appliquer(reglages, decks.find((d) => d.nom === b.dataset.deck)); memoriser(); habiller(); garder('d-decks'); };
  });
  $('deck-garder').onclick = () => {
    const suite = deckOutils.enregistrer(decks, $('deck-nom').value, reglages);
    if (typeof suite === 'string') { $('deck-message').textContent = suite; return; }
    decks = suite; deckOutils.sauver(stockage, decks); garder('d-decks');
  };
  if ($('deck-oter')) $('deck-oter').onclick = () => { decks = deckOutils.supprimer(decks, deckCourant); deckOutils.sauver(stockage, decks); garder('d-decks'); };
  resultats();
}

function ajouterAuCarnet(grilles) {
  const date = carnetOutils.prochainTirage(aujourdhui());
  let ajoutees = 0;
  grilles.forEach((g) => {
    const entree = carnetOutils.preparer(g.numeros, g.etoiles, date);
    if (typeof entree !== 'string') { const avant = carnet.length; carnet = carnetOutils.ajouter(carnet, entree); ajoutees += carnet.length - avant; }
  });
  carnetOutils.sauver(stockage, carnet);
  return `${pluriel(ajoutees, 'grille')} ajoutée${ajoutees > 1 ? 's' : ''} au carnet pour le tirage du ${dateFr(date)}.`;
}

function resultats() {
  const zone = $('resultats');
  if (!zone) return;
  if (!etat.grilles.length) { zone.innerHTML = ''; return; }
  const total = etat.grilles.length, visibles = etat.grilles.slice(0, AFFICHEES_MAX);
  const corps = reglages.affichage === 'ticket'
    ? `<div class="ticket grille"><pre>${versTicket(etat.grilles, dateFr(aujourdhui()))}</pre></div>`
    : visibles.map(carteGrille).join('');
  zone.innerHTML = corps + '<div class="carte">' +
    (total > AFFICHEES_MAX && reglages.affichage !== 'ticket' ? `<p class="discret">${total} grilles générées, ${AFFICHEES_MAX} affichées. L'export et le ticket les contiennent toutes.</p>` : '') +
    '<div class="ligne">' + (reglages.affichage === 'ticket' ? '<button class="bouton" id="x-copier">Copier le ticket</button>' : '') +
    (total <= AFFICHEES_MAX ? '<button class="bouton" id="x-carnet">Tout ajouter au carnet</button>' : '') +
    '<button class="bouton" id="x-csv">Exporter en CSV</button><button class="bouton" id="x-json">Exporter en JSON</button></div>' +
    '<p class="discret" id="x-message"></p>' +
    '<p class="discret">Chaque grille a exactement la même chance de sortir que n\'importe quelle autre : 1 sur 139 838 160 pour le gros lot.</p></div>';
  $('x-csv').onclick = () => telecharger('la-bise-grilles.csv', versCSV(etat.grilles), 'text/csv;charset=utf-8');
  $('x-json').onclick = () => telecharger('la-bise-grilles.json', versJSON(etat.grilles, reglages), 'application/json');
  if ($('x-carnet')) $('x-carnet').onclick = () => { $('x-message').textContent = ajouterAuCarnet(etat.grilles); };
  if ($('x-copier')) {
    $('x-copier').onclick = () => navigator.clipboard.writeText(versTicket(etat.grilles, dateFr(aujourdhui())))
      .then(() => { $('x-message').textContent = 'Ticket copié.'; }, () => { $('x-message').textContent = 'La copie n\'a pas fonctionné sur cet appareil.'; });
  }
  zone.querySelectorAll('[data-carnet]').forEach((b) => {
    b.onclick = () => { b.textContent = ajouterAuCarnet([etat.grilles[Number(b.dataset.carnet)]]); b.disabled = true; };
  });
}

// ---------- Carnet ----------

const NOMS_RANGS = (e) => `${pluriel(e.bonsNumeros, 'numéro')} et ${pluriel(e.bonnesEtoiles, 'étoile')}`;

function ligneCarnet(entree) {
  const e = carnetOutils.etatEntree(entree, D, indexDates, dernierTirage);
  let statut, bons = null;
  if (e.statut === 'attente') statut = '<b>En attente du tirage</b>';
  else if (e.statut === 'introuvable') statut = 'Tirage absent des données';
  else {
    bons = { numeros: e.tirage.slice(1, 6), etoiles: e.tirage.slice(6, 8) };
    statut = e.rang
      ? `<b>${NOMS_RANGS(e)} — rang ${e.rang} — ${e.inconnu ? 'montant inconnu (rang non gagné ce soir-là dans la source)' : nombre(e.gain, 2) + ' €'}</b>`
      : `${NOMS_RANGS(e)} — rien gagné`;
  }
  return `<div class="carte"><p class="discret">Tirage du ${dateFr(entree.date)}</p>${boulesGrille(entree, bons)}<div class="mesure"><span>${statut}</span></div>` +
    `<div class="ligne"><button class="bouton" data-rejouer="${entree.id}">Tester dans le temps</button><button class="bouton" data-oter="${entree.id}">Supprimer</button></div></div>`;
}

function courbe(points) {
  const L = 320, H = 90, soldes = points.map((p) => p.solde), min = Math.min(0, ...soldes), max = Math.max(0, ...soldes);
  const x = (i) => (points.length > 1 ? (i * L) / (points.length - 1) : 0), y = (v) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  return `<svg viewBox="0 0 ${L} ${H}" class="courbe" role="img"><line x1="0" x2="${L}" y1="${y(0)}" y2="${y(0)}" class="zero"/>` +
    `<polyline points="${points.map((p, i) => `${x(i).toFixed(1)},${y(p.solde).toFixed(1)}`).join(' ')}"/></svg>` +
    `<div class="echelle-textes"><span>${dateFr(points[0].date)}</span><span>solde final : ${nombre(soldes[soldes.length - 1])} €</span></div>`;
}

// La chronologie d'une grille : une frise des années, puis chaque tirage où elle a touché, avec les boules du vrai tirage.
// Dans chaque tirage affiché, les numéros et étoiles de la grille testée sont entourés ; les autres sont estompés.
function htmlChronologie(r) {
  const res = r.resultat, max = Math.max(1, ...res.parAnnee.map((a) => a.touches));
  const frise = res.parAnnee.map((a) => `<button class="annee${r.annee === a.annee ? ' choisie' : ''}" data-annee="${a.annee}" ` +
    `title="${a.annee} : ${a.touches} tirage(s) gagnant(s) sur ${a.tirages}">` +
    `<i style="height:${Math.max(4, (100 * a.touches) / max)}%;background:${a.meilleurRang ? couleurThermique(1 - (a.meilleurRang - 1) / 12, pal) : 'var(--bord)'}"></i>` +
    `<b>${a.touches}</b><small>${a.annee.slice(2)}</small></button>`).join('');
  const rangMax = r.rangMax ?? 13;
  const touches = res.touches.filter((t) => (!r.annee || t.date.startsWith(r.annee)) && t.rang <= rangMax).reverse();
  const annee = r.annee ? res.parAnnee.find((a) => a.annee === r.annee) : null;
  const ligne = (t) => `<div class="touche"><div class="entete"><b>${dateFr(t.date)}</b><span class="reponse${t.rang <= 9 ? ' oui' : ''}">Rang ${t.rang}</span></div>` +
    `${boulesGrille(t, r.grille)}<p class="discret">${pluriel(t.bonsNumeros, 'bon numéro').replace('bon numéros', 'bons numéros')} et ${pluriel(t.bonnesEtoiles, 'bonne étoile').replace('bonne étoiles', 'bonnes étoiles')} — ` +
    `<b>${t.inconnu ? 'montant inconnu (personne n\'avait gagné ce rang ce soir-là)' : nombre(t.gain, 2) + ' €'}</b></p></div>`;
  return '<h3>Chronologie : les tirages où la grille a touché</h3>' +
    '<p class="discret">Une colonne par année : la hauteur donne le nombre de tirages gagnants, la couleur le meilleur rang de l\'année (plus chaud = meilleur rang). Touchez une année pour n\'afficher qu\'elle.</p>' +
    `<div class="frise">${frise}</div>` +
    `<div class="ligne"><label>Afficher <select id="chrono-rang">${[[13, 'tous les rangs'], [11, 'rang 11 ou mieux'], [9, 'rang 9 ou mieux'], [6, 'rang 6 ou mieux']]
      .map(([v, nom]) => `<option value="${v}"${v === rangMax ? ' selected' : ''}>${nom}</option>`).join('')}</select></label>` +
    (r.annee ? '<button class="bouton" id="chrono-tout">Toutes les années</button>' : '') + '</div>' +
    `<p class="legende-filtre">${annee ? `${annee.annee} : ${pluriel(annee.touches, 'tirage gagnant').replace('tirage gagnants', 'tirages gagnants')} sur ${annee.tirages}, ${nombre(annee.cout)} € misés, ${nombre(annee.gains, 2)} € récupérés`
      : `${pluriel(touches.length, 'tirage affiché').replace('tirage affichés', 'tirages affichés')}, du plus récent au plus ancien`}</p>` +
    (touches.length ? `<div class="haut touches">${touches.map(ligne).join('')}</div>` : '<p class="discret">Aucun tirage gagnant avec ce filtre.</p>') +
    '<p class="discret">Dans chaque tirage : les boules entourées sont celles de votre grille, les autres sont estompées. Les couleurs des boules suivent la forme récente du numéro, comme ailleurs.</p>';
}

function carteRejeu(r) {
  const res = r.resultat;
  const rangs = res.parRang.map((n, i) => (n ? `<tr><td>Rang ${i + 1}</td><td>${nombre(n)} fois</td></tr>` : '')).join('');
  return `<div class="carte" id="rejeu"><div class="entete"><h2>Ma grille dans le temps</h2><button class="bouton" id="rejeu-fermer">Fermer</button></div>${boulesGrille(r.grille)}` +
    `<p class="discret">${nombre(res.tirages)} tirages, du ${dateFr(res.debut)} au ${dateFr(res.fin)}, une grille à chaque tirage.</p>` +
    `<div class="mesure"><span>Misé</span><b>${nombre(res.cout)} €</b></div><div class="mesure"><span>Récupéré</span><b>${nombre(res.gains, 2)} €</b></div>` +
    `<div class="mesure"><span>Rendu pour 100 € misés</span><b>${nombre(res.rendu, 1)} €</b></div>` +
    `<div class="mesure"><span>Tirages gagnants</span><b>${nombre(res.gagnantes)} (${nombre((100 * res.gagnantes) / res.tirages, 1)} %)</b></div>` +
    `<div class="mesure"><span>Meilleur rang atteint</span><b>${res.meilleurRang ?? 'aucun'}</b></div>` +
    `<div class="mesure"><span>Plus longue série sans gain</span><b>${nombre(res.serieMax)} tirages</b></div>` +
    `<h3>Solde au fil des tirages</h3>${courbe(res.courbe)}` +
    `<div id="chrono">${htmlChronologie(r)}</div>` +
    (rangs ? `<details><summary>Détail des rangs</summary><table>${rangs}</table>` +
      (res.meilleurs.length ? '<p class="discret">Meilleurs tirages : ' + res.meilleurs.map((m) => `${dateFr(m.date)} (rang ${m.rang}, ${m.gain ? nombre(m.gain, 2) + ' €' : 'montant inconnu'})`).join(' ; ') + '.</p>' : '') + '</details>' : '') +
    (res.inconnus ? `<p class="discret">${pluriel(res.inconnus, 'rang')} atteint${res.inconnus > 1 ? 's' : ''} un soir où personne ne l'avait gagné : le montant réel est inconnu et compté pour 0.</p>` : '') +
    `<p class="transparence">Ce rejeu décrit le passé de cette grille. Il ne dit rien de son avenir : au prochain tirage, elle a la même chance que toutes les autres. À titre de repère, une grille tirée au hasard rend environ ${nombre(D.rejeu.profils.hasard.retour, 0)} € pour 100 € misés sur la durée.</p>` +
    '<p class="discret">Prix belge de la grille (2 € puis 2,50 € depuis septembre 2016) ; montants publiés par la FDJ. Une grille avec l\'étoile 10, 11 ou 12 n\'est rejouée que depuis que cette étoile existe.</p></div>';
}

function vueCarnet(racine) {
  const b = carnetOutils.bilan(carnet, D, indexDates, dernierTirage);
  racine.innerHTML = '<div class="carte"><h2>Mon carnet</h2><p class="discret">Les grilles que vous avez réellement jouées. Elles restent sur cet appareil et sont vérifiées dès que le tirage est dans les données.</p>' +
    `<div class="ligne"><label>5 numéros <input id="c-numeros" inputmode="numeric" placeholder="ex. 3 17 28 41 49"></label></div>` +
    `<div class="ligne"><label>2 étoiles <input id="c-etoiles" inputmode="numeric" placeholder="ex. 2 11"></label><label>Tirage du <input type="date" id="c-date" value="${carnetOutils.prochainTirage(aujourdhui())}"></label></div>` +
    '<div class="ligne"><button class="bouton" id="c-ajouter">Ajouter au carnet</button><button class="bouton" id="c-tester">Tester ma grille dans le temps</button></div>' +
    '<p class="discret">« Tester ma grille dans le temps » rejoue cette combinaison sur tous les tirages depuis 2004 : bilan, chronologie année par année, et chaque tirage où elle a touché.</p>' +
    `<p class="discret" id="c-message">${etat.message}</p></div>` +
    (carnet.length ? '<div class="carte"><h2>Bilan du carnet</h2>' +
      `<div class="mesure"><span>Grilles notées</span><b>${nombre(b.grilles)} (${nombre(b.attente)} en attente)</b></div>` +
      `<div class="mesure"><span>Misé sur les tirages connus</span><b>${nombre(b.cout, 2)} €</b></div>` +
      `<div class="mesure"><span>Gagné</span><b>${nombre(b.gains, 2)} € · ${pluriel(b.gagnantes, 'grille gagnante').replace('grille gagnantes', 'grilles gagnantes')}</b></div>` +
      `<p class="discret">Dernier tirage connu : ${dateFr(dernierTirage)}. Les données se mettent à jour quand l'application est republiée.</p></div>` : '') +
    `<div id="zone-rejeu">${etat.rejeu ? carteRejeu(etat.rejeu) : ''}</div>` +
    carnet.map(ligneCarnet).join('');
  etat.message = '';

  const saisie = () => carnetOutils.preparer(lireListe($('c-numeros').value), lireListe($('c-etoiles').value), $('c-date').value);
  const montrerRejeu = (grille) => { etat.rejeu = { grille, resultat: rejouer(grille, D) }; afficher(); $('rejeu').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('c-ajouter').onclick = () => {
    const entree = saisie();
    if (typeof entree === 'string') { $('c-message').textContent = entree; return; }
    carnet = carnetOutils.ajouter(carnet, entree); carnetOutils.sauver(stockage, carnet);
    etat.message = `Grille ajoutée pour le tirage du ${dateFr(entree.date)}.`; afficher();
  };
  $('c-tester').onclick = () => {
    // pour un test, la date ne compte pas : on prend un jour de tirage quelconque
    const entree = carnetOutils.preparer(lireListe($('c-numeros').value), lireListe($('c-etoiles').value), dernierTirage);
    if (typeof entree === 'string') { $('c-message').textContent = entree; return; }
    montrerRejeu({ numeros: entree.numeros, etoiles: entree.etoiles });
  };
  racine.querySelectorAll('[data-rejouer]').forEach((bouton) => { bouton.onclick = () => montrerRejeu(carnet.find((e) => e.id === bouton.dataset.rejouer)); });
  // la chronologie se redessine seule quand on choisit une année ou un rang, sans faire sauter l'écran
  const brancherChronologie = () => {
    const redessiner = () => { $('chrono').innerHTML = htmlChronologie(etat.rejeu); brancherChronologie(); };
    racine.querySelectorAll('[data-annee]').forEach((b) => { b.onclick = () => { etat.rejeu.annee = etat.rejeu.annee === b.dataset.annee ? null : b.dataset.annee; redessiner(); }; });
    if ($('chrono-rang')) $('chrono-rang').onchange = () => { etat.rejeu.rangMax = Number($('chrono-rang').value); redessiner(); };
    if ($('chrono-tout')) $('chrono-tout').onclick = () => { etat.rejeu.annee = null; redessiner(); };
  };
  if (etat.rejeu) { brancherChronologie(); $('rejeu-fermer').onclick = () => { etat.rejeu = null; afficher(); }; }
  racine.querySelectorAll('[data-oter]').forEach((bouton) => {
    bouton.onclick = () => { carnet = carnetOutils.supprimer(carnet, bouton.dataset.oter); carnetOutils.sauver(stockage, carnet); afficher(); };
  });
}

// ---------- Numéros ----------

function chaleurs(mode) {
  const s = ctx.stats;
  if (mode === 'retard') return [s.centFroidN, s.centFroidE];
  if (mode === 'foule') return [ctx.centPopN, ctx.centPopE];
  if (mode === 'frequence') return [contexteFrequence().n, contexteFrequence().e];
  return [s.centChaudN, s.centChaudE];
}

let memoFrequence = null;
function contexteFrequence() {
  if (!memoFrequence) {
    const tout = contexte(D, { ...reglages, fenetreChaud: D.tirages.length }).stats;
    // étoiles : seulement depuis que les 12 sont en jeu, pour comparer ce qui est comparable
    const recents = D.tirages.filter((t) => t[0] >= '2016-09-27');
    const depuis12 = contexte({ ...D, tirages: recents }, { ...reglages, fenetreChaud: recents.length }).stats;
    memoFrequence = { n: tout.centChaudN, e: depuis12.centChaudE };
  }
  return memoFrequence;
}

// Barres colorées du froid au chaud : une barre à 10 % (l'attendu) est à mi-chemin, 5 % ou moins est tout froid, 15 % ou plus tout chaud.
// Le trait pointillé marque les 10 % attendus.
function barres(cases, libelles) {
  const max = Math.max(...cases.map((c) => pourcent(c) || 0), 15);
  // chaque barre porte son étiquette : au survol (ordinateur) ou au toucher (téléphone), elle s'affiche sous le graphique
  return `<div class="barres"><b class="repere" style="bottom:${(100 * 10) / max}%"></b>${cases.map((c) => {
    const part = pourcent(c) || 0, info = `${c.annee} : ${nombre(part, 1)} % des tirages (${c.sorties} sorties sur ${c.tirages})`;
    return `<i style="height:${Math.max(2, (100 * part) / max)}%;background:${couleurThermique((part - 5) / 10, pal)}" title="${info}" data-info="${info}" tabindex="0"></i>`;
  }).join('')}</div>` +
    `<div class="barres-textes"><span>${libelles[0]}</span><span>${libelles[1]}</span></div>` +
    '<p class="barres-info" id="barres-info">Touchez ou survolez une barre pour voir l\'année et la valeur exacte.</p>' +
    '<div class="echelle"></div><div class="echelle-textes"><span>moins que prévu</span><span>pointillé : les 10 % attendus</span><span>plus que prévu</span></div>';
}

// La carte d'identité du numéro : chaque mesure avec sa jauge, l'attendu, la fourchette du hasard et un OUI / NON.
function htmlIdentite(n) {
  const N = D.numeros, i = n - 1;
  const lignes = N.mesures.filter((m) => m.valeurs[i] !== null).map((m) => {
    const f = { obs: m.valeurs[i], att: m.attendu[i], bas: m.bas[i], haut: m.haut[i] }, j = jauge(f);
    return `<div class="enquete${m.hors[i] ? ' marquee' : ''}"><div class="entete"><span>${m.nom}</span>${badge(m.hors[i] !== 0, m.hors[i] > 0 ? '▲ au-dessus' : '▼ en dessous')}</div>` +
      `<div class="mesure"><span class="discret">${m.precisions[i] ?? ''}</span><b>${nombre(f.obs, m.dec)}</b></div>` +
      `<div class="piste" title="${AIDE_JAUGE}"><i class="hasard" style="left:${j.gauche}%;width:${j.largeur}%"></i><i class="attendu" style="left:${j.attendu}%"></i><i class="observe" style="left:${j.observe}%"></i></div>` +
      `<div class="echelle-textes"><span>attendu ${nombre(f.att, Math.max(1, m.dec))}</span><span>le hasard : de ${nombre(f.bas, m.dec)} à ${nombre(f.haut, m.dec)}</span></div>` +
      `<p class="discret">${m.aide}</p></div>`;
  });
  const oui = N.mesures.filter((m) => m.hors[i]).length;
  return `<h3>Carte d'identité : ${lignes.length} mesures</h3><p class="discret">Pour chaque mesure : ce numéro sort-il de ce que le hasard donne à un numéro pris seul, 19 fois sur 20 ? ` +
    `Réponse pour le ${n} : <b>OUI pour ${oui} mesure${oui > 1 ? 's' : ''} sur ${lignes.length}</b> ; par pur hasard on attend environ ${nombre(0.05 * lignes.length, 1)} « oui » par numéro. ` +
    `Sur les ${nombre(N.nb_cases)} cases des 50 numéros, ${nombre(N.nb_hors)} sont des « oui », pour ${nombre(N.attendues_par_hasard)} attendus. ` +
    'Plusieurs mesures racontent la même chose sous des angles différents (un numéro peu sorti l\'est aussi le mardi, depuis 2016, etc.) : ' +
    'plusieurs « oui » sur un même numéro ne sont donc pas autant de preuves séparées. Aucun ne dit quoi jouer.</p>' +
    `<details class="detail" id="identite"${oui ? ' open' : ''}><summary>Voir les ${lignes.length} mesures</summary>${lignes.join('')}` +
    '<div class="ligne"><button class="bouton" data-action="haut">↑ Retour en haut</button><button class="bouton" data-action="replier">Fermer les 20 mesures</button></div></details>';
}

// Le badge de réponse, avec sa question écrite au-dessus : on sait toujours à quoi répond le OUI ou le NON.
function badge(oui, sens) {
  return `<span class="question-badge"><small>Écart au hasard ?</small>${oui ? `<span class="reponse oui">OUI ${sens}</span>` : '<span class="reponse non">NON</span>'}</span>`;
}

function htmlEnquetes(n) {
  const enquetes = enquetesDuNumero(n, D), b = bilanEnquetes(enquetes);
  const valeur = (x) => (x.v === null || x.v === undefined ? '—' : typeof x.v === 'number' && x.dec !== null ? nombre(x.v, x.dec) : x.v);
  const carte = (e) => {
    const reponse = e.inhabituel === null ? '' : badge(e.inhabituel, e.sens);
    return `<div class="enquete ${FAMILLES[e.bloc].classe}${e.inhabituel ? ' marquee' : ''}"><div class="entete"><b>${e.titre}</b>${reponse}</div>` +
      `<p class="definition-fiche">${e.definition ?? ''}</p>` +
      `<p class="discret">${e.fenetre}${e.suivi ? ' — numéro suivi par cette enquête' : ''}</p>` +
      `<ul>${e.faits.map((x) => `<li>${x.t} : <b>${valeur(x)}</b></li>`).join('')}</ul>` +
      (e.phrase ? `<p class="resume">${e.phrase}</p>` : '') + '</div>';
  };
  return `<h3>Ce numéro dans les enquêtes</h3><p class="discret">Pour chaque enquête, la question est la même : ce numéro sort-il de ce que le hasard donne d'ordinaire ? ` +
    `Réponse pour le ${n} : <b>OUI dans ${b.inhabituelles} enquête${b.inhabituelles > 1 ? 's' : ''} sur ${b.jugees}</b>. ` +
    `Par pur hasard, on attend environ ${nombre(b.attendues, 1)} « oui » par numéro : un ou deux « oui » n'ont donc rien d'étonnant, et aucun ne dit quoi jouer.</p>` +
    ['insolites', 'boulier', 'experiences'].map((bloc) => `<details class="detail famille ${FAMILLES[bloc].classe}"${enquetes.some((e) => e.bloc === bloc && e.inhabituel) ? ' open' : ''}>` +
      `<summary><span class="etiquette-famille">${FAMILLES[bloc].nom}</span> ${enquetes.filter((e) => e.bloc === bloc).length} enquêtes</summary>` +
      enquetes.filter((e) => e.bloc === bloc).map(carte).join('') + '</details>').join('');
}

function ficheHtml(n) {
  const f = ficheNumero(n, D.tirages);
  const ligne = (nom, c) => `<tr><td>${nom}</td><td>${c.sorties} sur ${nombre(c.tirages)}</td><td>${nombre(pourcent(c), 1)} %</td></tr>`;
  const groupe = (objet) => Object.entries(objet).map(([nom, c]) => ligne(nom, c)).join('');
  const rangDe = (liste, i, sens = -1) => 1 + liste.filter((x) => (sens < 0 ? x > liste[i] : x < liste[i])).length;
  const tout = contexte(D, { ...reglages, fenetreChaud: D.tirages.length }).stats;
  const populaires = D.populaire.numeros.map((x) => x ?? 0);
  return `<div class="carte"><h2>Numéro ${n}</h2>` +
    `<div class="mesure"><span>Sorties depuis 2004</span><b>${f.sorties} (attendu ${nombre(f.attendu, 1)})</b></div>` +
    `<div class="mesure"><span>Classement par nombre de sorties</span><b>${rangDe(tout.sortiesN, n - 1)}e sur 50</b></div>` +
    `<div class="mesure"><span>Depuis septembre 2016 (règle actuelle)</span><b>${f.regleActuelle.sorties} (attendu ${nombre(f.regleActuelle.tirages / 10, 1)})</b></div>` +
    `<div class="mesure"><span>Sur les ${reglages.fenetreChaud} derniers tirages</span><b>${ctx.stats.chaudN[n - 1]} (attendu ${nombre(reglages.fenetreChaud / 10, 1)})</b></div>` +
    `<div class="mesure"><span>Écart moyen entre deux sorties</span><b>${nombre(f.ecartMoyen, 1)} tirages (attendu 10)</b></div>` +
    `<div class="mesure"><span>Classement « joué par la foule »</span><b>${rangDe(populaires, n - 1)}e sur 50</b></div>` +
    `<div class="mesure"><span>Dernière sortie</span><b>${f.derniereSortie ? dateFr(f.derniereSortie) : 'jamais'} — il y a ${pluriel(f.retard, 'tirage')}</b></div>` +
    `<div class="mesure"><span>Plus longue absence</span><b>${f.plusLongueAbsence} tirages</b></div>` +
    `<div class="mesure"><span>Joué par la foule</span><b>${signe(D.populaire.numeros[n - 1], 1)} % de gagnants quand il sort</b></div>` +
    `<h3>Part des tirages où il est sorti, par année</h3>${barres(f.annees, [f.annees[0].annee, f.annees[f.annees.length - 1].annee])}` +
    '<h3>Jour, saison, moment du mois</h3><table><tr><th></th><th>Sorties</th><th>Part</th></tr>' +
    groupe(f.jours) + groupe(f.saisons) + groupe(f.moities) + '</table>' +
    '<p class="discret">Le hasard donne 10 % partout ; de petits écarts sont normaux.</p>' +
    `<h3>Sorti le plus souvent avec</h3><div class="boules">${f.compagnons.map(([m, c]) => boule(m, chaleurs(etat.mode)[0][m - 1]) + `<span class="discret">${c} fois</span>`).join('')}</div>` +
    `<p class="discret">Un compagnon quelconque est attendu ${nombre(f.compagnonAttendu, 1)} fois. Parmi 49 compagnons, il y en a toujours quelques-uns en tête.</p>` +
    htmlIdentite(n) + htmlEnquetes(n) +
    '<p class="transparence">Cette fiche décrit le passé. Le laboratoire a vérifié qu\'un numéro chaud ou en retard n\'a pas plus de chances de sortir au tirage suivant.</p>' +
    '<div class="ligne"><button class="bouton" data-action="haut">↑ Retour en haut</button><button class="bouton" data-action="fermer">Fermer la fiche</button></div></div>';
}

// Le plateau et sa légende, redessinés seuls quand on déplace un seuil (la fiche ouverte en dessous ne bouge pas).
function htmlPlateau() {
  const [cn, ce] = chaleurs(etat.mode), m = MODES[etat.mode], s = reglages.seuils;
  return `<div class="echelle" style="background:linear-gradient(90deg, var(--froid) ${s.froid}%, var(--chaud) ${s.chaud}%)"></div>` +
    `<div class="echelle-textes legende-filtre"><span>${m.froid}</span><span>${m.chaud}</span></div>` +
    (etat.mode === 'chaud' ? `<p class="discret">Sur les ${reglages.fenetreChaud} derniers tirages.</p>` : '') +
    `<div class="plateau" style="margin-top:10px">${cn.map((c, i) => `<button class="boule${etat.choisi === i + 1 ? ' choisi' : ''}" style="--t:${teinte(c)}" data-numero="${i + 1}">${i + 1}</button>`).join('')}</div>` +
    `<p class="legende-filtre" style="margin:12px 0 4px">Les 12 étoiles</p>` +
    `<div class="rangee-etoiles">${ce.map((c, i) => `<span class="boule etoile" style="--t:${teinte(c)}">${i + 1}</span>`).join('')}</div>`;
}

function vueNumeros(racine) {
  const s = reglages.seuils;
  racine.innerHTML = '<div class="carte" id="haut-numeros"><h2>Les 50 numéros</h2><div class="puces filtres">' +
    Object.entries(MODES).map(([cle, x]) => `<button class="puce${cle === etat.mode ? ' actif' : ''}" data-mode="${cle}">${x.nom}</button>`).join('') + '</div>' +
    `<div id="plateau">${htmlPlateau()}</div>` +
    '<p class="discret" style="margin-top:10px">Touchez un numéro pour ouvrir sa fiche.</p>' +
    '<details id="d-seuils"><summary>Régler les seuils du dégradé</summary>' +
    '<p class="discret">Les couleurs classent les numéros du plus froid (0 %) au plus chaud (100 %). En resserrant les seuils, seuls les extrêmes gardent une couleur franche.</p>' +
    `<div class="curseur"><span>Tout froid sous</span><input type="range" id="s-froid" min="0" max="90" step="5" value="${s.froid}"><span id="s-froid-v">${s.froid} %</span></div>` +
    `<div class="curseur"><span>Tout chaud dès</span><input type="range" id="s-chaud" min="10" max="100" step="5" value="${s.chaud}"><span id="s-chaud-v">${s.chaud} %</span></div>` +
    '<div class="ligne"><button class="bouton" id="s-defaut">Revenir au dégradé complet</button></div></details></div>' +
    `<div id="fiche">${etat.choisi ? ficheHtml(etat.choisi) : ''}</div>`;
  racine.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { etat.mode = b.dataset.mode; afficher(); }; });
  const brancherPlateau = () => racine.querySelectorAll('[data-numero]').forEach((b) => {
    b.onclick = () => { etat.choisi = Number(b.dataset.numero); afficher(); $('fiche').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  });
  brancherPlateau();
  const seuil = (cle) => () => {
    reglages.seuils = { ...reglages.seuils, [cle]: Number($('s-' + cle).value) };
    memoriser();
    $('s-froid').value = reglages.seuils.froid; $('s-chaud').value = reglages.seuils.chaud;
    $('s-froid-v').textContent = reglages.seuils.froid + ' %'; $('s-chaud-v').textContent = reglages.seuils.chaud + ' %';
    $('plateau').innerHTML = htmlPlateau(); brancherPlateau();
  };
  $('s-froid').oninput = seuil('froid'); $('s-chaud').oninput = seuil('chaud');
  $('s-defaut').onclick = () => { reglages.seuils = { froid: 0, chaud: 100 }; memoriser(); afficher(); $('d-seuils').open = true; };
  // étiquette des barres par année : au survol, au toucher ou au clavier
  racine.querySelectorAll('.barres i[data-info]').forEach((barre) => {
    const montrer = () => { $('barres-info').textContent = barre.dataset.info; racine.querySelectorAll('.barres i.vise').forEach((x) => x.classList.remove('vise')); barre.classList.add('vise'); };
    barre.onmouseenter = montrer; barre.onclick = montrer; barre.onfocus = montrer;
  });
  racine.querySelectorAll('[data-action]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.action === 'fermer') { etat.choisi = null; afficher(); }
      if (b.dataset.action === 'replier') $('identite').open = false;
      $(b.dataset.action === 'replier' ? 'fiche' : 'haut-numeros').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

// ---------- Mesures : rejeu des styles et dates insolites ----------

const cas = (f) => `${nombre(f.n)} ${f.n > 1 ? f.unite_cas : f.unite_cas.replace(/s\b/g, '')}`;

// Tableau détaillé d'une fiche : une ligne par numéro. Toucher un titre de colonne trie le tableau.
function tableauDetail(detail) {
  const cellule = (x, c) => (x === null || x === undefined ? '—' : typeof x === 'number' && c.dec !== null ? nombre(x, c.dec) : x);
  return `<details class="detail"><summary>Analyse détaillée (${detail.lignes.length} lignes)</summary><p class="discret">${detail.titre}. Touchez un titre de colonne pour trier.</p>` +
    '<div class="defile haut"><table class="triable"><thead><tr>' + detail.colonnes.map((c, i) => `<th data-col="${i}">${c.t}</th>`).join('') + '</tr></thead><tbody>' +
    detail.lignes.map((l) => `<tr${l.some((x) => typeof x === 'string' && x.startsWith('▲')) ? ' class="hors dessus"' : l.some((x) => typeof x === 'string' && x.startsWith('▼')) ? ' class="hors dessous"' : ''}>` +
      l.map((x, i) => `<td data-v="${x ?? ''}">${cellule(x, detail.colonnes[i])}</td>`).join('') + '</tr>').join('') +
    `</tbody></table></div>${detail.note ? `<p class="discret">${detail.note}</p>` : ''}</details>`;
}

function rendreTriables(racine) {
  racine.querySelectorAll('table.triable th').forEach((th) => {
    th.onclick = () => {
      const corps = th.closest('table').tBodies[0], col = Number(th.dataset.col), sens = th.dataset.sens === 'haut' ? -1 : 1;
      th.closest('tr').querySelectorAll('th').forEach((x) => { delete x.dataset.sens; });
      th.dataset.sens = sens === 1 ? 'haut' : 'bas';
      const valeur = (tr) => { const v = tr.cells[col].dataset.v; return v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v; };
      [...corps.rows].sort((a, b) => {
        const x = valeur(a), y = valeur(b);
        if (x === y) return 0;
        if (x === '') return 1;
        if (y === '') return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr')) * sens;
      }).forEach((tr) => corps.appendChild(tr));
    };
  });
}

function carteInsolite(f) {
  let corps = '';
  if (f.p !== null) {
    const j = jauge(f);
    corps = `<div class="mesure"><span>${f.mesure}</span><b>${nombre(f.obs, f.dec)}</b></div>` +
      `<div class="piste" title="${AIDE_JAUGE}"><i class="hasard" style="left:${j.gauche}%;width:${j.largeur}%"></i><i class="attendu" style="left:${j.attendu}%"></i><i class="observe" style="left:${j.observe}%"></i></div>` +
      `<div class="echelle-textes"><span>attendu ${nombre(f.att, f.dec)}</span><span>le hasard : de ${nombre(f.bas, f.dec)} à ${nombre(f.haut, f.dec)}</span></div>` +
      `<details class="aide-jauge"><summary>ⓘ Comment lire cette jauge</summary><p class="discret">${AIDE_JAUGE}</p></details>` +
      `<p class="resume">${resumeFiche(f)}</p>`;
  }
  const periodes = f.par_periode.length
    ? `<p><b>Sur deux périodes séparées.</b> ${f.par_periode.map((q) => `${q.nom} : ${nombre(q.obs, f.dec)} (${q.n} tirages)`).join(' ; ')}.</p>` : '';
  const exemples = f.exemples.length
    ? '<h3>Derniers tirages concernés</h3>' + f.exemples.map((t) => `<p class="discret">${dateFr(t[0])}</p>${boulesGrille({ numeros: t.slice(1, 6), etoiles: t.slice(6, 8) })}`).join('') : '';
  return `<div class="carte"><h2>${f.numero} · ${f.titre}</h2><p class="definition-fiche">${f.definition ?? ''}</p><p class="discret">${f.fenetre} — ${cas(f)}</p>${corps}` +
    (f.complement ? `<p class="constat">${f.complement}</p>` : '') +
    `<p class="transparence statut-${f.statut}">${f.lecture}</p>` +
    (f.detail ? tableauDetail(f.detail) : '') +
    `<details><summary>Comprendre cette fiche</summary><p>${f.explication}</p>${f.non_teste ? `<p>${f.non_teste}</p>` : ''}` +
    (f.p !== null ? `<p>${nombre(f.p * 100, f.p < 0.1 ? 1 : 0)} faux historiques sur 100 s'écartent au moins autant de l'attendu.</p>` : '') +
    `${periodes}${exemples}</details></div>`;
}

const ENQUETES = {
  insolites: { nom: 'Dates insolites', accroche: 'Quinze curiosités du calendrier, testées avec le même sérieux que le reste. La machine ne connaît pas la date : le résultat attendu est « rien ».' },
  experiences: { nom: 'Expériences du labo', accroche: 'Trois expériences : la cloche de Gauss, la corde à nœuds et l\'indice de singularité. Chacune cherche une « force » qui ramènerait les tirages vers une moyenne ou un équilibre. Un tirage sans mémoire n\'en a aucune. Ces lois peuvent aussi servir à générer des grilles (onglet Grilles, « Tirage Labo / Expérimental »).' },
  boulier: { nom: 'Anomalies du boulier', accroche: 'Quatorze pistes d\'enquête sur les numéros. Beaucoup cherchent « le cas le plus extrême » : parmi 1 225 paires ou 50 numéros, il y en a toujours un. Chaque record est donc comparé à celui que le hasard produit à lui seul.' },
};

function htmlEnquete(cle) {
  const I = D[cle];
  return `<div class="carte famille ${FAMILLES[cle].classe}"><h2><span class="etiquette-famille">${ENQUETES[cle].nom}</span></h2><p>${ENQUETES[cle].accroche}</p>` +
    `<div class="mesure"><span>Écarts inhabituels</span><b>${I.nb_inhabituelles} sur ${I.nb_testees}</b></div>` +
    `<div class="mesure"><span>Attendus par pur hasard</span><b>environ ${nombre(I.attendues_par_hasard, 1)}</b></div>` +
    `<p class="transparence">Quand on teste ${I.nb_testees} pistes, il est normal qu'une ressorte par chance. En tenant compte de tous les essais, ` +
    `une curiosité aussi forte que la plus étonnante arrive par hasard ${nombre(I.p_global * 100)} fois sur 100. Aucune fiche ne dit quoi jouer.</p>` +
    '<p class="discret">Sur chaque jauge : la zone claire est ce que le hasard donne 19 fois sur 20, le trait fin l\'attendu, le repère épais l\'observé.</p></div>' +
    `<div class="${FAMILLES[cle].classe}">${I.fiches.map(carteInsolite).join('')}</div>`;
}

function htmlRejeu() {
  const R = D.rejeu, ordre = ['hasard', 'chaud', 'froid', 'harmonique', 'antiFoule'];
  const noms = { hasard: 'Hasard pur', chaud: 'Sur la Vague', froid: 'Le Retardataire', harmonique: 'Harmonique', antiFoule: 'Anti-Foule' };
  return '<div class="carte"><h2>Ce que le laboratoire a mesuré</h2>' +
    `<p>Chaque style a été rejoué sur ${nombre(R.nb_tirages)} tirages (du ${dateFr(R.debut)} au ${dateFr(R.fin)}), en ne regardant que le passé, et payé aux vrais montants.</p>` +
    '<div class="defile"><table><tr><th>Style</th><th>Rendu pour 100 €</th><th>Grilles gagnantes</th><th>Gain par grille gagnante</th></tr>' +
    ordre.map((c) => `<tr><td>${noms[c]}</td><td>${nombre(R.profils[c].retour, 1)} €</td><td>${nombre(R.profils[c].part_gagnantes, 2)} %</td><td>${nombre(R.profils[c].gain_par_grille_gagnante, 2)} €</td></tr>`).join('') +
    '</table></div>' +
    `<p class="discret">Exemple : un joueur au hasard pur a joué ${nombre(R.grilles_par_joueur)} grilles pour ${nombre(R.cout_par_joueur)} € et en a récupéré environ ${nombre(R.cout_par_joueur * R.profils.hasard.retour / 100)} €.</p></div>` +
    '<div class="carte"><h2>À retenir</h2><ul>' +
    '<li>Un tirage est un hasard sans mémoire : un numéro chaud ou en retard sort toujours environ 1 fois sur 10.</li>' +
    '<li>Aucun style ne fait gagner plus souvent, et tous perdent de l\'argent en moyenne.</li>' +
    '<li>Seul le partage est réel : des numéros peu joués font toucher davantage <i>quand</i> on gagne.</li>' +
    `<li>D'après la règle du jeu, une grille quelconque gagne quelque chose ${nombre(R.part_gagnantes_theorique, 1)} fois sur 100, presque toujours un petit rang.</li></ul>` +
    '</div><div class="carte"><h2>Les cinq styles, un par un</h2>' +
    ordre.map((c) => `<p class="definition"><b>${noms[c]} :</b> ${definitionStyle(c, reglages)}</p><p class="transparence"><b>Ce que le laboratoire a mesuré.</b> ${phraseProfil(c, R)}</p>`).join('') + '</div>' +
    '<div class="carte"><h2>Le laboratoire complet</h2><p>Tous les tests, période par période : fréquences, retards, sommes, paires, ordre de sortie, mardi contre vendredi, partage des gains.</p>' +
    '<p><a href="laboratoire.html">Ouvrir le laboratoire</a></p>' +
    `<p class="discret">Données : ${nombre(D.tirages.length)} tirages, du ${dateFr(D.tirages[0][0])} au ${dateFr(dernierTirage)}.</p></div>`;
}

function vueMesures(racine) {
  const sous = [['rejeu', 'Rejeu des styles'], ['insolites', 'Dates insolites'], ['boulier', 'Boulier'], ['experiences', 'Expériences'], ['monlabo', 'Mon Labo']];
  racine.innerHTML = '<div class="puces sous-menu">' + sous.map(([cle, nom]) => `<button class="puce${cle === etat.sousVue ? ' actif' : ''}" data-sous="${cle}">${nom}</button>`).join('') + '</div>' +
    (etat.sousVue === 'monlabo' ? '<div id="zone-monlabo"></div>' : ENQUETES[etat.sousVue] ? htmlEnquete(etat.sousVue) : htmlRejeu());
  if (etat.sousVue === 'monlabo') vueMonLabo($('zone-monlabo'));
  racine.querySelectorAll('[data-sous]').forEach((b) => { b.onclick = () => { etat.sousVue = b.dataset.sous; afficher(); }; });
  rendreTriables(racine);
  // pour les captures d'écran de contrôle : « #mesures-boulier-ouvert » déplie les tableaux détaillés
  if (location.hash.endsWith('-ouvert')) racine.querySelectorAll('details.detail').forEach((d) => { d.open = true; });
}

// ---------- Mon Labo : poser sa propre question ----------

const EXEMPLES_LABO = [
  'Les numéros pairs sortent-ils plus après 4 impairs ?',
  'La somme est-elle plus haute le mardi ?',
  'Le 7 sort-il plus après 2 tirages de suite avec au moins 3 pairs ?',
  'Y a-t-il plus de suites quand la somme dépasse 150 ?',
];

// Le fil de la conversation : { de: 'vous' | 'labo', html }. Le test en attente de validation est dans etat.labo.spec.
function dire(de, html) { etat.labo.fil.push({ de, html }); }

function optionsProprietes(choisie) {
  return Object.entries(monLabo.PROPRIETES).map(([cle, p]) => `<option value="${cle}"${cle === choisie ? ' selected' : ''}>${p.unite}</option>`).join('');
}

// Les menus : la même question, sans phrase. Ils servent à corriger ce que l'analyseur a compris, ou à s'en passer.
function htmlMenus(spec) {
  const c = spec?.condition, m = spec?.cible ?? { prop: 'pairs', op: null, val: null };
  const ops = (choisi, avecMoyenne) => (avecMoyenne ? `<option value=""${!choisi ? ' selected' : ''}>la moyenne</option>` : '') +
    Object.entries(monLabo.OPERATEURS).map(([op, nom]) => `<option value="${op}"${op === choisi ? ' selected' : ''}>${avecMoyenne ? 'la part des tirages avec ' : ''}${nom}</option>`).join('');
  return '<div class="menus-labo"><h3>La situation de départ</h3>' +
    `<div class="ligne"><select id="l-avec"><option value="non"${c ? '' : ' selected'}>Aucune : tous les tirages</option><option value="oui"${c ? ' selected' : ''}>Un tirage où…</option></select></div>` +
    `<div class="ligne" id="l-condition"${c ? '' : ' hidden'}><select id="l-c-prop">${optionsProprietes(c?.prop ?? 'impairs')}</select>` +
    `<label>n° <input type="number" id="l-c-param" min="1" max="50" value="${c?.param ?? 7}"></label>` +
    `<select id="l-c-op">${ops(c?.op ?? '>=', false)}</select><input type="number" id="l-c-val" min="0" max="240" value="${c?.val ?? 4}">` +
    `<label>pendant <input type="number" id="l-c-serie" min="1" max="10" value="${c?.serie ?? 1}"> tirage(s) de suite</label></div>` +
    `<div class="ligne" id="l-ou"${c ? '' : ' hidden'}><select id="l-decalage"><option value="1"${spec?.decalage === 0 ? '' : ' selected'}>Je regarde le tirage qui suit</option><option value="0"${spec?.decalage === 0 ? ' selected' : ''}>Je regarde ce même tirage</option></select></div>` +
    '<h3>Ce que je mesure</h3>' +
    `<div class="ligne"><select id="l-m-prop">${optionsProprietes(m.prop)}</select><label>n° <input type="number" id="l-m-param" min="1" max="50" value="${m.param ?? 7}"></label></div>` +
    `<div class="ligne"><select id="l-m-op">${ops(m.op, true)}</select><input type="number" id="l-m-val" min="0" max="240" value="${m.val ?? 3}"></div>` +
    `<div class="ligne"><label>Jour <select id="l-jour"><option value="">mardi et vendredi</option><option value="mardi"${spec?.jour === 'mardi' ? ' selected' : ''}>mardi seulement</option><option value="vendredi"${spec?.jour === 'vendredi' ? ' selected' : ''}>vendredi seulement</option></select></label></div>` +
    '<div class="ligne"><button class="bouton" id="l-menus-ok">Utiliser ces menus</button></div></div>';
}

function lireMenus() {
  const avec = $('l-avec').value === 'oui';
  return monLabo.valider({
    decalage: Number($('l-decalage').value), jour: $('l-jour').value || null,
    condition: avec ? { prop: $('l-c-prop').value, param: Number($('l-c-param').value), op: $('l-c-op').value, val: Number($('l-c-val').value), serie: Number($('l-c-serie').value) } : null,
    cible: { prop: $('l-m-prop').value, param: Number($('l-m-param').value), op: $('l-m-op').value || null, val: Number($('l-m-val').value) },
  });
}

function htmlResultatLabo(r, spec) {
  const noms = { vide: 'Rien à mesurer', peu: 'Trop peu de cas', inhabituel: 'Écart inhabituel', conforme: 'Conforme au hasard' };
  let jaugeHtml = '';
  if (r.p !== null) {
    const j = jauge(r);
    jaugeHtml = `<div class="mesure"><span>${r.unite}</span><b>${nombre(r.obs, r.dec)}</b></div>` +
      `<div class="piste" title="${AIDE_JAUGE}"><i class="hasard" style="left:${j.gauche}%;width:${j.largeur}%"></i><i class="attendu" style="left:${j.attendu}%"></i><i class="observe" style="left:${j.observe}%"></i></div>` +
      `<div class="echelle-textes"><span>attendu ${nombre(r.att, r.dec)}</span><span>le hasard : de ${nombre(r.bas, r.dec)} à ${nombre(r.haut, r.dec)}</span></div>` +
      '<table><tr><th>Cas trouvés</th><th>Observé</th><th>Attendu</th><th>Hasard : de … à</th></tr>' +
      `<tr><td>${nombre(r.cas)}</td><td>${nombre(r.obs, r.dec)}</td><td>${nombre(r.att, r.dec)}</td><td>${nombre(r.bas, r.dec)} à ${nombre(r.haut, r.dec)}</td></tr></table>`;
  }
  return `<div class="entete"><b>${noms[r.statut]}</b>${r.p === null || r.statut === 'peu' ? '' : badge(r.statut === 'inhabituel', r.obs > r.att ? '▲ au-dessus' : '▼ en dessous')}</div>` +
    `${jaugeHtml}<p class="resume">${monLabo.conclure(spec, r, labo.essais)}</p>` +
    `<p class="discret">${nombre(r.nbSimulations)} faux historiques tirés au hasard ont servi de comparaison. Relancer le test peut changer très légèrement la fourchette.</p>`;
}

function calculerLabo(spec, question) {
  labo = { ...labo, essais: labo.essais + 1 };
  monLabo.sauver(stockage, labo);
  dire('labo', '<p>Calcul en cours sur les vrais tirages…</p>');
  etat.labo.spec = null;
  afficher();
  // on laisse l'écran s'afficher avant de lancer le calcul, qui prend une à quelques secondes
  setTimeout(() => {
    const r = monLabo.tester(spec, D.tirages);
    etat.labo.fil.pop();
    etat.labo.dernier = { spec, question, r };
    dire('labo', htmlResultatLabo(r, spec));
    afficher();
  }, 40);
}

function vueMonLabo(racine) {
  const L = etat.labo;
  const bulles = L.fil.map((m) => `<div class="bulle ${m.de}">${m.html}</div>`).join('');
  const attente = L.spec ? `<div class="bulle labo"><p><b>Voici ce que j'ai compris.</b> ${monLabo.decrire(L.spec, D.tirages.length)}</p>` +
    '<div class="ligne"><button class="bouton principal" id="l-valider">Valider et calculer</button></div>' +
    '<div class="ligne"><button class="bouton" id="l-corriger">Corriger avec les menus</button><button class="bouton" id="l-annuler">Annuler</button></div></div>' : '';
  const dejaGardee = L.dernier && labo.mesures.some((m) => m.id === JSON.stringify(L.dernier.spec));
  const garder = L.dernier && !L.spec ? `<div class="ligne"><button class="bouton" id="l-garder"${dejaGardee ? ' disabled' : ''}>${dejaGardee ? 'Mesure enregistrée dans mon Labo' : 'Enregistrer cette mesure dans mon Labo'}</button></div>` : '';
  const gardees = labo.mesures.map((m, i) => `<div class="enquete"><b>${m.question || 'Mesure sans titre'}</b><p class="discret">${monLabo.decrire(m.spec, D.tirages.length)}</p>` +
    (monLabo.loiDeGrille(m.spec) ? `<p class="discret">Utilisable pour générer des grilles (onglet Grilles, « Tirage Labo / Expérimental ») : grilles où « ${monLabo.loiDeGrille(m.spec).texte} ».</p>` : '') +
    `<div class="ligne"><button class="bouton" data-relancer="${i}">Relancer sur les tirages à jour</button><button class="bouton" data-oublier="${i}">Supprimer</button></div></div>`).join('');

  racine.innerHTML = '<div class="carte famille famille-monlabo"><h2><span class="etiquette-famille">Mon Labo</span></h2>' +
    '<p>Posez votre propre question sur les tirages. L\'application vous redit ce qu\'elle a compris, vous validez, puis elle fait le calcul sur les vrais tirages et le compare au hasard.</p>' +
    '<p class="transparence">Il n\'y a pas d\'intelligence artificielle ici : l\'application reconnaît des mots-clés (pairs, impairs, somme, suites, dizaines, « le numéro 7 », « après », « 3 tirages de suite », mardi…). ' +
    'Si elle ne comprend pas, les menus font la même chose. Elle ne peut pas inventer un résultat : tout est calculé sur les tirages.' +
    (labo.essais ? ` Tests lancés jusqu'ici : <b>${labo.essais}</b>. Sur 20 tests d'un hasard parfait, 1 ressort en moyenne par pure chance.` : '') + '</p>' +
    `<div class="fil">${bulles}${attente}</div>${garder}` +
    '<div class="ligne"><input id="l-question" maxlength="200" placeholder="Votre question…" value=""><button class="bouton" id="l-envoyer">Envoyer</button></div>' +
    `<details id="l-exemples"${L.fil.length ? '' : ' open'}><summary>Exemples de questions</summary><div class="puces">${EXEMPLES_LABO.map((e, i) => `<button class="puce" data-exemple="${i}">${e}</button>`).join('')}</div></details>` +
    `<details id="l-menus"${L.menus ? ' open' : ''}><summary>Poser la question avec des menus</summary>${htmlMenus(L.spec ?? L.dernier?.spec)}</details></div>` +
    (labo.mesures.length ? `<div class="carte famille famille-monlabo"><h2>Mes mesures enregistrées (${labo.mesures.length})</h2>${gardees}</div>` : '');

  const envoyer = (question) => {
    if (!question.trim()) return;
    dire('vous', `<p>${question.replace(/[<>&]/g, '')}</p>`);
    const compris = monLabo.interpreter(question);
    L.question = question; L.dernier = null;
    if (compris.spec) { L.spec = compris.spec; L.menus = false; } else { L.spec = null; L.menus = true; dire('labo', `<p>${compris.erreur}</p>`); }
    afficher();
  };
  $('l-envoyer').onclick = () => envoyer($('l-question').value);
  $('l-question').onkeydown = (e) => { if (e.key === 'Enter') envoyer($('l-question').value); };
  racine.querySelectorAll('[data-exemple]').forEach((b) => { b.onclick = () => envoyer(EXEMPLES_LABO[Number(b.dataset.exemple)]); });
  if ($('l-valider')) $('l-valider').onclick = () => calculerLabo(L.spec, L.question);
  if ($('l-corriger')) $('l-corriger').onclick = () => { L.menus = true; afficher(); $('l-menus').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  if ($('l-annuler')) $('l-annuler').onclick = () => { L.spec = null; dire('labo', '<p>D\'accord, je ne calcule rien. Reformulez ou utilisez les menus.</p>'); afficher(); };
  if ($('l-garder')) $('l-garder').onclick = () => { labo = monLabo.enregistrer(labo, L.dernier.question, L.dernier.spec); monLabo.sauver(stockage, labo); afficher(); };

  const propager = () => {
    const parametre = (id, prop) => { $(id).parentElement.hidden = !monLabo.PROPRIETES[$(prop).value].parametre; };
    parametre('l-c-param', 'l-c-prop'); parametre('l-m-param', 'l-m-prop');
    $('l-condition').hidden = $('l-ou').hidden = $('l-avec').value !== 'oui';
    const present = (prop) => Boolean(monLabo.PROPRIETES[$(prop).value].parametre);
    $('l-c-op').hidden = $('l-c-val').hidden = present('l-c-prop');
    $('l-m-op').hidden = present('l-m-prop');
    $('l-m-val').hidden = present('l-m-prop') || !$('l-m-op').value;
  };
  ['l-avec', 'l-c-prop', 'l-m-prop', 'l-m-op'].forEach((id) => { $(id).onchange = propager; });
  propager();
  $('l-menus-ok').onclick = () => {
    // pour « le numéro 7 » ou « l'étoile 3 », la question est toujours : est-il sorti ?
    const present = (prop) => Boolean(monLabo.PROPRIETES[$(prop).value].parametre);
    if (present('l-c-prop')) { $('l-c-op').value = '='; $('l-c-val').value = 1; }
    if (present('l-m-prop')) { $('l-m-op').value = '='; $('l-m-val').value = 1; }
    const spec = lireMenus();
    if (!spec) { dire('labo', '<p>Ces menus ne forment pas un test complet. Vérifiez la situation de départ et ce qui est mesuré.</p>'); afficher(); return; }
    L.question = L.question || 'Question posée avec les menus'; L.spec = spec; L.dernier = null; L.menus = false;
    afficher(); racine.querySelector('.fil').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  racine.querySelectorAll('[data-relancer]').forEach((b) => { b.onclick = () => { const m = labo.mesures[Number(b.dataset.relancer)]; dire('vous', `<p>${m.question}</p>`); L.question = m.question; calculerLabo(m.spec, m.question); window.scrollTo(0, 0); }; });
  racine.querySelectorAll('[data-oublier]').forEach((b) => {
    b.onclick = () => {
      const m = labo.mesures[Number(b.dataset.oublier)];
      labo = monLabo.oublier(labo, m.id); monLabo.sauver(stockage, labo);
      reglages.loisPerso = reglages.loisPerso.filter((x) => x !== m.id); memoriser(); afficher();
    };
  });
}

// ---------- Réglages ----------

// L'aperçu en direct du studio : une carte miniature qui montre toutes les couleurs à l'œuvre.
function htmlApercu() {
  const j = jauge({ bas: 3, haut: 18, att: 10, obs: 21 });
  return '<div class="apercu"><p class="legende-filtre">Aperçu en direct</p><div class="carte">' +
    '<div class="entete"><h2>Titre d\'une carte</h2>' + badge(true, '▲ au-dessus') + '</div>' +
    '<p>Texte principal, <span class="discret">texte secondaire</span>.</p>' +
    `<div class="boules">${[0, 0.25, 0.5, 0.75, 1].map((t, i) => boule(i * 12 + 1, t)).join('')}${boule(7, 0.5, true)}</div>` +
    `<div class="piste" style="margin-top:12px"><i class="hasard" style="left:${j.gauche}%;width:${j.largeur}%"></i><i class="attendu" style="left:${j.attendu}%"></i><i class="observe" style="left:${j.observe}%"></i></div>` +
    '<p class="resume">Encadré de synthèse : une phrase complète, dans la couleur d\'accent secondaire.</p>' +
    '<p class="transparence">Phrase de transparence, bordée par l\'accent des encadrés.</p>' +
    '<div class="puces"><button class="puce actif">Filtre actif</button><button class="puce">Filtre</button></div>' +
    '<button class="bouton principal">BOUTON PRINCIPAL</button></div></div>';
}

function vueReglages(racine) {
  const carteTheme = ([cle, t]) => `<button class="theme${cle === reglages.theme ? ' actif' : ''}" data-theme-choix="${cle}" style="background:${t.fond};color:${t.texte};border-color:${cle === reglages.theme ? t.accent : t.bord};font-family:${t.police.replace(/"/g, '\'')}">` +
    `<b style="color:${t.accent}">${t.nom}</b><br><small>${t.description}</small><span class="pastilles">${[t.accent, t.accent2, t.accent3, t.froid, t.chaud].map((c) => `<i style="background:${c}"></i>`).join('')}</span></button>`;
  const modifiees = COULEURS_PERSO.filter(([cle]) => reglages.perso[cle]).length + (reglages.perso.lueur === null ? 0 : 1);
  racine.innerHTML = '<div class="carte"><h2>Thème</h2>' +
    CATEGORIES.map(([cat, nom]) => `<h3>${nom}</h3><div class="themes">${Object.entries(THEMES).filter(([, t]) => t.categorie === cat).map(carteTheme).join('')}</div>`).join('') +
    '</div>' +
    '<div class="carte"><h2>Studio de couleurs</h2>' +
    `<p class="discret">Chaque couleur du thème « ${THEMES[reglages.theme].nom} » peut être remplacée. L'aperçu et toute l'application suivent en direct. ` +
    `${modifiees ? `${modifiees} réglage${modifiees > 1 ? 's' : ''} personnalisé${modifiees > 1 ? 's' : ''}.` : 'Aucun réglage personnalisé pour l\'instant.'}</p>` +
    `<div class="studio">${COULEURS_PERSO.map(([cle, nom]) => `<label class="${reglages.perso[cle] ? 'modifie' : ''}"><input type="color" data-couleur="${cle}" value="${pal[cle]}"><span>${nom}</span></label>`).join('')}</div>` +
    `<div class="curseur"><span>Lueur néon</span><input type="range" id="p-lueur" min="0" max="2" step="0.1" value="${pal.lueur}"><span id="p-lueur-v">${nombre(pal.lueur, 1)}</span></div>` +
    `<div id="apercu">${htmlApercu()}</div>` +
    '<div class="ligne"><button class="bouton" id="p-defaut">Revenir aux couleurs du thème</button></div>' +
    '<p class="discret">Les seuils du dégradé froid → chaud se règlent dans l\'onglet Numéros. Un deck enregistre aussi vos couleurs.</p></div>' +
    '<div class="carte"><h2>À propos</h2><p>La Bise fonctionne sans connexion une fois installée. Vos réglages, vos decks et votre carnet restent sur cet appareil ; rien n\'est envoyé.</p>' +
    `<p class="discret">Données du ${dateFr(D.genere_le)}.</p><div class="ligne"><button class="bouton" id="p-mentions">Mentions légales et prévention</button></div></div>`;
  racine.querySelectorAll('[data-theme-choix]').forEach((b) => {
    b.onclick = () => { reglages.theme = b.dataset.themeChoix; memoriser(); habiller(); afficher(); };
  });
  // en direct : la page entière suit par les variables CSS ; seul l'aperçu (boules calculées) est redessiné
  const enDirect = () => { memoriser(); habiller(); $('apercu').innerHTML = htmlApercu(); };
  racine.querySelectorAll('[data-couleur]').forEach((champ) => {
    champ.oninput = () => { reglages.perso[champ.dataset.couleur] = champ.value; champ.parentElement.classList.add('modifie'); enDirect(); };
    champ.onchange = () => afficher();
  });
  $('p-lueur').oninput = () => { reglages.perso.lueur = Number($('p-lueur').value); $('p-lueur-v').textContent = nombre(reglages.perso.lueur, 1); enDirect(); };
  $('p-defaut').onclick = () => { reglages.perso = {}; memoriser(); habiller(); afficher(); };
  $('p-mentions').onclick = () => mentions(false);
}

// ---------- Mentions légales ----------

function mentions(premiereFois) {
  const voile = $('voile');
  voile.innerHTML = '<div class="carte" role="dialog" aria-modal="true"><h2>Avant de commencer</h2><ul>' +
    MENTIONS.map((m) => `<li>${m}</li>`).join('') + '</ul>' +
    `<button class="bouton principal" id="m-ok">${premiereFois ? 'J\'ai compris, je suis majeur(e)' : 'Fermer'}</button></div>`;
  voile.hidden = false;
  $('m-ok').onclick = () => {
    voile.hidden = true;
    if (premiereFois) { reglages.mentionsAcceptees = true; memoriser(); }
  };
}

// ---------- Mise en route ----------

const VUES = { grilles: vueGrilles, carnet: vueCarnet, numeros: vueNumeros, mesures: vueMesures, reglages: vueReglages };

function afficher() {
  document.body.classList.toggle('rapide', etat.rapide && etat.vue === 'grilles');
  $('menu').innerHTML = MENU.map(([cle, nom]) => `<button class="${cle === etat.vue ? 'actif' : ''}" data-vue="${cle}">${nom}</button>`).join('');
  $('menu').querySelectorAll('[data-vue]').forEach((b) => { b.onclick = () => { etat.vue = b.dataset.vue; history.replaceState(null, '', '#' + etat.vue); afficher(); window.scrollTo(0, 0); }; });
  VUES[etat.vue]($('vue'));
}

async function demarrer() {
  // Aperçu pour les captures d'écran de contrôle : index.html?apercu=synthwave montre un thème sans rien enregistrer.
  const parametres = new URLSearchParams(location.search), apercu = parametres.get('apercu');
  if (apercu !== null) {
    stockage = { getItem: () => null, setItem: () => {} };
    reglages = { ...reglages, theme: THEMES[apercu] ? apercu : reglages.theme, mentionsAcceptees: true };
  }
  habiller();
  try {
    D = await (await fetch('donnees.json')).json();
  } catch {
    $('vue').innerHTML = '<div class="carte"><p>Les données n\'ont pas pu être chargées. Vérifiez la connexion, puis rouvrez l\'application.</p></div>';
    return;
  }
  ctx = construireContexte();
  indexDates = carnetOutils.indexParDate(D);
  dernierTirage = D.tirages[D.tirages.length - 1][0];
  $('sous-titre').textContent = `${nombre(D.tirages.length)} tirages analysés · dernier : ${dateFr(dernierTirage)}`;
  const [vue, option] = location.hash.slice(1).split('-');
  if (VUES[vue]) etat.vue = vue;
  [vue, option].filter((x) => ENQUETES[x] || x === 'monlabo').forEach((x) => { etat.vue = 'mesures'; etat.sousVue = x; });
  if (vue === 'numeros' && Number(option) >= 1 && Number(option) <= 50) etat.choisi = Number(option);
  // « ?rapide » (raccourci de l'icône) ouvre directement le mode rapide et génère
  if (parametres.has('rapide') && reglages.mentionsAcceptees) { etat.vue = 'grilles'; etat.rapide = true; }
  if (apercu !== null && option === 'demo') {
    // démonstration pour les captures d'écran : rien n'est enregistré
    if (vue === 'grilles') { reglages = valider({ ...reglages, fetiches: [7, 13], dosage: 'modere', affichage: parametres.get('affichage') || 'moderne' }); ctx = construireContexte(); }
    if (vue === 'carnet') {
      const exemple = D.tirages[D.tirages.length - 1];
      carnet = [carnetOutils.preparer([exemple[1], exemple[2], 30, 40, 50], [exemple[6], 12], exemple[0]), carnetOutils.preparer([3, 17, 28, 41, 49], [2, 11], carnetOutils.prochainTirage(aujourdhui()))].filter((e) => typeof e !== 'string');
      etat.rejeu = { grille: { numeros: [3, 17, 28, 41, 49], etoiles: [2, 11] }, resultat: rejouer({ numeros: [3, 17, 28, 41, 49], etoiles: [2, 11] }, D) };
    }
  }
  if (apercu !== null && location.hash.endsWith('monlabo-demo')) {
    // démonstration pour les captures d'écran : la question d'exemple, déjà calculée (rien n'est enregistré)
    const question = EXEMPLES_LABO[0], spec = monLabo.interpreter(question).spec, r = monLabo.tester(spec, D.tirages);
    dire('vous', `<p>${question}</p>`);
    dire('labo', `<p><b>Voici ce que j'ai compris.</b> ${monLabo.decrire(spec, D.tirages.length)}</p>`);
    labo = { ...labo, essais: 1 };
    etat.labo.dernier = { spec, question, r };
    dire('labo', htmlResultatLabo(r, spec));
  }
  afficher();
  if ((etat.rapide || (apercu !== null && vue === 'grilles' && option === 'demo'))) lancer();
  if (!reglages.mentionsAcceptees) mentions(true);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

demarrer();
