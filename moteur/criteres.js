// Les critères des profils. Chaque critère note une grille de 0 (ne respecte pas du tout) à 1 (respecte au mieux).
// Aucune note ne mesure une chance de gagner : toutes les grilles ont la même.

import { DOSAGES } from './reglages.js';

// Place de chaque valeur parmi les autres, de 0 (la plus petite) à 1 (la plus grande) ; les ex æquo partagent.
export function centiles(valeurs) {
  const n = valeurs.length;
  return valeurs.map((v) => {
    let plusPetits = 0, egaux = -1;
    valeurs.forEach((w) => { if (w < v) plusPetits++; else if (w === v) egaux++; });
    return (plusPetits + 0.5 * egaux) / Math.max(1, n - 1);
  });
}

// tirages : [[date, n1, n2, n3, n4, n5, e1, e2], …] du plus ancien au plus récent.
// « chaud » = nombre de sorties sur les `fenetre` derniers tirages ; « retard » = tirages écoulés depuis la dernière sortie.
export function statistiques(tirages, fenetre, nbEtoiles = 12) {
  const total = tirages.length;
  const s = {
    nb: total, fenetre,
    sortiesN: Array(50).fill(0), chaudN: Array(50).fill(0), retardN: Array(50).fill(total),
    sortiesE: Array(nbEtoiles).fill(0), chaudE: Array(nbEtoiles).fill(0), retardE: Array(nbEtoiles).fill(total),
  };
  tirages.forEach((t, i) => {
    const recent = i >= total - fenetre, age = total - 1 - i;
    t.slice(1, 6).forEach((n) => { s.sortiesN[n - 1]++; if (recent) s.chaudN[n - 1]++; s.retardN[n - 1] = age; });
    t.slice(6, 8).forEach((e) => { s.sortiesE[e - 1]++; if (recent) s.chaudE[e - 1]++; s.retardE[e - 1] = age; });
  });
  s.centChaudN = centiles(s.chaudN); s.centChaudE = centiles(s.chaudE);
  s.centFroidN = centiles(s.retardN); s.centFroidE = centiles(s.retardE);
  return s;
}

// Tout ce dont les critères ont besoin : statistiques des tirages et popularité des numéros (mesurée par le laboratoire).
export function contexte(donnees, reglages) {
  const sansTrou = (liste) => liste.map((x) => x ?? 0);
  return {
    stats: statistiques(donnees.tirages, reglages.fenetreChaud, donnees.populaire.etoiles.length),
    centPopN: centiles(sansTrou(donnees.populaire.numeros)),
    centPopE: centiles(sansTrou(donnees.populaire.etoiles)),
  };
}

function moyenne(grille, parNumero, parEtoile) {
  let somme = 0;
  grille.numeros.forEach((n) => { somme += parNumero[n - 1]; });
  grille.etoiles.forEach((e) => { somme += parEtoile[e - 1]; });
  return somme / 7;
}

export const CRITERES = {
  chaud: (g, ctx) => moyenne(g, ctx.stats.centChaudN, ctx.stats.centChaudE),
  froid: (g, ctx) => moyenne(g, ctx.stats.centFroidN, ctx.stats.centFroidE),
  harmonique: (g, ctx, r) => {
    const somme = g.numeros.reduce((a, b) => a + b, 0);
    const pairs = g.numeros.filter((n) => n % 2 === 0).length;
    return ((somme >= r.sommeMin && somme <= r.sommeMax ? 1 : 0) + (pairs === 2 || pairs === 3 ? 1 : 0)) / 2;
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
