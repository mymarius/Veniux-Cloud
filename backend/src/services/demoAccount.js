'use strict';
// Kişiye özel süreli demo hesabı: ayrı işletme + yönetici kullanıcı + örnek ürün/stok verisi + süreli lisans.
// Şema değişikliği yoktur. Demo işletme adı "Veniux Demo – " ile başlar. Şifre rastgele üretilir ve yalnız çağırana döner, kayda yazılmaz.
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


// Müşteriler ve Ekip bölümü için örnek veri (CRM ve Personel). Tümü kurgusaldır; gerçek kişi veya firma değildir.
const dayISO = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();
const mailName = name => name.toLowerCase().replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z]+/g, '.');

function sampleWorkspaces() {
  const dep = { depo: 'dep-depo', satis: 'dep-satis', lojistik: 'dep-lojistik', muhasebe: 'dep-muhasebe' };
  const staff = [
    ['Selin Aydın', 'Satış Müdürü', dep.satis, 450000, -900],
    ['Mert Yıldız', 'Satış Temsilcisi', dep.satis, 250000, -420],
    ['Elif Kaya', 'Satış Temsilcisi', dep.satis, 220000, -250],
    ['Burak Demir', 'Depo Sorumlusu', dep.depo, '', -1100],
    ['Zeynep Arslan', 'Muhasebe Uzmanı', dep.muhasebe, '', -600],
    ['Can Öztürk', 'Sevkiyat Koordinatörü', dep.lojistik, '', -300]
  ].map(([fullName, title, departmentId, salesQuota, hire], index) => {
    const id = uid();
    return { id, fullName, title, departmentId, managerId: '', employmentType: 'Belirsiz Süreli', hireDate: dayISO(hire), phone: '0 5xx xxx xx ' + String(10 + index), email: mailName(fullName) + '@ornek-market.example', city: 'İstanbul', workSite: 'Merkez', defaultShift: 'gunduz', sicilNo: 'VNX-' + id.slice(0, 8), notes: '', salesQuota, status: 'aktif', weeklyHours: 45 };
  });
  const companies = [
    ['Anadolu Toptan Gıda', 'Toptan Gıda', '50-200', '₺18 Mn', 'İstanbul, Esenyurt', 'Kurumsal', 'healthy', 'Selin Aydın'],
    ['Başak Kırtasiye Zinciri', 'Kırtasiye', '10-50', '₺6 Mn', 'Ankara, Çankaya', 'Büyüme', 'healthy', 'Mert Yıldız'],
    ['Deniz Hırdavat ve Yapı', 'Hırdavat', '10-50', '₺9 Mn', 'İzmir, Bornova', 'Büyüme', 'attention', 'Elif Kaya'],
    ['Lale Kafe ve Büfe Grubu', 'Yiyecek-İçecek', '10-50', '₺4 Mn', 'Bursa, Nilüfer', 'Başlangıç', 'healthy', 'Mert Yıldız']
  ].map(([name, industry, employees, annualRevenue, location, tier, healthStatus, accountOwner], i) => ({ id: uid(), name, industry, employees, annualRevenue, location, tier, healthStatus, accountOwner, openDealsCount: 0, openDealsValue: 0, lastActivity: dayISO(-(i + 1)), createdDate: dayISO(-120 + i * 10) }));
  const contacts = [
    ['Hakan Çelik', 'Satın Alma Müdürü', 0, 'Karar Verici'], ['Aylin Şahin', 'Genel Müdür', 1, 'Karar Verici, Üst Yönetim'],
    ['Oğuz Tekin', 'Mağaza Müdürü', 2, 'Kullanıcı'], ['Derya Koç', 'İşletme Sahibi', 3, 'Karar Verici'], ['Tolga Erdem', 'Muhasebe Sorumlusu', 0, 'Etkileyici']
  ].map(([fullName, jobTitle, ci, tags], i) => ({ id: uid(), fullName, jobTitle, companyId: companies[ci].id, companyName: companies[ci].name, email: mailName(fullName) + '@ornek-musteri.example', phone: '0 5xx xxx xx ' + String(20 + i), tags: tags.split(',').map(t => t.trim()), contactStatus: 'Active Opportunity', owner: companies[ci].accountOwner, leadScore: 55 + i * 8, notesCount: i % 3, dealsCount: 0, totalDealValue: 0, lastContacted: dayISO(-(i + 1)), createdDate: dayISO(-100 + i * 9) }));
  const leads = [
    ['Gökhan Polat', 'Polat Market', 'Market Sahibi', 'Web sitesi demo talebi', 38000, 82, 'qualified'],
    ['Nehir Aksoy', 'Aksoy Züccaciye', 'Mağaza Sahibi', 'Fuar görüşmesi', 52000, 64, 'new'],
    ['Ercan Bilgin', 'Bilgin Pide Salonu', 'İşletme Sahibi', 'Tavsiye', 27000, 71, 'contacted'],
    ['Pınar Güneş', 'Güneş Toptan', 'Satın Alma', 'Web sitesi demo talebi', 90000, 58, 'new']
  ].map(([name, company, jobTitle, source, estimatedValue, score, status], i) => ({ id: uid(), name, company, jobTitle, email: mailName(name) + '@ornek-aday.example', phone: '0 5xx xxx xx ' + String(30 + i), source, estimatedValue, owner: staff[1 + (i % 2)].fullName, notes: '', score, status, lastActivity: dayISO(-i), createdDate: dayISO(-30 + i * 3) }));
  const deals = [
    ['Anadolu Toptan: 3 depo stok ve kasa kurulumu', 0, 240000, 'proposal', 'Selin Aydın', 30, 'high'],
    ['Başak Kırtasiye: 12 şube kasa geçişi', 1, 180000, 'negotiation', 'Mert Yıldız', 21, 'high'],
    ['Deniz Hırdavat: depo sayım ve etiket', 2, 64000, 'qualification', 'Elif Kaya', 45, 'medium'],
    ['Lale Kafe: hızlı satış ve stok', 3, 36000, 'won', 'Mert Yıldız', -7, 'medium'],
    ['Anadolu Toptan: lot ve miat modülü', 0, 48000, 'qualification', 'Selin Aydın', 60, 'low']
  ].map(([title, ci, value, stage, salesRep, close, priority], i) => ({ id: uid(), title, companyId: companies[ci].id, companyName: companies[ci].name, contactName: contacts.find(c => c.companyId === companies[ci].id).fullName, value, stage, salesRep, expectedCloseDate: dayISO(close), priority, tags: ['Yıllık'], probability: stage === 'won' ? 100 : stage === 'proposal' ? 60 : stage === 'negotiation' ? 75 : 30, pipelineId: 'pipe-enterprise', createdAt: new Date(Date.now() - (40 - i * 5) * 86400000).toISOString(), lastActivity: dayISO(-(i + 1)), ...(stage === 'won' ? { closedAt: new Date(Date.now() - 7 * 86400000).toISOString() } : {}) }));
  for (const c of companies) { const open = deals.filter(d => d.companyId === c.id && !['won', 'lost'].includes(d.stage)); c.openDealsCount = open.length; c.openDealsValue = open.reduce((t, d) => t + d.value, 0); }
  for (const c of contacts) { const mine = deals.filter(d => d.companyId === c.companyId); c.dealsCount = mine.length; c.totalDealValue = mine.reduce((t, d) => t + d.value, 0); }
  const tasks = [
    ['Anadolu Toptan teklifini güncelle', 'high', 'Selin Aydın', 2, deals[0].title, 'todo'],
    ['Başak Kırtasiye fiyat görüşmesi için hazırlık', 'high', 'Mert Yıldız', 1, deals[1].title, 'in_progress'],
    ['Deniz Hırdavat saha ziyareti planla', 'medium', 'Elif Kaya', 5, deals[2].title, 'todo'],
    ['Lale Kafe kurulum sonrası memnuniyet araması', 'low', 'Mert Yıldız', 7, deals[3].title, 'completed']
  ].map(([title, priority, assignee, due, relatedDeal, status]) => ({ id: uid(), title, priority, assignee, dueDate: dayISO(due), relatedDeal, tags: ['Takip'], status }));
  return {
    crm: { companies, contacts, leads, deals, tasks, activities: [], automations: [], notifications: [] },
    hr: { employees: staff, schedule: [], attendance: [], leaveRequests: [], balances: [], goals: [], reviews: [] }
  };
}

