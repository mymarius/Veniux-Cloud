// Token X Connect Cloud (kablosuz) ÖKC adaptörü.
// Kaynak: developer.tokeninc.com "Token X Connect Cloud – Geliştirici Dokümanı" (TR/EN), Kasım 2026'da okundu.
// İstek yolları ve yöntemleri Token'ın herkese açık Postman koleksiyonundan (documenter.getpostman.com/view/29891759/2sB34hEzUj):
//   POST /v1/auth/token (Basic), POST /v1/instant-basket, GET /v1/basket/{id}, GET /v1/fiscal-parameters (terminal-id, Bearer).
// Sunucu adresleri (koleksiyonda TEST_AUTH_URL, TEST_BASKET_URL değişkenleri) yayımlanmadı: Token geliştirici ekibi verir, ayar olarak alınır.
// Belgede bulutta iptal/iade isteği yok: bu adaptör iptal ve iadeyi cihaza göndermez, açıkça reddeder.
const crypto = require('crypto');

const KEYS = ['TOKENX_AUTH_URL', 'TOKENX_API_URL', 'TOKENX_CLIENT_ID', 'TOKENX_CLIENT_SECRET', 'TOKENX_TERMINAL_ID'];
function config(env = process.env) {
  if (KEYS.some(k => !env[k])) return null;
  for (const k of ['TOKENX_AUTH_URL', 'TOKENX_API_URL']) if (!/^https:\/\//.test(env[k]) && !(env.TOKENX_ALLOW_LOCAL_HTTP === '1' && /^http:\/\/127\.0\.0\.1:/.test(env[k]))) throw Error(k + ' HTTPS olmalı.');
  return { auth: env.TOKENX_AUTH_URL.replace(/\/$/, ''), api: env.TOKENX_API_URL.replace(/\/$/, ''), clientId: env.TOKENX_CLIENT_ID, secret: env.TOKENX_CLIENT_SECRET, terminal: env.TOKENX_TERMINAL_ID, addPath: env.TOKENX_PATH_ADD_INSTANT || '/v1/instant-basket', getPath: env.TOKENX_PATH_GET_BASKET || '/v1/basket/{basketID}', fiscalPath: env.TOKENX_PATH_FISCAL || '/v1/fiscal-parameters', callbackAuth: env.TOKENX_CALLBACK_AUTH || null };
}

// Belgedeki örnek: fiyat kuruş (tam sayı), miktar ×1000 (tam sayı), KDV taxPercent 1000/1800/2000 (oran ×100).
// Her kalem cihazdaki aynı KDV oranlı mali bölüme (sectionNo) bağlanır; bölümler mali parametrelerden gelir.
function toBasket(id, items, sections = { 0: 1, 100: 1, 1000: 1, 2000: 1 }) {
  if (!Array.isArray(items) || !items.length || items.length > 200) throw Error('Sepet kalemleri gerekli.');
  return {
    basketID: id,
    items: items.map(item => {
      const quantity = Math.round(Number(item.quantity) * 1000), price = Number(item.unit_price_cents), vat = Number(item.vat_rate);
      if (typeof item.name !== 'string' || !item.name.trim() || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(price) || price < 0 || !Number.isInteger(vat) || vat < 0 || vat > 100) throw Error('Sepet kalemi geçersiz.');
      const sectionNo = sections[vat * 100];
      if (!sectionNo) throw Error(`Cihazda %${vat} KDV oranlı bölüm tanımlı değil.`);
      return { name: item.name.trim().slice(0, 40), price, sectionNo, taxPercent: vat * 100, quantity };
    }),
  };
}

// BASKET_COMPLETED bildirimi: data.status 0 başarılı, -1 ödemeden vazgeçildi, 99 fiş iptali.
// Sepet sorgusu: tamamlanan sepette result.sale aynı biçimdedir (Postman "Completed Basket" örneği); açık sepette sale yoktur.
function parseResult(payload) {
  const data = payload?.data || payload?.result?.sale || payload?.result || payload;
  if (!data || typeof data !== 'object') return { status: 'unknown' };
  const receipt = { receipt_no: data.receiptNo ?? null, z_no: data.zNo ?? null, payments: Array.isArray(data.paymentItems) ? data.paymentItems.map(p => ({ type: p.type, amount_cents: p.amount })) : [] };
  if (payload?.operation === 'BASKET_COMPLETED' || data.receiptNo !== undefined) {
    if (Number(data.status) === 0 && Number(data.receiptNo) > 0) return { status: 'success', ...receipt };
    if ([-1, 99].includes(Number(data.status))) return { status: 'failed', reason: Number(data.status) === 99 ? 'Fiş iptal edildi' : 'Ödemeden vazgeçildi', ...receipt };
  }
  return { status: 'unknown' };
}

function client(cfg, fetchImpl = fetch) {
  let cached = null;
  async function token() {
    if (cached && cached.until > Date.now() + 60000) return cached.value;
    const basic = Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString('base64');
    const r = await fetchImpl(cfg.auth + '/v1/auth/token', { method: 'POST', headers: { Authorization: 'Basic ' + basic }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.result?.accessToken) throw Error('Token oturumu açılamadı.');
    cached = { value: body.result.accessToken, until: Date.now() + Number(body.result.expiresIn || 0) * 1000 };
    return cached.value;
  }
  const path = (template, basketId) => template.replace('{basketID}', encodeURIComponent(basketId));
  async function call(method, template, basketId, body) {
    const headers = { Authorization: 'Bearer ' + await token(), 'terminal-id': cfg.terminal };
    if (body) headers['Content-Type'] = 'application/json';
    const r = await fetchImpl(cfg.api + path(template, basketId), { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000), redirect: 'error' });
    return { ok: r.ok, body: await r.json().catch(() => ({})) };
  }
  return {
    addInstantBasket: (id, basket) => call('POST', cfg.addPath, id, basket),
    getBasket: id => call('GET', cfg.getPath, id),
    fiscal: () => call('GET', cfg.fiscalPath, ''),
  };
}

function adapter(cfg = config(), fetchImpl = fetch) {
  const api = client(cfg, fetchImpl);
  let sections = null;
  async function sectionMap() {
    if (sections) return sections;
    const r = await api.fiscal();
    const list = r.ok && Array.isArray(r.body?.result?.sections) ? r.body.result.sections : null;
    if (!list) throw Error('Cihazın mali parametreleri alınamadı.');
    sections = {};
    for (const s of list) if (Number(s.status) === 1 && sections[s.taxPercent] === undefined) sections[s.taxPercent] = s.sectionNo;
    return sections;
  }
  return {
    async execute({ id, action, amount_cents, items }) {
      if (action !== 'sale') return { status: 'failed', detail: 'Token bulut belgesinde iptal ve iade isteği yok. İptal ve iadeyi cihazdan yapın.' };
      let basket;
      try { basket = toBasket(id, items, await sectionMap()); } catch (error) { return { status: 'failed', detail: error.message }; }
      const total = basket.items.reduce((sum, i) => sum + Math.round(i.price * i.quantity / 1000), 0);
      if (total !== amount_cents) return { status: 'failed', detail: 'Sepet toplamı tahsilat tutarıyla aynı değil.' };
      const sent = await api.addInstantBasket(id, basket);
      // 1007: aynı basketID zaten gönderilmiş (tekrar). Ödeme cihazda müşteriyle yapılır; sonuç bildirim veya sorguyla gelir.
      if (sent.ok && Number(sent.body.status) === 0) return { status: 'unknown', detail: 'Sepet cihaza gönderildi, ödeme bekleniyor.' };
      if (Number(sent.body.status) === 1007) return { status: 'unknown', detail: 'Sepet daha önce gönderilmiş.' };
      if ([1104, 1106, 1100].includes(Number(sent.body.status))) return { status: 'failed', detail: { 1104: 'Cihaz anlık satış modunda değil.', 1106: 'Cihaz bulunamadı.', 1100: 'Cihazda açık bir sepet var.' }[Number(sent.body.status)] };
      return { status: 'unknown', detail: 'Cihaz yanıtı doğrulanamadı.' };
    },
    async status({ id }) {
      const r = await api.getBasket(id);
      if (!r.ok) return { status: 'unknown' };
      return parseResult(r.body);
    },
  };
}

// Bildirim (webhook) doğrulaması: belgede imza yok; Token ayarına bizim verdiğimiz paylaşılan gizli değer başlıkta beklenir.
function callbackAuthorized(header, cfg = config()) {
  if (!cfg?.callbackAuth || typeof header !== 'string') return false;
  const a = Buffer.from(header), b = Buffer.from(cfg.callbackAuth);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { config, toBasket, parseResult, client, adapter, callbackAuthorized };
