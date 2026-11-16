// Hareket tercihi: Ayarlar > Hareket ve performans kapalıysa ya da sistem "hareketi azalt" diyorsa animasyon çalışmaz.
export function motionOn() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'off') return false;
  try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}
// Videodaki yumuşak çıkış eğrisi (framer-motion varsayılanına yakın).
export const EASE = 'cubic-bezier(.22,1,.36,1)';
