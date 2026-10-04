// Les thèmes : chaque thème est une liste de variables CSS. Changer de thème = remplacer ces variables.
// L'utilisateur peut en plus choisir ses couleurs de boules (froid / chaud) et la force de la lueur.

export const THEMES = {
  matrix: {
    nom: 'Terminal Matrix', description: 'Noir profond, vert néon, accents cyan',
    fond: '#0d0d0d', surface: '#141a15', texte: '#d6ffe6', texte2: '#7fbf98', bord: '#1f4d33',
    accent: '#00ff66', accent2: '#00e5ff', accent3: '#ff2bd6', surAccent: '#04140a',
    froid: '#3aa0ff', chaud: '#ff5a1f', lueur: 1, police: 'Consolas, "Cascadia Mono", "Courier New", monospace', rayon: '6px',
  },
  synthwave: {
    nom: 'Synthwave 84', description: 'Nuit violette, rose néon, soleil couchant',
    fond: '#1a0933', surface: '#26104a', texte: '#fbe9ff', texte2: '#c9a3e6', bord: '#5a2a8a',
    accent: '#ff007f', accent2: '#00f0ff', accent3: '#ffd700', surAccent: '#ffffff',
    froid: '#00f0ff', chaud: '#ffd700', lueur: 1.2, police: 'system-ui, "Segoe UI", sans-serif', rayon: '14px',
  },
  steampunk: {
    nom: 'Steampunk Alchemy', description: 'Cuir sombre, laiton et cuivre',
    fond: '#1c1613', surface: '#2a211b', texte: '#f1e3c8', texte2: '#b89f7a', bord: '#6b4f2e',
    accent: '#d4af37', accent2: '#b87333', accent3: '#8c3b1e', surAccent: '#1c1613',
    froid: '#5f8f8a', chaud: '#c1440e', lueur: 0.4, police: 'Georgia, "Times New Roman", serif', rayon: '4px',
  },
  arcade: {
    nom: 'Vector Arcade 1980', description: 'Écran cathodique ambre, contours nets',
    fond: '#0a0700', surface: '#0a0700', texte: '#ffb000', texte2: '#b37b00', bord: '#ffb000',
    accent: '#ffb000', accent2: '#ffd98a', accent3: '#ff6a00', surAccent: '#0a0700',
    froid: '#806000', chaud: '#fff0c2', lueur: 0.8, police: '"Courier New", Consolas, monospace', rayon: '0px',
  },
};

export const THEME_PAR_DEFAUT = 'matrix';

function composantes(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Couleur entre `a` (t = 0) et `b` (t = 1).
export function melange(a, b, t) {
  const p = Math.min(1, Math.max(0, t)), ca = composantes(a), cb = composantes(b);
  return '#' + ca.map((x, i) => Math.round(x + (cb[i] - x) * p).toString(16).padStart(2, '0')).join('');
}

// Couleurs réellement utilisées : celles du thème, remplacées par les choix de l'utilisateur s'il en a fait.
export function palette(cleTheme, perso = {}) {
  const theme = THEMES[cleTheme] || THEMES[THEME_PAR_DEFAUT];
  return { ...theme, froid: perso.froid || theme.froid, chaud: perso.chaud || theme.chaud, lueur: perso.lueur ?? theme.lueur };
}

// Couleur d'une boule : t = 0 (froid) à 1 (chaud).
export function couleurThermique(t, pal) {
  return melange(pal.froid, pal.chaud, t);
}

// Les variables CSS à poser sur la page.
export function variables(cleTheme, perso = {}) {
  const p = palette(cleTheme, perso);
  return {
    '--fond': p.fond, '--surface': p.surface, '--texte': p.texte, '--texte2': p.texte2, '--bord': p.bord,
    '--accent': p.accent, '--accent2': p.accent2, '--accent3': p.accent3, '--sur-accent': p.surAccent,
    '--froid': p.froid, '--chaud': p.chaud, '--lueur': String(p.lueur), '--police': p.police, '--rayon': p.rayon,
  };
}

export function appliquer(element, cleTheme, perso = {}) {
  Object.entries(variables(cleTheme, perso)).forEach(([nom, valeur]) => element.style.setProperty(nom, valeur));
  element.dataset.theme = THEMES[cleTheme] ? cleTheme : THEME_PAR_DEFAUT;
}
