// La fiche d'un numéro : ce que l'historique en dit. Description du passé, sans valeur de prévision.
// tirages : [[date 'AAAA-MM-JJ', n1..n5, e1, e2], …] du plus ancien au plus récent ([date, n1..n6, bonus] au Lotto).

import { JEU, numerosDe, bonusDe, jourDe, chancePct } from './moteur/jeu.js';

const SAISONS = ['Hiver', 'Printemps', 'Été', 'Automne'];
const saison = (mois) => SAISONS[Math.floor((mois % 12) / 3)];      // déc-fév, mars-mai, juin-août, sept-nov
const jourSemaine = (date) => new Date(date + 'T12:00:00Z').getUTCDay();   // 2 = mardi, 5 = vendredi

function compteur(cles) {
  return Object.fromEntries(cles.map((c) => [c, { sorties: 0, tirages: 0 }]));
}

export function ficheNumero(numero, tirages) {
  const jours = compteur(JEU.nomsJours), saisons = compteur(SAISONS), moities = compteur(['du 1 au 15', 'du 16 à la fin']);
  const annees = new Map(), compagnons = Array(JEU.boules + 1).fill(0);
  let sorties = 0, derniere = -1, plusLongue = 0, depuis = 0, bonus = 0;
  const regleActuelle = { sorties: 0, tirages: 0 };          // depuis le 27/09/2016 (12 étoiles) ; au Lotto, depuis le 26/05/2018 (9 rangs)
  tirages.forEach((t, i) => {
    const sorti = numerosDe(t).includes(numero);
    if (bonusDe(t) === numero) bonus++;
    if (t[0] >= JEU.regleActuelle) { regleActuelle.tirages++; if (sorti) regleActuelle.sorties++; }
    const annee = t[0].slice(0, 4), mois = Number(t[0].slice(5, 7)), jour = Number(t[0].slice(8, 10));
    const cases = [jours[jourDe(t[0])], saisons[saison(mois)], moities[jour <= 15 ? 'du 1 au 15' : 'du 16 à la fin']];
    if (!annees.has(annee)) annees.set(annee, { annee, sorties: 0, tirages: 0 });
    cases.push(annees.get(annee));
    cases.forEach((c) => { c.tirages++; if (sorti) c.sorties++; });
    if (sorti) {
      sorties++; derniere = i; depuis = 0;
      numerosDe(t).forEach((n) => { if (n !== numero) compagnons[n]++; });
    } else {
      depuis++; plusLongue = Math.max(plusLongue, depuis);
    }
  });
  return {
    numero, sorties, tirages: tirages.length,
    attendu: tirages.length * JEU.chance,                // 5 numéros sur 50 : 1 chance sur 10 à chaque tirage (Lotto : 6 sur 45)
    retard: derniere < 0 ? tirages.length : tirages.length - 1 - derniere,
    derniereSortie: derniere < 0 ? null : tirages[derniere][0],
    plusLongueAbsence: plusLongue,
    ecartMoyen: sorties ? tirages.length / sorties : null,       // un numéro sort en moyenne tous les 10 tirages (7,5 au Lotto)
    regleActuelle, bonus,
    jours, saisons, moities,
    annees: [...annees.values()],
    // chaque autre numéro accompagne celui-ci dans 4 sorties sur 49 en moyenne (5 sur 44 au Lotto)
    compagnons: compagnons.map((c, n) => [n, c]).filter((x) => x[0] > 0 && x[0] !== numero).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5),
    compagnonAttendu: sorties * JEU.compagnon,
  };
}

