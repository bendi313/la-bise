// « Mes formules » : les réglages fins de « Mon mélange », enregistrés sous un nom et rechargés d'un toucher.
// (Le fichier garde son ancien nom : les formules ont remplacé les « decks » des premières versions.)

import { validerMelange, valider, MELANGE, lire, ecrire } from './reglages.js';

const CLE_STOCKAGE = 'labise-decks';      // même emplacement qu'avant : les anciens decks deviennent des formules
export const FORMULES_MAX = 12;
const NOM_MAX = 30;

export const nomPropre = (nom) => String(nom ?? '').replace(/[<>&"']/g, '').replace(/\s+/g, ' ').trim().slice(0, NOM_MAX);

// Ce qu'une formule retient : les poids des critères, la fenêtre du « chaud », la plage de somme, les fétiches et leur dosage.
export const extraire = (melange) => JSON.parse(JSON.stringify(validerMelange(melange)));

// Enregistre (ou remplace) une formule. Renvoie la nouvelle liste, ou un texte qui dit ce qui ne va pas.
export function enregistrer(formules, nom, melange) {
  const propre = nomPropre(nom);
  if (!propre) return 'Donnez un nom à la formule.';
  const autres = formules.filter((f) => f.nom !== propre);
  if (autres.length >= FORMULES_MAX) return `Pas plus de ${FORMULES_MAX} formules : supprimez-en une d'abord.`;
  return [...autres, { nom: propre, reglages: extraire(melange) }].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export const supprimer = (formules, nom) => formules.filter((f) => f.nom !== nom);

// Les réglages après chargement d'une formule : elle remplit « Mon mélange » et le sélectionne, sans toucher au reste
// (ni aux fétiches des styles purs, ni au Moteur Labo, ni au thème).
export function appliquer(reglages, formule) {
  return valider({ ...reglages, mode: 'classique', style: MELANGE, melange: extraire(formule.reglages) });
}

// La formule dont les réglages sont exactement ceux de « Mon mélange » en ce moment, s'il y en a une.
export function formuleActive(formules, melange) {
  const courant = JSON.stringify(extraire(melange));
  return formules.find((f) => JSON.stringify(extraire(f.reglages)) === courant)?.nom ?? null;
}

export function charger(stockage) {
  const liste = lire(stockage, CLE_STOCKAGE, []);
  return (Array.isArray(liste) ? liste : [])
    .filter((f) => f && nomPropre(f.nom) && f.reglages)
    .map((f) => ({ nom: nomPropre(f.nom), reglages: extraire(f.reglages) }))
    .slice(0, FORMULES_MAX);
}

export const sauver = (stockage, formules) => ecrire(stockage, CLE_STOCKAGE, formules);
