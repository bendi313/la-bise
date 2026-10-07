// Les critères des profils. Chaque critère note une grille de 0 (ne respecte pas du tout) à 1 (respecte au mieux).
// Aucune note ne mesure une chance de gagner : toutes les grilles ont la même.

import { DOSAGES } from './reglages.js';
import { respecte } from './monlabo.js';
import { JEU, numerosDe, etoilesDe } from './jeu.js';

const POIDS_LOI = 100;

// Place de chaque valeur parmi les autres, de 0 (la plus petite) à 1 (la plus grande) ; les ex æquo partagent.
export function centiles(valeurs) {
  const n = valeurs.length;
  return valeurs.map((v) => {
    let plusPetits = 0, egaux = -1;
    valeurs.forEach((w) => { if (w < v) plusPetits++; else if (w === v) egaux++; });
    return (plusPetits + 0.5 * egaux) / Math.max(1, n - 1);
  });
}

// tirages : [[date, n1, n2, n3, n4, n5, e1, e2], …] du plus ancien au plus récent ([date, n1..n6, bonus] au Lotto : le bonus n'y compte pas).
// « chaud » = nombre de sorties sur les `fenetre` derniers tirages ; « retard » = tirages écoulés depuis la dernière sortie.
export function statistiques(tirages, fenetre, nbEtoiles = 12) {
  const total = tirages.length;
  const s = {
    nb: total, fenetre,
    sortiesN: Array(JEU.boules).fill(0), chaudN: Array(JEU.boules).fill(0), retardN: Array(JEU.boules).fill(total),
    sortiesE: Array(nbEtoiles).fill(0), chaudE: Array(nbEtoiles).fill(0), retardE: Array(nbEtoiles).fill(total),
  };
  tirages.forEach((t, i) => {
    const recent = i >= total - fenetre, age = total - 1 - i;
    numerosDe(t).forEach((n) => { s.sortiesN[n - 1]++; if (recent) s.chaudN[n - 1]++; s.retardN[n - 1] = age; });
    etoilesDe(t).forEach((e) => { s.sortiesE[e - 1]++; if (recent) s.chaudE[e - 1]++; s.retardE[e - 1] = age; });
  });
  s.centChaudN = centiles(s.chaudN); s.centChaudE = centiles(s.chaudE);
  s.centFroidN = centiles(s.retardN); s.centFroidE = centiles(s.retardE);
  // « corde à nœuds » : tension d'un numéro = moyenne de ses 3 derniers écarts entre deux sorties, rapportée à l'écart moyen
  // (10 tirages à l'EuroMillions, 7,5 au Lotto) : 1 = normale
  const sorties = Array.from({ length: JEU.boules }, () => []);
  tirages.forEach((t, i) => numerosDe(t).forEach((n) => sorties[n - 1].push(i)));
  s.tensionN = sorties.map((l) => {
    const ecarts = l.slice(-4).map((x, i, a) => (i ? x - a[i - 1] : null)).filter((x) => x !== null);
    return ecarts.length ? ecarts.reduce((a, b) => a + b, 0) / ecarts.length / JEU.ecartMoyen : 1;
  });
  s.centTensionN = centiles(s.tensionN);
  return s;
}

// Les lois du labo utilisables pour générer des grilles. Comme les styles, aucune ne change la chance de gagner.
export const LOIS = {
  gauss: {
    nom: 'Courbe de Gauss',
    get texte() { return `Garde les grilles dont la somme est proche du centre de la cloche (${String(JEU.sommeCentre).replace('.', ',')}).`; },
    note: (g) => 1 - Math.min(1, Math.abs(g.numeros.reduce((a, b) => a + b, 0) - JEU.sommeCentre) / 60),
  },
  corde: {
    nom: 'Corde à nœuds', texte: 'Préfère les numéros dont la corde est « tendue » : leurs dernières sorties ont été espacées.',
    note: (g, ctx) => g.numeros.reduce((a, n) => a + ctx.stats.centTensionN[n - 1], 0) / g.numeros.length,
  },
  entropie: {
    nom: 'Désordre maximal',
    get texte() { return JEU.k <= JEU.nbDizaines ? 'Préfère les grilles dispersées : idéalement un numéro par dizaine.' : 'Préfère les grilles dispersées : idéalement deux numéros dans une dizaine et un dans chacune des autres.'; },
    note: (g) => {
      const parDizaine = Array(JEU.nbDizaines).fill(0), k = g.numeros.length;
      g.numeros.forEach((n) => { parDizaine[Math.floor((n - 1) / 10)]++; });
      return Math.abs(-parDizaine.filter(Boolean).reduce((a, x) => a + (x / k) * Math.log2(x / k), 0)) / JEU.entropieMax;
    },
  },
};

