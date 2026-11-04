/** MySQL şemasını kurar ve durumunu raporlar. */
const { initMySQL, getMySQLPool } = require('../src/config/mysqlAdapter');

(async () => {
  const ok = await initMySQL();
  if (!ok) {
    console.log('BAĞLANTI KURULAMADI');
    process.exit(1);
  }
  const pool = getMySQLPool();

  const [count] = await pool.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE table_schema = DATABASE()'
  );
  console.log('MySQL tablo sayısı:', count[0].c);

  const critical = [
    'warehouse_locations', 'inventory_transactions', 'wms_pick_waves',
    'wms_inbound_receipts', 'pharmacy_staff', 'duty_schedule', 'product_bin_records'
  ];
  const [found] = await pool.query(
    `SELECT TABLE_NAME AS t FROM information_schema.TABLES
     WHERE table_schema = DATABASE() AND TABLE_NAME IN (${critical.map(() => '?').join(',')})`,
    critical
  );
  const names = found.map((r) => r.t);
  console.log('kritik tablolar var:', names.join(', ') || '(hiçbiri)');
  const missing = critical.filter((c) => !names.includes(c));
  console.log('eksik:', missing.join(', ') || 'yok');

  // dolu tabloları listele
  const [tables] = await pool.query(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE table_schema = DATABASE() ORDER BY TABLE_NAME'
  );
  const rows = [];
  for (const { t } of tables) {
    const [r] = await pool.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
    if (r[0].c > 0) rows.push(`${t}=${r[0].c}`);
  }
  console.log('dolu tablolar:', rows.join(', ') || '(hepsi boş)');
  process.exit(0);
})().catch((e) => {
  console.error('HATA:', e.message);
  process.exit(1);
});
