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
  const regleActuelle = { sorties: 0, tirages: 0 };          // depuis le 27/09/2016 (12 étoiles)
  tirages.forEach((t, i) => {
    const sorti = t.slice(1, 6).includes(numero);
    if (t[0] >= '2016-09-27') { regleActuelle.tirages++; if (sorti) regleActuelle.sorties++; }
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
    ecartMoyen: sorties ? tirages.length / sorties : null,       // un numéro sort en moyenne tous les 10 tirages
    regleActuelle,
    jours, saisons, moities,
    annees: [...annees.values()],
    // chaque autre numéro accompagne celui-ci dans 4 sorties sur 49 en moyenne
    compagnons: compagnons.map((c, n) => [n, c]).filter((x) => x[0] > 0 && x[0] !== numero).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5),
    compagnonAttendu: (sorties * 4) / 49,
  };
}

const COLONNE_HORS = 'Hors de la fourchette';
const COLONNE_SUIVI = 'Suivi par la fiche';

// Ce que chaque enquête (dates insolites, anomalies du boulier) dit d'un numéro précis.
// Renvoie une liste de { bloc, numero, titre, fenetre, faits: [{ t, v, dec }], inhabituel: true | false | null, sens, suivi }.
// `inhabituel` : le numéro sort-il de la fourchette du hasard pour cette enquête ? (null quand la question ne se pose pas)
export function enquetesDuNumero(n, donnees) {
  const liste = [];
  ['insolites', 'boulier'].forEach((bloc) => (donnees[bloc]?.fiches || []).forEach((f) => {
    const d = f.detail;
    if (!d) return;
    const base = { bloc, numero: f.numero, cle: f.cle, titre: f.titre, fenetre: f.fenetre };
    if (d.colonnes[0].t === 'Numéro') {
      const ligne = d.lignes.find((l) => l[0] === n);
      if (!ligne) return;
      const iHors = d.colonnes.findIndex((c) => c.t.startsWith(COLONNE_HORS)), iSuivi = d.colonnes.findIndex((c) => c.t === COLONNE_SUIVI);
      liste.push({ ...base,
        faits: d.colonnes.map((c, i) => ({ t: c.t, v: ligne[i], dec: c.dec })).filter((_, i) => i > 0 && i !== iHors && i !== iSuivi),
        inhabituel: iHors < 0 ? null : ligne[iHors] !== '', sens: iHors < 0 ? '' : ligne[iHors],
        suivi: iSuivi >= 0 && ligne[iSuivi] === 'oui' });
    } else if (f.cle === 'saint_sylvestre') {
      const annees = d.lignes.filter((l) => l[1].split(', ').includes(String(n)));
      liste.push({ ...base, inhabituel: null, sens: '', suivi: false, faits: annees.length
        ? annees.map((l) => ({ t: `Numéro le plus sorti de ${l[0]} (${l[2]} sorties)`, v: `au dernier tirage, le ${l[3]} : ${l[5] === 'oui' && l[4].split(' – ').includes(String(n)) ? 'sorti' : 'pas sorti'}`, dec: null }))
        : [{ t: 'Numéro le plus sorti d\'une année', v: 'jamais', dec: null }] });
    } else if (f.cle === 'cent_jours') {
      const annees = d.lignes.filter((l) => l[4].split(', ').includes(String(n)));
      liste.push({ ...base, inhabituel: null, sens: '', suivi: false, faits: [{ t: 'Sorti au cap des 100 jours alors qu\'il n\'était pas encore sorti de l\'année',
        v: annees.length ? annees.map((l) => `oui, le ${l[1]}`).join(' ; ') : 'jamais', dec: null }] });
    } else if (f.cle === 'pyramide') {
      const formes = d.lignes.filter((l) => l[1].split(' – ').includes(String(n)));
      liste.push({ ...base, inhabituel: null, sens: '', suivi: false, faits: [{ t: 'A fait partie d\'une forme sur le bulletin',
        v: formes.length ? formes.map((l) => `oui, une ${l[2]} le ${l[0]}`).join(' ; ') : 'jamais', dec: null }] });
    }
  }));
  return liste;
}

// Combien d'enquêtes ce numéro « fait sortir » de la fourchette, et combien le hasard en donnerait.
export function bilanEnquetes(enquetes) {
  const jugees = enquetes.filter((e) => e.inhabituel !== null);
  return { jugees: jugees.length, inhabituelles: jugees.filter((e) => e.inhabituel).length, attendues: 0.05 * jugees.length };
}

// Jauge d'une fiche insolite : où tombent, en % de la largeur, la fourchette du hasard, l'attendu et l'observé.
export function jauge(fiche) {
  const min = Math.min(fiche.bas, fiche.obs), max = Math.max(fiche.haut, fiche.obs);
  const marge = (max - min || 1) * 0.12, debut = min - marge, etendue = max - min + 2 * marge;
  const place = (v) => (100 * (v - debut)) / etendue;
  return { gauche: place(fiche.bas), largeur: place(fiche.haut) - place(fiche.bas), attendu: place(fiche.att), observe: place(fiche.obs) };
}

export const pourcent =(c) => (c.tirages ? (100 * c.sorties) / c.tirages : null);
