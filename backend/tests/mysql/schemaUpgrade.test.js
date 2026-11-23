// Eski kurulumun yeni şemaya yükseltilmesi (masaüstü local-server upgradeSchema ile aynı çağrı: MySQLMigrator.upgradeAdditive).
// Ayrı, geçici bir veritabanında "eski kurulum" kurulur (son şema adımı geri alınmış gibi), veri eklenir, yükseltilir; veri ve tetikleyiciler korunmalı.
const mysql = require('mysql2/promise');
const { MySQLMigrator, manifest } = require('../../src/database/mysqlMigrator');

const fs = require('fs');
const path = require('path');
const prev = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/database/mysql/032-fx-auto-tasks.json'), 'utf8'));
// 033 ile eklenen indeksler (tablo -> indeks adları); "eski kurulum" benzetimi için geri alınır.
const addedIndexes = manifest => manifest.tables.flatMap(t => t.indexes.filter(i => !prev.tables.find(p => p.name === t.name).indexes.some(o => o.name === i.name)).map(i => ({ table: t.name, name: i.name })));
const indexNames = async table => (await c.query('SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table]))[0].map(r => r.INDEX_NAME);
// 034 ile eklenen sütunlar (tablo -> sütun adları); 032'ye göre eklenenler.
const addedColumns = manifest => manifest.tables.flatMap(t => { const p = prev.tables.find(x => x.name === t.name); return p ? t.columns.filter(c => !p.columns.some(o => o.name === c.name)).map(c => ({ table: t.name, name: c.name })) : []; });
const columnNames = async table => (await c.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table]))[0].map(r => r.COLUMN_NAME);
const dropAddedColumns = async () => { for (const col of addedColumns(manifest)) if ((await columnNames(col.table)).includes(col.name)) await c.query('ALTER TABLE `' + col.table + '` DROP COLUMN `' + col.name + '`'); };
const dropAddedIndexes = async () => { for (const ix of addedIndexes(manifest)) if ((await indexNames(ix.table)).includes(ix.name)) await c.query('ALTER TABLE `' + ix.table + '` DROP INDEX `' + ix.name + '`'); };

let admin, c;
// Test hesabı yalnız önceden yetkilendirilmiş geçici veritabanlarına yazabilir; rc2_fault her test dosyasında baştan kurulur.
const NAME = 'veniux_test_rc2_fault';
const conn = async database => mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database, multipleStatements: false });

