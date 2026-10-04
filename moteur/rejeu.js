// Rejeu d'une grille sur l'historique : ce qu'elle aurait coûté et rapporté, payée aux vrais montants.
// Même règle du jeu que eurom/rangs.py (ordre des rangs contrôlé sur les données par le laboratoire).

const DEBUT_11_ETOILES = '2011-05-10';
const DEBUT_12_ETOILES = '2016-09-27';

// (bons numéros, bonnes étoiles), du rang 1 au dernier rang, pour chacune des trois époques.
export const ORDRES = [
  ['5+2', '5+1', '5+0', '4+2', '4+1', '4+0', '3+2', '3+1', '2+2', '3+0', '1+2', '2+1'],
  ['5+2', '5+1', '5+0', '4+2', '4+1', '4+0', '3+2', '2+2', '3+1', '3+0', '1+2', '2+1', '2+0'],
  ['5+2', '5+1', '5+0', '4+2', '4+1', '3+2', '4+0', '2+2', '3+1', '3+0', '1+2', '2+1', '2+0'],
];

export const epoque = (jour) => (jour < DEBUT_11_ETOILES ? 0 : jour < DEBUT_12_ETOILES ? 1 : 2);
export const nbEtoilesEnJeu = (jour) => [9, 11, 12][epoque(jour)];
export const prix = (jour) => (jour < DEBUT_12_ETOILES ? 2 : 2.5);       // prix belge d'une grille simple

// Une grille n'était jouable que si ses étoiles existaient à cette date.
export const jouable = (grille, jour) => grille.etoiles.every((e) => e <= nbEtoilesEnJeu(jour));

// tirage : [date, n1..n5, e1, e2] ; montants : gain par gagnant à chaque rang ce soir-là (0 = personne n'a gagné ce rang).
export function evaluer(grille, tirage, montants) {
  const bonsNumeros = grille.numeros.filter((n) => tirage.slice(1, 6).includes(n)).length;
  const bonnesEtoiles = grille.etoiles.filter((e) => tirage.slice(6, 8).includes(e)).length;
  const place = ORDRES[epoque(tirage[0])].indexOf(`${bonsNumeros}+${bonnesEtoiles}`);
  const rang = place < 0 ? null : place + 1;
  const gain = rang ? montants[place] || 0 : 0;
  // rang atteint mais montant à 0 dans la source : personne ne l'avait gagné, le montant réel est inconnu
  return { bonsNumeros, bonnesEtoiles, rang, gain, inconnu: rang !== null && !gain };
}

const POINTS_COURBE = 80;

// Rejoue une grille sur tous les tirages où elle était jouable. donnees : { tirages, gains } alignés.
export function rejouer(grille, donnees) {
  const r = { tirages: 0, debut: null, fin: null, cout: 0, gains: 0, gagnantes: 0, parRang: Array(13).fill(0),
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
        numeros: t.slice(1, 6), etoiles: t.slice(6, 8) });
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
