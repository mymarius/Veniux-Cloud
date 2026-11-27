// Online mağaza kartla ödeme (sanal POS). Sağlayıcı: iyzico "Ödeme Formu" (müşteri kart bilgisini iyzico'nun sayfasında girer;
// Veniux kart bilgisi görmez, saklamaz). İşletme kendi iyzico anahtarlarını girer; ödeme doğrudan işletmenin hesabına gider, Veniux komisyon almaz.
//
// Akış: sipariş oluşur (stok ayrılır) -> iyzico ödeme sayfası başlatılır -> müşteri öder -> iyzico geri çağırma adresine döner ->
// sonuç sunucudan sunucuya doğrulanır (tutar ve sipariş eşleşmeli) -> ödendiyse sipariş işletmeye bildirilir, başarısızsa/süresi dolduysa
// sipariş iptal edilip stok ve indirim kodu geri verilir. Ödenmiş siparişin iptalinde iade denenir; olmazsa işletmeye "elle iade" uyarısı verilir.
const crypto = require('crypto');
const db = require('../config/database');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const cents = v => Math.round(Number(v) * 100);
const money = c => (c / 100).toFixed(2);
const HOSTS = { live: 'https://api.iyzipay.com', sandbox: 'https://sandbox-api.iyzipay.com' };
const EXPIRE_MS = 30 * 60 * 1000;
// iyzico'ya ulaşılamadığı için sonucu bilinmeyen ödeme, bu süreden önce iptal edilmez (para alınmış olabilir).
const UNKNOWN_HOLD_MS = 24 * 3600 * 1000;
const stamp = (d = new Date()) => d.toISOString().slice(0, 19).replace('T', ' ');
const millis = value => Date.parse(String(value).replace(' ', 'T') + 'Z');

// ---------- Anahtarların saklanması (şifreli) ----------
function sealKey() {
  const { JWT_SECRET } = require('../middlewares/authMiddleware');
  return crypto.createHash('sha256').update('veniux-online-payment-v1\0' + JWT_SECRET).digest();
}
function seal(data, tenant) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', sealKey(), iv);
  cipher.setAAD(Buffer.from(String(tenant)));
  const value = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), value: value.toString('base64') });
}
function unseal(payload, tenant) {
  const box = JSON.parse(payload), d = crypto.createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(box.iv, 'base64'));
  d.setAAD(Buffer.from(String(tenant))); d.setAuthTag(Buffer.from(box.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(box.value, 'base64')), d.final()]).toString());
}
async function loadSettings(tenantId) {
  const row = (await db.query('SELECT * FROM online_payment_settings WHERE tenant_id=$1', [tenantId])).rows[0];
  if (!row) return null;
  try { return { ...row, keys: unseal(row.secrets, tenantId) }; } catch { return null; }
}
const tail = v => String(v || '').slice(-4);
async function getSettings(user) {
  const s = await loadSettings(user.tenantId);
  return { provider: 'iyzico', enabled: Boolean(s && Number(s.enabled)), sandbox: s ? Boolean(Number(s.sandbox)) : true, has_keys: Boolean(s), key_hint: s ? tail(s.keys.api_key) : '' };
}
const KEY = /^[A-Za-z0-9_.:-]{8,200}$/;
async function saveSettings(user, body = {}) {
  const have = await loadSettings(user.tenantId);
  const apiKey = body.api_key ? String(body.api_key).trim() : have && have.keys.api_key;
  const secret = body.secret_key ? String(body.secret_key).trim() : have && have.keys.secret_key;
  if (!apiKey || !secret) fail('API anahtarı ve gizli anahtar gerekli.', 422, 'NO_KEYS');
  if (!KEY.test(apiKey) || !KEY.test(secret)) fail('Anahtar biçimi geçersiz (boşluk ve özel karakter içermemeli).', 422, 'BAD_KEYS');
  const sandbox = body.sandbox === undefined ? (have ? Number(have.sandbox) : 1) : (body.sandbox ? 1 : 0);
  const enabled = body.enabled === undefined ? (have ? Number(have.enabled) : 0) : (body.enabled ? 1 : 0);
  const sealed = seal({ api_key: apiKey, secret_key: secret }, user.tenantId);
  if (have) await db.query('UPDATE online_payment_settings SET sandbox=$2,enabled=$3,secrets=$4,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1', [user.tenantId, sandbox, enabled, sealed]);
  else await db.query('INSERT INTO online_payment_settings (tenant_id,provider,sandbox,enabled,secrets) VALUES ($1,$2,$3,$4,$5)', [user.tenantId, 'iyzico', sandbox, enabled, sealed]);
  return getSettings(user);
}
async function removeSettings(user) { await db.query('DELETE FROM online_payment_settings WHERE tenant_id=$1', [user.tenantId]); return getSettings(user); }
async function cardEnabled(tenantId) { const s = await loadSettings(tenantId); return Boolean(s && Number(s.enabled)); }

