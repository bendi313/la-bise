// Les phrases de transparence : ce que le laboratoire a mesuré pour chaque profil, affiché en permanence.

export function nombre(x, dec = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return x.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export const signe = (x, dec = 1) => (x > 0 ? '+' : '') + nombre(x, dec);

export const dateFr = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

// Ce que fait chaque style, en clair, avec un exemple. `r` : les réglages en cours (fenêtre du « chaud », plage de somme).
export function definitionStyle(cle, r) {
  return {
    hasard: 'Des grilles tirées entièrement au hasard, sans aucun critère. C\'est le point de comparaison de tous les autres styles.',
    chaud: `Choisit de préférence les numéros et les étoiles sortis le plus souvent sur les ${r.fenetreChaud} derniers tirages. ` +
      `Exemple : un numéro sorti 4 fois en ${r.fenetreChaud} tirages est « sur la vague » ; un numéro sorti 0 fois ne l'est pas.`,
    froid: 'Choisit de préférence les numéros et les étoiles qui ne sont plus sortis depuis le plus longtemps. ' +
      'Exemple : un numéro absent depuis 40 tirages passe avant un numéro sorti la semaine dernière.',
    harmonique: `Garde les grilles « équilibrées » : la somme des 5 numéros entre ${r.sommeMin} et ${r.sommeMax}, et 2 ou 3 numéros pairs. ` +
      'Exemple : 7, 19, 24, 33, 46 (somme 129, deux pairs) est gardée ; 1, 2, 3, 4, 5 (somme 15) ne l\'est pas.',
    antiFoule: 'Évite les numéros que beaucoup de gens jouent — surtout ceux de 1 à 31, qui servent de dates de naissance, et le 7 — ' +
      'pour partager avec moins de monde en cas de gain. Exemple : 32, 38, 41, 46, 49 plutôt que 3, 7, 11, 19, 25.',
  }[cle];
}

// rejeu : { nb_tirages, profils: { hasard: {...}, chaud: {...}, … } }, produit par eurom/rejeu.py
export function phraseProfil(cle, rejeu) {
  const q = rejeu.profils[cle], temoin = rejeu.profils.hasard;
  const rendu = `${nombre(q.retour, 1)} € rendus pour 100 € misés`;
  if (cle === 'hasard') {
    return `Grilles tirées au hasard, sans critère. Rejeu sur ${nombre(rejeu.nb_tirages)} tirages : ${rendu}.`;
  }
  const mesurable = Math.abs(q.ecart_temoin) > q.ecart_marge;
  const comparaison = `Rejeu sur ${nombre(rejeu.nb_tirages)} tirages : ${rendu}, contre ${nombre(temoin.retour, 1)} € au hasard pur`;
  if (cle === 'antiFoule') {
    return 'N\'augmente pas la chance de gagner. Fait toucher davantage quand on gagne, car on partage avec moins de monde : ' +
      `${nombre(q.gain_par_grille_gagnante, 2)} € par grille gagnante contre ${nombre(temoin.gain_par_grille_gagnante, 2)} € au hasard pur. ` +
      `${comparaison} (${mesurable ? 'écart supérieur à la marge d\'erreur' : 'écart dans la marge d\'erreur'}).`;
  }
  return `Style de jeu : n'augmente pas la chance de gagner. ${comparaison} — ` +
    (mesurable ? `écart de ${signe(q.ecart_temoin, 1)} €, supérieur à la marge d'erreur.` : 'aucune différence mesurable.');
}

// Phrase affichée dès qu'il y a des numéros fétiches. populaire.numeros : % de gagnants en plus quand le numéro sort.
export function phraseFetiches(fetiches, populaire) {
  if (!fetiches.length) return '';
  const tres = fetiches.filter((n) => (populaire.numeros[n - 1] ?? 0) >= 3);
  // « le 7 », « le 7 et le 13 », « le 7, le 13 et le 21 »
  const liste = (l) => (l.length > 1 ? l.slice(0, -1).map((n) => `le ${n}`).join(', ') + ` et le ${l[l.length - 1]}` : `le ${l[0]}`);
  const majuscule = (s) => s[0].toUpperCase() + s.slice(1);
  return `Numéro${fetiches.length > 1 ? 's' : ''} fétiche${fetiches.length > 1 ? 's' : ''} : un choix personnel. ` +
    `${majuscule(liste(fetiches))} ${fetiches.length > 1 ? 'ont' : 'a'} exactement la même chance de sortir que les autres numéros : 1 sur 10 à chaque tirage.` +
    (tres.length ? ` À savoir : ${liste(tres)} ${tres.length > 1 ? 'sont' : 'est'} très joué${tres.length > 1 ? 's' : ''} par la foule, donc plus de partage ${tres.length > 1 ? 's\'ils sortent' : 's\'il sort'}.` : '');
}

export const MENTIONS = [
  'La Bise est une application d\'analyse statistique et de génération de grilles selon vos préférences. Elle décrit le passé ; elle ne prédit aucun tirage.',
  'Chaque grille a exactement la même chance de gagner, quels que soient les réglages. Aucune garantie de gain n\'est offerte.',
  'Le jeu est perdant en moyenne. Les jeux d\'argent comportent des risques : endettement, dépendance, isolement. Ne jouez que ce que vous pouvez perdre.',
  'La Bise n\'est affiliée ni à la FDJ, ni à la Loterie Nationale, ni aux organisateurs de l\'EuroMillions. Les tirages viennent des archives publiques de la FDJ ; vérifiez toujours vos résultats auprès de votre loterie.',
  'Application réservée aux personnes majeures.',
  'Besoin d\'aide ? Belgique : SOS Jeux, 0800 35 777 (gratuit, 24 h/24). France : Joueurs Info Service, 09 74 75 13 13.',
];
