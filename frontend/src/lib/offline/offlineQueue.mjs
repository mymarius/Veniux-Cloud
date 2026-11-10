// Çevrimdışı satış kuyruğu. Saf mantık: depolama bir "store" (get/put/getAll/delete) üzerinden gelir; tarayıcıda IndexedDB, testte bellek.
// Değişmez kurallar: bir satır yalnız sunucu "işlendi" dedikten sonra silinir; reddedilen satır kuyrukta kalır (kaybolmaz);
// sıra korunur; aynı satış (aynı kimlik) iki kez eklenmez. Kimlik, sunucuya giden Idempotency-Key ile aynıdır.
export class NetworkError extends Error {
  constructor(message = 'Ağ bağlantısı yok.') { super(message); this.name = 'NetworkError'; }
}

export function createOfflineQueue(store) {
  const sorted = list => [...list].sort((a, b) => (a.queued_at < b.queued_at ? -1 : a.queued_at > b.queued_at ? 1 : a.id < b.id ? -1 : 1));
  return {
    async enqueue(sale) {
      if (!sale || typeof sale.id !== 'string' || !sale.id || !sale.body || typeof sale.body !== 'object') throw new Error('Geçersiz çevrimdışı satış.');
      const existing = await store.get(sale.id);
      if (existing) return existing;
      const record = { ...sale, status: 'pending', attempts: 0, last_error: null, queued_at: sale.queued_at || sale.created_at || new Date().toISOString() };
      await store.put(record);
      return record;
    },
    async list() { return sorted(await store.getAll()); },
    async counts() {
      const all = await store.getAll();
      return { total: all.length, pending: all.filter(r => r.status === 'pending').length, conflict: all.filter(r => r.status === 'conflict').length };
    },
    async remove(id) { await store.delete(id); },
    async markFailed(id, message, { conflict = false } = {}) {
      const record = await store.get(id);
      if (!record) return null;
      const next = { ...record, status: conflict ? 'conflict' : 'pending', attempts: (record.attempts || 0) + 1, last_error: String(message || '').slice(0, 300) };
      await store.put(next);
      return next;
    },
    // send(kayıt) şunlardan birini döndürür: {status:'done'} | {status:'rejected', message}; ağ yoksa NetworkError fırlatır.
    // NetworkError gelince döngü durur (sıra korunur, kalanlar kuyrukta). 'rejected' satır işaretlenir, sıradakine geçilir.
    async flush(send) {
      const summary = { sent: 0, rejected: 0, stopped: false, remaining: 0 };
      for (const record of sorted(await store.getAll())) {
        if (record.status === 'conflict') continue;
        let result;
        try { result = await send(record); }
        catch (error) {
          if (error instanceof NetworkError) { summary.stopped = true; break; }
          await this.markFailed(record.id, error?.message || 'Gönderilemedi.');
          continue;
        }
        if (result?.status === 'done') { await store.delete(record.id); summary.sent++; }
        else { await this.markFailed(record.id, result?.message || 'Sunucu satışı kabul etmedi.', { conflict: true }); summary.rejected++; }
      }
      summary.remaining = (await store.getAll()).length;
      return summary;
    },
  };
}

// Ağ yok / sunucu geçici ulaşılamaz (yanıt yok, 502-504) → satış kuyrukta bekler. Diğer sunucu yanıtları (400-422) kabul edilmeme demektir.
export function isNetworkFailure(error) {
  if (!error || !error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}
// post: api.post benzeri. Satış kimliği Idempotency-Key olarak gider; yanıt kaybolursa aynı anahtarla tekrar gönderim güvenlidir.
export function createSender(post) {
  return async record => {
    try { await post('/scanner/sale', record.body, { headers: { 'Idempotency-Key': record.id } }); return { status: 'done' }; }
    catch (error) {
      if (isNetworkFailure(error)) throw new NetworkError();
      return { status: 'rejected', message: error.response?.data?.error || 'Sunucu satışı kabul etmedi.' };
    }
  };
}

export function memoryStore() {
  const map = new Map();
  return {
    async get(id) { return map.has(id) ? structuredClone(map.get(id)) : undefined; },
    async put(record) { map.set(record.id, structuredClone(record)); },
    async getAll() { return [...map.values()].map(v => structuredClone(v)); },
    async delete(id) { map.delete(id); },
  };
}
