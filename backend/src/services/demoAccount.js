'use strict';
// Kişiye özel süreli demo hesabı: ayrı işletme + yönetici kullanıcı + örnek ürün/stok verisi + süreli lisans.
// Şema değişikliği yoktur. Demo işletme adı "[DEMO] " ile başlar. Şifre rastgele üretilir ve yalnız çağırana döner, kayda yazılmaz.
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const PLAN_ID = 'BUSINESS_ANNUAL';

const SAMPLE = [
  // [ad, kategori, birim, alış, satış, min stok, ana depo adedi, şube adedi]
  ['Filtre Kahve 250 g', 'Gıda', 'adet', 118, 169.9, 20, 18, 6],
  ['Zeytinyağı 1 L', 'Gıda', 'adet', 245, 329.9, 15, 64, 22],
  ['Süt 1 L', 'Gıda', 'adet', 28, 39.5, 40, 12, 9],
  ['Makarna 500 g', 'Gıda', 'adet', 17, 26.9, 50, 310, 80],
  ['Çay 500 g', 'Gıda', 'adet', 96, 139.9, 25, 140, 35],
  ['A4 Fotokopi Kağıdı 500 yp', 'Kırtasiye', 'paket', 142, 199, 30, 95, 18],
  ['Tükenmez Kalem Mavi', 'Kırtasiye', 'adet', 4.2, 8.5, 100, 420, 150],
  ['Defter 80 yaprak', 'Kırtasiye', 'adet', 21, 39.9, 40, 33, 12],
  ['Matkap Ucu Seti 13 parça', 'Hırdavat', 'set', 160, 249, 10, 21, 4],
  ['Vida Kutusu 200 lü', 'Hırdavat', 'kutu', 35, 64.9, 25, 8, 3],
  ['Çamaşır Suyu 2 L', 'Temizlik', 'adet', 36, 54.9, 30, 75, 26],
  ['Yüzey Temizleyici 750 ml', 'Temizlik', 'adet', 41, 69.9, 25, 52, 14]
];

function ean13(seed) {
  const digits = ('869' + String(seed).padStart(9, '0')).slice(0, 12).split('').map(Number);
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  return digits.join('') + ((10 - (sum % 10)) % 10);
}

function makePassword(length = 14) {
  let out = '';
  while (out.length < length) { const byte = crypto.randomBytes(1)[0]; if (byte < ALPHABET.length * 4) out += ALPHABET[byte % ALPHABET.length]; }
  return out;
}

function sqlDate(date) { return date.toISOString().replace('T', ' ').replace('Z', ''); }

async function create(db, { email, company, days = 14 }) {
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!EMAIL.test(address) || address.length > 254) throw Object.assign(new Error('Geçerli bir e-posta adresi verin.'), { code: 'BAD_EMAIL' });
  if (!Number.isInteger(days) || days < 1 || days > 60) throw Object.assign(new Error('Süre 1–60 gün arasında olmalı.'), { code: 'BAD_DAYS' });
  const ownerIdentity = require('./ownerIdentity');
  if (address === ownerIdentity.OWNER_EMAIL) throw Object.assign(new Error('Platform sahibi e-postası için demo hesabı açılamaz.'), { code: 'RESERVED' });
  const licenseService = require('./licenseService');
  const plan = licenseService.getPlans().find(item => item.id === PLAN_ID);
  if (!plan) throw Object.assign(new Error('Demo paketi bulunamadı: ' + PLAN_ID), { code: 'NO_PLAN' });
  if ((await db.query('SELECT id FROM users WHERE LOWER(email)=$1', [address])).rows.length) throw Object.assign(new Error('Bu e-posta zaten kayıtlı.'), { code: 'EXISTS' });

  const password = makePassword();
  const hash = await bcrypt.hash(password, 10);
  const name = '[DEMO] ' + (typeof company === 'string' && company.trim() ? company.trim().slice(0, 80) : address.split('@')[0]);
  const expires = new Date(Date.now() + days * 86400000);
  const licenseKey = licenseService.generateKey();

  const result = await db.transaction(async client => {
    const tenant = (await client.query(
      'INSERT INTO tenants (name, tenant_code, company_name, email, owner_phone) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name, 'T-' + crypto.randomUUID(), name, address, '05000000000'])).rows[0].id;
    const user = (await client.query(
      'INSERT INTO users (email, password_hash, role, tenant_id) VALUES ($1,$2,$3,$4) RETURNING id', [address, hash, 'admin', tenant])).rows[0].id;
    await client.query("UPDATE user_access_scopes SET mode='company',updated_by=$1 WHERE user_id=$1 AND tenant_id=$2", [user, tenant]);
    await client.query(
      "INSERT INTO licenses (license_key,tenant_id,plan_id,status,max_users,max_warehouses,max_devices,max_pdas,enabled_features_json,expires_at) VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6,$7,$8,$9)",
      [licenseKey, tenant, plan.id, plan.max_users, plan.max_warehouses, plan.max_devices, plan.max_pdas, JSON.stringify(plan.features || {}), sqlDate(expires)]);

    const main = (await client.query("INSERT INTO warehouses (name, type, tenant_id) VALUES ($1,'MAIN',$2) RETURNING id", ['Ana Depo', tenant])).rows[0].id;
    const shop = (await client.query("INSERT INTO warehouses (name, type, tenant_id) VALUES ($1,'MAIN',$2) RETURNING id", ['Şube Mağaza', tenant])).rows[0].id;
    let index = 0;
    for (const [productName, category, unit, buy, sell, min, mainQty, shopQty] of SAMPLE) {
      index += 1;
      const product = (await client.query(
        'INSERT INTO products (tenant_id, sku, name, category, barcode, unit, purchase_price, sale_price, min_stock_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [tenant, `DEMO-${tenant}-${String(index).padStart(2, '0')}`, productName, category, ean13(tenant * 100 + index), unit, buy, sell, min])).rows[0].id;
      for (const [warehouse, quantity] of [[main, mainQty], [shop, shopQty]]) {
        await client.query('INSERT INTO stock_records (tenant_id, product_id, warehouse_id, quantity) VALUES ($1,$2,$3,$4)', [tenant, product, warehouse, quantity]);
        await client.query("INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, change_amount, movement_type, source, note) VALUES ($1,$2,$3,$4,'IN','demo','Örnek açılış stoku')", [tenant, product, warehouse, quantity]);
      }
    }
    await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',
      [tenant, address, 'demo.created', 'tenant', tenant, JSON.stringify({ days, plan: plan.id })]);
    return { tenantId: Number(tenant), userId: Number(user) };
  });
  return { ...result, email: address, password, plan: plan.id, expiresAt: expires.toISOString(), days };
}

module.exports = { create, makePassword, ean13 };
