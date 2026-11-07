// Muhasebe için CSV paketleri. Hesap kodlarını kullanıcı girer; Veniux hesap planı varsaymaz.
const crypto = require('crypto');
const db = require('../config/database');

const TYPES = {
  sales: { title: 'Satış', header: ['fis_no', 'tarih', 'urun', 'miktar', 'birim', 'kdv_haric', 'kdv_orani', 'kdv', 'toplam', 'hesap_kodu'] },
  payments: { title: 'Tahsilat', header: ['fis_no', 'tarih', 'odeme_turu', 'tutar', 'hesap_kodu'] },
  returns: { title: 'İade ve iptal', header: ['belge_no', 'asil_fis_no', 'tarih', 'tur', 'urun', 'miktar', 'kdv_haric', 'kdv_orani', 'kdv', 'toplam', 'hesap_kodu'] },
  purchases: { title: 'Tamamlanan alış siparişi', header: ['siparis_no', 'siparis_tarihi', 'tedarikci', 'vergi_no', 'urun', 'alinan_miktar', 'birim_fiyat', 'kdv_bilgisi', 'hesap_kodu'] },
  stock: { title: 'Stok hareketi', header: ['hareket_no', 'tarih', 'depo_no', 'urun', 'tur', 'miktar', 'referans'] },
  contacts: { title: 'Cari', header: ['cari_kodu', 'tur', 'unvan', 'vergi_no', 'adres'] },
};
const PAYMENT = { cash: 'Nakit', credit_card: 'Kredi kartı', on_account: 'Veresiye' };
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const guard = user => { if (!['admin', 'manager'].includes(user.role) || (user.accessScope?.mode && user.accessScope.mode !== 'company')) fail('Muhasebe aktarımı için firma genelinde yönetici yetkisi gerekir.', 403); };
const money = cents => { const abs = Math.abs(cents); return (cents < 0 ? '-' : '') + Math.floor(abs / 100) + ',' + String(abs % 100).padStart(2, '0'); };
const quantity = value => String(value).replace('.', ',');
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;

