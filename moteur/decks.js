// Les decks : des configurations complètes, enregistrées sous un nom, qu'on rappelle d'un toucher.

import { valider, lire, ecrire } from './reglages.js';

const CLE_STOCKAGE = 'labise-decks';
export const DECKS_MAX = 12;
const NOM_MAX = 30;
// Ce qu'un deck retient : le style, les réglages fins, les fétiches, le thème et l'affichage.
const CHAMPS = ['poids', 'fenetreChaud', 'sommeMin', 'sommeMax', 'nombre', 'fetiches', 'dosage', 'affichage', 'theme', 'perso', 'seuils'];

export const nomPropre = (nom) => String(nom ?? '').replace(/[<>&"']/g, '').replace(/\s+/g, ' ').trim().slice(0, NOM_MAX);

export function extraire(reglages) {
  const complet = valider(reglages);
  return Object.fromEntries(CHAMPS.map((c) => [c, JSON.parse(JSON.stringify(complet[c]))]));
}

// Enregistre (ou remplace) un deck. Renvoie la nouvelle liste, ou un texte qui dit ce qui ne va pas.
export function enregistrer(decks, nom, reglages) {
  const propre = nomPropre(nom);
  if (!propre) return 'Donnez un nom au deck.';
  const autres = decks.filter((d) => d.nom !== propre);
  if (autres.length >= DECKS_MAX) return `Pas plus de ${DECKS_MAX} decks : supprimez-en un d'abord.`;
  return [...autres, { nom: propre, reglages: extraire(reglages) }].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export const supprimer = (decks, nom) => decks.filter((d) => d.nom !== nom);

// Les réglages après chargement d'un deck. L'acceptation des mentions légales n'appartient pas au deck.
export function appliquer(reglages, deck) {
  return valider({ ...reglages, ...extraire(deck.reglages), mentionsAcceptees: reglages.mentionsAcceptees });
}

// Le deck dont les réglages sont exactement ceux en cours, s'il y en a un.
export function deckActif(decks, reglages) {
  const courant = JSON.stringify(extraire(reglages));
  return decks.find((d) => JSON.stringify(extraire(d.reglages)) === courant)?.nom ?? null;
}

export function charger(stockage) {
  const liste = lire(stockage, CLE_STOCKAGE, []);
  return (Array.isArray(liste) ? liste : [])
    .filter((d) => d && nomPropre(d.nom) && d.reglages)
    .map((d) => ({ nom: nomPropre(d.nom), reglages: extraire(d.reglages) }))
    .slice(0, DECKS_MAX);
}

export const sauver = (stockage, decks) => ecrire(stockage, CLE_STOCKAGE, decks);
