// L'écran de La Bise. Les calculs sont dans moteur/, labo.js, themes.js et textes.js (tous testés avec Node).

import { contexte, NOMS_CRITERES } from './moteur/criteres.js';
import { PROFILS, NOMBRES_DE_GRILLES, DOSAGES, FETICHES_MAX, charger, sauver, valider, validerFetiches, profilActif } from './moteur/reglages.js';
import { generer } from './moteur/generateur.js';
import { versCSV, versJSON, versTicket, telecharger } from './moteur/export.js';
import { rejouer } from './moteur/rejeu.js';
import * as carnetOutils from './moteur/carnet.js';
import * as deckOutils from './moteur/decks.js';
import { THEMES, appliquer, palette, couleurThermique } from './themes.js';
import { ficheNumero, pourcent, jauge, enquetesDuNumero, bilanEnquetes } from './labo.js';
import { phraseProfil, phraseFetiches, definitionStyle, nombre, signe, dateFr, MENTIONS } from './textes.js';

const $ = (id) => document.getElementById(id);
const AFFICHEES_MAX = 50;
const MENU = [['grilles', 'Grilles'], ['carnet', 'Carnet'], ['numeros', 'Numéros'], ['mesures', 'Mesures'], ['reglages', 'Réglages']];
const MODES = {
  chaud: { nom: 'Forme récente', froid: 'peu sorti récemment', chaud: 'souvent sorti récemment' },
  retard: { nom: 'Retard', froid: 'sorti il y a peu', chaud: 'absent depuis longtemps' },
  frequence: { nom: 'Depuis 2004', froid: 'moins sorti', chaud: 'plus sorti' },
  foule: { nom: 'Joué par la foule', froid: 'peu joué', chaud: 'très joué' },
};

let D = null, ctx = null, pal = null, indexDates = null, dernierTirage = null;
let stockage = localStorage;
let reglages = charger(stockage);
let decks = deckOutils.charger(stockage);
let carnet = carnetOutils.charger(stockage);
const etat = { vue: 'grilles', grilles: [], mode: 'chaud', choisi: null, sousVue: 'rejeu', rapide: false, rejeu: null, message: '' };

const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lireListe = (texte) => (String(texte).match(/\d+/g) || []).map(Number);
const pluriel = (n, mot) => `${nombre(n)} ${mot}${n > 1 ? 's' : ''}`;

function memoriser() {
  reglages = valider(reglages);
  sauver(stockage, reglages);
  ctx = contexte(D, reglages);
}

function habiller() {
  appliquer(document.documentElement, reglages.theme, reglages.perso);
  pal = palette(reglages.theme, reglages.perso);
  document.querySelector('meta[name="theme-color"]').content = pal.fond;
}

function boule(valeur, chaleur, etoile = false, classe = '') {
  return `<span class="boule${etoile ? ' etoile' : ''}${classe}" style="--t:${couleurThermique(chaleur, pal)}">${valeur}</span>`;
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
  return styles + (fetiches ? `<p class="transparence">${fetiches}</p>` : '');
}

function carteGrille(g, i) {
  const respect = g.respect === null
    ? '<div class="mesure"><span>Respect de vos réglages</span><b>hasard pur</b></div>'
    : `<div class="mesure"><span>Respect de vos réglages</span><b>${nombre(g.respect)} %</b></div><div class="jauge"><i style="width:${g.respect}%"></i></div>`;
  const detail = Object.keys(NOMS_CRITERES).map((c) => `<tr><td>${NOMS_CRITERES[c]}</td><td>${nombre(100 * g.notes[c])} %</td><td>poids ${reglages.poids[c]}</td></tr>`).join('') +
    (g.notes.fetiches === null ? '' : `<tr><td>Fétiches</td><td>${nombre(100 * g.notes.fetiches)} %</td><td>poids ${DOSAGES[reglages.dosage].poids}</td></tr>`);
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
    `<div class="ligne"><button class="bouton" data-rejouer="${entree.id}">Rejouer sur l'historique</button><button class="bouton" data-oter="${entree.id}">Supprimer</button></div></div>`;
}

