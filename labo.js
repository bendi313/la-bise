// La fiche d'un numéro : ce que l'historique en dit. Description du passé, sans valeur de prévision.
// tirages : [[date 'AAAA-MM-JJ', n1..n5, e1, e2], …] du plus ancien au plus récent.

const SAISONS = ['Hiver', 'Printemps', 'Été', 'Automne'];
const saison = (mois) => SAISONS[Math.floor((mois % 12) / 3)];      // déc-fév, mars-mai, juin-août, sept-nov
const jourSemaine = (date) => new Date(date + 'T12:00:00Z').getUTCDay();   // 2 = mardi, 5 = vendredi

function compteur(cles) {
  return Object.fromEntries(cles.map((c) => [c, { sorties: 0, tirages: 0 }]));
}

export function ficheNumero(numero, tirages) {
  const jours = compteur(['mardi', 'vendredi']), saisons = compteur(SAISONS), moities = compteur(['du 1 au 15', 'du 16 à la fin']);
  const annees = new Map(), compagnons = Array(51).fill(0);
  let sorties = 0, derniere = -1, plusLongue = 0, depuis = 0;
  tirages.forEach((t, i) => {
    const sorti = t.slice(1, 6).includes(numero);
    const annee = t[0].slice(0, 4), mois = Number(t[0].slice(5, 7)), jour = Number(t[0].slice(8, 10));
    const cases = [jours[jourSemaine(t[0]) === 2 ? 'mardi' : 'vendredi'], saisons[saison(mois)], moities[jour <= 15 ? 'du 1 au 15' : 'du 16 à la fin']];
    if (!annees.has(annee)) annees.set(annee, { annee, sorties: 0, tirages: 0 });
    cases.push(annees.get(annee));
    cases.forEach((c) => { c.tirages++; if (sorti) c.sorties++; });
    if (sorti) {
      sorties++; derniere = i; depuis = 0;
      t.slice(1, 6).forEach((n) => { if (n !== numero) compagnons[n]++; });
    } else {
      depuis++; plusLongue = Math.max(plusLongue, depuis);
    }
  });
  return {
    numero, sorties, tirages: tirages.length,
    attendu: tirages.length / 10,                        // 5 numéros sur 50 : 1 chance sur 10 à chaque tirage
    retard: derniere < 0 ? tirages.length : tirages.length - 1 - derniere,
    derniereSortie: derniere < 0 ? null : tirages[derniere][0],
    plusLongueAbsence: plusLongue,
    jours, saisons, moities,
    annees: [...annees.values()],
    // chaque autre numéro accompagne celui-ci dans 4 sorties sur 49 en moyenne
    compagnons: compagnons.map((c, n) => [n, c]).filter((x) => x[0] > 0 && x[0] !== numero).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5),
    compagnonAttendu: (sorties * 4) / 49,
  };
}

// Jauge d'une fiche insolite : où tombent, en % de la largeur, la fourchette du hasard, l'attendu et l'observé.
export function jauge(fiche) {
  const min = Math.min(fiche.bas, fiche.obs), max = Math.max(fiche.haut, fiche.obs);
  const marge = (max - min || 1) * 0.12, debut = min - marge, etendue = max - min + 2 * marge;
  const place = (v) => (100 * (v - debut)) / etendue;
  return { gauche: place(fiche.bas), largeur: place(fiche.haut) - place(fiche.bas), attendu: place(fiche.att), observe: place(fiche.obs) };
}

export const pourcent =(c) => (c.tirages ? (100 * c.sorties) / c.tirages : null);
