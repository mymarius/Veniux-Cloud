// Terazi kodu (PLU) okuma, kaydetme ve kasada etiket koduyla ürün bulma.
const db = require('../config/database');

const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
// Etikette baştaki sıfırlar alan uzunluğunu doldurur: 00123 ile 123 aynı koddur.
const normalize = value => {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,8}$/.test(text)) return null;
  return String(Number(text));
};

async function product(user, id) {
  const row = (await db.query('SELECT id,unit FROM products WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0];
  if (!row) fail('Ürün bulunamadı.', 404);
  return row;
}
async function get(user, id) {
  await product(user, id);
  const row = (await db.query('SELECT plu FROM product_scale_codes WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id])).rows[0];
  return { plu: row?.plu || null };
}
async function set(user, id, value) {
  const item = await product(user, id);
  if (value === null || value === '' || value === undefined) {
    await db.query('DELETE FROM product_scale_codes WHERE tenant_id=$1 AND product_id=$2', [user.tenantId, id]);
    return { plu: null };
  }
  const plu = normalize(value);
  if (!plu) fail('Terazi kodu 1-8 haneli bir sayı olmalı.');
  if (!['kg', 'g', 'litre'].includes(item.unit)) fail('Terazi kodu yalnız birimi kg, g veya litre olan ürüne verilebilir.');
  const owner = (await db.query('SELECT product_id FROM product_scale_codes WHERE tenant_id=$1 AND plu=$2', [user.tenantId, plu])).rows[0];
  if (owner && Number(owner.product_id) !== Number(id)) fail('Bu terazi kodu başka bir ürüne verilmiş.', 409);
  const updated = await db.query('UPDATE product_scale_codes SET plu=$1 WHERE tenant_id=$2 AND product_id=$3', [plu, user.tenantId, id]);
  if (!updated.rowCount) await db.query('INSERT INTO product_scale_codes (tenant_id,product_id,plu) VALUES ($1,$2,$3)', [user.tenantId, id, plu]);
  return { plu };
}
async function find(client, tenant, code) {
  const plu = normalize(code);
  if (!plu) return [];
  return (await client.query('SELECT p.* FROM product_scale_codes c JOIN products p ON p.id=c.product_id AND p.tenant_id=c.tenant_id WHERE c.tenant_id=$1 AND c.plu=$2', [tenant, plu])).rows;
}
module.exports = { get, set, find, normalize };
