// Hareket tercihi: Ayarlar > Hareket ve performans kapalıysa ya da sistem "hareketi azalt" diyorsa animasyon çalışmaz.
export function motionOn() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'off') return false;
  try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}
// Videodaki yumuşak çıkış eğrisi (framer-motion varsayılanına yakın).
export const EASE = 'cubic-bezier(.22,1,.36,1)';

// Sayfa geçişi ya da açılış sürerken içerik animasyonlarını bekletir (--vx-base gecikmesi tüm animasyonlara eklenir).
let holdTimer;
export function holdMotion(ms, base) {
  if (!motionOn()) return;
  const root = document.documentElement;
  root.dataset.intro = '1'; root.style.setProperty('--vx-base', base);
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { delete root.dataset.intro; root.style.removeProperty('--vx-base'); }, ms);
}
