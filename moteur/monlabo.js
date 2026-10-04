// « Mon Labo » : l'utilisateur pose sa propre question, l'application la reformule, puis la teste sur les vrais tirages.
// Il n'y a pas d'intelligence artificielle ici : un analyseur de phrases reconnaît des mots-clés, et le calcul se fait
// sur l'appareil, avec la même méthode que le laboratoire (comparaison à des faux historiques tirés au hasard).

import { lire, ecrire } from './reglages.js';
import { nbEtoilesEnJeu } from './rejeu.js';

const numeros = (t) => t.slice(1, 6);
const compter = (t, test) => numeros(t).filter(test).length;

// Ce qu'on sait mesurer sur un tirage ou sur une grille. t = [date, n1..n5, e1, e2], numéros dans l'ordre croissant.
export const PROPRIETES = {
  pairs: { nom: 'numéros pairs', unite: 'nombre de numéros pairs', max: 5, f: (t) => compter(t, (n) => n % 2 === 0) },
  impairs: { nom: 'numéros impairs', unite: 'nombre de numéros impairs', max: 5, f: (t) => compter(t, (n) => n % 2 === 1) },
  petits: { nom: 'numéros de 1 à 25', unite: 'nombre de numéros de 1 à 25', max: 5, f: (t) => compter(t, (n) => n <= 25) },
  grands: { nom: 'numéros de 26 à 50', unite: 'nombre de numéros de 26 à 50', max: 5, f: (t) => compter(t, (n) => n >= 26) },
  dates: { nom: 'numéros de 1 à 31 (les « dates »)', unite: 'nombre de numéros de 1 à 31', max: 5, f: (t) => compter(t, (n) => n <= 31) },
  suites: { nom: 'numéros qui se suivent', unite: 'nombre de suites (comme 14-15)', max: 4, f: (t) => numeros(t).filter((n, i, l) => i > 0 && n - l[i - 1] === 1).length },
  dizaines: { nom: 'dizaines différentes', unite: 'nombre de dizaines différentes', max: 5, f: (t) => new Set(numeros(t).map((n) => Math.floor((n - 1) / 10))).size },
  somme: { nom: 'somme des 5 numéros', unite: 'somme des 5 numéros', max: 240, f: (t) => numeros(t).reduce((a, b) => a + b, 0) },
  etendue: { nom: 'écart entre le plus grand et le plus petit numéro', unite: 'écart entre le plus grand et le plus petit numéro', max: 49, f: (t) => t[5] - t[1] },
  somme_etoiles: { nom: 'somme des 2 étoiles', unite: 'somme des 2 étoiles', max: 23, f: (t) => t[6] + t[7] },
  numero: { nom: 'le numéro', unite: 'présence du numéro', parametre: 50, max: 1, f: (t, p) => (numeros(t).includes(p) ? 1 : 0) },
  etoile: { nom: 'l\'étoile', unite: 'présence de l\'étoile', parametre: 12, max: 1, f: (t, p) => (t[6] === p || t[7] === p ? 1 : 0) },
};

export const OPERATEURS = { '>=': 'au moins', '<=': 'au plus', '=': 'exactement' };
const comparer = (v, op, val) => (op === '>=' ? v >= val : op === '<=' ? v <= val : v === val);
const jourSemaine = (date) => new Date(date + 'T12:00:00Z').getUTCDay();

// ---------- Comprendre la question ----------

const sansAccent = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');

