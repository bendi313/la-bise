// Le générateur : il tire des grilles au hasard, les note selon les réglages, et garde les mieux notées.
// Même principe que le rejeu du laboratoire, qui garde les 5 meilleures grilles sur 100.

import { noter, effetPartage } from './criteres.js';
import { DOSAGES } from './reglages.js';

const CANDIDATES_PAR_GRILLE = 20;
const CANDIDATES_MIN = 400;
const CANDIDATES_MAX = 20000;

function tirer(combien, max, hasard, imposes = []) {
  const choisis = new Set(imposes);
  while (choisis.size < combien) choisis.add(1 + Math.floor(hasard() * max));
  return [...choisis].sort((a, b) => a - b);
}

// `imposes` : numéros placés d'office dans la grille (les fétiches) ; le reste est tiré au hasard.
export function grilleAuHasard(nbEtoiles = 12, hasard = Math.random, imposes = []) {
  return { numeros: tirer(5, 50, hasard, imposes), etoiles: tirer(2, nbEtoiles, hasard) };
}

export const cleGrille = (g) => g.numeros.join('-') + '+' + g.etoiles.join('-');

// Pour chaque grille demandée, tire au sort quels fétiches y seront placés d'office, selon le dosage.
// Renvoie les groupes { imposes, combien } : « 3 grilles avec le 7 et le 13 », « 2 grilles sans fétiche », etc.
export function repartirFetiches(nombre, fetiches, dosage, hasard = Math.random) {
  const groupes = new Map();
  for (let i = 0; i < nombre; i++) {
    const imposes = fetiches.filter(() => DOSAGES[dosage].part >= 1 || hasard() < DOSAGES[dosage].part);
    const cle = imposes.join('-');
    if (!groupes.has(cle)) groupes.set(cle, { imposes, combien: 0 });
    groupes.get(cle).combien++;
  }
  return [...groupes.values()];
}

// Renvoie `nombre` grilles différentes, de la mieux notée à la moins bien notée.
// Chaque grille : { numeros, etoiles, respect (% ou null), notes, partage: { gagnants, gain } }.
export function generer(nombre, reglages, ctx, populaire, hasard = Math.random) {
  const nbEtoiles = populaire.etoiles.length;
  const dejaPrises = new Set(), gardees = [];
  let ordre = 0;
  repartirFetiches(nombre, reglages.fetiches || [], reglages.dosage, hasard).forEach(({ imposes, combien }) => {
    const nbCandidates = Math.min(CANDIDATES_MAX, Math.max(CANDIDATES_MIN, combien * CANDIDATES_PAR_GRILLE));
    const vues = new Map();
    for (let essais = 0; vues.size < nbCandidates && essais < nbCandidates * 3; essais++) {
      const g = grilleAuHasard(nbEtoiles, hasard, imposes);
      const cle = cleGrille(g);
      if (!vues.has(cle) && !dejaPrises.has(cle)) vues.set(cle, { ...g, ...noter(g, ctx, reglages), ordre: ordre++ });
    }
    // sans réglage (hasard pur), on garde simplement les premières tirées
    // dans un groupe, c'est le style seul qui classe : les fétiches y sont déjà placés selon le dosage
    [...vues.values()].sort(par('style')).slice(0, combien).forEach((g) => { dejaPrises.add(cleGrille(g)); gardees.push(g); });
  });
  return gardees.sort(par('respect')).map(({ ordre: _, style: __, ...g }) => ({ ...g, partage: effetPartage(g, populaire) }));
}

const par = (champ) => (a, b) => (b[champ] ?? 0) - (a[champ] ?? 0) || a.ordre - b.ordre;
