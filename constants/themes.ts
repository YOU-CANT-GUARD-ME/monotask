// constants/themes.ts
// 8 themes × 2 modes (light/dark) = 16 carefully-tuned palettes.
// Each theme has its own warmth/coolness preserved across modes.

export type ThemePalette = {
  // Backgrounds
  bg: string;          // main screen background
  surface: string;     // cards, sections, input backgrounds
  surfaceAlt: string;  // nested surfaces (note cards inside cards)
  surfaceDark: string; // focus screen background (always dark, themed)

  // Accent
  primary: string;
  primaryDark: string;   // darker shade for borders/shadows
  primarySoft: string;   // very light tint (rgba 14% alpha)
  onPrimary: string;     // text/icon on top of primary

  // Text
  text: string;
  textMuted: string;
  textFaint: string;

  // Borders / dividers
  border: string;
  borderSoft: string;

  // Status
  danger: string;
  warning: string;

  // Heatmap scale (low → high)
  heat: [string, string, string, string, string, string];
};

export type ThemeKey =
  | 'olive'
  | 'sage'
  | 'slate'
  | 'clay'
  | 'plum'
  | 'amber'
  | 'forest'
  | 'charcoal';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';

export type ThemeMeta = {
  key: ThemeKey;
  label: string;           // shown in picker (Korean)
  light: ThemePalette;
  dark: ThemePalette;
};

// ─── Helpers to keep palettes consistent ──────────────────────────────────

// Slight rgba tint of an accent for soft pills/highlights
const softTint = (rgb: string) => rgb.replace('rgb(', 'rgba(').replace(')', ',0.14)');

// ─── 1. OLIVE — your original, default ─────────────────────────────────────
const olive: ThemeMeta = {
  key: 'olive',
  label: '올리브 그린',
  light: {
    bg: '#F4F1EA',
    surface: '#EFEAE0',
    surfaceAlt: '#E8E3D6',
    surfaceDark: '#16180e',
    primary: '#87986A',
    primaryDark: '#6a7a52',
    primarySoft: 'rgba(135,152,106,0.14)',
    onPrimary: '#F4F1EA',
    text: '#26221a',
    textMuted: '#6b6358',
    textFaint: '#a39888',
    border: '#E4DDD0',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#EFEAE0', '#c8dba8', '#a8c878', '#87986A', '#6a7d52', '#4a5c38'],
  },
  dark: {
    bg: '#1A1C16',
    surface: '#252720',
    surfaceAlt: '#30332B',
    surfaceDark: '#0A0B07',
    primary: '#8FA870',
    primaryDark: '#87986A',
    primarySoft: 'rgba(168,187,130,0.18)',
    onPrimary: '#F0EDE4',
    text: '#E8E4D8',
    textMuted: '#a09a8a',
    textFaint: '#605a4f',
    border: '#3a362d',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#252720', '#3c4434', '#56664a', '#87986A', '#A8BB82', '#c8da98'],
  },
};

// ─── 2. SAGE — cooler, dustier green ───────────────────────────────────────
const sage: ThemeMeta = {
  key: 'sage',
  label: '세이지',
  light: {
    bg: '#F0EDE5',
    surface: '#E8E4D8',
    surfaceAlt: '#DCD7C9',
    surfaceDark: '#141612',
    primary: '#7A8B6F',
    primaryDark: '#5F7057',
    primarySoft: 'rgba(122,139,111,0.14)',
    onPrimary: '#F0EDE5',
    text: '#22231c',
    textMuted: '#65665d',
    textFaint: '#9a9c91',
    border: '#DAD5C7',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#E8E4D8', '#c8d4b9', '#a8b89a', '#7A8B6F', '#5F7057', '#445040'],
  },
  dark: {
    bg: '#181A15',
    surface: '#22251F',
    surfaceAlt: '#2D302A',
    surfaceDark: '#0A0B08',
    primary: '#879A7C',
    primaryDark: '#7A8B6F',
    primarySoft: 'rgba(157,174,146,0.18)',
    onPrimary: '#EEEBe2',
    text: '#E6E2D6',
    textMuted: '#999a90',
    textFaint: '#5a5b54',
    border: '#363830',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#22251F', '#383d32', '#525948', '#7A8B6F', '#9DAE92', '#bdcfb0'],
  },
};

