// SAHTE e-Belge sağlayıcısı: gerçek entegratör anlaşması gelene kadar gönderme, numara serisi ve durum takibini
// uçtan uca denemek içindir. Hiçbir belge GİB'e gitmez; üretimde (NODE_ENV=production) kullanılamaz.
//
// Davranış alıcının vergi/kimlik numarasının (VKN/TCKN) son hanelerine göre belirlenir, böylece her senaryo elle denenebilir:
//   ...000  -> entegratör reddeder (rejected)
//   ...111  -> yanıt kaybolur ama belge ulaşmıştır (gönderme hata verir, durum sorgusu "accepted" döner)
//   ...222  -> yanıt kaybolur ve belge ulaşmamıştır (gönderme hata verir, durum sorgusu "not_found" döner)
//   diğer   -> kabul edilir (accepted)
// Mükellef sorgusu: son hane çift ise e-Fatura mükellefi, tek ise değil.
const received = new Map(); // uuid -> { number, state, receiver, at }

const receiverId = doc => String(doc?.receiver?.vkn || doc?.receiver?.tax_number || doc?.draft?.receiver?.vkn || '');
const scenario = doc => {
  const id = receiverId(doc);
  if (id.endsWith('000')) return 'reject';
  if (id.endsWith('111')) return 'lost-delivered';
  if (id.endsWith('222')) return 'lost-missing';
  return 'accept';
};

const mockProvider = {
  name: 'sahte',
  mock: true,
  test: async () => ({ ok: true }),
  taxpayer: async vkn => ({ Value: Number(String(vkn).slice(-1)) % 2 === 0 }),
  send: async doc => {
    if (!doc?.uuid || !doc?.number) throw Error('uuid ve numara gerekli');
    const kind = scenario(doc);
    if (kind === 'reject') {
      received.set(doc.uuid, { number: doc.number, state: 'rejected', at: Date.now() });
      return { state: 'rejected', detail: 'Sahte sağlayıcı: alıcı bilgisi reddedildi' };
    }
    if (kind === 'lost-missing') throw Error('Sahte sağlayıcı: zaman aşımı (belge ulaşmadı)');
    // Aynı UUID ikinci kez gelirse yeni kayıt oluşmaz: tekrar gönderim güvenli (idempotent)
    if (!received.has(doc.uuid)) received.set(doc.uuid, { number: doc.number, state: 'accepted', at: Date.now() });
    if (kind === 'lost-delivered') throw Error('Sahte sağlayıcı: zaman aşımı (belge ulaştı)');
    return { state: 'accepted', detail: 'Sahte sağlayıcı: kabul edildi ' + doc.number };
  },
  status: async uuid => {
    const item = received.get(uuid);
    if (!item) return { state: 'not_found' };
    return { state: item.state, detail: item.number };
  },
  // Yalnız testler için
  _reset: () => received.clear(),
  _received: () => new Map(received)
};

module.exports = mockProvider;
