// Rejeu d'une grille sur l'historique : ce qu'elle aurait coûté et rapporté, payée aux vrais montants.
// Même règle du jeu que le laboratoire (eurom/rangs.py pour l'EuroMillions, eurom/lotto/regles.py pour le Lotto).

import { JEU, JEUX, numerosDe, etoilesDe, bonusDe } from './jeu.js';

// Les rangs de l'EuroMillions, époque par époque (gardés ici pour les tests et les anciens appels).
export const ORDRES = JEUX.euromillions.ordres;

export const epoque = (jour) => JEU.epoque(jour);
export const nbEtoilesEnJeu = (jour) => JEU.nbEtoilesEnJeu(jour);
export const prix = (jour) => JEU.prix(jour);

// Une grille n'était jouable que si ses étoiles existaient à cette date (au Lotto, toujours).
export const jouable = (grille, jour) => grille.etoiles.every((e) => e <= nbEtoilesEnJeu(jour));

// montants : gain par gagnant à chaque rang ce soir-là (0 = personne n'a gagné ce rang).
// EuroMillions : rang selon (bons numéros, bonnes étoiles). Lotto : selon (bons numéros, bonus présent dans la grille ou non).
export function evaluer(grille, tirage, montants) {
  const sortis = numerosDe(tirage);
  const bonsNumeros = grille.numeros.filter((n) => sortis.includes(n)).length;
  const bonnesEtoiles = JEU.bonus
    ? (grille.numeros.includes(bonusDe(tirage)) ? 1 : 0)
    : grille.etoiles.filter((e) => etoilesDe(tirage).includes(e)).length;
  const place = JEU.ordres[epoque(tirage[0])].indexOf(`${bonsNumeros}+${bonnesEtoiles}`);
  const rang = place < 0 ? null : place + 1;
  const gain = rang ? montants[place] || 0 : 0;
  // rang atteint mais montant à 0 dans la source : personne ne l'avait gagné, le montant réel est inconnu
  return { bonsNumeros, bonnesEtoiles, rang, gain, inconnu: rang !== null && !gain };
}

const POINTS_COURBE = 80;

// Rejoue une grille sur tous les tirages où elle était jouable. donnees : { tirages, gains } alignés.
export function rejouer(grille, donnees) {
  const r = { tirages: 0, debut: null, fin: null, cout: 0, gains: 0, gagnantes: 0, parRang: Array(JEU.nbRangs).fill(0),
    meilleurRang: null, serieMax: 0, inconnus: 0, meilleurs: [], courbe: [], touches: [], parAnnee: [] };
  let serie = 0;
  const soldes = [], annees = new Map();
  donnees.tirages.forEach((t, i) => {
    if (!jouable(grille, t[0])) return;
    const e = evaluer(grille, t, donnees.gains[i]);
    r.tirages++; r.debut = r.debut || t[0]; r.fin = t[0];
    r.cout += prix(t[0]); r.gains += e.gain;
    const cle = t[0].slice(0, 4);
    if (!annees.has(cle)) annees.set(cle, { annee: cle, tirages: 0, touches: 0, cout: 0, gains: 0, meilleurRang: null });
    const a = annees.get(cle);
    a.tirages++; a.cout += prix(t[0]); a.gains += e.gain;
    if (e.rang) {
      r.parRang[e.rang - 1]++;
      r.meilleurRang = r.meilleurRang === null ? e.rang : Math.min(r.meilleurRang, e.rang);
      if (e.inconnu) r.inconnus++;
      r.meilleurs.push({ date: t[0], rang: e.rang, gain: e.gain, bonsNumeros: e.bonsNumeros, bonnesEtoiles: e.bonnesEtoiles });
      // la chronologie : chaque tirage où la grille a touché, avec le vrai tirage pour voir ce qui est sorti
      r.touches.push({ date: t[0], rang: e.rang, gain: e.gain, inconnu: e.inconnu, bonsNumeros: e.bonsNumeros, bonnesEtoiles: e.bonnesEtoiles,
        numeros: numerosDe(t), etoiles: etoilesDe(t), bonus: bonusDe(t) });
      a.touches++; a.meilleurRang = a.meilleurRang === null ? e.rang : Math.min(a.meilleurRang, e.rang);
    }
    if (e.gain > 0) { r.gagnantes++; serie = 0; } else { serie++; r.serieMax = Math.max(r.serieMax, serie); }
    soldes.push({ date: t[0], solde: r.gains - r.cout });
  });
  r.parAnnee = [...annees.values()];
  r.meilleurs = r.meilleurs.sort((a, b) => a.rang - b.rang || b.gain - a.gain).slice(0, 5);
  r.rendu = r.cout ? (100 * r.gains) / r.cout : null;
  const pas = Math.max(1, Math.ceil(soldes.length / POINTS_COURBE));
  r.courbe = soldes.filter((_, i) => i % pas === pas - 1 || i === soldes.length - 1);
  return r;
}
