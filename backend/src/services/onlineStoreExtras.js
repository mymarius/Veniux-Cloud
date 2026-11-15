// Online mağaza: indirim kodları, kargo ücret kuralları ve kargo takip bilgisi.
// Tutarlar kuruş cinsinde tam sayıyla hesaplanır. Fiyat hesabı hem teklif ucunda (sepet özeti) hem sipariş oluştururken aynı fonksiyonla yapılır.
const db = require('../config/database');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const round = (v, d = 2) => Math.round(Number(v) * 10 ** d) / 10 ** d;
const cents = v => Math.round(Number(v) * 100);
const text = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

const PROVINCES = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop', 'Sivas', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'];
// Türkçe büyük/küçük harf ve aksan farkını yok sayan karşılaştırma anahtarı ("İstanbul" = "istanbul" = "ISTANBUL").
const key = value => String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
const PROVINCE_KEYS = new Map(PROVINCES.map(p => [key(p), p]));
const provinceOf = value => PROVINCE_KEYS.get(key(value)) || null;

// ---------- İndirim kodları ----------
const KINDS = ['percent', 'amount', 'free_shipping'];
const normCode = value => String(value || '').trim().toUpperCase();
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,19}$/;
const stamp = value => (value ? String(value).replace('T', ' ').slice(0, 19) : null);
function shapeCode(r) {
  return { id: Number(r.id), code: r.code, kind: r.kind, value: round(r.value), min_order: round(r.min_order), max_uses: r.max_uses == null ? null : Number(r.max_uses), used_count: Number(r.used_count), starts_at: r.starts_at || null, ends_at: r.ends_at || null, active: Boolean(Number(r.active)) };
}
async function listCodes(user) {
  return { items: (await db.query('SELECT * FROM online_discount_codes WHERE tenant_id=$1 ORDER BY id DESC LIMIT 200', [user.tenantId])).rows.map(shapeCode) };
}
function readCode(body, current) {
  const code = body.code === undefined ? current && current.code : normCode(body.code);
  if (!CODE_RE.test(code || '')) fail('Kod 3-20 karakter olmalı; yalnız harf, rakam, tire ve alt çizgi.');
  const kind = body.kind === undefined ? current && current.kind : body.kind;
  if (!KINDS.includes(kind)) fail('İndirim türü geçersiz.');
  let value = body.value === undefined ? Number(current ? current.value : 0) : Number(body.value);
  if (kind === 'free_shipping') value = 0;
  else if (!Number.isFinite(value) || value <= 0) fail('İndirim değeri 0\'dan büyük olmalı.');
  if (kind === 'percent' && value > 100) fail('Yüzde indirim en çok 100 olabilir.');
  if (kind === 'amount' && value > 1000000) fail('İndirim tutarı çok büyük.');
  const minOrder = body.min_order === undefined ? Number(current ? current.min_order : 0) : Number(body.min_order || 0);
  if (!Number.isFinite(minOrder) || minOrder < 0 || minOrder > 1000000) fail('Minimum sepet tutarı geçersiz.');
  let maxUses = body.max_uses === undefined ? (current && current.max_uses != null ? Number(current.max_uses) : null) : (body.max_uses === null || body.max_uses === '' ? null : Number(body.max_uses));
  if (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 1000000)) fail('Kullanım sınırı geçersiz.');
  const starts = body.starts_at === undefined ? (current && current.starts_at) || null : stamp(body.starts_at);
  const ends = body.ends_at === undefined ? (current && current.ends_at) || null : stamp(body.ends_at);
  if (starts && ends && starts > ends) fail('Bitiş tarihi başlangıçtan önce olamaz.');
  const active = body.active === undefined ? (current ? Number(current.active) : 1) : (body.active ? 1 : 0);
  return { code, kind, value: round(value), minOrder: round(minOrder), maxUses, starts, ends, active };
}
async function saveCode(user, id, body = {}) {
  const current = id ? (await db.query('SELECT * FROM online_discount_codes WHERE id=$1 AND tenant_id=$2', [Number(id), user.tenantId])).rows[0] : null;
  if (id && !current) fail('Kod bulunamadı.', 404);
  const c = readCode(body, current);
  const clash = (await db.query('SELECT id FROM online_discount_codes WHERE tenant_id=$1 AND code=$2', [user.tenantId, c.code])).rows[0];
  if (clash && (!current || Number(clash.id) !== Number(current.id))) fail('Bu kod zaten tanımlı.', 409, 'CODE_TAKEN');
  if (current) await db.query('UPDATE online_discount_codes SET code=$3,kind=$4,value=$5,min_order=$6,max_uses=$7,starts_at=$8,ends_at=$9,active=$10 WHERE id=$1 AND tenant_id=$2', [current.id, user.tenantId, c.code, c.kind, c.value, c.minOrder, c.maxUses, c.starts, c.ends, c.active]);
  else await db.query('INSERT INTO online_discount_codes (tenant_id,code,kind,value,min_order,max_uses,starts_at,ends_at,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [user.tenantId, c.code, c.kind, c.value, c.minOrder, c.maxUses, c.starts, c.ends, c.active]);
  return listCodes(user);
}
async function deleteCode(user, id) {
  const row = (await db.query('SELECT id FROM online_discount_codes WHERE id=$1 AND tenant_id=$2', [Number(id), user.tenantId])).rows[0];
  if (!row) fail('Kod bulunamadı.', 404);
  await db.query('DELETE FROM online_discount_codes WHERE id=$1 AND tenant_id=$2', [row.id, user.tenantId]);
  return listCodes(user);
}

// ---------- Kargo ücret kuralları ----------
// Kural: ad, şehirler ("*" = tümü ya da virgülle ayrılmış il adları), ücret, ücretsiz eşik. Sırayla bakılır, ilk eşleşen kazanır.
function readCities(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const list = raw.map(v => String(v).trim()).filter(Boolean);
  if (!list.length) fail('En az bir il yazın ya da tüm Türkiye için * girin.');
  if (list.includes('*')) return '*';
  const out = [];
  for (const name of list) { const p = provinceOf(name); if (!p) fail(`"${name}" geçerli bir il adı değil.`); if (!out.includes(p)) out.push(p); }
  return out.join(',');
}
function shapeRule(r) { return { id: Number(r.id), name: r.name, cities: r.cities === '*' ? ['*'] : r.cities.split(','), fee: round(r.fee), free_over: r.free_over == null ? null : round(r.free_over), position: Number(r.position), active: Boolean(Number(r.active)) }; }
async function listRules(user) {
  return { items: (await db.query('SELECT * FROM online_shipping_rules WHERE tenant_id=$1 ORDER BY position,id', [user.tenantId])).rows.map(shapeRule), provinces: PROVINCES };
}
async function saveRule(user, id, body = {}) {
  const current = id ? (await db.query('SELECT * FROM online_shipping_rules WHERE id=$1 AND tenant_id=$2', [Number(id), user.tenantId])).rows[0] : null;
  if (id && !current) fail('Kural bulunamadı.', 404);
  const name = body.name === undefined ? current && current.name : text(body.name, 60);
  if (!name) fail('Kural adı yazın.');
  const cities = body.cities === undefined ? current.cities : readCities(body.cities);
  const fee = body.fee === undefined ? Number(current ? current.fee : 0) : Number(body.fee);
  if (!Number.isFinite(fee) || fee < 0 || fee > 100000) fail('Kargo ücreti geçersiz.');
  const freeOver = body.free_over === undefined ? (current && current.free_over != null ? Number(current.free_over) : null) : (body.free_over === null || body.free_over === '' ? null : Number(body.free_over));
  if (freeOver !== null && (!Number.isFinite(freeOver) || freeOver < 0 || freeOver > 10000000)) fail('Ücretsiz kargo eşiği geçersiz.');
  const position = body.position === undefined ? Number(current ? current.position : 0) : Math.max(0, Math.min(1000, Math.trunc(Number(body.position) || 0)));
  const active = body.active === undefined ? (current ? Number(current.active) : 1) : (body.active ? 1 : 0);
  const count = Number((await db.query('SELECT COUNT(*) AS n FROM online_shipping_rules WHERE tenant_id=$1', [user.tenantId])).rows[0].n);
  if (!current && count >= 50) fail('En çok 50 kargo kuralı tanımlanabilir.');
  if (current) await db.query('UPDATE online_shipping_rules SET name=$3,cities=$4,fee=$5,free_over=$6,position=$7,active=$8 WHERE id=$1 AND tenant_id=$2', [current.id, user.tenantId, name, cities, round(fee), freeOver, position, active]);
  else await db.query('INSERT INTO online_shipping_rules (tenant_id,name,cities,fee,free_over,position,active) VALUES ($1,$2,$3,$4,$5,$6,$7)', [user.tenantId, name, cities, round(fee), freeOver, position || count, active]);
  return listRules(user);
}
async function deleteRule(user, id) {
  const row = (await db.query('SELECT id FROM online_shipping_rules WHERE id=$1 AND tenant_id=$2', [Number(id), user.tenantId])).rows[0];
  if (!row) fail('Kural bulunamadı.', 404);
  await db.query('DELETE FROM online_shipping_rules WHERE id=$1 AND tenant_id=$2', [row.id, user.tenantId]);
  return listRules(user);
}

// ---------- Fiyat hesabı (teklif ve sipariş için ortak) ----------
// subtotalC: kalem toplamı (kuruş). Dönüş: kuruş cinsinden ara toplam, indirim, kargo, toplam; kullanılan kod ve kural.
async function priceCart(runner, store, { subtotalC, delivery, cityInput, codeInput, lenientCity = false }) {
  const tenantId = Number(store.tenant_id);
  const rules = (await runner.query('SELECT * FROM online_shipping_rules WHERE tenant_id=$1 AND active=1 ORDER BY position,id', [tenantId])).rows;
  let city = null;
  if (delivery === 'delivery') {
    if (cityInput) { city = provinceOf(cityInput); if (!city) fail('İl seçimi geçersiz.', 400, 'BAD_CITY'); }
    else if (rules.length && !lenientCity) fail('Teslimat ili seçin.', 400, 'CITY_REQUIRED');
  }
  // İndirim kodu
  let discountC = 0, freeShipping = false, code = null;
  const entered = normCode(codeInput);
  if (entered) {
    if (!CODE_RE.test(entered)) fail('İndirim kodu geçersiz.', 422, 'BAD_CODE');
    const row = (await runner.query('SELECT * FROM online_discount_codes WHERE tenant_id=$1 AND code=$2', [tenantId, entered])).rows[0];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!row || !Number(row.active)) fail('İndirim kodu geçersiz.', 422, 'BAD_CODE');
    if (row.starts_at && String(row.starts_at) > now) fail('Bu indirim kodu henüz geçerli değil.', 422, 'CODE_NOT_STARTED');
    if (row.ends_at && String(row.ends_at) < now) fail('Bu indirim kodunun süresi dolmuş.', 422, 'CODE_EXPIRED');
    if (row.max_uses != null && Number(row.used_count) >= Number(row.max_uses)) fail('Bu indirim kodunun kullanım hakkı bitmiş.', 422, 'CODE_USED_UP');
    if (subtotalC < cents(row.min_order)) fail(`Bu kod için minimum sepet tutarı ${round(row.min_order).toFixed(2).replace('.', ',')} ₺.`, 422, 'CODE_MIN_ORDER');
    if (row.kind === 'percent') discountC = Math.floor(subtotalC * Number(row.value) / 100);
    else if (row.kind === 'amount') discountC = Math.min(subtotalC, cents(row.value));
    else freeShipping = true;
    code = { id: Number(row.id), code: row.code, kind: row.kind };
  }
  const afterC = subtotalC - discountC;
  // Kargo: mağazadan teslim ücretsiz; yoksa ilk eşleşen kural, yoksa mağazanın varsayılanı.
  let shippingC = 0, rule = null;
  if (delivery === 'delivery') {
    const match = city ? rules.find(r => r.cities === '*' || r.cities.split(',').includes(city)) : null;
    if (match) { rule = match; shippingC = match.free_over != null && afterC >= cents(match.free_over) ? 0 : cents(match.fee); }
    else { const free = store.free_delivery_over == null ? null : cents(store.free_delivery_over); shippingC = free != null && afterC >= free ? 0 : cents(store.delivery_fee); }
    if (freeShipping) shippingC = 0;
  }
  return { subtotalC, discountC, shippingC, totalC: afterC + shippingC, city, code, rule: rule ? { id: Number(rule.id), name: rule.name } : null };
}
// Kodun kullanım hakkı sipariş işleminde atomik tüketilir (aynı anda iki sipariş son hakkı alamaz).
async function consumeCode(tx, tenantId, codeId) {
  const res = await tx.query('UPDATE online_discount_codes SET used_count=used_count+1 WHERE id=$1 AND tenant_id=$2 AND (max_uses IS NULL OR used_count<max_uses)', [codeId, tenantId]);
  if (!res.rowCount) fail('Bu indirim kodunun kullanım hakkı bitmiş.', 422, 'CODE_USED_UP');
}
async function releaseCode(tx, tenantId, codeId) {
  if (codeId) await tx.query('UPDATE online_discount_codes SET used_count=CASE WHEN used_count>0 THEN used_count-1 ELSE 0 END WHERE id=$1 AND tenant_id=$2', [codeId, tenantId]);
}

