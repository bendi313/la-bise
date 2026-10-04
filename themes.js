// Les thèmes : chaque thème est une liste de variables CSS. Changer de thème = remplacer ces variables.
// L'utilisateur peut en plus régler chaque couleur de l'interface, la lueur, et les seuils du dégradé froid → chaud.

export const CATEGORIES = [['retro', 'Néo-Punk / Rétro'], ['sombre', 'Classique sombre'], ['clair', 'Classique clair']];

export const THEMES = {
  matrix: {
    nom: 'Terminal Matrix', categorie: 'retro', description: 'Noir profond, vert néon, accents cyan',
    fond: '#0d0d0d', surface: '#141a15', texte: '#d6ffe6', texte2: '#7fbf98', bord: '#1f4d33',
    accent: '#00ff66', accent2: '#00e5ff', accent3: '#ff2bd6', surAccent: '#04140a',
    froid: '#3aa0ff', chaud: '#ff5a1f', lueur: 1, police: 'Consolas, "Cascadia Mono", "Courier New", monospace', rayon: '6px',
  },
  synthwave: {
    nom: 'Synthwave 84', categorie: 'retro', description: 'Nuit violette, rose néon, soleil couchant',
    fond: '#1a0933', surface: '#26104a', texte: '#fbe9ff', texte2: '#c9a3e6', bord: '#5a2a8a',
    accent: '#ff007f', accent2: '#00f0ff', accent3: '#ffd700', surAccent: '#ffffff',
    froid: '#00f0ff', chaud: '#ffd700', lueur: 1.2, police: 'system-ui, "Segoe UI", sans-serif', rayon: '14px',
  },
  steampunk: {
    nom: 'Steampunk Alchemy', categorie: 'retro', description: 'Cuir sombre, laiton et cuivre',
    fond: '#1c1613', surface: '#2a211b', texte: '#f1e3c8', texte2: '#b89f7a', bord: '#6b4f2e',
    accent: '#d4af37', accent2: '#b87333', accent3: '#8c3b1e', surAccent: '#1c1613',
    froid: '#5f8f8a', chaud: '#c1440e', lueur: 0.4, police: 'Georgia, "Times New Roman", serif', rayon: '4px',
  },
  arcade: {
    nom: 'Vector Arcade 1980', categorie: 'retro', description: 'Écran cathodique ambre, contours nets',
    fond: '#0a0700', surface: '#0a0700', texte: '#ffb000', texte2: '#b37b00', bord: '#ffb000',
    accent: '#ffb000', accent2: '#ffd98a', accent3: '#ff6a00', surAccent: '#0a0700',
    froid: '#806000', chaud: '#fff0c2', lueur: 0.8, police: '"Courier New", Consolas, monospace', rayon: '0px',
  },
  moderne: {
    nom: 'Modern Dark', categorie: 'sombre', description: 'Anthracite, contraste doux, reposant pour les yeux',
    fond: '#1f2125', surface: '#2a2d33', texte: '#e6e7ea', texte2: '#a3a8b0', bord: '#3d424b',
    accent: '#7aa2f7', accent2: '#73c2b0', accent3: '#c9a0dc', surAccent: '#14161a',
    froid: '#5b9bd5', chaud: '#e07a5f', lueur: 0, police: 'system-ui, -apple-system, "Segoe UI", sans-serif', rayon: '10px',
  },
  clair: {
    nom: 'Clean Light', categorie: 'clair', description: 'Fond lumineux, grande lisibilité en plein jour',
    fond: '#f5f5f2', surface: '#ffffff', texte: '#1b1b1b', texte2: '#5c5c5c', bord: '#d5d5cf',
    accent: '#1f6fd6', accent2: '#0a7f63', accent3: '#a23b8c', surAccent: '#ffffff',
    froid: '#2a78d6', chaud: '#e34948', lueur: 0, police: 'system-ui, -apple-system, "Segoe UI", sans-serif', rayon: '10px',
  },
};

export const THEME_PAR_DEFAUT = 'matrix';

// Les couleurs que l'utilisateur peut régler lui-même dans le studio.
export const COULEURS_PERSO = [
  ['fond', 'Fond'], ['surface', 'Cartes'], ['texte', 'Texte'], ['texte2', 'Texte secondaire'],
  ['accent', 'Accent principal'], ['accent2', 'Accent secondaire'], ['accent3', 'Accent des encadrés'],
  ['froid', 'Boules froides'], ['chaud', 'Boules chaudes'],
];

function composantes(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Couleur entre `a` (t = 0) et `b` (t = 1).
export function melange(a, b, t) {
  const p = Math.min(1, Math.max(0, t)), ca = composantes(a), cb = composantes(b);
  return '#' + ca.map((x, i) => Math.round(x + (cb[i] - x) * p).toString(16).padStart(2, '0')).join('');
}

// Clarté perçue d'une couleur, de 0 (noir) à 1 (blanc).
export function clarte(hex) {
  const [r, g, b] = composantes(hex).map((x) => { const v = x / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// La couleur de texte (noir ou blanc) qui se lit le mieux sur ce fond.
export const contraste = (hex) => (clarte(hex) > 0.4 ? '#111111' : '#ffffff');

// Couleurs réellement utilisées : celles du thème, remplacées par les choix de l'utilisateur s'il en a fait.
export function palette(cleTheme, perso = {}) {
  const theme = THEMES[cleTheme] || THEMES[THEME_PAR_DEFAUT];
  const p = { ...theme, lueur: perso.lueur ?? theme.lueur };
  COULEURS_PERSO.forEach(([cle]) => { if (perso[cle]) p[cle] = perso[cle]; });
  if (perso.accent) p.surAccent = contraste(perso.accent);       // le texte des boutons reste lisible sur l'accent choisi
  return p;
}

// Seuils du dégradé, en % : en dessous de `froid`, tout est froid ; au-dessus de `chaud`, tout est chaud.
export function ajuster(t, seuils = { froid: 0, chaud: 100 }) {
  const a = seuils.froid / 100, b = seuils.chaud / 100;
  return b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : (t >= b ? 1 : 0);
}

// Couleur d'une boule : t = 0 (froid) à 1 (chaud), après passage par les seuils.
export function couleurThermique(t, pal, seuils) {
  return melange(pal.froid, pal.chaud, ajuster(t, seuils));
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
  const v = variables(cleTheme, perso);
  Object.entries(v).forEach(([nom, valeur]) => element.style.setProperty(nom, valeur));
  element.style.colorScheme = clarte(v['--fond']) > 0.4 ? 'light' : 'dark';
  element.dataset.theme = THEMES[cleTheme] ? cleTheme : THEME_PAR_DEFAUT;
}
