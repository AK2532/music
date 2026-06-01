/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState } from 'react';

const ThemeContext = createContext();

/**
 * Each theme has its OWN personality:
 * - bg / surface: the actual background tones (not all black!)
 * - accent / accent2: the signature color for buttons, glows, active states
 * - text / textMuted / textFaint: contrast-appropriate text
 * - glassBg / glassBorder: glass panels tinted to the theme
 * - btnPrimary / btnPrimaryText: play button color
 * - hoverBg / activeBg: list row interaction colors
 * - navActiveBg / navActiveText: active navigation pill
 */
const paletteMap = {

  // ── OBSIDIAN ── True OLED black, monochrome silver accents
  black: {
    accent: '#ffffff', accent2: '#a3a3a3',
    bg: '#000000', surface: '#111111',
    text: '#ffffff', textMuted: '#a1a1aa', textFaint: '#52525b',
    glassBg: 'rgba(10, 10, 10, 0.88)', glassBorder: 'rgba(255, 255, 255, 0.12)',
    btnPrimary: '#ffffff', btnPrimaryText: '#000000',
    hoverBg: 'rgba(255, 255, 255, 0.08)', activeBg: 'rgba(255, 255, 255, 0.15)',
    navActiveBg: '#ffffff', navActiveText: '#000000',
    label: 'Obsidian',
  },

  // ── NEBULA ── Rich violet-purple world, magenta highlights
  nebula: {
    accent: '#d946ef', accent2: '#a855f7',
    bg: '#1a0a2e', surface: '#2d1552',
    text: '#f5eeff', textMuted: '#c4a8e0', textFaint: '#7c5a9e',
    glassBg: 'rgba(45, 21, 82, 0.82)', glassBorder: 'rgba(217, 70, 239, 0.25)',
    btnPrimary: '#d946ef', btnPrimaryText: '#1a0a2e',
    hoverBg: 'rgba(217, 70, 239, 0.14)', activeBg: 'rgba(217, 70, 239, 0.25)',
    navActiveBg: '#d946ef', navActiveText: '#1a0a2e',
    label: 'Nebula',
  },

  // ── LAVA ── Warm charcoal with smoldering ember tones, fiery orange-red
  lava: {
    accent: '#ff5722', accent2: '#ff7043',
    bg: '#1c0f0a', surface: '#2e1810',
    text: '#fff0eb', textMuted: '#d4907a', textFaint: '#8c4d38',
    glassBg: 'rgba(46, 24, 16, 0.82)', glassBorder: 'rgba(255, 87, 34, 0.25)',
    btnPrimary: '#ff5722', btnPrimaryText: '#1c0f0a',
    hoverBg: 'rgba(255, 87, 34, 0.14)', activeBg: 'rgba(255, 87, 34, 0.25)',
    navActiveBg: '#ff5722', navActiveText: '#1c0f0a',
    label: 'Lava',
  },

  // ── JUNGLE ── Dark teal-green forest, vivid emerald highlights
  jungle: {
    accent: '#22c55e', accent2: '#34d399',
    bg: '#0a1a14', surface: '#122e22',
    text: '#e8fdf2', textMuted: '#7cc9a0', textFaint: '#3d7a5a',
    glassBg: 'rgba(18, 46, 34, 0.82)', glassBorder: 'rgba(34, 197, 94, 0.22)',
    btnPrimary: '#22c55e', btnPrimaryText: '#0a1a14',
    hoverBg: 'rgba(34, 197, 94, 0.12)', activeBg: 'rgba(34, 197, 94, 0.22)',
    navActiveBg: '#22c55e', navActiveText: '#0a1a14',
    label: 'Jungle',
  },

  // ── SAKURA ── Dusty rose-wine with warm pink blossoms
  sakura: {
    accent: '#f472b6', accent2: '#fb7185',
    bg: '#1e0c18', surface: '#33162b',
    text: '#fdf0f6', textMuted: '#d98eb5', textFaint: '#8a4470',
    glassBg: 'rgba(51, 22, 43, 0.82)', glassBorder: 'rgba(244, 114, 182, 0.25)',
    btnPrimary: '#f472b6', btnPrimaryText: '#1e0c18',
    hoverBg: 'rgba(244, 114, 182, 0.14)', activeBg: 'rgba(244, 114, 182, 0.25)',
    navActiveBg: '#f472b6', navActiveText: '#1e0c18',
    label: 'Sakura',
  },

  // ── ARCTIC ── Deep slate-blue ocean, icy cyan accent
  arctic: {
    accent: '#38bdf8', accent2: '#67e8f9',
    bg: '#0b1828', surface: '#152a42',
    text: '#edf6ff', textMuted: '#7cb8db', textFaint: '#3a6a8a',
    glassBg: 'rgba(21, 42, 66, 0.82)', glassBorder: 'rgba(56, 189, 248, 0.22)',
    btnPrimary: '#38bdf8', btnPrimaryText: '#0b1828',
    hoverBg: 'rgba(56, 189, 248, 0.12)', activeBg: 'rgba(56, 189, 248, 0.22)',
    navActiveBg: '#38bdf8', navActiveText: '#0b1828',
    label: 'Arctic',
  },

  // ── EMBER ── Warm dark bronze, rich gold highlights
  ember: {
    accent: '#f59e0b', accent2: '#fbbf24',
    bg: '#181208', surface: '#2a2010',
    text: '#fff9ec', textMuted: '#d4a954', textFaint: '#7a6230',
    glassBg: 'rgba(42, 32, 16, 0.82)', glassBorder: 'rgba(245, 158, 11, 0.25)',
    btnPrimary: '#f59e0b', btnPrimaryText: '#181208',
    hoverBg: 'rgba(245, 158, 11, 0.14)', activeBg: 'rgba(245, 158, 11, 0.25)',
    navActiveBg: '#f59e0b', navActiveText: '#181208',
    label: 'Ember',
  },

  // ── MOCHA ── Rich dark-brown leather, warm cream and caramel
  mocha: {
    accent: '#e8a87c', accent2: '#f0c4a0',
    bg: '#16100c', surface: '#2c2018',
    text: '#fdf3ec', textMuted: '#c0977a', textFaint: '#7a5840',
    glassBg: 'rgba(44, 32, 24, 0.82)', glassBorder: 'rgba(232, 168, 124, 0.25)',
    btnPrimary: '#e8a87c', btnPrimaryText: '#16100c',
    hoverBg: 'rgba(232, 168, 124, 0.14)', activeBg: 'rgba(232, 168, 124, 0.25)',
    navActiveBg: '#e8a87c', navActiveText: '#16100c',
    label: 'Mocha',
  },
};

