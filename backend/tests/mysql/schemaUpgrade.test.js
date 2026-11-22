// Eski kurulumun yeni şemaya yükseltilmesi (masaüstü local-server upgradeSchema ile aynı çağrı: MySQLMigrator.upgradeAdditive).
// Ayrı, geçici bir veritabanında "eski kurulum" kurulur (son şema adımı geri alınmış gibi), veri eklenir, yükseltilir; veri ve tetikleyiciler korunmalı.
const mysql = require('mysql2/promise');
const { MySQLMigrator, manifest } = require('../../src/database/mysqlMigrator');

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
  await admin?.end().catch(() => {});
});

test('son adım yalnız yeni tablo ekler; geri alınmış (eski) kurulum veri kaybetmeden yükselir', async () => {
  await new MySQLMigrator(c).migrate();
  const [[tenant]] = await c.query("INSERT INTO tenants (company_name,tenant_code,email) VALUES ('Eski Müşteri','ESKI-UPG-1','eski@example.com')").then(r => [[{ id: r[0].insertId }]]);
  await c.query("INSERT INTO edocuments (id,tenant_id,sale_id,document_type,status,payload) VALUES ('eski-1',?,'S1','E_ARSIV','draft','{}')", [tenant.id]);
  const [triggersBefore] = await c.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY 1');

  // "Eski kurulum": son sürümün tablosu ve kaydı yok (031: müşteri fiyat kuralı)
  await c.query('DROP TABLE customer_price_rules');
  await c.query('DELETE FROM veniux_mysql_migrations WHERE version=?', [manifest.version]);
  const migrator = new MySQLMigrator(c);
  expect(await migrator.status()).toMatchObject({ status: 'pending', pending: [manifest.version] });

  const state = await migrator.upgradeAdditive();
  expect(state).toMatchObject({ status: 'current', version: manifest.version, pending: [] });

  const [[table]] = await c.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('ecr_devices','ecr_jobs','product_price_tiers','exchange_rates','product_currency_prices','customer_price_rules')");
  expect(Number(table.n)).toBe(6);
  const [[doc]] = await c.query("SELECT status,sale_id FROM edocuments WHERE id='eski-1'");
  expect(doc).toEqual({ status: 'draft', sale_id: 'S1' });
  const [[owner]] = await c.query('SELECT company_name FROM tenants WHERE id=?', [tenant.id]);
  expect(owner.company_name).toBe('Eski Müşteri');
  const [triggersAfter] = await c.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY 1');
  expect(triggersAfter).toEqual(triggersBefore);

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