// Trouve la propriété dont parle un bout de phrase. L'ordre compte : « impair » avant « pair », « somme des étoiles » avant « somme ».
function trouverPropriete(texte) {
  const regles = [
    [/somme[^,;.]*etoile|etoiles?[^,;.]*somme/, 'somme_etoiles'], [/etoile\s*(?:numero\s*|n\s*)?(\d{1,2})/, 'etoile'],
    [/impair/, 'impairs'], [/\bpair/, 'pairs'], [/somme|total/, 'somme'], [/se suiv|consecuti|\bsuites?\b/, 'suites'],
    [/etendue|plus grand et le plus petit|dispers/, 'etendue'], [/dizaine/, 'dizaines'],
    [/\bdates?\b|anniversaire|1 a 31/, 'dates'], [/petits?\b|1 a 25/, 'petits'], [/grands?\b|26 a 50/, 'grands'],
    [/(?:numero|\ble|\bdu)\s+(\d{1,2})\b/, 'numero'],
  ];
  for (const [motif, prop] of regles) {
    const m = texte.match(motif);
    if (m) return { prop, param: PROPRIETES[prop].parametre ? Number(m[1]) : null };
  }
  return null;
}

// Trouve « au moins 4 », « plus de 150 », « exactement 2 », ou un simple « 4 » collé à la propriété.
function trouverSeuil(texte, prop, param) {
  const sansParam = param ? texte.replace(new RegExp(`(etoile|numero|\\ble|\\bdu)\\s*(numero\\s*)?${param}\\b`), ' ') : texte;
  const regles = [
    [/(?:au moins|minimum|a partir de)\s*(\d+)/, '>=', 0], [/(\d+)\s*(?:ou plus|et plus|minimum)/, '>=', 0],
    [/(?:plus de|superieure? a|au[- ]dessus de|depasse)\s*(\d+)/, '>=', 1],
    [/(?:au plus|maximum)\s*(\d+)/, '<=', 0], [/(\d+)\s*(?:ou moins|maximum)/, '<=', 0],
    [/(?:moins de|inferieure? a|en dessous de|sous)\s*(\d+)/, '<=', -1],
    [/(?:exactement|pile)\s*(\d+)/, '=', 0], [/\baucune?\b/, '=', null],
  ];
  for (const [motif, op, decalage] of regles) {
    const m = sansParam.match(motif);
    if (m) return { op, val: decalage === null ? 0 : Number(m[1]) + decalage };
  }
  const nu = sansParam.match(/\b(\d{1,3})\b/);
  if (nu) return { op: PROPRIETES[prop].max <= 5 ? '>=' : '=', val: Number(nu[1]) };
  return null;
}

// Transforme une phrase en test. Renvoie { spec } quand c'est compris, sinon { erreur } avec ce qui manque.
export function interpreter(question) {
  let texte = sansAccent(String(question)).replace(/\s+/g, ' ').trim();
  if (!texte) return { erreur: 'Écrivez votre question, par exemple : « Les numéros pairs sortent-ils plus après 4 impairs ? »' };
  const jour = /mardi/.test(texte) ? 'mardi' : /vendredi/.test(texte) ? 'vendredi' : null;
  let serie = 1;
  const suite = texte.match(/(\d+)\s*tirages?\s*(?:de suite|consecutifs?|d affilee|a la suite)/);
  if (suite) { serie = Math.min(10, Math.max(1, Number(suite[1]))); texte = texte.replace(suite[0], ' '); }
  texte = texte.replace(/\b(le|au|du) tirage (suivant|d apres|precedent|d avant)\b/g, ' ');

  let partieCible = texte, partieCondition = null, decalage = 0;
  const apres = texte.match(/^(.*?)\b(apres|suite a|a la suite de|derriere)\b(.*)$/);
  const quand = texte.match(/^(.*?)\b(quand|lorsque|lorsqu|si|des que)\b(.*)$/);
  if (apres) {
    decalage = 1;
    [partieCible, partieCondition] = apres[1].trim().length > 3 ? [apres[1], apres[3]] : (apres[3].split(/,| alors | est-ce | y a-t-il /).length > 1
      ? [apres[3].split(/,| alors | est-ce | y a-t-il /).slice(1).join(' '), apres[3].split(/,| alors | est-ce | y a-t-il /)[0]] : [apres[1], apres[3]]);
  } else if (quand) {
    const morceaux = quand[3].split(/,| alors | est-ce /);
    [partieCible, partieCondition] = quand[1].trim().length > 3 ? [quand[1], quand[3]] : [morceaux.slice(1).join(' '), morceaux[0]];
  }

  const cibleProp = trouverPropriete(partieCible || '');
  if (!cibleProp) return { erreur: 'Je n\'ai pas compris ce qu\'il faut mesurer. Utilisez les menus ci-dessous, ou des mots comme : pairs, impairs, somme, suites, dizaines, le numéro 7, l\'étoile 3.' };
  const cibleSeuil = PROPRIETES[cibleProp.prop].parametre ? { op: '=', val: 1 } : trouverSeuil(partieCible, cibleProp.prop, cibleProp.param);
  const spec = { decalage, jour, condition: null, cible: { ...cibleProp, ...(cibleSeuil || { op: null, val: null }) } };
  if (partieCondition !== null) {
    const condProp = trouverPropriete(partieCondition);
    if (!condProp) return { erreur: 'J\'ai compris ce qu\'il faut mesurer, mais pas la condition (ce qui vient après « après » ou « quand »). Utilisez les menus ci-dessous.' };
    const condSeuil = PROPRIETES[condProp.prop].parametre ? { op: '=', val: 1 } : trouverSeuil(partieCondition, condProp.prop, condProp.param);
    if (!condSeuil) return { erreur: 'Il manque un chiffre dans la condition, par exemple « après au moins 4 impairs ».' };
    spec.condition = { ...condProp, ...condSeuil, serie };
  }
  return { spec: valider(spec) };
}

