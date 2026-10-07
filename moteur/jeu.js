// Les deux jeux de La Bise : l'EuroMillions et le Lotto belge. Tout ce qui dépend de la règle d'un jeu est ici.
// `JEU` est le jeu affiché ; `choisirJeu` le change. Chaque jeu garde ses propres données, réglages, formules, carnet et mesures.
//
// Un tirage, dans les données : [date, numéros en ordre croissant…, étoiles…] pour l'EuroMillions ([date, n1..n5, e1, e2]),
// [date, n1..n6, bonus] pour le Lotto. Une grille : { numeros, etoiles } ; au Lotto, `etoiles` est toujours vide.

const EUROMILLIONS = {
  cle: 'euromillions', nom: 'EuroMillions', onglet: 'EuroMillions', fichier: 'donnees.json', prefixe: 'labise-',
  k: 5, boules: 50, nbEtoiles: 2, etoilesMax: 12, bonus: false,
  joursTirage: [2, 5], nomsJours: ['mardi', 'vendredi'],
  depuis: '2004',
  // règle actuelle (pour les fiches) et coupure entre deux périodes (pour vérifier ailleurs une piste repérée)
  regleActuelle: '2016-09-27', regleActuelleNom: 'septembre 2016', coupure: '2016-09-27', coupureNom: 'le 27/09/2016',
  sommeMin: 90, sommeMax: 160, sommeCentre: 127.5, sommeBornes: [15, 240],
  pairs: [2, 3], pairsTexte: '2 ou 3 numéros pairs', entropieMax: Math.log2(5),
  exempleHarmonique: 'Exemple : 7, 19, 24, 33, 46 (somme 129, deux pairs) est gardée ; 1, 2, 3, 4, 5 (somme 15) ne l\'est pas.',
  exempleAntiFoule: '32, 38, 41, 46, 49 plutôt que 3, 7, 11, 19, 25',
  grosLot: '1 sur 139 838 160',
  // (bons numéros + bonnes étoiles), du rang 1 au dernier rang, pour chacune des trois époques
  ordres: [
    ['5+2', '5+1', '5+0', '4+2', '4+1', '4+0', '3+2', '3+1', '2+2', '3+0', '1+2', '2+1'],
    ['5+2', '5+1', '5+0', '4+2', '4+1', '4+0', '3+2', '2+2', '3+1', '3+0', '1+2', '2+1', '2+0'],
    ['5+2', '5+1', '5+0', '4+2', '4+1', '3+2', '4+0', '2+2', '3+1', '3+0', '1+2', '2+1', '2+0'],
  ],
  epoque: (jour) => (jour < '2011-05-10' ? 0 : jour < '2016-09-27' ? 1 : 2),
  nbEtoilesEnJeu: (jour) => (jour < '2011-05-10' ? 9 : jour < '2016-09-27' ? 11 : 12),
  prix: (jour) => (jour < '2016-09-27' ? 2 : 2.5),             // prix belge d'une grille simple
  prixTexte: 'Prix belge de la grille (2 € puis 2,50 € depuis septembre 2016) ; montants publiés par la FDJ. Une grille avec l\'étoile 10, 11 ou 12 n\'est rejouée que depuis que cette étoile existe.',
  laboratoire: true,
};

