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

const fr = (x, dec = 0) => (x === null || x === undefined ? '—' : Number(x).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
const fois = (k) => `${fr(k)} fois`;
const minuscule = (s) => s[0].toLowerCase() + s.slice(1);

// La phrase de résumé d'une enquête pour un numéro : le contexte de l'enquête, le résultat précis du numéro et,
// entre parenthèses, ce que le tableau ne montre pas (nombre de tirages concernés, attendu, fourchette du hasard).
// l : la ligne du numéro dans le tableau détaillé ; c : { cas, fenetre, bas, haut, tirages, lignes }.
export function phraseEnquete(n, cle, l, c) {
  const hasard = (unite = '', dec = 0) => (c.bas === undefined ? '' : `le hasard donne de ${fr(c.bas, dec)} à ${fr(c.haut, dec)}${unite} pour un numéro pris seul`);
  const speciales = {
    ennemis: () => `Le numéro ${n} est sorti ${fois(l[1])} depuis 2004. Son partenaire le plus rare est le ${l[2]} (${fois(l[3])} ensemble) et le plus fréquent le ${l[4]} (${fois(l[5])}), ` +
      `alors qu'une paire quelconque est attendue environ 16 fois (pour le partenaire le plus rare, ${hasard(' fois')}).`,
    metronomes: () => `Le numéro ${n} est sorti ${l[1] + 1} fois de suite à exactement ${l[2]} tirage${l[2] > 1 ? 's' : ''} d'écart, à partir du ${l[3]} ` +
      `(soit ${l[1]} intervalle${l[1] > 1 ? 's' : ''} identique${l[1] > 1 ? 's' : ''} d'affilée ; ${hasard()}).`,
    alchimistes: () => `Sur ses ${fr(l[1])} sorties, le numéro ${n} a été ${fois(l[2])} la somme exacte de deux ou trois autres numéros du même tirage ` +
      `(${hasard(' fois')} ; les grands numéros le sont plus souvent, parce que plus de sommes y mènent).`,
    fantome: () => `Le numéro ${n} est sorti ${fois(l[2])} juste après la sortie d'un de ses voisins (le ${[n - 1, n + 1].filter((x) => x >= 1 && x <= 50).join(' ou le ')}), ` +
      `sur ${fr(l[1])} occasions (soit ${fr(l[3], 1)} % ; un tirage sans mémoire donne 10 %, et ${hasard(' %', 1)}).`,
    eclipses: () => `La plus longue absence du numéro ${n} a duré ${fr(l[1])} tirages ${l[2] === 'en cours' ? 'et elle est toujours en cours' : `et s'est terminée le ${l[2]}`} ` +
      `(un numéro sort en moyenne tous les 10 tirages ; pour la plus longue absence, ${hasard(' tirages')}).`,
    dominos: () => `Sur ses ${fr(l[1])} sorties, le numéro ${n} a fait ${fois(l[2])} partie de trois numéros régulièrement espacés, comme 12-13-14 ou 8-16-24 ` +
      `(soit ${fr(l[3], 1)} % de ses sorties ; ${hasard(' fois')}).`,
    cometes: () => (l[2] === null ? `Le numéro ${n} n'a aucune paire sortie deux fois sur cette période.`
      : `La paire formée par le ${n} et le ${l[2]} est sortie le ${l[3]}, puis plus jamais ensemble avant le ${l[4]} : ${fr(l[1])} tirages d'attente ` +
        `(une paire revient en moyenne tous les 122 tirages ; pour la plus longue attente, ${hasard(' tirages')}).`),
    horloge: () => `Le numéro ${n} est sorti ${fois(l[1])} depuis 2004 ; ${l[2] === 'aucun' ? 'aucun autre numéro n\'a exactement ce total' : `à égalité exacte avec le ${String(l[2]).replace(/, /g, ', le ')}`} ` +
      `(${hasard(' sorties')}).`,
    epoques: () => `Avant le 27/09/2016, le numéro ${n} sortait dans ${fr(l[1], 1)} % des tirages (${l[2]}e sur 50) ; depuis, dans ${fr(l[3], 1)} % (${l[4]}e sur 50), ` +
      `soit un écart de ${l[5] > 0 ? '+' : ''}${fr(l[5], 1)} point${Math.abs(l[5]) >= 2 ? 's' : ''} (le hasard donne 10 % aux deux époques ; pour l'écart, ${hasard(' points', 1)}).`,
    clandestin: () => `Sur ses ${fr(l[1])} sorties, le numéro ${n} est sorti ${fois(l[3])} avec le ${l[2]}, son compagnon le plus fréquent ` +
      `(soit ${fr(l[4], 1)} % ; un compagnon quelconque l'accompagne environ 8 fois sur 100, et pour le plus fréquent ${hasard(' %', 1)}).`,
    saisons: () => {
      const noms = ['hiver', 'printemps', 'été', 'automne'], parts = l.slice(1, 5), meilleure = parts.indexOf(Math.max(...parts));
      return `Le numéro ${n} est sorti dans ${fr(l[1], 1)} % des tirages d'hiver, ${fr(l[2], 1)} % de ceux du printemps, ${fr(l[3], 1)} % de ceux d'été et ${fr(l[4], 1)} % de ceux d'automne ; ` +
        `sa meilleure saison est ${['l\'hiver', 'le printemps', 'l\'été', 'l\'automne'][meilleure]} (le hasard donne 10 % partout ; un écart de ${fr(l[5], 1)} points entre la meilleure et la moins bonne saison est courant).`;
    },
  };
  if (speciales[cle]) return speciales[cle]();
  if (cle === 'saint_sylvestre') {
    return c.lignes.length
      ? c.lignes.map((a) => `Le numéro ${n} a été ${a[1].includes(',') ? 'l\'un des numéros les plus sortis' : 'le numéro le plus sorti'} de l'année ${a[0]} (${a[2]} sorties) ; ` +
          `au dernier tirage de cette année-là, le ${a[3]}, il ${a[4].split(' – ').includes(String(n)) ? 'est sorti' : 'n\'est pas sorti'}`).join('. ') + ` (${c.cas} années étudiées).`
      : `Le numéro ${n} n'a jamais été le numéro le plus sorti d'une année (${c.cas} années étudiées).`;
  }
  if (cle === 'cent_jours') {
    return c.lignes.length
      ? `Le numéro ${n} est sorti au cap des 100 jours alors qu'il n'était pas encore sorti de l'année : ${c.lignes.map((a) => `le ${a[1]}`).join(', ')} ` +
        `(${fois(c.lignes.length)} en ${c.cas} années ; un numéro pas encore sorti a, comme les autres, 1 chance sur 10 ce jour-là).`
      : `Le numéro ${n} n'est jamais sorti au cap des 100 jours en étant encore absent de l'année (${c.cas} années étudiées ; en moyenne, seuls 2 ou 3 numéros sont encore absents à cette date).`;
  }
  if (cle === 'pyramide') {
    return c.lignes.length
      ? `Le numéro ${n} a fait partie d'une forme sur le bulletin : ${c.lignes.map((a) => `une ${a[2]} le ${a[0]} (${a[1]})`).join(', ')} (sur ${fr(c.cas)} tirages).`
      : `Le numéro ${n} n'a jamais fait partie d'une ligne, d'une colonne, d'une diagonale ou d'un V sur le bulletin (sur ${fr(c.cas)} tirages ; ces formes sont très rares).`;
  }
  // enquêtes sur une fenêtre de dates : sorties du numéro sur les tirages de la fenêtre
  if (c.tirages) {
    return `Le numéro ${n} est sorti ${fois(l[1])} lors des ${minuscule(c.fenetre)}, sur ${fr(c.tirages)} tirage${c.tirages > 1 ? 's à ces dates' : ' à cette date'} depuis 2004, ` +
      `soit ${fr(l[2], 1)} % contre 10 % attendus par le hasard pur ` +
      `(un numéro quelconque y est attendu ${fr(c.tirages / 10, 1)} fois, et le hasard donne de ${fr(c.bas)} à ${fr(c.haut)} sorties)` +
      `${c.suivi ? ` ; il fait partie des numéros que cette enquête surveille` : ''}.`;
  }
  return '';
}

// L'encadré sous la jauge d'une fiche : l'écart entre ce qui est observé et ce que le hasard donne en moyenne.
export function resumeFiche(f) {
  if (f.p === null || f.p === undefined) return '';
  const d = f.dec, ecart = f.obs - f.att, dans = f.obs >= f.bas && f.obs <= f.haut;
  const zone = `Le hasard seul donne en moyenne ${fr(f.att, d)}, et entre ${fr(f.bas, d)} et ${fr(f.haut, d)} dans 19 cas sur 20`;
  if (Math.abs(ecart) < 0.5 * 10 ** -d) return `Observé : ${fr(f.obs, d)}. ${zone}. L'observé tombe pile sur cette moyenne : rien d'étonnant.`;
  return `Observé : ${fr(f.obs, d)}. ${zone}. L'observé est ${fr(Math.abs(ecart), d)} ${ecart > 0 ? 'au-dessus' : 'en dessous'} de cette moyenne, ` +
    (dans ? 'à l\'intérieur de la zone normale : rien d\'étonnant.' : 'en dehors de la zone normale : c\'est inhabituel.');
}

// La conclusion ajoutée à la phrase : le numéro sort-il de la fourchette du hasard ?
const verdict = (inhabituel, sens) => (inhabituel === null ? '' : inhabituel
  ? ` Verdict : hors de l'ordinaire (${sens.replace(/^[▲▼] /, '')} de ce que le hasard donne d'habitude).` : ' Verdict : dans la norme.');

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
    const base = { bloc, numero: f.numero, cle: f.cle, titre: f.titre, definition: f.definition, fenetre: f.fenetre };
    if (d.colonnes[0].t === 'Numéro') {
      const ligne = d.lignes.find((l) => l[0] === n);
      if (!ligne) return;
      const iHors = d.colonnes.findIndex((c) => c.t.startsWith(COLONNE_HORS)), iSuivi = d.colonnes.findIndex((c) => c.t === COLONNE_SUIVI);
      const rang = d.lignes.indexOf(ligne), inhabituel = iHors < 0 ? null : ligne[iHors] !== '', sens = iHors < 0 ? '' : ligne[iHors];
      const suivi = iSuivi >= 0 && ligne[iSuivi] === 'oui';
      liste.push({ ...base,
        faits: d.colonnes.map((c, i) => ({ t: c.t, v: ligne[i], dec: c.dec })).filter((_, i) => i > 0 && i !== iHors && i !== iSuivi),
        inhabituel, sens, suivi,
        phrase: phraseEnquete(n, f.cle, ligne, { cas: f.n, fenetre: f.fenetre, tirages: d.tirages, suivi, bas: d.bas?.[rang], haut: d.haut?.[rang] }) + verdict(inhabituel, sens) });
    } else if (f.cle === 'saint_sylvestre') {
      const annees = d.lignes.filter((l) => l[1].split(', ').includes(String(n)));
      liste.push({ ...base, inhabituel: null, sens: '', suivi: false, phrase: phraseEnquete(n, f.cle, null, { cas: d.lignes.length, lignes: annees }), faits: annees.length
        ? annees.map((l) => ({ t: `Numéro le plus sorti de ${l[0]} (${l[2]} sorties)`, v: `au dernier tirage, le ${l[3]} : ${l[5] === 'oui' && l[4].split(' – ').includes(String(n)) ? 'sorti' : 'pas sorti'}`, dec: null }))
        : [{ t: 'Numéro le plus sorti d\'une année', v: 'jamais', dec: null }] });
    } else if (f.cle === 'cent_jours') {
      const annees = d.lignes.filter((l) => l[4].split(', ').includes(String(n)));
      liste.push({ ...base, inhabituel: null, sens: '', suivi: false, phrase: phraseEnquete(n, f.cle, null, { cas: d.lignes.length, lignes: annees }), faits: [{ t: 'Sorti au cap des 100 jours alors qu\'il n\'était pas encore sorti de l\'année',
        v: annees.length ? annees.map((l) => `oui, le ${l[1]}`).join(' ; ') : 'jamais', dec: null }] });
    } else if (f.cle === 'pyramide') {
      const formes = d.lignes.filter((l) => l[1].split(' – ').includes(String(n)));
      liste.push({ ...base, inhabituel: null, sens: '', suivi: false, phrase: phraseEnquete(n, f.cle, null, { cas: f.n, lignes: formes }), faits: [{ t: 'A fait partie d\'une forme sur le bulletin',
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
