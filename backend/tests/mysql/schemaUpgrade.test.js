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

  // "Eski kurulum": son sürümün tablosu ve kaydı yok
  await c.query('DROP TABLE edocument_numbers');
  await c.query('DELETE FROM veniux_mysql_migrations WHERE version=?', [manifest.version]);
  const migrator = new MySQLMigrator(c);
  expect(await migrator.status()).toMatchObject({ status: 'pending', pending: [manifest.version] });

  const state = await migrator.upgradeAdditive();
  expect(state).toMatchObject({ status: 'current', version: manifest.version, pending: [] });

  const [[table]] = await c.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='edocument_numbers'");
  expect(Number(table.n)).toBe(1);
  const [[doc]] = await c.query("SELECT status,sale_id FROM edocuments WHERE id='eski-1'");
  expect(doc).toEqual({ status: 'draft', sale_id: 'S1' });
  const [[owner]] = await c.query('SELECT company_name FROM tenants WHERE id=?', [tenant.id]);
  expect(owner.company_name).toBe('Eski Müşteri');
  const [triggersAfter] = await c.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY 1');
  expect(triggersAfter).toEqual(triggersBefore);

  // Yükseltilmiş tablo çalışıyor: numara kaydı eklenir, aynı seri/yıl/sıra ikinci kez eklenemez
  await c.query("INSERT INTO edocument_numbers (document_id,tenant_id,series,year,seq,number) VALUES ('eski-1',?,'VNX',2027,1,'VNX2027000000001')", [tenant.id]);
  await c.query("INSERT INTO edocuments (id,tenant_id,sale_id,document_type,status,payload) VALUES ('eski-2',?,'S2','E_ARSIV','draft','{}')", [tenant.id]);
  await expect(c.query("INSERT INTO edocument_numbers (document_id,tenant_id,series,year,seq,number) VALUES ('eski-2',?,'VNX',2027,1,'VNX2027000000001')", [tenant.id])).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

  // Yükseltme tekrarlanırsa zarar vermez
  expect(await new MySQLMigrator(c).upgradeAdditive()).toMatchObject({ status: 'current' });
});
