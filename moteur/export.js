// Export des grilles générées, en CSV (pour un tableur) ou en JSON.

const arrondi = (x) => (x === null || x === undefined ? '' : Math.round(x * 10) / 10);

// Séparateur point-virgule et virgule décimale : s'ouvre tel quel dans un tableur réglé en français.
export function versCSV(grilles) {
  const lignes = ['grille;n1;n2;n3;n4;n5;etoile1;etoile2;respect_des_reglages_pct;effet_partage_gain_pct'];
  grilles.forEach((g, i) => {
    lignes.push([i + 1, ...g.numeros, ...g.etoiles, arrondi(g.respect), arrondi(g.partage.gain)]
      .map((v) => String(v).replace('.', ',')).join(';'));
  });
  return lignes.join('\r\n') + '\r\n';
}

export function versJSON(grilles, reglages) {
  return JSON.stringify({
    avertissement: 'Toutes les grilles ont la même chance de gagner. Les réglages décrivent un style, pas une prévision.',
    reglages: { poids: reglages.poids, fenetreChaud: reglages.fenetreChaud, sommeMin: reglages.sommeMin, sommeMax: reglages.sommeMax },
    grilles: grilles.map((g) => ({
      numeros: g.numeros, etoiles: g.etoiles,
      respect_des_reglages_pct: g.respect === null ? null : arrondi(g.respect),
      effet_partage_gain_pct: arrondi(g.partage.gain),
    })),
  }, null, 2);
}

const deux = (n) => String(n).padStart(2, '0');

// Les grilles en texte à largeur fixe, façon ticket, pour les recopier sur un vrai bulletin.
// Ce n'est pas un reçu de jeu, et le ticket le dit.
export function versTicket(grilles, dateFr) {
  const trait = '-'.repeat(32);
  return [
    '            LA BISE',
    '      GRILLES A RECOPIER',
    `      editees le ${dateFr}`,
    trait,
    ' N   NUMEROS          ETOILES',
    ...grilles.map((g, i) => `${String(i + 1).padStart(3, '0')}  ${g.numeros.map(deux).join(' ')}   * ${g.etoiles.map(deux).join(' ')}`),
    trait,
    `${grilles.length} grille${grilles.length > 1 ? 's' : ''}`,
    'SANS VALEUR : CE N\'EST PAS UN',
    'RECU DE JEU. Chaque grille a',
    'la meme chance de sortir.',
  ].join('\n');
}

// Dans le navigateur uniquement : propose le fichier au téléchargement.
export function telecharger(nom, contenu, type) {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([(type.includes('csv') ? '﻿' : '') + contenu], { type }));
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
}
