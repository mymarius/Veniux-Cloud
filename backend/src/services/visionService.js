// Görüntü tanıma (Gemini): kasada ürün fotoğrafı ve tedarikçi faturası taslağı.
// Yapay zekâ yalnız OKUR; fiyat ve stok hiçbir zaman ondan gelmez. Eşleşme işletmenin kendi ürün listesinden yapılır
// ve fatura taslağı kullanıcı onaylamadan stoğa işlenmez (onay ekranda, mevcut mal kabul uç noktasıyla yapılır).
const db = require('../config/database');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const MAX_BYTES = 1500000;
const recent = new Map();

// Basit koruma: işletme başına dakikada en çok 20 fotoğraf (maliyet ve kötüye kullanım sınırı).
function throttle(user) {
  const key = String(user.tenantId), now = Date.now(), list = (recent.get(key) || []).filter(t => now - t < 60000);
  if (list.length >= 20) fail('Çok sık fotoğraf gönderildi. Bir dakika sonra yeniden deneyin.', 429);
  list.push(now); recent.set(key, list);
}
function parseImage(value) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(typeof value === 'string' ? value : '');
  if (!m) fail('Fotoğraf JPEG, PNG veya WebP olmalıdır.');
  if (Math.floor(m[2].length * 3 / 4) > MAX_BYTES) fail('Fotoğraf çok büyük (en fazla 1,5 MB).', 413);
  return { mime: m[1], data: m[2] };
}
async function askGemini(prompt, image) {
  if (!process.env.GEMINI_API_KEY) fail('Görüntü tanıma yapılandırılmamış. Yöneticinin GEMINI_API_KEY tanımlaması gerekir.', 503, 'VISION_NOT_CONFIGURED');
  let response;
  try {
    response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(process.env.GEMINI_VISION_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash') + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: image.mime, data: image.data } }] }], generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } }),
    });
  } catch { fail('Görüntü tanıma hizmetine ulaşılamadı.', 503); }
  if (!response.ok) { await response.body?.cancel?.(); fail('Görüntü tanıma isteği tamamlanamadı.', response.status === 429 ? 429 : 502); }
  let data; try { data = await response.json(); } catch { fail('Görüntü tanıma yanıtı okunamadı.', 502); }
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  try { return JSON.parse(text); } catch { fail('Görüntü okunamadı. Daha net bir fotoğraf deneyin.', 422); }
}

const norm = v => String(v || '').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const tokens = v => [...new Set(norm(v).split(' ').filter(t => t.length >= 2))];
const text = (v, max) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const digits = v => { const c = String(v ?? '').replace(/\s/g, ''); return /^\d{8,14}$/.test(c) ? c : null; };
async function catalog(user) {
  return (await db.query("SELECT id,name,barcode,sku,unit,sale_price FROM products WHERE tenant_id=$1 AND module_type='NORMAL' ORDER BY id LIMIT 5000", [user.tenantId])).rows
    .map(p => ({ id: Number(p.id), name: p.name, barcode: p.barcode, sku: p.sku, unit: p.unit, sale_price: Number(p.sale_price || 0) }));
}
// Önce barkod birebir, olmazsa ürün adındaki sözcük örtüşmesi; en çok 5 aday, fiyat işletmenin kendi listesinden.
function match(list, { name, brand, barcode }) {
  const code = digits(barcode);
  if (code) { const exact = list.find(p => String(p.barcode || '') === code); if (exact) return { exact: true, matches: [{ ...exact, score: 1 }] }; }
  const want = tokens([brand, name].filter(Boolean).join(' '));
  if (!want.length) return { exact: false, matches: [] };
  const scored = list.map(p => {
    const have = tokens(p.name);
    const hits = want.filter(t => have.some(h => h === t || (t.length >= 3 && h.startsWith(t)))).length;
    return { ...p, score: Number((hits / want.length).toFixed(2)) };
  }).filter(p => p.score >= 0.5).sort((a, b) => b.score - a.score || a.name.length - b.name.length).slice(0, 5);
  return { exact: false, matches: scored };
}

const PRODUCT_PROMPT = 'Fotoğraftaki tek bir ürünü tanı. Yalnızca JSON döndür: {"name":string|null,"brand":string|null,"size":string|null,"barcode":string|null,"confidence":number}. '
  + 'name: ürünün Türkçe kısa adı (marka hariç). size: ambalajdaki gramaj/hacim. barcode: ambalajda açıkça okunan 8-14 haneli barkod, okunmuyorsa null. confidence 0 ile 1 arası. '
  + 'Emin değilsen alanı null yap. Fiyat tahmin etme, uydurma.';
async function recognizeProduct(user, body = {}) {
  throttle(user);
  const raw = await askGemini(PRODUCT_PROMPT, parseImage(body.image_data));
  const recognized = { name: text(raw?.name, 150), brand: text(raw?.brand, 80), size: text(raw?.size, 40), barcode: digits(raw?.barcode), confidence: Math.min(1, Math.max(0, Number(raw?.confidence) || 0)) };
  if (!recognized.name && !recognized.barcode) fail('Fotoğrafta ürün tanınamadı. Ürünü yakından ve iyi ışıkta çekin.', 422);
  return { recognized, ...match(await catalog(user), recognized) };
}

const INVOICE_PROMPT = 'Bu bir tedarikçi faturası veya irsaliyesi fotoğrafı. Yalnızca JSON döndür: {"supplier":string|null,"invoice_no":string|null,"date":"YYYY-MM-DD"|null,"lines":[{"name":string,"barcode":string|null,"quantity":number,"unit_price":number|null}]}. '
  + 'Her ürün satırı için ad, okunuyorsa barkod, miktar ve birim fiyatı (KDV hariç ise olduğu gibi) yaz. Okunamayan alanı null yap, hiçbir şeyi uydurma. Toplam ve vergi satırlarını ürün satırı sayma.';
async function invoiceDraft(user, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Fatura okuma için yönetici yetkisi gerekli.', 403);
  throttle(user);
  const raw = await askGemini(INVOICE_PROMPT, parseImage(body.image_data));
  const list = await catalog(user), warnings = [];
  const lines = (Array.isArray(raw?.lines) ? raw.lines : []).slice(0, 100).map(l => {
    const name = text(l?.name, 200), quantity = Number(l?.quantity), unitPrice = l?.unit_price === null || l?.unit_price === undefined ? null : Number(l.unit_price);
    if (!name || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) return null;
    const found = match(list, { name, barcode: l?.barcode });
    return { name, barcode: digits(l?.barcode), quantity, unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : null, exact: found.exact, candidates: found.matches };
  }).filter(Boolean);
  if (!lines.length) fail('Faturada ürün satırı okunamadı. Fotoğrafı düz ve net çekin.', 422);
  if (lines.some(l => !Number.isInteger(l.quantity))) warnings.push('Bazı miktarlar tam sayı değil; mal kabul tam sayı ister. Koli/adet farkını kontrol edin.');
  return { supplier: text(raw?.supplier, 150), invoice_no: text(raw?.invoice_no, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.date || '')) ? raw.date : null, lines, warnings };
}
module.exports = { recognizeProduct, invoiceDraft, match, parseImage, _resetThrottle: () => recent.clear() }; // _resetThrottle yalnız testler içindir
