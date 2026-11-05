// Appearance preferences: screen mode, accent palette, density and scan sounds.
// Stored per device in localStorage and applied to <html> as data attributes + CSS variables.

const STORAGE_KEY = 'veniux_appearance';
const EVENT = 'veniux:appearance-changed';
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// Each palette's 500 is the swatch shown in settings; 600 is the hover/primary-dark shade.
export const ACCENTS = [
  { id: 'ember', name: 'Veniux Kor', hex: '#f2711c', palette: ['#fff4ec', '#ffe6d5', '#ffc9a6', '#ffa56b', '#ff8a3d', '#f2711c', '#d9590c', '#b4470a', '#8f3a0e', '#74320f', '#3f1806'] },
  { id: 'veniux', name: 'Veniux', hex: '#2379ca', palette: ['#eaf3ff', '#dcecff', '#b8d7f5', '#88b8e5', '#4d94d4', '#2379ca', '#145eae', '#104e91', '#143e69', '#102c4b', '#0c1726'] },
  { id: 'blue', name: 'Kurumsal', hex: '#2563eb', palette: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554', '#0f1a3d'] },
  { id: 'emerald', name: 'Zümrüt', hex: '#059669', palette: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#059669', '#047857', '#065f46', '#064e3b', '#053d2e', '#022c22'] },
  {id:'rose',name:'Yakut',hex:'#be123c',palette:['#fff1f2','#ffe4e6','#fecdd3','#fda4af','#fb7185','#e11d48','#be123c','#9f1239','#881337','#701a35','#4c0519']},
  {id:'amber',name:'Bakır',hex:'#b45309',palette:['#fffbeb','#fef3c7','#fde68a','#fcd34d','#fbbf24','#d97706','#b45309','#92400e','#78350f','#5c2b0b','#451a03']},
  { id: 'violet', name: 'Teknoloji', hex: '#7c3aed', palette: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#3b1675', '#2e1065'] }
];

// Keep the old preference IDs readable while every workspace uses the same bundled typeface.
export const UI_FONT_FAMILY="'Veniux Manrope','Segoe UI',sans-serif";
export const FONTS=[{id:'geometric',name:'Veniux Manrope',family:UI_FONT_FAMILY},{id:'system',name:'Veniux Manrope',family:UI_FONT_FAMILY}];
export const DEFAULTS = { mode: 'dark', accent: 'ember', density: 'comfortable', sound: true, font:'geometric',textSize:'standard',corners:'soft',motion:'subtle' };

const valid = {
  mode: v => ['light', 'dark', 'system'].includes(v),
  accent: v => ACCENTS.some(a => a.id === v),
  density: v => ['comfortable', 'compact'].includes(v),
  font:v=>FONTS.some(f=>f.id===v),
  textSize:v=>['small','standard','large'].includes(v),
  corners:v=>['sharp','balanced','soft'].includes(v),
  motion:v=>['subtle','off'].includes(v),
  sound: v => typeof v === 'boolean'
};

export function readAppearance() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    // One-time pickup of the older per-setting keys.
    const legacySound = localStorage.getItem('veniux_sound_enabled');
    if (stored.sound === undefined && legacySound !== null) stored.sound = legacySound === 'true';
    const legacyDensity = localStorage.getItem('veniux_density');
    if (stored.density === undefined && legacyDensity) stored.density = legacyDensity;
  } catch { /* storage unavailable: defaults apply */ }
  const prefs = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) if (valid[key](stored[key])) prefs[key] = stored[key];
  return prefs;
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
export const resolveMode = mode => (mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode);

export function applyAppearance(prefs = readAppearance()) {
  const root = document.documentElement;
  root.dataset.design = 'veniux';
  const mode = resolveMode(prefs.mode);
  root.dataset.theme = mode;
  root.dataset.density = prefs.density;
  root.style.colorScheme = mode;
  root.dataset.textSize=prefs.textSize;root.dataset.corners=prefs.corners;root.dataset.motion=prefs.motion;
  root.style.setProperty('--font-sans',UI_FONT_FAMILY);
  root.style.setProperty('--font-display','var(--font-sans)');
  root.style.setProperty('--vx-radius',({sharp:'8px',balanced:'14px',soft:'22px'})[prefs.corners]||'22px');
  const accent = ACCENTS.find(a => a.id === prefs.accent) || ACCENTS[0];
  SHADES.forEach((shade, i) => root.style.setProperty(`--color-brand-${shade}`, accent.palette[i]));
  root.style.setProperty('--color-primary',accent.palette[6]);
  root.style.setProperty('--color-primary-hover',accent.palette[7]);
  root.style.setProperty('--color-primary-light',mode==='dark'?accent.palette[10]:accent.palette[0]);
}

export function saveAppearance(patch) {
  const next = { ...readAppearance() };
  for(const key of Object.keys(DEFAULTS))if(valid[key](patch[key]))next[key]=patch[key];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* applies for this session only */ }
  applyAppearance(next);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  return next;
}

export const isSoundEnabled = () => readAppearance().sound;

// Call once at startup: applies saved prefs and follows OS changes while mode is "system".
export function initAppearance() {
  applyAppearance();
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', () => { if (readAppearance().mode === 'system') applyAppearance(); });
  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) applyAppearance(); });
}

export function onAppearanceChange(listener) {
  const handler = e => listener(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

