// Les réglages de l'utilisateur : tout est modifiable, rien n'est imposé.

export const PROFILS = [
  { cle: 'hasard', nom: 'Hasard pur', poids: { chaud: 0, froid: 0, harmonique: 0, antiFoule: 0 } },
  { cle: 'chaud', nom: 'Sur la Vague', poids: { chaud: 100, froid: 0, harmonique: 0, antiFoule: 0 } },
  { cle: 'froid', nom: 'Le Retardataire', poids: { chaud: 0, froid: 100, harmonique: 0, antiFoule: 0 } },
  { cle: 'harmonique', nom: 'Harmonique', poids: { chaud: 0, froid: 0, harmonique: 100, antiFoule: 0 } },
  { cle: 'antiFoule', nom: 'Anti-Foule', poids: { chaud: 0, froid: 0, harmonique: 0, antiFoule: 100 } },
];

export const NOMBRES_DE_GRILLES = [1, 5, 10, 50, 100, 500];

// Dosage des numéros fétiches. `part` : part des grilles où chaque fétiche est placé d'office.
// `poids` : poids des fétiches dans la note « respect de vos réglages ».
export const DOSAGES = {
  leger: { nom: 'Léger', part: 0.25, poids: 25, texte: 'environ 1 grille sur 4' },
  modere: { nom: 'Modéré', part: 0.6, poids: 50, texte: 'environ 6 grilles sur 10' },
  prioritaire: { nom: 'Prioritaire', part: 1, poids: 100, texte: 'toutes les grilles' },
};
export const FETICHES_MAX = 3;
export const AFFICHAGES = ['moderne', 'ticket'];

export const DEFAUTS = {
  poids: { chaud: 0, froid: 0, harmonique: 0, antiFoule: 100 },
  fenetreChaud: 20,      // « chaud » = souvent sorti sur ces N derniers tirages
  sommeMin: 90,          // profil harmonique : somme des 5 numéros entre ces deux bornes
  sommeMax: 160,
  nombre: 5,             // grilles à générer
  fetiches: [],          // jusqu'à 3 numéros fétiches
  dosage: 'modere',
  affichage: 'moderne',  // ou 'ticket'
  lois: { gauss: false, corde: false, entropie: false },   // « Tirage Labo » : lois du labo appliquées à la génération
  loisPerso: [],         // identifiants des mesures de Mon Labo utilisées comme lois
  theme: 'matrix',
  // null = valeur du thème. Couleurs : fond, cartes, textes, accents, boules ; plus la force de la lueur.
  perso: { fond: null, surface: null, texte: null, texte2: null, accent: null, accent2: null, accent3: null, froid: null, chaud: null, lueur: null },
  seuils: { froid: 0, chaud: 100 },   // dégradé des boules : tout froid en dessous de `froid` %, tout chaud au-dessus de `chaud` %
  mentionsAcceptees: false,
};

const COULEURS = Object.keys(DEFAUTS.perso).filter((c) => c !== 'lueur');
const ECART_SEUILS = 10;              // les deux seuils restent séparés d'au moins 10 points

const CLE_STOCKAGE = 'labise-reglages';

function borner(x, min, max, defaut) {
  const v = Number(x);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : defaut;
}

const estCouleur = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Jusqu'à 3 numéros différents entre 1 et 50, triés ; tout le reste est ignoré.
export function validerFetiches(liste) {
  const propres = (Array.isArray(liste) ? liste : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 50);
  return [...new Set(propres)].slice(0, FETICHES_MAX).sort((a, b) => a - b);
}

// Remet des réglages quelconques (anciens, incomplets, abîmés) dans les bornes.
export function valider(r = {}) {
  const poids = {};
  Object.keys(DEFAUTS.poids).forEach((cle) => { poids[cle] = borner(r.poids?.[cle], 0, 100, DEFAUTS.poids[cle]); });
  let sommeMin = borner(r.sommeMin, 15, 240, DEFAUTS.sommeMin), sommeMax = borner(r.sommeMax, 15, 240, DEFAUTS.sommeMax);
  if (sommeMin > sommeMax) [sommeMin, sommeMax] = [sommeMax, sommeMin];
  const lueur = Number(r.perso?.lueur);
  const perso = Object.fromEntries(COULEURS.map((c) => [c, estCouleur(r.perso?.[c]) ? r.perso[c] : null]));
  perso.lueur = r.perso?.lueur === null || r.perso?.lueur === undefined || !Number.isFinite(lueur) ? null : Math.min(2, Math.max(0, lueur));
  const froid = borner(r.seuils?.froid, 0, 100 - ECART_SEUILS, DEFAUTS.seuils.froid);
  const seuils = { froid, chaud: Math.max(froid + ECART_SEUILS, borner(r.seuils?.chaud, 0, 100, DEFAUTS.seuils.chaud)) };
  return {
    poids,
    fenetreChaud: borner(r.fenetreChaud, 5, 200, DEFAUTS.fenetreChaud),
    sommeMin, sommeMax,
    nombre: borner(r.nombre, 1, 500, DEFAUTS.nombre),
    fetiches: validerFetiches(r.fetiches),
    dosage: DOSAGES[r.dosage] ? r.dosage : DEFAUTS.dosage,
    affichage: AFFICHAGES.includes(r.affichage) ? r.affichage : DEFAUTS.affichage,
    lois: Object.fromEntries(Object.keys(DEFAUTS.lois).map((cle) => [cle, r.lois?.[cle] === true])),
    loisPerso: (Array.isArray(r.loisPerso) ? r.loisPerso : []).filter((x) => typeof x === 'string').slice(0, 5),
    theme: typeof r.theme === 'string' ? r.theme : DEFAUTS.theme,
    perso, seuils,
    mentionsAcceptees: r.mentionsAcceptees === true,
  };
}

// Le profil tout prêt qui correspond aux poids, ou « mixte » si l'utilisateur a fait son propre mélange.
export function profilActif(reglages) {
  // dès qu'une loi du labo est cochée, ce n'est plus un style tout prêt
  if (Object.values(reglages.lois || {}).some(Boolean) || (reglages.loisPerso || []).length) return 'mixte';
  const trouve = PROFILS.find((p) => Object.keys(p.poids).every((c) => p.poids[c] === reglages.poids[c]));
  return trouve ? trouve.cle : 'mixte';
}

// `stockage` : localStorage dans l'application, un faux dans les tests.
export function lire(stockage, cle, defaut) {
  try {
    const valeur = JSON.parse(stockage.getItem(cle));
    return valeur === null || valeur === undefined ? defaut : valeur;
  } catch {
    return defaut;
  }
}

export function ecrire(stockage, cle, valeur) {
  try { stockage.setItem(cle, JSON.stringify(valeur)); } catch { /* stockage indisponible : on continue sans mémoire */ }
}

export const charger = (stockage) => valider(lire(stockage, CLE_STOCKAGE, {}));
export const sauver = (stockage, reglages) => ecrire(stockage, CLE_STOCKAGE, valider(reglages));
