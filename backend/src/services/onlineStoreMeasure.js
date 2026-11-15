// Online mağaza: kiloyla, litreyle, metreyle satılan ürünler. Müşteri, ürünün "adım"ının katı bir miktar seçer (ör. 0,5 kg, 100 g).
// Miktarlar en çok 3 ondalıktır; tutarlar kuruş cinsinden tam sayı olarak hesaplanır.
const db = require('../config/database');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const UNITS = new Set(['kg', 'kilo', 'kilogram', 'g', 'gr', 'gram', 'l', 'lt', 'litre', 'm', 'mt', 'metre', 'cm', 'm2', 'm3']);
const norm = unit => String(unit || '').trim().toLowerCase().replace(/\./g, '');
const measured = unit => UNITS.has(norm(unit));
const defaultStep = unit => (['g', 'gr', 'gram'].includes(norm(unit)) ? 100 : norm(unit) === 'cm' ? 10 : 0.5);
const milli = v => Math.round(Number(v) * 1000);
const isMilli = v => Number.isFinite(Number(v)) && Math.abs(Number(v) * 1000 - Math.round(Number(v) * 1000)) < 1e-6;
const label = unit => ({ kilo: 'kg', kilogram: 'kg', gr: 'g', gram: 'g', lt: 'L', l: 'L', litre: 'L', mt: 'm', metre: 'm' }[norm(unit)] || norm(unit));

async function measureMap(runner, tenantId, products) {
  const out = new Map();
  const ids = products.filter(p => measured(p.unit)).map(p => Number(p.id));
  const rows = ids.length ? (await runner.query(`SELECT product_id,step,min_qty FROM online_product_measure WHERE tenant_id=$1 AND product_id IN (${ids.map((_, i) => '$' + (i + 2)).join(',')})`, [tenantId, ...ids])).rows : [];
  const saved = new Map(rows.map(r => [Number(r.product_id), { step: Number(r.step), min: Number(r.min_qty) }]));
  for (const p of products) if (measured(p.unit)) out.set(Number(p.id), saved.get(Number(p.id)) || { step: defaultStep(p.unit), min: defaultStep(p.unit) });
  return out;
}
function readMeasure(unit, body, current) {
  let step = body.step === undefined ? (current ? current.step : defaultStep(unit)) : Number(body.step);
  if (!Number.isFinite(step) || step <= 0 || step > 1000 || !isMilli(step)) fail('Satış adımı 0,001 ile 1000 arasında olmalı (en çok 3 ondalık).', 422, 'BAD_STEP');
  let min = body.min_qty === undefined || body.min_qty === null || body.min_qty === '' ? (current ? current.min : step) : Number(body.min_qty);
  if (!Number.isFinite(min) || min < step || min > 100000 || !isMilli(min)) fail('Minimum miktar, satış adımından küçük olamaz.', 422, 'BAD_MIN');
  if (milli(min) % milli(step) !== 0) fail('Minimum miktar, satış adımının katı olmalı.', 422, 'BAD_MIN');
  return { step, min };
}
async function saveMeasure(tx, tenantId, product, body = {}) {
  const have = (await tx.query('SELECT step,min_qty FROM online_product_measure WHERE tenant_id=$1 AND product_id=$2', [tenantId, Number(product.id)])).rows[0];
  const m = readMeasure(product.unit, body, have ? { step: Number(have.step), min: Number(have.min_qty) } : null);
  if (have) await tx.query('UPDATE online_product_measure SET step=$3,min_qty=$4 WHERE tenant_id=$1 AND product_id=$2', [tenantId, Number(product.id), m.step, m.min]);
  else await tx.query('INSERT INTO online_product_measure (tenant_id,product_id,step,min_qty) VALUES ($1,$2,$3,$4)', [tenantId, Number(product.id), m.step, m.min]);
  return m;
}
// Sepet satırı miktarı: adetli ürün tam sayı (en çok 50); ölçülü ürün adımın katı, en az min, en çok 1000.
function checkQuantity(product, qty, measure) {
  if (!measure) {
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 50) fail(`"${product.name}" için adet 1-50 arasında tam sayı olmalı.`, 400, 'BAD_QTY');
    return;
  }
  if (!isMilli(qty) || qty <= 0 || qty > 1000) fail(`"${product.name}" için miktar geçersiz.`, 400, 'BAD_QTY');
  if (milli(qty) < milli(measure.min)) fail(`"${product.name}" için en az ${measure.min} ${label(product.unit)} sipariş verilebilir.`, 400, 'BAD_QTY');
  if (milli(qty) % milli(measure.step) !== 0) fail(`"${product.name}" ${measure.step} ${label(product.unit)} ve katları olarak satılır.`, 400, 'BAD_QTY');
}
const lineCents = (priceCents, qty) => Math.round(priceCents * qty);

module.exports = { measured, defaultStep, measureMap, saveMeasure, checkQuantity, lineCents, isMilli, label };