// ---------- Kargo takibi ----------
async function setShipping(user, orderId, body = {}) {
  const order = (await db.query('SELECT id,status,warehouse_id FROM online_orders WHERE id=$1 AND tenant_id=$2', [Number(orderId), user.tenantId])).rows[0];
  if (!order) fail('Sipariş bulunamadı.', 404);
  const scope = user.accessScope && user.accessScope.mode !== 'company' ? new Set((user.accessScope.warehouse_ids || []).map(Number)) : null;
  if (scope && !scope.has(Number(order.warehouse_id))) fail('Bu sipariş için yetkiniz yok.', 403);
  if (!['confirmed', 'preparing', 'ready', 'delivered'].includes(order.status)) fail('Kargo bilgisi yalnız onaylanmış siparişe girilir.', 409, 'BAD_STATUS');
  const carrier = text(body.carrier, 60), tracking = text(body.tracking_no, 60);
  if (tracking && !/^[A-Za-z0-9 ._/-]{4,60}$/.test(tracking)) fail('Takip numarası geçersiz.');
  const have = (await db.query('SELECT 1 FROM online_order_extras WHERE order_id=$1 AND tenant_id=$2', [order.id, user.tenantId])).rows[0];
  if (have) await db.query('UPDATE online_order_extras SET carrier=$3,tracking_no=$4,shipped_at=CASE WHEN $4 IS NOT NULL AND shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END WHERE order_id=$1 AND tenant_id=$2', [order.id, user.tenantId, carrier || null, tracking || null]);
  else await db.query('INSERT INTO online_order_extras (order_id,tenant_id,carrier,tracking_no,shipped_at) VALUES ($1,$2,$3,$4,CASE WHEN $4 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END)', [order.id, user.tenantId, carrier || null, tracking || null]);
  return { id: Number(order.id), carrier, tracking_no: tracking };
}
async function extrasFor(runner, tenantId, orderId) {
  const r = (await runner.query('SELECT * FROM online_order_extras WHERE order_id=$1 AND tenant_id=$2', [orderId, tenantId])).rows[0];
  return r ? { city: r.city || '', discount_code: r.discount_code || '', discount_amount: round(r.discount_amount), shipping_rule: r.shipping_rule || '', carrier: r.carrier || '', tracking_no: r.tracking_no || '', shipped_at: r.shipped_at || null, discount_code_id: r.discount_code_id == null ? null : Number(r.discount_code_id) }
    : { city: '', discount_code: '', discount_amount: 0, shipping_rule: '', carrier: '', tracking_no: '', shipped_at: null, discount_code_id: null };
}

module.exports = { PROVINCES, provinceOf, listCodes, saveCode, deleteCode, listRules, saveRule, deleteRule, priceCart, consumeCode, releaseCode, setShipping, extrasFor, normCode };
