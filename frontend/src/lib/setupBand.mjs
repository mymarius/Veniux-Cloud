// Kurulum bandı: ilerleme hesabı ve "Daha sonra" ertelemesi. Saf mantık; arayüzden bağımsız test edilir.
export const SNOOZE_DAYS = 7;

// steps: her adımın durumu ('reviewed' | 'skipped' | diğer). Gözden geçirilen ve sonraya bırakılan adımlar ilerlemeye sayılır.
export function setupProgress(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const done = list.filter(step => step === 'reviewed' || step === 'skipped').length;
  const total = list.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

// until: ertelemenin bittiği zaman damgası (ms) ya da null. Geçersiz değer "ertelenmemiş" sayılır.
export function bandHidden(until, now = Date.now()) {
  const value = Number(until);
  return Number.isFinite(value) && value > now;
}

export const snoozeUntil = (now = Date.now(), days = SNOOZE_DAYS) => now + days * 86400000;

export function shouldShowBand({ setup, role, path, until, now = Date.now() }) {
  if (path !== '/dashboard' || role !== 'admin') return false;
  if (!setup || setup.completed) return false;
  return !bandHidden(until, now);
}

export const bandKey = userId => `veniux_setup_band_until:${userId ?? 'anon'}`;