// Remet un test quelconque (saisi par menus, relu de la mémoire) dans les bornes ; renvoie null s'il est inutilisable.
export function valider(spec) {
  const partie = (x, avecSeuil) => {
    if (!x || !PROPRIETES[x.prop]) return null;
    const P = PROPRIETES[x.prop];
    const param = P.parametre ? Math.min(P.parametre, Math.max(1, Math.round(Number(x.param) || 1))) : null;
    const op = OPERATEURS[x.op] ? x.op : null;
    if (avecSeuil && !op) return null;
    return { prop: x.prop, param, op, val: op ? Math.min(P.max, Math.max(0, Math.round(Number(x.val) || 0))) : null };
  };
  const cible = partie(spec?.cible, false);
  if (!cible) return null;
  const condition = spec.condition ? partie(spec.condition, true) : null;
  if (spec.condition && !condition) return null;
  return {
    decalage: condition && spec.decalage === 0 ? 0 : condition ? 1 : 0,
    jour: ['mardi', 'vendredi'].includes(spec.jour) ? spec.jour : null,
    condition: condition ? { ...condition, serie: Math.min(10, Math.max(1, Math.round(Number(spec.condition.serie) || 1))) } : null,
    cible,
  };
}

// ---------- Dire le test en français ----------

const nomme = (x) => PROPRIETES[x.prop].nom + (x.param ? ` ${x.param}` : '');
function direSeuil(x) {
  const P = PROPRIETES[x.prop];
  if (P.parametre) return `${nomme(x)} ${x.val ? 'est sorti' + (x.prop === 'etoile' ? 'e' : '') : 'n\'est pas sorti' + (x.prop === 'etoile' ? 'e' : '')}`;
  return P.max > 5 || x.prop === 'suites' || x.prop === 'dizaines'
    ? `${P.unite} : ${OPERATEURS[x.op]} ${x.val}` : `${OPERATEURS[x.op]} ${x.val} ${P.nom}`;
}