// ─── 3. SLATE — cool blue-grey, like wet stone ─────────────────────────────
const slate: ThemeMeta = {
  key: 'slate',
  label: '슬레이트 블루',
  light: {
    bg: '#ECEEF1',
    surface: '#E1E5EA',
    surfaceAlt: '#D4DAE0',
    surfaceDark: '#0E1114',
    primary: '#5C7585',
    primaryDark: '#465B69',
    primarySoft: 'rgba(92,117,133,0.14)',
    onPrimary: '#ECEEF1',
    text: '#1c2128',
    textMuted: '#5f6873',
    textFaint: '#9aa1ad',
    border: '#D1D6DD',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#E1E5EA', '#bcc9d2', '#94a8b6', '#5C7585', '#465B69', '#2f3f4a'],
  },
  dark: {
    bg: '#14171A',
    surface: '#1E2226',
    surfaceAlt: '#2A2F34',
    surfaceDark: '#08090B',
    primary: '#7491A3',
    primaryDark: '#6C8696',
    primarySoft: 'rgba(138,163,179,0.18)',
    onPrimary: '#EDF0F4',
    text: '#E4E8ED',
    textMuted: '#929aa3',
    textFaint: '#535860',
    border: '#33383d',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#1E2226', '#323a40', '#4a5660', '#6C8696', '#8AA3B3', '#abc2cf'],
  },
};

// ─── 4. CLAY — earthy terracotta, warm ─────────────────────────────────────
const clay: ThemeMeta = {
  key: 'clay',
  label: '클레이',
  light: {
    bg: '#F4EEE8',
    surface: '#EBE2DA',
    surfaceAlt: '#DFD3C9',
    surfaceDark: '#181410',
    primary: '#A87262',
    primaryDark: '#86574B',
    primarySoft: 'rgba(168,114,98,0.14)',
    onPrimary: '#F4EEE8',
    text: '#2a1f18',
    textMuted: '#75665c',
    textFaint: '#ad9e92',
    border: '#E2D5C9',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#EBE2DA', '#dec4b3', '#cba38c', '#A87262', '#86574B', '#603c33'],
  },
  dark: {
    bg: '#1A1614',
    surface: '#26201D',
    surfaceAlt: '#322B27',
    surfaceDark: '#0B0908',
    primary: '#B08472',
    primaryDark: '#A87262',
    primarySoft: 'rgba(201,154,138,0.18)',
    onPrimary: '#F2ECE6',
    text: '#E9E1D9',
    textMuted: '#a09287',
    textFaint: '#605650',
    border: '#3a322e',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#26201D', '#3d322c', '#5a4a42', '#A87262', '#C99A8A', '#e0b8a9'],
  },
};

// ─── 5. PLUM — grounded purple, dusty ──────────────────────────────────────
const plum: ThemeMeta = {
  key: 'plum',
  label: '플럼',
  light: {
    bg: '#EFEDE9',
    surface: '#E5E1DA',
    surfaceAlt: '#D9D3CA',
    surfaceDark: '#141114',
    primary: '#7568A0',
    primaryDark: '#5B4F85',
    primarySoft: 'rgba(117,104,160,0.14)',
    onPrimary: '#EFEDE9',
    text: '#251f2a',
    textMuted: '#6a6470',
    textFaint: '#a39ea9',
    border: '#DBD5CC',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#E5E1DA', '#cabfd5', '#a99bc0', '#7568A0', '#5B4F85', '#3e346b'],
  },
  dark: {
    bg: '#17151A',
    surface: '#211E25',
    surfaceAlt: '#2C2830',
    surfaceDark: '#0A0809',
    primary: '#8678B5',
    primaryDark: '#7568A0',
    primarySoft: 'rgba(157,143,203,0.18)',
    onPrimary: '#EDEAF0',
    text: '#E6E1EC',
    textMuted: '#988fa8',
    textFaint: '#5a5466',
    border: '#363242',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#211E25', '#3a3346', '#544b6b', '#7568A0', '#9D8FCB', '#beb2e0'],
  },
};