const LOTTO = {
  cle: 'lotto', nom: 'Lotto', onglet: 'Lotto belge', fichier: 'donnees-lotto.json', prefixe: 'labise-lotto-',
  k: 6, boules: 45, nbEtoiles: 0, etoilesMax: 0, bonus: true,
  joursTirage: [3, 6], nomsJours: ['mercredi', 'samedi'],
  depuis: 'octobre 2011',
  regleActuelle: '2018-05-26', regleActuelleNom: 'mai 2018', coupure: '2018-05-26', coupureNom: 'le 26/05/2018',
  sommeMin: 100, sommeMax: 175, sommeCentre: 138, sommeBornes: [21, 255],
  pairs: [2, 3, 4], pairsTexte: '2, 3 ou 4 numéros pairs', entropieMax: -(2 / 6) * Math.log2(2 / 6) - 4 * (1 / 6) * Math.log2(1 / 6),
  exempleHarmonique: 'Exemple : 4, 13, 22, 29, 36, 41 (somme 145, trois pairs) est gardée ; 1, 2, 3, 4, 5, 6 (somme 21) ne l\'est pas.',
  exempleAntiFoule: '35, 36, 40, 41, 43, 44 plutôt que 3, 7, 8, 9, 13, 27',
  grosLot: '1 sur 8 145 060',
  // (bons numéros + bonus dans la grille), du rang 1 au dernier ; le Lotto 6 sur 45 n'a que deux époques (la première est vide)
  ordres: [
    [],
    ['6+0', '5+1', '5+0', '4+1', '4+0', '3+1', '3+0', '2+1'],
    ['6+0', '5+1', '5+0', '4+1', '4+0', '3+1', '3+0', '2+1', '1+1'],
  ],
  epoque: (jour) => (jour < '2018-05-26' ? 1 : 2),
  nbEtoilesEnJeu: () => 0,
  prix: (jour) => (jour < '2018-05-26' ? 1 : jour < '2025-05-01' ? 1.25 : 1.5),
  prixTexte: 'Prix de la grille : 1 € jusqu\'en mai 2018, 1,25 € ensuite, 1,50 € depuis mai 2025 ; montants publiés par la Loterie Nationale.',
  laboratoire: false,
};

export const JEUX = { euromillions: EUROMILLIONS, lotto: LOTTO };
export const JEU = { ...EUROMILLIONS };

// Grandeurs qui se déduisent de la règle : chance d'un numéro à un tirage, écart moyen entre deux sorties, etc.
function completer(j) {
  j.chance = j.k / j.boules;                                     // 1 sur 10 (EuroMillions), 6 sur 45 (Lotto)
  j.ecartMoyen = j.boules / j.k;                                 // 10 tirages, 7,5 tirages
  j.chancePaire = (j.k * (j.k - 1)) / (j.boules * (j.boules - 1));
  j.compagnon = (j.k - 1) / (j.boules - 1);                      // part des sorties d'un numéro faites avec un autre numéro donné
  j.nbDizaines = Math.ceil(j.boules / 10);
  j.nbRangs = Math.max(...j.ordres.map((o) => o.length));
  return j;
}
completer(JEU);

const ecouteurs = [];
// Un module qui dépend du jeu (par exemple Mon Labo et ses propriétés) se fait prévenir à chaque changement.
export function surChangement(f) { ecouteurs.push(f); f(JEU); }

export function choisirJeu(cle) {
  const j = JEUX[cle] || EUROMILLIONS;
  Object.keys(JEU).forEach((k) => { delete JEU[k]; });
  Object.assign(JEU, completer({ ...j }));
  ecouteurs.forEach((f) => f(JEU));
  return JEU;
}

// Les numéros et les étoiles (ou le bonus) d'un tirage des données.
export const numerosDe = (t) => t.slice(1, 1 + JEU.k);
export const etoilesDe = (t) => t.slice(1 + JEU.k, 1 + JEU.k + JEU.nbEtoiles);
export const bonusDe = (t) => (JEU.bonus ? t[1 + JEU.k] : null);

const fr = (x, dec = 1) => Number(x).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
// « 1 sur 10 » ou « 13,3 sur 100 » : la chance d'un numéro à chaque tirage, en clair
export const chanceTexte = () => (JEU.k * 10 === JEU.boules ? '1 sur 10' : `${fr(100 * JEU.chance)} sur 100`);
export const chancePct = () => `${fr(100 * JEU.chance, JEU.k * 10 === JEU.boules ? 0 : 1)} %`;
export const jourDe = (date) => {
  const j = new Date(date + 'T12:00:00Z').getUTCDay();
  return j === JEU.joursTirage[0] ? JEU.nomsJours[0] : JEU.nomsJours[1];
};