// Müşteriler ve Ekip örnek verisi: yalnız kaydı olmayan çalışma alanına yazar (mevcut veriyi ezmez).
async function seedWorkspaces(client, tenant) {
  const { crm, hr } = sampleWorkspaces();
  for (const [scope, data] of [['crm', crm], ['hr', hr]]) {
    const have = (await client.query("SELECT revision FROM workspace_collections WHERE tenant_id=$1 AND scope=$2 AND name='workspace'", [tenant, scope])).rows;
    if (have.length) continue;
    await client.query("INSERT INTO workspace_collections (tenant_id,scope,name,payload,revision) VALUES ($1,$2,'workspace',$3,1)", [tenant, scope, JSON.stringify(data)]);
  }
}

// Daha önce açılmış bir demo işletmeye örnek müşteri/ekip verisi ekler. Yalnız "Veniux Demo – " ile başlayan işletmelerde çalışır.
async function seedExisting(db, tenantId) {
  const id = Number(tenantId);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('Geçerli bir işletme numarası verin.'), { code: 'BAD_TENANT' });
  const row = (await db.query('SELECT company_name FROM tenants WHERE id=$1', [id])).rows[0];
  if (!row) throw Object.assign(new Error('İşletme bulunamadı.'), { code: 'NO_TENANT' });
  if (!String(row.company_name).startsWith('Veniux Demo – ')) throw Object.assign(new Error('Bu işletme bir demo işletmesi değil; örnek veri yazılmadı.'), { code: 'NOT_DEMO' });
  await db.transaction(client => seedWorkspaces(client, id));
  return { tenantId: id };
}

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
  const name = 'Veniux Demo – ' + (typeof company === 'string' && company.trim() ? company.trim().slice(0, 80) : address.split('@')[0]);
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
    await seedWorkspaces(client, tenant);
    await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',
      [tenant, address, 'demo.created', 'tenant', tenant, JSON.stringify({ days, plan: plan.id })]);
    return { tenantId: Number(tenant), userId: Number(user) };
  });
  return { ...result, email: address, password, plan: plan.id, expiresAt: expires.toISOString(), days };
}

module.exports = { create, seedExisting, sampleWorkspaces, makePassword, ean13 };
