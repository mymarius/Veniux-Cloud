// Tanılama ekranı için saf yardımcılar. Ölçülemeyen ("unavailable") durum başarısızlık sayılmaz.
export const STATUS_META = {
  ok: { label: 'Sağlam', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  warn: { label: 'Uyarı', tone: 'text-amber-800 bg-amber-50 border-amber-200' },
  fail: { label: 'Hata', tone: 'text-red-700 bg-red-50 border-red-200' },
  timeout: { label: 'Zaman aşımı', tone: 'text-red-700 bg-red-50 border-red-200' },
  unavailable: { label: 'Ölçülemedi', tone: 'text-slate-600 bg-slate-100 border-slate-200' },
  cancelled: { label: 'İptal', tone: 'text-slate-600 bg-slate-100 border-slate-200' },
  skipped: { label: 'Atlandı', tone: 'text-slate-600 bg-slate-100 border-slate-200' }
};
const STATUSES = Object.keys(STATUS_META);

export function summarize(results) {
  const count = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const r of results) if (count[r.status] !== undefined) count[r.status]++;
  const level = count.fail || count.timeout ? 'fail' : count.warn ? 'warn' : 'ok';
  return { count, level, total: results.length };
}

// Masaüstü, sunucu ve ekran (tarayıcı) sonuçlarını tek taramada birleştirir; kimlik çakışırsa ilki kalır.
export function mergeScans(parts, now = new Date()) {
  const seen = new Set(), results = [];
  for (const part of parts) for (const r of part?.results || []) if (!seen.has(r.id)) { seen.add(r.id); results.push(r); }
  return { id: 'merged-' + now.getTime().toString(36), at: now.toISOString(), results, ...summarize(results) };
}

// Çevrimdışı kuyruk sayacından sonuç. counts: { total, pending, conflict }; null = okunamadı.
export function offlineQueueResult(counts) {
  if (!counts) return { id: 'app.offline-queue', group: 'Ağ ve bulut', name: 'Çevrimdışı kuyruk (bu cihaz)', status: 'unavailable', summary: 'Kuyruk bu tarayıcı/depoda okunamadı.', ms: 0 };
  const status = counts.conflict ? 'warn' : counts.pending > 20 ? 'warn' : 'ok';
  return { id: 'app.offline-queue', group: 'Ağ ve bulut', name: 'Çevrimdışı kuyruk (bu cihaz)', status, summary: `${counts.pending} satış gönderilmeyi bekliyor · ${counts.conflict} çakışma`, data: counts, ms: 0, advice: status === 'ok' ? undefined : 'İnternet bağlantısını kontrol edin; bekleyen satışlar bağlantı gelince gönderilir. Çakışmaları Ayarlar › Çevrimdışı çakışmalar bölümünden inceleyin.' };
}

// Barkod okuyucu testi (klavye benzeri giriş): kullanıcı okutur; sınıflandırma lib/scannerProbe.classifyScan sonucudur.
export function barcodeResult(probe, timedOut) {
  const base = { id: 'dev.barcode', group: 'Cihazlar', name: 'Barkod okuyucu (klavye benzeri)', ms: 0 };
  if (timedOut || !probe || probe.kind === 'short') return { ...base, status: 'warn', summary: 'Süre içinde geçerli bir barkod okutulmadı: algılanmadı.', advice: 'Okuyucunun takılı ve Enter/sonek gönderecek şekilde ayarlı olduğunu kontrol edin.' };
  if (probe.kind === 'scanner') return { ...base, status: 'ok', summary: 'Okuyucu algılandı (tuş arası ort. ' + probe.average + ' ms).', data: { avgMs: probe.average } };
  return { ...base, status: 'warn', summary: 'Giriş okuyucu gibi değil, elle yazılmış görünüyor (ort. ' + probe.average + ' ms).', advice: 'Barkodu okuyucuyla okutup yeniden deneyin.' };
}

// Destek paketine konacak ekran özeti (kişisel veri ayıklaması masaüstü tarafında ayrıca yapılır).
export function exportPayload(scan, server) {
  return { scan, extra: { server: server ? { at: server.at, server: server.server } : null } };
}
