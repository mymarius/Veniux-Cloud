// Mobil mağaza uygulaması (kasa dışı personel ekranları) için saf mantık: raf etiketi kontrolü ve ürün listesi.
// Veriler yalnız bu cihazda (localStorage) tutulur; depolama kapalı veya bozuksa uygulama çalışmaya devam eder.

export function parsePrice(text) {
  const raw = String(text ?? '').replace(/[₺\sTLtl]/g, '');
  if (!raw || !/^[\d.,]+$/.test(raw)) return null;
  let normalized;
  if (raw.includes(',') && raw.includes('.')) normalized = raw.replace(/\./g, '').replace(',', '.');
  else if (raw.includes(',')) normalized = raw.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, '');
  else normalized = raw;
  if ((normalized.match(/\./g) || []).length > 1) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 && value <= 1e7 ? Math.round(value * 100) / 100 : null;
}

export const priceMatches = (shelf, system) => Math.abs(Math.round(Number(shelf) * 100) - Math.round(Number(system) * 100)) === 0;

export const dayKey = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

function read(storage, key, fallback) {
  try { const value = JSON.parse(storage.getItem(key)); return value && typeof value === 'object' ? value : fallback; } catch { return fallback; }
}
function write(storage, key, value) { try { storage.setItem(key, JSON.stringify(value)); } catch { /* depo dolu veya kapalı */ } }

// Etiket kontrolü: gün ve mağaza bazında doğru/hatalı sayısı ve hatalı etiketlerin listesi.
export function createLabelLog(storage, scope) {
  const key = day => `vx-label-check:${scope}:${day}`;
  const load = (day = dayKey()) => { const v = read(storage, key(day), null); return v && Number.isFinite(v.correct) && Array.isArray(v.wrong) ? v : { correct: 0, wrong: [] }; };
  return {
    load,
    record({ barcode, name, shelf, system, id = null }, now = new Date()) {
      const day = dayKey(now), state = load(day), ok = priceMatches(shelf, system);
      if (ok) state.correct += 1;
      else {
        state.wrong = state.wrong.filter(w => w.barcode !== barcode);
        state.wrong.unshift({ barcode, id, name, shelf: Number(shelf), system: Number(system), at: now.toISOString() });
        state.wrong = state.wrong.slice(0, 200);
      }
      write(storage, key(day), state);
      return { ok, ...state, total: state.correct + state.wrong.length };
    },
    clear(day = dayKey()) { try { storage.removeItem(key(day)); } catch { /* yok say */ } }
  };
}

// "Fiyat Gör" ürün listesi: aynı barkod bir kez, en çok 200 ürün.
export function createProductList(storage, scope) {
  const key = `vx-price-list:${scope}`;
  const load = () => { const v = read(storage, key, []); return Array.isArray(v) ? v.filter(i => i && typeof i.barcode === 'string') : []; };
  return {
    load,
    add(item) {
      if (!item || typeof item.barcode !== 'string' || !item.barcode) return load();
      const items = load().filter(i => i.barcode !== item.barcode);
      items.unshift({ barcode: item.barcode, id: item.id ?? null, name: String(item.name || item.barcode).slice(0, 200), price: Number(item.price) || 0 });
      const next = items.slice(0, 200); write(storage, key, next); return next;
    },
    remove(barcode) { const next = load().filter(i => i.barcode !== barcode); write(storage, key, next); return next; },
    clear() { write(storage, key, []); return []; }
  };
}

export const greeting = (now = new Date()) => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour < 6 ? 'İyi Geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi Günler' : 'İyi Akşamlar';
};

export const initials = name => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toLocaleUpperCase('tr-TR')).join('') || 'V';

export const ROLE_LABELS = { admin: 'Yönetici', manager: 'Müdür', cashier: 'Kasiyer', user: 'Personel', staff: 'Personel' };
export const roleLabel = role => ROLE_LABELS[role] || 'Mağaza Personeli';

// Etiket kontrollerinin sunucuya gönderimi: bağlantı yokken kayıtlar cihazda sıraya girer, gidene kadar silinmez.
// Kalıcı olarak reddedilen (4xx) kayıt sıradan çıkar; geçici hata (bağlantı, 5xx) kaydı korur.
export function createOutbox(storage, scope) {
  const key = `vx-label-outbox:${scope}`;
  const load = () => { const v = read(storage, key, []); return Array.isArray(v) ? v.filter(i => i && typeof i.id === 'string') : []; };
  return {
    load,
    add(item) { const list = load().filter(i => i.id !== item.id); list.push(item); write(storage, key, list.slice(-500)); },
    remove(id) { write(storage, key, load().filter(i => i.id !== id)); }
  };
}

export const isPermanentRejection = error => { const s = error?.response?.status; return Number.isInteger(s) && s >= 400 && s < 500 && s !== 408 && s !== 423 && s !== 429; };

// Sunucudaki özet tüm cihazları kapsar; gönderilmeyen kayıt kalmadıysa o gösterilir, kaldıysa bu cihazın yerel durumu.
export const chooseSummary = (local, server, pending) => (server && pending === 0 ? { correct: server.correct, wrong: server.wrong || [] } : local);

export async function flushOutbox(outbox, send) {
  let sent = 0;
  for (const item of outbox.load()) {
    try { await send(item); outbox.remove(item.id); sent += 1; }
    catch (error) { if (isPermanentRejection(error)) outbox.remove(item.id); else return { sent, stopped: true }; }
  }
  return { sent, stopped: false };
}