// Metin hücresi formül sayılmasın diye başına tek tırnak eklenir; sayısal hücreler işlenmez.
function cell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? String(value.number) : String(value);
  if (typeof value !== 'object' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[";\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
const number = text => ({ number: text });
function toCsv(header, rows) { return '﻿' + [header, ...rows].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n'; }

async function saleRows(tenant, from, to) { return (await db.query('SELECT sale_id,business_date,snapshot_json FROM retail_sales WHERE tenant_id=$1 AND business_date>=$2 AND business_date<=$3 ORDER BY business_date,sale_id', [tenant, from, to])).rows.map(row => ({ ...row, snapshot: JSON.parse(row.snapshot_json) })); }

async function collect(tenant, type, from, to) {
  const out = { records: [], needed: new Set(), issues: [], warnings: [] };
  const add = (key, rows) => out.records.push({ key, rows });
  if (type === 'sales') for (const sale of await saleRows(tenant, from, to)) {
    const rows = [];
    for (const line of sale.snapshot.items) {
      if (!Number.isInteger(line.vat_rate) || !Number.isSafeInteger(line.net_ex_vat_cents)) { out.issues.push(`${sale.snapshot.receipt_no}: KDV bilgisi eksik (${line.name})`); continue; }
      out.needed.add('sale:vat:' + line.vat_rate);
      rows.push({ map: 'sale:vat:' + line.vat_rate, cells: [sale.snapshot.receipt_no, sale.business_date, line.name, number(quantity(line.quantity)), line.unit, number(money(line.net_ex_vat_cents)), number(String(line.vat_rate)), number(money(line.net_cents - line.net_ex_vat_cents)), number(money(line.net_cents))] });
    }
    add('sale:' + sale.sale_id, rows);
  }
  if (type === 'payments') for (const sale of await saleRows(tenant, from, to)) {
    const rows = [];
    for (const [kind, cents] of Object.entries(sale.snapshot.payments || {})) {
      if (!cents) continue;
      if (!Number.isSafeInteger(cents) || !PAYMENT[kind]) { out.issues.push(`${sale.snapshot.receipt_no}: ödeme kaydı okunamadı`); continue; }
      out.needed.add('payment:' + kind);
      rows.push({ map: 'payment:' + kind, cells: [sale.snapshot.receipt_no, sale.business_date, PAYMENT[kind], number(money(cents))] });
    }
    add('payment:' + sale.sale_id, rows);
  }
  if (type === 'returns') {
    const events = (await db.query('SELECT r.id,r.kind,r.business_date,r.data_json,s.snapshot_json FROM retail_reversals r JOIN retail_sales s ON s.sale_id=r.sale_id AND s.tenant_id=r.tenant_id WHERE r.tenant_id=$1 AND r.business_date>=$2 AND r.business_date<=$3 ORDER BY r.business_date,r.id', [tenant, from, to])).rows;
    for (const event of events) {
      const data = JSON.parse(event.data_json), sale = JSON.parse(event.snapshot_json), rows = [];
      for (const item of data.items || []) {
        const line = sale.items.find(entry => entry.id === item.id);
        if (!Number.isInteger(item.vat_rate) || !Number.isSafeInteger(item.refund_ex_vat_cents)) { out.issues.push(`${sale.receipt_no}: iade KDV bilgisi eksik`); continue; }
        out.needed.add('return:vat:' + item.vat_rate);
        rows.push({ map: 'return:vat:' + item.vat_rate, cells: [event.id, sale.receipt_no, event.business_date, event.kind === 'cancel' ? 'İptal' : 'İade', line?.name || '', number(quantity(item.quantity)), number(money(item.refund_ex_vat_cents)), number(String(item.vat_rate)), number(money(item.amount_cents - item.refund_ex_vat_cents)), number(money(item.amount_cents))] });
      }
      add('return:' + event.id, rows);
    }
  }
  if (type === 'purchases') {
    const lines = (await db.query("SELECT i.id,i.received_quantity,i.unit_price,o.order_no,o.created_at,o.status,s.name AS supplier,s.tax_no,p.name AS product FROM purchase_order_items i JOIN purchase_orders o ON o.id=i.order_id AND o.tenant_id=i.tenant_id JOIN suppliers s ON s.id=o.supplier_id AND s.tenant_id=o.tenant_id JOIN products p ON p.id=i.product_id AND p.tenant_id=i.tenant_id WHERE i.tenant_id=$1 AND i.received_quantity>0 AND o.created_at>=$2 AND o.created_at<$3 ORDER BY o.created_at,i.id", [tenant, from, nextDay(to)])).rows;
    let partial = 0;
    for (const line of lines) {
      if (line.status !== 'completed') { partial += 1; continue; }
      out.needed.add('purchase');
      add('purchase:' + line.id, [{ map: 'purchase', cells: [line.order_no, String(line.created_at).slice(0, 10), line.supplier, line.tax_no, line.product, number(quantity(line.received_quantity)), number(money(Math.round(Number(line.unit_price) * 100))), 'Yok'] }]);
    }
    if (partial) out.warnings.push(`${partial} kalem, siparişi tamamlanmadığı için aktarılmadı.`);
    if (out.records.length) out.warnings.push('Alış kayıtları tedarikçi faturası değildir ve KDV bilgisi içermez; muhasebe kaydını faturayla kontrol edin.');
  }
  if (type === 'stock') {
    const rows = (await db.query('SELECT t.id,t.created_at,t.warehouse_id,t.transaction_type,t.quantity,t.reference_type,t.reference_id,p.name AS product FROM inventory_transactions t JOIN products p ON p.id=t.product_id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=$1 AND t.created_at>=$2 AND t.created_at<$3 ORDER BY t.id', [tenant, from, nextDay(to)])).rows;
    for (const row of rows) add('stock:' + row.id, [{ cells: [row.id, String(row.created_at).slice(0, 10), row.warehouse_id, row.product, row.transaction_type, number(quantity(row.quantity)), [row.reference_type, row.reference_id].filter(Boolean).join(' ')] }]);
  }
  if (type === 'contacts') {
    const suppliers = (await db.query('SELECT id,name,tax_no,address FROM suppliers WHERE tenant_id=$1 ORDER BY id', [tenant])).rows;
    const customers = (await db.query('SELECT id,name,tax_number,address FROM retail_credit_accounts WHERE tenant_id=$1 ORDER BY id', [tenant])).rows;
    for (const row of suppliers) out.records.push({ key: null, rows: [{ cells: ['TED-' + row.id, 'Tedarikçi', row.name, row.tax_no, row.address] }] });
    for (const row of customers) out.records.push({ key: null, rows: [{ cells: ['MUS-' + row.id, 'Müşteri', row.name, row.tax_number, row.address] }] });
  }
  return out;
}
function nextDay(date) { return new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10); }
function checkInput(body) {
  const { type, from, to } = body || {};
  if (!Object.hasOwn(TYPES, type)) fail('Aktarım türü seçin.');
  if (!validDate(from) || !validDate(to) || from > to) fail('Geçerli bir tarih aralığı seçin.');
  return { type, from, to };
}
async function maps(tenant) { return Object.fromEntries((await db.query('SELECT map_key,account_code FROM accounting_account_maps WHERE tenant_id=$1', [tenant])).rows.map(row => [row.map_key, row.account_code])); }
async function build(user, input) {
  const data = await collect(user.tenantId, input.type, input.from, input.to);
  const taken = new Set((await db.query('SELECT active_key FROM accounting_export_items WHERE tenant_id=$1 AND export_type=$2 AND active_key IS NOT NULL', [user.tenantId, input.type])).rows.map(row => row.active_key));
  const records = data.records.filter(record => !record.key || !taken.has(record.key));
  const accounts = await maps(user.tenantId);
  const usesMap = TYPES[input.type].header.includes('hesap_kodu');
  const live = new Set(records.flatMap(record => record.rows.map(row => row.map)).filter(Boolean));
  return { ...input, records, issues: data.issues, warnings: data.warnings, already_exported: data.records.length - records.length, missing_accounts: [...live].filter(key => !accounts[key]).sort(), accounts, usesMap };
}
const summary = plan => ({ type: plan.type, from: plan.from, to: plan.to, record_count: plan.records.length, row_count: plan.records.reduce((sum, record) => sum + record.rows.length, 0), already_exported: plan.already_exported, missing_accounts: plan.missing_accounts, issues: plan.issues.slice(0, 50), issue_count: plan.issues.length, warnings: plan.warnings });

async function preview(user, body) { guard(user); return summary(await build(user, checkInput(body))); }
async function create(user, body) {
  guard(user);
  const plan = await build(user, checkInput(body));
  if (plan.issues.length) fail('Eksik KDV veya ödeme bilgisi olan kayıtlar var. Önce önizlemedeki sorunları giderin.', 409);
  if (plan.missing_accounts.length) fail('Eşleşmemiş hesap kodları var.', 409);
  const rows = plan.records.flatMap(record => record.rows).filter(row => row.cells);
  if (!rows.length) fail('Bu aralıkta aktarılacak yeni kayıt yok.', 409);
  const content = toCsv(TYPES[plan.type].header, rows.map(row => plan.usesMap ? [...row.cells, plan.accounts[row.map]] : row.cells));
  const id = crypto.randomUUID(), sha = crypto.createHash('sha256').update(content).digest('hex');
  return db.transaction(async tx => {
    await tx.query("INSERT INTO accounting_exports (id,tenant_id,export_type,date_from,date_to,status,row_count,sha256,content,created_by) VALUES ($1,$2,$3,$4,$5,'created',$6,$7,$8,$9)", [id, user.tenantId, plan.type, plan.from, plan.to, rows.length, sha, content, user.userId]);
    for (const record of plan.records) if (record.key) await tx.query('INSERT INTO accounting_export_items (tenant_id,export_id,export_type,source_key,active_key) VALUES ($1,$2,$3,$4,$5)', [user.tenantId, id, plan.type, record.key, record.key]);
    await tx.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,'accounting.export.create','accounting_export',$3)", [user.tenantId, user.email, JSON.stringify({ id, type: plan.type, from: plan.from, to: plan.to, rows: rows.length })]);
    return { id, type: plan.type, status: 'created', row_count: rows.length, sha256: sha };
  });
}
const listColumns = 'id,export_type,date_from,date_to,status,row_count,sha256,created_at,imported_at,cancelled_at';
async function list(user) { guard(user); return (await db.query(`SELECT ${listColumns} FROM accounting_exports WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`, [user.tenantId])).rows; }
async function find(user, id) { const row = (await db.query('SELECT * FROM accounting_exports WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0]; if (!row) fail('Aktarım paketi bulunamadı.', 404); return row; }
async function file(user, id) {
  guard(user);
  const row = await find(user, id);
  if (row.status === 'cancelled') fail('İptal edilen paket indirilemez.', 409);
  await db.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,'accounting.export.download','accounting_export',$3)", [user.tenantId, user.email, JSON.stringify({ id })]);
  return { name: `veniux-${row.export_type}-${row.date_from}-${row.date_to}.csv`, content: row.content };
}
async function markImported(user, id) {
  guard(user);
  const done = await db.query("UPDATE accounting_exports SET status='imported',imported_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2 AND status='created'", [id, user.tenantId]);
  if (done.rowCount !== 1) { await find(user, id); fail('Bu paket içe alındı olarak işaretlenemez.', 409); }
  return { id, status: 'imported' };
}
// İçe alınmış paket Veniux'tan silinemez: kullanıcı hedef programda geri aldığını onaylamalıdır.
async function cancel(user, id, body) {
  guard(user);
  const row = await find(user, id);
  if (row.status === 'cancelled') fail('Paket zaten iptal edilmiş.', 409);
  if (row.status === 'imported' && body?.reverted_in_target !== true) fail('Bu paket içe alınmış. Önce muhasebe programında geri alıp bunu onaylayın.', 409);
  return db.transaction(async tx => {
    await tx.query("UPDATE accounting_exports SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2", [id, user.tenantId]);
    await tx.query('UPDATE accounting_export_items SET active_key=NULL WHERE export_id=$1 AND tenant_id=$2', [id, user.tenantId]);
    await tx.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,'accounting.export.cancel','accounting_export',$3)", [user.tenantId, user.email, JSON.stringify({ id, was: row.status })]);
    return { id, status: 'cancelled' };
  });
}
async function getMaps(user) { guard(user); return maps(user.tenantId); }
async function saveMaps(user, body) {
  guard(user);
  const entries = Object.entries(body?.maps || {});
  if (!entries.length || entries.length > 100) fail('Kaydedilecek hesap kodu yok.');
  for (const [key, code] of entries) if (!/^(sale:vat:\d{1,2}|return:vat:\d{1,2}|payment:(cash|credit_card|on_account)|purchase)$/.test(key) || typeof code !== 'string' || !/^[0-9A-Za-z.\-_ ]{1,40}$/.test(code.trim())) fail('Hesap kodu geçersiz: ' + key);
  await db.transaction(async tx => {
    for (const [key, code] of entries) {
      const updated = await tx.query('UPDATE accounting_account_maps SET account_code=$1 WHERE tenant_id=$2 AND map_key=$3', [code.trim(), user.tenantId, key]);
      if (!updated.rowCount) await tx.query('INSERT INTO accounting_account_maps (tenant_id,map_key,account_code) VALUES ($1,$2,$3)', [user.tenantId, key, code.trim()]);
    }
  });
  return maps(user.tenantId);
}
module.exports = { preview, create, list, file, markImported, cancel, getMaps, saveMaps, toCsv, money, number };