export function decrire(spec, nbTirages) {
  const jour = spec.jour ? ` du ${spec.jour}` : '';
  const mesure = spec.cible.op
    ? `la part des tirages où « ${direSeuil(spec.cible)} »` : `la moyenne de « ${PROPRIETES[spec.cible.prop].unite} »`;
  if (!spec.condition) return `Sur les tirages${jour}, je mesure ${mesure}, et je compare à ce que le hasard donne. Base : les ${nbTirages.toLocaleString('fr-FR')} tirages.`;
  const c = spec.condition;
  const situation = c.serie > 1 ? `${c.serie} tirages de suite où « ${direSeuil(c)} »` : `un tirage où « ${direSeuil(c)} »`;
  return spec.decalage
    ? `Je cherche chaque fois qu'il y a eu ${situation}. Sur le tirage${jour} qui suit, je mesure ${mesure}, et je compare à ce que le hasard donne. Base : les ${nbTirages.toLocaleString('fr-FR')} tirages.`
    : `Je prends les tirages${jour} où « ${direSeuil(c)} ». Dans ces mêmes tirages, je mesure ${mesure}, et je compare à ce que le hasard donne. Base : les ${nbTirages.toLocaleString('fr-FR')} tirages.`;
}

// ---------- Calculer ----------

// La mesure d'un test sur un historique : { valeur, cas } (valeur = moyenne, ou % de tirages où l'événement a lieu).
export function mesurer(spec, tirages) {
  const cible = tirages.map((t) => PROPRIETES[spec.cible.prop].f(t, spec.cible.param));
  const condition = spec.condition ? tirages.map((t) => comparer(PROPRIETES[spec.condition.prop].f(t, spec.condition.param), spec.condition.op, spec.condition.val)) : null;
  const serie = spec.condition?.serie ?? 1;
  let somme = 0, cas = 0, suite = 0;
  for (let i = 0; i < tirages.length; i++) {
    suite = condition ? (condition[i] ? suite + 1 : 0) : serie;
    const j = i + spec.decalage;
    if (suite < serie || j >= tirages.length) continue;
    if (spec.jour && (jourSemaine(tirages[j][0]) === 2 ? 'mardi' : 'vendredi') !== spec.jour) continue;
    cas++;
    somme += spec.cible.op ? (comparer(cible[j], spec.cible.op, spec.cible.val) ? 100 : 0) : cible[j];
  }
  return { valeur: cas ? somme / cas : null, cas };
}

function tirer(combien, max, hasard) {
  const choisis = [];
  while (choisis.length < combien) { const x = 1 + Math.floor(hasard() * max); if (!choisis.includes(x)) choisis.push(x); }
  return choisis.sort((a, b) => a - b);
}

// Un faux historique : mêmes dates, numéros et étoiles tirés au hasard (avec le nombre d'étoiles en jeu à chaque date).
export function fauxHistorique(tirages, hasard) {
  return tirages.map((t) => [t[0], ...tirer(5, 50, hasard), ...tirer(2, nbEtoilesEnJeu(t[0]), hasard)]);
}

export const NB_SIMULATIONS = 300;
export const PEU_DE_CAS = 20;

// Le test complet : la mesure réelle, puis la même sur des faux historiques.
export function tester(spec, tirages, nbSimulations = NB_SIMULATIONS, hasard = Math.random) {
  const reel = mesurer(spec, tirages);
  const P = PROPRIETES[spec.cible.prop];
  const base = { cas: reel.cas, obs: reel.valeur, unite: spec.cible.op ? '% des tirages' : P.unite, dec: spec.cible.op ? 1 : P.max > 5 ? 1 : 2, nbSimulations };
  if (!reel.cas) return { ...base, statut: 'vide', att: null, bas: null, haut: null, p: null };
  const sims = [];
  for (let s = 0; s < nbSimulations; s++) {
    const v = mesurer(spec, fauxHistorique(tirages, hasard)).valeur;
    if (v !== null) sims.push(v);
  }
  if (sims.length < nbSimulations / 2) return { ...base, statut: 'vide', att: null, bas: null, haut: null, p: null };
  sims.sort((a, b) => a - b);
  const att = sims.reduce((a, b) => a + b, 0) / sims.length;
  const rang = (q) => sims[Math.min(sims.length - 1, Math.max(0, Math.round(q * (sims.length - 1))))];
  const p = (1 + sims.filter((v) => Math.abs(v - att) >= Math.abs(reel.valeur - att) - 1e-12).length) / (sims.length + 1);
  return { ...base, att, bas: rang(0.025), haut: rang(0.975), p, statut: reel.cas < PEU_DE_CAS ? 'peu' : p < 0.05 ? 'inhabituel' : 'conforme' };
}