const fr = (x, dec = 0) => (x === null || x === undefined ? '—'
  : (Math.abs(x) < 0.5 * 10 ** -dec ? 0 : Number(x)).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
const fois = (k) => `${fr(k)} fois`;
const minuscule = (s) => s[0].toLowerCase() + s.slice(1);

// La phrase de résumé d'une enquête pour un numéro : le contexte de l'enquête, le résultat précis du numéro et,
// entre parenthèses, ce que le tableau ne montre pas (nombre de tirages concernés, attendu, fourchette du hasard).
// l : la ligne du numéro dans le tableau détaillé ; c : { cas, fenetre, bas, haut, tirages, lignes }.
export function phraseEnquete(n, cle, l, c) {
  const hasard = (unite = '', dec = 0) => (c.bas === undefined ? '' : `le hasard donne de ${fr(c.bas, dec)} à ${fr(c.haut, dec)}${unite} pour un numéro pris seul`);
  // les repères de la règle du jeu : 10 % et 10 tirages à l'EuroMillions, 13,3 % et 7,5 tirages au Lotto
  const pct = chancePct(), ecart = fr(JEU.ecartMoyen, Number.isInteger(JEU.ecartMoyen) ? 0 : 1), depuis = `depuis ${JEU.depuis}`;
  const paireAttendue = c.nbTirages ? `environ ${fr(c.nbTirages * JEU.chancePaire)} fois` : `une fois tous les ${fr(Math.floor(1 / JEU.chancePaire))} tirages`;
  const speciales = {
    ennemis: () => `Le numéro ${n} est sorti ${fois(l[1])} ${depuis}. Son partenaire le plus rare est le ${l[2]} (${fois(l[3])} ensemble) et le plus fréquent le ${l[4]} (${fois(l[5])}), ` +
      `alors qu'une paire quelconque est attendue ${paireAttendue} (pour le partenaire le plus rare, ${hasard(' fois')}).`,
    metronomes: () => `Le numéro ${n} est sorti ${l[1] + 1} fois de suite à exactement ${l[2]} tirage${l[2] > 1 ? 's' : ''} d'écart, à partir du ${l[3]} ` +
      `(soit ${l[1]} intervalle${l[1] > 1 ? 's' : ''} identique${l[1] > 1 ? 's' : ''} d'affilée ; ${hasard()}).`,
    alchimistes: () => `Sur ses ${fr(l[1])} sorties, le numéro ${n} a été ${fois(l[2])} la somme exacte de deux ou trois autres numéros du même tirage ` +
      `(${hasard(' fois')} ; les grands numéros le sont plus souvent, parce que plus de sommes y mènent).`,
    fantome: () => `Le numéro ${n} est sorti ${fois(l[2])} juste après la sortie d'un de ses voisins (le ${[n - 1, n + 1].filter((x) => x >= 1 && x <= JEU.boules).join(' ou le ')}), ` +
      `sur ${fr(l[1])} occasions (soit ${fr(l[3], 1)} % ; un tirage sans mémoire donne ${pct}, et ${hasard(' %', 1)}).`,
    eclipses: () => `La plus longue absence du numéro ${n} a duré ${fr(l[1])} tirages ${l[2] === 'en cours' ? 'et elle est toujours en cours' : `et s'est terminée le ${l[2]}`} ` +
      `(un numéro sort en moyenne tous les ${ecart} tirages ; pour la plus longue absence, ${hasard(' tirages')}).`,
    dominos: () => `Sur ses ${fr(l[1])} sorties, le numéro ${n} a fait ${fois(l[2])} partie de trois numéros régulièrement espacés, comme 12-13-14 ou 8-16-24 ` +
      `(soit ${fr(l[3], 1)} % de ses sorties ; ${hasard(' fois')}).`,
    cometes: () => (l[2] === null ? `Le numéro ${n} n'a aucune paire sortie deux fois sur cette période.`
      : `La paire formée par le ${n} et le ${l[2]} est sortie le ${l[3]}, puis plus jamais ensemble avant le ${l[4]} : ${fr(l[1])} tirages d'attente ` +
        `(une paire revient en moyenne tous les ${fr(Math.floor(1 / JEU.chancePaire))} tirages ; pour la plus longue attente, ${hasard(' tirages')}).`),
    horloge: () => `Le numéro ${n} est sorti ${fois(l[1])} ${depuis} ; ${l[2] === 'aucun' ? 'aucun autre numéro n\'a exactement ce total' : `à égalité exacte avec le ${String(l[2]).replace(/, /g, ', le ')}`} ` +
      `(${hasard(' sorties')}).`,
    epoques: () => `Avant ${JEU.coupureNom}, le numéro ${n} sortait dans ${fr(l[1], 1)} % des tirages (${l[2]}e sur ${JEU.boules}) ; depuis, dans ${fr(l[3], 1)} % (${l[4]}e sur ${JEU.boules}), ` +
      `soit un écart de ${l[5] > 0 ? '+' : ''}${fr(l[5], 1)} point${Math.abs(l[5]) >= 2 ? 's' : ''} (le hasard donne ${pct} aux deux époques ; pour l'écart, ${hasard(' points', 1)}).`,
    clandestin: () => `Sur ses ${fr(l[1])} sorties, le numéro ${n} est sorti ${fois(l[3])} avec le ${l[2]}, son compagnon le plus fréquent ` +
      `(soit ${fr(l[4], 1)} % ; un compagnon quelconque l'accompagne environ ${fr(100 * JEU.compagnon)} fois sur 100, et pour le plus fréquent ${hasard(' %', 1)}).`,
    corde: () => `La corde du numéro ${n} est ${String(l[2]).split(' :')[0]} : ses 3 derniers écarts entre deux sorties font en moyenne ${fr(l[1] * JEU.ecartMoyen, 1)} tirages, ` +
      `soit une tension de ${fr(l[1], 2)} (${ecart} tirages d'écart donnent une tension de 1 ; ${hasard('', 2)}). Une corde tendue ou détendue ne dit rien de la prochaine sortie.`,
    saisons: () => {
      const parts = l.slice(1, 5), meilleure = parts.indexOf(Math.max(...parts));
      return `Le numéro ${n} est sorti dans ${fr(l[1], 1)} % des tirages d'hiver, ${fr(l[2], 1)} % de ceux du printemps, ${fr(l[3], 1)} % de ceux d'été et ${fr(l[4], 1)} % de ceux d'automne ; ` +
        `sa meilleure saison est ${['l\'hiver', 'le printemps', 'l\'été', 'l\'automne'][meilleure]} (le hasard donne ${pct} partout ; un écart de ${fr(l[5], 1)} points entre la meilleure et la moins bonne saison est courant).`;
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
    const chance = JEU.k * 10 === JEU.boules ? '1 chance sur 10' : `${JEU.k} chances sur ${JEU.boules}`;
    return c.lignes.length
      ? `Le numéro ${n} est sorti au cap des 100 jours alors qu'il n'était pas encore sorti de l'année : ${c.lignes.map((a) => `le ${a[1]}`).join(', ')} ` +
        `(${fois(c.lignes.length)} en ${c.cas} années ; un numéro pas encore sorti a, comme les autres, ${chance} ce jour-là).`
      : `Le numéro ${n} n'est jamais sorti au cap des 100 jours en étant encore absent de l'année (${c.cas} années étudiées ; en moyenne, ` +
        `${JEU.bonus ? 'moins d\'un numéro est encore absent' : 'seuls 2 ou 3 numéros sont encore absents'} à cette date).`;
  }
  if (cle === 'pyramide') {
    return c.lignes.length
      ? `Le numéro ${n} a fait partie d'une forme sur le bulletin : ${c.lignes.map((a) => `une ${a[2]} le ${a[0]} (${a[1]})`).join(', ')} (sur ${fr(c.cas)} tirages).`
      : `Le numéro ${n} n'a jamais fait partie d'une ligne, d'une colonne, d'une diagonale ou d'un V sur le bulletin (sur ${fr(c.cas)} tirages ; ces formes sont très rares).`;
  }
  // enquêtes sur une fenêtre de dates : sorties du numéro sur les tirages de la fenêtre
  if (c.tirages) {
    return `Le numéro ${n} est sorti ${fois(l[1])} lors des ${minuscule(c.fenetre)}, sur ${fr(c.tirages)} tirage${c.tirages > 1 ? 's à ces dates' : ' à cette date'} ${depuis}, ` +
      `soit ${fr(l[2], 1)} % contre ${pct} attendus par le hasard pur ` +
      `(un numéro quelconque y est attendu ${fr(c.tirages * JEU.chance, 1)} fois, et le hasard donne de ${fr(c.bas)} à ${fr(c.haut)} sorties)` +
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
  ['insolites', 'boulier', 'experiences'].forEach((bloc) => (donnees[bloc]?.fiches || []).forEach((f) => {
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
        phrase: phraseEnquete(n, f.cle, ligne, { cas: f.n, fenetre: f.fenetre, tirages: d.tirages, suivi, bas: d.bas?.[rang], haut: d.haut?.[rang], nbTirages: donnees.tirages?.length }) + verdict(inhabituel, sens) });
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

// ---------- La fiche d'une étoile ----------

// Les trois époques : le nombre d'étoiles en jeu a changé, donc la chance de sortie d'une étoile aussi (2 sur 9, 2 sur 11, 2 sur 12).
const EPOQUES_ETOILES = [
  { nom: '2004 – mai 2011 (9 étoiles)', debut: '0000-00-00', fin: '2011-05-10', nb: 9 },
  { nom: 'mai 2011 – sept. 2016 (11 étoiles)', debut: '2011-05-10', fin: '2016-09-27', nb: 11 },
  { nom: 'depuis sept. 2016 (12 étoiles)', debut: '2016-09-27', fin: '9999-99-99', nb: 12 },
];

// Ce que le hasard donne 19 fois sur 20 pour `n` tirages et une chance `p` à chaque tirage (approximation usuelle).
export function fourchette(n, p) {
  const marge = 1.96 * Math.sqrt(n * p * (1 - p));
  return { attendu: n * p, bas: Math.max(0, Math.floor(n * p - marge)), haut: Math.min(n, Math.ceil(n * p + marge)) };
}

// Ce que l'historique dit d'une étoile. Tout est mesuré à règle constante : époque par époque, puis en détail sous la règle actuelle.
export function ficheEtoile(etoile, tirages) {
  const avec = (t) => t[6] === etoile || t[7] === etoile;
  const epoques = EPOQUES_ETOILES.filter((ep) => etoile <= ep.nb).map((ep) => {
    const lot = tirages.filter((t) => t[0] >= ep.debut && t[0] < ep.fin), sorties = lot.filter(avec).length, f = fourchette(lot.length, 2 / ep.nb);
    return { nom: ep.nom, tirages: lot.length, sorties, attenduPct: 200 / ep.nb, ...f, hors: sorties > f.haut ? 1 : sorties < f.bas ? -1 : 0 };
  }).filter((ep) => ep.tirages > 0);

  // depuis que l'étoile existe : retard, plus longue absence, et l'indice de sortie année par année
  const premiere = EPOQUES_ETOILES.find((ep) => etoile <= ep.nb).debut;
  const vie = tirages.filter((t) => t[0] >= premiere), annees = new Map();
  let derniere = -1, plusLongue = 0, depuis = 0;
  vie.forEach((t, i) => {
    const annee = t[0].slice(0, 4), nb = EPOQUES_ETOILES.find((ep) => t[0] >= ep.debut && t[0] < ep.fin).nb;
    if (!annees.has(annee)) annees.set(annee, { annee, sorties: 0, tirages: 0, attendus: 0 });
    const a = annees.get(annee);
    a.tirages++; a.attendus += 2 / nb;
    if (avec(t)) { a.sorties++; derniere = i; depuis = 0; } else { depuis++; plusLongue = Math.max(plusLongue, depuis); }
  });

  // sous la règle actuelle (12 étoiles) : jour, saison, étoiles et numéros qui l'accompagnent
  const actuels = tirages.filter((t) => t[0] >= EPOQUES_ETOILES[2].debut), sorties = actuels.filter(avec).length;
  const compteur = (cles) => Object.fromEntries(cles.map((c) => [c, { sorties: 0, tirages: 0 }]));
  const jours = compteur(['mardi', 'vendredi']), saisons = compteur(SAISONS);
  const partenaires = Array(13).fill(0), numeros = Array(51).fill(0);
  actuels.forEach((t) => {
    const cases = [jours[jourSemaine(t[0]) === 2 ? 'mardi' : 'vendredi'], saisons[saison(Number(t[0].slice(5, 7)))]];
    cases.forEach((c) => { c.tirages++; if (avec(t)) c.sorties++; });
    if (avec(t)) { partenaires[t[6] === etoile ? t[7] : t[6]]++; t.slice(1, 6).forEach((n) => { numeros[n]++; }); }
  });
  const tete = (liste) => liste.map((c, i) => [i, c]).filter((x) => x[0] > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5);
  return {
    etoile, epoques,
    actuelle: { tirages: actuels.length, sorties, ...fourchette(actuels.length, 1 / 6) },
    retard: derniere < 0 ? vie.length : vie.length - 1 - derniere,
    derniereSortie: derniere < 0 ? null : vie[derniere][0],
    plusLongueAbsence: plusLongue,
    ecartMoyen: sorties ? actuels.length / sorties : null,                          // attendu : 6 tirages avec 12 étoiles
    annees: [...annees.values()].map((a) => ({ ...a, indice: a.attendus ? (100 * a.sorties) / a.attendus : null })),
    jours, saisons,
    partenaires: tete(partenaires), partenaireAttendu: sorties / 11,                 // l'autre étoile est une des 11 restantes
    numeros: tete(numeros), numeroAttendu: sorties / 10,                             // chaque numéro sort 1 fois sur 10
  };
}

// Ce que les enquêtes disent d'une étoile : les tableaux qui ont une ligne par étoile (ou par valeur de 1 à 12).
export function enquetesDeLEtoile(etoile, donnees) {
  const liste = [];
  ['insolites', 'boulier', 'experiences'].forEach((bloc) => (donnees[bloc]?.fiches || []).forEach((f) => {
    const d = f.detail;
    if (!d || !['Étoile', 'Valeur'].includes(d.colonnes[0].t)) return;
    const ligne = d.lignes.find((l) => l[0] === etoile);
    if (!ligne) return;
    const iHors = d.colonnes.findIndex((c) => c.t.startsWith(COLONNE_HORS)), rang = d.lignes.indexOf(ligne);
    const inhabituel = iHors < 0 ? null : ligne[iHors] !== '', sens = iHors < 0 ? '' : ligne[iHors];
    const hasard = d.bas ? ` (le hasard donne de ${fr(d.bas[rang])} à ${fr(d.haut[rang])} pour cette valeur)` : '';
    const phrases = {
      etoiles: () => `L'étoile ${etoile} est sortie ${fois(ligne[1])} lors des ${minuscule(f.fenetre)}, sur ${fr(f.n)} tirages à ces dates ` +
        '(les étoiles 10 et 11 n\'existent que depuis mai 2011, la 12 depuis septembre 2016 : trop peu de tirages pour conclure).',
      dette: () => (ligne[1] ? `L'étoile ${etoile} est revenue ${fois(ligne[1])} après une longue absence ; à ses retours, ${fr(ligne[2], 2)} de ses 5 numéros « fidèles » étaient présents en moyenne ` +
        '(le hasard en donne 0,5 : ses numéros habituels ne reviennent pas avec elle).' : `L'étoile ${etoile} n'est jamais revenue après une longue absence sur la période étudiée.`),
      cameleon: () => `Le numéro ${etoile} et l'étoile ${etoile} sont sortis le même soir ${fois(ligne[1])}${hasard}.`,
    };
    liste.push({ bloc, numero: f.numero, cle: f.cle, titre: f.titre, definition: f.definition, fenetre: f.fenetre, inhabituel, sens, suivi: false,
      faits: d.colonnes.map((c, i) => ({ t: c.t, v: ligne[i], dec: c.dec })).filter((_, i) => i > 0 && i !== iHors),
      phrase: (phrases[f.cle] ? phrases[f.cle]() : '') + verdict(inhabituel, sens) });
  }));
  return liste;
}

export const pourcent = (c) => (c.tirages ? (100 * c.sorties) / c.tirages : null);

// ---------- Le palmarès des curiosités ----------

// Les phrases de synthèse du palmarès. P : le résultat de eurom/palmares.py (pour le jeu affiché).
// Chaque affirmation est comparée à ce que donnent les faux historiques tirés au hasard.
export function phrasesPalmares(P) {
  const classement = [...P.numeros].sort((a, b) => b.total - a.total || a.n - b.n);
  const premiers = classement.filter((x) => x.total === classement[0].total).map((x) => x.n);
  const dans = (q) => q.p >= 0.05;
  const zone = (q, dec = 1) => {
    const d = Number.isInteger(q.bas) && Number.isInteger(q.haut) ? 0 : dec;     // des comptes : bornes entières
    return `en moyenne ${fr(q.att, dec)}, et entre ${fr(q.bas, d)} et ${fr(q.haut, d)} dans 19 cas sur 20`;
  };
  const liste = (l) => (l.length > 1 ? l.slice(0, -1).map((n) => `le ${n}`).join(', ') + ` et le ${l[l.length - 1]}` : `le ${l[0]}`);
  const tete = `En tête : ${liste(premiers)}, avec ${fois(P.max.obs).replace(' fois', '')} « oui » sur ${P.nb_analyses} analyses. ` +
    `Dans un historique tiré au hasard, le premier du classement en a ${zone(P.max)}. ` +
    (dans(P.max) ? 'Le premier de notre classement est donc dans la norme : il fallait bien que l\'un des numéros soit en tête.'
      : `C'est plus que ce que le hasard donne d'ordinaire (${fr(P.max.p * 100)} faux historiques sur 100 font autant).`);
  const concentration = 'Les mêmes numéros reviennent-ils d\'une analyse à l\'autre plus que le hasard ne le veut ? ' +
    `On mesure à quel point les « oui » s'entassent sur quelques numéros (écart-type : ${fr(P.concentration.obs, 2)} ; le hasard donne ${zone(P.concentration, 2)}). ` +
    (dans(P.concentration) ? 'Réponse : non, les « oui » sont répartis comme le hasard les répartit.'
      : 'Réponse : oui, ils s\'entassent plus que d\'ordinaire. C\'est inhabituel, mais cela ne prouve rien à lui seul.');
  const frequence = 'Les numéros les plus chargés sont-ils simplement ceux qui sont sortis beaucoup plus, ou beaucoup moins, que les autres ? ' +
    `Le lien mesuré vaut ${fr(P.frequence.obs, 2)} (0 = aucun lien, 1 = lien parfait). ` +
    `Mais plusieurs analyses mesurent la même chose sous des angles différents (sorties, meilleure année, part du ${JEU.nomsJours[0]}…) : ` +
    `le hasard produit donc déjà ce lien, ${zone(P.frequence, 2)}. ` +
    (dans(P.frequence) ? 'Le lien observé est de la taille habituelle : un numéro un peu plus ou un peu moins sorti « collectionne » naturellement les « oui ».'
      : 'Le lien observé sort de l\'habitude.');
  const E = P.ensemble;
  const total = `Au total, ${fr(E.obs)} « oui » sur ${fr(P.nb_analyses * P.nb_numeros)} cases ; le hasard en donne ${zone(E)}. ` +
    (dans(E) ? 'Le total est dans la norme.' : 'C\'est plus que d\'ordinaire : à revoir quand de nouveaux tirages seront arrivés.');
  const hors = [E, P.max, P.concentration, P.frequence].filter((q) => !dans(q)).length;
  const verdict = !hors
    ? 'Verdict : ce palmarès est celui que le hasard dessine. Il y a toujours des numéros en tête et des numéros à zéro ; aucun ne « mérite » sa place. Il ne dit pas quoi jouer.'
    : `Verdict : ${hors} des 4 tests sort${hors > 1 ? 'ent' : ''} de l'ordinaire. Sur 4 tests, au moins un le fait par pure chance environ une fois sur cinq : à vérifier quand de nouveaux tirages seront arrivés. Il ne dit pas quoi jouer.`;
  return { tete, concentration, frequence, total, verdict, classement };
}
