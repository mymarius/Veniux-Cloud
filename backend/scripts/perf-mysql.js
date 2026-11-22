// MySQL indeks ölçümü (033-performance-indexes): yalnız yerel test sunucusu (127.0.0.1:33316, veniux_test_* veritabanı).
// Kullanım: node scripts/perf-mysql.js <veritabanı: veniux_test_import> [ürün] [satış]
// Veriyi sunucu tarafında üretir (SQLite perf-seed.js ile aynı büyüklük: 50 bin ürün, ~150 bin satış, ~525 bin satır),
// 033 indekslerini kaldırıp "önce", yeniden ekleyip "sonra" süreleri ölçer; indeks kurulurken yazma gecikmesini de ölçer.
// Kurulumdan sonra veritabanını boşaltır.
const mysql = require('mysql2/promise'), fs = require('fs'), path = require('path');
const { MySQLMigrator, manifest } = require('../src/database/mysqlMigrator');
const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../.local/mysql-test/config.json')));
const DB = process.argv[2];
if (cfg.host !== '127.0.0.1' || cfg.port !== 33316 || !/^veniux_test_[a-z_]+$/.test(DB || '')) throw Error('Yalnız yerel test sunucusu ve veniux_test_* hedefi.');
const P = Number(process.argv[3] || 50000), S = Number(process.argv[4] || 150000);
const prev = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/database/mysql/032-fx-auto-tasks.json'), 'utf8'));
const added = manifest.tables.flatMap(t => t.indexes.filter(i => !prev.tables.find(p => p.name === t.name).indexes.some(o => o.name === i.name)).map(i => ({ table: t.name, ...i })));
const ixCols = ix => ix.columns.map(n => '`' + n + '`' + (ix.prefix?.[n] ? '(' + ix.prefix[n] + ')' : '')).join(',');
const conn = () => mysql.createConnection({ ...cfg, database: DB });
const ms = async fn => { const t = process.hrtime.bigint(); await fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

(async () => {
  const c = await conn();
  const out = { database: DB, products: P, sales: S };
  try {
    await c.query('DROP DATABASE `' + DB + '`'); await c.query('CREATE DATABASE `' + DB + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'); await c.query('USE `' + DB + '`');
    await new MySQLMigrator(c).migrate();
    await c.query('SET FOREIGN_KEY_CHECKS=0');
    // 033 indekslerini kaldır: "önce" durumu
    for (const ix of added) await c.query('ALTER TABLE `' + ix.table + '` DROP INDEX `' + ix.name + '`');
    const [t] = await c.query("INSERT INTO tenants(tenant_code,company_name,email) VALUES('PERF-1','Perf','perf@example.com')"); const T = t.insertId;
    const [w] = await c.query("INSERT INTO warehouses(tenant_id,name,type) VALUES(?,'Depo','retail')", [T]); const W = w.insertId;
    await c.query('CREATE TABLE perf_d(n INT)'); await c.query('INSERT INTO perf_d VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)');
    const N = n => `(SELECT a.n+b.n*10+c.n*100+d.n*1000+e.n*10000+f.n*100000 AS i FROM perf_d a,perf_d b,perf_d c,perf_d d,perf_d e,perf_d f WHERE a.n+b.n*10+c.n*100+d.n*1000+e.n*10000+f.n*100000<${n})`;
    out.seedSeconds = {};
    const seed = async (name, sql, params = []) => { out.seedSeconds[name] = Math.round(await ms(() => c.query(sql, params))) / 1000; };
    await seed('products', `INSERT INTO products(tenant_id,sku,name,category,barcode,gtin,unit,sale_price,purchase_price,module_type,created_at,updated_at) SELECT ?,CONCAT('SKU',i),CONCAT('Urun ',i),ELT(i%8+1,'Gida','Icecek','Temizlik','Kirtasiye','Bakliyat','Sut','Atistirmalik','Hirdavat'),CAST(8690000000000+i AS CHAR),CAST(8690000000000+i AS CHAR),'adet',5+i%90,3,'NORMAL',NOW()-INTERVAL (i%730) DAY,NOW() FROM ${N(P)} x`, [T]);
    await seed('product_uoms', `INSERT INTO product_uoms(tenant_id,product_id,uom_code,conversion_factor,barcode) SELECT ?,id,'KOLI',12,CONCAT('KOLI',id) FROM products WHERE tenant_id=?`, [T, T]);
    await seed('stock_records', 'INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity,updated_at) SELECT ?,?,id,100,NOW()-INTERVAL (id%365) DAY FROM products WHERE tenant_id=?', [T, W, T]);
    await seed('pos_sales', `INSERT INTO pos_sales(id,tenant_id,receipt_no,total_amount,net_amount,payment_method,status,created_at) SELECT i+1,?,CONCAT('PERF-',i),30,30,'cash','completed',TIMESTAMP('2024-11-23 08:00:00')+INTERVAL (i*730*86400 DIV ${S}) SECOND FROM ${N(S)} x`, [T]);
    await seed('retail_sales', `INSERT INTO retail_sales(sale_id,tenant_id,warehouse_id,user_id,business_date,snapshot_json,created_at) SELECT id,tenant_id,?,1,DATE(created_at),'{}',created_at FROM pos_sales WHERE tenant_id=?`, [W, T]);
    await seed('pos_sale_items', `INSERT INTO pos_sale_items(tenant_id,sale_id,product_id,quantity,unit_price,total_price) SELECT ?,s.id,(s.id*7+k.n*13)%?+1,1,10,10 FROM pos_sales s JOIN (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3) k ON k.n<3+(s.id%2) WHERE s.tenant_id=?`, [T, P, T]);
    await seed('stock_movements', `INSERT INTO stock_movements(tenant_id,product_id,warehouse_id,change_amount,movement_type,created_at) SELECT ?,product_id,?,-1,'sale',(SELECT created_at FROM pos_sales p WHERE p.id=i.sale_id) FROM pos_sale_items i WHERE tenant_id=?`, [T, W, T]);
    await seed('audit_logs', `INSERT INTO audit_logs(tenant_id,action,entity_type,created_at) SELECT ?,'sale','pos_sale',created_at FROM pos_sales WHERE tenant_id=?`, [T, T]);
    await c.query('SET FOREIGN_KEY_CHECKS=1');
    for (const tb of ['products', 'product_uoms', 'stock_records', 'pos_sales', 'retail_sales', 'pos_sale_items', 'stock_movements', 'audit_logs']) await c.query('ANALYZE TABLE `' + tb + '`');
    out.rows = Object.fromEntries(await Promise.all(['products', 'product_uoms', 'stock_records', 'pos_sales', 'retail_sales', 'pos_sale_items', 'stock_movements', 'audit_logs'].map(async tb => [tb, Number((await c.query('SELECT COUNT(*) n FROM `' + tb + '`'))[0][0].n)])));
    const [[mid]] = await c.query('SELECT business_date d FROM retail_sales WHERE tenant_id=? ORDER BY sale_id DESC LIMIT 1 OFFSET 700', [T]);
    const gt = '8690000000000'.slice(0, 0) + String(8690000000000 + Math.floor(P / 2));
    const queries = {
      'retail_sales hafta aralığı': ['SELECT COUNT(*),COUNT(DISTINCT business_date) FROM retail_sales WHERE tenant_id=? AND business_date BETWEEN ? AND ?', [T, mid.d, mid.d.slice(0, 8) + '28']],
      'pos_sale_items satış kalemleri (sale_id; FK indeksi var)': ['SELECT * FROM pos_sale_items WHERE sale_id=?', [S / 2]],
      'pos_sale_items ürün satış geçmişi': ['SELECT COUNT(*),SUM(quantity) FROM pos_sale_items WHERE tenant_id=? AND product_id=?', [T, Math.floor(P / 3)]],
      'pos_sales son 100': ['SELECT * FROM pos_sales WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100', [T]],
      'stock_movements son 100': ['SELECT * FROM stock_movements WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100', [T]],
      'audit_logs son 100': ['SELECT * FROM audit_logs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100', [T]],
      'stock_records sayfa (updated_at,id)': ['SELECT * FROM stock_records WHERE tenant_id=? ORDER BY updated_at DESC,id DESC LIMIT 50', [T]],
      'ürün GTIN ile arama': ['SELECT id FROM products WHERE tenant_id=? AND gtin=?', [T, gt]],
      'ürün barkod VEYA GTIN': ['SELECT id FROM products WHERE tenant_id=? AND (barcode=? OR gtin=?)', [T, gt, gt]],
      'koli barkodu': ['SELECT product_id FROM product_uoms WHERE tenant_id=? AND barcode=?', [T, 'KOLI' + Math.floor(P / 2)]],
      'ürünler en yeni 50': ['SELECT * FROM products WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50', [T]],
    };
    const measure = async () => { const r = {}; for (const [k, [sql, p]] of Object.entries(queries)) { const a = []; for (let i = 0; i < 5; i++) a.push(await ms(() => c.query(sql, p))); r[k] = Math.round(median(a) * 10) / 10; } return r; };
    out.beforeMs = await measure();
    // İndeks kurulumu: süre + eşzamanlı yazma gecikmesi (LOCK=NONE)
    const w2 = await conn(); let stop = false; const lat = [];
    const writer = (async () => { let k = 0; while (!stop) { lat.push(await ms(() => w2.query("INSERT INTO audit_logs(tenant_id,action,entity_type) VALUES(?,'x','perf')", [T]))); if (++k % 5 === 0) await ms(() => w2.query('UPDATE products SET updated_at=NOW(6) WHERE id=?', [1 + (k % P)])).then(v => lat.push(v)); await new Promise(r => setTimeout(r, 2)); } })();
    await new Promise(r => setTimeout(r, 300)); const baseline = lat.splice(0);
    out.indexBuildSeconds = {};
    const t0 = Date.now();
    for (const ix of added) out.indexBuildSeconds[ix.name] = Math.round(await ms(() => c.query('ALTER TABLE `' + ix.table + '` ADD INDEX `' + ix.name + '`(' + ixCols(ix) + '), ALGORITHM=INPLACE, LOCK=NONE'))) / 1000;
    out.indexBuildTotalSeconds = (Date.now() - t0) / 1000;
    stop = true; await writer; await w2.end();
    out.writeLatencyMs = { idleMedian: Math.round(median(baseline) * 10) / 10, duringBuild: { writes: lat.length, median: Math.round(median(lat) * 10) / 10, p99: Math.round([...lat].sort((a, b) => a - b)[Math.floor(lat.length * 0.99)] * 10) / 10, max: Math.round(Math.max(...lat) * 10) / 10 } };
    for (const tb of ['products', 'product_uoms', 'stock_records', 'pos_sales', 'retail_sales', 'pos_sale_items', 'stock_movements', 'audit_logs']) await c.query('ANALYZE TABLE `' + tb + '`');
    out.afterMs = await measure();
    const [sz] = await c.query('SELECT TABLE_NAME t,ROUND(DATA_LENGTH/1048576,1) data_mb,ROUND(INDEX_LENGTH/1048576,1) index_mb FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (\'products\',\'product_uoms\',\'stock_records\',\'pos_sales\',\'retail_sales\',\'pos_sale_items\',\'stock_movements\',\'audit_logs\')');
    out.sizesMb = sz;
    const [[fk]] = await c.query("SELECT GROUP_CONCAT(DISTINCT INDEX_NAME) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pos_sale_items' AND COLUMN_NAME='sale_id' AND SEQ_IN_INDEX=1");
    out.posSaleItemsSaleIdIndexes = fk.n;
  } finally {
    await c.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});
    await c.query('DROP DATABASE `' + DB + '`').catch(() => {}); await c.query('CREATE DATABASE `' + DB + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin').catch(() => {});
    await c.end();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