beforeAll(async () => {
  admin = await conn(undefined);
  await admin.query('DROP DATABASE IF EXISTS ' + NAME);
  await admin.query('CREATE DATABASE ' + NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
  c = await conn(NAME);
});
afterAll(async () => {
  await c?.end().catch(() => {});
  await admin?.query('DROP DATABASE IF EXISTS ' + NAME).catch(() => {});
  // rc2Recovery.test.js bu adlı BOŞ veritabanının var olmasını bekler (hata enjeksiyonlu geri yükleme hedefi); bırakmadan çıkmayız.
  await admin?.query('CREATE DATABASE IF NOT EXISTS ' + NAME + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_bin').catch(() => {});
  await admin?.end().catch(() => {});
});

test('son adım yalnız yeni tablo ekler; geri alınmış (eski) kurulum veri kaybetmeden yükselir', async () => {
  await new MySQLMigrator(c).migrate();
  const [[tenant]] = await c.query("INSERT INTO tenants (company_name,tenant_code,email) VALUES ('Eski Müşteri','ESKI-UPG-1','eski@example.com')").then(r => [[{ id: r[0].insertId }]]);
  await c.query("INSERT INTO edocuments (id,tenant_id,sale_id,document_type,status,payload) VALUES ('eski-1',?,'S1','E_ARSIV','draft','{}')", [tenant.id]);
  const [triggersBefore] = await c.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY 1');

  // "Eski kurulum": son sürümün tabloları ve kaydı yok (032: otomatik kur + işletme görevleri)
  await c.query('DROP TABLE exchange_rate_sources');
  await c.query('DROP TABLE exchange_rate_settings');
  await c.query('DROP TABLE business_tasks');
  await dropAddedIndexes();
  await dropAddedColumns();
  await c.query('DELETE FROM veniux_mysql_migrations WHERE version IN (?,?,?)', [prev.version, '033-performance-indexes', manifest.version]);
  const migrator = new MySQLMigrator(c);
  expect(await migrator.status()).toMatchObject({ status: 'pending', pending: [prev.version, '033-performance-indexes', manifest.version] });

  const state = await migrator.upgradeAdditive();
  expect(state).toMatchObject({ status: 'current', version: manifest.version, pending: [] });

  const [[table]] = await c.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('ecr_devices','ecr_jobs','product_price_tiers','exchange_rates','product_currency_prices','customer_price_rules','exchange_rate_settings','exchange_rate_sources','business_tasks')");
  expect(Number(table.n)).toBe(9);
  const [[doc]] = await c.query("SELECT status,sale_id FROM edocuments WHERE id='eski-1'");
  expect(doc).toEqual({ status: 'draft', sale_id: 'S1' });
  const [[owner]] = await c.query('SELECT company_name FROM tenants WHERE id=?', [tenant.id]);
  expect(owner.company_name).toBe('Eski Müşteri');
  const [triggersAfter] = await c.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY 1');
  expect(triggersAfter).toEqual(triggersBefore);

  // Yükseltilmiş 032 tabloları çalışıyor: kur kaynağı ve otomatik ayarı işletme/para birimi başına tek, görev durumu CHECK ile sınırlı
  await c.query("INSERT INTO exchange_rate_sources (tenant_id,currency,source,buying_try,rates_date) VALUES (?,'USD','auto',38.1,'2026-11-20')", [tenant.id]);
  await expect(c.query("INSERT INTO exchange_rate_sources (tenant_id,currency,source) VALUES (?,'USD','manual')", [tenant.id])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  await c.query('INSERT INTO exchange_rate_settings (tenant_id,auto_enabled) VALUES (?,1)', [tenant.id]);
  await expect(c.query('INSERT INTO exchange_rate_settings (tenant_id,auto_enabled) VALUES (?,0)', [tenant.id])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  await c.query("INSERT INTO business_tasks (tenant_id,title,status,priority,due_date) VALUES (?,'Sayım yap','open','high','2026-11-30')", [tenant.id]);
  await expect(c.query("INSERT INTO business_tasks (tenant_id,title,status) VALUES (?,'Hatalı durum','bogus')", [tenant.id])).rejects.toBeTruthy();

  // Yükseltilmiş müşteri fiyat kuralı tablosu çalışıyor: cari hesap başına tek kural
  const [acc] = await c.query("INSERT INTO retail_credit_accounts (tenant_id,name) VALUES (?,'Kural Müşterisi')", [tenant.id]);
  await c.query('INSERT INTO customer_price_rules (tenant_id,account_id,price_tier,discount_percent) VALUES (?,?,2,10)', [tenant.id, acc.insertId]);
  await expect(c.query('INSERT INTO customer_price_rules (tenant_id,account_id,price_tier,discount_percent) VALUES (?,?,3,5)', [tenant.id, acc.insertId])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

  // Yükseltilmiş dövizli fiyat tabloları çalışıyor: kur ve ürün fiyatı eklenir, aynı kur/ürün ikinci kez eklenemez
  await c.query("INSERT INTO exchange_rates (tenant_id,currency,rate_try) VALUES (?,'USD',38.5)", [tenant.id]);
  await expect(c.query("INSERT INTO exchange_rates (tenant_id,currency,rate_try) VALUES (?,'USD',39)", [tenant.id])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

  // Yükseltilmiş fiyat türü tablosu çalışıyor: ürün ve kademe eklenir, aynı kademe ikinci kez eklenemez
  const [prod] = await c.query("INSERT INTO products (tenant_id,sku,name,unit,sale_price,module_type) VALUES (?,'PT-1','Fiyat türü ürünü','adet',100,'NORMAL')", [tenant.id]);
  await c.query('INSERT INTO product_price_tiers (tenant_id,product_id,tier,price) VALUES (?,?,2,80.5)', [tenant.id, prod.insertId]);
  await expect(c.query('INSERT INTO product_price_tiers (tenant_id,product_id,tier,price) VALUES (?,?,2,70)', [tenant.id, prod.insertId])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

  // ÖKC tabloları (028) hâlâ çalışıyor: cihaz ve iş eklenir, aynı satış için ikinci iş eklenemez
  const [dev] = await c.query("INSERT INTO ecr_devices (tenant_id,brand,connection,name) VALUES (?,'simulator','simulated','Deneme')", [tenant.id]);
  await c.query("INSERT INTO ecr_jobs (tenant_id,device_id,sale_id,kind,status) VALUES (?,?,501,'sale','pending')", [tenant.id, dev.insertId]);
  await expect(c.query("INSERT INTO ecr_jobs (tenant_id,device_id,sale_id,kind,status) VALUES (?,?,501,'sale','pending')", [tenant.id, dev.insertId])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

  // Önceki adımın (027) tablosu yükseltmeden sonra da çalışıyor: numara kaydı eklenir, aynı seri/yıl/sıra ikinci kez eklenemez
  await c.query("INSERT INTO edocument_numbers (document_id,tenant_id,series,year,seq,number) VALUES ('eski-1',?,'VNX',2027,1,'VNX2027000000001')", [tenant.id]);
  await c.query("INSERT INTO edocuments (id,tenant_id,sale_id,document_type,status,payload) VALUES ('eski-2',?,'S2','E_ARSIV','draft','{}')", [tenant.id]);
  await expect(c.query("INSERT INTO edocument_numbers (document_id,tenant_id,series,year,seq,number) VALUES ('eski-2',?,'VNX',2027,1,'VNX2027000000001')", [tenant.id])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

  // Yükseltme tekrarlanırsa zarar vermez
  expect(await new MySQLMigrator(c).upgradeAdditive()).toMatchObject({ status: 'current' });
});

test('033: yalnız indeks ekleyen adım; indeksler eklenir, veri korunur, ikinci çalıştırma değişiklik yapmaz', async () => {
  // Önceki testten kalan tam şemada 033 geri alınır: 032 kurulu, 033 yok
  await dropAddedIndexes();
  const [[tenant]] = await c.query("INSERT INTO tenants (company_name,tenant_code,email) VALUES ('İndeks Müşterisi','IDX-UPG-1','idx@example.com')").then(r => [[{ id: r[0].insertId }]]);
  const [prod] = await c.query("INSERT INTO products (tenant_id,sku,name,unit,sale_price,module_type,gtin) VALUES (?,'IDX-1','İndeks ürünü','adet',10,'NORMAL','8690000000017')", [tenant.id]);
  // Sonraki adım (034, yalnız sütun) da yeniden uygulanır; sütunlar zaten var olduğu için atlanır.
  await c.query('DELETE FROM veniux_mysql_migrations WHERE version IN (?,?)', ['033-performance-indexes', manifest.version]);
  const added = addedIndexes(manifest);
  expect(added.map(i => i.name).sort()).toEqual(['idx_audit_logs_tenant_created', 'idx_pos_sale_items_product', 'idx_pos_sales_tenant_created', 'idx_product_uoms_barcode', 'idx_products_tenant_created', 'idx_products_tenant_gtin', 'idx_retail_sales_tenant_date', 'idx_stock_movements_tenant_created', 'idx_stock_records_tenant_updated']);
  for (const ix of added) expect(await indexNames(ix.table)).not.toContain(ix.name);
  const migrator = new MySQLMigrator(c);
  expect(await migrator.status()).toMatchObject({ status: 'pending', pending: ['033-performance-indexes', manifest.version] });

  expect(await migrator.upgradeAdditive()).toMatchObject({ status: 'current', version: manifest.version, pending: [] });
  for (const ix of added) expect(await indexNames(ix.table)).toContain(ix.name);
  const [[row]] = await c.query('SELECT gtin FROM products WHERE id=?', [prod.insertId]);
  expect(row.gtin).toBe('8690000000017');
  // Sorgu yeni indeksi kullanabiliyor (gtin önek indeksi)
  const [plan] = await c.query("EXPLAIN SELECT id FROM products WHERE tenant_id=? AND gtin='8690000000017'", [tenant.id]);
  expect(String(plan[0].possible_keys)).toContain('idx_products_tenant_gtin');

  // İkinci çalıştırma: değişiklik yok; elle bir indeks eksiltilip kayıt silinirse yeniden tamamlanır (yarım kalmış yükseltme)
  const [[before]] = await c.query('SELECT COUNT(*) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()');
  expect(await new MySQLMigrator(c).upgradeAdditive()).toMatchObject({ status: 'current' });
  const [[after]] = await c.query('SELECT COUNT(*) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()');
  expect(after.n).toBe(before.n);
  await c.query('ALTER TABLE products DROP INDEX idx_products_tenant_created');
  await c.query('DELETE FROM veniux_mysql_migrations WHERE version IN (?,?)', ['033-performance-indexes', manifest.version]);
  expect(await new MySQLMigrator(c).upgradeAdditive()).toMatchObject({ status: 'current' });
  expect(await indexNames('products')).toContain('idx_products_tenant_created');
});

test('034: yalnız sütun ekleyen adım; mevcut satırlar TRY olur, veri korunur, yeni satırlar para birimi taşır, tekrar çalıştırma zarar vermez', async () => {
  const [[tenant]] = await c.query("INSERT INTO tenants (company_name,tenant_code,email) VALUES ('Sütun Müşterisi','COL-UPG-1','col@example.com')").then(r => [[{ id: r[0].insertId }]]);
  // "Eski kurulum": para birimi sütunları yok, 034 kaydı yok; eski satış ve belge var
  await dropAddedColumns();
  expect(await columnNames('pos_sales')).not.toContain('currency');
  expect(await columnNames('edocuments')).not.toContain('currency');
  await c.query("INSERT INTO pos_sales (tenant_id,receipt_no,total_amount,net_amount,payment_method,status) VALUES (?,'POS-ESKI-1',12.5,12.5,'cash','completed')", [tenant.id]);
  await c.query("INSERT INTO edocuments (id,tenant_id,sale_id,document_type,status,payload) VALUES ('col-1',?,'1','E_ARSIV','draft','{}')", [tenant.id]);
  await c.query('DELETE FROM veniux_mysql_migrations WHERE version=?', [manifest.version]);
  const migrator = new MySQLMigrator(c);
  expect(await migrator.status()).toMatchObject({ status: 'pending', pending: [manifest.version] });

  expect(await migrator.upgradeAdditive()).toMatchObject({ status: 'current', version: manifest.version, pending: [] });
  expect(await columnNames('pos_sales')).toContain('currency');
  expect(await columnNames('edocuments')).toContain('currency');
  const [[sale]] = await c.query("SELECT currency,net_amount FROM pos_sales WHERE receipt_no='POS-ESKI-1'");
  expect({ currency: sale.currency, net: Number(sale.net_amount) }).toEqual({ currency: 'TRY', net: 12.5 });
  const [[doc]] = await c.query("SELECT currency,status FROM edocuments WHERE id='col-1'");
  expect(doc).toEqual({ currency: 'TRY', status: 'draft' });
  // Yeni satır para birimi taşıyabilir
  await c.query("INSERT INTO pos_sales (tenant_id,receipt_no,total_amount,net_amount,payment_method,status,currency) VALUES (?,'POS-YENI-1',5,5,'cash','completed','AZN')", [tenant.id]);
  const [[fresh]] = await c.query("SELECT currency FROM pos_sales WHERE receipt_no='POS-YENI-1'");
  expect(fresh.currency).toBe('AZN');

  // Tekrar çalıştırma: değişiklik yok; sütun elle düşürülüp kayıt silinirse yeniden tamamlanır
  expect(await new MySQLMigrator(c).upgradeAdditive()).toMatchObject({ status: 'current' });
  await c.query('ALTER TABLE edocuments DROP COLUMN currency');
  await c.query('DELETE FROM veniux_mysql_migrations WHERE version=?', [manifest.version]);
  expect(await new MySQLMigrator(c).upgradeAdditive()).toMatchObject({ status: 'current' });
  expect(await columnNames('edocuments')).toContain('currency');
});
