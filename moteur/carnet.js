// Le carnet : les grilles réellement jouées, gardées sur l'appareil, et vérifiées dès que le tirage est connu.

import { lire, ecrire } from './reglages.js';
import { cleGrille } from './generateur.js';
import { evaluer, prix, jouable } from './rejeu.js';

const CLE_STOCKAGE = 'labise-carnet';
export const CARNET_MAX = 500;

const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const jourSemaine = (jour) => new Date(jour + 'T12:00:00Z').getUTCDay();          // 2 = mardi, 5 = vendredi
export const estJourDeTirage = (jour) => [2, 5].includes(jourSemaine(jour));

// Le prochain mardi ou vendredi, le jour même compris.
export function prochainTirage(aujourdhui) {
  const d = new Date(aujourdhui + 'T12:00:00Z');
  while (![2, 5].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

const distincts = (liste, combien, max) => Array.isArray(liste) && liste.length === combien && new Set(liste).size === combien &&
  liste.every((n) => Number.isInteger(n) && n >= 1 && n <= max);

// Renvoie l'entrée propre { id, numeros, etoiles, date }, ou un texte qui dit ce qui ne va pas.
export function preparer(numeros, etoiles, date) {
  if (!distincts(numeros, 5, 50)) return 'Il faut 5 numéros différents entre 1 et 50.';
  if (!distincts(etoiles, 2, 12)) return 'Il faut 2 étoiles différentes entre 1 et 12.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(date))) return 'La date du tirage est illisible.';
  if (!estJourDeTirage(date)) return 'Cette date n\'est ni un mardi ni un vendredi : pas de tirage ce jour-là.';
  const grille = { numeros: [...numeros].sort((a, b) => a - b), etoiles: [...etoiles].sort((a, b) => a - b) };
  if (!jouable(grille, date)) return 'À cette date, ces étoiles n\'existaient pas encore.';
  return { id: `${date}|${cleGrille(grille)}`, ...grille, date };
}

// Ajoute une entrée (sans doublon : même grille, même tirage). Les plus récentes d'abord.
export function ajouter(carnet, entree) {
  if (carnet.some((e) => e.id === entree.id)) return carnet;
  return [entree, ...carnet].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, CARNET_MAX);
}

export const supprimer = (carnet, id) => carnet.filter((e) => e.id !== id);

// Position de chaque date de tirage dans les données, pour retrouver un tirage d'un coup.
export const indexParDate = (donnees) => new Map(donnees.tirages.map((t, i) => [t[0], i]));

// Où en est une entrée : tirage connu (avec son résultat), encore attendu, ou date passée sans tirage dans les données.
export function etatEntree(entree, donnees, index, dernierTirage) {
  const i = index.get(entree.date);
  if (i !== undefined) return { statut: 'tire', tirage: donnees.tirages[i], ...evaluer(entree, donnees.tirages[i], donnees.gains[i]) };
  return { statut: entree.date > dernierTirage ? 'attente' : 'introuvable' };
}

export function bilan(carnet, donnees, index, dernierTirage) {
  const b = { grilles: carnet.length, tirees: 0, attente: 0, cout: 0, gains: 0, gagnantes: 0, inconnus: 0 };
  carnet.forEach((entree) => {
    const e = etatEntree(entree, donnees, index, dernierTirage);
    if (e.statut === 'tire') {
      b.tirees++; b.cout += prix(entree.date); b.gains += e.gain;
      if (e.rang) b.gagnantes++;
      if (e.inconnu) b.inconnus++;
    } else if (e.statut === 'attente') b.attente++;
  });
  return b;
}

const propre = (e) => {
  const p = preparer(e?.numeros, e?.etoiles, e?.date);
  return typeof p === 'string' ? null : p;
};

export const charger = (stockage) => {
  const liste = lire(stockage, CLE_STOCKAGE, []);
  return (Array.isArray(liste) ? liste : []).map(propre).filter(Boolean);
};
export const sauver = (stockage, carnet) => ecrire(stockage, CLE_STOCKAGE, carnet);
