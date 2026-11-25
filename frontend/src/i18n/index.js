// Çeviri altyapısı. Kaynak dil Türkçe: t('Genel Bakış') çağrısında Türkçe metin anahtardır; seçili dilde karşılığı yoksa Türkçe gösterilir
// (eksik çeviri ekranı bozmaz). Parametreler {0}, {1}… ile verilir: t('{0} satır', n).
// Yeni dil: ./locales/<kod>.js dosyası ekleyip LOCALES'e yazmak yeterlidir.
import { useSyncExternalStore } from 'react';
import az from './locales/az.js';

export const LOCALES = { tr: {}, az };
export const LANGUAGES = [{ code: 'tr', name: 'Türkçe' }, { code: 'az', name: 'Azərbaycanca' }];
const KEY = 'veniux-lang';

let current = 'tr';
const listeners = new Set();

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const known = code => Object.prototype.hasOwnProperty.call(LOCALES, code);

// Açık seçim (cihazda saklanır) > işletmenin ana para birimi AZN ise Azerbaycanca > Türkçe.
export function resolveLanguage(explicit, currency) {
  if (explicit && known(explicit)) return explicit;
  return String(currency || '').toUpperCase() === 'AZN' ? 'az' : 'tr';
}

export function initLanguage(currency) {
  const next = resolveLanguage(read(), currency);
  if (next !== current) apply(next, false);
  else if (typeof document !== 'undefined') document.documentElement.lang = current;
}

function apply(code, persist) {
  current = known(code) ? code : 'tr';
  if (persist) { try { localStorage.setItem(KEY, current); } catch { /* depolama yok */ } }
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  listeners.forEach(l => l());
}

export const getLanguage = () => current;
export const subscribeLanguage = cb => { listeners.add(cb); return () => listeners.delete(cb); };
export const setLanguage = code => apply(code, true);

export function translate(language, text, params = []) {
  const table = LOCALES[language] || {};
  const raw = Object.prototype.hasOwnProperty.call(table, text) ? table[text] : text;
  return params.length ? String(raw).replace(/\{(\d+)\}/g, (m, i) => (params[i] === undefined ? m : String(params[i]))) : String(raw);
}

export const t = (text, ...params) => translate(current, text, params);

// Bileşenlerde: const t = useT(); dil değişince bileşen yeniden çizilir.
export function useLanguage() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => 'tr');
}
export function useT() {
  const lang = useLanguage();
  return (text, ...params) => translate(lang, text, params);
}

// Açılışta (giriş ekranı dahil) son bilinen tercih/para birimine göre dil.
try { initLanguage(JSON.parse(localStorage.getItem('user') || '{}').currency); } catch { /* depolama yok */ }