function courbe(points) {
  const L = 320, H = 90, soldes = points.map((p) => p.solde), min = Math.min(0, ...soldes), max = Math.max(0, ...soldes);
  const x = (i) => (points.length > 1 ? (i * L) / (points.length - 1) : 0), y = (v) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  return `<svg viewBox="0 0 ${L} ${H}" class="courbe" role="img"><line x1="0" x2="${L}" y1="${y(0)}" y2="${y(0)}" class="zero"/>` +
    `<polyline points="${points.map((p, i) => `${x(i).toFixed(1)},${y(p.solde).toFixed(1)}`).join(' ')}"/></svg>` +
    `<div class="echelle-textes"><span>${dateFr(points[0].date)}</span><span>solde final : ${nombre(soldes[soldes.length - 1])} €</span></div>`;
}

function carteRejeu(r) {
  const res = r.resultat;
  const rangs = res.parRang.map((n, i) => (n ? `<tr><td>Rang ${i + 1}</td><td>${nombre(n)} fois</td></tr>` : '')).join('');
  return `<div class="carte" id="rejeu"><h2>Rejeu sur l'historique</h2>${boulesGrille(r.grille)}` +
    `<p class="discret">${nombre(res.tirages)} tirages, du ${dateFr(res.debut)} au ${dateFr(res.fin)}, une grille à chaque tirage.</p>` +
    `<div class="mesure"><span>Misé</span><b>${nombre(res.cout)} €</b></div><div class="mesure"><span>Récupéré</span><b>${nombre(res.gains, 2)} €</b></div>` +
    `<div class="mesure"><span>Rendu pour 100 € misés</span><b>${nombre(res.rendu, 1)} €</b></div>` +
    `<div class="mesure"><span>Tirages gagnants</span><b>${nombre(res.gagnantes)} (${nombre((100 * res.gagnantes) / res.tirages, 1)} %)</b></div>` +
    `<div class="mesure"><span>Meilleur rang atteint</span><b>${res.meilleurRang ?? 'aucun'}</b></div>` +
    `<div class="mesure"><span>Plus longue série sans gain</span><b>${nombre(res.serieMax)} tirages</b></div>` +
    `<h3>Solde au fil des tirages</h3>${courbe(res.courbe)}` +
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
    '<div class="ligne"><button class="bouton" id="c-ajouter">Ajouter au carnet</button><button class="bouton" id="c-tester">Tester sur l\'historique</button></div>' +
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
  return `<div class="barres"><b class="repere" style="bottom:${(100 * 10) / max}%"></b>${cases.map((c) => {
    const part = pourcent(c) || 0;
    return `<i style="height:${(100 * part) / max}%;background:${couleurThermique((part - 5) / 10, pal)}" title="${c.sorties} sur ${c.tirages}"></i>`;
  }).join('')}</div>` +
    `<div class="barres-textes"><span>${libelles[0]}</span><span>${libelles[1]}</span></div>` +
    '<div class="echelle"></div><div class="echelle-textes"><span>moins que prévu</span><span>pointillé : les 10 % attendus</span><span>plus que prévu</span></div>';
}

