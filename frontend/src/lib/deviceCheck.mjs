// Cihaz testi: telefonda kamera, barkod, ses, titreşim, bildirim, Bluetooth ve kurulum durumunu kontrol eden ekranın sonuç mantığı.
export const CHECKS = [
  ['camera', 'Kamera'], ['barcode', 'Barkod okuma'], ['sound', 'Ses'], ['vibrate', 'Titreşim'],
  ['notify', 'Telefon bildirimi'], ['bluetooth', 'Bluetooth yazıcı'], ['offline', 'Çevrimdışı açılış'], ['installed', 'Ana ekrana kurulum']
];
export const STATUS_LABELS = { pass: 'Çalışıyor', fail: 'Çalışmıyor', warn: 'Kısmen', skip: 'Desteklenmiyor', pending: 'Denenmedi' };

// Sonuçlar { anahtar: { status, note } }. Hiç sonuç yoksa "denenmedi".
export function summarize(results) {
  const counts = { pass: 0, fail: 0, warn: 0, skip: 0, pending: 0 };
  for (const [key] of CHECKS) counts[results?.[key]?.status || 'pending'] += 1;
  const done = CHECKS.length - counts.pending;
  return { ...counts, total: CHECKS.length, done, allDone: counts.pending === 0, healthy: counts.fail === 0 && counts.pending === 0 };
}

export function reportText(results, env = {}) {
  const lines = ['Veniux cihaz testi', 'Tarih: ' + (env.now || new Date().toISOString()), 'Sürüm: ' + (env.version || '?'), 'Cihaz: ' + String(env.userAgent || '?').slice(0, 160), ''];
  for (const [key, label] of CHECKS) {
    const r = results?.[key] || { status: 'pending' };
    lines.push(label + ': ' + STATUS_LABELS[r.status] + (r.note ? ' — ' + r.note : ''));
  }
  const s = summarize(results);
  lines.push('', `Özet: ${s.pass} çalışıyor, ${s.warn} kısmen, ${s.fail} çalışmıyor, ${s.skip} desteklenmiyor, ${s.pending} denenmedi.`);
  return lines.join('\n');
}

// Tarayıcı özelliklerinden "bu cihaz neyi destekliyor" ön tespiti (kullanıcı dokunmadan).
export function detect(env = {}) {
  return {
    camera: env.getUserMedia ? { status: 'pending' } : { status: 'skip', note: 'Tarayıcı kameraya erişemiyor (https gerekir).' },
    barcode: env.barcodeDetector ? { status: 'pending' } : { status: 'skip', note: 'Bu tarayıcı kamerayla barkod okumayı desteklemiyor; barkodu elle yazabilirsiniz.' },
    sound: env.audio ? { status: 'pending' } : { status: 'skip', note: 'Ses çalma yok.' },
    vibrate: env.vibrate ? { status: 'pending' } : { status: 'skip', note: env.ios ? 'iPhone titreşim API\'sini desteklemez.' : 'Titreşim desteklenmiyor.' },
    notify: env.push ? { status: 'pending' } : { status: 'skip', note: 'Bu ortamda telefon bildirimi yok (uygulama içi mi, tarayıcı mı?).' },
    bluetooth: env.bluetooth ? { status: 'pending' } : { status: 'skip', note: 'Web Bluetooth yok: Android Chrome/Edge gerekir (iPhone ve Android uygulamasının içi desteklemez).' },
    offline: env.serviceWorker ? { status: env.controlled ? 'pass' : 'warn', note: env.controlled ? 'Uygulama kabuğu önbellekte.' : 'Sayfayı bir kez yenileyin; sonra çevrimdışı açılır.' } : { status: 'skip', note: 'Service worker yok.' },
    installed: env.standalone ? { status: 'pass', note: 'Ana ekran uygulaması olarak açık.' } : { status: 'warn', note: 'Tarayıcı sekmesinde açık. Menüden "Ana ekrana ekle" ile kurun.' }
  };
}
