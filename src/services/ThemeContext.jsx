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

  // ── BLACK ── True Black: Pitch black background, pure white accents
  black: {
    accent: '#ffffff', accent2: '#a3a3a3',
    bg: '#000000', surface: '#0a0a0a',
    text: '#ffffff', textMuted: '#a1a1aa', textFaint: '#52525b',
    glassBg: 'rgba(10, 10, 10, 0.85)', glassBorder: 'rgba(255, 255, 255, 0.12)',
    btnPrimary: '#ffffff', btnPrimaryText: '#000000',
    hoverBg: 'rgba(255, 255, 255, 0.08)', activeBg: 'rgba(255, 255, 255, 0.15)',
    navActiveBg: '#ffffff', navActiveText: '#000000',
    label: 'Obsidian',
  },

  // ── NEBULA ── Cosmic: Deep violet/purple, magenta highlights
  nebula: {
    accent: '#e040fb', accent2: '#7c4dff',
    bg: '#0e0520', surface: '#1a0b38',
    text: '#f3e6ff', textMuted: '#c49ddd', textFaint: '#5c3678',
    glassBg: 'rgba(26, 11, 56, 0.85)', glassBorder: 'rgba(224, 64, 251, 0.22)',
    btnPrimary: '#e040fb', btnPrimaryText: '#0e0520',
    hoverBg: 'rgba(224, 64, 251, 0.12)', activeBg: 'rgba(224, 64, 251, 0.22)',
    navActiveBg: '#e040fb', navActiveText: '#0e0520',
    label: 'Nebula',
  },

  // ── LAVA ── Intense: Dark charcoal-red, fiery orange-red
  lava: {
    accent: '#ff5722', accent2: '#ff1744',
    bg: '#120a08', surface: '#22100c',
    text: '#ffe8e3', textMuted: '#e08070', textFaint: '#6b2d22',
    glassBg: 'rgba(34, 16, 12, 0.85)', glassBorder: 'rgba(255, 87, 34, 0.22)',
    btnPrimary: '#ff5722', btnPrimaryText: '#120a08',
    hoverBg: 'rgba(255, 87, 34, 0.12)', activeBg: 'rgba(255, 87, 34, 0.22)',
    navActiveBg: '#ff5722', navActiveText: '#120a08',
    label: 'Lava',
  },

  // ── JUNGLE ── Organic: Deep forest green, mint highlights
  jungle: {
    accent: '#00e676', accent2: '#1de9b6',
    bg: '#050f0a', surface: '#0a1e14',
    text: '#e0fff2', textMuted: '#6dbf93', textFaint: '#1c5538',
    glassBg: 'rgba(10, 30, 20, 0.85)', glassBorder: 'rgba(0, 230, 118, 0.20)',
    btnPrimary: '#00e676', btnPrimaryText: '#050f0a',
    hoverBg: 'rgba(0, 230, 118, 0.10)', activeBg: 'rgba(0, 230, 118, 0.20)',
    navActiveBg: '#00e676', navActiveText: '#050f0a',
    label: 'Jungle',
  },

  // ── SAKURA ── Elegant: Deep wine/cherry bg, vibrant rose-pink
  sakura: {
    accent: '#ff4d8d', accent2: '#ff80ab',
    bg: '#130610', surface: '#241020',
    text: '#ffe8f5', textMuted: '#d97fb0', textFaint: '#6d2355',
    glassBg: 'rgba(36, 16, 32, 0.85)', glassBorder: 'rgba(255, 77, 141, 0.22)',
    btnPrimary: '#ff4d8d', btnPrimaryText: '#130610',
    hoverBg: 'rgba(255, 77, 141, 0.12)', activeBg: 'rgba(255, 77, 141, 0.22)',
    navActiveBg: '#ff4d8d', navActiveText: '#130610',
    label: 'Sakura',
  },

  // ── ARCTIC ── Crisp: Deep navy, ice-blue accent
  arctic: {
    accent: '#40c4ff', accent2: '#80d8ff',
    bg: '#04101a', surface: '#091e30',
    text: '#e8f6ff', textMuted: '#6ab0d4', textFaint: '#1e4a6a',
    glassBg: 'rgba(9, 30, 48, 0.85)', glassBorder: 'rgba(64, 196, 255, 0.20)',
    btnPrimary: '#40c4ff', btnPrimaryText: '#04101a',
    hoverBg: 'rgba(64, 196, 255, 0.10)', activeBg: 'rgba(64, 196, 255, 0.20)',
    navActiveBg: '#40c4ff', navActiveText: '#04101a',
    label: 'Arctic',
  },

  // ── EMBER ── Luxury: Near-black with rich gold
  ember: {
    accent: '#ffab00', accent2: '#ffd740',
    bg: '#0f0e0a', surface: '#1e1b12',
    text: '#fff8e6', textMuted: '#c9a84c', textFaint: '#5a4820',
    glassBg: 'rgba(30, 27, 18, 0.85)', glassBorder: 'rgba(255, 171, 0, 0.22)',
    btnPrimary: '#ffab00', btnPrimaryText: '#0f0e0a',
    hoverBg: 'rgba(255, 171, 0, 0.12)', activeBg: 'rgba(255, 171, 0, 0.22)',
    navActiveBg: '#ffab00', navActiveText: '#0f0e0a',
    label: 'Ember',
  },

  // ── MOCHA ── Cozy: Dark coffee brown, warm cream accents
  mocha: {
    accent: '#e8a87c', accent2: '#f4c99e',
    bg: '#100d0b', surface: '#211a15',
    text: '#fdf3ec', textMuted: '#b89070', textFaint: '#5e3e2c',
    glassBg: 'rgba(33, 26, 21, 0.85)', glassBorder: 'rgba(232, 168, 124, 0.22)',
    btnPrimary: '#e8a87c', btnPrimaryText: '#100d0b',
    hoverBg: 'rgba(232, 168, 124, 0.12)', activeBg: 'rgba(232, 168, 124, 0.22)',
    navActiveBg: '#e8a87c', navActiveText: '#100d0b',
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

function applyThemeVars(palette) {
  if (!palette || typeof document === 'undefined') return;
  const root = document.documentElement;

  // ── Core colors
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-2', palette.accent2);
  root.style.setProperty('--accent-rgb', hexToRgb(palette.accent));
  root.style.setProperty('--accent-2-rgb', hexToRgb(palette.accent2));
  root.style.setProperty('--accent-glow', `rgba(${hexToRgb(palette.accent)}, 0.40)`);
  root.style.setProperty('--primary', palette.accent);
  root.style.setProperty('--bg-main', palette.bg);
  root.style.setProperty('--surface', palette.surface);
  root.style.setProperty('--text-main', palette.text);
  root.style.setProperty('--text-muted', palette.textMuted);
  root.style.setProperty('--text-faint', palette.textFaint);
  root.style.setProperty('--glass-bg', palette.glassBg);
  root.style.setProperty('--glass-border', palette.glassBorder);

  // ── Interaction states (accent-tinted, not white-tinted)
  root.style.setProperty('--hover-bg', palette.hoverBg);
  root.style.setProperty('--active-bg', palette.activeBg);
  root.style.setProperty('--border-subtle', `rgba(${hexToRgb(palette.text)}, 0.07)`);

  // ── Buttons
  root.style.setProperty('--btn-primary-bg', palette.btnPrimary);
  root.style.setProperty('--btn-primary-text', palette.btnPrimaryText);
  root.style.setProperty('--btn-primary-hover', `rgba(${hexToRgb(palette.btnPrimary)}, 0.85)`);
  root.style.setProperty('--btn-secondary-bg', `rgba(${hexToRgb(palette.text)}, 0.06)`);
  root.style.setProperty('--btn-secondary-hover', palette.hoverBg);
  root.style.setProperty('--btn-secondary-border', `rgba(${hexToRgb(palette.accent)}, 0.18)`);

  // ── Navigation active
  root.style.setProperty('--nav-active-bg', palette.navActiveBg);
  root.style.setProperty('--nav-active-text', palette.navActiveText);

  // ── Components
  root.style.setProperty('--card-bg', palette.glassBg);
  root.style.setProperty('--scrollbar-thumb', `rgba(${hexToRgb(palette.accent)}, 0.30)`);
  root.style.setProperty('--scrollbar-hover', `rgba(${hexToRgb(palette.accent)}, 0.55)`);

  // ── Body
  document.body.style.backgroundColor = palette.bg;
  document.body.style.color = palette.text;
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

if (typeof window !== 'undefined') {
  applyThemeVars(paletteMap[getInitialTheme()]);
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);
  const themes = useMemo(() => paletteMap, []);

  const updateTheme = React.useCallback((colorName) => {
    const next = themes[colorName] ? colorName : 'black';
    setTheme(next);
    applyThemeVars(themes[next]);
    if (typeof window !== 'undefined') window.localStorage.setItem('ak_theme', next);
  }, [themes]);

  React.useEffect(() => {
    applyThemeVars(themes[theme]);
  }, [theme, themes]);

  return (
    <ThemeContext.Provider value={{ theme, themes, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