// La carte d'identité du numéro : chaque mesure avec sa jauge, l'attendu, la fourchette du hasard et un OUI / NON.
function htmlIdentite(n) {
  const N = D.numeros, i = n - 1;
  const lignes = N.mesures.filter((m) => m.valeurs[i] !== null).map((m) => {
    const f = { obs: m.valeurs[i], att: m.attendu[i], bas: m.bas[i], haut: m.haut[i] }, j = jauge(f);
    const reponse = m.hors[i] ? `<span class="reponse oui">OUI ${m.hors[i] > 0 ? '▲ au-dessus' : '▼ en dessous'}</span>` : '<span class="reponse non">NON</span>';
    return `<div class="enquete${m.hors[i] ? ' marquee' : ''}"><div class="entete"><span>${m.nom}</span>${reponse}</div>` +
      `<div class="mesure"><span class="discret">${m.precisions[i] ?? ''}</span><b>${nombre(f.obs, m.dec)}</b></div>` +
      `<div class="piste"><i class="hasard" style="left:${j.gauche}%;width:${j.largeur}%"></i><i class="attendu" style="left:${j.attendu}%"></i><i class="observe" style="left:${j.observe}%"></i></div>` +
      `<div class="echelle-textes"><span>attendu ${nombre(f.att, Math.max(1, m.dec))}</span><span>le hasard : de ${nombre(f.bas, m.dec)} à ${nombre(f.haut, m.dec)}</span></div>` +
      `<p class="discret">${m.aide}</p></div>`;
  });
  const oui = N.mesures.filter((m) => m.hors[i]).length;
  return `<h3>Carte d'identité : ${lignes.length} mesures</h3><p class="discret">Pour chaque mesure : ce numéro sort-il de ce que le hasard donne à un numéro pris seul, 19 fois sur 20 ? ` +
    `Réponse pour le ${n} : <b>OUI pour ${oui} mesure${oui > 1 ? 's' : ''} sur ${lignes.length}</b> ; par pur hasard on attend environ ${nombre(0.05 * lignes.length, 1)} « oui » par numéro. ` +
    `Sur les ${nombre(N.nb_cases)} cases des 50 numéros, ${nombre(N.nb_hors)} sont des « oui », pour ${nombre(N.attendues_par_hasard)} attendus. ` +
    'Plusieurs mesures racontent la même chose sous des angles différents (un numéro peu sorti l\'est aussi le mardi, depuis 2016, etc.) : ' +
    'plusieurs « oui » sur un même numéro ne sont donc pas autant de preuves séparées. Aucun ne dit quoi jouer.</p>' +
    `<details class="detail"${oui ? ' open' : ''}><summary>Voir les ${lignes.length} mesures</summary>${lignes.join('')}</details>`;
}

function htmlEnquetes(n) {
  const enquetes = enquetesDuNumero(n, D), b = bilanEnquetes(enquetes);
  const noms = { insolites: 'Dates insolites', boulier: 'Anomalies du boulier' };
  const valeur = (x) => (x.v === null || x.v === undefined ? '—' : typeof x.v === 'number' && x.dec !== null ? nombre(x.v, x.dec) : x.v);
  const carte = (e) => {
    const reponse = e.inhabituel === null ? '' : e.inhabituel
      ? `<span class="reponse oui">OUI ${e.sens}</span>` : '<span class="reponse non">NON</span>';
    return `<div class="enquete${e.inhabituel ? ' marquee' : ''}"><div class="entete"><b>${e.titre}</b>${reponse}</div>` +
      `<p class="discret">${e.fenetre}${e.suivi ? ' — numéro suivi par cette enquête' : ''}</p>` +
      `<ul>${e.faits.map((x) => `<li>${x.t} : <b>${valeur(x)}</b></li>`).join('')}</ul></div>`;
  };
  return `<h3>Ce numéro dans les enquêtes</h3><p class="discret">Pour chaque enquête, la question est la même : ce numéro sort-il de ce que le hasard donne d'ordinaire ? ` +
    `Réponse pour le ${n} : <b>OUI dans ${b.inhabituelles} enquête${b.inhabituelles > 1 ? 's' : ''} sur ${b.jugees}</b>. ` +
    `Par pur hasard, on attend environ ${nombre(b.attendues, 1)} « oui » par numéro : un ou deux « oui » n'ont donc rien d'étonnant, et aucun ne dit quoi jouer.</p>` +
    ['insolites', 'boulier'].map((bloc) => `<details class="detail"${enquetes.some((e) => e.bloc === bloc && e.inhabituel) ? ' open' : ''}><summary>${noms[bloc]} (${enquetes.filter((e) => e.bloc === bloc).length})</summary>` +
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
    '<p class="transparence">Cette fiche décrit le passé. Le laboratoire a vérifié qu\'un numéro chaud ou en retard n\'a pas plus de chances de sortir au tirage suivant.</p></div>';
}

function vueNumeros(racine) {
  const [cn, ce] = chaleurs(etat.mode), m = MODES[etat.mode];
  racine.innerHTML = '<div class="carte"><h2>Les 50 numéros</h2><div class="puces">' +
    Object.entries(MODES).map(([cle, x]) => `<button class="puce${cle === etat.mode ? ' actif' : ''}" data-mode="${cle}">${x.nom}</button>`).join('') + '</div>' +
    `<div class="echelle"></div><div class="echelle-textes"><span>${m.froid}</span><span>${m.chaud}</span></div>` +
    (etat.mode === 'chaud' ? `<p class="discret">Sur les ${reglages.fenetreChaud} derniers tirages.</p>` : '') +
    `<div class="plateau" style="margin-top:10px">${cn.map((c, i) => `<button class="boule${etat.choisi === i + 1 ? ' choisi' : ''}" style="--t:${couleurThermique(c, pal)}" data-numero="${i + 1}">${i + 1}</button>`).join('')}</div>` +
    `<div class="rangee-etoiles">${ce.map((c, i) => `<span class="boule etoile" style="--t:${couleurThermique(c, pal)}">${i + 1}</span>`).join('')}</div>` +
    '<p class="discret" style="margin-top:10px">Touchez un numéro pour ouvrir sa fiche. La ligne du bas montre les 12 étoiles.</p></div>' +
    `<div id="fiche">${etat.choisi ? ficheHtml(etat.choisi) : ''}</div>`;
  racine.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { etat.mode = b.dataset.mode; afficher(); }; });
  racine.querySelectorAll('[data-numero]').forEach((b) => {
    b.onclick = () => { etat.choisi = Number(b.dataset.numero); afficher(); $('fiche').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  });
}