function hexToRgb(hex) {
  const n = hex.replace('#', '');
  if (n.length !== 6) return '255, 155, 84';
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function withAppearanceMode(palette, mode = 'dark') {
  if (!palette || mode !== 'light') return palette;

  const accentRgb = hexToRgb(palette.accent);

  return {
    ...palette,
    bg: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    textFaint: '#94a3b8',
    glassBg: 'rgba(255, 255, 255, 0.78)',
    glassBorder: `rgba(${accentRgb}, 0.20)`,
    btnPrimary: palette.accent,
    btnPrimaryText: '#ffffff',
    hoverBg: `rgba(${accentRgb}, 0.09)`,
    activeBg: `rgba(${accentRgb}, 0.16)`,
    navActiveBg: palette.accent,
    navActiveText: '#ffffff',
    cardBg: 'rgba(255, 255, 255, 0.72)',
    shadow: '0 24px 70px rgba(15, 23, 42, 0.13)',
    shadowHover: '0 34px 92px rgba(15, 23, 42, 0.18)',
    btnSecondaryBg: 'rgba(15, 23, 42, 0.045)',
    btnSecondaryBorder: 'rgba(15, 23, 42, 0.10)',
  };
}

function applyThemeVars(palette, mode = 'dark') {
  if (!palette || typeof document === 'undefined') return;
  const root = document.documentElement;
  const activePalette = withAppearanceMode(palette, mode);

  // ── Core colors
  root.dataset.colorMode = mode;
  root.style.setProperty('--accent', activePalette.accent);
  root.style.setProperty('--accent-2', activePalette.accent2);
  root.style.setProperty('--accent-rgb', hexToRgb(activePalette.accent));
  root.style.setProperty('--accent-2-rgb', hexToRgb(activePalette.accent2));
  root.style.setProperty('--accent-glow', `rgba(${hexToRgb(activePalette.accent)}, ${mode === 'light' ? 0.24 : 0.40})`);
  root.style.setProperty('--primary', activePalette.accent);
  root.style.setProperty('--bg-main', activePalette.bg);
  root.style.setProperty('--surface', activePalette.surface);
  root.style.setProperty('--text-main', activePalette.text);
  root.style.setProperty('--text-muted', activePalette.textMuted);
  root.style.setProperty('--text-faint', activePalette.textFaint);
  root.style.setProperty('--glass-bg', activePalette.glassBg);
  root.style.setProperty('--glass-border', activePalette.glassBorder);

  // ── Interaction states (accent-tinted, not white-tinted)
  root.style.setProperty('--hover-bg', activePalette.hoverBg);
  root.style.setProperty('--active-bg', activePalette.activeBg);
  root.style.setProperty('--border-subtle', `rgba(${hexToRgb(activePalette.text)}, ${mode === 'light' ? 0.10 : 0.07})`);

  // ── Buttons
  root.style.setProperty('--btn-primary-bg', activePalette.btnPrimary);
  root.style.setProperty('--btn-primary-text', activePalette.btnPrimaryText);
  root.style.setProperty('--btn-primary-hover', `rgba(${hexToRgb(activePalette.btnPrimary)}, 0.85)`);
  root.style.setProperty('--btn-secondary-bg', activePalette.btnSecondaryBg || `rgba(${hexToRgb(activePalette.text)}, 0.06)`);
  root.style.setProperty('--btn-secondary-hover', activePalette.hoverBg);
  root.style.setProperty('--btn-secondary-border', activePalette.btnSecondaryBorder || `rgba(${hexToRgb(activePalette.accent)}, 0.18)`);

  // ── Navigation active
  root.style.setProperty('--nav-active-bg', activePalette.navActiveBg);
  root.style.setProperty('--nav-active-text', activePalette.navActiveText);

  // ── Components
  root.style.setProperty('--card-bg', activePalette.cardBg || activePalette.glassBg);
  root.style.setProperty('--glass-shadow', activePalette.shadow || '0 24px 64px rgba(0, 0, 0, 0.6)');
  root.style.setProperty('--glass-shadow-hover', activePalette.shadowHover || '0 32px 80px rgba(0, 0, 0, 0.8)');
  root.style.setProperty('--scrollbar-thumb', `rgba(${hexToRgb(activePalette.accent)}, 0.30)`);
  root.style.setProperty('--scrollbar-hover', `rgba(${hexToRgb(activePalette.accent)}, 0.55)`);

  // ── Body
  document.body.style.backgroundColor = activePalette.bg;
  document.body.style.color = activePalette.text;
}

function getInitialTheme() {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('ak_theme');
    if (saved && paletteMap[saved]) return saved;

    // Migrate old theme names
    const migrationMap = {
      white: 'arctic', brown: 'mocha',
      purple: 'nebula', blue: 'arctic', pink: 'sakura', green: 'jungle',
      gold: 'ember', coffee: 'mocha',
    };
    if (saved && migrationMap[saved]) return migrationMap[saved];
  }
  return 'black';
}

function getInitialMode() {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('ak_mode');
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'dark';
}

if (typeof window !== 'undefined') {
  applyThemeVars(paletteMap[getInitialTheme()], getInitialMode());
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);
  const [mode, setMode] = useState(getInitialMode);
  const themes = useMemo(() => paletteMap, []);
  const activePalette = useMemo(() => withAppearanceMode(themes[theme] || themes.black, mode), [theme, themes, mode]);

  const updateTheme = React.useCallback((colorName) => {
    const next = themes[colorName] ? colorName : 'black';
    setTheme(next);
    applyThemeVars(themes[next], mode);
    if (typeof window !== 'undefined') window.localStorage.setItem('ak_theme', next);
  }, [themes, mode]);

  const updateMode = React.useCallback((nextMode) => {
    const next = nextMode === 'light' ? 'light' : 'dark';
    setMode(next);
    applyThemeVars(themes[theme] || themes.black, next);
    if (typeof window !== 'undefined') window.localStorage.setItem('ak_mode', next);
  }, [themes, theme]);

  React.useEffect(() => {
    applyThemeVars(themes[theme], mode);
  }, [theme, themes, mode]);

  return (
    <ThemeContext.Provider value={{ theme, themes, mode, activePalette, updateTheme, updateMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
