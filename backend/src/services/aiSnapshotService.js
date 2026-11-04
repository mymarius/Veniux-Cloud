const db=require('../config/database');
async function snapshot(tenant){
 if(!Number.isSafeInteger(tenant)||tenant<=0)throw new Error('Firma bağlamı gerekli.');
 const products=(await db.query(`SELECT p.id,p.sku,p.name,p.unit,p.min_stock_level,p.purchase_price,p.sale_price,COALESCE(SUM(s.quantity),0) AS quantity FROM products p LEFT JOIN stock_records s ON s.product_id=p.id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=$1 GROUP BY p.id ORDER BY p.id LIMIT 200`,[tenant])).rows;
 const movements=(await db.query('SELECT product_id,warehouse_id,change_amount,movement_type,created_at FROM stock_movements WHERE tenant_id=$1 ORDER BY id DESC LIMIT 30',[tenant])).rows;
 return {products,recent_movements:movements,limits:{products:200,movements:30},captured_at:new Date().toISOString()};
}
module.exports={snapshot};