// ---------- Mesures : rejeu des styles et dates insolites ----------

const cas = (f) => `${nombre(f.n)} ${f.n > 1 ? f.unite_cas : f.unite_cas.replace(/s\b/g, '')}`;

// Tableau détaillé d'une fiche : une ligne par numéro. Toucher un titre de colonne trie le tableau.
function tableauDetail(detail) {
  const cellule = (x, c) => (x === null || x === undefined ? '—' : typeof x === 'number' && c.dec !== null ? nombre(x, c.dec) : x);
  return `<details class="detail"><summary>Analyse détaillée (${detail.lignes.length} lignes)</summary><p class="discret">${detail.titre}. Touchez un titre de colonne pour trier.</p>` +
    '<div class="defile haut"><table class="triable"><thead><tr>' + detail.colonnes.map((c, i) => `<th data-col="${i}">${c.t}</th>`).join('') + '</tr></thead><tbody>' +
    detail.lignes.map((l) => `<tr${l.some((x) => typeof x === 'string' && /^[▲▼]/.test(x)) ? ' class="hors"' : ''}>` +
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
      `<div class="piste"><i class="hasard" style="left:${j.gauche}%;width:${j.largeur}%"></i><i class="attendu" style="left:${j.attendu}%"></i><i class="observe" style="left:${j.observe}%"></i></div>` +
      `<div class="echelle-textes"><span>attendu ${nombre(f.att, f.dec)}</span><span>le hasard : de ${nombre(f.bas, f.dec)} à ${nombre(f.haut, f.dec)}</span></div>`;
  }
  const periodes = f.par_periode.length
    ? `<p><b>Sur deux périodes séparées.</b> ${f.par_periode.map((q) => `${q.nom} : ${nombre(q.obs, f.dec)} (${q.n} tirages)`).join(' ; ')}.</p>` : '';
  const exemples = f.exemples.length
    ? '<h3>Derniers tirages concernés</h3>' + f.exemples.map((t) => `<p class="discret">${dateFr(t[0])}</p>${boulesGrille({ numeros: t.slice(1, 6), etoiles: t.slice(6, 8) })}`).join('') : '';
  return `<div class="carte"><h2>${f.numero} · ${f.titre}</h2><p class="discret">${f.fenetre} — ${cas(f)}</p>${corps}` +
    (f.complement ? `<p class="constat">${f.complement}</p>` : '') +
    `<p class="transparence statut-${f.statut}">${f.lecture}</p>` +
    (f.detail ? tableauDetail(f.detail) : '') +
    `<details><summary>Comprendre cette fiche</summary><p>${f.explication}</p>${f.non_teste ? `<p>${f.non_teste}</p>` : ''}` +
    (f.p !== null ? `<p>${nombre(f.p * 100, f.p < 0.1 ? 1 : 0)} faux historiques sur 100 s'écartent au moins autant de l'attendu.</p>` : '') +
    `${periodes}${exemples}</details></div>`;
}

