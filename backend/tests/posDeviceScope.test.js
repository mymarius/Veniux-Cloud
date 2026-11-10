// MySQL kapsam denetimi (scopeQueryContext.validateMySQLWrite) kasa cihazı yazılarını kabul etmeli.
// Canlıda "Yazılan kayıt firma veya depo kapsamınız dışında. [update pos_devices]" hatasını veren COALESCE'li güncelleme
// reddedilir; yerine konan basit güncellemeler kabul edilir.
process.env.AUTH_RATE_LIMIT_MAX = '1000';
const scope = require('../src/services/scopeQueryContext');
const { manifest } = require('../src/database/mysqlMigrator');
const { translateToMySQL } = require('../src/config/mysqlAdapter');

// Yazılan değerleri her zaman izinli sayan sahte bağlantı: yalnız ifade biçimi (düz parametre mi?) sınanır.
const connection = { async query(sql, params) { return /AS value/.test(sql) ? [[{ value: params && params.length ? params[0] : null }]] : [[{ id: 1, tenant_id: 1 }]]; } };
const check = (sql, params) => scope.run({ mode: 'company', tenantId: 1, warehouse_ids: [] }, () => scope.validateMySQLWrite(sql, params, connection, translateToMySQL));
beforeAll(() => scope.initializeMySQL('probe_db', manifest));

test('eski COALESCE\'li kasa cihazı güncellemesi kapsam denetiminde reddedilir (hatanın nedeni)', async () => {
  await expect(check('UPDATE pos_devices SET last_seen_at=CURRENT_TIMESTAMP,register_id=COALESCE($1,register_id) WHERE id=$2 AND tenant_id=$3', [1, 5, 1]))
    .rejects.toMatchObject({ status: 403, message: expect.stringContaining('[update pos_devices]') });
});

test('yeni basit güncellemeler ve cihaz/satış kayıtları kapsam denetiminden geçer', async () => {
  await check('UPDATE pos_devices SET last_seen_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2', [5, 1]);
  await check('UPDATE pos_devices SET register_id=$1 WHERE id=$2 AND tenant_id=$3', [1, 5, 1]);
  await check('INSERT INTO pos_devices (tenant_id,device_uid,register_id,platform,label) VALUES ($1,$2,$3,$4,$5)', [1, 'cihaz-0000001', 1, 'web', 'Tarayıcı kasa']);
  await check("INSERT INTO pos_sale_meta (tenant_id,sale_id,client_uuid,device_id,local_receipt_no,mode,okc_status) VALUES ($1,$2,$3,$4,$5,'online','not_required')", [1, 7, 'k', 5, '01-01-20261110-00001']);
  await check("UPDATE pos_sale_meta SET mode='offline' WHERE tenant_id=$1 AND sale_id=$2", [1, 7]);
  await check('INSERT INTO pos_offline_sales (tenant_id,sale_id,emergency_receipt_no,offline_at,conflict_count) VALUES ($1,$2,$3,$4,$5)', [1, 7, 'E1AB-20261110-00001', '2026-11-10T10:00:00.000Z', 1]);
  await check("INSERT INTO pos_offline_conflicts (id,tenant_id,sale_id,warehouse_id,product_id,kind,shortfall_quantity,status) VALUES ($1,$2,$3,$4,$5,'stock_shortfall',$6,'open')", ['u', 1, 7, 3, 2, 1]);
});

test('kasa cihazı kodunda COALESCE ile başvuru sütunu (kasa, depo, ürün, kullanıcı) yazan güncelleme kalmamıştır', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, '../src/services/posDeviceService.js'), 'utf8');
  const bad = source.match(/UPDATE\s+\w+\s+SET[^`']*?(register_id|warehouse_id|product_id|user_id)\s*=\s*COALESCE/gi);
  expect(bad).toBeNull();
});