// ─── 6. AMBER — honey-bronze, warm sunlight ────────────────────────────────
const amber: ThemeMeta = {
  key: 'amber',
  label: '앰버',
  light: {
    bg: '#F4EFE5',
    surface: '#EBE3D2',
    surfaceAlt: '#DFD4BD',
    surfaceDark: '#181410',
    primary: '#B0825A',
    primaryDark: '#8C6644',
    primarySoft: 'rgba(176,130,90,0.14)',
    onPrimary: '#F4EFE5',
    text: '#2a2014',
    textMuted: '#76665a',
    textFaint: '#ada092',
    border: '#E0D5BD',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#EBE3D2', '#e1c799', '#d1a96b', '#B0825A', '#8C6644', '#65462a'],
  },
  dark: {
    bg: '#1A1612',
    surface: '#26201A',
    surfaceAlt: '#322B23',
    surfaceDark: '#0B0907',
    primary: '#B8906A',
    primaryDark: '#B0825A',
    primarySoft: 'rgba(212,168,126,0.18)',
    onPrimary: '#F2EDE4',
    text: '#E8E0D2',
    textMuted: '#a0907c',
    textFaint: '#5e544a',
    border: '#3a322a',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#26201A', '#3d3326', '#594631', '#B0825A', '#D4A87E', '#e8c9a3'],
  },
};

// ─── 7. FOREST — deep, rich, contemplative green ───────────────────────────
const forest: ThemeMeta = {
  key: 'forest',
  label: '포레스트',
  light: {
    bg: '#EEEFE9',
    surface: '#E3E5DC',
    surfaceAlt: '#D5D8CB',
    surfaceDark: '#10130E',
    primary: '#4A6F4F',
    primaryDark: '#36533A',
    primarySoft: 'rgba(74,111,79,0.14)',
    onPrimary: '#EEEFE9',
    text: '#1c2419',
    textMuted: '#5e6a5a',
    textFaint: '#969f92',
    border: '#D2D7C8',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#E3E5DC', '#b8c9b3', '#85a384', '#4A6F4F', '#36533A', '#1f3622'],
  },
  dark: {
    bg: '#131713',
    surface: '#1D231C',
    surfaceAlt: '#272E26',
    surfaceDark: '#070908',
    primary: '#6D9272',
    primaryDark: '#62856A',
    primarySoft: 'rgba(130,165,134,0.18)',
    onPrimary: '#EEEDEB',
    text: '#E0E5DD',
    textMuted: '#8e9890',
    textFaint: '#525a55',
    border: '#2f3530',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#1D231C', '#2c3a2d', '#445544', '#62856A', '#82A586', '#a8c2ac'],
  },
};

// ─── 8. CHARCOAL — pure greyscale, minimal ─────────────────────────────────
const charcoal: ThemeMeta = {
  key: 'charcoal',
  label: '차콜',
  light: {
    bg: '#EDECEA',
    surface: '#E2E1DE',
    surfaceAlt: '#D4D3D0',
    surfaceDark: '#0F0F0E',
    primary: '#5A5957',
    primaryDark: '#404040',
    primarySoft: 'rgba(90,89,87,0.14)',
    onPrimary: '#EDECEA',
    text: '#1c1c1b',
    textMuted: '#666664',
    textFaint: '#9e9e9c',
    border: '#D2D1CE',
    borderSoft: 'rgba(0,0,0,0.06)',
    danger: '#c25450',
    warning: '#c8a04a',
    heat: ['#E2E1DE', '#c5c4c1', '#a3a29f', '#5A5957', '#404040', '#26261f'],
  },
  dark: {
    bg: '#161614',
    surface: '#1F1F1D',
    surfaceAlt: '#2A2A28',
    surfaceDark: '#080806',
    primary: '#8E8D8A',
    primaryDark: '#7d7d7a',
    primarySoft: 'rgba(168,167,164,0.18)',
    onPrimary: '#EEEDEB',
    text: '#E8E6E2',
    textMuted: '#9d9c98',
    textFaint: '#58575b',
    border: '#34332f',
    borderSoft: 'rgba(255,255,255,0.06)',
    danger: '#e07672',
    warning: '#e0b765',
    heat: ['#1F1F1D', '#34332f', '#4d4d49', '#7d7d7a', '#A8A7A4', '#cccbc7'],
  },
};

// ─── Master record ─────────────────────────────────────────────────────────
export const THEMES: Record<ThemeKey, ThemeMeta> = {
  olive,
  sage,
  slate,
  clay,
  plum,
  amber,
  forest,
  charcoal,
};

// Ordered list for the picker (insertion order)
export const THEME_ORDER: ThemeKey[] = [
  'olive',
  'sage',
  'forest',
  'slate',
  'clay',
  'amber',
  'plum',
  'charcoal',
];

export const DEFAULT_THEME_KEY: ThemeKey = 'olive';
export const DEFAULT_THEME_MODE: ThemeMode = 'light';