const ENQUETES = {
  insolites: { nom: 'Dates insolites', accroche: 'Quinze curiosités du calendrier, testées avec le même sérieux que le reste. La machine ne connaît pas la date : le résultat attendu est « rien ».' },
  boulier: { nom: 'Anomalies du boulier', accroche: 'Quatorze pistes d\'enquête sur les numéros. Beaucoup cherchent « le cas le plus extrême » : parmi 1 225 paires ou 50 numéros, il y en a toujours un. Chaque record est donc comparé à celui que le hasard produit à lui seul.' },
};

function htmlEnquete(cle) {
  const I = D[cle];
  return `<div class="carte"><h2>${ENQUETES[cle].nom}</h2><p>${ENQUETES[cle].accroche}</p>` +
    `<div class="mesure"><span>Écarts inhabituels</span><b>${I.nb_inhabituelles} sur ${I.nb_testees}</b></div>` +
    `<div class="mesure"><span>Attendus par pur hasard</span><b>environ ${nombre(I.attendues_par_hasard, 1)}</b></div>` +
    `<p class="transparence">Quand on teste ${I.nb_testees} pistes, il est normal qu'une ressorte par chance. En tenant compte de tous les essais, ` +
    `une curiosité aussi forte que la plus étonnante arrive par hasard ${nombre(I.p_global * 100)} fois sur 100. Aucune fiche ne dit quoi jouer.</p>` +
    '<p class="discret">Sur chaque jauge : la zone claire est ce que le hasard donne 19 fois sur 20, le trait fin l\'attendu, le repère épais l\'observé.</p></div>' +
    I.fiches.map(carteInsolite).join('');
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
  const sous = [['rejeu', 'Rejeu des styles'], ['insolites', 'Dates insolites'], ['boulier', 'Boulier']];
  racine.innerHTML = '<div class="puces sous-menu">' + sous.map(([cle, nom]) => `<button class="puce${cle === etat.sousVue ? ' actif' : ''}" data-sous="${cle}">${nom}</button>`).join('') + '</div>' +
    (ENQUETES[etat.sousVue] ? htmlEnquete(etat.sousVue) : htmlRejeu());
  racine.querySelectorAll('[data-sous]').forEach((b) => { b.onclick = () => { etat.sousVue = b.dataset.sous; afficher(); }; });
  rendreTriables(racine);
  // pour les captures d'écran de contrôle : « #mesures-boulier-ouvert » déplie les tableaux détaillés
  if (location.hash.endsWith('-ouvert')) racine.querySelectorAll('details.detail').forEach((d) => { d.open = true; });
}

// ---------- Réglages ----------