// Tout ce dont les critères ont besoin : statistiques des tirages et popularité des numéros (mesurée par le laboratoire).
// `loisPerso` : les lois tirées des mesures enregistrées dans Mon Labo et cochées par l'utilisateur ({ id, loi }).
export function contexte(donnees, reglages, loisPerso = []) {
  const sansTrou = (liste) => liste.map((x) => x ?? 0);
  return {
    loisPerso,
    stats: statistiques(donnees.tirages, reglages.fenetreChaud, donnees.populaire.etoiles.length),
    centPopN: centiles(sansTrou(donnees.populaire.numeros)),
    centPopE: centiles(sansTrou(donnees.populaire.etoiles)),
  };
}

function moyenne(grille, parNumero, parEtoile) {
  let somme = 0;
  grille.numeros.forEach((n) => { somme += parNumero[n - 1]; });
  grille.etoiles.forEach((e) => { somme += parEtoile[e - 1]; });
  return somme / (grille.numeros.length + grille.etoiles.length);
}

export const CRITERES = {
  chaud: (g, ctx) => moyenne(g, ctx.stats.centChaudN, ctx.stats.centChaudE),
  froid: (g, ctx) => moyenne(g, ctx.stats.centFroidN, ctx.stats.centFroidE),
  harmonique: (g, ctx, r) => {
    const somme = g.numeros.reduce((a, b) => a + b, 0);
    const pairs = g.numeros.filter((n) => n % 2 === 0).length;
    return ((somme >= r.sommeMin && somme <= r.sommeMax ? 1 : 0) + (JEU.pairs.includes(pairs) ? 1 : 0)) / 2;
  },
  antiFoule: (g, ctx) => 1 - moyenne(g, ctx.centPopN, ctx.centPopE),
};

export const NOMS_CRITERES = { chaud: 'Chaud', froid: 'Froid', harmonique: 'Harmonique', antiFoule: 'Anti-Foule' };

// Part des numéros fétiches présents dans la grille (null s'il n'y a pas de fétiche).
export function noteFetiches(grille, fetiches) {
  return fetiches.length ? fetiches.filter((n) => grille.numeros.includes(n)).length / fetiches.length : null;
}

// Notes d'une grille, et « respect de vos réglages » en % : moyenne des notes, pondérée par les poids choisis.
// Les numéros fétiches comptent avec le poids de leur dosage. Sans aucun poids ni fétiche (hasard pur),
// il n'y a rien à respecter : respect = null.
export function noter(grille, ctx, reglages) {
  const notes = {};
  let somme = 0, poidsTotal = 0;
  Object.keys(CRITERES).forEach((cle) => {
    notes[cle] = CRITERES[cle](grille, ctx, reglages);
    const poids = reglages.poids[cle] || 0;
    somme += poids * notes[cle];
    poidsTotal += poids;
  });
  // les lois du labo cochées comptent chacune comme un style à plein poids
  notes.lois = {};
  Object.keys(LOIS).filter((cle) => reglages.lois?.[cle]).forEach((cle) => {
    notes.lois[cle] = LOIS[cle].note(grille, ctx);
    somme += POIDS_LOI * notes.lois[cle];
    poidsTotal += POIDS_LOI;
  });
  (ctx.loisPerso || []).forEach(({ id, loi }) => {
    notes.lois[id] = respecte(loi, grille);
    somme += POIDS_LOI * notes.lois[id];
    poidsTotal += POIDS_LOI;
  });
  // note du style seul : c'est elle qui classe les candidates, pour que le dosage des fétiches reste celui demandé
  const style = poidsTotal ? (100 * somme) / poidsTotal : null;
  const fetiches = reglages.fetiches || [];
  notes.fetiches = noteFetiches(grille, fetiches);
  if (fetiches.length) {
    const poids = DOSAGES[reglages.dosage].poids;
    somme += poids * notes.fetiches;
    poidsTotal += poids;
  }
  return { notes, style, respect: poidsTotal ? (100 * somme) / poidsTotal : null };
}

// Effet de partage estimé. `populaire` : % de gagnants en plus (ou en moins) quand le numéro sort.
// +10 % de gagnants = environ -9 % de gain pour chacun.
export function effetPartage(grille, populaire) {
  let facteur = 1;
  grille.numeros.forEach((n) => { facteur *= 1 + (populaire.numeros[n - 1] ?? 0) / 100; });
  grille.etoiles.forEach((e) => { facteur *= 1 + (populaire.etoiles[e - 1] ?? 0) / 100; });
  return { gagnants: (facteur - 1) * 100, gain: (1 / facteur - 1) * 100 };
}
