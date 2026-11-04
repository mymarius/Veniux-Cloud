// Defter tutulmadan oluşmuş stok farkını konumsuz, lotsuz bir açılış kaydıyla kapatır.
// Stok miktarını değiştirmez; lot ve raf hesapları lotsuz/konumsuz satırları saymaz.
// Aynı SQL iki motorda da çalışır; MySQL'de: npm run mysql:ledger-backfill
const stock = 'COALESCE((SELECT SUM(s.quantity) FROM stock_records s WHERE s.tenant_id=k.tenant_id AND s.warehouse_id=k.warehouse_id AND s.product_id=k.product_id),0)';
const ledger = 'COALESCE((SELECT SUM(t.quantity) FROM inventory_transactions t WHERE t.tenant_id=k.tenant_id AND t.warehouse_id=k.warehouse_id AND t.product_id=k.product_id),0)';
const balances = `SELECT k.tenant_id,k.warehouse_id,k.product_id,${stock} AS stock_qty,${ledger} AS ledger_qty
  FROM (SELECT tenant_id,warehouse_id,product_id FROM stock_records UNION SELECT tenant_id,warehouse_id,product_id FROM inventory_transactions) k
  JOIN products p ON p.id=k.product_id AND p.tenant_id=k.tenant_id
  JOIN warehouses w ON w.id=k.warehouse_id AND w.tenant_id=k.tenant_id`;
const DRIFT_SQL = `SELECT b.* FROM (${balances}) b WHERE ABS(b.stock_qty-b.ledger_qty)>0.000001`;
const BACKFILL_SQL = `INSERT INTO inventory_transactions (tenant_id,warehouse_id,product_id,transaction_type,quantity,before_quantity,after_quantity,reference_type,reason_code,notes)
  SELECT d.tenant_id,d.warehouse_id,d.product_id,'OPENING_BALANCE',ROUND(d.stock_qty-d.ledger_qty,6),d.ledger_qty,d.stock_qty,'ledger_backfill','LEDGER_BACKFILL','Defter öncesi stok farkı için açılış kaydı'
  FROM (${DRIFT_SQL}) d`;

module.exports = db => {
  db.exec(BACKFILL_SQL);
};
module.exports.DRIFT_SQL = DRIFT_SQL;
module.exports.BACKFILL_SQL = BACKFILL_SQL;