// ---------- iyzico istemcisi ----------
// Test edilebilsin diye taşıma katmanı değiştirilebilir.
const transport = { post: (url, headers, body) => fetch(url, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(15000) }).then(async r => ({ status: r.status, json: await r.json().catch(() => ({})) })) };
async function iyzico(settings, path, payload) {
  const body = JSON.stringify(payload), random = Date.now() + String(crypto.randomInt(100000, 999999));
  const signature = crypto.createHmac('sha256', settings.keys.secret_key).update(random + path + body).digest('hex');
  const auth = 'IYZWSv2 ' + Buffer.from(`apiKey:${settings.keys.api_key}&randomKey:${random}&signature:${signature}`).toString('base64');
  const host = Number(settings.sandbox) ? HOSTS.sandbox : HOSTS.live;
  const res = await transport.post(host + path, { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: auth, 'x-iyzi-rnd': random }, body);
  return res.json || {};
}
// iyzico yanıt imzası (belge: "İmza yanıtının doğrulanması"): alanlar ':' ile birleştirilir, HMAC-SHA256(gizli anahtar), onaltılık. Fiyatlarda sondaki sıfırlar atılır.
// Alan sırası gerçek sandbox yanıtıyla DOĞRULANMADI: bu yüzden yalnız "gölge" denetimdir, sonuç sipariş notuna yazılır, ödemeyi ASLA engellemez.
const priceText = v => (v === undefined || v === null ? '' : String(v).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
const DETAIL_SIGNATURE_FIELDS = ['paymentStatus', 'paymentId', 'currency', 'basketId', 'conversationId', 'paidPrice', 'price', 'token'];
function detailSignature(secret, res) {
  const parts = DETAIL_SIGNATURE_FIELDS.map(key => (key === 'paidPrice' || key === 'price' ? priceText(res[key]) : (res[key] === undefined || res[key] === null ? '' : String(res[key]))));
  return { parts, expected: crypto.createHmac('sha256', secret).update(parts.join(':')).digest('hex') };
}
// Sepet kalemleri toplamı ödenecek tutara eşit olmalı: indirim kalemlere orantılı dağıtılır, kargo ayrı kalem olur.
function basketOf(order, items, discountC, shippingC) {
  const lines = items.map(i => ({ id: String(i.product_id), name: String(i.name).slice(0, 100), c: cents(i.line_total) }));
  const sub = lines.reduce((s, l) => s + l.c, 0);
  let left = Math.min(discountC, sub);
  lines.forEach((l, idx) => { const share = idx === lines.length - 1 ? left : Math.min(left, Math.floor(discountC * l.c / (sub || 1))); l.c -= share; left -= share; });
  const out = lines.map(l => ({ id: l.id, name: l.name, category1: 'Ürün', itemType: 'PHYSICAL', price: money(l.c) }));
  if (shippingC > 0) out.push({ id: 'kargo', name: 'Kargo', category1: 'Kargo', itemType: 'PHYSICAL', price: money(shippingC) });
  return out;
}

// ---------- Ödemeyi başlat / tamamla ----------
async function start({ store, order, items, customer, discountC, shippingC, origin, ip }) {
  const settings = await loadSettings(Number(store.tenant_id));
  if (!settings || !Number(settings.enabled)) fail('Kartla ödeme bu mağazada kapalı.', 409, 'CARD_DISABLED');
  const totalC = cents(order.total);
  const [first, ...rest] = String(customer.name).split(' ');
  const callbackUrl = `${origin}/api/public/shop/${store.slug}/payment/callback`;
  const request = {
    locale: 'tr', conversationId: order.number, price: money(totalC), paidPrice: money(totalC), currency: 'TRY', basketId: order.number, paymentGroup: 'PRODUCT', callbackUrl,
    buyer: { id: 'M' + order.number, name: first || 'Müşteri', surname: rest.join(' ') || first || 'Müşteri', identityNumber: '11111111111', email: customer.email, gsmNumber: customer.phone, registrationAddress: customer.address || 'Mağazadan teslim', ip: ip || '127.0.0.1', city: customer.city || 'Istanbul', country: 'Turkey' },
    shippingAddress: { contactName: customer.name, city: customer.city || 'Istanbul', country: 'Turkey', address: customer.address || 'Mağazadan teslim' },
    billingAddress: { contactName: customer.name, city: customer.city || 'Istanbul', country: 'Turkey', address: customer.address || 'Mağazadan teslim' },
    basketItems: basketOf(order, items, discountC, shippingC)
  };
  const res = await iyzico(settings, '/payment/iyzipos/checkoutform/initialize/auth/ecom', request);
  if (res.status !== 'success' || !res.token || !/^https:\/\//.test(String(res.paymentPageUrl || ''))) {
    const e = new Error('Ödeme sayfası başlatılamadı. Lütfen başka bir ödeme yöntemi deneyin.'); e.status = 502; e.code = 'PAYMENT_UNAVAILABLE'; e.detail = res.errorMessage || null; throw e;
  }
  await db.query('DELETE FROM online_payments WHERE order_id=$1 AND tenant_id=$2', [Number(order.id), Number(store.tenant_id)]);
  await db.query('INSERT INTO online_payments (order_id,tenant_id,provider,token,status,amount,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [Number(order.id), Number(store.tenant_id), 'iyzico', res.token, 'pending', fromCents(totalC), stamp()]);
  return { url: res.paymentPageUrl };
}
const fromCents = c => Math.round(c) / 100;

async function shadowSignature(settings, tenantId, order, res) {
  try {
    if (!res || typeof res.signature !== 'string') return;
    const { parts, expected } = detailSignature(settings.keys.secret_key, res);
    const same = expected.toLowerCase() === res.signature.toLowerCase();
    const note = same ? 'iyzico yanıt imzası: uyumlu' : 'iyzico yanıt imzası: UYUMSUZ (ödeme etkilenmedi) alanlar=' + parts.join(':') + ' gelen=' + res.signature.slice(0, 64);
    await db.query('INSERT INTO online_order_events (tenant_id,order_id,from_status,to_status,note) VALUES ($1,$2,$3,$3,$4)', [tenantId, Number(order.id), order.status, note.slice(0, 500)]);
  } catch { /* gölge denetim ödemeyi etkilemez */ }
}

// Geri çağırma: iyzico müşteriyi token ile geri gönderir. Sonuç ASLA bu istekteki bilgiye göre değil, sunucudan sunucuya sorguyla belirlenir.
// Aynı ödeme için sorgular (liste + özet + sağlayıcı dönüşü) çakışabilir: sonucu yalnız "beklemede" kaydı ilk değiştiren işlem yazar;
// not, bildirim, iade ve iptal yalnız onda çalışır. Diğerleri kayıtlı sonucu döndürür.
async function claim(orderId, status, ref, error) {
  const done = await db.query("UPDATE online_payments SET status=$2,provider_ref=COALESCE($3,provider_ref),error=$4,paid_at=$5 WHERE order_id=$1 AND status='pending'", [orderId, status, ref, error, status === 'paid' ? stamp() : null]);
  return done.rowCount === 1;
}
const current = async orderId => (await db.query('SELECT status FROM online_payments WHERE order_id=$1', [orderId])).rows[0]?.status || 'pending';

async function complete(token) {
  const store = require('./onlineStoreService');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(token)) fail('Geçersiz ödeme bilgisi.', 400, 'BAD_TOKEN');
  const pay = (await db.query('SELECT * FROM online_payments WHERE token=$1', [token])).rows[0];
  if (!pay) fail('Ödeme kaydı bulunamadı.', 404, 'NO_PAYMENT');
  const tenantId = Number(pay.tenant_id), orderId = Number(pay.order_id);
  const order = (await db.query('SELECT * FROM online_orders WHERE id=$1 AND tenant_id=$2', [orderId, tenantId])).rows[0];
  const settings = await loadSettings(tenantId);
  if (pay.status !== 'pending') return { code: order.public_code, status: pay.status };
  let ok = false, ref = null, why = null, detail = null;
  try {
    const res = await iyzico(settings, '/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'tr', conversationId: order.number, token });
    ok = res.status === 'success' && res.paymentStatus === 'SUCCESS' && cents(res.paidPrice) === cents(pay.amount) && String(res.basketId) === String(store.codeOf(order.number));
    ref = res.paymentId ? String(res.paymentId) : null;
    detail = res;
    if (!ok) why = String(res.errorMessage || res.paymentStatus || 'Ödeme onaylanmadı').slice(0, 200);
  } catch { why = 'Ödeme sonucu doğrulanamadı.'; ok = null; }
  // Doğrulama hatasında (ağ) sonuç belirsizdir: ödeme "beklemede" kalır, müşteri sipariş sayfasından tekrar sorgular, süre dolunca iptal edilir.
  if (ok === null) return { code: order.public_code, status: 'pending' };
  if (!(await claim(orderId, ok ? 'paid' : 'failed', ref, ok ? null : why))) return { code: order.public_code, status: await current(orderId) };
  await shadowSignature(settings, tenantId, order, detail);
  if (ok) {
    if (order.status === 'cancelled') {
      // Süresi dolup iptal edilmiş siparişe para geldi: iade denenir.
      await refund(tenantId, orderId);
      return { code: order.public_code, status: 'cancelled' };
    }
    await db.query("INSERT INTO online_order_events (tenant_id,order_id,from_status,to_status,note) VALUES ($1,$2,$3,$3,$4)", [tenantId, orderId, order.status, 'Kartla ödeme alındı']);
    store.announcePaid(tenantId, orderId).catch(() => {});
    return { code: order.public_code, status: 'paid' };
  }
  await store.systemCancel(tenantId, orderId, 'Ödeme alınamadı');
  return { code: order.public_code, status: 'failed' };
}

// Süresi dolan bekleyen ödemeler iptal edilir (stok serbest kalır). Liste/özet çağrılarında ve zamanlayıcıyla çalışır.
async function expirePending(tenantId) {
  const store = require('./onlineStoreService');
  const cutoff = stamp(new Date(Date.now() - EXPIRE_MS));
  const rows = (await db.query(`SELECT order_id,tenant_id,token,created_at FROM online_payments WHERE status='pending' AND created_at<$1${tenantId ? ' AND tenant_id=$2' : ''} ORDER BY created_at LIMIT 50`, tenantId ? [cutoff, tenantId] : [cutoff])).rows;
  const holdCutoff = stamp(new Date(Date.now() - UNKNOWN_HOLD_MS));
  let n = 0;
  for (const r of rows) {
    // Müşteri ödemeyi yapıp tarayıcıyı kapatmış olabilir (geri çağırma hiç gelmez): iptal etmeden önce iyzico'ya sorulur.
    let verdict; try { verdict = await complete(r.token); } catch { verdict = { status: 'pending' }; }
    if (verdict.status === 'paid') continue; // para alınmış: sipariş ödenmiş olur, iptal edilmez
    if (verdict.status === 'failed' || verdict.status === 'cancelled') { n++; continue; }
    if (String(r.created_at) >= holdCutoff) continue; // sonuç bilinmiyor: 24 saate kadar bekletilir
    await db.query("UPDATE online_payments SET status='expired' WHERE order_id=$1 AND status='pending'", [Number(r.order_id)]);
    if (await store.systemCancel(Number(r.tenant_id), Number(r.order_id), 'Ödeme süresi doldu')) n++;
  }
  return n;
}

// Ödenmiş siparişin iadesi (iyzico iptal). Başarısızsa işletmeye "elle iade" bilgisi verilir.
async function refund(tenantId, orderId) {
  const pay = (await db.query('SELECT * FROM online_payments WHERE order_id=$1 AND tenant_id=$2', [orderId, tenantId])).rows[0];
  if (!pay || pay.status !== 'paid' || pay.refund_state === 'done') return pay ? pay.refund_state || null : null;
  let state = 'manual';
  try {
    const settings = await loadSettings(tenantId);
    const res = await iyzico(settings, '/payment/cancel', { locale: 'tr', conversationId: 'iade-' + orderId, paymentId: pay.provider_ref, ip: '127.0.0.1' });
    if (res.status === 'success') state = 'done';
    else {
      // İptal yalnız gün sonundan önce mümkündür (iyzico belgesi, hata 10223 REQUIRES_DAY_END); sonrası için paymentId ile iade (V2).
      const second = await iyzico(settings, '/v2/payment/refund', { locale: 'tr', conversationId: 'iade-' + orderId, paymentId: pay.provider_ref, price: money(cents(pay.amount)), ip: '127.0.0.1' });
      if (second.status === 'success') state = 'done';
    }
  } catch { /* elle iade */ }
  await db.query('UPDATE online_payments SET refund_state=$2 WHERE order_id=$1', [orderId, state]);
  return state;
}
async function statusFor(tenantId, orderIds) {
  const out = new Map();
  if (!orderIds.length) return out;
  const rows = (await db.query(`SELECT order_id,status,refund_state FROM online_payments WHERE tenant_id=$1 AND order_id IN (${orderIds.map((_, i) => '$' + (i + 2)).join(',')})`, [tenantId, ...orderIds])).rows;
  for (const r of rows) out.set(Number(r.order_id), { status: r.status, refund_state: r.refund_state || null });
  return out;
}

module.exports = { detailSignature, getSettings, saveSettings, removeSettings, cardEnabled, start, complete, expirePending, refund, statusFor, transport, basketOf, EXPIRE_MS };