const fr = (x, dec) => Number(x).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// La phrase de résultat, en français courant. `essais` : nombre de tests lancés dans Mon Labo jusqu'ici.
export function conclure(spec, r, essais = 1) {
  if (r.statut === 'vide') return 'Cette situation ne s\'est jamais présentée dans l\'historique (ou presque jamais dans les faux historiques) : il n\'y a rien à mesurer.';
  const mesure = spec.cible.op ? `${fr(r.obs, r.dec)} % des tirages` : `${fr(r.obs, r.dec)} en moyenne`;
  const debut = `Résultat sur ${r.cas.toLocaleString('fr-FR')} cas : ${mesure}. Le hasard seul donne ${fr(r.att, r.dec)}${spec.cible.op ? ' %' : ''} en moyenne, ` +
    `et entre ${fr(r.bas, r.dec)} et ${fr(r.haut, r.dec)} dans 19 cas sur 20.`;
  if (r.statut === 'peu') return `${debut} Avec seulement ${r.cas} cas, c'est trop peu pour conclure, quel que soit le résultat.`;
  const rappel = essais > 1 ? ` Vous avez lancé ${essais} tests dans Mon Labo : sur 20 tests d'un hasard parfait, 1 ressort en moyenne par pure chance.` : '';
  return r.statut === 'inhabituel'
    ? `${debut} L'observé sort de cette zone : c'est inhabituel, mais cela ne prouve rien à lui seul.${rappel || ' Sur 20 tests d\'un hasard parfait, 1 ressort en moyenne par pure chance.'} Aucun résultat ne dit quoi jouer.`
    : `${debut} L'observé est dans cette zone : conforme au hasard, rien d'étonnant.${rappel}`;
}

// ---------- Passerelle vers le générateur ----------

// La « loi » qu'un test enregistré peut imposer à une grille : son événement mesuré, ou à défaut sa condition.
export function loiDeGrille(spec) {
  const x = spec.cible.op ? spec.cible : spec.condition;
  return x ? { ...x, texte: direSeuil(x) } : null;
}

// 1 si la grille respecte la loi, 0 sinon.
export function respecte(loi, grille) {
  const t = ['', ...grille.numeros, ...grille.etoiles];
  return comparer(PROPRIETES[loi.prop].f(t, loi.param), loi.op, loi.val) ? 1 : 0;
}

// ---------- Mémoire ----------

const CLE_STOCKAGE = 'labise-monlabo';
export const MESURES_MAX = 20;

export function charger(stockage) {
  const m = lire(stockage, CLE_STOCKAGE, {});
  const mesures = (Array.isArray(m.mesures) ? m.mesures : [])
    .map((x) => ({ id: String(x?.id ?? ''), question: String(x?.question ?? '').slice(0, 200), spec: valider(x?.spec) }))
    .filter((x) => x.id && x.spec).slice(0, MESURES_MAX);
  return { mesures, essais: Math.max(0, Math.round(Number(m.essais) || 0)) };
}

export const sauver = (stockage, labo) => ecrire(stockage, CLE_STOCKAGE, labo);

export function enregistrer(labo, question, spec) {
  const id = JSON.stringify(spec);
  if (labo.mesures.some((m) => m.id === id)) return labo;
  return { ...labo, mesures: [{ id, question: String(question).slice(0, 200), spec }, ...labo.mesures].slice(0, MESURES_MAX) };
}

export const oublier = (labo, id) => ({ ...labo, mesures: labo.mesures.filter((m) => m.id !== id) });