function vueReglages(racine) {
  racine.innerHTML = '<div class="carte"><h2>Thème</h2><div class="themes">' +
    Object.entries(THEMES).map(([cle, t]) => `<button class="theme${cle === reglages.theme ? ' actif' : ''}" data-theme-choix="${cle}" style="background:${t.fond};color:${t.texte};font-family:${t.police.replace(/"/g, '\'')}">` +
      `<b style="color:${t.accent}">${t.nom}</b><br><small>${t.description}</small><span class="pastilles">${[t.accent, t.accent2, t.accent3, t.froid, t.chaud].map((c) => `<i style="background:${c}"></i>`).join('')}</span></button>`).join('') +
    '</div></div>' +
    '<div class="carte"><h2>Personnaliser</h2>' +
    `<div class="ligne"><label>Boules froides <input type="color" id="p-froid" value="${pal.froid}"></label><label>Boules chaudes <input type="color" id="p-chaud" value="${pal.chaud}"></label></div>` +
    `<div class="ligne"><label style="flex:1">Lueur néon <input type="range" id="p-lueur" min="0" max="2" step="0.1" value="${pal.lueur}"></label></div>` +
    `<div class="boules">${[0, 0.25, 0.5, 0.75, 1].map((t, i) => boule(i * 12 + 1, t)).join('')}${boule(7, 0.5, true)}</div>` +
    '<div class="ligne"><button class="bouton" id="p-defaut">Revenir aux couleurs du thème</button></div></div>' +
    '<div class="carte"><h2>À propos</h2><p>La Bise fonctionne sans connexion une fois installée. Vos réglages, vos decks et votre carnet restent sur cet appareil ; rien n\'est envoyé.</p>' +
    `<p class="discret">Données du ${dateFr(D.genere_le)}.</p><div class="ligne"><button class="bouton" id="p-mentions">Mentions légales et prévention</button></div></div>`;
  racine.querySelectorAll('[data-theme-choix]').forEach((b) => {
    b.onclick = () => { reglages.theme = b.dataset.themeChoix; memoriser(); habiller(); afficher(); };
  });
  $('p-froid').onchange = () => { reglages.perso.froid = $('p-froid').value; memoriser(); habiller(); afficher(); };
  $('p-chaud').onchange = () => { reglages.perso.chaud = $('p-chaud').value; memoriser(); habiller(); afficher(); };
  $('p-lueur').oninput = () => { reglages.perso.lueur = Number($('p-lueur').value); memoriser(); habiller(); };
  $('p-defaut').onclick = () => { reglages.perso = { froid: null, chaud: null, lueur: null }; memoriser(); habiller(); afficher(); };
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
  ctx = contexte(D, reglages);
  indexDates = carnetOutils.indexParDate(D);
  dernierTirage = D.tirages[D.tirages.length - 1][0];
  $('sous-titre').textContent = `${nombre(D.tirages.length)} tirages analysés · dernier : ${dateFr(dernierTirage)}`;
  const [vue, option] = location.hash.slice(1).split('-');
  if (VUES[vue]) etat.vue = vue;
  [vue, option].filter((x) => ENQUETES[x]).forEach((x) => { etat.vue = 'mesures'; etat.sousVue = x; });
  if (vue === 'numeros' && Number(option) >= 1 && Number(option) <= 50) etat.choisi = Number(option);
  // « ?rapide » (raccourci de l'icône) ouvre directement le mode rapide et génère
  if (parametres.has('rapide') && reglages.mentionsAcceptees) { etat.vue = 'grilles'; etat.rapide = true; }
  if (apercu !== null && option === 'demo') {
    // démonstration pour les captures d'écran : rien n'est enregistré
    if (vue === 'grilles') { reglages = valider({ ...reglages, fetiches: [7, 13], dosage: 'modere', affichage: parametres.get('affichage') || 'moderne' }); ctx = contexte(D, reglages); }
    if (vue === 'carnet') {
      const exemple = D.tirages[D.tirages.length - 1];
      carnet = [carnetOutils.preparer([exemple[1], exemple[2], 30, 40, 50], [exemple[6], 12], exemple[0]), carnetOutils.preparer([3, 17, 28, 41, 49], [2, 11], carnetOutils.prochainTirage(aujourdhui()))].filter((e) => typeof e !== 'string');
      etat.rejeu = { grille: { numeros: [3, 17, 28, 41, 49], etoiles: [2, 11] }, resultat: rejouer({ numeros: [3, 17, 28, 41, 49], etoiles: [2, 11] }, D) };
    }
  }
  afficher();
  if ((etat.rapide || (apercu !== null && vue === 'grilles' && option === 'demo'))) lancer();
  if (!reglages.mentionsAcceptees) mentions(true);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

demarrer();
